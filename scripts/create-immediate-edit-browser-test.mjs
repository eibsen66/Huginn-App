import {readFile,writeFile} from 'node:fs/promises';
let s=await readFile('tests/pwa-settings-browser.test.mjs','utf8');
s=s.replace('active PWA settings, synthetic transport and temporary browser storage','input without blur, invalid drafts, stable focus/caret, and exact preview gating');
s=s.replace('startServer({testHttp:true,port:0})',"startServer({testHttp:true,port:0,...process.env.HUGINN_IMMEDIATE_BASELINE?{root:'C:/HuginnAPP/build/immediate-edit-preview-review/candidate-9371c1e32e8e0be9'}:{}})");
const anchor='  assert.equal(await evaluate("document.querySelectorAll(\'[data-settings-section]\').length")';const at=s.indexOf(anchor);if(at<0)throw Error('fixture anchor');
s=s.slice(0,at)+`
  await evaluate(\`globalThis.editInput=document.querySelector('[data-settings-field="display.brightness_percent"]');globalThis.editValue=Number(editInput.value)===80?'79':'80';editInput.focus();editInput.value=editValue;editInput.dispatchEvent(new Event('input',{bubbles:true}));\`);
  await wait("!document.querySelector('#settings-preview').disabled");
  assert.equal(await evaluate("document.activeElement===editInput&&editInput===document.querySelector('[data-settings-field=\\\"display.brightness_percent\\\"]')"),true);
  assert.match(await evaluate("document.querySelector('#settings-message').textContent"),/í bið í símanum/);
  await evaluate("document.querySelector('#settings-preview').click()");await wait("!document.querySelector('#settings-apply').disabled");
  await evaluate("editInput.focus();editInput.value='';editInput.dispatchEvent(new Event('input',{bubbles:true}))");
  assert.equal(await evaluate("editInput.value===''&&document.activeElement===editInput&&document.querySelector('#settings-preview').disabled&&document.querySelector('#settings-apply').disabled"),true);
  await evaluate(\`globalThis.registrationInput=document.querySelector('[data-settings-field="aircraft.registration"]');registrationInput.focus();registrationInput.value='LOCAL';registrationInput.setSelectionRange(2,2);registrationInput.dispatchEvent(new Event('input',{bubbles:true}));\`);
  await new Promise(r=>setTimeout(r,20));
  assert.equal(await evaluate("document.activeElement===registrationInput&&registrationInput.selectionStart===2&&editInput.value===''&&document.querySelector('#settings-preview').disabled"),true);
  await evaluate("editInput.focus();editInput.value='101';editInput.dispatchEvent(new Event('input',{bubbles:true}))");
  assert.equal(await evaluate("editInput.value==='101'&&document.querySelector('#settings-preview').disabled"),true);
  await evaluate("editInput.value=editValue;editInput.dispatchEvent(new Event('input',{bubbles:true}))");await wait("!document.querySelector('#settings-preview').disabled");
  // Structural text edits update dependent rows without replacing the active
  // input or moving its caret/keyboard focus.
  await evaluate(\`globalThis.engineInput=document.querySelector('[data-settings-field="engine.name"]');engineInput.focus();engineInput.value='OWNER TEST';engineInput.setSelectionRange(3,3);engineInput.dispatchEvent(new Event('input',{bubbles:true}));\`);
  await new Promise(r=>setTimeout(r,20));assert.equal(await evaluate("document.activeElement===engineInput&&engineInput.selectionStart===3&&engineInput===document.querySelector('[data-settings-field=\\\"engine.name\\\"]')"),true);
  await evaluate(\`globalThis.checkInput=document.querySelector('[data-settings-field="display.auto_brightness"]');checkInput.checked=!checkInput.checked;checkInput.dispatchEvent(new Event('input',{bubbles:true}));globalThis.selectInput=document.querySelector('[data-settings-field="units.speed"]');selectInput.selectedIndex=(selectInput.selectedIndex+1)%selectInput.options.length;selectInput.dispatchEvent(new Event('input',{bubbles:true}));\`);
  await wait("!document.querySelector('#settings-preview').disabled");
  await evaluate("document.querySelector('#settings-preview').click()");await wait("!document.querySelector('#settings-apply').disabled");
  const previewCount=await evaluate("calls.filter(p=>p.endsWith('/preview')).length");
  await evaluate("selectInput.dispatchEvent(new Event('change',{bubbles:true}))");
  assert.equal(await evaluate("document.querySelector('#settings-apply').disabled"),false,'duplicate native change must not invalidate an already handled input');
  assert.equal(await evaluate("calls.filter(p=>p.endsWith('/preview')).length"),previewCount);
  await evaluate(\`{const enabled=document.querySelector('[data-settings-field="parameters.1.enabled"]');enabled.checked=false;enabled.dispatchEvent(new Event('input',{bubbles:true}));}\`);
  await wait("!document.querySelector('[data-settings-field=\\\"parameters.1.topology\\\"]').disabled");
  await evaluate(\`globalThis.topologyInput=document.querySelector('[data-settings-field="parameters.1.topology"]');topologyInput.value=JSON.stringify('RGR');topologyInput.dispatchEvent(new Event('input',{bubbles:true}));\`);
  await wait("!!document.querySelector('[data-settings-field=\\\"parameters.1.boundary.0\\\"]')");
  await evaluate(\`{const boundary=document.querySelector('[data-settings-field="parameters.1.boundary.0"]');boundary.value='999999999';boundary.dispatchEvent(new Event('input',{bubbles:true}));}topologyInput.value=JSON.stringify('');topologyInput.dispatchEvent(new Event('input',{bubbles:true}));\`);
  await wait("!document.querySelector('[data-settings-field=\\\"parameters.1.boundary.0\\\"]')");
  assert.equal(await evaluate("document.querySelector('#settings-preview').disabled"),false,'Removed fields must not retain invalid markers');
  // Discard only this disposable test draft by a fresh explicit GET, before
  // running the original remaining regression cases.
  await evaluate("document.querySelector('#settings-load').click()");await wait("document.querySelectorAll('[data-settings-field]').length>120&&!document.querySelector('#settings-load').disabled");
`+s.slice(at);
await writeFile('tests/pwa-immediate-edit-browser.test.mjs',s);
