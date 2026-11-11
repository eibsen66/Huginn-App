import test from 'node:test';import assert from 'node:assert/strict';
import {readFile,mkdtemp,mkdir,writeFile} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {spawn} from 'node:child_process';import {startServer} from '../scripts/pwa-serve.mjs';
import {fixture} from './flight-fixtures.mjs';import {metadataSha256,parseHfl} from '../flight-evidence.mjs';
import {createServer} from 'node:http';import {settingsHost} from './settings-protocol-host.mjs';
test('automatic QR pairing validates, connects once, cancels and retries without confirmation',{timeout:45000},async()=>{
 const server=await startServer({testHttp:true,port:0,...process.env.HUGINN_RECONNECT_BASELINE?{root:'C:/HuginnAPP/build/navigation-review/candidate-eb5241dc6e9995ba'}:{}}),origin='http://127.0.0.1:'+server.address().port,profile=await mkdtemp(join(tmpdir(),'huginn-settings-'));
 const browser=spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',['--headless=new','--no-first-run','--disable-background-networking','--disable-sync','--user-data-dir='+profile,'--remote-debugging-port=0','about:blank'],{windowsHide:true,stdio:'ignore'});let ws;
 const remote={...fixture().metadata,schema:"huginn.flight-courier.metadata",schema_version:1,manifest_generation:1,eligible:true};let deviceBusy=true;const protocol=settingsHost();const backend=createServer(async(req,res)=>{res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type');res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');if(req.method==='OPTIONS'){res.writeHead(204);res.end();return;}try{assert.ok(['Bearer '+'A'.repeat(43),'Bearer '+'B'.repeat(42)+'A'].includes(req.headers.authorization));let value;if(req.url.startsWith('/api/v1/flights'))value={schema:'huginn.flight-courier.list',schema_version:1,source_device_id:'AA:BB:CC:DD:EE:FF',capacity:64,count:1,entries:[remote],next_cursor:null,manifest_generation:1};else{let raw='';for await(const b of req)raw+=b;value=await protocol.request({method:req.method==='GET'?'get':req.url.endsWith('/apply')?'apply':'preview',raw:req.method==='POST'?raw:undefined,fault:deviceBusy?'busy':undefined});}res.writeHead(value.ok===false?409:200,{'Content-Type':'application/json'});res.end(JSON.stringify(value));}catch{res.writeHead(500);res.end('{}');}});
 const staticHandler=server.listeners('request')[0],fixtureHandler=backend.listeners('request')[0];server.removeListener('request',staticHandler);server.on('request',(req,res)=>{if(req.url==='/pairing-scanner.mjs'){readFile('dist/pwa/pairing-scanner.mjs','utf8').then(text=>{res.writeHead(200,{'Content-Type':'text/javascript'});res.end(text.replace('onValid(text,parsed);','onValid(text,parsed);onValid(text,parsed);'));});return;}if(req.url.startsWith('/__device/')){req.url=req.url.slice('/__device'.length);return fixtureHandler(req,res);}return staticHandler(req,res);});const backendOrigin=origin+'/__device';
 try{
  let port;for(let i=0;i<100;i++){try{port=(await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0];break;}catch{await new Promise(r=>setTimeout(r,100));}}
  assert.ok(port,'Edge startup');const target=(await(await fetch('http://127.0.0.1:'+port+'/json/list')).json()).find(t=>t.type==='page');ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});
  let n=0;const pending=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}};
  const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++n;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
  const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});assert.equal(r.exceptionDetails,undefined,JSON.stringify(r.exceptionDetails));return r.result.value;};
  const wait=x=>evaluate(`new Promise((r,j)=>{let n=0;const t=setInterval(()=>{if(${x}){clearInterval(t);r(true);}else if(++n>200){clearInterval(t);j(Error('TIMEOUT '+JSON.stringify({status:document.querySelector('#source-status').textContent,open:document.querySelector('#open-connection').hidden,manual:document.querySelector('#manual-connect').disabled,message:document.querySelector('#technical-code').textContent})));}},50);})`);
  await send('Page.navigate',{url:origin+'/'});await wait("document.querySelector('#capabilities')?.textContent.includes('probe passed')");
  const pair=JSON.stringify({schema:'huginn.flight-courier.pair',schema_version:1,source_device_id:'AA:BB:CC:DD:EE:FF',tls_spki_sha256:'6'.repeat(64),token:'A'.repeat(43)});
  await evaluate(`globalThis.calls=[];globalThis.rejectPreview=false;const originalFetch=fetch;globalThis.fetch=async(url,o)=>{if(!String(url).startsWith('https://192.168.4.1/'))return originalFetch(url,o);const path=new URL(url).pathname;calls.push(path);if(globalThis.expireFlights&&path.startsWith('/api/v1/flights'))return new Response('{}',{status:401});if(globalThis.delayFlights&&path.startsWith('/api/v1/flights'))return new Promise(r=>globalThis.releaseOldFlight=r);if(globalThis.rejectFlights&&path.startsWith('/api/v1/flights'))throw TypeError('offline fixture');if(globalThis.rejectSettingsFetch&&path==='/api/v2/settings')throw TypeError('fixture transport rejected');if(globalThis.failSave&&path.endsWith('/apply'))return new Response('{}',{status:500});if(globalThis.failRead&&path==='/api/v2/settings')return new Response('{}',{status:500});if(rejectPreview&&path.endsWith('/preview'))return new Response('{}',{status:rejectPreview===401?401:409});const response=await originalFetch(${JSON.stringify(backendOrigin)}+path,o);return new Response(await response.arrayBuffer(),{status:response.status,headers:response.headers});};`);
  assert.equal(await evaluate("document.querySelector('#source-consent')===null&&document.querySelector('#source-connect')===null"),true);
  await evaluate(`globalThis.qrPayload='{invalid';globalThis.jsQR=()=>({data:qrPayload});globalThis.tracks=[];Object.defineProperty(navigator.mediaDevices,'getUserMedia',{configurable:true,value:async()=>{const c=document.createElement('canvas');c.width=c.height=320;c.getContext('2d').fillRect(0,0,320,320);const s=c.captureStream(15);tracks.push(...s.getTracks());return s;}});document.querySelector('#open-connection').click();document.querySelector('#source-scan').click();`);
  await wait("document.querySelector('#pairing-code').textContent==='PAIR_JSON'&&!document.querySelector('#source-scan').disabled");
  assert.deepEqual(await evaluate('calls'),[]);
  assert.equal(await evaluate("tracks.every(t=>t.readyState==='ended')"),true);
  // Supported QR but expired server authorization: one attempt, then retry in app.
  await evaluate(`qrPayload=${JSON.stringify(pair)};globalThis.expireFlights=true;document.querySelector('#source-scan').click();`);
  await wait("document.querySelector('#pairing-code').textContent==='AUTH_REQUIRED'&&!document.querySelector('#source-scan').disabled");
  assert.equal(await evaluate('calls.length'),1);
  assert.match(await evaluate("document.querySelector('#message').textContent"),/útrunnin|afturkölluð/);
  // Cancel while the automatic connection's fetch ignores its AbortSignal.
  await evaluate("globalThis.expireFlights=false;globalThis.delayFlights=true;document.querySelector('#source-scan').click()");
  await wait("typeof releaseOldFlight==='function'&&!document.querySelector('#pairing-cancel').hidden");
  assert.equal(await evaluate('calls.length'),2);
  await evaluate("document.querySelector('#pairing-cancel').click();globalThis.delayFlights=false;releaseOldFlight(new Response('{}',{status:200}))");
  await wait("!document.querySelector('#source-scan').disabled");
  assert.notEqual(await evaluate("document.querySelector('.connection-card').dataset.state"),'connected');
  // Queued duplicate callbacks must not create a second connection/list request.
  await evaluate("document.querySelector('#source-scan').click();document.querySelector('#settings-tab').click()");
  await wait("document.querySelector('.connection-card').dataset.state==='connected'&&document.querySelector('#connection-panel').hidden");
  assert.equal(await evaluate('calls.length'),3);
  assert.equal(await evaluate("document.querySelector('#huginn-tab').getAttribute('aria-selected')"),'true');
  assert.equal(await evaluate("document.querySelector('#device-files').hidden"),false);
  assert.equal(await evaluate("document.querySelector('#source-pairing').value"),'');
  assert.equal(await evaluate("tracks.every(t=>t.readyState==='ended')"),true);
  // The working Reconnect action remains available after transport loss.
  await evaluate("globalThis.rejectFlights=true;document.querySelector('#fetch-recordings').click()");
  await wait("!document.querySelector('#open-connection').hidden");
  await evaluate("globalThis.rejectFlights=false;document.querySelector('#open-connection').click()");
  await wait("document.querySelector('.connection-card').dataset.state==='connected'");
  assert.equal(await evaluate("calls.filter(p=>p.endsWith('/apply')).length"),0);
 }finally{ws?.close();browser.kill();protocol.close();await new Promise(r=>server.close(r));}
});
