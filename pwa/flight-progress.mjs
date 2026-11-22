// Bounded preparation protocol and progress-aware request clocks. No credentials.
import {TRANSPORT_RANGE_BYTES} from './flight-evidence.mjs';
import {MAX_PHYSICAL_BYTES} from './flight-size-policy.mjs';
export const FLIGHT_PROGRESS_TYPE='application/vnd.huginn.flight-progress+ndjson';
export const FLIGHT_PROGRESS_ACCEPT=FLIGHT_PROGRESS_TYPE+';version=1';
export const FLIGHT_WIRE_LIMIT=192*1024;
const fail=code=>{throw Error(code);};
export function createFlightDeadline(stop,{set=setTimeout,clear=clearTimeout,now=()=>performance.now()}={}){
 let idle,hard,phase='connection',disposed=false,fired=false,timeoutKind=null,timeoutMs=20000,idleDue=0,hardDue=null;
 const idleKind=()=>phase==='preparation'?'PREPARATION_IDLE':phase==='connection'?'FIRST_RESPONSE':'BODY_IDLE';
 const fire=(kind,ms)=>{if(disposed||fired)return;fired=true;clear(idle);clear(hard);timeoutKind=kind;timeoutMs=ms;stop('REQUEST_TIMEOUT');};
 const current=()=>{if(disposed||fired)return false;if(hardDue!==null&&now()>=hardDue){fire('PREPARATION_LIMIT',300000);return false;}if(now()>=idleDue){fire(idleKind(),20000);return false;}return true;};
 const arm=()=>{if(disposed||fired)return;clear(idle);idleDue=now()+20000;idle=set(()=>fire(idleKind(),20000),20000);};
 arm();
 return {get phase(){return phase;},get timeoutKind(){return timeoutKind;},get timeoutMs(){return timeoutMs;},
  headers(stream){if(!current())return;phase=stream?'preparation':'body';arm();if(stream){hardDue=now()+300000;hard=set(()=>fire('PREPARATION_LIMIT',300000),300000);}},
  bytes(n){if(!current())return;if(n>0&&phase==='body')arm();},
  progress(){if(phase==='preparation'&&current())arm();},
  transfer(){if(!current())return;phase='body';clear(hard);hardDue=null;arm();},
  dispose(){disposed=true;clear(idle);clear(hard);}
 };
}
const decimal=s=>typeof s==='string'&&/^(0|[1-9][0-9]*)$/.test(s);
const keys=(frame,expected)=>Object.keys(frame).sort().join(',')===expected.split(',').sort().join(',');
const stages=['snapshot_before','hash','snapshot_after'];
// Reject duplicate decoded object keys, including nested metadata and escaped
// spellings. JSON.parse validates grammar; this bounded walk preserves key evidence.
function parseFrame(text){
 let value;try{value=JSON.parse(text);}catch{fail('PROGRESS_PROTOCOL');}
 let at=0;
 const space=()=>{while(/\s/.test(text[at]||'x'))at++;};
 const string=()=>{const begin=at++;while(at<text.length){if(text[at]==='\\'){at+=2;continue;}if(text[at++]==='"')return JSON.parse(text.slice(begin,at));}fail('PROGRESS_PROTOCOL');};
 const visit=depth=>{
  if(depth>8)fail('PROGRESS_PROTOCOL');space();const char=text[at];
  if(char==='"'){string();return;}
  if(char==='{'||char==='['){
   at++;space();const end=char==='{'?'}':']',seen=new Set();if(text[at]===end){at++;return;}
   for(;;){space();if(char==='{'){if(text[at]!=='"')fail('PROGRESS_PROTOCOL');const key=string();if(seen.has(key))fail('PROGRESS_PROTOCOL');seen.add(key);space();if(text[at++]!==':')fail('PROGRESS_PROTOCOL');}visit(depth+1);space();if(text[at]===end){at++;return;}if(text[at++]!==',')fail('PROGRESS_PROTOCOL');}
  }
  const begin=at;while(at<text.length&&!/[\s,}\]]/.test(text[at]))at++;if(at===begin)fail('PROGRESS_PROTOCOL');
 };
 visit(0);space();if(at!==text.length)fail('PROGRESS_PROTOCOL');return value;
}
export function createFlightFrames({kind,prepared:expectPrepared=false,start=0,end=0,total:expectedTotal=null,onProgress=()=>{},deadline}){
 if(!['detail','range'].includes(kind)||kind==='range'&&(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||end<start||end-start>=TRANSPORT_RANGE_BYTES))fail('PROGRESS_PROTOCOL');
 let pending='',bytes=0,frames=0,stage=-1,completed=-1,total=null,terminal=false,metadata=null,etag=null,range=null,offset=0,payload=null,prepared=null;
 const decode=new TextDecoder('utf-8',{fatal:true});
 const accept=frame=>{
  if(!frame||typeof frame!=='object'||Array.isArray(frame)||terminal)fail('PROGRESS_PROTOCOL');
  if(++frames>1024)fail('PROGRESS_LIMIT');
  if(frame.event==='error'){
   if(!keys(frame,'event,code')||typeof frame.code!=='string'||!/^[A-Z][A-Z0-9_]{1,63}$/.test(frame.code))fail('PROGRESS_PROTOCOL');
   terminal=true;throw Object.assign(Error('FLIGHT_PREPARATION_FAILED'),{flightServerCode:frame.code});
  }
  if(frame.event==='progress'){
   if(range||metadata||!keys(frame,'event,stage,completed,total')||!Number.isSafeInteger(frame.completed)||!Number.isSafeInteger(frame.total)||frame.completed<0||frame.total<0||frame.total>MAX_PHYSICAL_BYTES)fail('PROGRESS_PROTOCOL');
   const next=stages.indexOf(frame.stage);if(next<0||next<stage||next>stage+1)fail('PROGRESS_PROTOCOL');
   if(next===0&&(frame.completed!==0||frame.total!==0))fail('PROGRESS_PROTOCOL');
   let advance=next>stage;
   if(next===1){if(frame.total<128||frame.completed>frame.total||(total!==null&&frame.total!==total)||(next===stage&&frame.completed<completed))fail('PROGRESS_PROTOCOL');total=frame.total;advance=advance||frame.completed>completed;completed=frame.completed;}
   if(next===2&&(total===null||completed!==total||frame.completed!==total||frame.total!==total))fail('PROGRESS_PROTOCOL');
   stage=next;if(advance){deadline?.progress();onProgress({state:'PREPARING',stage:frame.stage,completed:frame.completed,total:frame.total});}return;
  }
  if(frame.event==='metadata'){
   if(kind!=='detail'||stage!==2||!keys(frame,expectPrepared?'event,metadata,etag,prepared':'event,metadata,etag')||!frame.metadata||typeof frame.metadata!=='object'||typeof frame.etag!=='string'||String(total)!==frame.metadata.physical_bytes)fail('PROGRESS_PROTOCOL');
   if(expectPrepared&&(!/^[0-9a-f]{32}$/.test(frame.prepared)||typeof frame.prepared!=='string'))fail('PROGRESS_PROTOCOL');
   prepared=expectPrepared?frame.prepared:null;metadata=frame.metadata;etag=frame.etag;terminal=true;deadline?.transfer();return;
  }
  if(frame.event==='range'){
   if(kind!=='range'||stage!==2||range||!keys(frame,'event,start,end,total,etag')||![frame.start,frame.end,frame.total].every(decimal)||Number(frame.start)!==start||Number(frame.end)!==end||Number(frame.total)!==Number(expectedTotal)||Number(frame.total)!==total||typeof frame.etag!=='string')fail('PROGRESS_PROTOCOL');
   range=frame;etag=frame.etag;payload=new Uint8Array(end-start+1);deadline?.transfer();return;
  }
  if(frame.event==='data'){
   if(!range||!keys(frame,'event,offset,base64')||!decimal(frame.offset)||Number(frame.offset)!==offset||typeof frame.base64!=='string'||frame.base64.length>1024||!frame.base64.length||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(frame.base64))fail('PROGRESS_PROTOCOL');
   let text;try{text=atob(frame.base64);}catch{fail('PROGRESS_PROTOCOL');}if(!text.length||text.length>768||btoa(text)!==frame.base64||offset+text.length>payload.length)fail('PROGRESS_PROTOCOL');
   for(let n=0;n<text.length;n++)payload[offset+n]=text.charCodeAt(n);offset+=text.length;deadline?.bytes(text.length);onProgress({state:'RECEIVING',receivedBytes:offset,expectedBytes:payload.length});return;
  }
  if(frame.event==='complete'){
   if(!range||!keys(frame,'event,bytes')||!decimal(frame.bytes)||Number(frame.bytes)!==payload.length||offset!==payload.length)fail('PROGRESS_PROTOCOL');terminal=true;return;
  }
  fail('PROGRESS_PROTOCOL');
 };
 const lines=()=>{for(;;){const newline=pending.indexOf('\n');if(newline<0)break;const line=pending.slice(0,newline);pending=pending.slice(newline+1);if(!line.length||new TextEncoder().encode(line).length>2048)fail('PROGRESS_PROTOCOL');accept(parseFrame(line));}if(new TextEncoder().encode(pending).length>2048)fail('PROGRESS_PROTOCOL');};
 return {get receivedBytes(){return offset;},push(chunk){bytes+=chunk.length;if(bytes>FLIGHT_WIRE_LIMIT)fail('PROGRESS_LIMIT');try{pending+=decode.decode(chunk,{stream:true});}catch{fail('PROGRESS_PROTOCOL');}lines();},
  finish(){try{pending+=decode.decode();}catch{fail('PROGRESS_PROTOCOL');}lines();if(pending.length||!terminal)fail('PROGRESS_INCOMPLETE');return {value:kind==='detail'?metadata:payload,etag,range,prepared};}
 };
}
