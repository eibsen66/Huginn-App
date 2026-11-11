// Egill's direct 2026-11-02 authorization: source-only application, no builds/device operations.
import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const root='C:/HuginnEIS',out='C:/HuginnAPP/build/settings-applied-review';
const git=(...args)=>execFileSync('git',['-c','safe.directory='+root,'-c','core.autocrlf=false','-C',root,...args],{encoding:'utf8',windowsHide:true});
const sha=b=>createHash('sha256').update(b).digest('hex');
const patch='C:/HuginnAPP/protocol/settings-v2-firmware.patch';
const bytes=await readFile(patch),text=bytes.toString('utf8');
const paths=[...text.matchAll(/^\+\+\+ b\/(.+)$/gm)].map(m=>m[1].trim());
if(paths.length!==5||paths.some(p=>!p.startsWith('Huginn/Firmware/huginn/')))throw Error('Unexpected patch scope');
git('apply','--check',patch);
await mkdir(out,{recursive:true});
const files=git('ls-files','--cached','--others','--exclude-standard','-z').split('\0').filter(Boolean);
const before={head:git('rev-parse','HEAD').trim(),branch:git('branch','--show-current').trim(),status:git('status','--porcelain=v1'),index:git('diff','--cached','--binary'),patch_sha256:sha(bytes),files:{}};
for(const p of files){try{before.files[p]=sha(await readFile(root+'/'+p));}catch(e){if(e.code!=='ENOENT')throw e;before.files[p]=null;}}
for(const p of paths){try{const dest=out+'/before/'+p;await mkdir(dest.slice(0,dest.lastIndexOf('/')),{recursive:true});await copyFile(root+'/'+p,dest);}catch(e){if(e.code!=='ENOENT')throw e;}}
await writeFile(out+'/before.json',JSON.stringify(before,null,2),{flag:'wx'});
git('apply',patch);
const after={head:git('rev-parse','HEAD').trim(),branch:git('branch','--show-current').trim(),status:git('status','--porcelain=v1'),files:{},unrelated_changed:[]};
for(const [p,hash] of Object.entries(before.files)){let actual=null;try{actual=sha(await readFile(root+'/'+p));}catch(e){if(e.code!=='ENOENT')throw e;}if(!paths.includes(p)&&actual!==hash)after.unrelated_changed.push(p);}
for(const p of paths){const active=await readFile(root+'/'+p),relative=p.slice('Huginn/Firmware/huginn/'.length);const proposed=await readFile('C:/HuginnAPP/build/settings-proposed/'+relative);if(!active.equals(proposed))throw Error('Applied/proposed mismatch '+p);after.files[p]=sha(active);}
if(after.head!==before.head||after.branch!==before.branch||git('diff','--cached','--binary')!==before.index||after.unrelated_changed.length)throw Error('Preservation check failed');
git('apply','--reverse','--check',patch);
await writeFile(out+'/after.json',JSON.stringify(after,null,2));
console.log('Applied exact five-file patch; all other '+(files.length-4)+' existing tracked/untracked files, HEAD, branch and index unchanged. Backups and hashes: '+out);
