// Prepare an UNAPPLIED measurement patch, not a speculative memory-policy fix.
import {readFile,writeFile,mkdir} from 'node:fs/promises';import {execFileSync} from 'node:child_process';
const root='C:/HuginnEIS/Huginn/Firmware/huginn/components/mbedtls',out='build/settings-send-152413-review';await mkdir(out+'/proposed/port/include',{recursive:true});await mkdir(out+'/proposed/port/aes/dma',{recursive:true});
const paths=['port/aes/dma/esp_aes_dma_core.c','port/huginn_aes_alloc_diag.c','port/include/huginn_aes_alloc_diag.h'];let patch='';
for(const p of paths){let original=await readFile(root+'/'+p,'utf8'),s=original;
 if(p.endsWith('esp_aes_dma_core.c')){
  const a='        output_buf = heap_caps_aligned_alloc(output_alignment, chunk_len, output_heap_caps);';if(s.split(a).length!==2)throw Error('Output allocation seam changed');
  s=s.replace(a,`        /* Normal request context, never an allocator callback. No policy change. */
        huginn_aes_output_probe_before(len, chunk_len, output_alignment, output_heap_caps,
                                       realloc_input, input == output,
                                       esp_ptr_external_ram(input), esp_ptr_external_ram(output));
${a}
        huginn_aes_output_probe_after(output_buf == NULL);`);
 }else if(p.endsWith('.h')){s=s.replace('#include <stddef.h>','#include <stdbool.h>\n#include <stddef.h>');s+='\nvoid huginn_aes_output_probe_before(size_t length, size_t bytes, size_t alignment, uint32_t caps,\n                                    bool input_bounce, bool in_place, bool input_external, bool output_external);\nvoid huginn_aes_output_probe_after(bool failed);\n';}
 else {
  s=s.replace('#include <errno.h>','#include <errno.h>\n#include "esp_heap_caps.h"');
  const at=s.indexOf('void huginn_aes_alloc_diag_begin');
  s=s.slice(0,at)+`/* One first failed output-allocation sample per request. No payload/pointers. */
static struct {
    multi_heap_info_t before, after;
    size_t length, bytes, alignment;
    uint32_t caps;
    bool input_bounce, in_place, input_external, output_external;
    int64_t before_us, after_us;
} output_probe;
static bool output_probe_pending, output_probe_failed;
void huginn_aes_output_probe_before(size_t length, size_t bytes, size_t alignment, uint32_t caps,
                                    bool input_bounce, bool in_place, bool input_external, bool output_external)
{
    const int saved_errno = errno;
    if (!xPortInIsrContext() && active && owner == xTaskGetCurrentTaskHandle() && !output_probe_failed) {
        output_probe.length=length; output_probe.bytes=bytes; output_probe.alignment=alignment;
        output_probe.caps=caps; output_probe.input_bounce=input_bounce; output_probe.in_place=in_place;
        output_probe.input_external=input_external; output_probe.output_external=output_external;
        /* This API uses normal heap locks; never call it from a failed-allocation
         * callback. Concurrent heap changes are possible between the samples. */
        heap_caps_get_info(&output_probe.before,caps);
        output_probe.before_us=esp_timer_get_time()-started;
        output_probe_pending=true;
    }
    errno=saved_errno;
}
void huginn_aes_output_probe_after(bool failed)
{
    const int saved_errno=errno; /* first action after the original allocation */
    if (!xPortInIsrContext() && active && owner == xTaskGetCurrentTaskHandle() && output_probe_pending) {
        if (failed) {
            heap_caps_get_info(&output_probe.after,output_probe.caps);
            output_probe.after_us=esp_timer_get_time()-started;
            output_probe_failed=true;
        }
        output_probe_pending=false;
    }
    errno=saved_errno;
}
`+s.slice(at);
  s=s.replace('used = dropped = 0;','used = dropped = 0;\n        output_probe_pending=output_probe_failed=false;');
  s=s.replace('        active = false;','        active = false;\n        if (output_probe_failed) {\n            ESP_LOGI("HS2_DMA_HEAP", "id=%u task=%lu bytes=%u caps=%u length=%u requested_alignment=%u input_bounce=%u in_place=%u input_external=%u output_external=%u before_free=%u before_largest=%u before_blocks=%u after_free=%u after_largest=%u after_blocks=%u before_us=%lld after_us=%lld",\n                (unsigned)request_id,(unsigned long)task,(unsigned)output_probe.bytes,(unsigned)output_probe.caps,(unsigned)output_probe.length,(unsigned)output_probe.alignment,\n                (unsigned)output_probe.input_bounce,(unsigned)output_probe.in_place,(unsigned)output_probe.input_external,(unsigned)output_probe.output_external,\n                (unsigned)output_probe.before.total_free_bytes,(unsigned)output_probe.before.largest_free_block,(unsigned)output_probe.before.free_blocks,\n                (unsigned)output_probe.after.total_free_bytes,(unsigned)output_probe.after.largest_free_block,(unsigned)output_probe.after.free_blocks,\n                (long long)output_probe.before_us,(long long)output_probe.after_us);\n        }');
 }
 await writeFile(out+'/before-'+p.split('/').at(-1),original);await writeFile(out+'/proposed/'+p,s);
 const before='/mnt/c/HuginnAPP/'+out+'/before-'+p.split('/').at(-1),after='/mnt/c/HuginnAPP/'+out+'/proposed/'+p;
 try{patch+=execFileSync('wsl',['-d','Ubuntu','--exec','diff','-u','--label','a/components/mbedtls/'+p,'--label','b/components/mbedtls/'+p,before,after],{encoding:'utf8',windowsHide:true});}catch(e){if(e.status!==1)throw e;patch+=e.stdout;}
}
await writeFile('protocol/aes-output-heap-observation.patch',patch);console.log('Prepared unapplied allocator-observation patch; allocation arguments, returns, retries and cleanup unchanged.');
