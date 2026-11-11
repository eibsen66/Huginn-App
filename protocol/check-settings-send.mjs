// Host compilation of extracted SDK send functions. No firmware build/device I/O.
import {readFile,writeFile,mkdir} from 'node:fs/promises';import {createHash} from 'node:crypto';import {execFileSync} from 'node:child_process';import {settingsHost} from '../tests/settings-protocol-host.mjs';
const out='build/settings-send-review',sdk='C:/esp/v5.5.2/esp-idf',fw='C:/HuginnEIS/Huginn/Firmware/huginn';await mkdir(out,{recursive:true});
const paths={tls:sdk+'/components/esp-tls/esp_tls_mbedtls.c',https:sdk+'/components/esp_https_server/src/https_server.c',http:sdk+'/components/esp_http_server/src/httpd_txrx.c',settings:fw+'/main/huginn_settings_v2.inc',main:fw+'/main/main.c',list:fw+'/components/huginn_flight_courier/huginn_flight_courier_http.c',config:fw+'/build-rev2.2-20261102/sdkconfig'};
const text={},pins={};for(const [k,p]of Object.entries(paths)){const b=await readFile(p);text[k]=b.toString();pins[p]=createHash('sha256').update(b).digest('hex');}
function extract(s,signature){const start=s.indexOf(signature);if(start<0)throw Error('Missing '+signature);let i=s.indexOf('{',start),depth=1,j=i+1;for(;depth&&j<s.length;j++){if(s[j]==='{')depth++;if(s[j]==='}')depth--;}if(depth)throw Error('Unbalanced');return s.slice(start,j);}
const h=settingsHost();let doc;try{doc=await h.request({method:'get'});}finally{h.close();}
const full=Buffer.from(JSON.stringify(doc));if(full.length>29502)throw Error('Fixture exceeds measured response');const measured=Buffer.alloc(29502,32);full.copy(measured);await writeFile(out+'/settings-full-29502.json',measured);
const functions={tls:extract(text.tls,'ssize_t esp_mbedtls_write('),https:extract(text.https,'static int httpd_ssl_send('),http:extract(text.http,'static esp_err_t httpd_send_all(')};
const prelude=await readFile('protocol/settings-send-harness.c','utf8');
const source=prelude.replace('/* EXTRACTED_TLS */',functions.tls).replace('/* EXTRACTED_HTTPS */',functions.https).replace('/* EXTRACTED_HTTP */',functions.http);
await writeFile(out+'/send-test.c',source);await writeFile(out+'/source-pins.json',JSON.stringify(pins,null,2)+'\n');
execFileSync('wsl',['-d','Ubuntu','--exec','gcc','-std=c11','-Wall','-Werror','-fsanitize=undefined','-g','/mnt/c/HuginnAPP/'+out+'/send-test.c','-o','/mnt/c/HuginnAPP/'+out+'/send-test'],{windowsHide:true,stdio:'pipe'});
const results=execFileSync('wsl',['-d','Ubuntu','--exec','/mnt/c/HuginnAPP/'+out+'/send-test','/mnt/c/HuginnAPP/'+out+'/settings-full-29502.json'],{windowsHide:true,encoding:'utf8'});await writeFile(out+'/host-results.log',results);console.log(results);
// Prepare diagnostic-only source copies and exact patches. Never write either project/SDK.
const old='        result = httpd_resp_sendstr(request, response);';if(text.settings.split(old).length!==2)throw Error('Settings seam changed');
const replacement=`        const size_t response_bytes = strlen(response);
        const int64_t send_start_us = esp_timer_get_time();
        ESP_LOGI("HS2_SEND", "begin bytes=%u", (unsigned)response_bytes);
        errno = 0;
        result = httpd_resp_send(request, response, (ssize_t)response_bytes);
        const int send_errno = errno;
        const int64_t send_elapsed_us = esp_timer_get_time() - send_start_us;
        ESP_LOGI("HS2_SEND", "end bytes=%u result=%d errno_snapshot=%d elapsed_us=%lld",
                 (unsigned)response_bytes, (int)result, send_errno,
                 (long long)send_elapsed_us);`;
const oldTls='    int ret = esp_tls_conn_write(tls, buf, buf_len);';if(text.https.split(oldTls).length!==2)throw Error('TLS seam changed');
const replacementTls=`    int ret = esp_tls_conn_write(tls, buf, buf_len);
    const int send_errno = errno;
    if (ret <= 0) {
        ESP_LOGW(TAG, "send_nonpositive ret=%d errno_snapshot=%d requested=%u",
                 ret, send_errno, (unsigned)buf_len);
    }`;
const proposedHttps=text.https.replace('#include <string.h>','#include <string.h>\n#include <errno.h>').replace(oldTls,replacementTls);
const proposedSettings=text.settings.replace('#include "cJSON.h"','#include "cJSON.h"\n#include <errno.h>').replace(old,replacement);
for(const [name,before,after,label]of [['firmware',text.settings,proposedSettings,'Huginn/Firmware/huginn/main/huginn_settings_v2.inc'],['idf552',text.https,proposedHttps,'components/esp_https_server/src/https_server.c']]){
 await writeFile(out+'/'+name+'.before',before);await writeFile(out+'/'+name+'.proposed',after);
 const d=execFileSync('wsl',['-d','Ubuntu','--exec','sh','-c',`diff -u --label a/${label} --label b/${label} /mnt/c/HuginnAPP/${out}/${name}.before /mnt/c/HuginnAPP/${out}/${name}.proposed; result=$?; if [ "$result" -le 1 ]; then exit 0; else exit "$result"; fi`],{windowsHide:true,encoding:'utf8'});await writeFile('protocol/settings-send-'+name+'-diagnostic.patch',d);
}
// Compile and execute the exact proposed SDK diagnostic function too: same send results/bytes.
await writeFile(out+'/send-proposed-test.c',source.replace(functions.https,extract(proposedHttps,'static int httpd_ssl_send(')));
execFileSync('wsl',['-d','Ubuntu','--exec','gcc','-std=c11','-Wall','-Werror','-fsanitize=undefined','/mnt/c/HuginnAPP/'+out+'/send-proposed-test.c','-o','/mnt/c/HuginnAPP/'+out+'/send-proposed-test'],{windowsHide:true,stdio:'pipe'});
await writeFile(out+'/host-proposed-results.log',execFileSync('wsl',['-d','Ubuntu','--exec','/mnt/c/HuginnAPP/'+out+'/send-proposed-test','/mnt/c/HuginnAPP/'+out+'/settings-full-29502.json'],{windowsHide:true,encoding:'utf8'}));
for(const [p,hash]of Object.entries(pins))if(createHash('sha256').update(await readFile(p)).digest('hex')!==hash)throw Error('Read-only source changed '+p);
await writeFile(out+'/result.json',JSON.stringify({host_send_tests_pass:true,real_settings_json_bytes:full.length,padded_measured_size:measured.length,source_pins:pins,physical_cause_proven:false,app_changed:false,firmware_or_sdk_applied:false},null,2)+'\n');
