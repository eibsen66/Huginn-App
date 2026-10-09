// Production orchestration consumes metadata only. Security, bytes and durability
// remain native. No URL, QR, token, ACK identity or raw range bridge operation.
export const COURIER_OPERATIONS=Object.freeze(['courierConnection','courierList','courierDetail','courierDownload','courierRetryAcks','courierCancel']);
const fail=c=>{throw new Error(c);};
const object=o=>o!==null&&typeof o==='object'&&!Array.isArray(o);
function privacy(value,depth=0){if(depth>8)fail('BRIDGE_DEPTH');if(ArrayBuffer.isView(value)||value instanceof ArrayBuffer)fail('BRIDGE_RAW_BYTES');if(Array.isArray(value)){if(value.length>64)fail('BRIDGE_ARRAY_LIMIT');for(const v of value)privacy(v,depth+1);}else if(object(value)){for(const [k,v] of Object.entries(value)){if(/token|authorization|bytes_base64|secret|private_key|raw_evidence/i.test(k))fail('BRIDGE_PRIVACY');privacy(v,depth+1);}}}
export function automaticSelection(m){return object(m)&&m.eligible===true&&m.reason==='AUTOMATIC'&&['COMPLETE','INCOMPLETE'].includes(m.state)&&m.complete===(m.state==='COMPLETE')&&typeof m.session_id==='string'&&/^[0-9a-f]{32}$/.test(m.session_id);}
export function createFlightCourier(native){let syncing=false,cancelEpoch=0;const invoke=async(op,options)=>{if(!native||typeof native[op]!=='function')fail('NATIVE_COURIER_UNAVAILABLE');const result=await native[op](Object.freeze({...options}));privacy(result);if(JSON.stringify(result).length>65536)fail('BRIDGE_RESPONSE_LIMIT');return result;};
  const paired=ref=>{if(typeof ref!=='string'||!/^paired-[0-9a-f]{32}$/.test(ref))fail('PAIRED_REF');return {paired_ref:ref};};
  const session=id=>{if(typeof id!=='string'||!/^[0-9a-f]{32}$/.test(id))fail('SESSION');return id;};
  return Object.freeze({
    subscribeProgress(callback){if(typeof callback!=='function'||!native||typeof native.addListener!=='function')fail('NATIVE_COURIER_UNAVAILABLE');return native.addListener('courierProgress',status=>{privacy(status);if(!object(status)||JSON.stringify(status).length>2048)fail('BRIDGE_PROGRESS_LIMIT');callback(Object.freeze({...status}));});},
    connectionStatus(ref){return invoke('courierConnection',paired(ref));},
    listFlights(ref){return invoke('courierList',paired(ref));},
    getFlightDetail(ref,id){return invoke('courierDetail',{...paired(ref),session_id:session(id)});},
    downloadEvidence(ref,id){return invoke('courierDownload',{...paired(ref),session_id:session(id)});},
    resumeEvidence(ref,id){return invoke('courierDownload',{...paired(ref),session_id:session(id)});},
    retryPendingAcks(ref){return invoke('courierRetryAcks',paired(ref));},
    cancelForegroundTransfer(){cancelEpoch++;return invoke('courierCancel',{});},
    async sync(ref,onStatus=()=>{}){if(syncing)fail('SYNC_BUSY');syncing=true;const epoch=cancelEpoch;try{const connection=await invoke('courierConnection',paired(ref));if(connection.state==='REPAIR_REQUIRED')return connection;const snapshot=await invoke('courierList',paired(ref));if(!Array.isArray(snapshot.entries)||snapshot.entries.length>64)fail('ENUMERATION_RESPONSE');const results=[];for(const m of snapshot.entries){if(epoch!==cancelEpoch)break;if(!automaticSelection(m))continue;const result=await invoke('courierDownload',{...paired(ref),session_id:session(m.session_id)});results.push(result);onStatus(Object.freeze({...result}));}if(epoch===cancelEpoch&&connection.FULL_ACK_GATE_PASS===true)await invoke('courierRetryAcks',paired(ref));return {state:epoch===cancelEpoch?'FOREGROUND_SYNC_COMPLETE':'CANCELLED',results};}finally{syncing=false;}}
  });
}
