import {readFile,writeFile,mkdir} from 'node:fs/promises';
let source=await readFile('tests/pwa-settings-browser.test.mjs','utf8');source=source.slice(0,source.indexOf('  await evaluate(`globalThis.calls='));
source=source.replace("active PWA settings, synthetic transport and temporary browser storage","one explicit Save with serialized automatic validation and authoritative reconciliation").replace('timeout:45000','timeout:90000').replace('let deviceBusy=true','let deviceBusy=false');
await mkdir('build/one-save-review/screenshots',{recursive:true});await writeFile('tests/pwa-one-save-browser.test.mjs',source+await readFile('protocol/one-save-browser-tail.js','utf8'));
