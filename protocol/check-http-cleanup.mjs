// Execute the actual HTTP handler with host transport/queue/allocation fault seams.
import {readFile,writeFile} from 'node:fs/promises';import {execFileSync} from 'node:child_process';
const out='C:/HuginnAPP/build/settings-protocol-host',linux=p=>p.replace(/^C:/,'/mnt/c');
let code=await readFile(out+'/http-syntax.c','utf8');
const start=code.indexOf('int main(void){');if(start<0)throw Error('Missing host main');code=code.slice(0,start);
code=code.replace('static void *heap_caps_calloc', 'static void *test_alloc(size_t);\nstatic void test_free(void *);\nstatic void *heap_caps_calloc').replace('return calloc(n,b);','return test_alloc(n*b);');
code=code.replace('#include "'+linux(out)+'/settings.inc"','#define free test_free\n#include "'+linux(out)+'/settings.inc"\n#undef free');
code+=await readFile('protocol/http-cleanup-host.c','utf8');await writeFile(out+'/http-cleanup.c',code);
const root='/mnt/c/HuginnEIS/Huginn/Firmware/huginn';
execFileSync('wsl',['-d','Ubuntu','--exec','gcc','-std=c11','-Wall','-Wextra','-Werror','-Werror=misleading-indentation','-Wno-unused-function','-Wno-sign-compare','-Wno-format-truncation','-fsanitize=address,undefined','-fno-sanitize-recover=all','-ffunction-sections','-fdata-sections','-I'+linux(out),'-I'+root+'/main','-I/mnt/c/esp/v5.5.2/esp-idf/components/json/cJSON',linux(out+'/http-cleanup.c'),root+'/main/huginn_ports.c',root+'/main/huginn_aux.c','/mnt/c/esp/v5.5.2/esp-idf/components/json/cJSON/cJSON.c','-Wl,--gc-sections','-lm','-lcrypto','-o',linux(out+'/http-cleanup')],{stdio:'inherit',windowsHide:true});
execFileSync('wsl',['-d','Ubuntu','--exec',linux(out+'/http-cleanup')],{stdio:'inherit',windowsHide:true});
