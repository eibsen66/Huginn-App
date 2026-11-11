// Authorized source preparation. Stage in HuginnAPP; --apply writes only named EIS files.
import {readFile,writeFile,readdir,mkdir,cp,stat} from 'node:fs/promises';import {createHash} from 'node:crypto';import {execFileSync} from 'node:child_process';
const fw='C:/HuginnEIS/Huginn/Firmware/huginn',sdk='C:/esp/v5.5.2/esp-idf',out='build/rev23-preparation',hash=b=>createHash('sha256').update(b).digest('hex');
await mkdir(out,{recursive:true});
async function inventory(root){const values={};async function walk(prefix=''){for(const d of await readdir(root+'/'+prefix,{withFileTypes:true})){const p=prefix+d.name;if(d.isDirectory())await walk(p+'/');else if(d.isFile())values[p]=hash(await readFile(root+'/'+p));else throw Error('Unexpected entry '+p);}}await walk();return values;}
if(!process.argv.includes('--apply')){
 const roots={main:fw+'/main',components:fw+'/components',rev22:fw+'/build-rev2.2-20261102',https:sdk+'/components/esp_https_server',tls:sdk+'/components/esp-tls'};
 const preservation={};for(const [key,path]of Object.entries(roots))preservation[key]={path,files:await inventory(path)};
 preservation.root={};for(const p of ['CMakeLists.txt','main/main.c','main/huginn_settings_v2.inc'])preservation.root[p]=hash(await readFile(fw+'/'+p));
 await writeFile(out+'/before.json',JSON.stringify(preservation,null,2));
 for(const p of ['CMakeLists.txt','main/main.c','main/huginn_settings_v2.inc']){await mkdir(out+'/before/'+p.slice(0,Math.max(0,p.lastIndexOf('/'))),{recursive:true});await cp(fw+'/'+p,out+'/before/'+p);}
 for(const name of ['esp-tls','esp_https_server'])await cp(sdk+'/components/'+name,out+'/components/'+name,{recursive:true,force:true});
 let settings=await readFile(fw+'/main/huginn_settings_v2.inc','utf8');
 // The reviewed diagnostic patches are checked before creating their scoped extension.
 execFileSync('git',['-c','safe.directory=C:/HuginnEIS','-C','C:/HuginnEIS','apply','--check','C:/HuginnAPP/protocol/settings-send-firmware-diagnostic.patch']);
 execFileSync('git',['-c','safe.directory='+sdk,'-C',sdk,'apply','--check','C:/HuginnAPP/protocol/settings-send-idf552-diagnostic.patch']);
 const expected='        result = httpd_resp_sendstr(request, response);';if(settings.split(expected).length!==2)throw Error('Settings seam');
 settings=settings.replace('#include "cJSON.h"','#include "cJSON.h"\n#include <errno.h>\n#include "huginn_settings_send_diag.h"');
 settings=settings.replace(expected,`        const size_t response_bytes = strlen(response);
        uint32_t measurement_id = 0;
        const bool measuring = request->method == HTTP_GET &&
            cJSON_IsArray(hs2_get(j->response, "fields")) &&
            huginn_settings_send_diag_begin(response, response_bytes, &measurement_id);
        const int64_t send_start_us = esp_timer_get_time();
        if (measuring) {
            ESP_LOGI("HS2_SEND", "begin id=%u bytes=%u", (unsigned)measurement_id,
                     (unsigned)response_bytes);
        }
        /* Same explicit length/framing as sendstr; do not change errno before send. */
        result = httpd_resp_send(request, response, (ssize_t)response_bytes);
        const int send_errno = errno;
        const int64_t send_elapsed_us = esp_timer_get_time() - send_start_us;
        huginn_settings_send_diag_t diagnostic;
        if (measuring && huginn_settings_send_diag_end(&diagnostic)) {
            ESP_LOGI("HS2_SEND", "end id=%u bytes=%u tls_body_accepted=%u http_result=%d "
                     "http_errno=%d raw_tls=%d tls_errno=%d tls_requested=%u "
                     "https_return=%d https_errno=%d https_requested=%u calls=%u elapsed_us=%lld",
                     (unsigned)diagnostic.id, (unsigned)response_bytes,
                     (unsigned)diagnostic.accepted, (int)result, send_errno,
                     diagnostic.tls_return, diagnostic.tls_errno, (unsigned)diagnostic.tls_requested,
                     diagnostic.https_return, diagnostic.https_errno,
                     (unsigned)diagnostic.https_requested, diagnostic.tls_calls,
                     (long long)send_elapsed_us);
        }
        errno = send_errno;`);
 await writeFile(out+'/settings.inc',settings);
 for(const p of ['CMakeLists.txt','main/main.c']){let s=await readFile(fw+'/'+p,'utf8');if(!s.includes('HuginnEIS Rev. 2.2'))throw Error('Revision changed');s=s.replaceAll('HuginnEIS Rev. 2.2','HuginnEIS Rev. 2.3');if(p==='CMakeLists.txt')s+="\n# Fail configuration if the measured 5.5.2 component overrides are not selected.\nforeach(_hs2_component esp-tls esp_https_server)\n    idf_component_get_property(_hs2_path ${_hs2_component} COMPONENT_DIR)\n    if(NOT _hs2_path STREQUAL \"${CMAKE_CURRENT_LIST_DIR}/components/${_hs2_component}\")\n        message(FATAL_ERROR \"Rev. 2.3 diagnostic component not selected: ${_hs2_component}\")\n    endif()\nendforeach()\n";await writeFile(out+'/'+(p==='main/main.c'?'main.c':'CMakeLists.txt'),s);}
 const tls=out+'/components/esp-tls',https=out+'/components/esp_https_server';
 for(const p of ['huginn_settings_send_diag.h','huginn_settings_send_diag.c'])await cp('protocol/rev23/'+p,tls+'/'+p);
 let cm=await readFile(tls+'/CMakeLists.txt','utf8');cm=cm.replace('set(srcs esp_tls.c','set(srcs huginn_settings_send_diag.c esp_tls.c');await writeFile(tls+'/CMakeLists.txt',cm);
 let source=await readFile(tls+'/esp_tls_mbedtls.c','utf8');source='#include "huginn_settings_send_diag.h"\n#include <errno.h>\n'+source;
 const call='        ssize_t ret = mbedtls_ssl_write(&tls->ssl, (unsigned char*) data + written, write_len);';if(source.split(call).length!==2)throw Error('TLS seam');source=source.replace(call,call+'\n        const int hs2_errno = errno;\n        huginn_settings_send_diag_tls(data + written, write_len, (int)ret, hs2_errno);\n        errno = hs2_errno;');await writeFile(tls+'/esp_tls_mbedtls.c',source);
 source=await readFile(https+'/src/https_server.c','utf8');source='#include "huginn_settings_send_diag.h"\n#include <errno.h>\n'+source;const send='    int ret = esp_tls_conn_write(tls, buf, buf_len);';if(source.split(send).length!==2)throw Error('HTTPS seam');source=source.replace(send,send+'\n    const int hs2_errno = errno;\n    huginn_settings_send_diag_https(buf_len, ret, hs2_errno);\n    errno = hs2_errno;');await writeFile(https+'/src/https_server.c',source);
 console.log('Staged Rev. 2.3; shared SDK and firmware unchanged.');
}else{
 const before=JSON.parse(await readFile(out+'/before.json','utf8'));
 for(const [p,h]of Object.entries(before.root))if(hash(await readFile(fw+'/'+p))!==h)throw Error('Existing source changed '+p);
 for(const name of ['esp-tls','esp_https_server']){try{await stat(fw+'/components/'+name);throw Error('Override already exists');}catch(e){if(e.code!=='ENOENT')throw e;}}
 for(const name of ['esp-tls','esp_https_server'])await cp(out+'/components/'+name,fw+'/components/'+name,{recursive:true,errorOnExist:true,force:false});
 for(const [a,b]of [['settings.inc','main/huginn_settings_v2.inc'],['main.c','main/main.c'],['CMakeLists.txt','CMakeLists.txt']])await cp(out+'/'+a,fw+'/'+b);
 const sdkPins={sdk_version:'5.5.2',original:{},local:{}};for(const name of ['esp-tls','esp_https_server']){sdkPins.original[name]=await inventory(sdk+'/components/'+name);sdkPins.local[name]=await inventory(fw+'/components/'+name);}
 await writeFile(out+'/diagnostic-inputs.json',JSON.stringify(sdkPins,null,2));
 // Check original shared SDK, all Rev. 2.2 evidence and every unrelated old source byte.
 for(const key of ['https','tls','rev22'])if(JSON.stringify(await inventory(before[key].path))!==JSON.stringify(before[key].files))throw Error('Preservation mismatch '+key);
 for(const key of ['main','components'])for(const [p,h]of Object.entries(before[key].files)){if(key==='main'&&['main.c','huginn_settings_v2.inc'].includes(p))continue;if(hash(await readFile(before[key].path+'/'+p))!==h)throw Error('Unrelated source changed '+p);}
 await writeFile(out+'/applied.json',JSON.stringify({revision:'HuginnEIS Rev. 2.3',shared_sdk_unchanged:true,rev22_unchanged:true,unrelated_sources_unchanged:true,diagnostic_inputs:sdkPins},null,2));console.log('Applied authorized scoped diagnostics and revision; SDK/Rev. 2.2 preserved.');
}
