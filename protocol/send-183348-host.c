/* Actual SDK functions; underlying real SSL operation is deliberately injected. */
#include <assert.h>
#include <errno.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/types.h>
/* IDF's signed response-length type is 32-bit; preserve that printf contract. */
#define ssize_t int
#include "huginn_settings_send_diag.h"
uintptr_t simulated_task=1;
#define ESP_LOGD(...) ((void)0)
#define ESP_LOGE(...) ((void)0)
#define ESP_INT_EVENT_TRACKER_CAPTURE(...) ((void)0)
#define LOG_FMT(x) x
#define MBEDTLS_PRIVATE(x) x
#define CHECK_OK(fn) do {int r=(fn);if(r)return r;} while(0)
#define MBEDTLS_SSL_OUT_CONTENT_LEN 4096
#define ESP_TLS_ERR_SSL_WANT_READ (-0x6900)
#define ESP_TLS_ERR_SSL_WANT_WRITE (-0x6880)
#define ESP_OK 0
#define ESP_FAIL (-1)
#define ESP_ERR_INVALID_ARG 0x102
#define ESP_ERR_HTTPD_INVALID_REQ 0xb003
#define ESP_ERR_HTTPD_RESP_HDR 0xb005
#define ESP_ERR_HTTPD_RESP_SEND 0xb006
#define ESP_ERR_HTTPD_ALLOC_MEM 0xb007
#define HTTPD_RESP_USE_STRLEN (-1)
#define HTTPS_SERVER_EVENT_ERROR 0
#define HTTPS_SERVER_EVENT_SENT_DATA 1
#define HTTP_SERVER_EVENT_HEADERS_SENT 2
#define HTTP_SERVER_EVENT_SENT_DATA 3
typedef int esp_err_t;typedef void *httpd_handle_t;typedef void *esp_tls_error_handle_t;
typedef struct {int out_left;} mbedtls_ssl_context;
typedef struct {mbedtls_ssl_context ssl;void *error_handle;} esp_tls_t;
typedef struct {esp_tls_t *tls;} httpd_ssl_transport_ctx_t;
typedef struct {int last_error,esp_tls_error_code,esp_tls_flags;} esp_https_server_last_error_t;
static unsigned char body[29503];static size_t accepted;static unsigned calls;static int fault,previous_real;
static int esp_mbedtls_add_tx_buffer(mbedtls_ssl_context *s,size_t n){(void)s;(void)n;return 0;}
static int esp_mbedtls_free_tx_buffer(mbedtls_ssl_context *s){(void)s;return fault==2 && previous_real<0?-0x7f00:0;}
static int tx_done(mbedtls_ssl_context *s){return !s->out_left;}
static int __real_mbedtls_ssl_write(mbedtls_ssl_context *s,unsigned char *p,size_t n){
 (void)s;calls++;const uintptr_t pos=(uintptr_t)p,start=(uintptr_t)body;int in_body=pos>=start&&pos<start+29502;
 int ret=(fault && in_body && pos-start>=8192)?-1:(int)n;previous_real=ret;
 if(ret>0 && in_body)accepted+=(size_t)ret;
 if(fault==1)printf("call=%u kind=%s offset=%ld requested=%zu real_return=%d errno=%d\n",calls,in_body?"body":"header",in_body?(long)(pos-start):-1L,n,ret,errno);
 return ret;
}
/* WRAPPER */
#define mbedtls_ssl_write __wrap_mbedtls_ssl_write
static void mbedtls_print_error_msg(ssize_t n){(void)n;}
/* TLS */
static ssize_t esp_tls_conn_write(esp_tls_t *t,const void *p,size_t n){return esp_mbedtls_write(t,p,n);}
static esp_tls_t tls;static httpd_ssl_transport_ctx_t ctx={&tls};
static void *httpd_sess_get_transport_ctx(httpd_handle_t h,int fd){(void)h;(void)fd;return &ctx;}
static int esp_tls_get_error_handle(esp_tls_t *t,esp_tls_error_handle_t *h){(void)t;*h=NULL;return 0;}
static int esp_tls_get_and_clear_last_error(esp_tls_error_handle_t h,int *a,int *b){(void)h;*a=0;*b=0;return 0;}
static void http_dispatch_event_to_event_loop(int n,void *p,size_t b){(void)n;(void)p;(void)b;}
/* HTTPS */
struct sock_db {void *handle;int fd;int (*send_fn)(httpd_handle_t,int,const char *,size_t,int);};
struct response_header {const char *field,*value;};
struct httpd_req_aux {struct sock_db *sd;const char *status,*content_type;unsigned resp_hdrs_count,req_hdrs_count;size_t max_req_hdr_len;struct response_header resp_hdrs[4];};
typedef struct {struct httpd_req_aux *aux;} httpd_req_t;
typedef struct {int fd;ssize_t data_len;} esp_http_server_event_data;
static int httpd_valid_req(httpd_req_t *r){return r&&r->aux;}
static void esp_http_server_dispatch_event(int n,void *p,size_t b){(void)n;(void)p;(void)b;}
/* SEND_ALL */
/* RESPONSE */
int main(int argc,char **argv){
 assert(argc==2);FILE *fixture=fopen(argv[1],"rb");assert(fixture);assert(fread(body,1,29502,fixture)==29502);assert(fgetc(fixture)==EOF);assert(fclose(fixture)==0);body[29502]=0;
 struct sock_db sock={NULL,1,httpd_ssl_send};struct httpd_req_aux aux={.sd=&sock,.status="200 OK",.content_type="application/json",.resp_hdrs_count=4,.max_req_hdr_len=1024,
 .resp_hdrs={{"Access-Control-Allow-Origin","https://huginnapp-pwa-test.pages.dev"},{"Access-Control-Expose-Headers","ETag, Content-Range, Content-Length, Accept-Ranges, Retry-After"},{"Vary","Origin"},{"Cache-Control","no-store"}}};httpd_req_t req={&aux};
 for(fault=0;fault<3;fault++){
  calls=0;accepted=0;errno=104;uint32_t id;assert(huginn_settings_send_diag_begin(body,29502,&id));int result=httpd_resp_send(&req,(char*)body,29502);huginn_settings_send_diag_t d;assert(huginn_settings_send_diag_end(&d));
  if(fault){assert(result==45062 && calls==21 && accepted==8192 && d.accepted==8192 && d.tls_calls==21);assert(d.tls_requested==4096 && d.https_requested==29502);assert(d.tls_return==(fault==1?-1:-0x7f00));}
  else assert(result==0 && calls==26 && accepted==29502 && d.accepted==29502);
 }
 puts("PASS actual HTTP framing/TLS/dynamic-wrapper functions: 18 header calls plus 3 body calls reproduce aggregate 21; no socket call required to preserve stale errno=104");
 puts("PASS dynamic-wrapper cleanup failure overrides underlying -1 with -0x7f00; raw_tls is post-wrapper, not an unwrapped trace");return 0;
}
