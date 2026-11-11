import {readFile,writeFile,mkdir} from 'node:fs/promises';
let s=await readFile('tests/pwa-field-save-browser.test.mjs','utf8');s=s.replace('per-field and bulk saves, late edits, uncertain writes and explicit reconciliation','fresh-read admission, drafts and independent diagnostics with save recovery');
s=s.replace("if(globalThis.failRead&&path==='/api/v2/settings')", "if(globalThis.partialRead&&path==='/api/v2/settings'){let once=false;return new Response(new ReadableStream({pull(c){if(!once){once=true;c.enqueue(new Uint8Array(4096).fill(32));}else c.error(TypeError('fixture interrupted GET'));}}),{status:200,headers:{'Content-Length':'29503'}});}if(globalThis.failRead&&path==='/api/v2/settings')");
const marker="  await edit(bright,50);await evaluate('globalThis.rejectAuth=true;globalThis.breakApply=false');";
if(!s.includes(marker))throw Error('Browser insertion context changed');
s=s.replace(marker,`  // A failed normal refresh must not silently preserve write authority.
  const postsBefore=await applies();await edit(bright,54);await edit(reg,'FRESH-DRAFT');
  await evaluate("globalThis.partialRead=true;document.querySelector('#settings-load').click()");await done();
  assert.match(await evaluate("document.querySelector('#settings-message').textContent"),/Áður sótt — nýr lestur mistókst/);
  assert.equal(await evaluate("document.querySelector('#settings-apply').disabled"),true);assert.equal(await evaluate("[...document.querySelectorAll('[data-save-field]')].every(b=>b.disabled)"),true);
  assert.equal(await evaluate("document.querySelector('[data-settings-field=\\"display.brightness_percent\\"]').value"),'54');assert.equal(await evaluate("document.querySelector('[data-settings-field=\\"aircraft.registration\\"]').value"),'FRESH-DRAFT');
  await edit(bright,53);assert.match(await status(bright),/Áður sótt — nýr lestur mistókst/);assert.equal(await evaluate("document.querySelector('#settings-apply').disabled"),true);
  // A diagnostic GET may succeed, but must not update editor values or reopen
  // either save action. Failure/success are separately named in the summary.
  await evaluate("globalThis.partialRead=false;document.querySelector('#settings-diagnose').click()");await done();
  assert.match(await evaluate("document.querySelector('#settings-diagnostic-result').textContent"),/Stillingalestur í greiningu: tókst/);assert.equal(await evaluate("document.querySelector('#settings-apply').disabled"),true);
  await evaluate("globalThis.partialRead=true;document.querySelector('#settings-diagnose').click()");await done();assert.match(await evaluate("document.querySelector('#settings-diagnostic-result').textContent"),/Stillingalestur í greiningu: mistókst/);assert.equal(await evaluate("document.querySelector('#settings-apply').disabled"),true);
  await evaluate("globalThis.partialRead=false;document.querySelector('#settings-load').click()");await done();
  assert.equal(await evaluate("document.querySelector('#settings-apply').disabled"),false);assert.equal(await evaluate("document.querySelector('[data-save-field=\\"display.brightness_percent\\"]').disabled"),false);assert.equal(await applies(),postsBefore);
  assert.equal(await evaluate("document.querySelector('[data-settings-field=\\"aircraft.registration\\"]').value"),'FRESH-DRAFT');
  await evaluate("globalThis.breakPreview=false;document.querySelector('#settings-preview-diagnose').click()");await done();assert.match(await evaluate("document.querySelector('#settings-diagnostic-result').textContent"),/Óvaranleg POST-staðfesting tókst/);assert.equal(await applies(),postsBefore);assert.equal(await evaluate("document.querySelector('[data-settings-field=\\"aircraft.registration\\"]').value"),'FRESH-DRAFT');
  await evaluate("globalThis.breakPreview=true;document.querySelector('#settings-preview-diagnose').click()");await done();assert.match(await evaluate("document.querySelector('#settings-diagnostic-result').textContent"),/Óvaranleg POST-staðfesting mistókst/);assert.equal(await applies(),postsBefore);await evaluate('globalThis.breakPreview=false');
  // A pending custom topology has fields absent from the authoritative GET.
  // They must survive both the failed refresh and the later valid refresh.
  await evaluate("{const f=document.querySelector('[data-settings-field=\\"parameters.1.enabled\\"]');f.checked=false;f.dispatchEvent(new Event('input',{bubbles:true}));}");
  await wait("!document.querySelector('[data-settings-field=\\"parameters.1.topology\\"]').disabled");
  await evaluate("{const f=document.querySelector('[data-settings-field=\\"parameters.1.topology\\"]');f.value=JSON.stringify('RGR');f.dispatchEvent(new Event('input',{bubbles:true}));}");
  await wait("!!document.querySelector('[data-settings-field=\\"parameters.1.boundary.1\\"]')");
  await evaluate("{const lo=Number(document.querySelector('[data-settings-field=\\"parameters.1.min\\"]').value),hi=Number(document.querySelector('[data-settings-field=\\"parameters.1.max\\"]').value);globalThis.boundaryValues=[];for(let i=0;i<2;i++){const f=document.querySelector('[data-settings-field=\\"parameters.1.boundary.'+i+'\\"]');f.value=String(lo+Math.floor((hi-lo)*(i+1)/3));boundaryValues.push(f.value);f.dispatchEvent(new Event('input',{bubbles:true}));}}");
  await evaluate("globalThis.partialRead=true;document.querySelector('#settings-load').click()");await done();assert.equal(await evaluate("document.querySelector('#settings-apply').disabled"),true);
  await evaluate("globalThis.partialRead=false;document.querySelector('#settings-load').click()");await done();
  assert.deepEqual(await evaluate("[0,1].map(i=>document.querySelector('[data-settings-field=\\"parameters.1.boundary.'+i+'\\"]').value)"),await evaluate('boundaryValues'));assert.equal(await applies(),postsBefore);
`+marker);
s=s.replaceAll('build/field-save-review/screenshots/','build/freshness-review/screenshots/');await writeFile('tests/pwa-freshness-browser.test.mjs',s);
