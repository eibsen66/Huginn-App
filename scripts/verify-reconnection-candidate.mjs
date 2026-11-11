import {readFile,readdir} from 'node:fs/promises';import {createHash} from 'node:crypto';
const r=JSON.parse(await readFile('build/reconnect-review/candidate-review.json','utf8')),hash=b=>createHash('sha256').update(b).digest('hex');
async function list(prefix=''){const files=[];for(const d of await readdir(r.directory+'/'+prefix,{withFileTypes:true})){if(d.isDirectory())files.push(...await list(prefix+d.name+'/'));else if(d.isFile())files.push(prefix+d.name);else throw Error('Unexpected directory entry');}return files;}
if(r.build!=='1902bcca0f2edc78'||Object.keys(r.files).length!==32||JSON.stringify((await list()).sort())!==JSON.stringify(Object.keys(r.files).sort()))throw Error('Inventory changed');
for(const [p,v]of Object.entries(r.files)){const b=await readFile(r.directory+'/'+p);if(b.length!==v.bytes||hash(b)!==v.sha256)throw Error('Candidate changed '+p);}
if(hash(await readFile('build/reconnect-review/focused-tests.log'))!==r.test_log_sha256)throw Error('Test receipt changed');
console.log('PASS frozen '+r.build+'; exact 32 files; reviewed focused-test receipt. Historical FIRMWARE_HEAD test remains failed. No rebuild or deployment.');
