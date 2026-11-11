import {readFile,writeFile} from 'node:fs/promises';
for(const p of ['tests/pwa-settings-browser.test.mjs','tests/pwa-navigation-browser.test.mjs','tests/pwa-reconnect-browser.test.mjs','tests/download-workflow-browser.test.mjs','tests/pairing-scanner-offline.test.mjs']){
 let s=await readFile(p,'utf8');
 // Old post-load consent toggle tested source invalidation: use the retained
 // explicit endpoint/profile edit event now that the checkbox is removed.
 s=s.replace('await evaluate("document.querySelector(\'#source-consent\').click()")','await evaluate("document.querySelector(\'#source-profile\').dispatchEvent(new Event(\'input\'))")');
 s=s.replaceAll("document.querySelector('#source-consent').click();",'');
 if(p.endsWith('pwa-reconnect-browser.test.mjs')){
  s=s.replace("  await wait(\"!document.querySelector('#source-connect').hidden&&!document.querySelector('#source-connect').disabled\");", "  await wait(\"document.querySelector('.connection-card').dataset.state==='connected'\");");
  s=s.replace("  await evaluate(\"document.querySelector('#source-connect').click()\");", "  assert.equal(await evaluate(\"document.querySelector('#source-consent')===null&&document.querySelector('#source-connect')===null\"),true);");
 }
 if(p.endsWith('pairing-scanner-offline.test.mjs')){
  s=s.replace("await wait(\"document.querySelector('#pairing-summary').textContent.includes('14:C1:9F:5B:21:51')\")", "await wait(\"networkCalls.length===1&&!document.querySelector('#pairing-cancel').hidden===false\")");
  s=s.replace('assert.deepEqual(result.networkCalls,[]);', "assert.equal(result.networkCalls.length,1);assert.equal(result.networkCalls[0],'https://192.168.4.1/api/v1/flights?limit=8');");
  s=s.replace('no connect before confirmation','one automatic connection after validation');
 }
 await writeFile(p,s);
}
let p='tests/pairing-scanner.test.mjs',s=await readFile(p,'utf8');
s=s.replace("page hiding/navigation stop camera; scanning cannot connect/persist/search/upload", "page hiding/navigation stops camera; only the validated owner-intent callback connects");
s=s.replace("assert.doesNotMatch(valid,/source\\.list|createBrowserSource|fetch|source-connect.*click/);", "assert.doesNotMatch(valid,/source\\.list|createBrowserSource|fetch/);assert.match(valid,/if\\(!qrIntent\\|\\|pairingPending/);assert.match(valid,/qrIntent=false/);assert.match(valid,/action\\(connect\\)/);");
await writeFile(p,s);
p='tests/pwa-trust.test.mjs';s=await readFile(p,'utf8');
s=s.replace('function disconnectSource\\(\\)\\{scanner\\.stop', 'function disconnectSource\\(\\)\\{interruptConnection\\(\\);scanner\\.stop');
await writeFile(p,s);
