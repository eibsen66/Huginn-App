import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const root='C:/HuginnEIS/Huginn/Firmware/huginn',out='build/aes-scratch-candidate';
const sha=b=>createHash('sha256').update(b).digest('hex');
const expected=JSON.parse(await readFile(out+'/preserved.json'));
for(const [p,h] of Object.entries(expected))if(sha(await readFile(p))!==h)throw Error('pre-apply changed: '+p);
const checked=JSON.parse(await readFile(out+'/checks.json'));
if(checked.host!=='PASS'||checked.xtensa_syntax!=='PASS'||checked.tlsf_host!=='PASS')throw Error('checks incomplete');
const files={'components/mbedtls/port/aes/dma/esp_aes_dma_core.c':'esp_aes_dma_core.c','CMakeLists.txt':'CMakeLists.txt','main/main.c':'main.c'};
const changes={};let fullPatch='';
for(const [rel,name] of Object.entries(files)) {
 const path=root+'/'+rel,before=await readFile(path);let after;
 if(rel.startsWith('components/'))after=await readFile(out+'/'+name);
 else {
  const needle=Buffer.from('HuginnEIS Rev. 2.6'),replacement=Buffer.from('HuginnEIS Rev. 2.7');
  const at=before.indexOf(needle);if(at<0||before.indexOf(needle,at+1)>=0)throw Error('ambiguous revision: '+rel);
  after=Buffer.concat([before.subarray(0,at),replacement,before.subarray(at+needle.length)]);
 }
 await writeFile(out+'/'+name+'.retained-rev26',before);
 await writeFile(out+'/'+name+'.candidate',after);
 let patch;try {execFileSync('git',['-c','core.autocrlf=false','diff','--no-index','--',out+'/'+name+'.retained-rev26',out+'/'+name+'.candidate'],{encoding:'utf8'});}catch(e){if(e.status!==1)throw e;patch=e.stdout;}
 fullPatch+=patch.replaceAll('a/'+out+'/'+name+'.retained-rev26','a/'+rel).replaceAll('b/'+out+'/'+name+'.candidate','b/'+rel);
 changes[path]={before_sha256:sha(before),after_sha256:sha(after),candidate_file:out+'/'+name+'.candidate'};
}
await writeFile('protocol/aes-s3-output-scratch-rev27.patch',fullPatch);
execFileSync('git',['-c','safe.directory=C:/HuginnEIS','-C',root,'apply','--check','C:/HuginnAPP/protocol/aes-s3-output-scratch-rev27.patch'],{encoding:'utf8'});
for(const [path,change] of Object.entries(changes))await writeFile(path,await readFile(change.candidate_file));
execFileSync('git',['-c','safe.directory=C:/HuginnEIS','-C',root,'apply','--reverse','--check','C:/HuginnAPP/protocol/aes-s3-output-scratch-rev27.patch'],{encoding:'utf8'});
const receipt={revision:'HuginnEIS Rev. 2.7',status:'functional source candidate for owner review; not built or installed',changes,patch_sha256:sha(Buffer.from(fullPatch)),checks:checked};
await writeFile(out+'/applied-candidate.json',JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify({revision:receipt.revision,changes,patch_sha256:receipt.patch_sha256},null,2));
