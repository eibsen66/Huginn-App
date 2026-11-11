import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const root='C:/HuginnEIS/Huginn/Firmware/huginn',out='build/aes-scratch-candidate';
const rel='components/mbedtls/port/aes/dma/esp_aes_dma_core.c';
const sha=b=>createHash('sha256').update(b).digest('hex');
await mkdir(out,{recursive:true});
const capture='C:/HuginnEIS/Evidence/REV2.6-COM5/console-20261105T174704Z';
const summary=JSON.parse(await readFile(capture+'/settings-send-summary.json'));
if(sha(await readFile(capture+'/console.raw'))!==summary.raw_sha256)throw Error('capture hash mismatch');
const start=JSON.parse(await readFile(root+'/build-rev2.6-20261105/owner-build-start.json'));
const complete=JSON.parse(await readFile(root+'/build-rev2.6-20261105/owner-build-complete.json'));
const checked={};
for(const [p,h] of Object.entries(start.sources)) {
 const b=await readFile(root+'/'+p);if(sha(b)!==h)throw Error('source differs from Rev. 2.6: '+p);checked[root+'/'+p]=h;
}
for(const [p,h] of Object.entries(complete.outputs)) {
 const path=root+'/build-rev2.6-20261105/'+p;
 if(sha(await readFile(path))!==h)throw Error('retained output mismatch: '+p);checked[path]=h;
}
for(const p of ['console.raw','console.jsonl','status.json','settings-send-summary.json'])checked[capture+'/'+p]=sha(await readFile(capture+'/'+p));
for(const p of ['owner-build-start.json','owner-build-complete.json'])checked[root+'/build-rev2.6-20261105/'+p]=sha(await readFile(root+'/build-rev2.6-20261105/'+p));
await writeFile(out+'/preserved.json',JSON.stringify(checked,null,2)+'\n');
const shared={};
for(const p of ['components/mbedtls/port/aes/dma/esp_aes_dma_core.c','components/heap/heap_caps.c','components/heap/heap_caps_base.c','components/heap/tlsf/tlsf.c','components/heap/tlsf/include/tlsf.h','components/heap/tlsf/tlsf_block_functions.h','components/heap/tlsf/tlsf_control_functions.h']) {
 const path='C:/esp/v5.5.2/esp-idf/'+p;shared[path]=sha(await readFile(path));
}
await writeFile(out+'/shared-inputs.json',JSON.stringify(shared,null,2)+'\n');
const before=await readFile(root+'/'+rel);let after=before.toString('utf8');
const old='    chunk_len = MIN(AES_MAX_CHUNK_WRITE_SIZE, len);';
if(after.split(old).length!==3)throw Error('unexpected chunk selection');
after=after.replace(old,`    size_t chunk_limit = AES_MAX_CHUNK_WRITE_SIZE;
#if CONFIG_IDF_TARGET_ESP32S3
    /* The S3 can read DMA-capable PSRAM directly, but unaligned external
     * output needs an internal bounce buffer. Keep this output-only path
     * below the observed 1536-byte largest DMA block, leaving space for
     * the DMA descriptors and allocator overhead. No persistent reserve
     * or allocation retry: ordinary allocation failures still propagate.
     * A whole AES block multiple preserves mode/stream state across chunks.
     */
    if (realloc_output && !realloc_input) {
        chunk_limit = 1024;
    }
#endif
    chunk_len = MIN(chunk_limit, len);`);
after=after.replace(old,'    chunk_len = MIN(chunk_limit, len);');
await writeFile(out+'/esp_aes_dma_core.before.c',before);await writeFile(out+'/esp_aes_dma_core.c',after);
function extract(s,sig){const a=s.indexOf(sig);let j=s.indexOf('{',a)+1,n=1;for(;n;j++){if(s[j]==='{')n++;if(s[j]==='}')n--;}return s.slice(a,j);}
const signature='static int esp_aes_process_dma_ext_ram(';
let harness=await readFile('protocol/aes-scratch-host.c','utf8');
let routines=extract(before.toString(),signature).replace(signature,'static int original_bounce(')+'\n'+extract(after,signature).replace(signature,'static int candidate_bounce(');
for(const limit of [512,768,1280])routines+='\n'+extract(after,signature).replace(signature,`static int compare_${limit}(`).replace('chunk_limit = 1024;',`chunk_limit = ${limit};`);
harness=harness.replace('/* ACTUAL_BOUNCE_ROUTINES */',routines);
await writeFile(out+'/host.c',harness);
let patch;
try {execFileSync('git',['diff','--no-index','--',out+'/esp_aes_dma_core.before.c',out+'/esp_aes_dma_core.c'],{encoding:'utf8'});} catch(e) {if(e.status!==1)throw e;patch=e.stdout;}
patch=patch.replaceAll('a/'+out+'/esp_aes_dma_core.before.c','a/'+rel).replaceAll('b/'+out+'/esp_aes_dma_core.c','b/'+rel);
await writeFile('protocol/aes-s3-output-scratch.patch',patch);
console.log(JSON.stringify({capture_sha256:summary.raw_sha256,retained_inputs_checked:Object.keys(checked).length,before_sha256:sha(before),candidate_sha256:sha(Buffer.from(after)),patch_sha256:sha(Buffer.from(patch))},null,2));
