import {readFile,writeFile,mkdir} from 'node:fs/promises';import {execFileSync} from 'node:child_process';
const out='build/rev26-preparation',base='C:/HuginnAPP/'+out,fw='C:/HuginnEIS/Huginn/Firmware/huginn',port=fw+'/components/mbedtls/port';await mkdir(out+'/stubs/freertos',{recursive:true});
for(const name of ['freertos/FreeRTOS.h','freertos/task.h','esp_log.h','esp_timer.h','esp_heap_caps.h'])await writeFile(out+'/stubs/'+name,await readFile('build/settings-send-152413-review/stubs/'+name));
await writeFile(out+'/stubs/esp_heap_caps.h',(await readFile(out+'/stubs/esp_heap_caps.h','utf8'))+'\n#define MALLOC_CAP_SPIRAM 1024\n');
await writeFile(out+'/stubs/esp_memory_utils.h',`#pragma once
#include <stdbool.h>
#include <stdint.h>
static inline bool esp_ptr_external_ram(const void *p){uintptr_t n=(uintptr_t)p;return n>=0x3c000000&&n<0x3e000000;}
static inline bool esp_ptr_dma_ext_capable(const void *p){return esp_ptr_external_ram(p);}
static inline bool esp_ptr_dma_capable(const void *p){uintptr_t n=(uintptr_t)p;return n>=0x3fc88000&&n<0x3fd00000;}
`);
await writeFile(out+'/stubs/esp_cache.h',`#pragma once
#include <stddef.h>
#include <stdint.h>
#include <errno.h>
#define ESP_OK 0
static inline int esp_cache_get_alignment(uint32_t caps,size_t *a){*a=(caps&1024)?32:0;errno=88;return 0;}
`);
let c=await readFile('build/settings-send-152413-review/probe-host.c','utf8');
c=c.replace('/mnt/c/HuginnAPP/build/settings-send-152413-review/proposed/port/huginn_aes_alloc_diag.c','/mnt/c/HuginnEIS/Huginn/Firmware/huginn/components/mbedtls/port/huginn_aes_alloc_diag.c');
c=c.replace('  huginn_aes_output_probe_before(4096,1600,1,8,0,1,1,1);assert(errno==0);',`  huginn_aes_output_probe_constraints((void*)0x3c000015,(void*)0x3c000015);assert(errno==0);
  huginn_aes_output_probe_before(4096,1600,1,8,0,1,1,1);assert(errno==0);`);
c=c.replace('  huginn_aes_alloc_diag_end();assert(errno==0);',`  assert(output_probe.cache_line==32 && output_probe.input_mod_cache==21 && output_probe.output_mod_cache==21 && output_probe.input_mod16==5 && output_probe.output_mod16==5 && output_probe.input_dma && output_probe.output_dma);
  unsigned saved_queries=queries;huginn_aes_output_probe_constraints((void*)0x3fc90000,(void*)0x3fc90000);huginn_aes_output_probe_before(32,32,1,8,1,0,0,0);huginn_aes_output_probe_after(1);assert(queries==saved_queries && output_probe.bytes==1600 && output_probe.output_mod_cache==21);
  huginn_aes_alloc_diag_end();assert(errno==0);`);
c=c.replace(' puts("PASS identical', ' puts("PASS cache/DMA classifications and pointer offsets without addresses; first-failure record cannot be overwritten");\n puts("PASS identical');
await writeFile(out+'/probe-host.c',c);const w=p=>p.replace('C:/','/mnt/c/');function run(a){return execFileSync('wsl',['-d','Ubuntu','--exec',...a],{encoding:'utf8',windowsHide:true});}
run(['gcc','-std=c11','-Wall','-Wextra','-Werror','-fsanitize=address,undefined','-I'+w(base+'/stubs'),'-I'+w(port+'/include'),w(base+'/probe-host.c'),'-o',w(base+'/probe-host')]);const result=run([w(base+'/probe-host')]);await writeFile(out+'/probe-host.log',result);console.log(result);
// Actual AES routine plus both real new probe functions, allocator/DMA seams only.
let cleanup=await readFile('build/settings-send-152413-review/cleanup-host.c','utf8');
const source=await readFile(port+'/aes/dma/esp_aes_dma_core.c','utf8');function extract(s,sig){let a=s.indexOf(sig),i=s.indexOf('{',a),n=1,j=i+1;if(a<0)throw Error(sig);for(;n;j++){if(s[j]==='{')n++;if(s[j]==='}')n--;}return s.slice(a,j);}
const oldStart=cleanup.indexOf('static int fixed_ext_ram('),oldEnd=cleanup.indexOf('\n#undef free',oldStart);
cleanup=cleanup.slice(0,oldStart)+extract(source,'static int esp_aes_process_dma_ext_ram(').replace('esp_aes_process_dma_ext_ram(','fixed_ext_ram(')+cleanup.slice(oldEnd);
cleanup='#define huginn_aes_output_probe_constraints(...) ((void)0)\n#define huginn_aes_output_probe_before(...) ((void)0)\n#define huginn_aes_output_probe_after(...) ((void)0)\n'+cleanup;
await writeFile(out+'/cleanup-host.c',cleanup);run(['gcc','-std=c11','-Wall','-Wextra','-Werror','-fsanitize=address,undefined',w(base+'/cleanup-host.c'),'-o',w(base+'/cleanup-host')]);const r=run([w(base+'/cleanup-host')]);await writeFile(out+'/cleanup-host.log',r);console.log(r);
