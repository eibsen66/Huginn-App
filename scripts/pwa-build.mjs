import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join,resolve} from 'node:path';
await import('./pwa-icons.mjs');
const root=new URL('../',import.meta.url),out=resolve(new URL('../dist/pwa/',import.meta.url).pathname.replace(/^\/(?:([A-Za-z]:))/,'$1'));
const files=['export-handoff.mjs','app-update.mjs','flight-size-policy.mjs','flight-stream.mjs','flight-stream-storage.mjs','flight-stream-worker.mjs','flight-stream-client.mjs','stream-export-sw.mjs','flight-progress.mjs','download-progress.mjs','transfer-queue.mjs','settings-v2.mjs','settings.mjs','settings-ui.mjs','settings-package.mjs','download-diagnostics.mjs','wake-guard.mjs','ui-model.mjs','pairing-scanner.mjs','vendor/jsQR-1.4.0.js','vendor/jsQR-LICENSE.txt','_headers','apple-touch-icon.png','index.html','style.css','entry.mjs','version-info.mjs','adapter.mjs','source.mjs','manifest.webmanifest','sw.js','icons/huginn-logo-original.png','icons/icon-192.png','icons/icon-512.png','icons/icon-maskable-512.png','icons/apple-touch-icon.png','fixtures/catalog.json','fixtures/complete.FLG','fixtures/incomplete.FLG','fixtures/ceiling.FLG','flight-evidence.mjs','flight-storage.mjs'];
const hash=b=>createHash('sha256').update(b).digest('hex'),inputs=new Map(),canonical={};
// Classic output remains installable by pre-module registrations. Pin the tool
// and recipe in the identity as well as the unmodified export-module inputs.
const bundler=await import(process.env.HUGINN_ESBUILD_URL||'file:///C:/Users/egill/AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/esbuild/lib/main.js');
if(bundler.version!=='0.28.2')throw Error('WORKER_BUNDLER_VERSION: expected esbuild0.28.2');
canonical['@worker-bundler']=hash(bundler.version);
canonical['@build-recipe']=hash(await readFile(new URL(import.meta.url)));
for(const file of files){
 const path=file==='apple-touch-icon.png'?'pwa/icons/apple-touch-icon.png':(['flight-evidence.mjs', 'flight-storage.mjs', 'flight-size-policy.mjs', 'flight-stream.mjs', 'flight-stream-storage.mjs', 'flight-stream-worker.mjs', 'flight-stream-client.mjs'].includes(file)||file==='settings-package.mjs')?file:'pwa/'+file;
 const raw=await readFile(new URL(path,root));inputs.set(file,raw);canonical[file]=hash(raw);
}
const version=hash(JSON.stringify({schema:'huginn.pwa.canonical-build-v2',files:canonical})).slice(0,16);
await mkdir(out,{recursive:true});const hashes={};
for(const [file,input] of [...inputs].sort(([a],[b])=>(a==='sw.js')-(b==='sw.js'))){
 const raw=['settings.mjs','settings-v2.mjs'].includes(file)?Buffer.from(input.toString().replace("'../settings-package.mjs'","'./settings-package.mjs'")):['index.html','entry.mjs','sw.js'].includes(file)?Buffer.from(input.toString().replaceAll('__HUGINN_BUILD_ID__',version)):input;
 if(file==='sw.js'){
  const bundled=await bundler.build({absWorkingDir:out,stdin:{contents:raw.toString(),resolveDir:out,sourcefile:'sw.js'},bundle:true,write:false,format:'iife',platform:'browser',target:'es2022',define:{'import.meta.url':'self.location.href'}});
  const path=join(out,file);await writeFile(path,bundled.outputFiles[0].contents);hashes[file]=hash(bundled.outputFiles[0].contents);continue;
 }
 const path=join(out,file);await mkdir(resolve(path,'..'),{recursive:true});await writeFile(path,raw);hashes[file]=hash(raw);
}
await writeFile(join(out,'build.json'),JSON.stringify({schema:'huginn.pwa.build',revision:'2.44',version,identity_method:'canonical-build-v2',full_ack_gate_pass:false,files:hashes},null,2)+'\n');
console.log('PWA build '+version+'; ACK false. Native assets untouched.');
