// Runs only on the P2 loopback origin and fresh Edge profile.
export async function runRecovery(catalog,inputs,caseName,phase){
 const {openPwa}=await import('./adapter.mjs');
 const {plan}=await import('./recovery-storage.mjs');
 const {evidenceKey}=await import('./flight-storage.mjs');
 const {sha256}=await import('./flight-evidence.mjs');
 if(location.hostname!=='127.0.0.1')throw Error('LOOPBACK_REQUIRED');
 const name='huginn-p2-'+caseName;
 const raw=inputs.map(v=>Uint8Array.from(v)), key=evidenceKey(catalog.fixtures[2].metadata);
 const assert=(v,m)=>{if(!v)throw Error(m);};
 const req=r=>new Promise((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
 const snapshot=async()=>{
   const db=await req(indexedDB.open(name)),tx=db.transaction(['downloads','chunks','flights']);
   const result=await Promise.all([req(tx.objectStore('downloads').get(key)),req(tx.objectStore('chunks').index('evidence').getAll(key)),req(tx.objectStore('flights').get(key))]);
   db.close();return result;
 };
 const controls=async app=>{
  for(let i=0;i<2;i++){
   const k=evidenceKey(catalog.fixtures[i].metadata);await app.verify(k);
   const out=await app.export(k);
   assert(out.bytes.length===raw[i].length&&out.bytes.every((b,n)=>b===raw[i][n]),'CONTROL_CHANGED');
  }
 };
 const app=await openPwa({catalog,name});
 if(phase==='interrupt'){
   for(let i=0;i<2;i++)await app.import(raw[i]);
   const db=await req(indexedDB.open(name));
   const controlRows=await req(db.transaction('flights').objectStore('flights').getAll());db.close();
   const modes={A:'before',B:1,C:8,D:'publication',E:'abort',G:1,P:'publishAbort'};
   Object.assign(plan,{mode:modes[caseName],count:0,writes:[],enabled:true});
   let rejected=false;
   try{await app.import(raw[2]);}catch(e){rejected=true;
     if(!['E','P'].includes(caseName))assert(e.message==='P2_INTERRUPT','WRONG_FAILURE '+e.message);
   }finally{plan.enabled=false;}
   assert(rejected,'INTERRUPTION_DID_NOT_HAPPEN');
   const [d,chunks,flight]=await snapshot();
   const expected={A:0,B:16384,C:131072,D:1048576,E:0,G:16384,P:1048576}[caseName];
   assert(d.committed_offset===String(expected),'OFFSET_ATOMICITY');
   assert(chunks.length===expected/16384,'CHUNK_ATOMICITY');
   assert(!flight&&(await app.list()).length===2,'PARTIAL_PUBLISHED');
   await controls(app);
   if(caseName==='G'){
     // Deliberate corruption only in this fresh disposable database.
     const db=await req(indexedDB.open(name)),tx=db.transaction('chunks','readwrite',{durability:'strict'});
     const done=new Promise((r,j)=>{tx.oncomplete=r;tx.onabort=()=>j(tx.error);});
     const s=tx.objectStore('chunks'),c=await req(s.get([...key,'0']));
     new Uint8Array(c.bytes)[140]^=1;await req(s.put(c,[...key,'0']));await done;db.close();
   }
   app.close();return {case:caseName,phase,offset:expected,controlRows};
 }
 await controls(app);
 Object.assign(plan,{mode:null,count:0,writes:[],enabled:true});
 if(caseName==='G'){
   let rejected=false;try{await app.import(raw[2]);}catch(e){rejected=e.message==='CHUNK_REVALIDATION_FAILED';}
   assert(rejected,'INVALID_STAGING_ACCEPTED');
   const [d,,flight]=await snapshot();assert(d.phase==='QUARANTINED'&&!flight,'QUARANTINE_FAILED');
   let denied=false;try{await app.export(key);}catch{denied=true;}assert(denied,'INVALID_EXPORT');
 }else{
   const before=await snapshot(),offset=Number(before[0].committed_offset);
   const imported=await app.import(raw[2]);
   assert(imported.status==='VERIFIED LOCAL','NO_VERIFIED_RESULT');
   assert(plan.writes.length===(1048576-offset)/16384,'COMMITTED_RANGES_REWRITTEN');
   assert(plan.writes.every((v,i)=>Number(v)===offset+i*16384),'BAD_RESUME_OFFSET');
   const out=await app.export(key);
   assert(out.bytes.length===raw[2].length&&out.bytes.every((b,i)=>b===raw[2][i]),'EXPORT_CHANGED');
   assert(await sha256(out.bytes)===catalog.fixtures[2].metadata.physical_sha256,'HASH_CHANGED');
   assert((await app.reimport(key,out.bytes)).byteIdentical,'ROUND_TRIP_FAILED');
   assert((await app.list()).length===3,'PUBLICATION_COUNT');
 }
 plan.enabled=false;await controls(app);
 const db=await req(indexedDB.open(name));
 const rows=await req(db.transaction('flights').objectStore('flights').getAll());db.close();
 app.close();return {case:caseName,phase,pass:true,controlRows:rows.slice(0,2),writes:plan.writes};
}
