/* Host-only faults. No SDK/device I/O. ASan/UBSan plus explicit allocation balance. */
static void *tracked[256];
static unsigned alloc_count, free_count, fail_alloc;
static int scenario, status, receives;
static const char *payload;
static void (*deferred)(void *);
static void *deferred_arg;
static void *test_alloc(size_t n) {
    alloc_count++;
    if (fail_alloc == alloc_count) { alloc_count--; return NULL; }
    void *p = calloc(1, n); assert(p);
    for (unsigned i=0;i<256;i++) { if (!tracked[i]) { tracked[i]=p; return p; } }
    abort();
}
static void test_free(void *p) {
    if (p) { for (unsigned i=0;i<256;i++) { if (tracked[i]==p) { tracked[i]=NULL; free_count++; break; } } }
    free(p);
}
hfa_status_t hfa_request(const httpd_req_t *r,uint64_t *epoch,hfa_headers_t *h) {
    (void)r; memset(h,0,sizeof(*h)); *epoch=1; h->content_type_count=1;
    strcpy(h->content_type,"application/json"); return scenario==1?HFA_REQUIRED:HFA_OK;
}
void hfa_cors(httpd_req_t *r,const hfa_headers_t *h) { (void)r;(void)h; }
void hfa_scrub_request(const httpd_req_t *r) { (void)r; }
int hfa_http_error(httpd_req_t *r,hfa_status_t s) { (void)r;(void)s;status=401;return 0; }
int httpd_req_recv(httpd_req_t *r,char *p,size_t n) {
    (void)r;receives++;if (scenario==4) { return -1; }
    memcpy(p,payload,n);return (int)n;
}
int httpd_resp_send_err(httpd_req_t *r,int s,const char *m) { (void)r;(void)m;status=s;return 0; }
int httpd_resp_set_status(httpd_req_t *r,const char *s) { (void)r;status=atoi(s);return 0; }
int httpd_resp_set_type(httpd_req_t *r,const char *s) { (void)r;(void)s;return 0; }
int httpd_resp_set_hdr(httpd_req_t *r,const char *a,const char *b) { (void)r;(void)a;(void)b;return 0; }
int httpd_resp_sendstr(httpd_req_t *r,const char *s) { (void)r;(void)s;return 0; }
SemaphoreHandle_t xSemaphoreCreateBinary(void) { return scenario==3?NULL:(void *)1; }
int xSemaphoreTake(SemaphoreHandle_t s,int t) { (void)s;(void)t;return scenario==10?0:1; }
bool lvgl_port_lock(int t) { (void)t;return scenario!=8; }
void lvgl_port_unlock(void) { }
lv_res_t lv_async_call(void (*fn)(void *),void *p) {
    if (scenario==9) { return -1; }
    if (scenario==10) { deferred=fn;deferred_arg=p;return 0; }
    fn(p);if (scenario==11) { authorized=false; }return 0;
}
int esp_wifi_get_mac(int which,uint8_t *mac) { (void)which;memcpy(mac,"\xAA\xBB\xCC\xDD\xEE\xFF",6);return scenario==14?-1:0; }
int mbedtls_sha256(const unsigned char *p,size_t n,unsigned char *out,int is224) {
    (void)is224;if (scenario==5) { return -1; }SHA256(p,n,out);return 0;
}
int main(void) {
    memset(protected_state,0x11,sizeof(protected_state));
    memset(fuel_state,0x22,sizeof(fuel_state));
    memset(fault_state,0x33,sizeof(fault_state));
    memset(recordings,0x44,sizeof(recordings));
    huginn_aircraft_engine_configuration_initialize_for_settings();
    huginn_ports_default_configuration(&runtime_ports);committed.settings=g_settings;
    committed.ports_configuration=runtime_ports;committed.config_revision=17;
    const char *valid="{\"schema\":\"huginn.settings-transfer\",\"schema_version\":2,\"product\":\"HuginnAPP\",\"source_device_id\":\"AA:BB:CC:DD:EE:FF\",\"base_revision\":17,\"changes\":[]}";
    const int expected[]={200,401,500,500,200,500,400,400,500,500,504,401,200,409,500,500};
    for (scenario=0;scenario<16;scenario++) {
        alloc_count=free_count=0;fail_alloc=scenario==2?1:scenario==15?2:0;
        authorized=true;status=200;receives=0;deferred=NULL;payload=valid;
        if (scenario==6) { payload="[[[[[[[[[0]]]]]]]]]"; }
        if (scenario==7) { payload="{invalid}"; }
        if (scenario==13) { payload="[]"; }
        httpd_req_t request={HTTP_POST,strlen(payload),"/api/v2/settings/preview"};
        if (scenario==12) { request.method=HTTP_GET;request.uri="/api/v2/settings";request.content_len=0; }
        int result=huginn_settings_v2_handler(&request);
        if (scenario==4) { assert(result==ESP_FAIL); }
        assert(status==expected[scenario]);
        if (deferred) { deferred(deferred_arg); }
        assert(alloc_count==free_count);
        for (unsigned i=0;i<256;i++) { assert(!tracked[i]); }
        for (unsigned i=0;i<sizeof(protected_state);i++) { assert(protected_state[i]==0x11); }
        for (unsigned i=0;i<sizeof(fuel_state);i++) { assert(fuel_state[i]==0x22); }
        for (unsigned i=0;i<sizeof(fault_state);i++) { assert(fault_state[i]==0x33); }
        for (unsigned i=0;i<sizeof(recordings);i++) { assert(recordings[i]==0x44); }
    }
    puts("PASS 16 actual HTTP handler success/error paths; body/job allocations balanced, ASan/UBSan clean, including guard-skipped parse, parse failure, recv/digest/alloc failures, busy/queue/timeout/revocation and GET/POST success");
    return 0;
}
