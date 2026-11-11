import {readFile,readdir} from 'node:fs/promises';import {createHash} from 'node:crypto';
const hash=b=>createHash('sha256').update(b).digest('hex'),r=JSON.parse(await readFile('build/pairing-review/candidate-review.json','utf8'));
async function list(prefix=''){const result=[];for(const d of await readdir(r.directory+'/'+prefix,{withFileTypes:true})){if(d.isDirectory())result.push(...await list(prefix+d.name+'/'));else if(d.isFile())result.push(prefix+d.name);else throw Error('Unexpected entry');}return result;}
if(r.build!=='271f2c06c31e3889'||Object.keys(r.files).length!==32||JSON.stringify((await list()).sort())!==JSON.stringify(Object.keys(r.files).sort()))throw Error('Inventory mismatch');
for(const [p,h]of Object.entries(r.files)){const b=await readFile(r.directory+'/'+p);if(hash(b)!==h.sha256||b.length!==h.bytes)throw Error('Candidate mismatch '+p);}
if(hash(await readFile('build/pairing-review/focused-tests.log'))!==r.test_log_sha256||hash(await readFile('protocol/pairing-ui-rev25.patch'))!==r.firmware_patch_sha256)throw Error('Review evidence changed');
console.log('PASS '+r.build+': 32 exact files, 69-test receipt, focused firmware patch. No rebuild/deployment. Historical FIRMWARE_HEAD remains failed.');
