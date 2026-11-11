import {readFile,writeFile,mkdir} from 'node:fs/promises';import {execFileSync} from 'node:child_process';
const out='build/rev23-preparation',stage=out+'/components';
for(const p of ['stubs/freertos'])await mkdir(out+'/'+p,{recursive:true});
await writeFile(out+'/stubs/freertos/FreeRTOS.h','#pragma once\n#include <stdint.h>\ntypedef int portMUX_TYPE;\n#define portMUX_INITIALIZER_UNLOCKED 0\n#define portENTER_CRITICAL(p) ((void)(p))\n#define portEXIT_CRITICAL(p) ((void)(p))\n');
await writeFile(out+'/stubs/freertos/task.h','#pragma once\n#include <stdint.h>\ntypedef void *TaskHandle_t;\nextern uintptr_t simulated_task;\nstatic inline TaskHandle_t xTaskGetCurrentTaskHandle(void){return (void*)simulated_task;}\n');
function extract(s,sig){const a=s.indexOf(sig);if(a<0)throw Error(sig);let i=s.indexOf('{',a),n=1,j=i+1;for(;n;j++){if(s[j]==='{')n++;if(s[j]==='}')n--;}return s.slice(a,j);}
const tls=await readFile(stage+'/esp-tls/esp_tls_mbedtls.c','utf8'),https=await readFile(stage+'/esp_https_server/src/https_server.c','utf8'),http=await readFile('C:/esp/v5.5.2/esp-idf/components/esp_http_server/src/httpd_txrx.c','utf8');
let harness=await readFile('protocol/settings-send-harness.c','utf8');harness='#include "huginn_settings_send_diag.h"\nuintptr_t simulated_task=1;\n'+harness;
harness=harness.replace('/* EXTRACTED_TLS */',extract(tls,'ssize_t esp_mbedtls_write(')).replace('/* EXTRACTED_HTTPS */',extract(https,'static int httpd_ssl_send(')).replace('/* EXTRACTED_HTTP */',extract(http,'static esp_err_t httpd_send_all('));
harness=harness.replace('const int result=httpd_send_all(&req,(const char *)body,n);',`uint32_t id;assert(huginn_settings_send_diag_begin(body,n,&id));
    const int result=httpd_send_all(&req,(const char *)body,n);
    huginn_settings_send_diag_t d;assert(huginn_settings_send_diag_end(&d));
    assert(d.id==id && d.expected==n && d.accepted==sent_count);
    if (inject==1 && n>20480) { assert(d.tls_return==ESP_TLS_ERR_SSL_WANT_WRITE && d.https_return==ESP_TLS_ERR_SSL_WANT_WRITE); }
    if (inject==2 && n>20480) { assert(d.tls_return==-0x004e && d.https_return==-0x004e && d.accepted==20480); }
    assert(!huginn_settings_send_diag_end(&d));`);
harness=harness.replace('free(full);return 0;',`uint32_t id;errno=19;assert(huginn_settings_send_diag_begin(full,29502,&id));assert(errno==19);
    simulated_task=2;huginn_settings_send_diag_tls(full,4096,4096,7);assert(errno==19);
    huginn_settings_send_diag_t d;assert(!huginn_settings_send_diag_end(&d));
    simulated_task=1;huginn_settings_send_diag_tls("header",6,6,0);huginn_settings_send_diag_tls(full,4096,4096,11);
    assert(errno==19);assert(huginn_settings_send_diag_end(&d));assert(errno==19);assert(d.accepted==4096 && d.tls_errno==11 && d.tls_calls==2);
    puts("PASS diagnostic scope, foreign-task exclusion, header exclusion, errno preservation, scope release and exact partial-progress counters");
    free(full);return 0;`);
await writeFile(out+'/diag-host.c',harness);
execFileSync('wsl',['-d','Ubuntu','--exec','gcc','-std=c11','-Wall','-Werror','-fsanitize=address,undefined','-I/mnt/c/HuginnAPP/'+out+'/stubs','-I/mnt/c/HuginnAPP/'+stage+'/esp-tls','/mnt/c/HuginnAPP/'+out+'/diag-host.c','/mnt/c/HuginnAPP/'+stage+'/esp-tls/huginn_settings_send_diag.c','-o','/mnt/c/HuginnAPP/'+out+'/diag-host'],{windowsHide:true,stdio:'pipe'});
const result=execFileSync('wsl',['-d','Ubuntu','--exec','/mnt/c/HuginnAPP/'+out+'/diag-host','/mnt/c/HuginnAPP/build/settings-send-review/settings-full-29502.json'],{windowsHide:true,encoding:'utf8'});await writeFile(out+'/diag-host.log',result);console.log(result);
