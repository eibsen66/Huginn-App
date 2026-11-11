// Host execution of the applied Settings HTTP boundary with the real counter module.
import {readFile,writeFile} from 'node:fs/promises';import {execFileSync} from 'node:child_process';
const out='C:/HuginnAPP/build/rev23-preparation',linux=p=>p.replace(/^C:/,'/mnt/c'),fw='/mnt/c/HuginnEIS/Huginn/Firmware/huginn';
let code=await readFile('build/settings-protocol-host/http-syntax.c','utf8');code=code.slice(0,code.indexOf('int main(void){'));
code=code.replace('static void *heap_caps_calloc','static void *test_alloc(size_t);\nstatic void test_free(void *);\nstatic void *heap_caps_calloc').replace('return calloc(n,b);','return test_alloc(n*b);');
code=code.replace('#include "/mnt/c/HuginnAPP/build/settings-protocol-host/settings.inc"','#define free test_free\n#define ESP_LOGI(tag,...) ((void)printf(__VA_ARGS__))\n#include "/mnt/c/HuginnEIS/Huginn/Firmware/huginn/main/huginn_settings_v2.inc"\n#undef free');
code+='\nuintptr_t simulated_task=1;\n';
let tests=await readFile('protocol/http-cleanup-host.c','utf8');
tests=tests.replace('SemaphoreHandle_t xSemaphoreCreateBinary',`int httpd_resp_send(httpd_req_t *r,const char *s,int n) { (void)r;assert(n>=0 && (size_t)n==strlen(s));if(scenario==16){errno=EPIPE;return ESP_FAIL;}return ESP_OK; }
SemaphoreHandle_t xSemaphoreCreateBinary`);
tests=tests.replace('200,409,500,500};','200,409,500,500,200};').replace('scenario<16','scenario<17').replace('if (scenario==4) { assert(result==ESP_FAIL); }','if (scenario==4 || scenario==16) { assert(result==ESP_FAIL); }').replace('if (scenario==12)','if (scenario==12 || scenario==16)').replace('PASS 16 actual','PASS 17 applied diagnostic');
code+=tests;await writeFile(out+'/cleanup.c',code);
execFileSync('wsl',['-d','Ubuntu','--exec','gcc','-std=c11','-Wall','-Wextra','-Werror','-Werror=misleading-indentation','-Wno-unused-function','-Wno-sign-compare','-Wno-format-truncation','-fsanitize=address,undefined','-fno-sanitize-recover=all','-ffunction-sections','-fdata-sections','-I'+linux(out)+'/stubs','-I/mnt/c/HuginnAPP/build/settings-protocol-host','-I'+fw+'/main','-I'+fw+'/components/esp-tls','-I/mnt/c/esp/v5.5.2/esp-idf/components/json/cJSON',linux(out+'/cleanup.c'),fw+'/components/esp-tls/huginn_settings_send_diag.c',fw+'/main/huginn_ports.c',fw+'/main/huginn_aux.c','/mnt/c/esp/v5.5.2/esp-idf/components/json/cJSON/cJSON.c','-Wl,--gc-sections','-lm','-lcrypto','-o',linux(out+'/cleanup')],{windowsHide:true,stdio:'pipe'});
const result=execFileSync('wsl',['-d','Ubuntu','--exec',linux(out+'/cleanup')],{windowsHide:true,encoding:'utf8'});await writeFile(out+'/cleanup.log',result);console.log(result);
