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
    verify:key=>exclusive(async()=>{await reopenConnection();return store.reopen(key);}),
    export:key=>exclusive(async()=>{
      await store.reopen(key);
      const {raw,download}=await store.readEvidence(key);
      checkSize(raw.length);
      return {bytes:raw,filename:download.metadata.filename,sha256:download.metadata.physical_sha256};
    }),
    reimport:(key,bytes)=>exclusive(async()=>{
      checkSize(bytesOf(bytes).length);
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
  if(route==='share')await navigator.share({files:[file],title:'HuginnAPP synthetic evidence'});
  else{
    const href=url.createObjectURL(file),a=document.createElement('a');
    a.href=href;a.download=payload.filename;document.body.append(a);a.click();a.remove();
    setTimeout(()=>url.revokeObjectURL(href),60000);
  }
  return {route,status:'EXPORTED — NOT CLOUD CONFIRMED'};
}
