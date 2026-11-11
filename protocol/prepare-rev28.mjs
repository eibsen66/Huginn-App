import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';import {createHash} from 'node:crypto';import {execFileSync} from 'node:child_process';
const root='C:/HuginnEIS/Huginn/Firmware/huginn',out='C:/HuginnAPP/build/rev28-review',sha=b=>createHash('sha256').update(b).digest('hex');await mkdir(out,{recursive:true});
async function keep(path,value){try{await writeFile(path,value,{flag:'wx'});}catch(e){if(e.code!=='EEXIST'||await readFile(path,'utf8')!==value)throw e;}}
const paths=['components/mbedtls/port/aes/dma/esp_aes_dma_core.c','components/mbedtls/port/crypto_shared_gdma/esp_crypto_shared_gdma.c','components/mbedtls/port/include/esp_crypto_shared_gdma.h','CMakeLists.txt','main/main.c'];
const prepared=JSON.parse(await readFile('C:/HuginnEIS/Evidence/REV2.7-PREPARATION/prepared.json'));
const preserved={};for(const [p,h]of Object.entries(prepared.sources)){const bytes=await readFile(root+'/'+p);if(sha(bytes)!==h)throw Error('Source differs from retained Rev. 2.7 '+p);preserved[root+'/'+p]=h;}
const build=root+'/build-rev2.7-20261105',complete=JSON.parse(await readFile(build+'/owner-build-complete.json'));
for(const [p,h]of Object.entries(complete.outputs)){if(sha(await readFile(build+'/'+p))!==h)throw Error('Rev. 2.7 artifact mismatch '+p);preserved[build+'/'+p]=h;}
for(const p of ['owner-build-start.json','owner-build-complete.json','owner-build-result.json'])preserved[build+'/'+p]=sha(await readFile(build+'/'+p));
const capture='C:/HuginnEIS/Evidence/REV2.7-COM5/console-20261107T131309Z';for(const p of await readdir(capture))preserved[capture+'/'+p]=sha(await readFile(capture+'/'+p));if(preserved[capture+'/console.raw']!=='611dfe3eaf4922018035006692fa309d06b3d3f3b559e25271b3383aa74295cc')throw Error('Capture mismatch');
const preservation=JSON.stringify(preserved,null,2)+'\n';try{await writeFile(out+'/preserved.json',preservation,{flag:'wx'});}catch(e){if(e.code!=='EEXIST'||await readFile(out+'/preserved.json','utf8')!==preservation)throw e;}
await keep(out+'/git-status-before.txt',execFileSync('git',['-c','safe.directory=C:/HuginnEIS','-C','C:/HuginnEIS','status','--porcelain=v1'],{encoding:'utf8'}));
const before={},after={};for(const p of paths){before[p]=await readFile(root+'/'+p,'utf8');await keep(out+'/'+p.replaceAll('/','__')+'.before',before[p]);after[p]=before[p];}
let core=after[paths[0]].replaceAll('\r\n','\n');
core=core.replace('chunk_limit = 1024;','chunk_limit = 512;').replace('below the observed 1536-byte largest DMA block, leaving space for','below the observed 736-byte largest DMA block, leaving space for');
core=core.replace('#include "esp_aes_dma_priv.h"','#include "esp_aes_dma_priv.h"\n#if CONFIG_IDF_TARGET_ESP32S3\n#include "esp_crypto_shared_gdma.h"\n#endif');
core=core.replace('static DRAM_ATTR uint8_t s_stream_in[AES_BLOCK_BYTES];',`#if CONFIG_IDF_TARGET_ESP32S3
/* Accessed only while the existing AES/SHA hardware lock is held. DMA must
 * finish or be stopped/reset before this pair may be reused. Other chains
 * retain their original heap allocation. Internal DMA memory, never PSRAM. */
static DMA_ATTR __attribute__((aligned(8))) crypto_dma_desc_t s_s3_short_block_desc[2];
_Static_assert(sizeof(crypto_dma_desc_t) == 12, "S3 descriptor size changed");
#endif
static DRAM_ATTR uint8_t s_stream_in[AES_BLOCK_BYTES];`);
const start=core.lastIndexOf('int esp_aes_process_dma(esp_aes_context *ctx');const end=core.indexOf('\n#if CONFIG_MBEDTLS_HARDWARE_GCM',start);let fn=core.slice(start,end);
fn=fn.replace('    size_t crypto_dma_desc_num = 0;','    size_t crypto_dma_desc_num = 0;\n    bool block_desc_heap_owned = false;\n#if CONFIG_IDF_TARGET_ESP32S3\n    bool dma_started = false;\n#endif');
fn=fn.replace('        block_desc = heap_caps_aligned_calloc(8, crypto_dma_desc_num * 2, sizeof(crypto_dma_desc_t), MALLOC_CAP_DMA);',`#if CONFIG_IDF_TARGET_ESP32S3
        if (crypto_dma_desc_num == 1) {
            block_desc = s_s3_short_block_desc;
            memset(block_desc, 0, sizeof(s_s3_short_block_desc));
        } else
#endif
        {
            block_desc = heap_caps_aligned_calloc(8, crypto_dma_desc_num * 2, sizeof(crypto_dma_desc_t), MALLOC_CAP_DMA);
            block_desc_heap_owned = block_desc != NULL;
        }`);
fn=fn.replace('    aes_hal_transform_dma_start(blocks);','#if CONFIG_IDF_TARGET_ESP32S3\n    dma_started = true;\n#endif\n    aes_hal_transform_dma_start(blocks);');
fn=fn.replace('                return -1;\n            }\n        }\n    }\n#endif\n    aes_hal_transform_dma_finish();','                ret = -1;\n                goto cleanup;\n            }\n        }\n    }\n#endif\n    aes_hal_transform_dma_finish();\n#if CONFIG_IDF_TARGET_ESP32S3\n    dma_started = false;\n#endif');
fn=fn.replace('cleanup:\n    if (ret != 0)',`cleanup:
#if CONFIG_IDF_TARGET_ESP32S3
    if (dma_started) {
        /* Still under AES_LOCK. Stop/reset both channels before zeroizing
         * buffers, freeing heap descriptors, or releasing reusable storage. */
        esp_crypto_shared_gdma_abort();
        aes_hal_transform_dma_finish();
    }
#endif
    if (ret != 0)`);
fn=fn.replace('    free(block_desc);','    if (block_desc_heap_owned) {\n        free(block_desc);\n    }');
if(!fn.includes('esp_crypto_shared_gdma_abort();')||!fn.includes('ret = -1;\n                goto cleanup;'))throw Error('Cleanup replacement failed');
core=core.slice(0,start)+fn+core.slice(end);after[paths[0]]=before[paths[0]].includes('\r\n')?core.replaceAll('\n','\r\n'):core;
after[paths[1]]+=`\n#if CONFIG_IDF_TARGET_ESP32S3
/* Internal AES error cleanup only: caller holds the AES/SHA hardware lock.
 * No allocation, channel deletion, lock reacquisition, or automatic retry. */
void esp_crypto_shared_gdma_abort(void)
{
    if (tx_channel != NULL) {
        ESP_ERROR_CHECK(gdma_stop(tx_channel));
        ESP_ERROR_CHECK(gdma_reset(tx_channel));
    }
    if (rx_channel != NULL) {
        ESP_ERROR_CHECK(gdma_stop(rx_channel));
        ESP_ERROR_CHECK(gdma_reset(rx_channel));
    }
}
#endif
`;
after[paths[2]]+='\n#if CONFIG_IDF_TARGET_ESP32S3\n/* Internal only; AES/SHA lock must already be held. */\nvoid esp_crypto_shared_gdma_abort(void);\n#endif\n';
for(const p of ['CMakeLists.txt','main/main.c'])after[p]=after[p].replaceAll('HuginnEIS Rev. 2.7','HuginnEIS Rev. 2.8');
for(const p of paths){await writeFile(out+'/'+p.replaceAll('/','__')+'.candidate',after[p],{flag:'wx'});}
await writeFile(out+'/source-changes.json',JSON.stringify({root,paths,before:Object.fromEntries(paths.map(p=>[p,sha(Buffer.from(before[p]))])),after:Object.fromEntries(paths.map(p=>[p,sha(Buffer.from(after[p]))]))},null,2)+'\n',{flag:'wx'});
console.log('Prepared Rev. 2.8 source corrections; retained inputs '+Object.keys(preserved).length+'; not applied');
