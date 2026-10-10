export async function setup(catalog,inputs,name){
 if(location.hostname!=='127.0.0.1'||!name.startsWith('huginn-p2-'))throw Error('ISOLATION_REQUIRED');
 const {openPwa}=await import('./adapter.mjs');
 globalThis.testCatalog=catalog;globalThis.testInputs=inputs.map(v=>Uint8Array.from(v));globalThis.testName=name;
 globalThis.testApp=await openPwa({catalog,name});
 return true;
}
export async function verifyAll(){
 const {evidenceKey}=await import('./flight-storage.mjs');
 const {sha256}=await import('./flight-evidence.mjs');
 const app=globalThis.testApp,rows=await app.list();
 for(const row of rows){
  const i=testCatalog.fixtures.findIndex(f=>f.metadata.metadata_sha256===row.metadata.metadata_sha256);
  if(i<0)throw Error('UNEXPECTED_ROW');
  const key=evidenceKey(row.metadata),out=await app.export(key),raw=testInputs[i];
  if(out.bytes.length!==raw.length||!out.bytes.every((b,n)=>b===raw[n]))throw Error('BYTES_CHANGED');
  if(await sha256(out.bytes)!==row.metadata.physical_sha256)throw Error('HASH_CHANGED');
  if(!(await app.reimport(key,out.bytes)).byteIdentical)throw Error('ROUND_TRIP');
 }
 return rows;
}
export async function quotaCase(mode){
 const {storagePlan}=await import('./storage-faults.mjs');
 const {evidenceKey}=await import('./flight-storage.mjs');
 const req=r=>new Promise((rsv,rej)=>{r.onsuccess=()=>rsv(r.result);r.onerror=()=>rej(r.error);});
 await testApp.import(testInputs[0]);await testApp.import(testInputs[1]);
 const controls=await verifyAll();
 Object.assign(storagePlan,{quota:mode,writes:0});
 let error;try{await testApp.import(testInputs[2]);}catch(e){error=e.name;}
 if(error!=='QuotaExceededError')throw Error('QUOTA_NOT_EXERCISED '+error);
 const db=await req(indexedDB.open(testName)),tx=db.transaction(['downloads','chunks','flights']),key=evidenceKey(testCatalog.fixtures[2].metadata);
 const d=await req(tx.objectStore('downloads').get(key));
 const chunks=await req(tx.objectStore('chunks').index('evidence').getAll(key));db.close();
 const expected=mode===0?0:mode===4?65536:1048576;
 if(d.committed_offset!==String(expected)||chunks.length!==expected/16384)throw Error('ROLLBACK');
 if(JSON.stringify(await verifyAll())!==JSON.stringify(controls))throw Error('CONTROL_CHANGED');
 storagePlan.quota=null;storagePlan.writes=0;
 testApp.close();const {openPwa}=await import('./adapter.mjs');testApp=await openPwa({catalog:testCatalog,name:testName});
 await testApp.import(testInputs[2]);
 const rows=await verifyAll();if(rows.length!==3)throw Error('PUBLICATION_COUNT');
 if(storagePlan.writes!==(1048576-expected)/16384)throw Error('BAD_RESUME');
 return {mode,pass:true,offset:expected,resumedWrites:storagePlan.writes};
}
