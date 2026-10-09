import {mkdir,copyFile,readFile,writeFile} from 'node:fs/promises';
const root=new URL('../',import.meta.url), dest=new URL('dist/mobile/',root);
await mkdir(dest,{recursive:true});
const files=['index.html','style.css','app.js','settings-package.mjs','status-package.mjs','direct-status-receive.mjs','muninn-status-transfer.mjs','flight-evidence.mjs','flight-mobile.mjs','flight-courier.mjs','mobile/trust/dev/huginn_dev_root_ca_cert.pem','mobile/trust/dev/huginn_dev_root_ca.cer','mobile/qualification.json','mobile/trust/profiles.json','mobile/schema.sql','mobile/fixture-runner.mjs','tests/fixtures/flight-v1-vectors.json'];
for(const file of files){await mkdir(new URL(file.includes('/')?file.slice(0,file.lastIndexOf('/')+1):'.',dest),{recursive:true});await copyFile(new URL(file,root),new URL(file,dest));}
// Packaged UI uses the same source. Local diagnostics load only in this generated entry point.
let html=await readFile(new URL('index.html',dest),'utf8');
html=html.replace('</body>','  <script type="module" src="mobile/entry.mjs"></script>\n</body>');
await writeFile(new URL('index.html',dest),html);
await copyFile(new URL('mobile/entry.mjs',root),new URL('mobile/entry.mjs',dest));
console.log('Bundled static assets; no remote server.url.');
