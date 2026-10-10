// Executed inside a fresh desktop browser profile, against loopback static assets.
export async function runBrowserTests(){
  const {openPwa,identifyFixture,MAX_FILE_BYTES,requireFeatures}=await import('./adapter.mjs');
  const {evidenceKey}=await import('./flight-storage.mjs');
  const {sha256}=await import('./flight-evidence.mjs');
  const catalog=await (await fetch('./fixtures/catalog.json')).json(),results=[];
  const assert=(condition,message='assertion failed')=>{if(!condition)throw new Error(message);};
  const rejects=async(work,code)=>{try{await work();}catch(e){if(code)assert(e.message.includes(code),e.message);return;}throw new Error('expected rejection');};
  const test=async(name,work)=>{try{await work();results.push({name,pass:true});}catch(e){results.push({name,pass:false,error:e.message,stack:e.stack});}};
  const bytes=async f=>new Uint8Array(await (await fetch('./fixtures/'+f.file)).arrayBuffer());
  let sequence=0;
  const fresh=async()=>{const name='p1-test-'+Date.now()+'-'+sequence++;return {name,app:await openPwa({catalog,name})};};
  const dbOpen=name=>new Promise((resolve,reject)=>{const r=indexedDB.open(name);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
  const cleanup=async(app,name)=>{app.close();await new Promise((resolve,reject)=>{const r=indexedDB.deleteDatabase(name);r.onsuccess=resolve;r.onerror=()=>reject(r.error);});};
  for(const f of catalog.fixtures)await test('strict import/reopen/export/reimport '+f.label,async()=>{
    const {app,name}=await fresh();
    try{
      const raw=await bytes(f),imported=await app.import(raw);
      assert(imported.status==='VERIFIED LOCAL');assert(app.fullAckGatePass===false);assert((await app.list()).length===1);
      const db=await dbOpen(name);assert(!db.objectStoreNames.contains('ack_outbox'),'ACK outbox exists');db.close();
      await app.verify(imported.key);
      const exported=await app.export(imported.key);assert(exported.bytes.length===raw.length);assert(exported.bytes.every((v,i)=>v===raw[i]));
      assert(await sha256(exported.bytes)===f.metadata.physical_sha256);
      assert((await app.reimport(imported.key,exported.bytes)).byteIdentical);
      await app.import(raw);assert((await app.list()).length===1,'duplicate created');
      raw[140]^=1;await rejects(()=>app.reimport(imported.key,raw),'IDENTITY_MISMATCH');
    }finally{await cleanup(app,name);}
  });
  await test('unknown/corrupt fixture rejected before storage',async()=>{
    const {app,name}=await fresh();
    try{const raw=await bytes(catalog.fixtures[0]);raw[140]^=1;await rejects(()=>app.import(raw),'SYNTHETIC_FIXTURE_NOT_RECOGNIZED');assert((await app.list()).length===0);}
    finally{await cleanup(app,name);}
  });
  await test('exact ceiling hash/CRC parser and size+1 rejection',async()=>{
    const raw=await bytes(catalog.fixtures.at(-1));assert(raw.length<=MAX_FILE_BYTES&&raw.length>MAX_FILE_BYTES-160);
    const padded=new Uint8Array(MAX_FILE_BYTES+1);padded.set(raw);await rejects(()=>identifyFixture(padded,catalog),'FILE_SIZE_LIMIT');
    const header=new Uint8Array(128);await rejects(()=>identifyFixture(header,catalog),'SYNTHETIC_FIXTURE_NOT_RECOGNIZED');
  });
  await test('aborted chunk+offset transaction is invisible; resume only committed bytes',async()=>{
    const {app,name}=await fresh(),f=catalog.fixtures.at(-1),raw=await bytes(f),key=evidenceKey(f.metadata);
    const original=IDBObjectStore.prototype.put;let interrupted=false;
    try{
      IDBObjectStore.prototype.put=function(...args){
        if(this.name==='downloads'&&!interrupted){interrupted=true;throw new Error('INJECTED_INTERRUPTION');}
        return original.apply(this,args);
      };
      await rejects(()=>app.import(raw),'INJECTED_INTERRUPTION');
      IDBObjectStore.prototype.put=original;
      let db=await dbOpen(name),tx=db.transaction(['chunks','downloads']);
      const count=await new Promise(r=>{const q=tx.objectStore('chunks').count();q.onsuccess=()=>r(q.result);});assert(count===0,'uncommitted chunk survived');
      tx=db.transaction('downloads');const staged=await new Promise(r=>{const q=tx.objectStore('downloads').get(key);q.onsuccess=()=>r(q.result);});
      assert(staged.committed_offset==='0');db.close();assert((await app.list()).length===0);
      const imported=await app.import(raw);assert((await app.reimport(imported.key,raw)).byteIdentical);
    }finally{IDBObjectStore.prototype.put=original;await cleanup(app,name);}
  });
  await test('restart after one committed range resumes synthetic input',async()=>{
    const {FlightStorage}=await import('./flight-storage.mjs');
    const {app,name}=await fresh(),f=catalog.fixtures.at(-1),raw=await bytes(f),key=evidenceKey(f.metadata);
    try{
      const db=await dbOpen(name),s=new FlightStorage(db);
      await s.createStaging(f.metadata);await s.commitRange(key,'0',raw.subarray(0,16384));s.close();app.close();
      const restarted=await openPwa({catalog,name});
      try{const imported=await restarted.import(raw);assert((await restarted.reimport(imported.key,raw)).byteIdentical);}
      finally{restarted.close();}
    }finally{await cleanup(app,name);}
  });
  await test('unsupported strict durability fails closed',async()=>{
    const original=IDBDatabase.prototype.transaction;let called=false;
    IDBDatabase.prototype.transaction=function(...args){
      const tx=original.apply(this,args);
      if(args[1]==='readwrite'){called=true;Object.defineProperty(tx,'durability',{value:'relaxed'});}
      return tx;
    };
    try{await rejects(()=>openPwa({catalog,name:'p1-unsupported-'+Date.now()}),'STRICT_UNAVAILABLE');assert(called);}
    finally{IDBDatabase.prototype.transaction=original;}
  });
  await test('insecure/missing features fail closed',async()=>{
    for(const env of [{},{isSecureContext:true},{isSecureContext:true,crypto:{subtle:{}}}])await rejects(()=>requireFeatures(env));
  });
  await test('import publication abort leaves only staged evidence and is recoverable',async()=>{
    const {app,name}=await fresh(),raw=await bytes(catalog.fixtures[0]);
    const original=IDBObjectStore.prototype.add;
    try{
      IDBObjectStore.prototype.add=function(...args){if(this.name==='flights')throw new Error('IMPORT_INTERRUPTED');return original.apply(this,args);};
      await rejects(()=>app.import(raw),'IMPORT_INTERRUPTED');IDBObjectStore.prototype.add=original;
      assert((await app.list()).length===0,'aborted import visible');
      const imported=await app.import(raw);assert((await app.reimport(imported.key,raw)).byteIdentical);
    }finally{IDBObjectStore.prototype.add=original;await cleanup(app,name);}
  });
  await test('corrupt saved chunk cannot regain VERIFIED LOCAL or export',async()=>{
    const {app,name}=await fresh(),raw=await bytes(catalog.fixtures[0]);
    try{
      const imported=await app.import(raw),db=await dbOpen(name),tx=db.transaction('chunks','readwrite',{durability:'strict'});
      const done=new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);});
      const store=tx.objectStore('chunks'),r=store.get([...imported.key,'0']);
      r.onsuccess=()=>{const c=r.result;new Uint8Array(c.bytes)[140]^=1;store.put(c,[...imported.key,'0']);};
      await done;db.close();
      await rejects(()=>app.verify(imported.key),'CHUNK_REVALIDATION_FAILED');
      await rejects(()=>app.export(imported.key),'CHUNK_REVALIDATION_FAILED');
    }finally{await cleanup(app,name);}
  });
  return {results,passed:results.filter(r=>r.pass).length,failed:results.filter(r=>!r.pass).length};
}
