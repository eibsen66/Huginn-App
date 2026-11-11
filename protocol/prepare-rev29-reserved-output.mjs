// Owner-authorized source preparation; never builds, flashes or opens a COM port.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root='C:/HuginnEIS/Huginn/Firmware/huginn',out='build/rev29-review';
const sha=b=>createHash('sha256').update(b).digest('hex');
await mkdir(out,{recursive:false});
const paths=['components/mbedtls/port/aes/dma/esp_aes_dma_core.c','CMakeLists.txt','main/main.c'];
const pins={};
for(const p of paths){const b=await readFile(root+'/'+p);pins[p]=sha(b);await writeFile(out+'/'+p.replaceAll('/','__')+'.before',b,{flag:'wx'});}
const raw=await readFile('C:/HuginnEIS/Evidence/REV2.8-COM5/console-20261108T191256Z/console.raw');
if(sha(raw)!=='433183861e27be6824e18cfbc5eda7ff52c439420e45fc819ed7822f1b8181d2')throw Error('Capture changed');
let s=await readFile(root+'/'+paths[0],'utf8');
const replace=(a,b)=>{if(!s.includes(a))throw Error('Source context mismatch');s=s.replace(a,b);};
replace('/* Input over this length will yield',`#if CONFIG_IDF_TARGET_ESP32S3
/* The AES/SHA hardware lock is held by every caller across this whole
 * output-only bounce operation, including its final copy and error cleanup.
 * Internal DMA storage avoids a per-operation heap allocation/fragmentation.
 * Other targets and input-bounce paths retain their original allocation. */
static DMA_ATTR __attribute__((aligned(16))) unsigned char s_s3_output_bounce[512];
_Static_assert(sizeof(s_s3_output_bounce) % AES_BLOCK_BYTES == 0, "AES block size");
#endif

/* Input over this length will yield`);
replace('    unsigned char *output_buf = NULL;','    unsigned char *output_buf = NULL;\n    bool output_buf_heap_owned = false;');
const a=s.indexOf('    /* The S3 can read DMA-capable PSRAM directly');
const b=s.indexOf('    if (realloc_output && !realloc_input)',a);
if(a<0||b<a)throw Error('Missing S3 chunk selection');
s=s.slice(0,a)+`    /* Use the reserved output scratch only on the existing S3 output-only
     * path. Whole AES blocks preserve stream/mode state across chunks. */
`+s.slice(b);
replace('        chunk_limit = 512;','        chunk_limit = sizeof(s_s3_output_bounce);');
replace('        /* Normal request context, never an allocator callback. No policy change. */',`#if CONFIG_IDF_TARGET_ESP32S3
        if (!realloc_input) {
            output_buf = s_s3_output_bounce;
            assert(esp_ptr_dma_capable(output_buf));
            assert(((uintptr_t)output_buf & 15) == 0);
        } else
#endif
        {
        /* Normal request context, never an allocator callback. */`);
replace('        huginn_aes_output_probe_after(output_buf == NULL);','        output_buf_heap_owned = output_buf != NULL;\n        huginn_aes_output_probe_after(output_buf == NULL);');
replace('    } else {\n        output_buf = output;','        }\n    } else {\n        output_buf = output;');
replace('    if (realloc_output) {\n        free(output_buf);\n    }',`    if (output_buf_heap_owned) {
        free(output_buf);
    }
#if CONFIG_IDF_TARGET_ESP32S3
    if (output_buf == s_s3_output_bounce) {
        /* Inner DMA cleanup has completed or aborted under the same lock.
         * Wipe reserved storage before its next owner can acquire the lock. */
        mbedtls_platform_zeroize(s_s3_output_bounce, sizeof(s_s3_output_bounce));
    }
#endif`);
// Keep the heap branch visibly nested; no compressed/ambiguous cleanup paths.
const start=s.indexOf('        /* Normal request context, never an allocator callback. */');
const end=s.indexOf('        }\n    } else {\n        output_buf = output;',start);
s=s.slice(0,start)+s.slice(start,end).split('\n').map(l=>l?'    '+l:l).join('\n')+s.slice(end);
await writeFile(root+'/'+paths[0],s);
for(const p of paths.slice(1)){const old=await readFile(root+'/'+p,'utf8');const updated=old.replaceAll('HuginnEIS Rev. 2.8','HuginnEIS Rev. 2.9');if(updated===old)throw Error('Revision missing '+p);await writeFile(root+'/'+p,updated);}
await writeFile(out+'/source-before.json',JSON.stringify({raw_sha256:sha(raw),paths,pins},null,2)+'\n');
console.log('Prepared scoped Rev. 2.9 source; preserved before-images. No build/device action.');
