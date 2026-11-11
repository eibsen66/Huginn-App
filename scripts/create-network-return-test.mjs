import {readFile,writeFile} from 'node:fs/promises';
let s=await readFile('tests/pwa-reconnect-browser.test.mjs','utf8');
s=s.replace('running PWA reconnect after consumed pairing and transport failure','A -> B -> A with backgrounding, pending requests, bounded recovery and retained drafts').replace('timeout:45000','timeout:60000');
s=s.replaceAll('HUGINN_RECONNECT_BASELINE','HUGINN_NETWORK_BASELINE').replaceAll('C:/HuginnAPP/build/navigation-review/candidate-eb5241dc6e9995ba','C:/HuginnAPP/build/flight-list-error-review/candidate-acc6cd5e4cb6e49d');
const at=s.indexOf('\n  await evaluate("globalThis.rejectFlights=true;');
if(at<0)throw Error('fixture insertion');
s=s.slice(0,at)+`
  if(!process.env.HUGINN_NETWORK_REPRO_ONLY){
  deviceBusy=false;
  await evaluate("document.querySelector('#settings-tab').click();document.querySelector('#settings-load').click()");
  await wait("!!document.querySelector('[data-settings-field]')&&!document.querySelector('#settings-load').disabled");
  assert.equal(await evaluate("document.querySelector('#settings-preview').disabled"),true,'An unchanged loaded draft must not enable Preview');
  if(process.env.HUGINN_PREVIEW_BASELINE_ONLY)return;
  assert.match(await evaluate("document.querySelector('#settings-workflow-hint').textContent"),/Engar breytingar/);
  deviceBusy=true;
  }
  // Simulated A -> B -> A; real browser lifecycle events and pending Fetch,
  // not a claim about iOS network routing or browser timer scheduling.
  await evaluate("Object.defineProperty(document,'hidden',{configurable:true,get:()=>!!globalThis.fixtureHidden});globalThis.fixtureHidden=true;document.dispatchEvent(new Event('visibilitychange'));globalThis.delayFlights=true;globalThis.fixtureHidden=false;document.dispatchEvent(new Event('visibilitychange'))");
  await wait("document.querySelector('.connection-card').dataset.state==='connecting'&&!!globalThis.releaseOldFlight");
  await evaluate("globalThis.fromNetworkB=releaseOldFlight;globalThis.fixtureHidden=true;document.dispatchEvent(new Event('visibilitychange'));globalThis.fixtureHidden=false;document.dispatchEvent(new Event('visibilitychange'))");
  await wait("document.querySelector('.connection-card').dataset.state==='connecting'");
  assert.equal(await evaluate("document.querySelector('#open-connection').disabled"),false,'Reconnect must remain usable while a return-to-network probe is pending');
  await evaluate("globalThis.fromNetworkA=releaseOldFlight;globalThis.delayFlights=false;document.querySelector('#open-connection').click()");
  await wait("document.querySelector('.connection-card').dataset.state==='connected'");
  await evaluate("fromNetworkB(new Response('{}',{status:401}));fromNetworkA(new Response('{}',{status:401}))");
  assert.equal(await evaluate("document.querySelector('.connection-card').dataset.state"),'connected');
  // Offline invalidates a pending generation. Online is a hint, not proof of
  // reachability; a fresh authenticated GET is still required.
  await evaluate("window.dispatchEvent(new Event('offline'))");
  assert.notEqual(await evaluate("document.querySelector('.connection-card').dataset.state"),'connected');
  await evaluate("window.dispatchEvent(new Event('online'))");
  await wait("document.querySelector('.connection-card').dataset.state==='connected'");
  await evaluate("window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}))");
  await wait("document.querySelector('.connection-card').dataset.state==='connected'");
  // Accelerate only the existing 20-second limits in this disposable fixture.
  await evaluate("globalThis.normalSetTimeout=window.setTimeout.bind(window);window.setTimeout=(fn,ms,...args)=>normalSetTimeout(fn,ms>=19000&&ms<=20000?80:ms,...args);globalThis.delayFlights=true;window.dispatchEvent(new Event('offline'));window.dispatchEvent(new Event('online'))");
  await wait("['lost','disconnected'].includes(document.querySelector('.connection-card').dataset.state)&&!document.querySelector('#open-connection').disabled");
  await evaluate("window.setTimeout=normalSetTimeout;globalThis.fromTimedOut=releaseOldFlight;globalThis.delayFlights=false;document.querySelector('#open-connection').click()");
  await wait("document.querySelector('.connection-card').dataset.state==='connected'");
  await evaluate("fromTimedOut(new Response('{}',{status:401}))");
`+s.slice(at);
s=s.replace('  await wait("!document.querySelector(\'#settings-preview\').disabled");',`  await wait("!document.querySelector('#settings-preview').disabled");
  assert.match(await evaluate("document.querySelector('#settings-workflow-hint').textContent"),/Veldu Forskoða/);`);
const previewDone='  await wait("!document.querySelector(\'#settings-apply\').disabled");';
s=s.replace(previewDone,previewDone+`
  assert.match(await evaluate("document.querySelector('#settings-workflow-hint').textContent"),/Forskoðun staðfest/);
  await evaluate(\`{const input=document.querySelector('[data-settings-field="display.brightness_percent"]');globalThis.draftValue=Number(input.value)===100?99:100;input.value=draftValue;input.dispatchEvent(new Event('change'));}\`);
  await wait("document.querySelector('#settings-apply').disabled&&!document.querySelector('#settings-preview').disabled");
  await evaluate("document.querySelector('#settings-preview').click()");
  await wait("!document.querySelector('#settings-apply').disabled");`);
s=s.replace("if(globalThis.failSave&&path.endsWith('/apply'))", "if(globalThis.delayApply&&path.endsWith('/apply'))return new Promise(r=>globalThis.releaseOldApply=r);if(globalThis.failSave&&path.endsWith('/apply'))");
s=s.replace(' }finally{ws?.close();',`
  // A dispatched save is never replayed. Preserve its draft in RAM, but require
  // authoritative GET and a new preview before any later owner save.
  await evaluate("document.querySelector('#settings-tab').click();document.querySelector('#settings-load').click()");
  await wait("!!document.querySelector('[data-settings-field]')&&!document.querySelector('#settings-preview').disabled");
  await evaluate("document.querySelector('#settings-preview').click()");
  await wait("!document.querySelector('#settings-apply').disabled");
  await evaluate("globalThis.delayApply=true;document.querySelector('#settings-apply').click()");
  await wait("!!globalThis.releaseOldApply");
  await evaluate("globalThis.fixtureHidden=true;document.dispatchEvent(new Event('visibilitychange'));globalThis.fixtureHidden=false;document.dispatchEvent(new Event('visibilitychange'))");
  await wait("document.querySelector('.connection-card').dataset.state==='connected'");
  await evaluate("document.querySelector('#settings-load').click()");
  await wait("!!document.querySelector('[data-settings-field]')&&!document.querySelector('#settings-load').disabled");
  assert.equal(await evaluate("Number(document.querySelector('[data-settings-field=\\\"display.brightness_percent\\\"]').value)===draftValue"),true,'Draft must survive an interrupted unconfirmed save');
  assert.equal(await evaluate("document.querySelector('#settings-apply').disabled"),true);
  assert.equal(await evaluate("calls.filter(p=>p.endsWith('/apply')).length"),1);
  await evaluate("releaseOldApply(new Response('{}',{status:401}));globalThis.delayApply=false");
  assert.equal(await evaluate("document.querySelector('.connection-card').dataset.state"),'connected');
 }finally{ws?.close();`);
await writeFile('tests/pwa-network-return-browser.test.mjs',s);
