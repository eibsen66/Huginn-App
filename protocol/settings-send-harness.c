/* Host-only SDK call-chain reproduction; TLS I/O is explicitly injected. */
#include <assert.h>
#include <errno.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/types.h>
#define MBEDTLS_SSL_OUT_CONTENT_LEN 4096
#define ESP_TLS_ERR_SSL_WANT_READ (-0x6900)
#define ESP_TLS_ERR_SSL_WANT_WRITE (-0x6880)
#define ESP_OK 0
#define ESP_FAIL (-1)
#define HTTPS_SERVER_EVENT_ERROR 0
#define HTTPS_SERVER_EVENT_SENT_DATA 1
#define ESP_INT_EVENT_TRACKER_CAPTURE(...) ((void)0)
#define ESP_LOGD(...) ((void)0)
#define ESP_LOGE(...) ((void)0)
#define ESP_LOGW(tag,...) ((void)printf(__VA_ARGS__))
#define LOG_FMT(x) x
typedef int esp_err_t;
typedef void *esp_tls_error_handle_t;
typedef struct {int ssl;void *error_handle;} esp_tls_t;
typedef struct {esp_tls_t *tls;} httpd_ssl_transport_ctx_t;
typedef struct {int last_error,esp_tls_error_code,esp_tls_flags;} esp_https_server_last_error_t;
typedef void *httpd_handle_t;
static uint8_t sent[131073];static size_t sent_count,attempt_count,cutoff;
static int mode,transient_count;
static esp_tls_t tls;
static httpd_ssl_transport_ctx_t transport={&tls};
static int mbedtls_ssl_write(int *ssl,const unsigned char *data,size_t n) {
    (void)ssl;attempt_count++;
    if (sent_count>=cutoff) {
        if (mode==1 && transient_count++<2) return ESP_TLS_ERR_SSL_WANT_WRITE;
        if (mode==2) return -0x004e; /* injected hard net-send failure */
        if (mode==3 && transient_count++<1) return ESP_TLS_ERR_SSL_WANT_READ;
    }
    assert(sent_count+n<=sizeof(sent));memcpy(sent+sent_count,data,n);sent_count+=n;return (int)n;
}
static void mbedtls_print_error_msg(ssize_t r) {(void)r;}
/* EXTRACTED_TLS */
static ssize_t esp_tls_conn_write(esp_tls_t *t,const void *p,size_t n){return esp_mbedtls_write(t,p,n);}
static void *httpd_sess_get_transport_ctx(httpd_handle_t h,int fd){(void)h;(void)fd;return &transport;}
static int esp_tls_get_error_handle(esp_tls_t *t,esp_tls_error_handle_t *h){(void)t;*h=NULL;return ESP_OK;}
static int esp_tls_get_and_clear_last_error(esp_tls_error_handle_t h,int *a,int *b){(void)h;*a=0;*b=0;return 0;}
static void http_dispatch_event_to_event_loop(int a,void *b,size_t c){(void)a;(void)b;(void)c;}
/* EXTRACTED_HTTPS */
struct sock_db {void *handle;int fd;int (*send_fn)(httpd_handle_t,int,const char *,size_t,int);};
struct httpd_req_aux {struct sock_db *sd;};
typedef struct {void *aux;} httpd_req_t;
/* EXTRACTED_HTTP */
static int run(const uint8_t *body,size_t n,int inject,size_t boundary) {
    sent_count=attempt_count=0;mode=inject;cutoff=boundary;transient_count=0;
    struct sock_db socket={NULL,1,httpd_ssl_send};struct httpd_req_aux aux={&socket};httpd_req_t req={&aux};
    const int result=httpd_send_all(&req,(const char *)body,n);
    assert(sent_count<=n);assert(memcmp(sent,body,sent_count)==0);return result;
}
int main(int argc,char **argv) {
    assert(argc==2);FILE *f=fopen(argv[1],"rb");assert(f);uint8_t *full=malloc(131073);assert(full);
    size_t n=fread(full,1,29502,f);assert(n==29502);assert(fgetc(f)==EOF);assert(fclose(f)==0);
    for(size_t i=n;i<131073;i++)full[i]=' ';
    const size_t sizes[]={4234,16383,16384,16385,20479,20480,20481,24576,29502,131072};
    for(size_t i=0;i<sizeof(sizes)/sizeof(sizes[0]);i++){assert(run(full,sizes[i],0,20480)==ESP_OK);assert(sent_count==sizes[i]);}
    puts("PASS actual SDK send functions: 10 sizes including flight 4234 and full Settings 29502; exact byte identity");
    assert(run(full,29502,1,20480)==ESP_FAIL);assert(sent_count==20480);
    puts("PASS injected two consecutive WANT_WRITE: actual HTTPD fails at 20480; 9022 unsent (hypothesis reproduction, not physical proof)");
    assert(run(full,29502,3,20480)==ESP_OK);assert(sent_count==29502);
    puts("PASS injected one WANT_READ after partial progress: positive partial return lets HTTPD finish all 29502 bytes");
    assert(run(full,29502,2,20480)==ESP_FAIL);assert(sent_count==20480);
    puts("PASS injected hard write failure also stops at 20480: same symptom, distinct mechanism");
    assert(run(full,4234,1,20480)==ESP_OK);assert(sent_count==4234);
    puts("PASS flight-sized response never reaches injected failure boundary");
    free(full);return 0;
}
