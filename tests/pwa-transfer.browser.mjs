// Runs actual Fetch source + PWA adapter + strict IndexedDB in an isolated browser.
export async function runTransferTests(){
 const {openPwa,exportFile}=await import('./adapter.mjs'),{createBrowserSource,checkTransferSize,MAX_TRANSFER_BYTES}=await import('./source.mjs'),{evidenceKey}=await import('./flight-storage.mjs');
 const catalog=await (await fetch('./fixtures/catalog.json')).json(),results=[];
 const assert=(ok,why='assertion')=>{if(!ok)throw Error(why);};
 const rejects=async fn=>{let e;try{await fn();}catch(x){e=x;}assert(e,'expected rejection');return e;};
 let serial=0;
 const pairing=JSON.stringify({schema:'huginn.flight-courier.pair',schema_version:1,source_device_id:'02:00:00:00:00:A1',tls_spki_sha256:'0'.repeat(64),token:'AQ'.repeat(21)+'A'});
 const source=()=>createBrowserSource({origin:globalThis.testSourceOrigin,selectedOrigin:globalThis.testSourceOrigin,profile:'DEV_BROWSER_OS_TLS_V1',pairing,testLoopback:true});
 const setup=async(kind='complete',fault='none')=>(await (await fetch('/__control?kind='+kind+'&fault='+fault)).json());
 const test=async(name,fn)=>{try{await fn();results.push({name,pass:true});}catch(e){results.push({name,pass:false,error:e.message,stack:e.stack});}};
 async function fresh(fn){const name='huginn-noack-transfer-'+Date.now()+'-'+serial++;let app=await openPwa({catalog,name});try{await fn({get app(){return app;},restart:async()=>{app.close();app=await openPwa({catalog,name});}});}finally{app.close();await new Promise((resolve,reject)=>{const r=indexedDB.deleteDatabase(name);r.onsuccess=resolve;r.onerror=()=>reject(r.error);});}}
 for(const kind of ['complete','incomplete','torn','provisional','ceiling','sd700','sd900','hourly','retained'])await test('exact original '+kind,()=>fresh(async ctx=>{
  const m=await setup(kind),src=source(),listed=await src.list();assert(listed.length===(kind==='retained'?16:1));if(kind==='retained')assert(listed.findIndex(e=>e.filename==='F578CE0.FLG')>=8,'selected file must be reached through page 2');const states=[];
  const result=await ctx.app.download(src,m.session_id,{ownerSelected:kind==='provisional',onProgress:p=>states.push(p.state)});
  assert(result.status==='VERIFIED LOCAL');assert(result.replayEligible===(kind!=='provisional'));
  assert(states.at(-1)==='VERIFIED LOCAL'&&states.includes('VALIDATING'));
  const out=await ctx.app.export(result.key),expected=new Uint8Array(await (await fetch('/__original')).arrayBuffer());
  assert(out.bytes.length===expected.length&&out.bytes.every((b,i)=>b===expected[i]),'exact byte mismatch');
  if(kind==='sd700'||kind==='retained'){let binary='';for(let i=0;i<out.bytes.length;i+=8192)binary+=String.fromCharCode(...out.bytes.subarray(i,i+8192));if(kind==='sd700')globalThis.savedSD700Export=btoa(binary);else globalThis.savedRetainedExport=btoa(binary);}

  await ctx.app.download(src,m.session_id,{ownerSelected:kind==='provisional'});assert((await ctx.app.list()).length===1,'duplicate');
  assert((await ctx.app.reimport(result.key,out.bytes)).byteIdentical,'large exact reimport');
  await ctx.restart();src.close();const reopened=await ctx.app.export(result.key);assert(reopened.bytes.every((b,i)=>b===expected[i]),'offline reopen');
 }));
 for(const fault of ['interrupt','network','auth','revoked','changed','range','length','hash','corrupt','identity'])await test('reject '+fault,()=>fresh(async ctx=>{
  const m=await setup('sd900',fault),states=[];await rejects(()=>ctx.app.download(source(),m.session_id,{onProgress:p=>states.push(p.state)}));
  assert((await ctx.app.list()).length===0,'failure published evidence');assert(!states.includes('VERIFIED LOCAL'));
 }));
 await test('interrupted committed-prefix safe retry after app restart',()=>fresh(async ctx=>{
  const m=await setup('sd900','interrupt');await rejects(()=>ctx.app.download(source(),m.session_id));await ctx.restart();assert((await ctx.app.incomplete()).some(d=>d.last_result==='INCOMPLETE DOWNLOAD'),'missing persisted incomplete state');
  await fetch('/__fault-off');const r=await ctx.app.download(source(),m.session_id);assert(r.status==='VERIFIED LOCAL');
  const log=await (await fetch('/__calls')).json();assert(log.some(x=>x.range?.startsWith('bytes=16384-')),'resume missing');
 }));
 await test('cancellation remains incomplete; safe retry',()=>fresh(async ctx=>{
  const m=await setup('sd900'),controller=new AbortController();await rejects(()=>ctx.app.download(source(),m.session_id,{signal:controller.signal,onProgress:p=>{if(p.offset>=16384)controller.abort();}}));
  assert((await ctx.app.list()).length===0);assert((await ctx.app.download(source(),m.session_id)).status==='VERIFIED LOCAL');
 }));
 await test('publication cancellation under validation cannot create verified row',()=>fresh(async ctx=>{
  const m=await setup(),controller=new AbortController();await rejects(()=>ctx.app.download(source(),m.session_id,{signal:controller.signal,onProgress:p=>{if(p.state==='VALIDATING')controller.abort();}}));assert((await ctx.app.list()).length===0);
 }));
 await test('cancel during publication transaction rolls back verified row',()=>fresh(async ctx=>{
  const m=await setup(),controller=new AbortController(),add=IDBObjectStore.prototype.add;
  try{IDBObjectStore.prototype.add=function(...args){const result=add.apply(this,args);if(this.name==='flights')queueMicrotask(()=>controller.abort());return result;};await rejects(()=>ctx.app.download(source(),m.session_id,{signal:controller.signal}));}
  finally{IDBObjectStore.prototype.add=add;}assert((await ctx.app.list()).length===0);assert((await ctx.app.incomplete()).some(d=>d.last_result==='INCOMPLETE DOWNLOAD'));
 }));
 await test('provisional requires explicit selection',()=>fresh(async ctx=>{const m=await setup('provisional');await rejects(()=>ctx.app.download(source(),m.session_id));assert((await ctx.app.list()).length===0);}));
 await test('conflicting identity preserves verified original',()=>fresh(async ctx=>{
  const m=await setup('complete'),r=await ctx.app.download(source(),m.session_id),before=await ctx.app.export(r.key);
  const other=await setup('incomplete');await rejects(()=>ctx.app.download(source(),other.session_id));const after=await ctx.app.export(r.key);
  assert(after.bytes.every((b,i)=>b===before.bytes[i])&&(await ctx.app.list()).length===1);assert((await ctx.app.incomplete()).some(d=>d.conflict),'conflicting identity missing');
 }));
 await test('storage quota failure cannot publish; retry keeps bytes',()=>fresh(async ctx=>{
  const m=await setup('sd900'),put=IDBObjectStore.prototype.put;
  try{IDBObjectStore.prototype.put=function(v,...args){if(this.name==='downloads'&&v.committed_offset!=='0')throw new DOMException('Injected quota','QuotaExceededError');return put.call(this,v,...args);};await rejects(()=>ctx.app.download(source(),m.session_id));}
  finally{IDBObjectStore.prototype.put=put;}
  assert((await ctx.app.list()).length===0);assert((await ctx.app.download(source(),m.session_id)).status==='VERIFIED LOCAL');
 }));
 await test('8MiB resource ceiling and no production pin bypass',async()=>{
  checkTransferSize(MAX_TRANSFER_BYTES);await rejects(async()=>checkTransferSize(MAX_TRANSFER_BYTES+1));
  let calls=0;await rejects(async()=>createBrowserSource({origin:'https://192.168.4.1',selectedOrigin:'https://192.168.4.1',profile:'PIN_REQUIRED',pairing,fetch:async()=>{calls++;throw Error('must not fetch');}}));assert(calls===0);
 });
 const calls=await (await fetch('/__all-calls')).json();await test('all transport requests GET; no ACK completion deletion ever',async()=>{assert(calls.length>0&&calls.every(x=>x.method==='GET'&&!/ack|delete|complete/i.test(x.path)));});
 return results;
}
