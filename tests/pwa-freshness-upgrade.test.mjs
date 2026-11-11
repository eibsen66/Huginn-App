import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,writeFile,mkdir,readdir} from 'node:fs/promises';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';

const root=new URL('../',import.meta.url);
const hash=b=>createHash('sha256').update(b).digest('hex');
test('actual older two-step shell upgrades to per-field saving with data and offline recovery intact',{timeout:240000},async()=>{
 const original=JSON.parse(await readFile(new URL('pwa/fixtures/catalog.json',root)));
 const originalBytes=await Promise.all(original.fixtures.map(f=>readFile(new URL('pwa/fixtures/'+f.file,root))));

 const manifest=JSON.parse(await readFile(new URL('dist/pwa/build.json',root)));
 assert.match(manifest.version,/^[0-9a-f]{16}$/);assert.equal(manifest.full_ack_gate_pass,false);
 const versions=new Map();
 for(const version of ['A','B','C','D']){
  const assets=new Map();
  for(const file of Object.keys(manifest.files)){
   let body=await readFile(new URL((version==='A'?'build/immediate-edit-preview-final/candidate-a891e07022384c69/':'dist/pwa/')+file,root));
   if(file==='index.html')body=Buffer.from(body.toString().replace('<body>','<body data-test-version="'+version+'">'));
   if(file==='entry.mjs')body=Buffer.from(body.toString().replace('openPwa({catalog})',"openPwa({catalog,name:'huginn-p2-update'})"));
   if(file==='sw.js')body=Buffer.from(body.toString().replace("const CACHE='huginn-pwa-p1-'+BUILD;","const CACHE='huginn-pwa-p1-p2-update-"+version+"';"));
   assets.set('/'+file,body);
  }
  assets.set('/',assets.get('/index.html'));versions.set(version,assets);
 }
 assert.deepEqual(versions.get('A').get('/flight-storage.mjs'),versions.get('B').get('/flight-storage.mjs'));
 assert.deepEqual(versions.get('A').get('/adapter.mjs'),versions.get('B').get('/adapter.mjs'));
 let current='A',network=true,held,holding=false,broken=false;
 const server=createServer((req,res)=>{
  if(!network){res.destroy();return;}
  if(current==='C'&&req.url==='/fixtures/ceiling.FLG'&&holding){held=res;return;}
  if(current==='D'&&req.url==='/entry.mjs'&&broken){res.writeHead(404);res.end('simulated missing update asset');return;}
  const body=versions.get(current).get(req.url);
  if(req.method!=='GET'||!body){res.writeHead(404);res.end();return;}
  const type=/\.m?js$/.test(req.url)?'text/javascript':/\.png$/.test(req.url)?'image/png':req.url.endsWith('.json')?'application/json':req.url.endsWith('.webmanifest')?'application/manifest+json':req.url.endsWith('.FLG')?'application/octet-stream':req.url.endsWith('.css')?'text/css':'text/html';
  res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store'});res.end(body);
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
  let r;
  for(let attempt=0;attempt<5;attempt++){try{r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});break;}catch(e){if(!expression.startsWith('new Promise')||!e.message.includes('navigated or closed')||attempt===4)throw e;await new Promise(resolve=>setTimeout(resolve,100));}}
  if(r.exceptionDetails){const debug=await send('Runtime.evaluate',{expression:"({version:document.body.dataset.testVersion,states:[...document.querySelectorAll('.state')].map(s=>s.textContent),cap:document.querySelector('#capabilities')?.textContent,error:document.querySelector('#message')?.textContent,update:document.querySelector('#update-status')?.textContent,buttonDisabled:document.querySelector('#update')?.disabled})",returnByValue:true});console.log('UPDATE DEBUG '+JSON.stringify(debug.result?.value));}assert.equal(r.exceptionDetails,undefined,JSON.stringify(r.exceptionDetails));return r.result.value;
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



  const wait=expression=>"new Promise((r,j)=>{let n=0;const t=setInterval(async()=>{try{if("+expression+"){clearInterval(t);r(true);}else if(++n>200){clearInterval(t);j(Error('WAIT_TIMEOUT'));}}catch(e){clearInterval(t);j(e);}},50)})";
  await evaluate(wait("document.querySelector('#capabilities')?.textContent.includes('probe passed')&&navigator.serviceWorker.controller"));
  const init="(async()=>{const {openPwa}=await import('./adapter.mjs');const catalog=await (await fetch('./fixtures/catalog.json')).json();globalThis.checkApp=await openPwa({catalog,name:'huginn-p2-update'});globalThis.checkCatalog=catalog;return catalog;})()";
  await evaluate(init);
  for(let i=0;i<3;i++)await evaluate("(async()=>{const raw=new Uint8Array(await (await fetch('./fixtures/'+checkCatalog.fixtures["+i+"].file)).arrayBuffer());return checkApp.import(raw);})()");
  const inspect="(async()=>{const {evidenceKey}=await import('./flight-storage.mjs');const rows=await checkApp.list(),exports=[];for(const f of checkCatalog.fixtures){const k=evidenceKey(f.metadata);await checkApp.verify(k);const out=await checkApp.export(k);if(!(await checkApp.reimport(k,out.bytes)).byteIdentical)throw Error('ROUND_TRIP');exports.push([...out.bytes]);}return {rows,exports,ack:checkApp.fullAckGatePass};})()";
  const baseline=await evaluate(inspect);assert.equal(baseline.rows.length,3);assert.equal(baseline.ack,false);
  for(let i=0;i<3;i++)assert.deepEqual(Buffer.from(baseline.exports[i]),originalBytes[i]);
  assert.equal(await evaluate("!!document.querySelector('#settings-preview')"),true);assert.match(versions.get('A').get('/settings-ui.mjs').toString(),/Forskoða breytingar/);results.push({tests:'A/B',pass:true,version:'A',rows:3});
  await evaluate('checkApp.close()');
  // Same origin/scope, changed worker byte content: real browser install/waiting.
  current='B';
  await evaluate("(async()=>{const r=await navigator.serviceWorker.getRegistration();await r.update();})()");
  await evaluate(wait("(await navigator.serviceWorker.getRegistration()).waiting?.state==='installed'"));
  assert.equal(await evaluate("document.body.dataset.testVersion"),'A');
  results.push({test:'C',pass:true,waiting:'B'});
  // Reopen existing document while B waits: A remains active and cached.
  await send('Page.navigate',{url:origin+'/'});
  await evaluate(wait("document.querySelector('#capabilities')?.textContent.includes('probe passed')"));
  assert.equal(await evaluate('document.body.dataset.testVersion'),'A');
  await evaluate(wait("document.querySelector('#update').hidden===false"));
  assert.equal(await evaluate("!!document.querySelector('#settings-preview')"),true);results.push({test:'K',pass:true,version:'A',waiting:true});
  const second=(await send('Target.createTarget',{url:origin+'/'})).targetId;
  // Worker sees two clients deterministically before activation request.
  await evaluate(wait("(await navigator.serviceWorker.getRegistration()).active&&((await navigator.serviceWorker.getRegistration()).waiting)"));
  // Browser target must finish navigation before the worker counts its window.
  await new Promise(r=>setTimeout(r,200));
  await evaluate("document.querySelector('#update').click()");
  await evaluate(wait("document.querySelector('#update-status').textContent.includes('Lokaðu öðrum HuginnAPP')"));
  assert.equal(await evaluate('document.body.dataset.testVersion'),'A');
  const cacheTwo=await evaluate('caches.keys()');
  assert.ok(cacheTwo.includes('huginn-pwa-p1-p2-update-A')&&cacheTwo.includes('huginn-pwa-p1-p2-update-B'));
  results.push({test:'L',pass:true,activationBlocked:true});
  await send('Target.closeTarget',{targetId:second});
  await new Promise(r=>setTimeout(r,500)); // allow closed client to leave the worker client inventory
  await evaluate("document.querySelector('#update').click()");
  await evaluate(wait("document.body.dataset.testVersion==='B'&&document.querySelectorAll('.state').length===3&&[...document.querySelectorAll('.state')].every(s=>s.textContent===String.fromCharCode(83,243,116,116,32,111,103,32,115,97,110,110,114,101,121,110,116))"));
  await evaluate(init);const updated=await evaluate(inspect);assert.deepEqual(updated,baseline);
  assert.equal(await evaluate("document.querySelector('#settings-preview')===null"),true);assert.equal(await evaluate("document.querySelector('#settings-apply').textContent"),'Vista allar breytingar');assert.match(versions.get('B').get('/settings-ui.mjs').toString(),/Vista breytingu/);const cacheB=await evaluate('caches.keys()');assert.deepEqual(cacheB,['huginn-pwa-p1-p2-update-B']);
  const completeCache=await evaluate("(async()=>{const c=await caches.open('huginn-pwa-p1-p2-update-B');return (await c.keys()).length;})()");
  const swSource=versions.get('B').get('/sw.js').toString();
  const expectedAssets=JSON.parse(swSource.match(/const ASSETS=(\[[^;]+\]);/)[1].replaceAll("'",'"'));
  const cachedUrls=await evaluate("(async()=>{const c=await caches.open('huginn-pwa-p1-p2-update-B');return (await c.keys()).map(r=>r.url).sort();})()");
  assert.deepEqual(cachedUrls,expectedAssets.map(p=>new URL(p,origin+'/').href).sort());
  assert.equal(completeCache,expectedAssets.length);
  results.push({tests:'D/E/F/M/N/O',pass:true,version:'B',cacheEntries:completeCache});
  // Deterministic download interruption: hold one candidate asset, then destroy it.
  current='C';holding=true;
  await evaluate("(async()=>{const r=await navigator.serviceWorker.getRegistration();globalThis.failedWorker=null;r.addEventListener('updatefound',()=>{failedWorker=r.installing;});await r.update();})()");
  for(let n=0;n<200&&!held;n++)await new Promise(r=>setTimeout(r,25));
  assert.ok(held,'held candidate request was not reached');held.destroy();holding=false;
  // Stop retries from succeeding after deterministic request failure.
  network=false;
  await evaluate(wait("globalThis.failedWorker?.state==='redundant'"));
  assert.deepEqual(await evaluate('caches.keys()'),['huginn-pwa-p1-p2-update-B']);
  assert.equal(await evaluate("navigator.serviceWorker.getRegistration().then(r=>!!r.waiting)"),false);
  assert.deepEqual(await evaluate(inspect),baseline);
  results.push({test:'I',pass:true,candidateFailed:true,activeVersion:'B'});
  // Missing asset in candidate D, no active version replacement.
  network=true;current='D';broken=true;
  await evaluate("(async()=>{const r=await navigator.serviceWorker.getRegistration();globalThis.failedWorker=null;await r.update();})()");
  await evaluate(wait("globalThis.failedWorker?.state==='redundant'"));
  assert.deepEqual(await evaluate('caches.keys()'),['huginn-pwa-p1-p2-update-B']);
  assert.equal(await evaluate("navigator.serviceWorker.getRegistration().then(r=>!!r.waiting)"),false);
  assert.deepEqual(await evaluate(inspect),baseline);
  results.push({test:'J',pass:true,missingAsset:true,noFalseActivation:true});
  // Full browser process restart; server refuses ALL network traffic.
  await evaluate('checkApp.close()');network=false;await stop();await start();
  await send('Network.enable');await send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});
  await send('Page.navigate',{url:origin+'/'});
  await evaluate(wait("document.body.dataset.testVersion==='B'&&document.querySelectorAll('.state').length===3&&[...document.querySelectorAll('.state')].every(s=>s.textContent===String.fromCharCode(83,243,116,116,32,111,103,32,115,97,110,110,114,101,121,110,116))"));
  await evaluate(init);assert.deepEqual(await evaluate(inspect),baseline);
  assert.match(await evaluate("document.querySelector('.notice').textContent"),/NO-ACK.*FULL_ACK_GATE_PASS = false/s);
  results.push({tests:'G/H/N/O',pass:true,offlineRestart:true,version:'B'});
  console.log('P2 update A-O: PASS; failed candidates discarded, B retained, unchanged schema/data, offline process restart.');
  const names=await evaluate('indexedDB.databases().then(v=>v.map(d=>d.name))');
  assert.ok(names.every(n=>n.startsWith('huginn-p2-')));
  console.log('P2 update lifecycle completed.');
  await mkdir(new URL('build/freshness-review/upgrade/',root),{recursive:true});
  await writeFile(new URL('build/freshness-review/upgrade/update-results.json',root),JSON.stringify({origin,profile,scope:'desktop synthetic only; not iPhone power-loss qualification',results,databases:names},null,2));

 }finally{if(browser)await stop();await new Promise(r=>server.close(r));}
});
test('production artifact excludes update variants',async()=>{
 const build=JSON.parse(await readFile(new URL('dist/pwa/build.json',root)));
 assert.equal(build.full_ack_gate_pass,false);
 for(const name of Object.keys(build.files)){
  assert.ok(!/recovery|p2/i.test(name),'test artifact in manifest');
  if(/\.m?js$/.test(name))assert.doesNotMatch(await readFile(new URL('dist/pwa/'+name,root),'utf8'),/P2_INTERRUPT|recovery-storage|runRecovery|huginn-p2-|storage-faults|storagePlan|P2_PERSIST|data-test-version|p2-update|p2UiDatabase/);
 }
 const walk=async dir=>{for(const e of await readdir(dir,{withFileTypes:true})){assert.ok(!/recovery|p2/i.test(e.name));if(e.isDirectory())await walk(new URL(e.name+'/',dir));}};
 await walk(new URL('dist/pwa/',root));
 for(let i=0;i<originalPaths.length;i++)assert.equal(hash(await readFile(new URL(originalPaths[i],root))),expectedHashes[i]);
});
const originalPaths=['pwa/fixtures/complete.FLG','pwa/fixtures/incomplete.FLG','pwa/fixtures/ceiling.FLG'];
const expectedHashes=['93e7956bc91945a4edae075b01f2fa3fa97f36cb1531d752c706b6f7dde93d5d','1258a8be2cb0201dbb8aa6bed4e2d78e31c574682f8172584177e5950b87646a','a665ab60cb630c78316cf0023f4165e2244ae06094f94ad65e6ba9118053fca9'];
