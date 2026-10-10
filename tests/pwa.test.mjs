import test from 'node:test';import assert from 'node:assert/strict';
import {readFile,mkdtemp,mkdir,writeFile} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {startServer} from '../scripts/pwa-serve.mjs';
import {identifyFixture,checkSize,MAX_FILE_BYTES,selectExportRoute,exportFile,FULL_ACK_GATE_PASS} from '../dist/pwa/adapter.mjs';
const root=new URL('../',import.meta.url),catalog=JSON.parse(await readFile(new URL('pwa/fixtures/catalog.json',root)));
test('synthetic fixtures use original bytes and canonical validation',async()=>{
  for(const f of catalog.fixtures){const raw=await readFile(new URL('pwa/fixtures/'+f.file,root));const result=await identifyFixture(raw,catalog);
    assert.equal(result.metadata.physical_sha256,createHash('sha256').update(raw).digest('hex'));assert.deepEqual(Buffer.from(result.raw),raw);}
});
test('ceiling, unsupported export routes and false ACK gate',()=>{
  assert.equal(FULL_ACK_GATE_PASS,false);checkSize(MAX_FILE_BYTES);assert.throws(()=>checkSize(MAX_FILE_BYTES+1),/FILE_SIZE_LIMIT/);
  assert.equal(selectExportRoute({share(){},canShare:()=>true},{}),'share');assert.equal(selectExportRoute({share(){},canShare:()=>false},{}),'download');
  assert.equal(selectExportRoute({canShare(){throw Error();}},{}),'download');assert.throws(()=>selectExportRoute({}, {},false),/EXPORT_UNAVAILABLE/);
});
test('CRC corruption is rejected even if catalog hash is changed to match',async()=>{
  const raw=Buffer.from(await readFile(new URL('pwa/fixtures/complete.FLG',root)));raw[124]^=1;
  const f=structuredClone(catalog.fixtures[0]);f.metadata.physical_sha256=createHash('sha256').update(raw).digest('hex');
  await assert.rejects(()=>identifyFixture(raw,{fixtures:[f]}),/BAD_HEADER_CRC/);
});
test('Web Share cancellation does not report exported; download preserves bytes',async()=>{
  const bytes=new Uint8Array([1,2,3]),payload={bytes,filename:'F123ABC.FLG'};
  let shared;
  const result=await exportFile(payload,{navigator:{canShare:()=>true,share:async v=>{shared=v;}},File});
  assert.equal(result.status,'EXPORTED — NOT CLOUD CONFIRMED');assert.deepEqual(new Uint8Array(await shared.files[0].arrayBuffer()),bytes);
  await assert.rejects(()=>exportFile(payload,{navigator:{canShare:()=>true,share:async()=>{throw new Error('USER_CANCELLED');}},File}),/USER_CANCELLED/);
  let clicked=false,saved,revoked=false;
  const original=globalThis.setTimeout;globalThis.setTimeout=fn=>{fn();return 0;};
  try{
    const downloaded=await exportFile(payload,{navigator:{},File,url:{createObjectURL:file=>{saved=file;return 'blob:test';},revokeObjectURL:()=>revoked=true},document:{body:{append(){}},createElement:()=>({click(){clicked=true;},remove(){}})}});
    assert.equal(downloaded.route,'download');assert.ok(clicked&&revoked);assert.deepEqual(new Uint8Array(await saved.arrayBuffer()),bytes);
  }finally{globalThis.setTimeout=original;}
});
test('static server fails closed without supplied TLS and has no proxy/device routes',async()=>{
  await assert.rejects(()=>startServer(),/OWNER_SUPPLIED/);
  await assert.rejects(()=>startServer({testHttp:true,host:'0.0.0.0'}),/LOOPBACK/);
  const server=await startServer({testHttp:true,port:0});const origin='http://127.0.0.1:'+server.address().port;
  try{
    const response=await fetch(origin+'/');assert.equal(response.status,200);assert.match(response.headers.get('content-security-policy'),/connect-src 'self'/);
    assert.equal((await fetch(origin+'/api/v1/flights')).status,404);
    assert.equal((await fetch(origin+'/proxy?url=x')).status,400);
    assert.equal((await fetch(origin+'/',{method:'POST'})).status,405);
    assert.equal((await fetch(origin+'/manifest.webmanifest')).headers.get('content-type'),'application/manifest+json');
    const manifest=await (await fetch(origin+'/manifest.webmanifest')).json();assert.equal(manifest.display,'standalone');
  }finally{await new Promise(r=>server.close(r));}
});
test('real Edge strict storage, interruption, export/reimport and offline cold startup',{timeout:180000},async()=>{
  const server=await startServer({testHttp:true,port:0}),origin='http://127.0.0.1:'+server.address().port;
  const profile=await mkdtemp(join(tmpdir(),'huginn-p1-edge-'));
  const browser=spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',['--headless=new','--no-first-run','--disable-background-networking','--disable-component-update','--disable-sync','--user-data-dir='+profile,'--remote-debugging-port=0','about:blank'],{windowsHide:true,stdio:'ignore'});
  let ws,send;
  try{
    let endpoint;
    for(let i=0;i<200;i++){try{endpoint='http://127.0.0.1:'+(await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0];break;}catch{await new Promise(r=>setTimeout(r,100));}}
    assert.ok(endpoint,'Edge debugging unavailable');
    const target=(await (await fetch(endpoint+'/json/list')).json()).find(t=>t.type==='page');
    ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});
    let next=0;const pending=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}};
    send=(method,params={})=>new Promise((resolve,reject)=>{const id=++next;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
    const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});assert.equal(r.exceptionDetails,undefined,JSON.stringify(r.exceptionDetails));return r.result.value;};
    await send('Page.enable');await send('Page.navigate',{url:origin+'/'});
    await evaluate(`new Promise((resolve,reject)=>{let n=0;const timer=setInterval(()=>{if(document.querySelector('#capabilities')?.textContent.includes('probe passed')){clearInterval(timer);resolve(true);}else if(++n>300){clearInterval(timer);reject(Error(document.querySelector('#message')?.textContent));}},100);})`);
    const module=await readFile(new URL('pwa-browser.mjs',import.meta.url),'utf8');
    const result=await evaluate(module.replace('export async function','async function')+'\nrunBrowserTests()');
    for(const r of result.results)assert.equal(r.pass,true,r.name+': '+r.error+'\n'+r.stack);
    console.log('P1 browser: '+result.passed+' passed; '+(await send('Browser.getVersion')).product);
    await evaluate('navigator.serviceWorker.ready.then(()=>new Promise(r=>navigator.serviceWorker.controller?r(true):navigator.serviceWorker.addEventListener("controllerchange",()=>r(true),{once:true})))');
    // Import a small fixture, then create a new document with all networking disabled.
    await evaluate(`(async()=>{const {openPwa}=await import('./adapter.mjs');const c=await (await fetch('./fixtures/catalog.json')).json();const p=await openPwa({catalog:c});await p.import(new Uint8Array(await (await fetch('./fixtures/'+c.fixtures[0].file)).arrayBuffer()));p.close();})()`);
    await send('Network.enable');await send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});
    await send('Page.navigate',{url:'about:blank'});await send('Page.navigate',{url:origin+'/'});
    await evaluate(`new Promise((resolve,reject)=>{let n=0;const timer=setInterval(()=>{if(document.querySelector('.state')?.textContent==='VERIFIED LOCAL'&&document.querySelector('#offline')?.textContent.includes('cached')){clearInterval(timer);resolve(true);}else if(++n>300){clearInterval(timer);reject(Error('Offline startup: '+document.body?.textContent));}},100);})`);
    await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
    await new Promise(r=>setTimeout(r,100));
    const image=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});
    await mkdir(new URL('build/p1/',root),{recursive:true});
    await writeFile(new URL('build/p1/offline-phone-layout.png',root),Buffer.from(image.data,'base64'));
    const ackCount=await evaluate(`(async()=>{const r=indexedDB.open('huginn-pwa-p1-no-ack');return await new Promise(resolve=>{r.onsuccess=()=>{const names=[...r.result.objectStoreNames];r.result.close();resolve(names.includes('ack_outbox'));};});})()`);
    assert.equal(ackCount,false);
    console.log('P1 offline fresh-document startup and stored evidence reopen: PASS (desktop loopback secure context; not iOS/HTTPS qualification).');
  }finally{
    if(send&&ws?.readyState===1)try{await Promise.race([send('Browser.close'),new Promise(r=>setTimeout(r,1000))]);}catch{}
    ws?.close();browser.kill();await new Promise(r=>server.close(r));
  }
});

test('worker cache-install rollback and update admission preserve active work',async()=>{
  const {runInNewContext}=await import('node:vm');
  const source=await readFile(new URL('pwa/sw.js',root),'utf8');
  const handlers={},deleted=[],notices=[];let rejected=false,skipped=0,clients=[{id:'one'},{id:'two'}];
  const self={registration:{scope:'https://pwa.example/'},addEventListener:(type,handler)=>handlers[type]=handler,
    skipWaiting:async()=>{skipped++;},clients:{matchAll:async()=>clients,claim:async()=>{}}};
  runInNewContext(source,{self,URL,fetch:async()=>{},caches:{open:async()=>({addAll:async()=>{if(rejected)throw Error('CACHE_INSTALL_FAILED');}}),delete:async key=>{deleted.push(key);},keys:async()=>[]}});
  let pending;
  rejected=true;handlers.install({waitUntil:p=>pending=p});await assert.rejects(()=>pending,/CACHE_INSTALL_FAILED/);
  assert.deepEqual(deleted,['huginn-pwa-p1-v1']);
  const event={data:{type:'ACTIVATE_WHILE_IDLE'},source:{id:'one',postMessage:value=>notices.push(value)},waitUntil:p=>pending=p};
  handlers.message(event);await pending;assert.equal(skipped,0);assert.equal(notices[0].type,'UPDATE_BLOCKED_OTHER_WINDOWS');
  clients=[{id:'one'}];handlers.message(event);await pending;assert.equal(skipped,1);
  let intercepted=false;
  handlers.fetch({request:{method:'GET',url:'https://192.168.4.1/api/v1/flights'},respondWith:()=>intercepted=true});
  assert.equal(intercepted,false,'worker intercepted device request');
});
