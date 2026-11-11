import test from 'node:test';import assert from 'node:assert/strict';
import {readFile,mkdtemp,mkdir,writeFile} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {spawn} from 'node:child_process';import {startServer} from '../scripts/pwa-serve.mjs';
import {fixture} from './flight-fixtures.mjs';import {metadataSha256,parseHfl} from '../flight-evidence.mjs';
import {createServer} from 'node:http';import {settingsHost} from './settings-protocol-host.mjs';
test('per-field and bulk saves, late edits, uncertain writes and explicit reconciliation',{timeout:90000},async()=>{
 const server=await startServer({testHttp:true,port:0}),origin='http://127.0.0.1:'+server.address().port,profile=await mkdtemp(join(tmpdir(),'huginn-settings-'));
 const browser=spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',['--headless=new','--no-first-run','--disable-background-networking','--disable-sync','--user-data-dir='+profile,'--remote-debugging-port=0','about:blank'],{windowsHide:true,stdio:'ignore'});let ws;
 let deviceBusy=false;const protocol=settingsHost();const backend=createServer(async(req,res)=>{res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type');res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');if(req.method==='OPTIONS'){res.writeHead(204);res.end();return;}try{assert.equal(req.headers.authorization,'Bearer '+'A'.repeat(43));let value;if(req.url.startsWith('/api/v1/flights'))value={schema:'huginn.flight-courier.list',schema_version:1,source_device_id:'AA:BB:CC:DD:EE:FF',capacity:64,count:0,entries:[],next_cursor:null,manifest_generation:1};else{let raw='';for await(const b of req)raw+=b;value=await protocol.request({method:req.method==='GET'?'get':req.url.endsWith('/apply')?'apply':'preview',raw:req.method==='POST'?raw:undefined,fault:deviceBusy?'busy':undefined});}res.writeHead(value.ok===false?409:200,{'Content-Type':'application/json'});res.end(JSON.stringify(value));}catch{res.writeHead(500);res.end('{}');}});
 const staticHandler=server.listeners('request')[0],fixtureHandler=backend.listeners('request')[0];server.removeListener('request',staticHandler);server.on('request',(req,res)=>{if(req.url.startsWith('/__device/')){req.url=req.url.slice('/__device'.length);return fixtureHandler(req,res);}return staticHandler(req,res);});const backendOrigin=origin+'/__device';
 try{
  let port;for(let i=0;i<100;i++){try{port=(await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0];break;}catch{await new Promise(r=>setTimeout(r,100));}}
  assert.ok(port,'Edge startup');const target=(await(await fetch('http://127.0.0.1:'+port+'/json/list')).json()).find(t=>t.type==='page');ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});
  let n=0;const pending=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}};
  const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++n;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
  const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});assert.equal(r.exceptionDetails,undefined,JSON.stringify(r.exceptionDetails));return r.result.value;};
  const wait=x=>evaluate(`new Promise((r,j)=>{let n=0;const t=setInterval(()=>{if(${x}){clearInterval(t);r(true);}else if(++n>200){clearInterval(t);j(Error('TIMEOUT'));}},50);})`);
  await send('Page.navigate',{url:origin+'/'});await wait("document.querySelector('#capabilities')?.textContent.includes('probe passed')");
  const pair=JSON.stringify({schema:'huginn.flight-courier.pair',schema_version:1,source_device_id:'AA:BB:CC:DD:EE:FF',tls_spki_sha256:'6'.repeat(64),token:'A'.repeat(43)});
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await evaluate(`globalThis.requests=[];const realFetch=fetch;globalThis.fetch=async(url,o={})=>{
   if(!String(url).startsWith('https://192.168.4.1/'))return realFetch(url,o);
   const path=new URL(url).pathname;requests.push({path,method:o.method||'GET',body:o.body?JSON.parse(new TextDecoder().decode(o.body)):null});
   if(globalThis.rejectAuth&&path.endsWith('/preview'))return Response.json({error:'INVALID_TOKEN'},{status:401});
   if(globalThis.failRead&&path==='/api/v2/settings')return new Response('{}',{status:500});
   const response=await realFetch(${JSON.stringify(backendOrigin)}+path,o);let bytes=await response.arrayBuffer();
   if(path.endsWith('/apply')&&globalThis.holdApply)await new Promise(r=>globalThis.releaseApply=r);
   if(path==='/api/v2/settings'&&globalThis.mismatch){const c=JSON.parse(new TextDecoder().decode(bytes));c.fields.find(f=>f.id==='aircraft.registration').value='DEVICE';bytes=new TextEncoder().encode(JSON.stringify(c));}
   if((path.endsWith('/apply')&&globalThis.breakApply)||(path.endsWith('/preview')&&globalThis.breakPreview)){let sent=false;return new Response(new ReadableStream({pull(c){if(!sent){sent=true;c.enqueue(new Uint8Array(bytes).subarray(0,4096));}else c.error(TypeError('fixture interruption'));}}),{status:200,headers:{'Content-Length':String(bytes.byteLength)}});}
   return new Response(bytes,{status:response.status,headers:response.headers});
  };document.querySelector('#open-connection').click();document.querySelector('#source-pairing').value=${JSON.stringify(pair)};document.querySelector('#manual-connect').click();`);
  await wait("document.querySelector('.connection-card').dataset.state==='connected'");await evaluate("document.querySelector('#settings-tab').click();document.querySelector('#settings-load').click()");
  await wait("!!document.querySelector('[data-save-field]')&&!document.querySelector('#settings-load').disabled");
  const edit=(id,value)=>evaluate(`{const f=document.querySelector('[data-settings-field="${id}"]');f.focus();f.value=${JSON.stringify(String(value))};f.dispatchEvent(new Event('input',{bubbles:true}));}`);
  const single=id=>evaluate(`document.querySelector('[data-save-field="${id}"]').click()`),done=()=>wait("!document.querySelector('#settings-load').disabled"),bright='display.brightness_percent',reg='aircraft.registration';
  const status=id=>evaluate(`document.querySelector('[data-settings-field="${id}"]').closest('label').querySelector('.setting-edit-note').textContent`);
  const applies=()=>evaluate("requests.filter(r=>r.path.endsWith('/apply')).length");
  const shot=async(name,id=bright)=>{await evaluate(`document.querySelector('[data-settings-field="${id}"]').scrollIntoView({block:'center'})`);const png=await send('Page.captureScreenshot',{format:'png'});await writeFile('build/field-save-review/screenshots/'+name+'.png',Buffer.from(png.data,'base64'));};
  assert.equal(await evaluate("document.querySelector('#settings-preview')===null"),true);assert.equal(await evaluate("document.querySelector('#settings-apply').textContent"),'Vista allar breytingar');
  await edit(bright,90);await edit(reg,'KEEP');assert.equal(await status(bright),'Óvistað');
  assert.equal(await evaluate("document.activeElement.dataset.settingsField"),reg);await new Promise(r=>setTimeout(r,900));assert.equal(await evaluate("requests.filter(r=>r.path.endsWith('/preview')).length"),0);await shot('unsaved');
  await single(bright);await single(bright);await done();assert.equal(await applies(),1);assert.equal(await status(bright),'Vistað');assert.equal(await status(reg),'Óvistað');assert.equal(await evaluate("document.querySelector('[data-settings-field=\"aircraft.registration\"]').value"),'KEEP');
  assert.deepEqual(await evaluate("requests.find(r=>r.path.endsWith('/apply')).body.changes.map(c=>c.field)"),[bright]);
  await edit(bright,'');assert.equal(await evaluate("document.querySelector('#settings-apply').disabled"),true);assert.equal(await evaluate("document.querySelector('[data-settings-field=\"display.brightness_percent\"]').getAttribute('aria-invalid')"),'true');await shot('invalid');
  await single(reg);await done();assert.equal(await status(reg),'Vistað');assert.equal(await evaluate("document.querySelector('[data-settings-field=\"display.brightness_percent\"]').value"),'');assert.equal(await evaluate("document.querySelector('#settings-apply').disabled"),true);
  await edit(bright,85);await evaluate("document.querySelector('#settings-apply').click();document.querySelector('#settings-apply').click()");await done();assert.equal(await applies(),3);assert.equal(await status(reg),'Vistað');
  // Both buttons: commit succeeds but POST body interrupts. Reconcile by GET,
  // preserving newer input entered while the immutable request is in flight.
  for(const bulk of [false,true]){
   await edit(bright,bulk?75:80);if(bulk)await edit(reg,'BULK');
   const n=await applies();await evaluate('globalThis.breakApply=true;globalThis.holdApply=true;globalThis.releaseApply=null');
   if(bulk)await evaluate("document.querySelector('#settings-apply').click()");else await single(bright);
   await wait('!!globalThis.releaseApply');await edit(bright,bulk?76:81);
   assert.equal(await evaluate("document.activeElement.dataset.settingsField"),bright);
   await evaluate('globalThis.holdApply=false;releaseApply()');await done();
   assert.equal(await applies(),n+1);assert.equal(await status(bright),'Óvistað');if(bulk)assert.equal(await status(reg),'Vistað');
   assert.equal(await evaluate("document.querySelector('[data-settings-field=\"display.brightness_percent\"]').value"),bulk?'76':'81');
  }
  // Both buttons: reconciliation fails, all further writes blocked. Explicit
  // read-only retry then resolves matching fields, never replays a POST.
  for(const bulk of [false,true]){
   await edit(bright,bulk?65:70);if(bulk)await edit(reg,'UNCERTAIN');const n=await applies();
   await evaluate('globalThis.failRead=true;globalThis.holdApply=true;globalThis.releaseApply=null');if(bulk)await evaluate("document.querySelector('#settings-apply').click()");else await single(bright);
   await wait('!!globalThis.releaseApply');await edit(bright,bulk?66:71);await evaluate('globalThis.holdApply=false;releaseApply()');await done();
   assert.equal(await evaluate("document.querySelector('#settings-workflow-hint').dataset.state"),'uncertain');assert.equal(await evaluate("document.querySelector('#settings-apply').disabled"),true);await shot('uncertain-'+(bulk?'all':'one'));
   await evaluate("globalThis.failRead=false;document.querySelector('#settings-reconcile').click()");await done();assert.equal(await applies(),n+1);assert.equal(await status(bright),'Óvistað');if(bulk)assert.equal(await status(reg),'Vistað');
  }
  await edit(bright,60);await edit(reg,'PARTIAL');await evaluate("globalThis.mismatch=true;document.querySelector('#settings-apply').click()");await done();assert.equal(await status(bright),'Vistað');assert.match(await status(reg),/DEVICE/);assert.equal(await evaluate("document.querySelector('#settings-workflow-hint').dataset.state"),'error');await shot('partial',reg);await evaluate('globalThis.mismatch=false');
  await edit(bright,55);const savesBefore=await applies();await evaluate('globalThis.breakApply=false;globalThis.breakPreview=true');await single(bright);await done();assert.equal(await applies(),savesBefore);assert.match(await status(bright),/Óvistað/);await shot('validation-failure');
  await evaluate("globalThis.breakPreview=false;Object.defineProperty(document,'hidden',{configurable:true,get:()=>!!globalThis.hiddenFixture});globalThis.hiddenFixture=true;document.dispatchEvent(new Event('visibilitychange'))");assert.equal(await evaluate("document.querySelector('#settings-apply').disabled"),true);
  await evaluate("globalThis.hiddenFixture=false;document.dispatchEvent(new Event('visibilitychange'))");await wait("document.querySelector('.connection-card').dataset.state==='connected'");await evaluate("document.querySelector('#settings-load').click()");await done();assert.equal(await evaluate("document.querySelector('[data-settings-field=\"display.brightness_percent\"]').value"),'55');assert.equal(await applies(),savesBefore);
  // Connection disappears after commit while its reply is held. The obsolete
  // reply must not mark Saved; a fresh read on reconnect resolves the outcome.
  await evaluate('globalThis.breakApply=true;globalThis.holdApply=true;globalThis.releaseApply=null');await single(bright);await wait('!!releaseApply');
  await evaluate("globalThis.hiddenFixture=true;document.dispatchEvent(new Event('visibilitychange'));globalThis.holdApply=false;releaseApply();globalThis.hiddenFixture=false;document.dispatchEvent(new Event('visibilitychange'))");
  await wait("document.querySelector('.connection-card').dataset.state==='connected'");await wait("!document.querySelector('#settings-load').disabled");await evaluate("document.querySelector('#settings-load').click()");await done();assert.equal(await applies(),savesBefore+1);assert.equal(await status(bright),'Vistað');assert.equal(await evaluate("document.querySelector('[data-settings-field=\"display.brightness_percent\"]').value"),'55');await shot('verified');
  assert.doesNotMatch(await evaluate("document.querySelector('#settings-diagnostic').textContent"),/Bearer|AAAAAAA/);
  await edit(bright,50);await evaluate('globalThis.rejectAuth=true;globalThis.breakApply=false');await single(bright);await wait("document.querySelector('.connection-card').dataset.state==='lost'");assert.equal(await applies(),savesBefore+1);assert.equal(await evaluate("document.querySelector('#connection-panel').hidden"),false);
 }finally{ws?.close();browser.kill();protocol.close();await new Promise(r=>server.close(r));}
});
