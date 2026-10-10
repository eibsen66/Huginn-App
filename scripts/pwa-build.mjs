import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join,resolve} from 'node:path';
await import('./pwa-icons.mjs');
const root=new URL('../',import.meta.url),out=resolve(new URL('../dist/pwa/',import.meta.url).pathname.replace(/^\/(?:([A-Za-z]:))/,'$1'));
const files=['apple-touch-icon.png','index.html','style.css','entry.mjs','version-info.mjs','adapter.mjs','manifest.webmanifest','sw.js','icons/huginn-logo-original.png','icons/icon-192.png','icons/icon-512.png','icons/icon-maskable-512.png','icons/apple-touch-icon.png','fixtures/catalog.json','fixtures/complete.FLG','fixtures/incomplete.FLG','fixtures/ceiling.FLG','flight-evidence.mjs','flight-storage.mjs'];
const hash=b=>createHash('sha256').update(b).digest('hex'),inputs=new Map(),canonical={};
for(const file of files){
 const path=file==='apple-touch-icon.png'?'pwa/icons/apple-touch-icon.png':file.startsWith('flight-')?file:'pwa/'+file;
 const raw=await readFile(new URL(path,root));inputs.set(file,raw);canonical[file]=hash(raw);
}
const version=hash(JSON.stringify({schema:'huginn.pwa.canonical-build-v2',files:canonical})).slice(0,16);
await mkdir(out,{recursive:true});const hashes={};
for(const [file,input] of inputs){
 const raw=['index.html','entry.mjs','sw.js'].includes(file)?Buffer.from(input.toString().replaceAll('__HUGINN_BUILD_ID__',version)):input;
 const path=join(out,file);await mkdir(resolve(path,'..'),{recursive:true});await writeFile(path,raw);hashes[file]=hash(raw);
}
await writeFile(join(out,'build.json'),JSON.stringify({schema:'huginn.pwa.build',version,identity_method:'canonical-build-v2',full_ack_gate_pass:false,files:hashes},null,2)+'\n');
console.log('PWA build '+version+'; ACK false. Native assets untouched.');
