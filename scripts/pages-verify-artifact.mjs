// Offline pre-deployment check of the frozen artifact. Does not deploy or rebuild.
import {readFile,readdir} from 'node:fs/promises';import {createHash} from 'node:crypto';
const hash=b=>createHash('sha256').update(b).digest('hex');
const r=JSON.parse(await readFile('build/pages-deployment-review/prepared-artifact.json','utf8'));
const root=r.candidate_directory,raw=await readFile(root+'/build.json'),m=JSON.parse(raw);
if(hash(raw)!==r.candidate_manifest_sha256||m.version!==r.candidate_build||m.full_ack_gate_pass!==false)throw Error('Candidate identity changed');
async function list(prefix=''){const files=[];for(const d of await readdir(root+'/'+prefix,{withFileTypes:true})){const p=prefix+d.name;if(d.isDirectory())files.push(...await list(p+'/'));else files.push(p);}return files;}
const actual=await list(),expected=[...Object.keys(m.files),'build.json'];
if(JSON.stringify(actual.sort())!==JSON.stringify(expected.sort()))throw Error('Candidate file inventory changed');
for(const [file,expectedHash]of Object.entries(m.files)){if(file.includes('..')||!/^[-A-Za-z0-9_./]+$/.test(file))throw Error('Unsafe path');if(hash(await readFile(root+'/'+file))!==expectedHash)throw Error('Candidate asset changed: '+file);}
for(const file of ['index.html','entry.mjs','sw.js'])if(!(await readFile(root+'/'+file,'utf8')).includes(m.version))throw Error('Build stamp missing: '+file);
console.log('PASS frozen '+m.version+'; '+actual.length+' files; SHA256(build.json)='+hash(raw)+'; origin='+r.origin+'; no deployment performed');
