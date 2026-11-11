import test from 'node:test';import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,mkdtemp} from 'node:fs/promises';import {createHash} from 'node:crypto';import {createServer} from 'node:http';import {spawn} from 'node:child_process';import {tmpdir} from 'node:os';import {join} from 'node:path';
const hash=b=>createHash('sha256').update(b).digest('hex');
test('exact a2 shell updates via its UI to exact 6a shell, preserving files and offline launch',{timeout:90000},async()=>{
 const old='a2acd940a7370142',next='6a2d2ea1505b8acf',out='build/system-info-review/upgrade-check';await mkdir(out,{recursive:true});
 const versions=new Map();
 for(const [id,dir]of [[old,'build/qr-recovery-review/candidate-'+old],[next,'build/system-info-review/candidate-'+next]]){
  const manifest=JSON.parse(await readFile(dir+'/build.json')),assets=new Map();assert.equal(manifest.version,id);
  for(const [p,h]of Object.entries(manifest.files)){const b=await readFile(dir+'/'+p);assert.equal(hash(b),h,p);assets.set('/'+p,b);}
  assets.set('/',assets.get('/index.html'));assets.set('/build.json',await readFile(dir+'/build.json'));versions.set(id,assets);
 }
 let current=old,online=true;const requests=[];
 const server=createServer((req,res)=>{requests.push({version:current,path:req.url,online});if(!online){res.destroy();return;}const b=versions.get(current).get(req.url);if(!b){res.writeHead(404);res.end();return;}const type=/\.m?js$/.test(req.url)?'text/javascript':/\.png$/.test(req.url)?'image/png':/\.json$/.test(req.url)?'application/json':req.url.endsWith('.css')?'text/css':req.url.endsWith('.webmanifest')?'application/manifest+json':req.url.endsWith('.FLG')?'application/octet-stream':'text/html';res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store'});res.end(b);});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port,profile=await mkdtemp(join(tmpdir(),'huginn-exact-upgrade-'));
 const browser=spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',['--headless=new','--no-first-run','--disable-background-networking','--disable-sync','--user-data-dir='+profile,'--remote-debugging-port=0','about:blank'],{windowsHide:true,stdio:'ignore'});let ws;
 try{
  let port;for(let n=0;n<100;n++){try{port=(await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0];break;}catch{await new Promise(r=>setTimeout(r,100));}}
  const target=(await(await fetch('http://127.0.0.1:'+port+'/json/list')).json()).find(t=>t.type==='page');ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});
  let id=0;const pending=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}};
  const send=(method,params={})=>new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params}));});
  const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});assert.equal(r.exceptionDetails,undefined,JSON.stringify(r.exceptionDetails));return r.result.value;};
  const wait=async condition=>{for(let n=0;n<200;n++){try{if(await evaluate(condition))return;}catch(e){if(!/context|navigat|Cannot read properties/i.test(e.message))throw e;}await new Promise(r=>setTimeout(r,50));}throw Error('TIMEOUT '+condition);};
  await send('Page.enable');await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await send('Page.navigate',{url:origin+'/'});
  await wait("document.querySelector('#capabilities')?.textContent.includes('probe passed')&&!!navigator.serviceWorker.controller");
  assert.equal(await evaluate("document.querySelector('meta[name=huginn-build]').content"),old);assert.equal(await evaluate("!!document.querySelector('#system-tab')"),false);
  // Use the real import action with synthetic FLGs in this disposable profile.
  for(const [i,file]of ['complete.FLG','incomplete.FLG'].entries()){
   await evaluate(`(async()=>{const b=await(await fetch('./fixtures/${file}')).arrayBuffer(),d=new DataTransfer();d.items.add(new File([b],'${file}'));const input=document.querySelector('#import');input.files=d.files;input.dispatchEvent(new Event('change'));})()`);
   await wait(`document.querySelector('#fixture-count').textContent==='(${i+1})'&&!document.querySelector('#import').disabled`);
  }
  const inspect=`(async()=>{const {openPwa}=await import('./adapter.mjs'),{evidenceKey}=await import('./flight-storage.mjs'),catalog=await(await fetch('./fixtures/catalog.json')).json(),app=await openPwa({catalog});try{const rows=await app.list(),files=[];for(const row of rows){const m=row.metadata||row;const e=await app.export(evidenceKey(m));files.push({metadata:m,bytes:[...e.bytes]});}return {files,ack:app.fullAckGatePass};}finally{app.close();}})()`;
  const before=await evaluate(inspect);assert.equal(before.files.length,2);assert.equal(before.ack,false);
  current=next;
  // Normal navigation re-runs old shell registration/update discovery; no
  // registration.update(), cache edits or direct activation messages from test.
  await send('Page.navigate',{url:origin+'/'});await wait("document.querySelector('#capabilities')?.textContent.includes('probe passed')&&!document.querySelector('#update').hidden");
  assert.equal(await evaluate("document.querySelector('meta[name=huginn-build]').content"),old);
  await evaluate("document.querySelector('#settings-tab').click();document.querySelector('#update').scrollIntoView({block:'center'})");
  assert.equal(await evaluate("document.querySelector('#update').closest('[role=tabpanel]').hidden"),false);
  assert.equal(await evaluate("document.querySelector('#update').disabled"),false);
  const beforeShot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(out+'/old-update-button.png',Buffer.from(beforeShot.data,'base64'));
  await evaluate("document.querySelector('#update').click()");
  await wait(`document.querySelector('meta[name=huginn-build]')?.content==='${next}'&&!!document.querySelector('#system-tab')`);
  await wait("document.querySelector('#capabilities')?.textContent.includes('probe passed')");
  await evaluate("document.querySelector('#system-tab').click();document.querySelector('#info-refresh').click();scrollTo(0,0)");
  await wait(`['info-app','info-active','info-controller'].every(id=>document.getElementById(id).textContent==='${next}')`);
  assert.deepEqual(await evaluate(inspect),before,'Files, metadata and exact export bytes preserved');
  const screenshot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(out+'/new-system-info.png',Buffer.from(screenshot.data,'base64'));
  online=false;await send('Page.reload');await wait(`document.querySelector('meta[name=huginn-build]')?.content==='${next}'&&document.querySelector('#capabilities')?.textContent.includes('probe passed')`);
  await evaluate("document.querySelector('#system-tab').click();document.querySelector('#info-refresh').click()");await wait(`['info-app','info-active','info-controller'].every(id=>document.getElementById(id).textContent==='${next}')`);
  assert.deepEqual(await evaluate(inspect),before,'Offline launch and exact exports retained');
  const report={checked_utc:new Date().toISOString(),from:old,to:next,exact_unmodified_assets:true,same_origin:origin,same_profile:true,data_clear:false,reinstall:false,activation:'Actual old Settings > App preferences > Update HuginnAPP button',app:next,active:next,controller:next,system_info_visible:true,files_preserved:2,bytes_and_metadata_identical:true,no_ack:false,offline_reload_passed:true,physical_iphone:false,requests};
  await writeFile(out+'/result.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({...report,requests:undefined}));
 }finally{ws?.close();browser.kill();await new Promise(r=>server.close(r));}
});
