import {readFile,writeFile} from 'node:fs/promises';import {createHash} from 'node:crypto';
const out='C:/HuginnAPP/build/rev28-review',r=JSON.parse(await readFile(out+'/source-changes.json')),sha=b=>createHash('sha256').update(b).digest('hex');
for(const p of r.paths)if(sha(await readFile(r.root+'/'+p))!==r.before[p])throw Error('Source context changed '+p);
for(const p of r.paths){const b=await readFile(out+'/'+p.replaceAll('/','__')+'.candidate');if(sha(b)!==r.after[p])throw Error('Candidate changed');await writeFile(r.root+'/'+p,b);}
console.log('Applied five focused files; Rev. 2.7 retained artifacts unchanged');
