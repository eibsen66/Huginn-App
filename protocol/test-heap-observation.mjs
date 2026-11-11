import {readFile,writeFile,mkdir} from 'node:fs/promises';import {execFileSync} from 'node:child_process';
const out='build/settings-send-152413-review',fw='C:/HuginnEIS/Huginn/Firmware/huginn',base='C:/HuginnAPP/'+out;
await mkdir(out+'/stubs/freertos',{recursive:true});for(const name of ['freertos/FreeRTOS.h','freertos/task.h','esp_log.h','esp_timer.h'])await writeFile(out+'/stubs/'+name,await readFile('build/rev24-preparation/stubs/'+name));
await writeFile(out+'/stubs/esp_heap_caps.h',`#pragma once
#include <stddef.h>
#include <stdint.h>
typedef struct {size_t total_free_bytes,total_allocated_bytes,largest_free_block,minimum_free_bytes,allocated_blocks,free_blocks,total_blocks;} multi_heap_info_t;
void heap_caps_get_info(multi_heap_info_t*,uint32_t);
`);
const c=`#include <assert.h>
#include <errno.h>
#include <stdint.h>
#include <stdio.h>
#include "esp_heap_caps.h"
uintptr_t simulated_task=1;int simulated_isr;int64_t clock_us;static unsigned queries;static int fragmented;
void heap_caps_get_info(multi_heap_info_t *p,uint32_t caps){assert(caps==8);queries++;*p=(multi_heap_info_t){.total_free_bytes=fragmented?8000:1000,.largest_free_block=fragmented?512:992,.free_blocks=fragmented?20:1};errno=99;}
#include "${('/mnt/c/HuginnAPP/'+out)}/proposed/port/huginn_aes_alloc_diag.c"
int main(void){
 errno=0;huginn_aes_output_probe_before(4096,1600,1,8,0,1,1,1);huginn_aes_output_probe_after(1);assert(queries==0&&errno==0);
 for(unsigned id=1;id<=2;id++){fragmented=id==2;huginn_aes_alloc_diag_begin(id);simulated_task=2;
  huginn_aes_output_probe_before(4096,1600,1,8,0,1,1,1);assert(queries==(id-1)*2);simulated_task=1;
  simulated_isr=1;huginn_aes_output_probe_before(4096,1600,1,8,0,1,1,1);assert(queries==(id-1)*2);simulated_isr=0;
  huginn_aes_output_probe_before(4096,1600,1,8,0,1,1,1);assert(errno==0);huginn_aes_output_probe_after(1);assert(errno==0);
  assert(output_probe_failed && output_probe.bytes==1600 && output_probe.input_bounce==0 && output_probe.in_place && output_probe.before.largest_free_block==(fragmented?512:992));
  huginn_aes_alloc_diag_end();assert(errno==0);
 }
 huginn_aes_alloc_diag_begin(3);huginn_aes_output_probe_before(4096,1600,1,8,1,0,0,1);huginn_aes_output_probe_after(0);assert(!output_probe_failed&&queries==5);huginn_aes_alloc_diag_end();
 puts("PASS identical failed allocations can represent low total DMA memory or fragmentation; probe distinguishes simulated states; scope/ISR exclusion, first-failure bounds, success/error errno and cleanup retained");return 0;
}`;
await writeFile(out+'/probe-host.c',c);const w=p=>p.replace('C:/','/mnt/c/');
function run(a){return execFileSync('wsl',['-d','Ubuntu','--exec',...a],{encoding:'utf8',windowsHide:true});}
run(['gcc','-std=c11','-Wall','-Wextra','-Werror','-fsanitize=address,undefined','-I'+w(base+'/stubs'),'-I'+w(base+'/proposed/port/include'),w(base+'/probe-host.c'),'-o',w(base+'/probe-host')]);
const result=run([w(base+'/probe-host')]);await writeFile(out+'/probe-host.log',result);console.log(result);
function extract(s,sig){const a=s.indexOf(sig);if(a<0)throw Error(sig);let i=s.indexOf('{',a),n=1,j=i+1;for(;n;j++){if(s[j]==='{')n++;if(s[j]==='}')n--;}return s.slice(a,j);}
// Actual retained AES function: prove ownership for output failure with and
// without an input bounce buffer, then repeat successes/errors on a fresh heap.
const aes=extract(await readFile(fw+'/components/mbedtls/port/aes/dma/esp_aes_dma_core.c','utf8'),'static int esp_aes_process_dma_ext_ram(');
let host=await readFile('protocol/aes-allocation-host.c','utf8');host=host.replace('/* ORIGINAL */','').replace('/* FIXED */',aes.replace('esp_aes_process_dma_ext_ram(', 'fixed_ext_ram('));
host='#define huginn_aes_alloc_diag_failure(...) ((void)0)\n'+host;
host=host.slice(0,host.indexOf('int main(void)'))+`int main(void){uint8_t in[29502],out[29502];memset(in,7,sizeof(in));esp_aes_context ctx={0};
 for(int i=0;i<2;i++){fail_at=i?2:1;memset(out,9,sizeof(out));assert(fixed_ext_ram(&ctx,in,out,sizeof(out),NULL,i,1)==-1);assert(allocations==i+1&&frees==i);for(unsigned k=0;k<sizeof(out);k++)assert(out[k]==0);reset();}
 for(unsigned send=0;send<500;send++){for(int i=0;i<2;i++)for(int o=0;o<2;o++){fail_at=0;memset(out,0,sizeof(out));assert(fixed_ext_ram(&ctx,in,out,sizeof(out),NULL,i,o)==0);assert(!memcmp(in,out,sizeof(in))&&allocations==frees);reset();}fail_at=2;assert(fixed_ext_ram(&ctx,in,out,sizeof(out),NULL,1,1)==-1);assert(frees==1);reset();}
 puts("PASS retained AES output-failure cleanup with/without input allocation and 500 repeated full-length success/failure cycles; injected DMA copy/allocator, not physical encryption proof");return 0;}
`;
await writeFile(out+'/cleanup-host.c',host);run(['gcc','-std=c11','-Wall','-Wextra','-Werror','-fsanitize=address,undefined',w(base+'/cleanup-host.c'),'-o',w(base+'/cleanup-host')]);const cleanup=run([w(base+'/cleanup-host')]);await writeFile(out+'/cleanup-host.log',cleanup);console.log(cleanup);
