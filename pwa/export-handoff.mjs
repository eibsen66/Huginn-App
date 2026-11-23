import{StreamingSha256}from'./flight-stream.mjs';
import{MAX_PHYSICAL_BYTES}from'./flight-size-policy.mjs';
const aborted=signal=>{if(signal?.aborted)throw new DOMException('Export cancelled','AbortError');};
// Only same-client fetch may consume the private worker capability. Never
// navigate to it: a navigation can have no clientId and return a text error.
export async function prepareExportFile(payload,{navigator=globalThis.navigator,fetch=globalThis.fetch,signal,onProgress=()=>{},File=globalThis.File,location=globalThis.location}={}){
 const worker=navigator?.serviceWorker?.controller;
 if(!worker||!Array.isArray(payload.streamKey))throw Error('STREAM_EXPORT_UNAVAILABLE');
 if(!/^[a-z0-9_-]+\.flg$/i.test(payload.filename)||!Number.isSafeInteger(payload.physical_bytes)||payload.physical_bytes<=0||payload.physical_bytes>MAX_PHYSICAL_BYTES||!/^[a-f0-9]{64}$/.test(payload.sha256))throw Error('EXPORT_IDENTITY');
 aborted(signal);const channel=new MessageChannel(),requestId=crypto.randomUUID();let timer,reader,abortListener;
 const cancel=()=>worker.postMessage({type:'HUGINN_STREAM_EXPORT_CANCEL',requestId});
 const prepared=new Promise((resolve,reject)=>{
  const stop=()=>{cancel();reject(new DOMException('Export cancelled','AbortError'));};
  abortListener=stop;
  signal?.addEventListener('abort',stop,{once:true});
  timer=setTimeout(()=>{cancel();reject(Error('STREAM_EXPORT_TIMEOUT'));},300000);
  channel.port1.onmessage=({data})=>{signal?.removeEventListener('abort',stop);data?.error?reject(Error(data.error)):resolve(data);};
  worker.postMessage({type:'HUGINN_STREAM_EXPORT',requestId,dbName:payload.dbName,key:payload.streamKey},[channel.port2]);
 });
 try{
  const data=await prepared;aborted(signal);
  const u=new URL(data.url,location.href),base=new URL('./__flg_export/',location.href);
  if(u.origin!==location.origin||!u.pathname.startsWith(base.pathname)||data.filename!==payload.filename||data.sha256!==payload.sha256)throw Error('STREAM_EXPORT_IDENTITY');
  const response=await fetch(u.href,{cache:'no-store',signal});
  if(!response.ok)throw Error('EXPORT_HTTP_'+response.status);
  if(response.headers.get('content-type')?.split(';')[0]!=='application/octet-stream'||Number(response.headers.get('content-length'))!==payload.physical_bytes||response.headers.get('content-disposition')!=='attachment; filename="'+payload.filename+'"')throw Error('EXPORT_RESPONSE_IDENTITY');
  reader=response.body.getReader();const parts=[],sha=new StreamingSha256();let bytes=0;
  for(;;){aborted(signal);const r=await reader.read();if(r.done)break;bytes+=r.value.byteLength;if(bytes>payload.physical_bytes)throw Error('EXPORT_SIZE');sha.update(r.value);parts.push(r.value);onProgress({bytes,total:payload.physical_bytes});}
  aborted(signal);if(bytes!==payload.physical_bytes||sha.digest()!==payload.sha256)throw Error('EXPORT_SHA_OR_SIZE');
  const file=new File(parts,payload.filename,{type:'application/octet-stream'});parts.length=0;
  if(file.size!==payload.physical_bytes)throw Error('EXPORT_SIZE');
  return {file,filename:file.name,sha256:payload.sha256,physical_bytes:bytes};
 }catch(e){cancel();await reader?.cancel().catch(()=>{});throw e;}
 finally{clearTimeout(timer);signal?.removeEventListener('abort',abortListener);channel.port1.close();}
}
// Called synchronously from a SECOND explicit click: native file sharing needs
// current user activation, which asynchronous preparation cannot preserve.
export async function exportFile(prepared,{navigator=globalThis.navigator,document=globalThis.document,URL=globalThis.URL}={}){
 const file=prepared?.file;
 if(!file||file.name!==prepared.filename||file.type!=='application/octet-stream'||file.size!==prepared.physical_bytes)throw Error('EXPORT_NOT_PREPARED');
 if(typeof navigator?.share==='function'&&navigator.canShare?.({files:[file]})){
  // Share only the binary file. iOS recipients can turn title/text into an
  // additional text attachment; the File already carries its own filename.
  try{await navigator.share({files:[file]});return {route:'native-file-share',status:'HANDED_TO_SHARE_TARGET'};}
  catch(e){if(e.name==='AbortError')return {route:'native-file-share',status:'CANCELLED'};throw e;}
 }
 // A separate browsing context keeps the installed app's navigation/back path
 // intact if a browser previews rather than downloads an unknown extension.
 const url=URL.createObjectURL(file),a=document.createElement('a');a.href=url;a.download=file.name;a.target='_blank';a.rel='noopener';document.body.append(a);
 try{a.click();}finally{a.remove();setTimeout(()=>URL.revokeObjectURL(url),120000);}
 return {route:'binary-file-download',status:'BROWSER_HANDOFF_NOT_RECIPIENT_ACCEPTANCE'};
}
