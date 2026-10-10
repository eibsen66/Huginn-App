import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,writeFile,mkdir,readdir} from 'node:fs/promises';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {referenceCrc,referenceEncoding} from './flight-fixtures.mjs';
const root=new URL('../',import.meta.url);
const hash=b=>createHash('sha256').update(b).digest('hex');
test('P2 bounded storage estimates and simulated database loss',{timeout:240000},async()=>{
 const original=JSON.parse(await readFile(new URL('pwa/fixtures/catalog.json',root)));
 const originalBytes=await Promise.all(original.fixtures.map(f=>readFile(new URL('pwa/fixtures/'+f.file,root))));
 const assets=new Map([
  ['/',{type:'text/html',body:'<!doctype html><title>P2 LOCAL TEST ONLY</title>'}],
  ['/flight-storage.mjs',{type:'text/javascript',body:await readFile(new URL('flight-storage.mjs',root))}],
  ['/flight-evidence.mjs',{type:'text/javascript',body:await readFile(new URL('flight-evidence.mjs',root))}],
  ['/recovery-storage.mjs',{type:'text/javascript',body:await readFile(new URL('tests/pwa-recovery-storage.mjs',root))}],
  ['/storage-browser.mjs',{type:'text/javascript',body:await readFile(new URL('tests/pwa-storage-browser.mjs',root))}],
  ['/adapter.mjs',{type:'text/javascript',body:(await readFile(new URL('pwa/adapter.mjs',root),'utf8')).replace("from './flight-storage.mjs'","from './storage-faults.mjs'")}]
 ]);
 assets.set('/storage-faults.mjs',{type:'text/javascript',body:await readFile(new URL('tests/pwa-storage-faults.mjs',root))});
 const entry=(await readFile(new URL('pwa/entry.mjs',root),'utf8')).replace('openPwa({catalog})','openPwa({catalog,name:globalThis.p2UiDatabase})');
 assets.set('/entry.mjs',{type:'text/javascript',body:entry});
 assets.set('/version-info.mjs',{type:'text/javascript',body:await readFile(new URL('pwa/version-info.mjs',root))});
 assets.set('/',{type:'text/html',body:(await readFile(new URL('pwa/index.html',root),'utf8')).replace(/<script[^>]*><\/script>/g,'')});
 const server=createServer((req,res)=>{
  const a=assets.get(req.url);
  if(req.method!=='GET'||!a){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'Content-Type':a.type,'Cache-Control':'no-store','Content-Security-Policy':"default-src 'self'; connect-src 'self'; script-src 'self'; object-src 'none'"});res.end(a.body);
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const origin='http://127.0.0.1:'+server.address().port;
 const profile=await mkdtemp(join(tmpdir(),'huginn-p2-isolated-edge-'));
 let browser,ws,send;
 async function start(){
  browser=spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',['--headless=new','--no-first-run','--disable-background-networking','--disable-component-update','--disable-sync','--user-data-dir='+profile,'--remote-debugging-port=0','about:blank'],{windowsHide:true,stdio:'ignore'});
  let endpoint;
  for(let n=0;n<200;n++){try{endpoint='http://127.0.0.1:'+(await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0];const targets=await (await fetch(endpoint+'/json/list')).json();if(targets.some(t=>t.type==='page'))break;}catch{}await new Promise(r=>setTimeout(r,100));}
  const target=(await (await fetch(endpoint+'/json/list')).json()).find(t=>t.type==='page');
  ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});
  let next=0;const pending=new Map();
  ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}};
  send=(method,params={})=>new Promise((resolve,reject)=>{const id=++next;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
  await send('Page.enable');await send('Page.navigate',{url:origin+'/'});
 }
 async function evaluate(expression){
  if(expression.startsWith('(await'))expression='(async()=>('+expression+'))()';
  const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});
  assert.equal(r.exceptionDetails,undefined,JSON.stringify(r.exceptionDetails));return r.result.value;
 }
 async function stop(){
  const exited=new Promise(r=>browser.once('exit',r));
  try{await send('Browser.close');}catch{}
  ws.close();await Promise.race([exited,new Promise(r=>setTimeout(r,2000))]);
  browser.kill();
 }
 const results=[];
 try{
  await start();
  assert.equal(await evaluate('location.origin'),origin);
  assert.deepEqual(await evaluate('indexedDB.databases().then(v=>v.map(d=>d.name))'),[]);


  const catalog=original,inputs=originalBytes.map(b=>[...b]);
  const initialize=name=>"(async()=>{const m=await import('./storage-browser.mjs');return m.setup("+JSON.stringify(catalog)+","+JSON.stringify(inputs)+","+JSON.stringify(name)+");})()";
  assets.set('/fixtures/catalog.json',{type:'application/json',body:JSON.stringify(catalog)});
  async function ui(name){
   await evaluate("globalThis.p2UiDatabase="+JSON.stringify(name)+";Object.defineProperty(navigator,'serviceWorker',{value:undefined,configurable:true});import('./entry.mjs')");
   await evaluate("new Promise((r,j)=>{let n=0;const t=setInterval(()=>{if(document.querySelector('#capabilities').textContent.includes('probe passed')){clearInterval(t);r(true);}else if(++n>100){clearInterval(t);j(Error('UI_INIT'));}},50)})");
  }
  const select=i=>"(async()=>{const dt=new DataTransfer();dt.items.add(new File([testInputs["+i+"]],testCatalog.fixtures["+i+"].metadata.filename,{type:'application/octet-stream'}));const el=document.querySelector('#import');el.files=dt.files;await el.onchange();return document.querySelector('#message').textContent;})()";
  for(const mode of ['low','near','unavailable','invalid','throws']){
   await send('Page.navigate',{url:origin+'/'});
   const name='huginn-p2-pressure-'+mode;await evaluate(initialize(name));
   await evaluate('testApp.import(testInputs[0])');await evaluate('testApp.import(testInputs[1])');
   const controls=await evaluate("(await import('./storage-browser.mjs')).verifyAll()");
   const response=mode==='low'?'{quota:2097152,usage:2097151}':mode==='near'?'{quota:4194304,usage:4190208}':mode==='invalid'?"{quota:'invalid',usage:-1}":'null';
   await evaluate("globalThis.estimateCalls=0;Object.defineProperty(navigator.storage,'estimate',{configurable:true,value:"+ (mode==='unavailable'?'undefined':"async()=>{estimateCalls++;"+(mode==='throws'?"throw Error('P2_ESTIMATE_ERROR');":"return "+response+";")+"}")+"})");
   await ui(name);
   await evaluate("(async()=>{const {storagePlan}=await import('./storage-faults.mjs');storagePlan.quota=4;storagePlan.writes=0;})()");
   const message=await evaluate(select(2));assert.match(message,/Stopped: P2 simulated quota exhaustion/);
   const after=await evaluate("(await import('./storage-browser.mjs')).verifyAll()");assert.deepEqual(after,controls);
   assert.equal(await evaluate("document.querySelectorAll('.state').length"),2);
   const calls=await evaluate('estimateCalls');assert.equal(calls,0,'PWA unexpectedly used estimates');
   await evaluate("(await import('./storage-faults.mjs')).storagePlan.quota=null");
   const recovered=await evaluate(select(2));assert.match(recovered,/VERIFIED LOCAL/);
   const rows=await evaluate("(await import('./storage-browser.mjs')).verifyAll()");assert.equal(rows.length,3);
   assert.equal(await evaluate("(await import('./storage-faults.mjs')).storagePlan.writes"),64);
   const status=await evaluate("document.querySelector('#persistence').textContent");assert.match(status,/not an archival guarantee/);
   results.push({estimate:mode,estimateCalls:calls,quotaErrorReported:true,recovery:true,integrity:'PASS',estimatePreflight:'NOT IMPLEMENTED'});
   console.log('P2 pressure: '+JSON.stringify(results.at(-1)));
  }
  // Copy verified exports OUT of IndexedDB into the Node controller before loss.
  await send('Page.navigate',{url:origin+'/'});
  const name='huginn-p2-loss-backup';await evaluate(initialize(name));
  for(let i=0;i<3;i++)await evaluate('testApp.import(testInputs['+i+'])');
  const backups=await evaluate("(async()=>{const {evidenceKey}=await import('./flight-storage.mjs');const list=[];for(const f of testCatalog.fixtures){const out=await testApp.export(evidenceKey(f.metadata));list.push([...out.bytes]);}testApp.close();return list;})()");
  for(let i=0;i<3;i++)assert.deepEqual(Buffer.from(backups[i]),originalBytes[i]);
  await send('Page.navigate',{url:origin+'/'});
  // Only this known disposable database in the proven fresh profile may be deleted.
  await evaluate("(async()=>{const name='huginn-p2-loss-backup';if(location.origin!=="+JSON.stringify(origin)+"||!name.startsWith('huginn-p2-loss-'))throw Error('LOSS_ISOLATION_REQUIRED');const names=await indexedDB.databases();if(!names.some(d=>d.name===name)||names.some(d=>!d.name.startsWith('huginn-p2-')))throw Error('UNEXPECTED_STORAGE');await new Promise((r,j)=>{const q=indexedDB.deleteDatabase(name);q.onsuccess=r;q.onerror=()=>j(q.error);q.onblocked=()=>j(Error('LOSS_BLOCKED'));});})()");
  await evaluate(initialize(name));await ui(name);
  assert.equal(await evaluate('testApp.list().then(v=>v.length)'),0);
  assert.equal(await evaluate("document.querySelectorAll('.state').length"),0);
  assert.match(await evaluate("document.querySelector('#flights').textContent"),/No imported synthetic evidence/);
  const missing=await evaluate("(async()=>{const {evidenceKey}=await import('./flight-storage.mjs');try{await testApp.verify(evidenceKey(testCatalog.fixtures[0].metadata));return 'WRONG_SUCCESS';}catch(e){return e.message;}})()");
  assert.equal(missing,'FLIGHT_NOT_IMPORTED');
  await evaluate('globalThis.testInputs='+JSON.stringify(backups)+'.map(v=>Uint8Array.from(v))');
  for(let i=0;i<3;i++){
   assert.match(await evaluate(select(i)),/VERIFIED LOCAL/);
   const rows=await evaluate("(await import('./storage-browser.mjs')).verifyAll()");
   const row=rows.find(r=>r.metadata.filename===catalog.fixtures[i].metadata.filename);
   assert.equal(row.metadata.state,catalog.fixtures[i].metadata.state);
   assert.equal(row.metadata.physical_bytes,catalog.fixtures[i].metadata.physical_bytes);
   assert.equal(row.metadata.physical_sha256,catalog.fixtures[i].metadata.physical_sha256);
   results.push({backup:row.metadata.filename,bytes:row.metadata.physical_bytes,state:row.metadata.state,sha256:row.metadata.physical_sha256,pass:true});
  }
  console.log('P2 simulated database loss and independent exact-byte restoration: PASS (not real eviction).');
  const names=await evaluate('indexedDB.databases().then(v=>v.map(d=>d.name))');
  assert.ok(names.every(n=>n.startsWith('huginn-p2-')));
  console.log('P2 bounded estimates, quota recovery and simulated loss completed.');
  await mkdir(new URL('build/p2/',root),{recursive:true});
  await writeFile(new URL('build/p2/pressure-results.json',root),JSON.stringify({origin,profile,scope:'desktop synthetic only; not iPhone power-loss qualification',results,databases:names},null,2));

 }finally{if(browser)await stop();await new Promise(r=>server.close(r));}
});
test('production artifact excludes pressure injection',async()=>{
 const build=JSON.parse(await readFile(new URL('dist/pwa/build.json',root)));
 assert.equal(build.full_ack_gate_pass,false);
 for(const name of Object.keys(build.files)){
  assert.ok(!/recovery|p2/i.test(name),'test artifact in manifest');
  if(/\.m?js$/.test(name))assert.doesNotMatch(await readFile(new URL('dist/pwa/'+name,root),'utf8'),/P2_INTERRUPT|recovery-storage|runRecovery|huginn-p2-|storage-faults|storagePlan|P2_PERSIST/);
 }
 const walk=async dir=>{for(const e of await readdir(dir,{withFileTypes:true})){assert.ok(!/recovery|p2/i.test(e.name));if(e.isDirectory())await walk(new URL(e.name+'/',dir));}};
 await walk(new URL('dist/pwa/',root));
 for(let i=0;i<originalPaths.length;i++)assert.equal(hash(await readFile(new URL(originalPaths[i],root))),expectedHashes[i]);
});
const originalPaths=['pwa/fixtures/complete.FLG','pwa/fixtures/incomplete.FLG','pwa/fixtures/ceiling.FLG'];
const expectedHashes=['93e7956bc91945a4edae075b01f2fa3fa97f36cb1531d752c706b6f7dde93d5d','1258a8be2cb0201dbb8aa6bed4e2d78e31c574682f8172584177e5950b87646a','a665ab60cb630c78316cf0023f4165e2244ae06094f94ad65e6ba9118053fca9'];
