#define _GNU_SOURCE
#include "huginn_flight_authorization.h"
#include "esp_httpd_priv.h"
#include <assert.h>
#include <stdio.h>
#include <string.h>
esp_err_t httpd_resp_set_status(httpd_req_t *r,const char *s){snprintf(r->status,sizeof(r->status),"%s",s);return ESP_OK;}
esp_err_t httpd_resp_set_type(httpd_req_t *r,const char *s){snprintf(r->type,sizeof(r->type),"%s",s);return ESP_OK;}
esp_err_t httpd_resp_set_hdr(httpd_req_t *r,const char *k,const char *v){assert(r->header_count<8);unsigned n=r->header_count++;snprintf(r->header_keys[n],32,"%s",k);snprintf(r->header_values[n],128,"%s",v);return ESP_OK;}
esp_err_t httpd_resp_send(httpd_req_t *r,const char *s,ssize_t n){if(n<0)n=(ssize_t)strlen(s);assert(n<16384);if(n)memcpy(r->body,s,(size_t)n);r->body[n]=0;return ESP_OK;}
static char scratch[512];static struct httpd_req_aux aux;static httpd_req_t req;
static void request(const char *token,const char *origin,bool duplicate){
 memset(&req,0,sizeof(req));memset(&aux,0,sizeof(aux));memset(scratch,0,sizeof(scratch));size_t n=0;
 if(token){n+=(size_t)snprintf(scratch+n,sizeof(scratch)-n,"Authorization: Bearer %s",token)+1;aux.req_hdrs_count++;if(duplicate){n+=(size_t)snprintf(scratch+n,sizeof(scratch)-n,"Authorization: Bearer %s",token)+1;aux.req_hdrs_count++;}}
 if(origin){n+=(size_t)snprintf(scratch+n,sizeof(scratch)-n,"Origin: %s",origin)+1;aux.req_hdrs_count++;}
 aux.scratch=scratch;aux.scratch_cur_size=n;aux.max_req_hdr_len=sizeof(scratch)-1;req.aux=&aux;
}
int main(void){uint8_t entropy[32];memset(entropy,0x36,sizeof(entropy));char token[44];assert(hfa_pair(entropy,token));uint64_t epoch=0;hfa_headers_t headers;
 request(NULL,NULL,false);assert(hfa_request(&req,&epoch,&headers)==HFA_REQUIRED);
 request(token,NULL,false);assert(hfa_request(&req,&epoch,&headers)==HFA_OK&&hfa_current(epoch));
 request(token,"https://huginnapp-pwa-test.pages.dev",false);assert(hfa_request(&req,&epoch,&headers)==HFA_OK);assert(!headers.authorization[0]);hfa_cors(&req,&headers);assert(!strcmp(req.header_values[0],"https://huginnapp-pwa-test.pages.dev"));hfa_scrub_request(&req);assert(!memmem(scratch,sizeof(scratch),token,43));
 request(token,"https://untrusted.example",false);assert(hfa_request(&req,&epoch,&headers)==HFA_ORIGIN);
 request(token,"null",false);assert(hfa_request(&req,&epoch,&headers)==HFA_ORIGIN);
 request(token,"https://huginnapp-pwa-test.pages.dev",true);assert(hfa_request(&req,&epoch,&headers)==HFA_INVALID);
 request(token,"https://huginnapp-pwa-test.pages.dev",false);assert(hfa_request(&req,&epoch,&headers)==HFA_OK);hfa_revoke();assert(!hfa_current(epoch));request(token,NULL,false);assert(hfa_request(&req,&epoch,&headers)==HFA_INVALID);
 hfa_http_error(&req,HFA_INVALID);assert(!strstr(req.body,token));assert(!strcmp(req.status,"401 Unauthorized"));
 request(NULL,"https://huginnapp-pwa-test.pages.dev",false);assert(hfa_preflight(&req)==ESP_OK);assert(!strcmp(req.status,"204 No Content"));bool authorization=false,post=false;for(unsigned i=0;i<req.header_count;i++){if(!strcmp(req.header_keys[i],"Access-Control-Allow-Headers"))authorization=strstr(req.header_values[i],"Authorization")!=NULL;if(!strcmp(req.header_keys[i],"Access-Control-Allow-Methods"))post=strstr(req.header_values[i],"POST")!=NULL;}assert(authorization&&post);
 puts("PASS real bearer/origin/duplicate-header/revocation/scrubbing/CORS host checks; no live TLS claim");return 0;
}
