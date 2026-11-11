import test from 'node:test';import assert from 'node:assert/strict';
import {readFile,mkdtemp,mkdir,writeFile} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {spawn} from 'node:child_process';import {startServer} from '../scripts/pwa-serve.mjs';
import {fixture} from './flight-fixtures.mjs';import {metadataSha256,parseHfl} from '../flight-evidence.mjs';
import {createServer} from 'node:http';import {settingsHost} from './settings-protocol-host.mjs';
test('running PWA reconnect after consumed pairing and transport failure',{timeout:45000},async()=>{
 const server=await startServer({testHttp:true,port:0,...process.env.HUGINN_RECONNECT_BASELINE?{root:'C:/HuginnAPP/build/navigation-review/candidate-eb5241dc6e9995ba'}:{}}),origin='http://127.0.0.1:'+server.address().port,profile=await mkdtemp(join(tmpdir(),'huginn-settings-'));
 const browser=spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',['--headless=new','--no-first-run','--disable-background-networking','--disable-sync','--user-data-dir='+profile,'--remote-debugging-port=0','about:blank'],{windowsHide:true,stdio:'ignore'});let ws;
 const remote={...fixture().metadata,schema:"huginn.flight-courier.metadata",schema_version:1,manifest_generation:1,eligible:true};let deviceBusy=true;const protocol=settingsHost();const backend=createServer(async(req,res)=>{res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type');res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');if(req.method==='OPTIONS'){res.writeHead(204);res.end();return;}try{assert.ok(['Bearer '+'A'.repeat(43),'Bearer '+'B'.repeat(42)+'A'].includes(req.headers.authorization));let value;if(req.url.startsWith('/api/v1/flights'))value={schema:'huginn.flight-courier.list',schema_version:1,source_device_id:'AA:BB:CC:DD:EE:FF',capacity:64,count:1,entries:[remote],next_cursor:null,manifest_generation:1};else{let raw='';for await(const b of req)raw+=b;value=await protocol.request({method:req.method==='GET'?'get':req.url.endsWith('/apply')?'apply':'preview',raw:req.method==='POST'?raw:undefined,fault:deviceBusy?'busy':undefined});}res.writeHead(value.ok===false?409:200,{'Content-Type':'application/json'});res.end(JSON.stringify(value));}catch{res.writeHead(500);res.end('{}');}});
 const staticHandler=server.listeners('request')[0],fixtureHandler=backend.listeners('request')[0];server.removeListener('request',staticHandler);server.on('request',(req,res)=>{if(req.url.startsWith('/__device/')){req.url=req.url.slice('/__device'.length);return fixtureHandler(req,res);}return staticHandler(req,res);});const backendOrigin=origin+'/__device';
 try{
  let port;for(let i=0;i<100;i++){try{port=(await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0];break;}catch{await new Promise(r=>setTimeout(r,100));}}
  assert.ok(port,'Edge startup');const target=(await(await fetch('http://127.0.0.1:'+port+'/json/list')).json()).find(t=>t.type==='page');ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});
  let n=0;const pending=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}};
  const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++n;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
  const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});assert.equal(r.exceptionDetails,undefined,JSON.stringify(r.exceptionDetails));return r.result.value;};
  const wait=x=>evaluate(`new Promise((r,j)=>{let n=0;const t=setInterval(()=>{if(${x}){clearInterval(t);r(true);}else if(++n>200){clearInterval(t);j(Error('TIMEOUT '+JSON.stringify({status:document.querySelector('#source-status').textContent,open:document.querySelector('#open-connection').hidden,manual:document.querySelector('#manual-connect').disabled,message:document.querySelector('#technical-code').textContent})));}},50);})`);
  await send('Page.navigate',{url:origin+'/'});await wait("document.querySelector('#capabilities')?.textContent.includes('probe passed')");
  const pair=JSON.stringify({schema:'huginn.flight-courier.pair',schema_version:1,source_device_id:'AA:BB:CC:DD:EE:FF',tls_spki_sha256:'6'.repeat(64),token:'A'.repeat(43)});
  await evaluate(`globalThis.calls=[];globalThis.rejectPreview=false;const originalFetch=fetch;globalThis.fetch=async(url,o)=>{if(!String(url).startsWith('https://192.168.4.1/'))return originalFetch(url,o);const path=new URL(url).pathname;calls.push(path);if(globalThis.expireFlights&&path.startsWith('/api/v1/flights'))return new Response('{}',{status:401});if(globalThis.delayFlights&&path.startsWith('/api/v1/flights'))return new Promise(r=>globalThis.releaseOldFlight=r);if(globalThis.rejectFlights&&path.startsWith('/api/v1/flights'))throw TypeError('offline fixture');if(globalThis.rejectSettingsFetch&&path==='/api/v2/settings')throw TypeError('fixture transport rejected');if(globalThis.failSave&&path.endsWith('/apply'))return new Response('{}',{status:500});if(globalThis.failRead&&path==='/api/v2/settings')return new Response('{}',{status:500});if(rejectPreview&&path.endsWith('/preview'))return new Response('{}',{status:rejectPreview===401?401:409});const response=await originalFetch(${JSON.stringify(backendOrigin)}+path,o);return new Response(await response.arrayBuffer(),{status:response.status,headers:response.headers});};document.querySelector('#open-connection').click();document.querySelector('#source-pairing').value=${JSON.stringify(pair)};document.querySelector('#manual-connect').click();`);
  await wait("document.querySelector('#source-status').textContent==='Tengt við HuginnEIS'");

  await evaluate("globalThis.rejectFlights=true;document.querySelector('#fetch-recordings').click()");
  await wait("!document.querySelector('#open-connection').hidden && !document.querySelector('#manual-connect').disabled");
  assert.equal(await evaluate("document.querySelector('#source-recordings button').disabled"),true);
  assert.match(await evaluate("document.querySelector('#remote-list-state').textContent"),/\u00c1\u00f0ur s\u00f3ttur/);
  await evaluate("globalThis.rejectFlights=false;document.querySelector('#manual-connect').click()");
  await wait("document.querySelector('.connection-card').dataset.state==='connected'");

  assert.equal(await evaluate("document.querySelector('#open-connection').textContent"),'Tengjast aftur');
  // Complete 409 is a settings-only denial: no disconnect and no writable preview.
  await evaluate("document.querySelector('#settings-tab').click();document.querySelector('#settings-diagnose').click()");
  await wait("document.querySelector('#settings-diagnostic').textContent.includes('SETTINGS_BUSY_OR_UNAVAILABLE')");
  assert.equal(await evaluate("document.querySelector('.connection-card').dataset.state"),'connected');
  assert.equal(await evaluate("JSON.parse(document.querySelector('#settings-diagnostic').textContent).results[1].receivedBytes"),51);
  // A valid draft survives the same authorized connection, but its preview does not.
  deviceBusy=false;
  await evaluate("document.querySelector('#settings-load').click()");
  await wait("document.querySelector('[data-settings-field=\\\"display.brightness_percent\\\"]')");
  await evaluate(`globalThis.draftValue=Number(document.querySelector('[data-settings-field="display.brightness_percent"]').value)===100?99:100;const input=document.querySelector('[data-settings-field="display.brightness_percent"]');input.value=draftValue;input.dispatchEvent(new Event('change'));`);
  await wait("!document.querySelector('#settings-preview').disabled");
  await evaluate("document.querySelector('#settings-preview').click()");
  await wait("!document.querySelector('#settings-apply').disabled");
  await evaluate("globalThis.rejectFlights=true;document.querySelector('#huginn-tab').click();document.querySelector('#fetch-recordings').click()");
  await wait("!document.querySelector('#open-connection').hidden");
  assert.equal(await evaluate("document.querySelector('#settings-apply').disabled"),true);
  await evaluate("globalThis.rejectFlights=false;document.querySelector('#open-connection').click()");
  await wait("document.querySelector('.connection-card').dataset.state==='connected'");
  assert.equal(await evaluate("document.querySelector('#settings-preview').disabled&&document.querySelector('#settings-apply').disabled"),true);
  await evaluate("document.querySelector('#settings-tab').click();document.querySelector('#settings-load').click()");
  await wait("document.querySelector('#settings-message').textContent.includes('drög endurheimt')");
  assert.equal(await evaluate("Number(document.querySelector('[data-settings-field=\\\"display.brightness_percent\\\"]').value)===draftValue"),true);
  assert.equal(await evaluate("document.querySelector('#settings-apply').disabled"),true);
  assert.equal(await evaluate("calls.some(p=>p.endsWith('/apply'))"),false);
  // A late 401 from a paused request cannot replace the successful newer list.
  await evaluate("globalThis.delayFlights=true;document.querySelector('#huginn-tab').click();document.querySelector('#fetch-recordings').click()");
  await wait("typeof releaseOldFlight==='function'");
  await evaluate("globalThis.delayFlights=false;document.dispatchEvent(new Event('visibilitychange'))");
  await wait("document.querySelector('.connection-card').dataset.state==='connected'&&!document.querySelector('#fetch-recordings').disabled");
  await evaluate("releaseOldFlight(new Response('{}',{status:401}))");
  await new Promise(r=>setTimeout(r,80));
  assert.equal(await evaluate("document.querySelector('.connection-card').dataset.state"),'connected');
  // Expiry exposes fresh pairing in the same page. Exercise actual scanner callbacks
  // with a synthetic camera stream and a fixture decoder, never a real camera.
  await evaluate("globalThis.expireFlights=true;document.querySelector('#fetch-recordings').click()");
  await wait("!document.querySelector('#connection-panel').hidden&&!document.querySelector('#source-scan').disabled");
  await evaluate(`globalThis.expireFlights=false;globalThis.jsQR=()=>({data:${JSON.stringify(JSON.stringify({...JSON.parse(pair),token:'B'.repeat(42)+'A'}))}});const canvas=document.createElement('canvas');canvas.width=canvas.height=320;canvas.getContext('2d').fillRect(0,0,320,320);Object.defineProperty(navigator.mediaDevices,'getUserMedia',{configurable:true,value:async()=>canvas.captureStream(10)});document.querySelector('#source-scan').click();`);
  await wait("document.querySelector('.connection-card').dataset.state==='connected'");
  assert.equal(await evaluate("document.querySelector('#source-pairing').value"),'');
  assert.equal(await evaluate("document.querySelector('#source-consent')===null&&document.querySelector('#source-connect')===null"),true);
  await wait("document.querySelector('.connection-card').dataset.state==='connected'");
  assert.equal(await evaluate("calls.some(p=>p.endsWith('/apply'))"),false);
  await evaluate("document.querySelector('#settings-tab').click();document.querySelector('#settings-load').click()");
  await wait("document.querySelector('#settings-message').textContent.includes('drög endurheimt')");
  assert.equal(await evaluate("Number(document.querySelector('[data-settings-field=\"display.brightness_percent\"]').value)===draftValue"),true);
  assert.equal(await evaluate("document.querySelector('#settings-apply').disabled"),true);
  await evaluate("document.querySelector('#huginn-tab').click()");
  await evaluate("document.documentElement.lang='en';globalThis.rejectFlights=true;document.querySelector('#fetch-recordings').click()");
  await wait("document.querySelector('#open-connection').textContent==='Reconnect'&&!document.querySelector('#open-connection').hidden");
  assert.match(await evaluate("document.querySelector('#remote-list-state').textContent"),/Previously retrieved/);
  await evaluate("globalThis.rejectFlights=false;document.querySelector('#open-connection').click()");
  await wait("document.querySelector('.connection-card').dataset.state==='connected'");
 }finally{ws?.close();browser.kill();protocol.close();await new Promise(r=>server.close(r));}
});
