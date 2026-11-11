import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
const out='build/rev24-preparation',fw='C:/HuginnEIS/Huginn/Firmware/huginn',local=fw+'/components/mbedtls';
await mkdir(out+'/stubs/freertos',{recursive:true});
await writeFile(out+'/stubs/freertos/FreeRTOS.h',`#pragma once
#include <stdint.h>
typedef int portMUX_TYPE;
#define portMUX_INITIALIZER_UNLOCKED 0
#define portENTER_CRITICAL(p) ((void)(p))
#define portEXIT_CRITICAL(p) ((void)(p))
#define configMAX_TASK_NAME_LEN 16
extern int simulated_isr;
static inline int xPortInIsrContext(void){return simulated_isr;}
`);
await writeFile(out+'/stubs/freertos/task.h',`#pragma once
#include <stdint.h>
typedef void *TaskHandle_t;
extern uintptr_t simulated_task;
static inline TaskHandle_t xTaskGetCurrentTaskHandle(void){return (void*)simulated_task;}
static inline const char *pcTaskGetName(TaskHandle_t p){(void)p;return "httpd";}
`);
await writeFile(out+'/stubs/esp_timer.h','#pragma once\n#include <stdint.h>\nextern int64_t clock_us;\nstatic inline int64_t esp_timer_get_time(void){return ++clock_us;}\n');
await writeFile(out+'/stubs/esp_log.h','#pragma once\n#include <stdio.h>\n#define ESP_LOGI(tag,fmt,...) printf(tag ": " fmt "\\n",__VA_ARGS__)\n');
const c=`#include <assert.h>
#include <errno.h>
#include <stdint.h>
#include <stdio.h>
uintptr_t simulated_task=1;int simulated_isr;int64_t clock_us;
#include "${local.replace('C:/','/mnt/c/')}/port/huginn_aes_alloc_diag.c"
int main(void){
 errno=104;huginn_aes_alloc_diag_failure(1,8,"bounce_input","esp_aes_process_dma_ext_ram",1);assert(errno==104 && used==0);
 huginn_aes_alloc_diag_begin(7);assert(errno==104);simulated_task=2;active=false;
 huginn_aes_alloc_diag_failure(2,8,"bounce_input","esp_aes_process_dma_ext_ram",2);assert(used==0);huginn_aes_alloc_diag_end();assert(owner!=NULL);
 simulated_task=1;active=true;simulated_isr=1;huginn_aes_alloc_diag_failure(3,8,"bounce_input","esp_aes_process_dma_ext_ram",3);assert(used==0);simulated_isr=0;
 for(unsigned i=0;i<11;i++){huginn_aes_alloc_diag_failure(1600+i,8+i,"bounce_output","esp_aes_process_dma_ext_ram",270+i);assert(errno==104);}
 assert(used==8 && dropped==3 && records[0].bytes==1600 && records[0].caps==8 && records[0].line==270 && records[0].elapsed>0);
 huginn_aes_alloc_diag_end();assert(errno==104 && owner==NULL);
 huginn_aes_alloc_diag_begin(8);assert(used==0 && dropped==0);
 huginn_aes_alloc_diag_failure(48,8,"block_descriptors","esp_aes_process_dma",1080);huginn_aes_alloc_diag_end();assert(errno==104);
 puts("PASS bounded records/drop count, scope reset, foreign task/ISR exclusion, exact fields, errno preservation");return 0;
}`;
await writeFile(out+'/allocation-host.c',c);
const w=p=>p.replace('C:/','/mnt/c/');
function run(args){return execFileSync('wsl',['-d','Ubuntu','--exec',...args],{windowsHide:true,encoding:'utf8'});}
run(['gcc','-std=c11','-Wall','-Wextra','-Werror','-fsanitize=address,undefined','-I'+w('C:/HuginnAPP/'+out+'/stubs'),'-I'+w(local+'/port/include'),w('C:/HuginnAPP/'+out+'/allocation-host.c'),'-o',w('C:/HuginnAPP/'+out+'/allocation-host')]);
const result=run([w('C:/HuginnAPP/'+out+'/allocation-host')]);await writeFile(out+'/allocation-host.log',result);console.log(result);
function extract(s,sig){const a=s.indexOf(sig);if(a<0)throw Error(sig);let i=s.indexOf('{',a),n=1,j=i+1;for(;n;j++){if(s[j]==='{')n++;if(s[j]==='}')n--;}return s.slice(a,j);}
const shared=await readFile('C:/esp/v5.5.2/esp-idf/components/mbedtls/port/aes/dma/esp_aes_dma_core.c','utf8');
const actual=await readFile(local+'/port/aes/dma/esp_aes_dma_core.c','utf8');
let host=await readFile('protocol/aes-allocation-host.c','utf8');
host=host.replace('/* ORIGINAL */',extract(shared,'static int esp_aes_process_dma_ext_ram(').replace('esp_aes_process_dma_ext_ram(', 'original_ext_ram('));
host=host.replace('/* FIXED */',extract(actual,'static int esp_aes_process_dma_ext_ram(').replace('esp_aes_process_dma_ext_ram(', 'fixed_ext_ram('));
host=host.replace('/* Actual DMA', '#define huginn_aes_alloc_diag_failure(...) ((void)0)\n/* Actual DMA');
host=host.replace('static int allocations,frees,fail_at;', 'static int dma_fail; static int allocations,frees,fail_at;');
host=host.replace('(void)c;(void)s;memcpy(q,p,n);return 0;', '(void)c;(void)s;if(dma_fail)return -1;memcpy(q,p,n);return 0;');
host=host.replace(' puts("PASS proposed cleanup:', `
 for(int i=0;i<2;i++)for(int o=0;o<2;o++){
  for(int fail=1;fail<=i+o;fail++){fail_at=fail;memset(out,9,sizeof(out));r=fixed_ext_ram(&ctx,in,out,4096,NULL,i,o);assert(r==-1);assert(frees==allocations-1);for(unsigned k=0;k<sizeof(out);k++)assert(out[k]==0);reset();}
  fail_at=0;dma_fail=1;r=fixed_ext_ram(&ctx,in,out,4096,NULL,i,o);assert(r==-1 && allocations==frees);reset();dma_fail=0;
 }
 puts("PASS allocation failure and DMA failure ownership matrix");
 puts("PASS proposed cleanup:`);
await writeFile(out+'/aes-host.c',host);
run(['gcc','-std=c11','-Wall','-Wextra','-Werror','-fsanitize=address,undefined',w('C:/HuginnAPP/'+out+'/aes-host.c'),'-o',w('C:/HuginnAPP/'+out+'/aes-host')]);
const aes=run([w('C:/HuginnAPP/'+out+'/aes-host')]);await writeFile(out+'/aes-host.log',aes);console.log(aes);
// The full HTTP framing/TLS-loop regression uses the newly applied scope hooks.
let send=await readFile('build/settings-send-183348-review/send-host.c','utf8');
send='int simulated_isr;\n#include <stdint.h>\nint64_t clock_us;\n'+send;
await writeFile(out+'/send-host.c',send);
run(['gcc','-std=gnu11','-Wall','-Werror','-fsanitize=address,undefined','-I'+w('C:/HuginnAPP/'+out+'/stubs'),'-I'+w(local+'/port/include'),'-I'+w(fw+'/components/esp-tls'),w('C:/HuginnAPP/'+out+'/send-host.c'),w(fw+'/components/esp-tls/huginn_settings_send_diag.c'),w(local+'/port/huginn_aes_alloc_diag.c'),'-o',w('C:/HuginnAPP/'+out+'/send-host')]);
const framing=run([w('C:/HuginnAPP/'+out+'/send-host'),'/mnt/c/HuginnAPP/build/settings-send-review/settings-full-29502.json']);
await writeFile(out+'/send-host.log',framing);console.log(framing);
