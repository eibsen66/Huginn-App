import test from 'node:test';import assert from 'node:assert/strict';
import {readFile,mkdtemp,mkdir,writeFile} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {spawn} from 'node:child_process';import {startServer} from '../scripts/pwa-serve.mjs';
import {fixture} from './flight-fixtures.mjs';import {metadataSha256,parseHfl} from '../flight-evidence.mjs';
import {createServer} from 'node:http';import {settingsHost} from './settings-protocol-host.mjs';
test('one explicit Save with serialized automatic validation and authoritative reconciliation',{timeout:90000},async()=>{
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
  await evaluate(`globalThis.requests=[];globalThis.activePreviews=0;globalThis.maxPreviews=0;globalThis.held=[];const realFetch=fetch;globalThis.fetch=async(url,o={})=>{
   if(!String(url).startsWith('https://192.168.4.1/'))return realFetch(url,o);
   const path=new URL(url).pathname;requests.push({path,method:o.method||'GET'});
   if(globalThis.failRead&&path==='/api/v2/settings')return new Response('{}',{status:500});
   if(path.endsWith('/preview')){activePreviews++;maxPreviews=Math.max(maxPreviews,activePreviews);try{
    if(globalThis.rejectValidation)return new Response(JSON.stringify({ok:false,error:'SETTINGS_BUSY_OR_UNAVAILABLE'}),{status:409});
    const response=await realFetch(${JSON.stringify(backendOrigin)}+path,o);const bytes=await response.arrayBuffer();
    if(globalThis.holdValidation)await new Promise(r=>held.push(r));
    if(globalThis.partialPreview){let once=false;return new Response(new ReadableStream({pull(c){if(!once){once=true;c.enqueue(new Uint8Array(bytes).subarray(0,4096));}else c.error(TypeError('fixture partial response'));}}),{status:200,headers:{'Content-Length':String(bytes.byteLength)}});}
    return new Response(bytes,{status:response.status,headers:response.headers});
   }finally{activePreviews--;}}
   const response=await realFetch(${JSON.stringify(backendOrigin)}+path,o);return new Response(await response.arrayBuffer(),{status:response.status,headers:response.headers});
  };document.querySelector('#open-connection').click();document.querySelector('#source-pairing').value=${JSON.stringify(pair)};document.querySelector('#manual-connect').click();`);
  await wait("document.querySelector('.connection-card').dataset.state==='connected'");
  await evaluate("document.querySelector('#settings-tab').click();document.querySelector('#settings-load').click()");
  await wait("!!document.querySelector('[data-settings-field]')&&!document.querySelector('#settings-load').disabled");
  assert.equal(await evaluate("document.querySelector('#settings-preview')===null"),true);
  assert.equal(await evaluate("document.querySelector('#settings-apply').textContent"),'Vista breytingar');
  assert.equal(await evaluate("document.querySelector('#settings-apply').disabled"),true);
  const shot=async name=>{await evaluate("document.querySelector('#settings-changes').scrollIntoView({block:'center'})");const png=await send('Page.captureScreenshot',{format:'png'});await writeFile('build/one-save-review/screenshots/'+name+'.png',Buffer.from(png.data,'base64'));};
  await evaluate(`globalThis.brightness=document.querySelector('[data-settings-field="display.brightness_percent"]');brightness.focus();globalThis.initialBrightness=Number(brightness.value);brightness.value=initialBrightness===90?89:90;brightness.dispatchEvent(new Event('input',{bubbles:true}));`);
  assert.match(await evaluate("document.querySelector('#settings-changes').textContent"),/Birta:.*% → .*%/);
  assert.equal(await evaluate("document.activeElement===brightness"),true);
  await shot('checking');await wait("document.querySelector('#settings-workflow-hint').dataset.state==='ready'");await shot('ready');
  assert.equal(await evaluate("requests.filter(r=>r.path.endsWith('/apply')).length"),0);
  await evaluate("document.querySelector('#settings-apply').click();document.querySelector('#settings-apply').click()");
  await wait("document.querySelector('#settings-workflow-hint').dataset.state==='saved'");await shot('verified-saved');
  assert.equal(await evaluate("requests.filter(r=>r.path.endsWith('/apply')).length"),1);
  // Rapid typing sends only the latest valid snapshot, one request at a time.
  await evaluate("globalThis.startCount=requests.filter(r=>r.path.endsWith('/preview')).length;brightness.focus();for(const v of ['','61','62','63']){brightness.value=v;brightness.dispatchEvent(new Event('input',{bubbles:true}));}");
  assert.equal(await evaluate("document.querySelector('#settings-apply').disabled&&document.activeElement===brightness"),true);
  await wait("document.querySelector('#settings-workflow-hint').dataset.state==='ready'");
  assert.equal(await evaluate("requests.filter(r=>r.path.endsWith('/preview')).length-startCount"),1);
  // Coalesce newer input while the previous response is held; do not abort and
  // flood the server with overlapping work.
  await evaluate("globalThis.holdValidation=true;brightness.value='64';brightness.dispatchEvent(new Event('input',{bubbles:true}))");
  await wait('held.length===1');await evaluate("brightness.value='65';brightness.dispatchEvent(new Event('input',{bubbles:true}));brightness.value='66';brightness.dispatchEvent(new Event('input',{bubbles:true}))");
  await new Promise(r=>setTimeout(r,850));assert.equal(await evaluate('held.length'),1);assert.equal(await evaluate("document.querySelector('#settings-apply').disabled"),true);
  await evaluate('globalThis.holdValidation=false;held.shift()()');await wait("document.querySelector('#settings-workflow-hint').dataset.state==='ready'");assert.equal(await evaluate('maxPreviews'),1);assert.equal(await evaluate('brightness.value'),'66');
  await evaluate("brightness.value='';brightness.dispatchEvent(new Event('input',{bubbles:true}))");assert.equal(await evaluate("brightness.value===''&&document.querySelector('#settings-apply').disabled"),true);await shot('invalid');
  await evaluate("globalThis.rejectValidation=true;brightness.value='67';brightness.dispatchEvent(new Event('input',{bubbles:true}))");await wait("document.querySelector('#settings-workflow-hint').dataset.state==='error'");await shot('validation-error');
  const failedCount=await evaluate("requests.filter(r=>r.path.endsWith('/preview')).length");await new Promise(r=>setTimeout(r,1100));assert.equal(await evaluate("requests.filter(r=>r.path.endsWith('/preview')).length"),failedCount);
  await evaluate("globalThis.rejectValidation=false;brightness.value='68';brightness.dispatchEvent(new Event('input',{bubbles:true}))");await wait("document.querySelector('#settings-workflow-hint').dataset.state==='ready'");
  await evaluate("globalThis.partialPreview=true;brightness.value='69';brightness.dispatchEvent(new Event('input',{bubbles:true}))");await wait("document.querySelector('#settings-workflow-hint').dataset.state==='error'");
  const bodyFailure=await evaluate("JSON.parse(document.querySelector('#settings-diagnostic').textContent)");assert.equal(bodyFailure.httpStatus,200);assert.equal(bodyFailure.receivedBytes,4096);assert.equal(bodyFailure.phase,'body');assert.equal(bodyFailure.code,'RESPONSE_READ_FAILED');assert.equal(await evaluate("document.querySelector('#settings-apply').disabled"),true);await shot('response-body-error');
  await evaluate("globalThis.partialPreview=false;brightness.value='68';brightness.dispatchEvent(new Event('input',{bubbles:true}))");await wait("document.querySelector('#settings-workflow-hint').dataset.state==='ready'");
  // Background disconnect invalidates the exact preview; GET and validation
  // must be redone on return before Save can become available again.
  await evaluate("Object.defineProperty(document,'hidden',{configurable:true,get:()=>!!globalThis.hiddenFixture});globalThis.hiddenFixture=true;document.dispatchEvent(new Event('visibilitychange'))");
  assert.equal(await evaluate("document.querySelector('#settings-apply').disabled"),true);
  await evaluate("globalThis.hiddenFixture=false;document.dispatchEvent(new Event('visibilitychange'))");await wait("document.querySelector('.connection-card').dataset.state==='connected'");
  assert.equal(await evaluate("document.querySelector('#settings-apply').disabled"),true);
  await evaluate("document.querySelector('#settings-load').click()");await wait("document.querySelector('#settings-workflow-hint').dataset.state==='ready'");
  // Server commits in this disposable host fixture, but readback is denied:
  // uncertain until an explicit read-only reconciliation matches the intent.
  await evaluate("globalThis.failRead=true;document.querySelector('#settings-apply').click()");await wait("document.querySelector('#settings-workflow-hint').dataset.state==='uncertain'");await shot('uncertain-save');
  assert.equal(await evaluate("document.querySelector('#settings-apply').disabled"),true);const saves=await evaluate("requests.filter(r=>r.path.endsWith('/apply')).length");
  await evaluate("globalThis.hiddenFixture=true;document.dispatchEvent(new Event('visibilitychange'));globalThis.hiddenFixture=false;document.dispatchEvent(new Event('visibilitychange'))");await wait("document.querySelector('.connection-card').dataset.state==='connected'");
  await evaluate("globalThis.failRead=false;document.querySelector('#settings-load').click()");await wait("document.querySelector('#settings-workflow-hint').dataset.state==='saved'");
  assert.equal(await evaluate("requests.filter(r=>r.path.endsWith('/apply')).length"),saves);assert.equal(await evaluate("document.querySelector('[data-settings-field=\"display.brightness_percent\"]').value"),'68');
  // Text, checkbox and select events use the same immediate edit path.
  await evaluate(`{const field=document.querySelector('[data-settings-field="aircraft.registration"]');field.focus();field.value='DRAFT';field.setSelectionRange(2,2);field.dispatchEvent(new Event('input',{bubbles:true}));globalThis.caretField=field;const check=document.querySelector('[data-settings-field="display.auto_brightness"]');check.checked=!check.checked;check.dispatchEvent(new Event('input',{bubbles:true}));const select=document.querySelector('[data-settings-field="units.speed"]');select.selectedIndex=(select.selectedIndex+1)%select.options.length;select.dispatchEvent(new Event('change',{bubbles:true}));}`);
  await wait("document.querySelector('#settings-workflow-hint').dataset.state==='ready'");
  assert.equal(await evaluate("document.activeElement===caretField&&caretField.selectionStart===2&&caretField.value==='DRAFT'"),true);
  assert.equal(await evaluate("requests.filter(r=>r.path.endsWith('/apply')).length"),saves);
  // A removed invalid topology boundary must not prevent automatic validation.
  await evaluate(`{const enabled=document.querySelector('[data-settings-field="parameters.1.enabled"]');enabled.checked=false;enabled.dispatchEvent(new Event('input',{bubbles:true}));}`);
  await wait("!document.querySelector('[data-settings-field=\"parameters.1.topology\"]').disabled");
  await evaluate(`globalThis.topologyInput=document.querySelector('[data-settings-field="parameters.1.topology"]');topologyInput.value=JSON.stringify('RGR');topologyInput.dispatchEvent(new Event('input',{bubbles:true}));`);
  await wait("!!document.querySelector('[data-settings-field=\"parameters.1.boundary.0\"]')");
  const topologyPosts=await evaluate("requests.filter(r=>r.path.endsWith('/preview')).length");
  await evaluate(`{const boundary=document.querySelector('[data-settings-field="parameters.1.boundary.0"]');boundary.value='999999999';boundary.dispatchEvent(new Event('input',{bubbles:true}));}topologyInput.value=JSON.stringify('');topologyInput.dispatchEvent(new Event('input',{bubbles:true}));`);
  await wait("!document.querySelector('[data-settings-field=\"parameters.1.boundary.0\"]')");
  await wait("['ready','error'].includes(document.querySelector('#settings-workflow-hint').dataset.state)");
  // The actual firmware rejects this empty profile. It must reach server
  // validation instead of remaining blocked by the removed invalid boundary.
  assert.equal(await evaluate("requests.filter(r=>r.path.endsWith('/preview')).length"),topologyPosts+1);
  assert.equal(await evaluate("document.querySelector('#settings-workflow-hint').dataset.state"),'error');
  assert.equal(await evaluate("JSON.parse(document.querySelector('#settings-diagnostic').textContent).code"),'INVALID_SETTINGS_OR_PROTECTED_FIELD');
  assert.equal(await evaluate("document.querySelector('#settings-apply').disabled"),true);
  assert.equal(await evaluate("requests.filter(r=>r.path.endsWith('/apply')).length"),saves);
  assert.doesNotMatch(await evaluate("document.querySelector('#settings-diagnostic').textContent"),/Bearer|AAAAAAA/);
 }finally{ws?.close();browser.kill();protocol.close();await new Promise(r=>server.close(r));}
});
