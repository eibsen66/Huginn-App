import {FlightStorage,openCourierDatabase,evidenceKey,PRODUCTION_ORIGIN,qualificationMatches} from '/flight-storage.mjs';
import {sha256,metadataSha256,parseHfl,crc32} from '/flight-evidence.mjs';
const eq=(a,b)=>{if(JSON.stringify(a)!==JSON.stringify(b))throw new Error(`Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);};
const ok=(v,m='assertion failed')=>{if(!v)throw new Error(m);};
const rejects=async fn=>{let failed=false;try{await fn();}catch{failed=true;}ok(failed,'expected rejection');};
export async function run(){
 const results=[],vectors=(await (await fetch('/__test__/vectors.json')).json()).vectors;
 const environment={origin:PRODUCTION_ORIGIN,secure:true,platform:'Windows 11',browser:'Microsoft Edge',profile:'normal',browser_build:'synthetic.1',platform_version:'synthetic.11',architecture:'x86'};
 const manifest={schema:'huginn.flight-courier.compatibility',schema_version:1,qualified_builds:[{...environment}]};
 const storage={persisted:async()=>true,estimate:async()=>({quota:100000000,usage:0})};
 const rawOf=v=>Uint8Array.from(v.hfl_hex.match(/../g),s=>parseInt(s,16));
 let next=0;
 async function fresh(options={}){const name=`slice3b-synthetic-${Date.now()}-${next++}`;
  const db=await openCourierDatabase(indexedDB,name);return {name,s:new FlightStorage(db,{manifest,environment:async()=>environment,storage,...options})};}
 async function restart(s){const name=s.db.name;s.close();return new FlightStorage(await openCourierDatabase(indexedDB,name),{manifest,environment:async()=>environment,storage});}
 async function stage(s,v){const E=evidenceKey(v.metadata),raw=rawOf(v);await s.createStaging(v.metadata);
  for(let offset=0;offset<raw.length;offset+=16384)await s.commitRange(E,String(offset),raw.subarray(offset,offset+16384));return E;}
 async function imported(s,v){const E=await stage(s,v);await s.importEvidence(E);return E;}
 async function test(name,fn){try{await fn();results.push({name,pass:true});}catch(e){results.push({name,pass:false,error:String(e),stack:e.stack});}}
 const complete=vectors.find(v=>v.name==='complete');
 await test('schema version, stores, primary keys and indexes',async()=>{const {s}=await fresh();eq(s.db.version,1);eq([...s.db.objectStoreNames].sort(),['ack_outbox','chunks','clients','downloads','flights']);
  const tx=s.db.transaction(['downloads','chunks','flights']);eq(tx.objectStore('downloads').keyPath,null);eq(tx.objectStore('downloads').index('session').keyPath,'session');
  eq(tx.objectStore('chunks').index('evidence').keyPath,'evidence');s.close();});
 for(const v of vectors)await test(`import/reopen exact ${v.name}`,async()=>{let {s}=await fresh();const E=await imported(s,v);s=await restart(s);
  const f=await s.reopen(E);eq(f.metadata,v.metadata);eq(f.ack_status,'NONE');eq(f.local_state,'STORED_LOCAL_AWAITING_VERIFICATION');
  eq(Array.from((await s.readEvidence(E)).raw),Array.from(rawOf(v)));eq((await s.listFlights()).length,1);s.close();});
 await test('before staging, after staging and before chunk: no visible import',async()=>{let {s}=await fresh();eq((await s.listFlights()).length,0);
  const E=evidenceKey(complete.metadata);eq(await s.get('downloads',E),undefined);await s.createStaging(complete.metadata);s=await restart(s);
  eq((await s.resume(E)).committed_offset,'0');eq((await s.listFlights()).length,0);await rejects(()=>s.importEvidence(E));s.close();});
 await test('one committed range, mid-transfer resume and wrong range rejected',async()=>{
  const base=rawOf(complete),header=base.slice(0,128),records=[];
  for(let i=0;i<210;i++){const r=base.slice(128,288),d=new DataView(r.buffer);d.setUint32(0,i+1,true);r[4]=i===2?5:1;
    d.setBigUint64(8,BigInt(i)*100000n,true);d.setInt32(24,1700000,true);r[124]=1;d.setUint32(156,crc32(r.subarray(0,156)),true);records.push(r);}
  const raw=new Uint8Array(128+160*records.length);raw.set(header);records.forEach((r,i)=>raw.set(r,128+160*i));
  const p=parseHfl(raw),m={...complete.metadata,...Object.fromEntries(['start_utc','runtime_us','record_count','valid_bytes','state','complete','integrity','physical_bytes','hfl_version'].map(k=>[k,p[k]])),physical_sha256:await sha256(raw)};
  m.metadata_sha256=await metadataSha256(m);let {s}=await fresh();const E=evidenceKey(m);await s.createStaging(m);
  await rejects(()=>s.commitRange(E,'0',raw.subarray(0,100)));await s.commitRange(E,'0',raw.subarray(0,16384));s=await restart(s);
  eq((await s.resume(E)).committed_offset,'16384');eq((await s.listFlights()).length,0);await rejects(()=>s.commitRange(E,'0',raw.subarray(0,16384)));
  await s.commitRange(E,'16384',raw.subarray(16384,32768));await s.commitRange(E,'32768',raw.subarray(32768));await s.importEvidence(E);await s.reopen(E);s.close();
 });
 await test('duplicate E is deduplicated without raw overwrite',async()=>{const {s}=await fresh();const E=await imported(s,complete);await s.createStaging(complete.metadata);
  await s.importEvidence(E);eq((await s.listFlights()).length,1);await rejects(()=>s.commitRange(E,'0',rawOf(complete)));s.close();});
 await test('different E preserves both and gates new conflict',async()=>{const {s}=await fresh();await imported(s,complete);
  const v=vectors.find(v=>v.name==='incomplete'),E=await imported(s,v);eq((await s.listFlights()).length,2);
  eq((await s.get('flights',E)).conflict,true);const gate=await s.createAckPending(E);eq(gate.eligible,false);ok(gate.failed.includes('no_conflict'));
  eq(await s.get('ack_outbox',E),undefined);s.close();});
 await test('after import/no outbox and after reopen/no outbox restart',async()=>{let {s}=await fresh();const E=await imported(s,complete);s=await restart(s);
  eq(await s.get('ack_outbox',E),undefined);await s.reopen(E);s=await restart(s);eq(await s.get('ack_outbox',E),undefined);
  const result=await s.createAckPending(E);ok(result.gate.eligible);eq(result.record.status,'PENDING');s.close();});
 await test('pending restart, response lost, synthetic ACK-success restart',async()=>{let {s}=await fresh();const E=await imported(s,complete);await s.createAckPending(E);s=await restart(s);
  eq((await s.get('ack_outbox',E)).status,'PENDING'); // simulated remote success/response loss has no local side effect
  s=await restart(s);eq((await s.get('flights',E)).ack_status,'PENDING');await s.simulateAckSuccess(E);s=await restart(s);
  eq((await s.get('ack_outbox',E)).status,'ACKED');eq((await s.get('flights',E)).local_state,'ACKED_SYNTHETIC');s.close();});
 function fault(s,storeName,method='put',quota=false){const original=s.db.transaction.bind(s.db);
  s.db.transaction=(...args)=>{const tx=original(...args);if(args[1]==='readwrite'&&args[0].includes(storeName)){
    const objectStore=tx.objectStore.bind(tx);tx.objectStore=name=>{const os=objectStore(name);if(name===storeName){const fn=os[method].bind(os);
      os[method]=(...values)=>{if(quota)throw new DOMException('synthetic quota fault','QuotaExceededError');const r=fn(...values);r.addEventListener('success',()=>tx.abort());return r;};}return os;};}return tx;};
  return ()=>s.db.transaction=original;
 }
 await test('chunk transaction abort/quota leave offset and bytes atomic',async()=>{const {s}=await fresh();const E=evidenceKey(complete.metadata);await s.createStaging(complete.metadata);
  for(const quota of [false,true]){const restore=fault(s,'chunks','add',quota);await rejects(()=>s.commitRange(E,'0',rawOf(complete)));restore();
   eq((await s.get('downloads',E)).committed_offset,'0');eq((await s.readEvidence(E,{allowPartial:true})).raw.length,0);}s.close();});
 await test('import transaction abort leaves no visible flight',async()=>{const {s}=await fresh();const E=await stage(s,complete),restore=fault(s,'flights','add');
  await rejects(()=>s.importEvidence(E));restore();eq((await s.listFlights()).length,0);eq((await s.get('downloads',E)).phase,'STAGING');s.close();});
 await test('ACK-pending transaction abort rolls back both stores',async()=>{const {s}=await fresh();const E=await imported(s,complete),restore=fault(s,'ack_outbox','add');
  await rejects(()=>s.createAckPending(E));restore();eq(await s.get('ack_outbox',E),undefined);eq((await s.get('flights',E)).ack_status,'NONE');s.close();});
 await test('ACK-success transaction abort leaves pending state',async()=>{const {s}=await fresh();const E=await imported(s,complete);await s.createAckPending(E);
  const restore=fault(s,'ack_outbox');await rejects(()=>s.simulateAckSuccess(E));restore();eq((await s.get('ack_outbox',E)).status,'PENDING');
  eq((await s.get('flights',E)).ack_status,'PENDING');s.close();});
 await test('chunk corruption quarantines staging; imported bytes fail revalidation',async()=>{const {s}=await fresh();const E=await imported(s,complete);
  await s.transaction(['chunks'],'readwrite',async tx=>{const os=tx.objectStore('chunks'),r=os.get([...E,'0']);
   await new Promise((resolve,reject)=>{r.onsuccess=()=>{const c=r.result;new Uint8Array(c.bytes)[140]^=1;os.put(c,[...E,'0']);resolve();};r.onerror=reject;});});
  await rejects(()=>s.reopen(E));eq((await s.evaluateGate(E)).checks.reopened_validation,false);await rejects(()=>s.resume(E));
  eq((await s.get('downloads',E)).phase,'QUARANTINED');eq((await s.listFlights()).length,1);s.close();});
 await test('all twelve gate checks reported; individual environment/storage failures',async()=>{const {s}=await fresh();const E=await imported(s,complete);
  const good=await s.evaluateGate(E);ok(good.eligible);eq(Object.keys(good.checks).length,12);
  for(const patch of [{origin:'file://'},{secure:false},{browser_build:'unqualified'},{profile:'private'}]){
   s.environment=async()=>({...environment,...patch});eq((await s.createAckPending(E)).eligible,false);eq(await s.get('ack_outbox',E),undefined);}
  s.environment=async()=>environment;s.storage={...storage,persisted:async()=>false};eq((await s.evaluateGate(E)).checks.persistent_storage,false);
  s.storage={...storage,estimate:async()=>({quota:2097151,usage:0})};eq((await s.evaluateGate(E)).checks.sufficient_quota,false);
  s.storage=storage;const probe=s.strictProbe;s.strictProbe=async()=>{throw new Error('probe failure');};eq((await s.evaluateGate(E)).checks.strict_probe,false);s.strictProbe=probe;
  const original=s.db.transaction.bind(s.db);s.db.transaction=(...a)=>{if(a[1]==='readwrite')throw new Error('strict unavailable');return original(...a);};
  eq((await s.evaluateGate(E)).checks.strict_transactions,false);s.db.transaction=original;
  eq((await s.listFlights()).length,1);s.close();});
 await test('shipped qualification empty; actual development browser cannot ACK',async()=>{const {s}=await fresh({manifest:{schema:'huginn.flight-courier.compatibility',schema_version:1,qualified_builds:[]}});
  const E=await imported(s,complete);eq((await s.evaluateGate(E)).checks.qualified_build,false);s.close();
  const actual=await fresh({environment:async()=>({origin:location.origin,secure:isSecureContext})});const key=await imported(actual.s,complete);
  eq((await actual.s.evaluateGate(key)).eligible,false);actual.s.close();ok(!qualificationMatches(environment,{qualified_builds:[]}));});
 await test('concurrent same-offset ranges commit once',async()=>{const {s}=await fresh();const E=evidenceKey(complete.metadata);await s.createStaging(complete.metadata);
  const r=await Promise.allSettled([s.commitRange(E,'0',rawOf(complete)),s.commitRange(E,'0',rawOf(complete))]);
  eq(r.filter(x=>x.status==='fulfilled').length,1);eq((await s.resume(E)).committed_offset,complete.metadata.physical_bytes);s.close();});
 await test('actual import required and metadata tampering denied',async()=>{const {s}=await fresh();const E=await stage(s,complete);
  eq((await s.evaluateGate(E)).checks.actual_commit,false);eq((await s.listFlights()).length,0);await s.importEvidence(E);
  await s.transaction(['flights'],'readwrite',async tx=>{const os=tx.objectStore('flights'),r=os.get(E);await new Promise((resolve,reject)=>{
   r.onsuccess=()=>{const f=r.result;f.metadata.runtime_us='1';os.put(f,E);resolve();};r.onerror=reject;});});
  await rejects(()=>s.reopen(E));eq((await s.evaluateGate(E)).checks.reopened_validation,false);s.close();});
 await test('crypto and IndexedDB unavailable gate closed',async()=>{const {s}=await fresh();const E=await imported(s,complete),descriptor=Object.getOwnPropertyDescriptor(window,'crypto');
  try{Object.defineProperty(window,'crypto',{configurable:true,value:{}});eq((await s.evaluateGate(E)).checks.web_crypto,false);}
  finally{Object.defineProperty(window,'crypto',descriptor);}
  const missing=new FlightStorage(undefined,{manifest,environment:async()=>environment,storage});eq((await missing.evaluateGate(E)).checks.indexeddb_available,false);s.close();});
 await test('tampered staging metadata is rejected without import',async()=>{const {s}=await fresh();const v=structuredClone(complete);v.metadata.metadata_sha256='0'.repeat(64);
  await rejects(()=>s.createStaging(v.metadata));eq((await s.listFlights()).length,0);s.close();});
 await test('staging creation abort persists no download or import',async()=>{const {s}=await fresh(),E=evidenceKey(complete.metadata),restore=fault(s,'downloads','add');
  await rejects(()=>s.createStaging(complete.metadata));restore();eq(await s.get('downloads',E),undefined);eq((await s.listFlights()).length,0);s.close();});
 return {synthetic:true,origin:location.origin,results,passed:results.filter(r=>r.pass).length,failed:results.filter(r=>!r.pass).length};
}
