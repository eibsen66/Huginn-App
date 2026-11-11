import {readFile,writeFile} from 'node:fs/promises';
let s=await readFile('scripts/prepare-workflow-recovery.mjs','utf8');
s=s.replaceAll('build/workflow-recovery-review','build/immediate-edit-preview-review');
s=s.replace("previous='build/flight-list-error-review/candidate-acc6cd5e4cb6e49d'","previous='build/workflow-recovery-review/candidate-4408c1fe2f4cc02e'");
s=s.replaceAll('https://796dd3cf.huginnapp-pwa-test.pages.dev','https://6d03282f.huginnapp-pwa-test.pages.dev').replaceAll('796dd3cf-9ad9-4dca-80db-574976c7630e','6d03282f-a671-4de1-b83c-159cc87b28f5');
s=s.replace("['settings-v2.mjs','settings-ui.mjs','entry.mjs','index.html','sw.js','build.json']","['settings-ui.mjs','entry.mjs','index.html','sw.js','build.json']");
s=s.replace("['index.html','sw.js'].includes(p)","['entry.mjs','index.html','sw.js'].includes(p)");
await writeFile('scripts/prepare-immediate-editor.mjs',s,{flag:'wx'});
