import {readFile,writeFile} from 'node:fs/promises';
let s=await readFile('scripts/prepare-flight-list-diagnostic.mjs','utf8');
s=s.replaceAll('build/flight-list-error-review','build/workflow-recovery-review');
s=s.replace("previous='build/pairing-review/candidate-271f2c06c31e3889'","previous='build/flight-list-error-review/candidate-acc6cd5e4cb6e49d'");
s=s.replace('https://5d7cc058.huginnapp-pwa-test.pages.dev','https://796dd3cf.huginnapp-pwa-test.pages.dev').replace('5d7cc058-f4cc-4c2a-ab1a-d64e6b12f8df','796dd3cf-9ad9-4dca-80db-574976c7630e');
s=s.replace("['source.mjs','settings-ui.mjs','download-diagnostics.mjs','entry.mjs','index.html','sw.js','build.json']","['settings-v2.mjs','settings-ui.mjs','entry.mjs','index.html','sw.js','build.json']");
s=s.replace("['entry.mjs','index.html','sw.js'].includes(p)","['index.html','sw.js'].includes(p)");
s=s.replace("throw Error('Shell/worker logic differs '+p)","throw Error('HTML/worker logic differs '+p)");
await writeFile('scripts/prepare-workflow-recovery.mjs',s,{flag:'wx'});
