import test from 'node:test';import assert from 'node:assert/strict';
import {readFile,mkdtemp,mkdir,writeFile} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {spawn} from 'node:child_process';import {startServer} from '../scripts/pwa-serve.mjs';
import {fixture} from './flight-fixtures.mjs';import {metadataSha256,parseHfl} from '../flight-evidence.mjs';
import {createServer} from 'node:http';import {settingsHost} from './settings-protocol-host.mjs';
test('four phone tabs, one-click QR, manual modal, shared version check and retention feedback',{timeout:60000},async()=>{
 const server=await startServer({testHttp:true,port:0,}),origin='http://127.0.0.1:'+server.address().port,profile=await mkdtemp(join(tmpdir(),'huginn-settings-'));
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
  await evaluate(`globalThis.calls=[];globalThis.rejectPreview=false;const originalFetch=fetch;globalThis.fetch=async(url,o)=>{if(!String(url).startsWith('https://192.168.4.1/'))return originalFetch(url,o);const path=new URL(url).pathname;calls.push(path);if(globalThis.brokenFlights&&path.startsWith('/api/v1/flights'))return new Response(new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('{'));c.error(Error('interrupted fixture'));}}),{status:200});if(globalThis.expireFlights&&path.startsWith('/api/v1/flights'))return new Response('{}',{status:401});if(globalThis.delayFlights&&path.startsWith('/api/v1/flights'))return new Promise(r=>globalThis.releaseOldFlight=r);if(globalThis.rejectFlights&&path.startsWith('/api/v1/flights'))throw TypeError('offline fixture');if(globalThis.rejectSettingsFetch&&path==='/api/v2/settings')throw TypeError('fixture transport rejected');if(globalThis.failSave&&path.endsWith('/apply'))return new Response('{}',{status:500});if(globalThis.failRead&&path==='/api/v2/settings')return new Response('{}',{status:500});if(rejectPreview&&path.endsWith('/preview'))return new Response('{}',{status:rejectPreview===401?401:409});const response=await originalFetch(${JSON.stringify(backendOrigin)}+path,o);return new Response(await response.arrayBuffer(),{status:response.status,headers:response.headers});};`);


  const shot=async name=>{await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await new Promise(r=>setTimeout(r,80));const r=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile('build/system-info-review/screenshots/'+name+'.png',Buffer.from(r.data,'base64'));};
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  assert.equal(await evaluate("document.querySelectorAll('.top-tabs [role=tab]').length"),4);
  assert.equal(await evaluate("document.querySelector('#open-connection').hidden"),true);
  assert.equal(await evaluate("document.querySelector('#source-scan').getBoundingClientRect().height>0&&!document.querySelector('#source-scan').disabled"),true);
  assert.equal(await evaluate("document.body.textContent.includes('Tengjast HuginnEIS')"),false);
  await shot('01-huginn-initial');
  // Both refresh controls bind the same guarded, read-only inspection function.
  assert.equal(await evaluate("document.querySelector('#info-refresh').onclick===document.querySelector('#info-refresh-huginn').onclick"),true);
  await wait("!!navigator.serviceWorker.controller");
  await evaluate("document.querySelector('#info-refresh-huginn').click()");
  await wait("document.querySelector('#info-result-huginn').textContent&&!document.querySelector('#info-result-huginn').textContent.startsWith('Athuga')");
  assert.equal(await evaluate("document.querySelector('#info-result-huginn').textContent"),await evaluate("document.querySelector('#info-result').textContent"));
  await evaluate("document.querySelector('#system-tab').click()");
  assert.equal(await evaluate("document.querySelector('#technical').closest('details')===null&&document.querySelector('.app-info').closest('details')===null"),true);
  assert.equal(await evaluate("document.querySelector('#settings-panel #technical')===null&&document.querySelector('#settings-panel #storage-tools')===null"),true);
  await evaluate("document.querySelector('#info-refresh').click()");
  await wait("!document.querySelector('#info-refresh').disabled");
  assert.equal(await evaluate("document.querySelector('#info-result-huginn').textContent"),await evaluate("document.querySelector('#info-result').textContent"));
  await shot('02-system-info-top');
  for(const lang of ['is','en']){
   await evaluate('document.documentElement.lang='+JSON.stringify(lang)+';for(const n of document.querySelectorAll("[data-is][data-en]"))n.textContent=n.dataset['+JSON.stringify(lang)+'];');
   assert.equal(await evaluate("document.querySelector('#settings-tab').textContent"),lang==='is'?'Stillingar':'Settings');
   for(const width of [320,375,390,430]){
    await send('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:true});
    assert.equal(await evaluate("document.documentElement.scrollWidth<=innerWidth"),true,'No horizontal scroll at '+width+' '+lang);
    assert.equal(await evaluate("[...document.querySelectorAll('.top-tabs button')].every(b=>b.getBoundingClientRect().left>=0&&b.getBoundingClientRect().right<=innerWidth&&b.scrollWidth<=b.clientWidth)"),true,'All tab labels fit at '+width+' '+lang);
    assert.equal(await evaluate("document.querySelector('#system-tab').textContent"),'System Info');
   }
  }
  await evaluate("document.documentElement.lang='is';for(const n of document.querySelectorAll('[data-is][data-en]'))n.textContent=n.dataset.is;document.querySelector('#storage-tools').open=true;Object.defineProperty(navigator.storage,'persist',{configurable:true,value:async()=>true});document.querySelector('#persist').click()");
  await wait("document.querySelector('#persistence').textContent.includes('Vafrinn samþykkti betri')");
  assert.match(await evaluate("document.querySelector('#persist').nextElementSibling.textContent"),/Takkinn býr ekki til öryggisafrit/);
  await evaluate("document.querySelector('#persist').scrollIntoView({block:'start'})");await shot('03-storage-help');
  await evaluate("Object.defineProperty(navigator.storage,'persist',{configurable:true,value:async()=>false});document.querySelector('#persist').click()");
  await wait("document.querySelector('#persistence').textContent.includes('samþykkti ekki')");
  await evaluate("Object.defineProperty(navigator.storage,'persist',{configurable:true,value:async()=>{throw Error('fixture')}});document.querySelector('#persist').click()");
  await wait("document.querySelector('#persistence').textContent.includes('Ekki tókst')");
  // Import synthetic bytes into disposable local storage, then preserve them.
  await evaluate("(async()=>{const b=await(await fetch('./fixtures/complete.FLG')).arrayBuffer();const d=new DataTransfer();d.items.add(new File([b],'fixture.FLG'));document.querySelector('#import').files=d.files;document.querySelector('#import').dispatchEvent(new Event('change'));})()");
  await wait("document.querySelector('#fixture-count').textContent==='(1)'&&!document.querySelector('#import').disabled");
  await evaluate("document.querySelector('#downloads-tab').click();document.querySelector('#test-records').open=true;scrollTo(0,0)");await shot('04-downloaded-files');
  await evaluate("document.querySelector('#huginn-tab').click();scrollTo(0,0);document.querySelector('#open-manual').click()");
  assert.equal(await evaluate("document.querySelector('#manual-dialog').open"),true);
  assert.equal(await evaluate("document.querySelector('#source-pairing').closest('dialog').id"),'manual-dialog');
  await shot('05-manual-connection');
  await evaluate("document.querySelector('#source-pairing').value='{invalid';document.querySelector('#manual-connect').click()");
  await wait("!document.querySelector('#manual-connect').disabled&&!!document.querySelector('#manual-message').textContent");
  assert.equal(await evaluate("document.querySelector('#manual-dialog').open"),true);
  await evaluate("document.querySelector('#manual-close').click()");
  assert.equal(await evaluate("document.querySelector('#source-pairing').value"),'');
  // One visible QR click starts capture and auto-connects after validation.
  await evaluate('globalThis.cameraStarts=0;globalThis.jsQR=()=>({data:'+JSON.stringify(pair)+'});Object.defineProperty(navigator.mediaDevices,"getUserMedia",{configurable:true,value:async()=>{cameraStarts++;const c=document.createElement("canvas");c.width=c.height=320;c.getContext("2d").fillRect(0,0,320,320);return c.captureStream(15);}});document.querySelector("#source-scan").click();');
  await wait("document.querySelector('.connection-card').dataset.state==='connected'");assert.equal(await evaluate('cameraStarts'),1);
  deviceBusy=false;
  await evaluate("document.querySelector('#settings-tab').click();document.querySelector('#settings-load').click()");
  await wait("!!document.querySelector('[data-settings-field]')&&!document.querySelector('#settings-load').disabled");
  await evaluate('const f=document.querySelector(\'[data-settings-field="display.brightness_percent"]\');globalThis.draft=Number(f.value)===90?85:90;f.value=draft;f.dispatchEvent(new Event("input",{bubbles:true}));scrollTo(0,0);');await shot('06-settings');
  await evaluate("document.querySelector('#huginn-tab').click();globalThis.rejectFlights=true;document.querySelector('#fetch-recordings').click()");
  await wait("document.querySelector('.connection-card').dataset.state==='lost'");
  assert.equal(await evaluate("!document.querySelector('#open-connection').hidden&&!document.querySelector('#repair-qr').hidden"),true);
  await evaluate("globalThis.rejectFlights=false;document.querySelector('#open-connection').click()");await wait("document.querySelector('.connection-card').dataset.state==='connected'");
  // Supported manual pairing uses the existing connect function, closes on success.
  await evaluate('document.querySelector("#open-manual").click();document.querySelector("#source-pairing").value='+JSON.stringify(JSON.stringify({...JSON.parse(pair),token:'B'.repeat(42)+'A'}))+';document.querySelector("#manual-connect").click()');
  await wait("document.querySelector('.connection-card').dataset.state==='connected'&&!document.querySelector('#manual-dialog').open");
  assert.equal(await evaluate("document.querySelector('#settings-apply').disabled"),true);
  await evaluate("document.querySelector('#settings-tab').click();document.querySelector('#settings-load').click()");await wait("!!document.querySelector('[data-settings-field]')&&!document.querySelector('#settings-load').disabled");
  assert.equal(await evaluate('Number(document.querySelector(\'[data-settings-field="display.brightness_percent"]\').value)'),await evaluate('draft'));
  // Closing a pending manual attempt cancels it; late 401 cannot change QR session.
  await evaluate('document.querySelector("#huginn-tab").click();document.querySelector("#open-manual").click();document.querySelector("#source-pairing").value='+JSON.stringify(pair)+';globalThis.delayFlights=true;document.querySelector("#manual-connect").click()');
  await wait("typeof releaseOldFlight==='function'");await evaluate("const old=releaseOldFlight;document.querySelector('#manual-close').click();globalThis.delayFlights=false;document.querySelector('#source-scan').click();globalThis.late=old;");
  await wait("document.querySelector('.connection-card').dataset.state==='connected'");await evaluate("late(new Response('{}',{status:401}))");
  assert.equal(await evaluate("document.querySelector('.connection-card').dataset.state"),'connected');
  assert.equal(await evaluate("document.querySelector('#fixture-count').textContent"),'(1)');
  assert.equal(await evaluate("calls.filter(p=>p.endsWith('/apply')).length"),0);
  // Unsupported persistence is clear immediately after launch; no data clearing.
  await send('Page.enable');await evaluate('globalThis.preReload=true');
  await send('Page.addScriptToEvaluateOnNewDocument',{source:"Object.defineProperty(navigator.storage,'persist',{configurable:true,value:undefined});"});await send('Page.reload');await wait("!globalThis.preReload&&document.querySelector('#capabilities')?.textContent.includes('probe passed')");
  assert.equal(await evaluate('typeof navigator.storage.persist'),'undefined','Unsupported browser fixture installed before app initialization');
  assert.match(await evaluate("document.querySelector('#persistence').textContent"),/styður ekki/);assert.equal(await evaluate("document.querySelector('#persist').disabled"),true);await wait("document.querySelector('#fixture-count').textContent==='(1)'");
 }finally{ws?.close();browser.kill();protocol.close();await new Promise(r=>server.close(r));}
});
