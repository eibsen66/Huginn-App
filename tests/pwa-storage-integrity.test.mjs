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
test('P2 quota persistence and two-window concurrency',{timeout:240000},async()=>{
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

  const make=label=>{
   const catalog=structuredClone(original),inputs=[];
   for(let i=0;i<3;i++){
    const raw=Buffer.from(originalBytes[i]),m=catalog.fixtures[i].metadata;
    m.session_id=hash(Buffer.from('P2-storage-'+label+'-'+i)).slice(0,32);
    m.source_device_id='02:00:00:00:03:'+String(i+1).padStart(2,'0');
    m.filename='F03000'+(i+1)+'.FLG';Buffer.from(m.session_id,'hex').copy(raw,8);
    raw.writeUInt32LE(referenceCrc(raw.subarray(0,124)),124);
    m.physical_sha256=hash(raw);m.metadata_sha256=hash(referenceEncoding(m));inputs.push([...raw]);
   }return {catalog,inputs};
  };
  const initialize=(v,name)=>"(async()=>{const m=await import('./storage-browser.mjs');return m.setup("+JSON.stringify(v.catalog)+","+JSON.stringify(v.inputs)+","+JSON.stringify(name)+");})()";
  for(const mode of [0,4,'publication']){
   const v=make('quota-'+mode);await evaluate(initialize(v,'huginn-p2-quota-'+mode));
   const result=await evaluate("(async()=>{const m=await import('./storage-browser.mjs');return m.quotaCase("+JSON.stringify(mode)+");})()");
   assert.equal(result.pass,true);results.push({quota:result});console.log('P2 quota: '+JSON.stringify(result));
  }
  // Run the actual entry module, with navigator persistence mocked only here.
  for(const mode of ['granted','denied','unavailable','throws']){
   await send('Page.navigate',{url:origin+'/'});
   const v=make('persistence-'+mode),name='huginn-p2-ui-'+mode;
   await evaluate(initialize(v,name));
   await evaluate("testApp.import(testInputs[0])");
   assets.set('/fixtures/catalog.json',{type:'application/json',body:JSON.stringify(v.catalog)});
   await evaluate("globalThis.p2UiDatabase="+JSON.stringify(name)+";Object.defineProperty(navigator,'serviceWorker',{value:undefined,configurable:true});Object.defineProperty(navigator.storage,'persist',{value:"+ (mode==='unavailable'?'undefined':mode==='throws'?"async()=>{throw Error('P2_PERSIST_EXCEPTION')}":'async()=>'+(mode==='granted')) +",configurable:true});import('./entry.mjs')");
   await evaluate("new Promise((r,j)=>{let n=0;const t=setInterval(()=>{if(document.querySelector('.state')?.textContent==='VERIFIED LOCAL'){clearInterval(t);r(true);}else if(++n>100){clearInterval(t);j(Error('UI_INIT'));}},50)})");
   const initial=await evaluate("document.querySelector('#persist').disabled");
   assert.equal(initial,mode==='unavailable');
   if(mode!=='unavailable')await evaluate("document.querySelector('#persist').onclick()");
   const ui=await evaluate("({status:document.querySelector('#persistence').textContent,message:document.querySelector('#message').textContent})");
   if(mode==='granted')assert.match(ui.status,/granted; user deletion and device loss remain possible/);
   if(mode==='denied')assert.match(ui.status,/not granted. Export an independent copy/);
   if(mode==='throws')assert.match(ui.message,/Stopped: P2_PERSIST_EXCEPTION/);
   await evaluate("document.querySelector('#flights button').onclick()");
   const after=await evaluate("document.querySelector('#persist').disabled");
   for(let repeat=0;repeat<3;repeat++){
    await evaluate("document.querySelector('#flights button').onclick()");
    assert.equal(await evaluate("document.querySelector('#persist').disabled"),mode==='unavailable','capability lost after repeated verification');
    await evaluate("document.querySelectorAll('#flights button')[1].onclick()");
    assert.equal(await evaluate("document.querySelector('#persist').disabled"),mode==='unavailable','capability lost after export preparation');
    if(mode!=='unavailable')await evaluate("document.querySelector('#persist').onclick()");
    assert.equal(await evaluate("document.querySelector('#persist').disabled"),mode==='unavailable','supported persistence disabled after request');
    assert.equal(await evaluate("document.querySelector('#import').disabled"),false,'valid import disabled');
   }
   const rows=await evaluate("(await import('./storage-browser.mjs')).verifyAll()");
   assert.equal(rows.length,1);
   const defect=mode==='unavailable'&&!after;
   results.push({persistence:mode,status:ui,initialDisabled:initial,afterVerifyDisabled:after,acceptance: defect?'FAIL: unavailable persistence button re-enabled after Verify local':'PASS'});
   console.log('P2 persistence: '+JSON.stringify(results.at(-1)));
  }
  // Two page targets in the same fresh profile and origin, separate JS owners.
  await send('Page.navigate',{url:origin+'/'});
  const targetId=(await send('Target.createTarget',{url:origin+'/'})).targetId;
  const target=(await (await fetch('http://127.0.0.1:'+(await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]+'/json/list')).json()).find(t=>t.id===targetId);
  const other=new WebSocket(target.webSocketDebuggerUrl);await new Promise((r,j)=>{other.onopen=r;other.onerror=j;});
  let next2=0;const pending2=new Map();other.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending2.get(m.id);pending2.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}};
  const eval2=expression=>new Promise((resolve,reject)=>{if(expression.startsWith('(await'))expression='(async()=>('+expression+'))()';const id=++next2;pending2.set(id,{resolve:r=>{if(r.exceptionDetails)reject(Error(JSON.stringify(r.exceptionDetails)));else resolve(r.result.value);},reject});other.send(JSON.stringify({id,method:'Runtime.evaluate',params:{expression,awaitPromise:true,returnByValue:true}}));});
  try{
   for(const scenario of ['same','different','export']){
    const v=make('concurrent-'+scenario),name='huginn-p2-concurrent-'+scenario;
    await evaluate(initialize(v,name));await evaluate('testApp.import(testInputs[0])');
    await eval2(initialize(v,name));
    const before=await evaluate("(await import('./storage-browser.mjs')).verifyAll()");
    await evaluate("(async()=>{const {storagePlan}=await import('./storage-faults.mjs');storagePlan.hold=true;globalThis.operation=testApp.import(testInputs[2]).then(()=>({ok:true}),e=>({ok:false,error:e.message}));})()");
    await evaluate("new Promise(r=>{const t=setInterval(async()=>{if((await import('./storage-faults.mjs')).storagePlan.paused){clearInterval(t);r(true);}},10)})");
    if(scenario==='export'){
      const control=await eval2("(await import('./storage-browser.mjs')).verifyAll()");assert.deepEqual(control,before);
    }else{
      await eval2("(async()=>{const {storagePlan}=await import('./storage-faults.mjs');storagePlan.hold=true;globalThis.operation=testApp.import(testInputs["+ (scenario==='same'?2:1) +"]).then(()=>({ok:true}),e=>({ok:false,error:e.message}));})()");
      await eval2("new Promise(r=>{const t=setInterval(async()=>{if((await import('./storage-faults.mjs')).storagePlan.paused){clearInterval(t);r(true);}},10)})");
    }
    await evaluate("(await import('./storage-faults.mjs')).storagePlan.release()");
    const first=await evaluate('operation');assert.equal(first.ok,true);
    let second;
    if(scenario!=='export'){
     await eval2("(await import('./storage-faults.mjs')).storagePlan.release()");
     second=await eval2('operation');
     if(scenario==='same'){assert.equal(second.ok,false);assert.equal(second.error,'NONCONTIGUOUS_RANGE');await eval2('testApp.import(testInputs[2])');}
     else assert.equal(second.ok,true);
    }
    const reopen="(async()=>{testApp.close();const {openPwa}=await import('./adapter.mjs');testApp=await openPwa({catalog:testCatalog,name:testName});return (await import('./storage-browser.mjs')).verifyAll();})()";
    const one=await evaluate(reopen),two=await eval2(reopen);assert.deepEqual(one,two);
    assert.equal(one.length,scenario==='different'?3:2);
    assert.equal(new Set(one.map(r=>r.metadata.metadata_sha256)).size,one.length);
    assert.deepEqual(one.find(r=>r.metadata.metadata_sha256===before[0].metadata.metadata_sha256),before[0]);
    results.push({concurrency:scenario,pass:true,second,rows:one.length});console.log('P2 concurrency: '+JSON.stringify(results.at(-1)));
   }
  }finally{other.close();await send('Target.closeTarget',{targetId});}
  const names=await evaluate('indexedDB.databases().then(v=>v.map(d=>d.name))');
  assert.ok(names.every(n=>n.startsWith('huginn-p2-')));
  console.log('P2 storage tests completed; persistence defect is reported separately.');
  await mkdir(new URL('build/p2/',root),{recursive:true});
  await writeFile(new URL('build/p2/storage-results.json',root),JSON.stringify({origin,profile,scope:'desktop synthetic only; not iPhone power-loss qualification',results,databases:names},null,2));
  assert.ok(!results.some(r=>r.acceptance?.startsWith('FAIL')), 'PERSISTENCE_UNAVAILABLE_UI: Verify local re-enables unsupported persistence control');
 }finally{if(browser)await stop();await new Promise(r=>server.close(r));}
});
test('production artifact excludes storage injection',async()=>{
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
