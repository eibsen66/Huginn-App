import {transferError,flightServerErrors} from './download-diagnostics.mjs';
import {verifyOutgoingSettings} from './settings.mjs';
import {verifyV2Request} from './settings-v2.mjs';
// Existing HFC GET list/detail/range contract plus whitelist-validated settings preview/apply.
// Credentials stay in this closure, never in IndexedDB, URLs or reports.
import {encodeMetadata,metadataSha256} from './flight-evidence.mjs';
export const DEV_BROWSER_OS_TLS_V1='DEV_BROWSER_OS_TLS_V1';
export const MAX_TRANSFER_BYTES=8*1024*1024;
const need=(ok,code)=>{if(!ok)throw Error(code);};
const settingsErrors=new Set(['AUTH_REQUIRED','OUT_OF_MEMORY','SETTINGS_BUSY_OR_UNAVAILABLE','INVALID_OR_STALE_PACKAGE','INVALID_SETTINGS_OR_PROTECTED_FIELD','PREVIEW_REQUIRED_OR_EXPIRED','SAVE_OR_READBACK_FAILED','READBACK_UNAVAILABLE','READBACK_RESPONSE_UNAVAILABLE','SAVE_UNCERTAIN_TIMEOUT']);
export const evidenceEtag=m=>'"hfl-sha256-'+m.physical_sha256+'-'+m.physical_bytes+'"';
export function checkTransferSize(n){need(Number.isSafeInteger(n)&&n>=128&&n<=MAX_TRANSFER_BYTES,'FILE_SIZE_LIMIT');}
export function parsePairing(text){
 need(typeof text==='string'&&text.length<=512,'PAIR_SIZE');
 const keys=[...text.matchAll(/"((?:[^"\\]|\\.)*)"\s*:/g)].map(m=>JSON.parse('"'+m[1]+'"'));
 need(new Set(keys).size===keys.length,'PAIR_DUPLICATE');let p;try{p=JSON.parse(text);}catch{throw Error('PAIR_JSON');}
 need(Object.keys(p).sort().join(' ')==='schema schema_version source_device_id tls_spki_sha256 token','PAIR_KEYS');
 need(p.schema==='huginn.flight-courier.pair'&&p.schema_version===1,'PAIR_SCHEMA');
 need(/^(?:[0-9A-F]{2}:){5}[0-9A-F]{2}$/.test(p.source_device_id),'PAIR_DEVICE');
 need(/^[0-9a-f]{64}$/.test(p.tls_spki_sha256),'PAIR_PIN');
 need(/^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/.test(p.token),'PAIR_TOKEN');return Object.freeze(p);
}
export function createBrowserSource({origin,selectedOrigin,profile,pairing,fetch:fetcher=globalThis.fetch,testLoopback=false}){
 need(profile===DEV_BROWSER_OS_TLS_V1||profile==='PIN_REQUIRED'||profile==='DEVELOPMENT'||profile==='PRODUCTION','TRUST_PROFILE');
 need(profile===DEV_BROWSER_OS_TLS_V1,'PWA_SPKI_TRUST_BLOCKED');
 const u=new URL(origin),bound=new URL(selectedOrigin);
 need(origin===selectedOrigin&&u.origin===bound.origin,'ORIGIN_BINDING');
 need(!u.username&&!u.password&&u.pathname==='/'&&!u.search&&!u.hash,'SOURCE_ORIGIN');
 need(u.protocol==='https:'||(testLoopback&&u.protocol==='http:'&&u.hostname==='127.0.0.1'),'HTTPS_REQUIRED');
 need(u.origin==='https://192.168.4.1'||(testLoopback&&u.protocol==='http:'&&u.hostname==='127.0.0.1'),'DEV_ORIGIN');
 const parsed=parsePairing(pairing),pair={source_device_id:parsed.source_device_id};let token=parsed.token,revoked=false,closed=false,lastSettingsDiagnostic=null,lastRequestDiagnostic=null,generation=0;const active=new Set();
 async function request(path,{signal,headers={},limit=49152,json=true,stage='DETAIL',requestedOffset=null,method='GET',body}={}){
  const settingsRequest=path==='/api/v1/config'||/^\/api\/v(?:1\/settings-transfer|2\/settings)(?:\/|$)/.test(path);
  need(!closed&&!revoked,'AUTH_REQUIRED');
  need(method==='GET'&&(/^\/api\/v1\/flights(?:\?limit=8(?:&cursor=[A-Za-z0-9_-]{38})?|\/[0-9a-f]{32}(?:\/evidence)?)$/.test(path)||path==='/api/v1/config'||path==='/api/v2/settings')||method==='POST'&&/^\/api\/(?:v1\/settings-transfer|v2\/settings)\/(preview|apply)$/.test(path),'READ_ONLY_ROUTE');
  let status=null,count=0,declaredBytes=null,dispatchAttempted=false,phase='fetch',flightListError=false,errorBodyStatus,serverErrorCode;const timeout=new AbortController(),timer=setTimeout(()=>timeout.abort(),20000),abort=()=>timeout.abort();
  const requestGeneration=generation;
  const wait=async promise=>{let cancel;const aborted=new Promise((_,reject)=>{cancel=()=>reject(Object.assign(Error('CANCELLED'),{name:'AbortError'}));timeout.signal.addEventListener('abort',cancel,{once:true});if(timeout.signal.aborted)cancel();});try{return await Promise.race([promise,aborted]);}finally{timeout.signal.removeEventListener('abort',cancel);}};
  active.add(timeout);signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
  try{
   dispatchAttempted=true;const r=await wait(fetcher(u.origin+path,{method,body,headers:{Authorization:'Bearer '+token,...headers},signal:timeout.signal,redirect:'error',credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer'}));
   phase='response';status=r.status;flightListError=!r.ok&&r.status!==401&&r.status!==403&&method==='GET'&&/^\/api\/v1\/flights\?/.test(path);need(!closed&&!revoked&&requestGeneration===generation&&!timeout.signal.aborted,'AUTH_REQUIRED');
   need(!r.redirected&&(!r.url||new URL(r.url).origin===u.origin),'REDIRECT_REJECTED');
   if(r.status===401||r.status===403){revoked=true;token='';throw Error('AUTH_REQUIRED');}
   if(!settingsRequest&&!flightListError)need(r.ok,r.status===409?'SOURCE_CHANGED':'HTTP_'+r.status);
   if(flightListError)limit=Math.min(limit,4096);
   phase='headers';const declared=r.headers.get('content-length');if(declared!==null){need(/^(0|[1-9][0-9]*)$/.test(declared),'RESPONSE_LENGTH');declaredBytes=Number(declared);need(Number.isSafeInteger(declaredBytes)&&declaredBytes<=limit,'RESPONSE_LENGTH');}
   need(r.body?.getReader,'STREAM_REQUIRED');const reader=r.body.getReader(),chunks=[];
   phase='body';try{for(;;){const {value,done}=await wait(reader.read());if(done)break;count+=value.length;need(count<=limit,'RESPONSE_LENGTH');chunks.push(value);}}finally{reader.cancel().catch(()=>{});}
   if(declared!==null)need(count===Number(declared),'RESPONSE_LENGTH');const bytes=new Uint8Array(count);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
   need(!closed&&!revoked&&requestGeneration===generation&&!timeout.signal.aborted,'AUTH_REQUIRED');
   if(flightListError){
    const failure=()=>Error(r.status===409?'SOURCE_CHANGED':'HTTP_'+r.status);
    if(!bytes.length){errorBodyStatus='empty';throw failure();}
    phase='decode';let text;
    try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{errorBodyStatus='invalid_utf8';throw failure();}
    phase='json';let value;
    try{value=JSON.parse(text);}catch{errorBodyStatus='invalid_json';throw failure();}
    const keys=value&&typeof value==='object'&&!Array.isArray(value)?Object.keys(value):[];
    // Never retain arbitrary body fields. Reject ambiguous duplicate error keys.
    const errorKeys=[...text.matchAll(/"((?:[^"\\]|\\.)*)"\s*:/g)].filter(m=>{try{return JSON.parse('"'+m[1]+'"')==='error';}catch{return false;}});
    if(!keys.includes('error')||typeof value.error!=='string'||errorKeys.length!==1||('ok' in value&&value.ok!==false))errorBodyStatus='invalid_schema';
    else if(flightServerErrors.has(value.error)){errorBodyStatus='recognized';serverErrorCode=value.error;}
    else errorBodyStatus='unknown';
    throw failure();
   }
   if(!r.ok){let error;try{error=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{}throw Error(error?.ok===false&&settingsErrors.has(error.error)?error.error:'HTTP_'+r.status);}
   let value=bytes;if(json){phase='decode';const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);phase='json';value=JSON.parse(text);}
   lastRequestDiagnostic={phase:'complete',method,endpoint:settingsRequest?'settings':'flight',httpStatus:status,declaredBytes,receivedBytes:count,dispatchAttempted};if(settingsRequest)lastSettingsDiagnostic=lastRequestDiagnostic;
   return {response:r,value};
  }catch(e){const interrupted=timeout.signal.aborted;timeout.abort();let failure=e;
   if((settingsRequest||flightListError)&&e.name==='TypeError'){const code=phase==='fetch'?'FETCH_REJECTED':phase==='body'?'RESPONSE_READ_FAILED':phase==='decode'?'INVALID_RESPONSE_ENCODING':'RESPONSE_PROCESSING_FAILED';failure=Object.assign(Error(code),{name:e.name});}
   if(settingsRequest&&phase==='json'&&e.name==='SyntaxError')failure=Object.assign(Error('INVALID_RESPONSE_JSON'),{name:e.name});
   if(flightListError&&!errorBodyStatus)errorBodyStatus=closed||revoked||requestGeneration!==generation?'stale':interrupted?'interrupted':count>limit||declaredBytes>limit?'too_large':'unreadable';
   const safe=transferError(interrupted?Object.assign(new Error('CANCELLED'),{name:'AbortError'}):failure,{stage,phase,method,endpoint:settingsRequest?'settings':'flight',dispatchAttempted,httpStatus:status,declaredBytes,requestedOffset,expectedBytes:json?declaredBytes:limit,receivedBytes:count,errorBodyStatus,serverErrorCode});
   if(!flightListError||(!closed&&requestGeneration===generation))lastRequestDiagnostic=safe.diagnostic;if(settingsRequest)lastSettingsDiagnostic=safe.diagnostic;throw safe;
  }finally{active.delete(timeout);clearTimeout(timer);signal?.removeEventListener('abort',abort);}
 }
 function identity(m){need(m?.schema==='huginn.flight-courier.metadata'&&m.schema_version===1&&m.source_device_id===pair.source_device_id,'SOURCE_IDENTITY');need(Number.isInteger(m.manifest_generation)&&m.manifest_generation>=0&&m.manifest_generation<=0xffffffff,'GENERATION');}
 return Object.freeze({
  sourceDeviceId:pair.source_device_id,
  profile,boundOrigin:u.origin,
  trust:'Browser certificate-chain/hostname trust; pairing SPKI is NOT observable through Fetch; physical transport qualification pending',
  hasAuthorization:()=>!closed&&!revoked&&token.length>0,
  settingsDiagnostic:()=>lastSettingsDiagnostic?{...lastSettingsDiagnostic}:null,
  requestDiagnostic:()=>lastRequestDiagnostic?{...lastRequestDiagnostic}:null,
  async settings(){return (await request('/api/v1/config')).value;},
  async settingsV2(){return (await request('/api/v2/settings',{limit:131072,stage:'SETTINGS'})).value;},
  async settingsTransferV2(action,bytes){
   need(['preview','apply'].includes(action),'SETTINGS_ACTION');const r=await verifyV2Request(bytes);need(r.source_device_id===pair.source_device_id,'SETTINGS_DEVICE');
   return (await request('/api/v2/settings/'+action,{method:'POST',body:bytes,limit:131072,headers:{'Content-Type':'application/json'},stage:'SETTINGS'})).value;
  },
  async settingsTransfer(action,bytes){
   need(['preview','apply'].includes(action)&&bytes instanceof Uint8Array&&bytes.length<=4096,'SETTINGS_REQUEST');
   await verifyOutgoingSettings(bytes);
   return (await request('/api/v1/settings-transfer/'+action,{method:'POST',body:bytes,headers:{'Content-Type':'application/json'},stage:'SETTINGS'})).value;
  },
  pause(){generation++;for(const controller of active)controller.abort();},
  close(){generation++;closed=true;token='';for(const controller of active)controller.abort();active.clear();},
  async list({signal}={}){
   const entries=[],seen=new Set();let cursor=null,generation;
   do{
    const {value:v}=await request('/api/v1/flights?limit=8'+(cursor===null?'':'&cursor='+cursor),{signal});
    need(v.schema==='huginn.flight-courier.list'&&v.schema_version===1&&v.source_device_id===pair.source_device_id&&v.capacity===64&&Number.isInteger(v.count)&&v.count>=0&&v.count<=64&&Array.isArray(v.entries)&&v.entries.length<=8,'LIST_IDENTITY');
    if(generation===undefined)generation=v.manifest_generation;need(v.manifest_generation===generation,'SOURCE_CHANGED');
    for(const m of v.entries){identity(m);need(m.manifest_generation===generation,'SOURCE_CHANGED');const id=m.session_id??m.filename;need(!seen.has(id),'DUPLICATE_LIST_ENTRY');seen.add(id);entries.push(m);}
    need(entries.length<=v.count&&entries.length<=64,'PAGE_LIMIT');cursor=v.next_cursor;
    need(cursor===null||(typeof cursor==='string'&&/^[A-Za-z0-9_-]{38}$/.test(cursor)&&!seen.has('cursor:'+cursor)&&v.entries.length>0),'CURSOR');if(cursor)seen.add('cursor:'+cursor);
    if(cursor===null)need(entries.length===v.count,'LIST_COUNT');
   }while(cursor!==null);return entries;
  },
  async detail(id,{signal}={}){
   need(/^[0-9a-f]{32}$/.test(id),'SESSION');const {value:m,response}=await request('/api/v1/flights/'+id,{signal});try{identity(m);need(m.session_id===id,'SESSION');
   encodeMetadata(m);checkTransferSize(Number(m.physical_bytes));need(await metadataSha256(m)===m.metadata_sha256,'METADATA_DIGEST_MISMATCH');need(response.headers.get('etag')===evidenceEtag(m),'ETAG');return Object.freeze(m);}catch(e){throw transferError(e,{stage:'DETAIL',httpStatus:response.status,dispatchAttempted:true});}
  },
  async readRange(m,start,end,{signal}={}){
   need(Number.isSafeInteger(start)&&Number.isSafeInteger(end)&&start>=0&&end>=start&&end-start<16384&&end<Number(m.physical_bytes),'RANGE');
   const {value:bytes,response:r}=await request('/api/v1/flights/'+m.session_id+'/evidence',{signal,json:false,stage:'RANGE',requestedOffset:start,limit:end-start+1,headers:{Range:'bytes='+start+'-'+end,'If-Match':evidenceEtag(m)}});
   try{need(r.status===206&&r.headers.get('etag')===evidenceEtag(m)&&r.headers.get('accept-ranges')==='bytes'&&r.headers.get('content-range')===`bytes ${start}-${end}/${m.physical_bytes}`&&r.headers.get('content-length')===String(end-start+1)&&bytes.length===end-start+1,'RANGE_RESPONSE');return bytes;}catch(e){throw transferError(e,{stage:'RANGE',httpStatus:r.status,dispatchAttempted:true,requestedOffset:start,expectedBytes:end-start+1,receivedBytes:bytes.length});}
  }
 });
}
