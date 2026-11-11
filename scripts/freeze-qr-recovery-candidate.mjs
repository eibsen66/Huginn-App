// Local freeze/verification only. No network, deployment or device access.
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const out='build/qr-recovery-review',sha=b=>createHash('sha256').update(b).digest('hex');
async function inventory(root,prefix=''){let names=[];for(const d of await readdir(root+'/'+prefix,{withFileTypes:true})){const name=prefix+d.name;names.push(...(d.isDirectory()?await inventory(root,name+'/'):[name]));}return names.sort();}
async function verify(r){assert.deepEqual(await inventory(r.directory),Object.keys(r.files).sort());assert.equal(Object.keys(r.files).length,32);for(const [p,f]of Object.entries(r.files)){const b=await readFile(r.directory+'/'+p);assert.equal(b.length,f.bytes,p);assert.equal(sha(b),f.sha256,p);}assert.equal(sha(await readFile(out+'/focused-tests.log')),r.test_log_sha256);console.log(JSON.stringify({build:r.build,directory:r.directory,files:32,build_json_sha256:r.files['build.json'].sha256,deployed:false},null,2));}
if(process.argv.includes('--verify')){await verify(JSON.parse(await readFile(out+'/reviewed-candidate.json')));process.exit(0);}
const baseline='build/freshness-review/candidate-efbccf3990a4390c',old=JSON.parse(await readFile(baseline+'/build.json')),manifest=JSON.parse(await readFile('dist/pwa/build.json'));
assert.equal(old.version,'efbccf3990a4390c');assert.equal(manifest.full_ack_gate_pass,false);
const log=await readFile(out+'/focused-tests.log');const text=log.toString('utf16le');assert.match(text,/tests 20/);assert.match(text,/pass 20/);assert.match(text,/fail 0/);assert.match(text,/cancelled 0/);
const directory='C:/HuginnAPP/'+out+'/candidate-'+manifest.version;await mkdir(directory,{recursive:false});const files={},changed=[];
for(const p of [...Object.keys(manifest.files),'build.json']){const b=await readFile('dist/pwa/'+p),prior=await readFile(baseline+'/'+p);if(p!=='build.json'){assert.equal(sha(b),manifest.files[p],p);assert.equal(sha(prior),old.files[p],p);}if(!b.equals(prior)){changed.push(p);assert(['entry.mjs','index.html','sw.js','build.json'].includes(p),'Unrelated asset changed: '+p);}if(p==='sw.js')assert.equal(b.toString().replaceAll(manifest.version,old.version),prior.toString(),'Worker behavior unchanged');await mkdir(directory+'/'+p.split('/').slice(0,-1).join('/'),{recursive:true});await writeFile(directory+'/'+p,b,{flag:'wx'});files[p]={bytes:b.length,sha256:sha(b)};}
const receipt={prepared_utc:new Date().toISOString(),build:manifest.version,directory,files,changed_assets:changed,baseline_build:old.version,baseline_directory:baseline,tests:20,test_log_sha256:sha(log),historical_firmware_head:'FAILED historically; guard unchanged; not rerun or counted passed',physical_iphone_validation:false,no_device_operations:true,deployed:false};
await writeFile(out+'/reviewed-candidate.json',JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});await verify(receipt);
