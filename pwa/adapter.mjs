import {transferError,identityMatches} from './download-diagnostics.mjs';
import {checkTransferSize} from './source.mjs';
import {FlightStorage,evidenceKey} from './flight-storage.mjs';
import {bytesOf,sha256,validateEvidence,RANGE_BYTES} from './flight-evidence.mjs';
export const MAX_FILE_BYTES=1048576;
export const FULL_ACK_GATE_PASS=false;
export const DB_NAME='huginn-pwa-p1-no-ack';
const STORES=['downloads','chunks','flights','clients'];
const fail=code=>{throw new Error(code);};
const request=r=>new Promise((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
export function requireFeatures(env=globalThis) {
  if(!env.isSecureContext)fail('SECURE_CONTEXT_REQUIRED');
  if(!env.crypto?.subtle)fail('CRYPTO_UNAVAILABLE');
  if(!env.indexedDB)fail('INDEXEDDB_UNAVAILABLE');
}
export function checkSize(size) {
  if(!Number.isSafeInteger(size)||size<128||size>MAX_FILE_BYTES)fail('FILE_SIZE_LIMIT');
}
export async function identifyFixture(value,catalog) {
  const raw=bytesOf(value).slice();checkSize(raw.length);
  const digest=await sha256(raw);
  const fixture=catalog.fixtures.find(f=>f.metadata.physical_sha256===digest);
  if(!fixture)fail('SYNTHETIC_FIXTURE_NOT_RECOGNIZED');
  await validateEvidence(raw,fixture.metadata);
  return {raw,metadata:structuredClone(fixture.metadata)};
}
class NoAckStorage extends FlightStorage {
  async readEvidence(E,options){
    const d=await this.get('downloads',E);
    if(d){checkTransferSize(Number(d.metadata.physical_bytes));if(BigInt(d.committed_offset)>BigInt(d.metadata.physical_bytes))fail('CHUNK_REVALIDATION_FAILED');}
    return super.readEvidence(E,options);
  }
  async removeLocal(E){
    if(!Array.isArray(E)||E.length!==3||E.some(v=>typeof v!=='string'))fail('INVALID_LOCAL_KEY');
    return this.transaction(['downloads','chunks','flights'],'readwrite',async tx=>{
      const ds=tx.objectStore('downloads'),cs=tx.objectStore('chunks'),flights=tx.objectStore('flights');
      const flight=await request(flights.get(E)),download=await request(ds.get(E));
      if(!flight||!download||download.phase!=='IMPORTED')fail('FLIGHT_NOT_IMPORTED');
      if(JSON.stringify(evidenceKey(flight.metadata))!==JSON.stringify(E)||JSON.stringify(evidenceKey(download.metadata))!==JSON.stringify(E))fail('LOCAL_OWNERSHIP_MISMATCH');
      const keys=await request(cs.index('evidence').getAllKeys(E));
      for(const key of keys){if(!Array.isArray(key)||key.length!==4||E.some((v,i)=>key[i]!==v))fail('LOCAL_OWNERSHIP_MISMATCH');await request(cs.delete(key));}
      await request(flights.delete(E));await request(ds.delete(E));return {deleted:true,scope:'PHONE_LOCAL_ONLY'};
    });
  }
  async createAckPending(){fail('NO_ACK');}
  async simulateAckSuccess(){fail('NO_ACK');}
  async evaluateGate(){return {eligible:false,checks:{FULL_ACK_GATE_PASS:false},failed:['NO_ACK']};}
  async transaction(names,mode,work){
    if(names.some(n=>!STORES.includes(n)))fail('NO_ACK');
    return super.transaction(names,mode,work);
  }
}
async function openDatabase(indexedDB,name) {
  const r=indexedDB.open(name,1);
  r.onupgradeneeded=()=>{
    const db=r.result;
    for(const name of STORES){
      const store=db.createObjectStore(name);
      if(['downloads','flights'].includes(name))store.createIndex('session','session',{unique:false});
      if(name==='chunks')store.createIndex('evidence','evidence',{unique:false});
    }
  };
  const db=await request(r);
  if([...db.objectStoreNames].sort().join()!==[...STORES].sort().join()){db.close();fail('UNEXPECTED_DATABASE_SCHEMA');}
  db.onversionchange=()=>db.close();return db;
}
export async function openPwa({catalog,indexedDB=globalThis.indexedDB,name=DB_NAME}={}) {
  if(catalog?.schema!=='huginn.pwa.synthetic-fixtures'||!Array.isArray(catalog.fixtures))fail('INVALID_FIXTURE_CATALOG');
  let store=new NoAckStorage(await openDatabase(indexedDB,name));
  try{await store.strictProbe();}catch(e){store.close();throw e;}
  let busy=false;
  const exclusive=async work=>{
    if(busy)fail('BUSY');busy=true;
    try{return await work();}finally{busy=false;}
  };
  async function reopenConnection(){
    store.close();store=new NoAckStorage(await openDatabase(indexedDB,name));
  }
  return Object.freeze({
    fullAckGatePass:false,
    isBusy:()=>busy,
    close:()=>store.close(),
    list:()=>exclusive(()=>store.listFlights()),
    incomplete:()=>exclusive(()=>store.transaction(['downloads'],'readonly',async tx=>
      (await request(tx.objectStore('downloads').getAll())).filter(d=>d.phase!=='IMPORTED'))),
    import:bytes=>exclusive(async()=>{
      const {raw,metadata}=await identifyFixture(bytes,catalog),E=evidenceKey(metadata);
      await store.createStaging(metadata);
      const staged=await store.resume(E);
      if(staged.phase==='STAGING'){
        for(let offset=Number(staged.committed_offset);offset<raw.length;offset+=RANGE_BYTES)
          await store.commitRange(E,String(offset),raw.subarray(offset,offset+RANGE_BYTES));
        await store.importEvidence(E);
      }
      // Close/open the database connection before assigning VERIFIED LOCAL.
      await reopenConnection();return {key:E,flight:await store.reopen(E),status:'VERIFIED LOCAL'};
    }),
    download:(source,session,{signal,onProgress=()=>{},ownerSelected=false,expectedIdentity=null}={})=>exclusive(async()=>{
      const cancelled=()=>{if(signal?.aborted)fail('CANCELLED');};
      let publishing=false,E,stage='SELECTION',requestedOffset=null,committedOffset=0,expectedBytes=null,receivedBytes=null;
      try{
        cancelled();onProgress({state:'CONNECTING'});
        stage='DETAIL';if(!source)fail('AUTH_REQUIRED');const metadata=await source.detail(session,{signal});cancelled();if(expectedIdentity&&!identityMatches(metadata,expectedIdentity))fail('SOURCE_CHANGED');onProgress({state:'DETAIL VERIFIED',metadata});
        if(metadata.source_device_id!==source.sourceDeviceId)fail('SOURCE_IDENTITY');
        checkTransferSize(Number(metadata.physical_bytes));
        if(metadata.eligible!==true||!['COMPLETE','INCOMPLETE','PROVISIONAL'].includes(metadata.state)||
           (metadata.state==='PROVISIONAL'?!ownerSelected||metadata.reason!=='OWNER_SELECTION_REQUIRED_PROVISIONAL':metadata.reason!=='AUTOMATIC'))fail('OWNER_SELECTION_REQUIRED');
        E=evidenceKey(metadata);stage='STAGING';await store.createStaging(metadata);cancelled();
        stage='RESUME_CHECK';const staged=await store.resume(E);committedOffset=Number(staged.committed_offset);if(staged.conflict)fail('CONFLICT');
        if(staged.phase==='STAGING'){
          for(let offset=Number(staged.committed_offset);offset<Number(metadata.physical_bytes);){
            cancelled();onProgress({state:'DOWNLOADING',offset,physical_bytes:Number(metadata.physical_bytes)});
            const end=Math.min(offset+RANGE_BYTES,Number(metadata.physical_bytes))-1;
            stage='RANGE';requestedOffset=offset;expectedBytes=end-offset+1;receivedBytes=null;const bytes=await source.readRange(metadata,offset,end,{signal});receivedBytes=bytes.length;cancelled();
            stage='COMMIT_RANGE';await store.commitRange(E,String(offset),bytes);offset=end+1;committedOffset=offset;
          }
          cancelled();publishing=true;stage='VALIDATION_PUBLICATION';onProgress({state:'VALIDATING'});
          await store.importEvidence(E,{shouldPublish:()=>!signal?.aborted,signal});
        }
        stage='REOPEN';await reopenConnection();const flight=await store.reopen(E);
        onProgress({state:'VERIFIED LOCAL',offset:Number(metadata.physical_bytes),physical_bytes:Number(metadata.physical_bytes)});
        return {key:E,flight,status:'VERIFIED LOCAL',replayEligible:metadata.state!=='PROVISIONAL'&&!flight.conflict};
      }catch(e){
        const state=signal?.aborted?'INCOMPLETE DOWNLOAD':publishing?'VALIDATION FAILED':'INCOMPLETE DOWNLOAD';
        if(E)try{await store.transaction(['downloads'],'readwrite',async tx=>{const ds=tx.objectStore('downloads'),d=await request(ds.get(E));if(d&&d.phase!=='IMPORTED'){d.last_result=state;await request(ds.put(d,E));}});}catch{ /* Original failure is authoritative if status persistence also fails. */ }
        const safe=transferError(e,{stage,requestedOffset,committedOffset,expectedBytes,receivedBytes:receivedBytes??e?.diagnostic?.receivedBytes});onProgress({state,code:signal?.aborted?'CANCELLED':safe.message,diagnostic:safe.diagnostic});throw safe;
      }
    }),
    removeLocal:key=>exclusive(()=>store.removeLocal(key)),
    verify:key=>exclusive(async()=>{await reopenConnection();return store.reopen(key);}),
    export:key=>exclusive(async()=>{
      await store.reopen(key);
      const {raw,download}=await store.readEvidence(key);
      checkTransferSize(raw.length);
      return {bytes:raw,filename:download.metadata.filename,sha256:download.metadata.physical_sha256};
    }),
    reimport:(key,bytes)=>exclusive(async()=>{
      checkTransferSize(bytesOf(bytes).length);
      await store.reopen(key);
      const {raw,download}=await store.readEvidence(key),incoming=bytesOf(bytes);
      await validateEvidence(incoming,download.metadata);
      if(raw.length!==incoming.length||raw.some((byte,i)=>byte!==incoming[i]))fail('ROUND_TRIP_MISMATCH');
      return {byteIdentical:true,sha256:download.metadata.physical_sha256};
    })
  });
}
export function selectExportRoute(navigator,file,canDownload=true) {
  try{if(typeof navigator?.share==='function'&&navigator.canShare?.({files:[file]})===true)return 'share';}catch{}
  if(canDownload)return 'download';
  fail('EXPORT_UNAVAILABLE');
}
export async function exportFile(payload,{navigator=globalThis.navigator,document=globalThis.document,url=globalThis.URL,File=globalThis.File}={}) {
  if(typeof File!=='function')fail('FILE_API_UNAVAILABLE');
  const file=new File([payload.bytes],payload.filename,{type:'application/octet-stream'});
  const route=selectExportRoute(navigator,file,!!document?.createElement&&typeof url?.createObjectURL==='function');
  if(route==='share')await navigator.share({files:[file],title:'HuginnAPP original FLG'});
  else{
    const href=url.createObjectURL(file),a=document.createElement('a');
    a.href=href;a.download=payload.filename;document.body.append(a);a.click();a.remove();
    setTimeout(()=>url.revokeObjectURL(href),60000);
  }
  return {route,status:'EXPORTED — NOT CLOUD CONFIRMED'};
}
