// Local-only artifact freeze; no Cloudflare or device operations.
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';import {createHash} from 'node:crypto';
const hash=b=>createHash('sha256').update(b).digest('hex');
const raw=await readFile('dist/pwa/build.json'),m=JSON.parse(raw),root=process.argv[3]||'build/settings-retrieval-review',dest=root+'/candidate-'+m.version;
const previous=process.argv[2]||'build/pages-deployment-review/candidate-99272816b3082d1a',old=JSON.parse(await readFile(previous+'/build.json','utf8'));
if(m.full_ack_gate_pass!==false||Object.keys(m.files).length!==31)throw Error('Unexpected artifact contract');
await mkdir(dest,{recursive:true});
for(const file of [...Object.keys(m.files),'build.json']){if(file.includes('..')||!/^[-A-Za-z0-9_./]+$/.test(file))throw Error('Unsafe path');const data=await readFile('dist/pwa/'+file);if(file!=='build.json'&&hash(data)!==m.files[file])throw Error('Hash mismatch '+file);const target=dest+'/'+file;await mkdir(target.slice(0,target.lastIndexOf('/')),{recursive:true});await writeFile(target,data);}
async function list(path,prefix=''){const files=[];for(const d of await readdir(path+'/'+prefix,{withFileTypes:true})){const p=prefix+d.name;if(d.isDirectory())files.push(...await list(path,p+'/'));else files.push(p);}return files;}
const files=await list(dest),expected=[...Object.keys(m.files),'build.json'];if(JSON.stringify(files.sort())!==JSON.stringify(expected.sort()))throw Error('Unexpected artifact files');
for(const [file,h]of Object.entries(m.files))if(hash(await readFile(dest+'/'+file))!==h)throw Error('Frozen hash mismatch '+file);
const preserved=[];for(const file of Object.keys(old.files))if(file.startsWith('icons/')||file.startsWith('fixtures/')||['apple-touch-icon.png','manifest.webmanifest','flight-storage.mjs','adapter.mjs'].includes(file)){if(old.files[file]!==m.files[file])throw Error('Preservation boundary changed '+file);preserved.push(file);}
const receipt={prepared_utc:new Date().toISOString(),build:m.version,directory:dest,files:files.length,manifest_sha256:hash(raw),previous_reviewed_build:old.version,preserved,settings_fields_protected:true,full_ack_gate_pass:false,deployed:false,firmware_changed:false};
await writeFile(root+'/prepared.json',JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt,null,2));
