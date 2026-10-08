// Local storage authority only: no fetch, pairing, or ACK transport.
import { bytesOf, sha256, metadataSha256, encodeMetadata, validateEvidence, RANGE_BYTES } from './flight-evidence.mjs';
export const DB_NAME='huginn-flight-courier-v1', DB_VERSION=1;
export const PRODUCTION_ORIGIN='http://127.0.0.1:8767';
export const STORES=Object.freeze(['downloads','chunks','flights','ack_outbox','clients']);
const fail=code=>{throw new Error(code);};
const clone=value=>structuredClone(value);
export const sessionKey=m=>[m.source_device_id,m.session_id];
export const evidenceKey=m=>[...sessionKey(m),m.metadata_sha256];
const req=r=>new Promise((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
function completion(tx) { return new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error??new Error('TRANSACTION_ABORTED'));tx.onerror=()=>{};}); }
export async function openCourierDatabase(indexedDB=globalThis.indexedDB,name=DB_NAME) {
  if (!indexedDB) fail('INDEXEDDB_UNAVAILABLE');
  const r=indexedDB.open(name,DB_VERSION);
  r.onupgradeneeded=()=>{
    const db=r.result;
    for (const name of STORES) {
      const store=db.createObjectStore(name);
      if (['downloads','flights'].includes(name)) store.createIndex('session','session',{unique:false});
      if (name==='chunks') store.createIndex('evidence','evidence',{unique:false});
    }
  };
  const db=await req(r);db.onversionchange=()=>db.close();return db;
}
export function qualificationMatches(environment,manifest) {
  return manifest?.schema==='huginn.flight-courier.compatibility' && manifest.schema_version===1 &&
    Array.isArray(manifest.qualified_builds) && manifest.qualified_builds.some(q=>
      q.platform==='Windows 11' && q.browser==='Microsoft Edge' && q.profile==='normal' &&
      environment.platform===q.platform && environment.browser===q.browser && environment.profile===q.profile &&
      environment.browser_build===q.browser_build && environment.platform_version===q.platform_version &&
      environment.architecture===q.architecture);
}
export function gateResult(checks) {
  return {eligible:Object.values(checks).every(Boolean),checks,failed:Object.keys(checks).filter(k=>!checks[k])};
}
export async function browserEnvironment({normalProfileConfirmed=false}={}) {
  const ua=globalThis.navigator?.userAgentData;
  if (!ua?.getHighEntropyValues) return {};
  const h=await ua.getHighEntropyValues(['fullVersionList','platformVersion','architecture']);
  const edge=h.fullVersionList?.find(b=>b.brand==='Microsoft Edge');
  return {origin:globalThis.location?.origin,secure:globalThis.isSecureContext===true,
    platform:h.platform==='Windows'&&Number(h.platformVersion.split('.')[0])>=13?'Windows 11':h.platform,
    platform_version:h.platformVersion,browser:edge?'Microsoft Edge':null,browser_build:edge?.version,
    architecture:h.architecture,profile:normalProfileConfirmed?'normal':'unverified'};
}
export class FlightStorage {
  constructor(db,{manifest={schema:'huginn.flight-courier.compatibility',schema_version:1,qualified_builds:[]},
    environment=browserEnvironment,storage=globalThis.navigator?.storage}={}) {
    this.db=db;this.manifest=manifest;this.environment=environment;this.storage=storage;
  }
  close(){this.db.close();}
  async transaction(names,mode,work) {
    const tx=this.db.transaction(names,mode,mode==='readwrite'?{durability:'strict'}:undefined);
    const done=completion(tx);done.catch(()=>{});
    if(mode==='readwrite'&&tx.durability!=='strict'){tx.abort();await done.catch(()=>{});fail('STRICT_UNAVAILABLE');}
    try {const result=await work(tx);await done;return result;}
    catch(e){try{tx.abort();}catch{}await done.catch(()=>{});throw e;}
  }
  async get(store,key){return this.transaction([store],'readonly',tx=>req(tx.objectStore(store).get(key)));}
  async listFlights(){return this.transaction(['flights'],'readonly',tx=>req(tx.objectStore('flights').getAll()));}
  async createStaging(metadata) {
    const m=clone(metadata);encodeMetadata(m);
    if(typeof m.source_device_id!=='string'||m.source_device_id.length!==17||!/^(?:[0-9A-F]{2}:){5}[0-9A-F]{2}$/.test(m.source_device_id))fail('INVALID_SOURCE_DEVICE');
    if(await metadataSha256(m)!==m.metadata_sha256)fail('METADATA_DIGEST_MISMATCH');
    const E=evidenceKey(m), S=sessionKey(m);
    return this.transaction(['downloads','flights'],'readwrite',async tx=>{
      const ds=tx.objectStore('downloads'), fs=tx.objectStore('flights');
      const existing=await req(ds.get(E));
      if(existing){if(await req(fs.get(E)))return {deduplicated:true,...existing};return existing;}
      const staged=await req(ds.index('session').getAll(S)), imported=await req(fs.index('session').getAll(S));
      const conflicts=[...staged,...imported].some(r=>r.metadata.metadata_sha256!==m.metadata_sha256);
      const record={session:S,metadata:m,phase:'STAGING',committed_offset:'0',conflict:conflicts,owner_accepted:false};
      await req(ds.add(record,E));return record;
    });
  }
  async commitRange(E,start,value) {
    const bytes=bytesOf(value).slice(), chunk_sha256=await sha256(bytes);
    if(typeof start!=='string'||!/^(0|[1-9][0-9]*)$/.test(start))fail('INVALID_OFFSET');
    return this.transaction(['downloads','chunks'],'readwrite',async tx=>{
      const ds=tx.objectStore('downloads'), cs=tx.objectStore('chunks'), d=await req(ds.get(E));
      if(!d||d.phase!=='STAGING'||d.committed_offset!==start)fail('NONCONTIGUOUS_RANGE');
      const remaining=BigInt(d.metadata.physical_bytes)-BigInt(start);
      const expected=Number(remaining>BigInt(RANGE_BYTES)?BigInt(RANGE_BYTES):remaining);
      if(expected<=0||bytes.length!==expected)fail('INVALID_RANGE_LENGTH');
      const chunk={evidence:E,start_offset:start,length:bytes.length,chunk_sha256,bytes:bytes.buffer};
      await req(cs.add(chunk,[...E,start]));d.committed_offset=(BigInt(start)+BigInt(bytes.length)).toString();
      await req(ds.put(d,E));return d;
    });
  }
  async readEvidence(E,{allowPartial=false}={}) {
    const snapshot=await this.transaction(['downloads','chunks'],'readonly',async tx=>{
      const d=await req(tx.objectStore('downloads').get(E));
      const chunks=await req(tx.objectStore('chunks').index('evidence').getAll(E));return {d,chunks};
    });
    const {d,chunks}=snapshot;if(!d)fail('DOWNLOAD_NOT_FOUND');
    const committed=BigInt(d.committed_offset);
    if(!allowPartial&&committed!==BigInt(d.metadata.physical_bytes))fail('DOWNLOAD_INCOMPLETE');
    if(committed>BigInt(Number.MAX_SAFE_INTEGER))fail('EVIDENCE_TOO_LARGE');
    chunks.sort((a,b)=>BigInt(a.start_offset)<BigInt(b.start_offset)?-1:1);
    const raw=new Uint8Array(Number(committed));let offset=0;
    for(const c of chunks){
      const b=bytesOf(c.bytes);
      if(c.start_offset!==String(offset)||c.length!==b.length||offset+b.length>raw.length||
        b.length!==Math.min(RANGE_BYTES,Number(BigInt(d.metadata.physical_bytes)-BigInt(offset)))||
        await sha256(b)!==c.chunk_sha256)fail('CHUNK_REVALIDATION_FAILED');
      raw.set(b,offset);offset+=b.length;
    }
    if(offset!==raw.length)fail('CHUNK_REVALIDATION_FAILED');return {raw,download:d};
  }
  async resume(E) {
    try{return (await this.readEvidence(E,{allowPartial:true})).download;}
    catch(e){await this.transaction(['downloads'],'readwrite',async tx=>{const s=tx.objectStore('downloads'),d=await req(s.get(E));
      if(d){d.phase='QUARANTINED';await req(s.put(d,E));}});throw e;}
  }
  async importEvidence(E) {
    const {raw,download}=await this.readEvidence(E), validated=await validateEvidence(raw,download.metadata);
    return this.transaction(['downloads','flights'],'readwrite',async tx=>{
      const ds=tx.objectStore('downloads'),fs=tx.objectStore('flights'),current=await req(ds.get(E));
      if(!current||current.phase==='QUARANTINED'||current.committed_offset!==download.committed_offset)fail('STAGING_CHANGED');
      const existing=await req(fs.get(E));if(existing)return existing;
      const flight={session:sessionKey(current.metadata),metadata:current.metadata,validation:validated.parsed,
        local_state:'STORED_LOCAL_AWAITING_VERIFICATION',ack_status:'NONE',conflict:current.conflict,owner_accepted:false};
      await req(fs.add(flight,E));current.phase='IMPORTED';await req(ds.put(current,E));return flight;
    });
  }
  async reopen(E){const f=await this.get('flights',E);if(!f)fail('FLIGHT_NOT_IMPORTED');
    const {raw}=await this.readEvidence(E);await validateEvidence(raw,f.metadata);return f;}
  async strictProbe(){
    const key='__strict_probe__',bytes=crypto.getRandomValues(new Uint8Array(32));
    await this.transaction(['clients'],'readwrite',tx=>req(tx.objectStore('clients').put({probe:bytes.buffer},key)));
    const saved=await this.get('clients',key);if(await sha256(saved?.probe)!==await sha256(bytes))fail('PROBE_FAILED');
    return true;
  }
  async evaluateGate(E) {
    const checks={production_origin:false,secure_context:false,qualified_build:false,indexeddb_available:!!this.db,
      web_crypto:!!globalThis.crypto?.subtle,persistent_storage:false,strict_transactions:false,strict_probe:false,
      sufficient_quota:false,actual_commit:false,reopened_validation:false,no_conflict:false};
    let env={};try{env=await this.environment();}catch{}
    checks.production_origin=env.origin===PRODUCTION_ORIGIN;checks.secure_context=env.secure===true;
    checks.qualified_build=qualificationMatches(env,this.manifest);
    try{checks.persistent_storage=await this.storage.persisted()===true;}catch{}
    try {const tx=this.db.transaction(['clients'],'readwrite',{durability:'strict'}), done=completion(tx);
      checks.strict_transactions=tx.durability==='strict';await done;}catch{}
    if(checks.strict_transactions)try{checks.strict_probe=await this.strictProbe();}catch{}
    const d=await this.get('downloads',E).catch(()=>null),f=await this.get('flights',E).catch(()=>null);
    try{const estimate=await this.storage.estimate(),remaining=d?BigInt(d.metadata.physical_bytes)-BigInt(d.committed_offset):0n;
      checks.sufficient_quota=Number.isSafeInteger(estimate.quota)&&Number.isSafeInteger(estimate.usage)&&
        BigInt(estimate.quota)-BigInt(estimate.usage)>=remaining+2097152n;}catch{}
    checks.actual_commit=!!f&&d?.phase==='IMPORTED';
    if(checks.actual_commit)try{await this.reopen(E);checks.reopened_validation=true;}catch{}
    checks.no_conflict=!!f&&(!f.conflict||f.owner_accepted===true);
    return gateResult(checks);
  }
  async createAckPending(E) {
    const gate=await this.evaluateGate(E);if(!gate.eligible)return gate;
    return this.transaction(['flights','ack_outbox'],'readwrite',async tx=>{
      const fs=tx.objectStore('flights'),os=tx.objectStore('ack_outbox'),f=await req(fs.get(E));
      if(!f||f.conflict&&!f.owner_accepted)fail('CONFLICT');
      const old=await req(os.get(E));if(old)return {gate,record:old};
      const m=f.metadata,record={status:'PENDING',attempts:0,last_error:null,ack:{schema:'huginn.flight-courier.ack',
        schema_version:1,session_id:m.session_id,physical_sha256:m.physical_sha256,
        physical_bytes:m.physical_bytes,metadata_sha256:m.metadata_sha256}};
      await req(os.add(record,E));f.ack_status='PENDING';f.local_state='ACK_PENDING';await req(fs.put(f,E));
      return {gate,record};
    });
  }
  // Synthetic transition only, not evidence of a device ACK. No network call exists.
  async simulateAckSuccess(E) {
    await this.reopen(E);
    return this.transaction(['flights','ack_outbox'],'readwrite',async tx=>{
      const fs=tx.objectStore('flights'),os=tx.objectStore('ack_outbox'),f=await req(fs.get(E)),o=await req(os.get(E));
      if(!f||!o)fail('ACK_NOT_PENDING');o.status='ACKED';o.synthetic=true;f.ack_status='ACKED';f.local_state='ACKED_SYNTHETIC';
      await req(os.put(o,E));await req(fs.put(f,E));return f;
    });
  }
}
