import {readFile,writeFile} from 'node:fs/promises';
let s=await readFile('scripts/prepare-immediate-editor-final.mjs','utf8');
s=s.replaceAll('build/immediate-edit-preview-final','build/one-save-review')
 .replace("previous='build/immediate-edit-preview-review/candidate-9371c1e32e8e0be9'","previous='build/immediate-edit-preview-final/candidate-a891e07022384c69'")
 .replaceAll('https://c3b8348c.huginnapp-pwa-test.pages.dev','https://ff580b82.huginnapp-pwa-test.pages.dev')
 .replaceAll('c3b8348c-ce8f-4cbe-b84e-e680af7a2dae','ff580b82-8aed-43b8-9a59-6fa9bdd1911b')
 .replaceAll('focused-tests.log','final-focused-tests.log')
 .replace("['settings-ui.mjs','entry.mjs','index.html','sw.js','build.json']","['settings-ui.mjs','settings-v2.mjs','entry.mjs','index.html','sw.js','build.json']")
 .replace("['entry.mjs','index.html','sw.js'].includes(p)","['entry.mjs','sw.js'].includes(p)")
 .replace(/const log=await readFile\(out\+'\/final-focused-tests.log','utf8'\),tests=.*?;if\(!tests\|\|.*?throw Error\('Focused tests did not pass'\);/,"const log=await readFile(out+'/final-focused-tests.log','utf8'),tests=Number(/tests (\\d+)/.exec(log)?.[1]);if(!tests||!/fail 0/.test(log))throw Error('Focused tests did not pass');");
await writeFile('scripts/prepare-one-save-review.mjs',s);
