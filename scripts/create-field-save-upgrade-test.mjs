import {readFile,writeFile} from 'node:fs/promises';
let s=await readFile('tests/pwa-update-recovery.test.mjs','utf8');
s=s.replace('P2 real service-worker replacement and offline recovery','actual older two-step shell upgrades to per-field saving with data and offline recovery intact');
s=s.replace("let body=await readFile(new URL('dist/pwa/'+file,root));","let body=await readFile(new URL((version==='A'?'build/immediate-edit-preview-final/candidate-a891e07022384c69/':'dist/pwa/')+file,root));");
s=s.replace("results.push({tests:'A/B',pass:true,version:'A',rows:3});", "assert.equal(await evaluate(\"!!document.querySelector('#settings-preview')\"),true);assert.match(versions.get('A').get('/settings-ui.mjs').toString(),/Forskoða breytingar/);results.push({tests:'A/B',pass:true,version:'A',rows:3});");
s=s.replace("results.push({test:'K',pass:true,version:'A',waiting:true});","assert.equal(await evaluate(\"!!document.querySelector('#settings-preview')\"),true);results.push({test:'K',pass:true,version:'A',waiting:true});");
s=s.replace("const cacheB=await evaluate('caches.keys()');", "assert.equal(await evaluate(\"document.querySelector('#settings-preview')===null\"),true);assert.equal(await evaluate(\"document.querySelector('#settings-apply').textContent\"),'Vista allar breytingar');assert.match(versions.get('B').get('/settings-ui.mjs').toString(),/Vista breytingu/);const cacheB=await evaluate('caches.keys()');");
s=s.replace("new URL('build/p2/',root)","new URL('build/field-save-review/upgrade/',root)").replaceAll("build/p2/","build/field-save-review/upgrade/");
await writeFile('tests/pwa-field-save-upgrade.test.mjs',s);
