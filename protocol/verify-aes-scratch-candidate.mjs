import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const root='C:/HuginnEIS/Huginn/Firmware/huginn',out='build/aes-scratch-candidate';
const sha=b=>createHash('sha256').update(b).digest('hex');
const changes={};
for(const [rel,name] of Object.entries({'components/mbedtls/port/aes/dma/esp_aes_dma_core.c':'esp_aes_dma_core.c','CMakeLists.txt':'CMakeLists.txt','main/main.c':'main.c'})) {
 const path=root+'/'+rel,before=await readFile(out+'/'+name+'.retained-rev26'),candidate=await readFile(out+'/'+name+'.candidate');
 if(sha(await readFile(path))!==sha(candidate))throw Error('candidate differs: '+path);
 changes[path]={before_sha256:sha(before),after_sha256:sha(candidate),candidate_file:out+'/'+name+'.candidate'};
}
const baseline=JSON.parse(await readFile(out+'/preserved.json'));
for(const [p,h] of Object.entries(baseline)) {
 if(changes[p]){if(changes[p].before_sha256!==h)throw Error('before copy mismatch: '+p);}
 else if(sha(await readFile(p))!==h)throw Error('unrelated retained input changed: '+p);
}
const shared=JSON.parse(await readFile(out+'/shared-inputs.json'));
for(const [p,h] of Object.entries(shared))if(sha(await readFile(p))!==h)throw Error('shared SDK changed: '+p);
const checks=JSON.parse(await readFile(out+'/checks.json'));
for(const [p,h] of Object.entries(checks.hashes)) {
 const path=p.startsWith('protocol/')||p.startsWith('build/')?p:out+'/'+p;
 if(sha(await readFile(path))!==h)throw Error('test identity mismatch: '+p);
}
if(changes[root+'/components/mbedtls/port/aes/dma/esp_aes_dma_core.c'].after_sha256!==checks.hashes['esp_aes_dma_core.c'])throw Error('tested source mismatch');
execFileSync('git',['-c','safe.directory=C:/HuginnEIS','-C',root,'apply','--reverse','--check','C:/HuginnAPP/protocol/aes-s3-output-scratch-rev27.patch'],{encoding:'utf8'});
const receipt={revision:'HuginnEIS Rev. 2.7',status:'functional source candidate for owner review; not built or installed',changes,patch_sha256:sha(await readFile('protocol/aes-s3-output-scratch-rev27.patch')),checks,preserved_inputs:Object.keys(baseline).length-3,shared_sdk_inputs_unchanged:Object.keys(shared).length,target_build_run:false,physical_validation:false};
await writeFile(out+'/applied-candidate.json',JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify({revision:receipt.revision,patch_sha256:receipt.patch_sha256,preserved_inputs:receipt.preserved_inputs,shared_sdk_inputs_unchanged:receipt.shared_sdk_inputs_unchanged,modified_inputs:Object.keys(changes),checks:'PASS; ASan/UBSan, actual SDK allocator host test and Xtensa syntax only',physical_validation:false},null,2));
