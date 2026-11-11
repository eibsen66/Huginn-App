// Freeze/verify an exact PWA candidate; never uploads or changes firmware.
import {readFile,writeFile,mkdir,readdir,access} from 'node:fs/promises';import {createHash} from 'node:crypto';
const out='build/workflow-recovery-review',sha=b=>createHash('sha256').update(b).digest('hex');
const read=async p=>JSON.parse(await readFile(p));
async function inventory(root,prefix=''){let rows=[];for(const d of await readdir(root+'/'+prefix,{withFileTypes:true})){const p=prefix+d.name;if(d.isDirectory())rows.push(...await inventory(root,p+'/'));else rows.push(p);}return rows.sort();}
async function verify(r){
 const names=await inventory(r.directory);if(names.length!==32||JSON.stringify(names)!==JSON.stringify(Object.keys(r.files).sort()))throw Error('Frozen inventory mismatch');
 for(const [p,h]of Object.entries(r.files)){const b=await readFile(r.directory+'/'+p);if(sha(b)!==h.sha256||b.length!==h.bytes)throw Error('Candidate hash mismatch '+p);}
 if(sha(await readFile(out+'/focused-tests.log'))!==r.focused_test_log_sha256)throw Error('Test receipt changed');
 const rollback=await read(r.rollback_directory+'/build.json');for(const [p,h]of Object.entries(rollback.files))if(sha(await readFile(r.rollback_directory+'/'+p))!==h)throw Error('Rollback mismatch '+p);
 if(sha(await readFile(r.firmware_artifact))!==r.firmware_sha256)throw Error('Retained Rev. 2.7 artifact changed');
 console.log(JSON.stringify({build:r.build,files:names.length,directory:r.directory,build_json_sha256:r.files['build.json'].sha256,focused_tests:r.focused_tests,deployed:false},null,2));
}
if(process.argv.includes('--verify')){await verify(await read(out+'/candidate-review.json'));process.exit(0);}
const liveOrigin='https://huginnapp-pwa-test.pages.dev',previous='build/flight-list-error-review/candidate-acc6cd5e4cb6e49d';
const baseline=await read(previous+'/build.json');
async function publicGet(url){const r=await fetch(url,{signal:AbortSignal.timeout(30000),redirect:'error',headers:{'Cache-Control':'no-cache'}});if(r.status!==200)throw Error('Public GET HTTP '+r.status);return Buffer.from(await r.arrayBuffer());}
const publicRaw=await publicGet(liveOrigin+'/build.json'),publicManifest=JSON.parse(publicRaw);
if(publicManifest.version!==baseline.version||!publicRaw.equals(await readFile(previous+'/build.json')))throw Error('Live build differs from retained rollback baseline; inspect before freezing');
const immutable='https://796dd3cf.huginnapp-pwa-test.pages.dev';if(!(await publicGet(immutable+'/build.json')).equals(publicRaw))throw Error('Recorded immutable rollback differs');
const m=await read('dist/pwa/build.json');if(m.full_ack_gate_pass!==false)throw Error('NO-ACK changed');
const log=await readFile(out+'/focused-tests.log','utf8'),tests=Number(/ℹ tests (\d+)/.exec(log)?.[1]);if(!tests||!/ℹ fail 0/.test(log))throw Error('Focused tests did not pass');
const directory='C:/HuginnAPP/'+out+'/candidate-'+m.version,rollbackDirectory='C:/HuginnAPP/'+out+'/rollback-'+baseline.version;
await mkdir(directory,{recursive:false});await mkdir(rollbackDirectory,{recursive:false});
const changed=[],files={};
for(const p of [...Object.keys(m.files),'build.json']){
 const b=await readFile('dist/pwa/'+p);if(p!=='build.json'&&sha(b)!==m.files[p])throw Error('Build manifest mismatch '+p);
 await mkdir(directory+'/'+p.split('/').slice(0,-1).join('/'),{recursive:true});await writeFile(directory+'/'+p,b);files[p]={bytes:b.length,sha256:sha(b)};
 const old=await readFile(previous+'/'+p);if(p!=='build.json'&&sha(old)!==baseline.files[p])throw Error('Rollback baseline changed '+p);
 await mkdir(rollbackDirectory+'/'+p.split('/').slice(0,-1).join('/'),{recursive:true});await writeFile(rollbackDirectory+'/'+p,old);
 if(!b.equals(old))changed.push(p);
 if(!['settings-v2.mjs','settings-ui.mjs','entry.mjs','index.html','sw.js','build.json'].includes(p)&&!b.equals(old))throw Error('Unrelated asset differs '+p);
 if(['index.html','sw.js'].includes(p)&&b.toString().replaceAll(m.version,baseline.version)!==old.toString())throw Error('HTML/worker logic differs '+p);
}
const firmware='C:/HuginnEIS/Huginn/Firmware/huginn/build-rev2.7-20261105/lvgl_porting.bin',firmwareHash=sha(await readFile(firmware));
if(firmwareHash!=='3e19713449125cf1ec927159e0c280722fc0392733d18cd1b095392fe09be3c4')throw Error('Retained Rev. 2.7 image mismatch');
const wrangler='C:/Users/egill/AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/wrangler/bin/wrangler.js';await access(wrangler);
const receipt={prepared_utc:new Date().toISOString(),build:m.version,directory,files,changed_assets:changed,focused_tests:tests,focused_test_log_sha256:sha(Buffer.from(log)),origin:liveOrigin,live_build_checked:publicManifest.version,live_manifest_sha256:sha(publicRaw),rollback_directory:rollbackDirectory,rollback_deployment_last_recorded:'796dd3cf-9ad9-4dca-80db-574976c7630e',rollback_immutable_manifest_checked:immutable,cloudflare_api_identity_requeried:false,account:'afc733ae88054c22d7214b083132bfbc',project:'huginnapp-pwa-test',branch:'main',wrangler,firmware_artifact:firmware,firmware_sha256:firmwareHash,deployed:false,historical_firmware_head:'FAILED; unchanged; not included as passed'};
await writeFile(out+'/candidate-review.json',JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});await verify(receipt);
