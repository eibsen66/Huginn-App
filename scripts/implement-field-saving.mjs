import {readFile,writeFile,mkdir} from 'node:fs/promises';
const out='build/field-save-review';await mkdir(out,{recursive:true});
const old=await readFile('pwa/settings-ui.mjs','utf8');await writeFile(out+'/settings-ui.before.mjs',old,{flag:'wx'});
const render=old.slice(old.indexOf(' function renderV2(){'),old.indexOf('\n reset();return'));
const diagnostic=old.slice(old.indexOf(' function diagnostic('),old.indexOf(" text('settings-diagnose'"));
const body=await readFile('protocol/field-save-ui.js','utf8');
await writeFile('pwa/settings-ui.mjs',body.replace('/* DIAGNOSTIC */',diagnostic).replace('/* RENDER */',render));
let html=await readFile('pwa/index.html','utf8');await writeFile(out+'/index.before.html',html,{flag:'wx'});html=html.replace('disabled>Vista breytingar</button>','disabled>Vista allar breytingar</button>');await writeFile('pwa/index.html',html);
