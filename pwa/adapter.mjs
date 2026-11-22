import {transferError,identityMatches} from './download-diagnostics.mjs';
import {checkTransferSize} from './source.mjs';
import {evidenceKey} from './flight-storage.mjs';
import {StreamFlightStorage} from './flight-stream-storage.mjs';
import {bytesOf,sha256,validateEvidence,RANGE_BYTES,TRANSPORT_RANGE_BYTES} from './flight-evidence.mjs';
export const MAX_FILE_BYTES=1048576;
export const FULL_ACK_GATE_PASS=false;
export const DB_NAME='huginn-pwa-p1-no-ack';
const STORES=['downloads','chunks','flights','clients'];
const fail=code=>{throw new Error(code);};
const request=r=>new Promise((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
function deleteChunks(store,E,checkValue=false){return new Promise((resolve,reject)=>{
  let deleted=0;const r=checkValue?store.index('evidence').openCursor(E):store.index('evidence').openKeyCursor(E);
  r.onerror=()=>reject(r.error);r.onsuccess=()=>{
    const c=r.result;if(!c){resolve(deleted);return;}
    try{const k=c.primaryKey,v=checkValue?c.value:null;
      if(!Array.isArray(k)||k.length!==4||E.some((x,i)=>k[i]!==x)||typeof k[3]!=='string'||!/^(0|[1-9][0-9]*)$/.test(k[3])||
        checkValue&&(!v||JSON.stringify(v.evidence)!==JSON.stringify(E)||v.start_offset!==k[3]))fail('LOCAL_OWNERSHIP_MISMATCH');
      const d=c.delete();d.onerror=()=>reject(d.error);d.onsuccess=()=>{deleted++;c.continue();};
    }catch(e){reject(e);}
  };
});}

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
class NoAckStorage extends StreamFlightStorage {
  async readEvidence(E,options){
    const d=await this.get('downloads',E);
    if(d){checkTransferSize(Number(d.metadata.physical_bytes));if(BigInt(d.committed_offset)>BigInt(d.metadata.physical_bytes))fail('CHUNK_REVALIDATION_FAILED');}
    return super.readEvidence(E,options);
  }
  async removeLocal(E){await this.removeLocalMany([E]);return {deleted:true,scope:'PHONE_LOCAL_ONLY'};}
  async removeLocalMany(input){
    if(!Array.isArray(input)||!input.length)fail('INVALID_LOCAL_KEY');
    const keys=[...new Map(input.map(E=>{if(!Array.isArray(E)||E.length!==3||E.some(v=>typeof v!=='string'))fail('INVALID_LOCAL_KEY');return [JSON.stringify(E),E];})).values()];
    return this.transaction(['downloads','chunks','flights'],'readwrite',async tx=>{
      const ds=tx.objectStore('downloads'),cs=tx.objectStore('chunks'),flights=tx.objectStore('flights');
      for(const E of keys){
        const flight=await request(flights.count(E)),download=await request(ds.get(E));
        if(!flight||!download||download.phase!=='IMPORTED')fail('FLIGHT_NOT_IMPORTED');
        if(JSON.stringify(evidenceKey(download.metadata))!==JSON.stringify(E))fail('LOCAL_OWNERSHIP_MISMATCH');
        await deleteChunks(cs,E);
        await request(flights.delete(E));await request(ds.delete(E));
      }
      return {deleted:keys.length,scope:'PHONE_LOCAL_ONLY'};
    });
  }
  // Explicit local recovery only; never discard an imported or foreign record.
  async discardStaging(E){
    if(!Array.isArray(E)||E.length!==3||E.some(v=>typeof v!=='string')||
      !/^(?:[0-9A-F]{2}:){5}[0-9A-F]{2}$/.test(E[0])||!/^[0-9a-f]{32}$/.test(E[1])||!/^[0-9a-f]{64}$/.test(E[2]))fail('INVALID_LOCAL_KEY');
    return this.transaction(['downloads','chunks','flights'],'readwrite',async tx=>{
      const ds=tx.objectStore('downloads'),cs=tx.objectStore('chunks'),fs=tx.objectStore('flights');
      const download=await request(ds.get(E)),flight=await request(fs.count(E));
      if(!download)fail('DOWNLOAD_NOT_FOUND');
      if(flight||download.phase!=='STAGING')fail('STAGING_DISCARD_FORBIDDEN');
      if(!download.metadata||JSON.stringify(evidenceKey(download.metadata))!==JSON.stringify(E)||
        JSON.stringify(download.session)!==JSON.stringify(E.slice(0,2)))fail('LOCAL_OWNERSHIP_MISMATCH');
      const deleted=await deleteChunks(cs,E,true);
      await request(ds.delete(E));
      return {discarded:true,chunks:deleted,scope:'PHONE_LOCAL_STAGING_ONLY'};
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
        stage='DETAIL';if(!source)fail('AUTH_REQUIRED');const metadata=await source.detail(session,{signal,onProgress});cancelled();if(expectedIdentity&&!identityMatches(metadata,expectedIdentity))fail('SOURCE_CHANGED');onProgress({state:'DETAIL VERIFIED',metadata});
        if(metadata.source_device_id!==source.sourceDeviceId)fail('SOURCE_IDENTITY');
        checkTransferSize(Number(metadata.physical_bytes));
        if(metadata.eligible!==true||!['COMPLETE','INCOMPLETE','PROVISIONAL'].includes(metadata.state)||
           (metadata.state==='PROVISIONAL'?!ownerSelected||metadata.reason!=='OWNER_SELECTION_REQUIRED_PROVISIONAL':metadata.reason!=='AUTOMATIC'))fail('OWNER_SELECTION_REQUIRED');
        E=evidenceKey(metadata);stage='STAGING';await store.createStaging(metadata);cancelled();
        stage='RESUME_CHECK';const staged=await store.resume(E,{signal});committedOffset=Number(staged.committed_offset);if(staged.conflict)fail('CONFLICT');
        if(staged.phase==='STAGING'){
          for(let offset=Number(staged.committed_offset);offset<Number(metadata.physical_bytes);){
            cancelled();onProgress({state:'DOWNLOADING',offset,physical_bytes:Number(metadata.physical_bytes)});
            const end=Math.min(offset+TRANSPORT_RANGE_BYTES,Number(metadata.physical_bytes))-1;
            stage='RANGE';requestedOffset=offset;expectedBytes=end-offset+1;receivedBytes=null;const bytes=bytesOf(await source.readRange(metadata,offset,end,{signal,onProgress}));receivedBytes=bytes.length;cancelled();
            if(bytes.length!==expectedBytes)fail('RANGE_RESPONSE');
            // A complete, protocol-validated transport response may contain four
            // old-format chunks. Only a completed strict transaction advances
            // the durable offset; pause never commits the remaining response.
            for(let used=0;used<bytes.length;){
              cancelled();stage='COMMIT_RANGE';const chunk=bytes.subarray(used,used+RANGE_BYTES);
              await store.commitRange(E,String(offset),chunk);used+=chunk.length;offset+=chunk.length;committedOffset=offset;
              onProgress({state:'DOWNLOADING',offset,physical_bytes:Number(metadata.physical_bytes)});
            }
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
        const safe=transferError(e,{stage,requestedOffset,committedOffset,expectedBytes,receivedBytes:receivedBytes??e?.diagnostic?.receivedBytes,abortCause:e?.diagnostic?.abortCause??(signal?.aborted?signal.reason:undefined)});onProgress({state,code:signal?.aborted?'CANCELLED':safe.message,diagnostic:safe.diagnostic});throw safe;
      }
    }),
    removeKnownFixtures:()=>exclusive(async()=>{
      // Exact frozen synthetic identities plus full byte verification, not names.
      const hashes=new Set(['93e7956bc91945a4edae075b01f2fa3fa97f36cb1531d752c706b6f7dde93d5d','1258a8be2cb0201dbb8aa6bed4e2d78e31c574682f8172584177e5950b87646a','a665ab60cb630c78316cf0023f4165e2244ae06094f94ad65e6ba9118053fca9']);
      let removed=0,unverifiedRetained=0;
      for(const flight of await store.listFlights()){
        const m=flight.metadata,known=catalog.fixtures.find(f=>hashes.has(f.metadata.physical_sha256)&&
          ['source_device_id','session_id','physical_sha256','physical_bytes'].every(k=>String(f.metadata[k])===String(m[k])));
        if(!known)continue;
        const E=evidenceKey(m),d=await store.get('downloads',E);
        if(d?.phase!=='IMPORTED')continue; // Never remove unfinished transfers.
        try{const {raw}=await store.readEvidence(E);await validateEvidence(raw,known.metadata);}
        catch{unverifiedRetained++;continue;} // No deletion on uncertain evidence.
        await store.removeLocal(E);removed++;
      }
      return {removed,unverifiedRetained,scope:'EXACT_SYNTHETIC_IMPORTED_ONLY'};
    }),
    discardStaging:key=>exclusive(()=>store.discardStaging(key)),
    removeLocal:key=>exclusive(()=>store.removeLocal(key)),
    removeLocalMany:keys=>exclusive(()=>store.removeLocalMany(keys)),
    status:key=>exclusive(()=>store.reopen(key,{useReceipt:true})),
    verify:key=>exclusive(()=>store.reopen(key)),
    export:key=>exclusive(async()=>{
      const flight=await store.reopen(key,{useReceipt:true});
      return {streamKey:[...key],dbName:name,filename:flight.metadata.filename,sha256:flight.metadata.physical_sha256,physical_bytes:Number(flight.metadata.physical_bytes)};
    }),
    reimport:(key,input)=>exclusive(async()=>{
      await store.reopen(key);
      const pin=await store.pinEvidence(key),size=input?.size??bytesOf(input).length;checkTransferSize(size);
      if(size!==Number(pin.metadata.physical_bytes))fail('ROUND_TRIP_MISMATCH');
      const saved=store.orderedChunks(key,pin)[Symbol.asyncIterator]();
      async function* incoming(){
        try{for(let at=0;at<size;at+=RANGE_BYTES){
          const b=typeof input?.slice==='function'&&typeof input?.arrayBuffer==='function'?new Uint8Array(await input.slice(at,at+RANGE_BYTES).arrayBuffer()):bytesOf(input).subarray(at,at+RANGE_BYTES);
          const old=await saved.next();if(old.done||old.value.length!==b.length||b.some((v,i)=>v!==old.value[i]))fail('ROUND_TRIP_MISMATCH');yield b;
        }if(!(await saved.next()).done)fail('ROUND_TRIP_MISMATCH');}finally{await saved.return?.();}
      }
      await store.validateStream(incoming(),pin.metadata);return {byteIdentical:true,sha256:pin.metadata.physical_sha256};
    })
  });
}
export function selectExportRoute(navigator,file,canDownload=true) {
  try{if(typeof navigator?.share==='function'&&navigator.canShare?.({files:[file]})===true)return 'share';}catch{}
  if(canDownload)return 'download';
  fail('EXPORT_UNAVAILABLE');
}
export async function exportFile(payload,{navigator=globalThis.navigator,document=globalThis.document}={}) {
  if(!navigator?.serviceWorker?.controller||!Array.isArray(payload.streamKey))fail('STREAM_EXPORT_UNAVAILABLE');
  const channel=new MessageChannel();let timer;
  const prepared=new Promise((resolve,reject)=>{
    timer=setTimeout(()=>reject(Error('STREAM_EXPORT_TIMEOUT')),300000);
    channel.port1.onmessage=({data})=>data?.error?reject(Error(data.error)):resolve(data);
    navigator.serviceWorker.controller.postMessage({type:'HUGINN_STREAM_EXPORT',dbName:payload.dbName,key:payload.streamKey},[channel.port2]);
  });
  let data;try{data=await prepared;}finally{clearTimeout(timer);channel.port1.close();}
  if(typeof data?.url!=='string'||data.filename!==payload.filename||data.sha256!==payload.sha256)fail('STREAM_EXPORT_IDENTITY');
  const u=new URL(data.url,globalThis.location.href);if(u.origin!==globalThis.location.origin||!u.pathname.includes('/__flg_export/'))fail('STREAM_EXPORT_IDENTITY');
  const a=document.createElement('a');a.href=u.href;a.download=payload.filename;document.body.append(a);a.click();a.remove();
  return {route:'verified-stream-download',status:'BROWSER_HANDOFF_NOT_RECIPIENT_ACCEPTANCE'};
}
