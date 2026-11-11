import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root='C:/HuginnEIS/Huginn/Firmware/huginn',out='build/rev210-review',sha=b=>createHash('sha256').update(b).digest('hex');
await mkdir(out,{recursive:false});
const paths=['main/huginn_settings_v2.inc','main/main.c','CMakeLists.txt'],before={};
for(const p of paths){const b=await readFile(root+'/'+p);before[p]=sha(b);await writeFile(out+'/'+p.replaceAll('/','__')+'.before',b,{flag:'wx'});}
let s=(await readFile(root+'/'+paths[0],'utf8')).replaceAll('\r\n','\n');
function replace(a,b){if(!s.includes(a))throw Error('Missing source context');s=s.replace(a,b);}
replace('static bool hs2_snapshot(Hs2Config *c) {',`enum {
    HS2_DENIAL_NONE, HS2_DENIAL_MODAL, HS2_DENIAL_LIVE,
    HS2_DENIAL_PERSISTENCE, HS2_DENIAL_SNAPSHOT_ALLOC, HS2_DENIAL_SNAPSHOT_BASELINE
};
static bool hs2_snapshot(Hs2Config *c, uint8_t *denial_reason) {`);
replace('    HuginnCommittedConfigSnapshot *s = hs2_alloc(sizeof(*s));\n    if (!s) {\n        return false;',`    HuginnCommittedConfigSnapshot *s = hs2_alloc(sizeof(*s));
    if (!s) {
        if (denial_reason) {
            *denial_reason = HS2_DENIAL_SNAPSHOT_ALLOC;
        }
        return false;`);
replace('    bool ok = huginn_committed_config_snapshot_copy(s);\n    if (ok) {',`    bool ok = huginn_committed_config_snapshot_copy(s);
    if (!ok && denial_reason) {
        *denial_reason = HS2_DENIAL_SNAPSHOT_BASELINE;
    }
    if (ok) {`);
replace('static bool hs2_resolve_engine(Hs2Config *c) {',`/* Preserve original admission order and short-circuit evaluation. */
static uint8_t hs2_admission(Hs2Config *base) {
    if (g_settings_modal) {
        return HS2_DENIAL_MODAL;
    }
    if (!huginn_live_authority_available()) {
        return HS2_DENIAL_LIVE;
    }
    if (huginn_settings_persistence_inhibited()) {
        return HS2_DENIAL_PERSISTENCE;
    }
    uint8_t reason = HS2_DENIAL_NONE;
    (void)hs2_snapshot(base, &reason);
    return reason;
}
static bool hs2_resolve_engine(Hs2Config *c) {`);
replace('    bool apply;\n    char device', '    bool apply;\n    uint8_t denial_reason;\n    char device');
replace('    if (g_settings_modal || !huginn_live_authority_available() ||\n        huginn_settings_persistence_inhibited() || !hs2_snapshot(base)) {',`    j->denial_reason = hs2_admission(base);
    if (j->denial_reason != HS2_DENIAL_NONE) {`);
replace('if (!hs2_snapshot(candidate))', 'if (!hs2_snapshot(candidate, NULL))');
replace('static esp_err_t huginn_settings_v2_handler(httpd_req_t *request) {',`static const char *hs2_denial_name(uint8_t reason) {
    switch (reason) {
        case HS2_DENIAL_MODAL: return "modal";
        case HS2_DENIAL_LIVE: return "live_unavailable";
        case HS2_DENIAL_PERSISTENCE: return "persistence_inhibited";
        case HS2_DENIAL_SNAPSHOT_ALLOC: return "snapshot_alloc_failed";
        case HS2_DENIAL_SNAPSHOT_BASELINE: return "snapshot_baseline_missing";
        default: return NULL;
    }
}
static void hs2_log_get_denial(bool get, uint8_t reason) {
    const char *name = get ? hs2_denial_name(reason) : NULL;
    if (name) {
        const int saved_errno = errno;
        ESP_LOGW("HS2_ADMISSION", "GET denied reason=%s", name);
        errno = saved_errno;
    }
}
static esp_err_t huginn_settings_v2_handler(httpd_req_t *request) {`);
replace('            httpd_resp_set_status(request, "409 Conflict");', '            httpd_resp_set_status(request, "409 Conflict");\n            hs2_log_get_denial(get, j->denial_reason);');
await writeFile(root+'/'+paths[0],s);
for(const p of paths.slice(1)){const b=await readFile(root+'/'+p,'utf8');if(!b.includes('HuginnEIS Rev. 2.9'))throw Error('Revision context');await writeFile(root+'/'+p,b.replaceAll('HuginnEIS Rev. 2.9','HuginnEIS Rev. 2.10'));}
await writeFile(out+'/before.json',JSON.stringify({paths,before},null,2)+'\n');
console.log('Scoped Rev2.10 admission diagnostic prepared. No build or device access.');
