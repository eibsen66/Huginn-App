// PREPARES reviewable settings/TLS source files inside HuginnAPP only.
// Automatic approval review rejected writing HuginnEIS. This script does not do so.
import {readFile,writeFile,copyFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const root='C:/HuginnEIS/Huginn/Firmware/huginn',app='C:/HuginnAPP';
const hash=b=>createHash('sha256').update(b).digest('hex');
await mkdir(app+'/build/settings-source-baseline',{recursive:true});
async function edit(relative,fn){const path=root+'/'+relative,old=await readFile(path);const save=app+'/build/settings-source-baseline/'+relative.replaceAll('/','__');
 try{await writeFile(save,old,{flag:'wx'});}catch(e){if(e.code!=='EEXIST')throw e;}
 const next=fn(old.toString('utf8'));const proposed=app+'/build/settings-proposed/'+relative;await mkdir(proposed.slice(0,proposed.lastIndexOf('/')),{recursive:true});await writeFile(proposed,next);return {path,proposed,before:hash(old),after:hash(next)};
}
const result=[];
function replaceFunction(source,name,transform){
 const mask=source.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g,m=>m.replace(/[^\n]/g,' '));
 const match=new RegExp('\\b'+name+'\\s*\\([^;{}]*\\)\\s*\\{').exec(mask);if(!match)throw Error('Missing function '+name);const start=source.lastIndexOf('\nstatic ',match.index)+1;let p=mask.indexOf('{',match.index)+1,depth=1;for(;depth;p++){if(mask[p]==='{')depth++;if(mask[p]==='}')depth--;}
 return source.slice(0,start)+transform(source.slice(start,p))+source.slice(p);
}
result.push(await edit('main/main.c',s=>{
 if(s.includes('#include "huginn_settings_v2.inc"'))return s;
 // Share the existing catalogue computation with detached preview. The old local
 // entry points retain their behavior; previews never swap runtime globals.
 s=replaceFunction(s,'huginn_builtin_engine_profile_identity_for_settings',f=>f.replace('huginn_builtin_engine_profile_identity_for_settings(void)','huginn_builtin_engine_profile_identity_for_configuration(const HuginnSettings *settings)').replaceAll('g_settings.','settings->')+'\n\nstatic const HuginnBuiltinEngineProfileIdentity *\nhuginn_builtin_engine_profile_identity_for_settings(void)\n{ return huginn_builtin_engine_profile_identity_for_configuration(&g_settings); }');
 s=replaceFunction(s,'huginn_builtin_engine_profile_build_for_settings',f=>f.replace('huginn_builtin_engine_profile_build_for_settings(','huginn_builtin_engine_profile_build_for_configuration(\n    const HuginnSettings *settings,').replace('huginn_builtin_engine_profile_identity_for_settings()','huginn_builtin_engine_profile_identity_for_configuration(settings)')+'\n\nstatic bool huginn_builtin_engine_profile_build_for_settings(HuginnEngineProfile *out)\n{ return huginn_builtin_engine_profile_build_for_configuration(&g_settings, out); }');
 s=replaceFunction(s,'huginn_aircraft_engine_configuration_initialize_for_settings',f=>f.replace('huginn_aircraft_engine_configuration_initialize_for_settings(void)','huginn_aircraft_engine_configuration_initialize_for_configuration(const HuginnSettings *settings, HuginnAircraftEngineConfiguration *destination)').replaceAll('&g_aircraft_engine_configuration.profile','&destination->profile').replaceAll('&g_aircraft_engine_configuration','destination').replaceAll('sizeof(g_aircraft_engine_configuration)','sizeof(*destination)').replaceAll('g_aircraft_engine_configuration.','destination->').replaceAll('g_settings.','settings->').replace('huginn_builtin_engine_profile_build_for_settings(active)','huginn_builtin_engine_profile_build_for_configuration(settings, active)')+'\n\nstatic void huginn_aircraft_engine_configuration_initialize_for_settings(void)\n{ huginn_aircraft_engine_configuration_initialize_for_configuration(&g_settings, &g_aircraft_engine_configuration); }');
 s=s.replace('static bool huginn_http_api_register_routes(',`#if defined(HUGINN_DEV_HTTPS_AVAILABLE)
static esp_err_t huginn_settings_v2_handler(httpd_req_t *request);
static esp_err_t huginn_settings_v2_preflight(httpd_req_t *request);
static void huginn_settings_v2_json_init(void);
#endif
static bool huginn_http_api_register_routes(`);
 s=s.replace('static esp_err_t huginn_http_api_options_handler(', '#if defined(HUGINN_DEV_HTTPS_AVAILABLE)\nstatic esp_err_t huginn_settings_v2_preflight(httpd_req_t *request);\n#endif\nstatic esp_err_t huginn_http_api_options_handler(');
 s=s.replace('static esp_err_t huginn_http_api_options_handler(', '#if defined(HUGINN_DEV_HTTPS_AVAILABLE)\nstatic esp_err_t huginn_settings_v2_preflight(httpd_req_t *request);\n#endif\nstatic esp_err_t huginn_http_api_options_handler(');
 s=s.replace('    const char *courier_prefix = "/api/v1/flights";',`#if defined(HUGINN_DEV_HTTPS_AVAILABLE)
    if (!strncmp(request->uri, "/api/v2/settings", 16)) return huginn_settings_v2_preflight(request);
#endif
    const char *courier_prefix = "/api/v1/flights";`);
 s=s.replace('    /* Before the OPTIONS catch-all, so Courier owns its 405/Allow policy. */',`#if defined(HUGINN_DEV_HTTPS_AVAILABLE)
    if (include_https_root) {
        const httpd_uri_t settings_v2_get = {.uri="/api/v2/settings",.method=HTTP_GET,.handler=huginn_settings_v2_handler,.user_ctx=NULL};
        const httpd_uri_t settings_v2_post = {.uri="/api/v2/settings/*",.method=HTTP_POST,.handler=huginn_settings_v2_handler,.user_ctx=NULL};
        if(httpd_register_uri_handler(server,&settings_v2_get)!=ESP_OK || httpd_register_uri_handler(server,&settings_v2_post)!=ESP_OK) return false;
    }
#endif
    /* Before the OPTIONS catch-all, so Courier owns its 405/Allow policy. */`);
 s=s.replace('    config.httpd.max_uri_handlers = 16U;','    config.httpd.max_uri_handlers = 18U;');
 s=s.replace('    config.httpd.max_open_sockets = 2U;',`    config.httpd.max_open_sockets = 2U;
    /* ESP_ERR_HTTPD_TASK in 2026-11-02 diagnostics: internal largest=7680,
     * required stack=10240. IDF 5.5.2 creates/deletes this stack WithCaps.
     * Keep stack size/TLS/services; NVS writes remain in the LVGL owner. */
    config.httpd.task_caps = MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT;`);
 s=s.replace('    const esp_err_t https_start_err = httpd_ssl_start(', '    huginn_settings_v2_json_init();\n    const esp_err_t https_start_err = httpd_ssl_start(');
 // Legacy valid package schemas remain supported, through the same bearer/origin protection.
 s=s.replace('    HuginnSettingsTransferCandidate candidate;\n    HuginnSettingsTransferApplyComplete complete;', '    HuginnSettingsTransferCandidate candidate;\n    uint64_t authorization_epoch;\n    HuginnSettingsTransferApplyComplete complete;');
 s=s.replaceAll('    const HuginnSettingsTransferCandidate *candidate,\n    HuginnSettingsTransferApplyComplete complete,', '    const HuginnSettingsTransferCandidate *candidate,\n    uint64_t authorization_epoch,\n    HuginnSettingsTransferApplyComplete complete,');
 s=s.replace('    request->candidate = *candidate;', '    request->candidate = *candidate;\n    request->authorization_epoch = authorization_epoch;');
 s=s.replace('    if (!huginn_settings_transfer_candidate_valid(&request->candidate)) {', '    if (!hfa_current(request->authorization_epoch) || !huginn_settings_transfer_candidate_valid(&request->candidate)) {');
 s=s.replace('    if (!huginn_settings_transfer_apply_request(\n            &proposed,', '    if (!huginn_settings_transfer_apply_request(\n            &proposed, authorization_epoch,');
 const guard=`static esp_err_t huginn_settings_http_authorize(httpd_req_t *request, uint64_t *epoch, hfa_headers_t *headers)
{
    hfa_status_t status = hfa_request(request, epoch, headers);
    if (status != HFA_OK) { hfa_http_error(request, status); return ESP_FAIL; }
    hfa_cors(request, headers); hfa_scrub_request(request); return ESP_OK;
}
`;
 s=s.replace('static esp_err_t huginn_https_settings_transfer_apply_handler(',guard+'\nstatic esp_err_t huginn_https_settings_transfer_apply_handler(');
 for(const name of ['apply','preview','verify']){
  const signature='static esp_err_t huginn_https_settings_transfer_'+name+'_handler(httpd_req_t *request)\n{';
  s=s.replace(signature,signature+'\n    uint64_t authorization_epoch = 0;\n    hfa_headers_t authorization_headers; /* Response origin remains alive until send. */\n    if(huginn_settings_http_authorize(request, &authorization_epoch, &authorization_headers) != ESP_OK) return ESP_OK;\n');
 }
 // Do not append wildcard CORS to an admitted settings response.
 s=s.replace('    httpd_resp_set_hdr(request, "Access-Control-Allow-Origin", "*");', '    if (strncmp(request->uri, "/api/v1/settings-transfer/", 26))\n        httpd_resp_set_hdr(request, "Access-Control-Allow-Origin", "*");');
 s=s.replace('    if (!strncmp(request->uri, "/api/v2/settings", 16))', '    if (!strncmp(request->uri, "/api/v1/settings-transfer/", 26) || !strcmp(request->uri, "/api/v1/config")) return huginn_settings_v2_preflight(request);\n    if (!strncmp(request->uri, "/api/v2/settings", 16))');
 s=s.replace('"route_capacity max=16 production=10 dev_flight=5 dev_manual=1 local_only=%u"','"route_capacity max=18 production=12 dev_flight=5 dev_manual=1 local_only=%u"');
 s=s.replace('static void build_settings_screen(void)\n{','#include "huginn_settings_v2.inc"\n\nstatic void build_settings_screen(void)\n{').replace('static void build_settings_screen(void)\r\n{','#include "huginn_settings_v2.inc"\r\n\r\nstatic void build_settings_screen(void)\r\n{');
 if(!s.includes('#include "huginn_settings_v2.inc"'))throw Error('include anchor');return s;
}));
result.push(await edit('main/CMakeLists.txt',s=>s.includes('        json')?s:s.replace('        huginn_settings_transfer_v1','        json\n        huginn_settings_transfer_v1')));
result.push(await edit('components/huginn_flight_courier/CMakeLists.txt',s=>s.replace('    if(NOT HUGINN_FLIGHT_LOG_DEV_TEST AND NOT HUGINN_DEV_DOWNLOAD_ONLY)\r\n        message(FATAL_ERROR "Courier browser origin requires HUGINN_FLIGHT_LOG_DEV_TEST=ON")\r\n    endif()','    # A normal HuginnEIS build may admit one exact configured browser origin.').replace('    if(NOT HUGINN_FLIGHT_LOG_DEV_TEST AND NOT HUGINN_DEV_DOWNLOAD_ONLY)\n        message(FATAL_ERROR "Courier browser origin requires HUGINN_FLIGHT_LOG_DEV_TEST=ON")\n    endif()','    # A normal HuginnEIS build may admit one exact configured browser origin.')));
result.push(await edit('components/huginn_settings_transfer_v1/huginn_settings_transfer_v1.cpp',s=>s.includes('const char *const products[]')?s:s.replace('namespace {','namespace {\nstatic const char *const products[] = {"Muninn", "HuginnAPP"};').replace('!parser.exact_string("Muninn")','!one_of_string(parser, products, 2U, nullptr)')));
await copyFile(app+'/protocol/firmware/huginn_settings_v2.inc',app+'/build/settings-proposed/main/huginn_settings_v2.inc');
await writeFile(app+'/build/settings-source-baseline/changes.json',JSON.stringify(result,null,2));
await writeFile(app+'/build/settings-source-baseline/empty','');
let patch='';
for(const entry of [...result,{path:root+'/main/huginn_settings_v2.inc',proposed:app+'/build/settings-proposed/main/huginn_settings_v2.inc',added:true}]){
 const relative=entry.path.slice(root.length+1),base=entry.added?app+'/build/settings-source-baseline/empty':app+'/build/settings-source-baseline/'+relative.replaceAll('/','__');let diff='';
 try{diff=execFileSync('git',['-c','core.autocrlf=false','diff','--no-index','--no-ext-diff','--text','--',base,entry.proposed],{encoding:'utf8',windowsHide:true});}catch(e){if(e.status!==1)throw e;diff=e.stdout;}
 if(!diff)continue;const destination='Huginn/Firmware/huginn/'+relative;
 diff=diff.replace(/^diff --git .*$/m,'diff --git a/'+destination+' b/'+destination+(entry.added?'\nnew file mode 100644':'')).replace(/^--- .*$/m,entry.added?'--- /dev/null':'--- a/'+destination).replace(/^\+\+\+ .*$/m,'+++ b/'+destination);
 if(entry.added)diff=diff.replace(/^index [a-f0-9]+\.\./m,'index 0000000..');patch+=diff;
}
await writeFile(app+'/protocol/settings-v2-firmware.patch',patch);
console.log('Settings source prepared inside HuginnAPP only. HuginnEIS is unchanged.');
