import {mkdir,copyFile,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join,resolve} from 'node:path';
const root=new URL('../',import.meta.url),out=resolve(new URL('../dist/pwa/',import.meta.url).pathname.replace(/^\/(?:([A-Za-z]:))/,'$1'));
const files=['index.html','style.css','entry.mjs','adapter.mjs','manifest.webmanifest','sw.js','icons/icon-192.png','icons/icon-512.png','icons/icon-maskable-512.png','icons/apple-touch-icon.png','fixtures/catalog.json','fixtures/complete.FLG','fixtures/incomplete.FLG','fixtures/ceiling.FLG'];
await mkdir(out,{recursive:true});
const hashes={};
for(const file of [...files,'flight-evidence.mjs','flight-storage.mjs']){
  const source=new URL(file.startsWith('flight-')?file:'pwa/'+file,root);
  const target=join(out,file);await mkdir(resolve(target,'..'),{recursive:true});await copyFile(source,target);
  hashes[file]=createHash('sha256').update(await readFile(target)).digest('hex');
}
const version=createHash('sha256').update(JSON.stringify(hashes)).digest('hex').slice(0,16);
const sw=await readFile(join(out,'sw.js'),'utf8');
await writeFile(join(out,'sw.js'),sw.replace("'huginn-pwa-p1-v1'",JSON.stringify('huginn-pwa-p1-'+version)));
hashes['sw.js']=createHash('sha256').update(await readFile(join(out,'sw.js'))).digest('hex');
await writeFile(join(out,'build.json'),JSON.stringify({schema:'huginn.pwa.build',version,full_ack_gate_pass:false,files:hashes},null,2)+'\n');
console.log('PWA build '+version+' → '+out+'; ACK false. Native assets untouched.');
