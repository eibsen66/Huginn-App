export function displayUtc(value,{seconds=false}={}){
 if(!/^-?\d+$/.test(String(value??''))||BigInt(value)<=0n)return 'Upptökutími óþekktur';
 const date=new Date(Number(value)*1000);if(!Number.isFinite(date.getTime()))return 'Upptökutími óþekktur';
 const z=n=>String(n).padStart(2,'0');return `${z(date.getUTCDate())}.${z(date.getUTCMonth()+1)}.${date.getUTCFullYear()} ${z(date.getUTCHours())}:${z(date.getUTCMinutes())}${seconds?':'+z(date.getUTCSeconds()):''} UTC`;
}
export function friendlySize(value){const n=Number(value);if(!Number.isSafeInteger(n)||n<0)return 'Stærð óþekkt';return n<1024?n+' bæti':n<1048576?(n/1024).toFixed(1)+' KiB':(n/1048576).toFixed(2)+' MiB';}
export function isKnownFixture(metadata,catalog){return catalog.fixtures.some(f=>['source_device_id','session_id','physical_sha256','metadata_sha256'].every(k=>f.metadata[k]===metadata[k]));}
export const connectionLabel=state=>({disconnected:'Ekki tengt við HuginnEIS',connecting:'Tengist HuginnEIS…',connected:'Tengt við HuginnEIS',uncertain:'Tenging óstaðfest eftir misheppnaða beiðni',lost:'Samband við HuginnEIS rofnaði'}[state]||'Ekki tengt við HuginnEIS');
export function transitionConnection(state,event){if(event==='authenticated')return 'connected';if(event==='attempt')return 'connecting';if(event==='request_uncertain')return 'uncertain';if(event==='failure'||event==='hidden')return ['connected','connecting','uncertain'].includes(state)?'lost':'disconnected';return 'disconnected';}
export function downloadFailureKind(d){
 if(d?.code==='AUTH_REQUIRED'||d?.httpStatus===401||d?.httpStatus===403)return 'AUTHORIZATION';
 if(d?.abortCause==='NETWORK_OFFLINE')return 'NETWORK_OFFLINE_SIGNAL';
 if(d?.abortCause==='REQUEST_TIMEOUT'||d?.code==='REQUEST_TIMEOUT')return 'TIMEOUT';
 if(d?.abortCause)return 'LIFECYCLE_OR_CANCEL';
 if(d?.httpStatus>=400)return 'HTTP_RESPONSE';
 if(['FETCH_OR_TYPE_ERROR','FETCH_REJECTED','RESPONSE_READ_FAILED'].includes(d?.code))return 'TRANSPORT_UNCONFIRMED';
 if(['COMMIT_RANGE','STAGING','REOPEN'].includes(d?.stage)||d?.code==='STORAGE_FULL')return 'LOCAL_STORAGE';
 return 'VALIDATION_OR_REQUEST';
}
export function safeCode(error){const s=String(error?.message??'');return /^[A-Z][A-Z0-9_]{0,63}$/.test(s)?s:'OPERATION_FAILED';}
export function userError(code){if(code==='QuotaExceededError'||code==='QUOTA_EXCEEDED')return 'Geymsla símans er full. Vistaðu afrit áður en þú losar pláss.';if(code==='BUSY')return 'Ljúktu núverandi aðgerð fyrst.';if(code==='FILE_SIZE_LIMIT')return 'Skráin er of stór fyrir þessa aðgerð.';if(code==='ROUND_TRIP_MISMATCH'||code.includes('CRC')||code.includes('VALIDATION')||code.includes('DIGEST')||code.includes('CHUNK'))return 'Skráin stenst ekki sannprófun.';if(code.startsWith('PAIR_'))return 'Ekki tókst að para við HuginnEIS. Reyndu að skanna aftur.';return 'Aðgerðin tókst ekki. Sjá nánar í tæknilegum upplýsingum.';}
export function recordingLabel(m){if(m.state==='CORRUPT'||m.eligible===false&&/CRC|CORRUPT|REJECT|INTEGRITY/.test(m.reason||''))return 'Skemmd skrá — stenst ekki sannprófun';return {COMPLETE:'Upptöku lokið',INCOMPLETE:'Lok upptöku óstaðfest',PROVISIONAL:'Óstaðfest upptaka'}[m.state]||'Skrá ekki tiltæk til niðurhals';}
