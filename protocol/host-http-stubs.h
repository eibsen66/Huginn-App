/* Compile-only SDK boundary declarations, never bundled or flashed. */
typedef int esp_err_t;typedef int lv_res_t;
typedef struct {int method;size_t content_len;const char *uri;} httpd_req_t;
typedef enum {HFA_OK,HFA_REQUIRED,HFA_INVALID,HFA_REVOKED,HFA_ORIGIN} hfa_status_t;
typedef struct {char authorization[52],origin[128],content_type[48],content_length[24];unsigned authorization_count,origin_count,content_type_count,content_length_count,transfer_count;} hfa_headers_t;
#define HTTP_GET 0
#define HTTP_POST 1
#define HTTPD_400_BAD_REQUEST 400
#define HTTPD_500_INTERNAL_SERVER_ERROR 500
#define ESP_FAIL -1
#define WIFI_IF_AP 1
#define LV_RES_OK 0
#define pdTRUE 1
#define pdMS_TO_TICKS(x) (x)
extern hfa_status_t hfa_request(const httpd_req_t *,uint64_t *,hfa_headers_t *);
extern void hfa_cors(httpd_req_t *,const hfa_headers_t *);
extern void hfa_scrub_request(const httpd_req_t *);
extern bool hfa_headers(const httpd_req_t *,hfa_headers_t *);
extern bool hfa_origin(const char *,size_t,unsigned);
extern esp_err_t hfa_http_error(httpd_req_t *,hfa_status_t);
extern int httpd_req_recv(httpd_req_t *,char *,size_t);
extern int httpd_resp_send_err(httpd_req_t *,int,const char *);
extern int httpd_resp_set_status(httpd_req_t *,const char *);
extern int httpd_resp_set_type(httpd_req_t *,const char *);
extern int httpd_resp_set_hdr(httpd_req_t *,const char *,const char *);
extern int httpd_resp_sendstr(httpd_req_t *,const char *);
extern int httpd_resp_send(httpd_req_t *,const char *,int);
extern SemaphoreHandle_t xSemaphoreCreateBinary(void);
extern int xSemaphoreTake(SemaphoreHandle_t,int);
extern bool lvgl_port_lock(int);
extern void lvgl_port_unlock(void);
extern lv_res_t lv_async_call(void (*)(void *),void *);
extern int esp_wifi_get_mac(int,uint8_t *);
extern int mbedtls_sha256(const unsigned char *,size_t,unsigned char *,int);
