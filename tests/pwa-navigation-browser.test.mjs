import test from 'node:test';import assert from 'node:assert/strict';
import {readFile,mkdtemp,mkdir,writeFile} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {spawn} from 'node:child_process';import {startServer} from '../scripts/pwa-serve.mjs';
import {fixture} from './flight-fixtures.mjs';import {metadataSha256,parseHfl} from '../flight-evidence.mjs';
import {createServer} from 'node:http';import {settingsHost} from './settings-protocol-host.mjs';
test('active PWA settings, synthetic transport and temporary browser storage',{timeout:45000},async()=>{
 const server=await startServer({testHttp:true,port:0}),origin='http://127.0.0.1:'+server.address().port,profile=await mkdtemp(join(tmpdir(),'huginn-settings-'));
 const browser=spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',['--headless=new','--no-first-run','--disable-background-networking','--disable-sync','--user-data-dir='+profile,'--remote-debugging-port=0','about:blank'],{windowsHide:true,stdio:'ignore'});let ws;
 let deviceBusy=true;const protocol=settingsHost();const backend=createServer(async(req,res)=>{res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type');res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');if(req.method==='OPTIONS'){res.writeHead(204);res.end();return;}try{assert.equal(req.headers.authorization,'Bearer '+'A'.repeat(43));let value;if(req.url.startsWith('/api/v1/flights'))value={schema:'huginn.flight-courier.list',schema_version:1,source_device_id:'AA:BB:CC:DD:EE:FF',capacity:64,count:0,entries:[],next_cursor:null,manifest_generation:1};else{let raw='';for await(const b of req)raw+=b;value=await protocol.request({method:req.method==='GET'?'get':req.url.endsWith('/apply')?'apply':'preview',raw:req.method==='POST'?raw:undefined,fault:deviceBusy?'busy':undefined});}res.writeHead(value.ok===false?409:200,{'Content-Type':'application/json'});res.end(JSON.stringify(value));}catch{res.writeHead(500);res.end('{}');}});
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
  await evaluate(`globalThis.calls=[];globalThis.rejectPreview=false;const originalFetch=fetch;globalThis.fetch=async(url,o)=>{if(!String(url).startsWith('https://192.168.4.1/'))return originalFetch(url,o);const path=new URL(url).pathname;calls.push(path);if(globalThis.rejectSettingsFetch&&path==='/api/v2/settings')throw TypeError('fixture transport rejected');if(globalThis.failSave&&path.endsWith('/apply'))return new Response('{}',{status:500});if(globalThis.failRead&&path==='/api/v2/settings')return new Response('{}',{status:500});if(rejectPreview&&path.endsWith('/preview'))return new Response('{}',{status:rejectPreview===401?401:409});const response=await originalFetch(${JSON.stringify(backendOrigin)}+path,o);return new Response(await response.arrayBuffer(),{status:response.status,headers:response.headers});};document.querySelector('#open-connection').click();document.querySelector('#source-pairing').value=${JSON.stringify(pair)};document.querySelector('#manual-connect').click();`);
  await wait("document.querySelector('#source-status').textContent==='Tengt við HuginnEIS'");
  assert.match(await evaluate("document.querySelector('#connection-guidance').textContent"),/Connectivity > Flight Courier/);
  await evaluate("document.querySelector('#settings-tab').click();document.querySelector('#settings-load').click()");
  await wait("document.querySelector('#settings-diagnostic').textContent.includes('SETTINGS_BUSY_OR_UNAVAILABLE')");
  assert.match(await evaluate("document.querySelector('#settings-message').textContent"),/Ekki tókst að sækja gögn/);
  assert.doesNotMatch(await evaluate("document.querySelector('#settings-message').textContent"),/óstaðfest|SOURCE_CHANGED/);
  assert.equal(await evaluate("document.querySelector('#settings-preview').disabled&&document.querySelector('#settings-apply').disabled"),true);
  deviceBusy=false;
  await evaluate("globalThis.rejectSettingsFetch=true;document.querySelector('#settings-load').click()");
  await wait("document.querySelector('#settings-diagnostic').textContent.includes('FETCH_REJECTED')");
  assert.equal(await evaluate("document.querySelector('#settings-message').textContent"),'Ekki tókst að sækja gögn');
  assert.equal(await evaluate("JSON.parse(document.querySelector('#settings-diagnostic').textContent).httpStatus"),null);
  await evaluate("globalThis.rejectSettingsFetch=false;globalThis.diagnosticCallStart=calls.length;document.querySelector('#settings-diagnose').click()");
  await wait("document.querySelector('#settings-diagnostic').textContent.includes('readOnly')");
  const checks=await evaluate("JSON.parse(document.querySelector('#settings-diagnostic').textContent)");
  assert.equal(checks.readOnly,true);assert.deepEqual(checks.results.map(r=>r.outcome),['valid','valid']);assert(checks.results.every(r=>r.method==='GET'&&r.httpStatus===200));
  assert.deepEqual(await evaluate("calls.slice(diagnosticCallStart)"),['/api/v1/flights','/api/v2/settings']);
  assert.equal(await evaluate("document.querySelector('#settings-preview').disabled&&document.querySelector('#settings-apply').disabled"),true);

  await evaluate("document.querySelector('#settings-tab').click()");
await evaluate("document.querySelector('#settings-tab').click();document.querySelector('#settings-load').click()");await wait("document.querySelectorAll('[data-settings-field]').length>120");
  await evaluate("document.querySelector('#fetch-recordings').click()");await wait("!document.querySelector('#settings-load').disabled");
  await evaluate("document.querySelector('#settings-load').click()");await wait("document.querySelectorAll('[data-settings-field]').length>120");

  assert.equal(await evaluate("document.querySelectorAll('[data-settings-section]').length"),6);
  await evaluate("const brightness=document.querySelector('[data-settings-field=\"display.brightness_percent\"]');brightness.value=60;brightness.dispatchEvent(new Event('change'));");await wait("document.querySelector('#settings-message').textContent.includes('í bið')");assert.equal(await evaluate("document.querySelector('#settings-apply').disabled"),true);
  await evaluate("document.querySelector('#downloads-tab').click()");
  assert.equal(await evaluate("document.querySelector('#downloads-panel').hidden"),false);
  assert.equal(await evaluate("document.querySelector('#huginn-panel').hidden&&document.querySelector('#settings-panel').hidden"),true);
  await evaluate("document.querySelector('#huginn-tab').click();document.querySelector('#settings-tab').click()");
  assert.equal(await evaluate("document.querySelector('[data-settings-field=\"display.brightness_percent\"]').value"),'60');
  assert.equal(await evaluate("document.querySelector('#source-status').textContent"),'Tengt við HuginnEIS');
  await mkdir('build/navigation-review/screenshots',{recursive:true});
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await evaluate("const banner=document.createElement('p');banner.textContent='SIMULATED CONNECTION - HOST TEST ONLY';banner.className='simulation-banner';document.body.append(banner)");
  for(const [id,name] of [['huginn-tab','huginn'],['downloads-tab','downloads'],['settings-tab','settings']]){await evaluate(`document.querySelector('#${id}').click();window.scrollTo(0,0)`);const shot=await send('Page.captureScreenshot',{format:'png'});await writeFile('build/navigation-review/screenshots/'+name+'.png',Buffer.from(shot.data,'base64'));}
  await evaluate("document.querySelector('#settings').open=true;document.querySelector('#technical').open=true;document.querySelector('.app-info').open=true;document.querySelector('#technical').lastElementChild.open=true;document.querySelector('#manual-connect').scrollIntoView({block:'center'})");
  const helpShot=await send('Page.captureScreenshot',{format:'png'});await writeFile('build/navigation-review/screenshots/help.png',Buffer.from(helpShot.data,'base64'));
  await evaluate("document.querySelector('#persist').scrollIntoView({block:'center'})");
  const storageShot=await send('Page.captureScreenshot',{format:'png'});await writeFile('build/navigation-review/screenshots/storage-help.png',Buffer.from(storageShot.data,'base64'));
  await evaluate("document.querySelector('#settings').open=false");
  await evaluate("const registration=document.querySelector('[data-settings-field=\"aircraft.registration\"]');registration.value='TEST-SIM';registration.dispatchEvent(new Event('change'));");await wait("!document.querySelector('#settings-preview').disabled");
  await evaluate("const engine=document.querySelector('[data-settings-field=\"engine.name\"]');engine.value='ULPower 260i';engine.dispatchEvent(new Event('change'));");await wait("!document.querySelector('#settings-preview').disabled");
  await evaluate("const count=document.querySelector('[data-settings-field=\"aux.count\"]');count.value='1';count.dispatchEvent(new Event('change'));");await wait("!document.querySelector('[data-settings-field=\"aux.0.source\"]').disabled");
  await evaluate("const sourceChoice=document.querySelector('[data-settings-field=\"aux.0.source\"]');sourceChoice.value='1';sourceChoice.dispatchEvent(new Event('change'));");await wait("!document.querySelector('#settings-preview').disabled");
  await evaluate("const label=document.querySelector('[data-settings-field=\"aux.0.label\"]');label.value='U.C.T.';label.dispatchEvent(new Event('change'));");await wait("!document.querySelector('#settings-preview').disabled");
  await evaluate("const limit=document.querySelector('[data-settings-field=\"parameters.11.max\"]');limit.closest('details').open=true;limit.value='280';limit.dispatchEvent(new Event('change'));");await wait("!document.querySelector('#settings-preview').disabled");
  await evaluate("document.querySelector('#settings-preview').click()");await wait("!document.querySelector('#settings-apply').disabled");await evaluate("document.querySelector('#settings-apply').click()");await wait("document.querySelector('#settings-message').textContent.includes('staðfesti vistun')");assert.equal(await evaluate("document.querySelector('[data-settings-field=\"aircraft.registration\"]').value"),'TEST-SIM');
  assert.equal(await evaluate("document.querySelector('[data-settings-field=\"engine.name\"]').value"),'ULPower 260i');assert.equal(await evaluate("document.querySelector('[data-settings-field=\"aux.0.label\"]').value"),'U.C.T.');assert.equal(await evaluate("document.querySelector('[data-settings-field=\"parameters.11.max\"]').value"),'280');
  await evaluate("document.querySelector('.simulation-banner').textContent='SIMULATED CONNECTION - HOST TEST ONLY';");
  await mkdir('build/settings-review',{recursive:true});for(const section of ['Aircraft','Engine','AUX','Display','Units','Fuel']){await send('Emulation.setDeviceMetricsOverride',{width:390,height:1000,deviceScaleFactor:1,mobile:true});await evaluate(`document.querySelector('[data-settings-section="${section}"]').scrollIntoView({block:'start'})`);const capture=await send('Page.captureScreenshot',{format:'png'});await writeFile('build/settings-review/'+section.toLowerCase()+'.png',Buffer.from(capture.data,'base64'));}
  for(const [id,name] of [['parameters.11.max','aux-limits'],['parameters.14.max','engine-limits']]){await evaluate(`(()=>{const details=document.querySelector('[data-settings-field="${id}"]').closest('details');details.open=true;details.scrollIntoView({block:'start'});})()`);const capture=await send('Page.captureScreenshot',{format:'png'});await writeFile('build/settings-review/'+name+'.png',Buffer.from(capture.data,'base64'));}
  await evaluate("(()=>{rejectPreview=true;const brightness=document.querySelector('[data-settings-field=\"display.brightness_percent\"]');brightness.value=61;brightness.dispatchEvent(new Event('change'));})()");await wait("document.querySelector('#settings-message').textContent.includes('í bið')");await evaluate("document.querySelector('#settings-preview').click()");await wait("document.querySelector('#settings-message').textContent.includes('Forskoðun mistókst')");assert.equal(await evaluate("document.querySelector('#settings-apply').disabled"),true);
  for(const width of [320,390,430]){await send('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:true});assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true,'overflow '+width);}
  await evaluate("document.querySelector('#device-settings').scrollIntoView()");const shot=await send('Page.captureScreenshot',{format:'png'});await mkdir('build/settings-review',{recursive:true});await writeFile('build/settings-review/pending-protocol.png',Buffer.from(shot.data,'base64'));

  await evaluate("rejectPreview=false;document.querySelector('#settings-preview').click()");await wait("!document.querySelector('#settings-apply').disabled");
  await evaluate("globalThis.failSave=true;document.querySelector('#settings-apply').click()");await wait("document.querySelector('#settings-message').textContent.includes('staðfesta vistun')");
  assert.doesNotMatch(await evaluate("document.querySelector('#settings-message').textContent"),/sækja stillingar\. Ekkert/);
  await evaluate("globalThis.failSave=false;document.querySelector('#settings-load').click()");await wait("document.querySelectorAll('[data-settings-field]').length>120");
  await evaluate("(()=>{const f=document.querySelector('[data-settings-field=\"display.brightness_percent\"]');f.value=62;f.dispatchEvent(new Event('change'));})()");await wait("document.querySelector('#settings-message').textContent.includes('í bið')");
  await evaluate("document.querySelector('#settings-preview').click()");await wait("!document.querySelector('#settings-apply').disabled");
  await evaluate("globalThis.failRead=true;document.querySelector('#settings-apply').click()");await wait("document.querySelector('#settings-message').textContent.includes('endurlestur')");
  assert.match(await evaluate("document.querySelector('#settings-message').textContent"),/svaraði vistun/);
  await evaluate("document.querySelector('#settings-load').click()");await wait("document.querySelector('#settings-message').textContent.includes('Ekki tókst að sækja gögn')");
  assert.equal(await evaluate("document.querySelector('#settings-preview').disabled&&document.querySelector('#settings-apply').disabled"),true);
  await evaluate("globalThis.failRead=false;document.querySelector('#settings-load').click()");await wait("document.querySelectorAll('[data-settings-field]').length>120");
  await evaluate("rejectPreview=401;document.querySelector('#settings-preview').click()");await wait("document.querySelectorAll('#settings-fields input').length===0");assert.notEqual(await evaluate("document.querySelector('#source-status').textContent"),'Tengt við HuginnEIS');
  await evaluate("document.querySelector('#source-profile').dispatchEvent(new Event('input'))");assert.equal(await evaluate("document.querySelectorAll('#settings-fields input').length"),0);assert.equal(await evaluate("document.querySelector('#settings-apply').disabled"),true);
  await evaluate("(async()=>{document.documentElement.lang='en';const {bindSettings}=await import('./settings-ui.mjs');bindSettings({getSource:()=>null,run:f=>f()});})()");assert.equal(await evaluate("document.querySelector('#settings-tab').textContent"),'Settings');
  await evaluate(`(async()=>{
   const {bindSettings}=await import('./settings-ui.mjs'),{createBrowserSource}=await import('./source.mjs');
   const options={origin:'https://192.168.4.1',selectedOrigin:'https://192.168.4.1',profile:'DEV_BROWSER_OS_TLS_V1',pairing:${JSON.stringify(pair)}};
   let active=createBrowserSource({...options,fetch:async()=>new Response('{}',{status:500})});
   const ui=bindSettings({getSource:()=>active,run:f=>f()});await document.querySelector('#settings-load').onclick();
   if(!document.querySelector('#settings-message').textContent.startsWith('Could not retrieve data'))throw Error('EN_RETRIEVE');
   if(!document.querySelector('#settings-preview').disabled||!document.querySelector('#settings-apply').disabled)throw Error('FAILED_GET_ENABLED');
   const config=await(await originalFetch(${JSON.stringify(backendOrigin)}+'/api/v2/settings',{headers:{Authorization:'Bearer '+'A'.repeat(43)}})).json();
   let release,started;const ready=new Promise(r=>started=r),gate=new Promise(r=>release=r);
   active.close();active=createBrowserSource({...options,fetch:async()=>{started();await gate;return Response.json(config);}});ui.reset();
   const pending=document.querySelector('#settings-load').onclick();await ready;active.close();
   active=createBrowserSource({...options,fetch:async()=>Response.json(config)});ui.reset();await document.querySelector('#settings-load').onclick();
   release();await pending;
   if(!document.querySelector('#settings-message').textContent.startsWith('Current settings retrieved.'))throw Error('OBSOLETE_UI_OVERWRITE');
   if(document.querySelectorAll('[data-settings-field]').length<100)throw Error('NEW_CONNECTION_CLEARED');active.close();ui.reset();
  })()`);

  for(const kind of ['complete','incomplete','torn']){
   const {raw,metadata}=fixture(kind,{samples:kind==='torn'?500:12000,runtime:1700000000n}),parsed=parseHfl(raw);for(const k of ['physical_bytes','start_utc','runtime_us','record_count','valid_bytes','state','complete','integrity','hfl_version'])metadata[k]=parsed[k];Object.assign(metadata,{schema:'huginn.flight-courier.metadata',schema_version:1,manifest_generation:1,eligible:true,reason:'AUTOMATIC'});metadata.metadata_sha256=await metadataSha256(metadata);
   const result=await evaluate(`(async()=>{
    const {openPwa}=await import('./adapter.mjs'),{createBrowserSource}=await import('./source.mjs'),{evidenceKey}=await import('./flight-storage.mjs');
    const catalog=await(await originalFetch('./fixtures/catalog.json')).json(),metadata=${JSON.stringify(metadata)},raw=Uint8Array.from(atob('${raw.toString('base64')}'),c=>c.charCodeAt(0));
    const name='settings-flight-${kind}-'+Date.now();let app=await openPwa({catalog,name}),ranges=[],interrupt=true;
    const source=createBrowserSource({origin:'https://192.168.4.1',selectedOrigin:'https://192.168.4.1',profile:'DEV_BROWSER_OS_TLS_V1',pairing:JSON.stringify({schema:'huginn.flight-courier.pair',schema_version:1,source_device_id:metadata.source_device_id,tls_spki_sha256:'6'.repeat(64),token:'A'.repeat(43)}),fetch:async(url,o)=>{
     if(o.method!=='GET')throw Error('UNEXPECTED_MUTATION');const path=new URL(url).pathname,etag='"hfl-sha256-'+metadata.physical_sha256+'-'+metadata.physical_bytes+'"';
     if(path==='/api/v1/flights')return new Response(JSON.stringify({schema:'huginn.flight-courier.list',schema_version:1,source_device_id:metadata.source_device_id,manifest_generation:1,capacity:64,count:1,entries:[metadata],next_cursor:null}));
     if(!path.endsWith('/evidence'))return new Response(JSON.stringify(metadata),{headers:{ETag:etag}});
     const [,a,b]=/^bytes=(\\d+)-(\\d+)$/.exec(o.headers.Range);ranges.push(+a);if(interrupt&&+a>0){interrupt=false;throw TypeError('fixture interruption');}
     if(o.headers['If-Match']!==etag)throw Error('ETAG');return new Response(raw.slice(+a,+b+1),{status:206,headers:{ETag:etag,'accept-ranges':'bytes','content-range':'bytes '+a+'-'+b+'/'+raw.length,'content-length':String(+b-a+1)}});
    }});
    if((await source.list())[0].state!==metadata.state)throw Error('CLASSIFICATION');
    let failed=false;try{await app.download(source,metadata.session_id);}catch{failed=true;}if(!failed)throw Error('EXPECTED_INTERRUPTION');const pending=await app.incomplete();if(Number(pending[0].committed_offset)!==16384)throw Error('OFFSET '+JSON.stringify(pending));
    app.close();app=await openPwa({catalog,name});try{await app.download(source,metadata.session_id,{onProgress:()=>{document.querySelector('#downloads-tab').click();document.querySelector('#huginn-tab').click();}});}catch(e){throw Error(JSON.stringify(e.diagnostic));}const key=evidenceKey(metadata),out=await app.export(key);if(out.bytes.length!==raw.length||!out.bytes.every((b,i)=>b===raw[i]))throw Error('BYTE_IDENTITY');
    source.close();app.close();app=await openPwa({catalog,name});await app.verify(key);const rows=await app.list();if(rows[0].metadata.state!==metadata.state)throw Error('STATE_CHANGED');app.close();await new Promise((r,j)=>{const q=indexedDB.deleteDatabase(name);q.onsuccess=r;q.onerror=()=>j(q.error);});
    return {state:rows[0].metadata.state,firstRangeRequests:ranges.filter(x=>x===0).length,bytes:raw.length};
   })()`);
   assert.equal(result.state,kind==='complete'?'COMPLETE':'INCOMPLETE');assert.equal(result.firstRangeRequests,1);assert.equal(result.bytes,raw.length);
  }
  // Offline local file access/export through the installed UI, without a device.
  await evaluate(`(async()=>{const r=await originalFetch('./fixtures/incomplete.FLG');const bytes=await r.arrayBuffer();const dt=new DataTransfer();dt.items.add(new File([bytes],'fixture.FLG'));const input=document.querySelector('#import');input.files=dt.files;input.dispatchEvent(new Event('change'));})()`);
  await wait("document.querySelectorAll('#fixture-flights article').length>0");
  await send('Network.enable');await send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});
  await evaluate("document.documentElement.lang='is';document.querySelector('#settings-tab').textContent='Stillingar';document.querySelector('#downloads-tab').click();document.querySelector('#test-records').open=true;window.scrollTo(0,0)");
  assert.equal(await evaluate("document.querySelector('#downloads-panel').hidden"),false);
  await evaluate("document.querySelector('#fixture-flights article button').click()");
  await wait("document.querySelector('#fixture-flights article').textContent.includes('Skrá tilbúin')");
  const localShot=await send('Page.captureScreenshot',{format:'png'});await writeFile('build/navigation-review/screenshots/downloads-offline.png',Buffer.from(localShot.data,'base64'));
 }finally{ws?.close();browser.kill();protocol.close();await new Promise(r=>server.close(r));}
});
