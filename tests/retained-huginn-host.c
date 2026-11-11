/* Inspection calls actual read_slot/scan_file and Courier policy, not a second parser.
 * No recovery/writer entry point is called on the preserved backup. */
#include "huginn_flight_manifest.c"
#include "huginn_flight_courier.h"
#include <assert.h>
#include "huginn_flight_courier_http.h"
#include "huginn_flight_log.h"
/* Only OS/RTOS/Wi-Fi are synthetic; body below is extracted verbatim from MAIN. */
#define ESP_OK 0
#define pdTRUE 1
#define WIFI_IF_AP 1
static const char *inspection_root;
static bool g_sd_mounted=true,g_flight_manifest_ready=true,g_wifi_initialized=true;
static void *g_flight_courier_owner=(void*)1;
static huginn_flight_manifest_t g_flight_manifest;
static HuginnFlightLog g_flight_log;
static int xSemaphoreTake(void*s,unsigned wait){(void)s;(void)wait;return 1;}
static void xSemaphoreGive(void*s){(void)s;}
static int esp_wifi_get_mac(int iface,uint8_t m[6]){(void)iface;const uint8_t fixture[6]={0x14,0xc1,0x9f,0x5b,0x21,0x50};memcpy(m,fixture,6);return 0;}
FILE *__real_fopen(const char *,const char *);
int __real_stat(const char *,struct stat *);
static const char *mapped(const char *path,char buffer[512]){const char *prefix="/sdcard/HUGINN";if(!strncmp(path,prefix,strlen(prefix))){snprintf(buffer,512,"%s%s",inspection_root,path+strlen(prefix));return buffer;}return path;}
FILE *__wrap_fopen(const char*p,const char*m){char b[512];return __real_fopen(mapped(p,b),m);}
int __wrap_stat(const char*p,struct stat*s){char b[512];return __real_stat(mapped(p,b),s);}

#include "retained-snapshot.inc"
static void entry_json(const huginn_flight_manifest_entry_t *e){
 char id[33];hfc_session_text(e->session_id,id);
 printf("{\"filename\":\"%.15s\",\"session_id\":\"%s\",\"start_utc\":\"%lld\",\"end_utc\":\"%lld\",\"runtime_us\":\"%llu\",\"valid_bytes\":%u,\"record_count\":%u,\"state\":%u,\"integrity\":%u,\"transfer_state\":%u}",e->filename,id,(long long)e->start_utc,(long long)e->end_utc,(unsigned long long)e->runtime_us,e->valid_bytes,e->record_count,e->state,e->integrity,e->transfer_state);
}
int main(int argc,char **argv){
 assert(argc==2||argc==3);const char *root=argv[1];inspection_root=root;
 bool recovered=false;
 if(argc==3){assert(!strcmp(argv[2],"recover-disposable"));assert(!strcmp(root,HUGINN_DISPOSABLE_ROOT));huginn_flight_manifest_t disposable={0};recovered=huginn_flight_manifest_recover(root,&disposable);assert(recovered);}
huginn_flight_manifest_t m={0};HfmGenerationBaseline baseline={0};
 printf("{\"slots\":[");
 for(unsigned slot=0;slot<2;slot++){
  const char *leaf=slot?"MANIFEST.B":"MANIFEST.A";uint32_t gen=0;bool dirty=false;
  HfmSlotResult s=read_slot(root,leaf,&m,&gen,&dirty);
  if(slot)printf(",");printf("{\"slot\":\"%s\",\"result\":\"%s\",\"generation\":%u,\"dirty\":%s,\"entries\":[",leaf,slot_result_name(s),gen,dirty?"true":"false");
  if(s==HFM_SLOT_VALID)for(unsigned i=0;i<m.count;i++){if(i)printf(",");printf("{\"metadata_consistent\":%s,\"entry\":",referenced_entry_valid(root,&m.entries[i])?"true":"false");entry_json(&m.entries[i]);printf("}");}
  printf("]}");
 }
 bool ordered=read_generation_baseline(root,&baseline),valid=huginn_flight_manifest_load_valid(root,&m);
 printf("],\"selected_slot\":\"%s\",\"slot_order_valid\":%s,\"load_valid\":%s,\"scans\":[",baseline.newest_slot,ordered?"true":"false",valid?"true":"false");
 char folder[256];snprintf(folder,sizeof(folder),"%s/FLIGHT",root);DIR *d=opendir(folder);assert(d);struct dirent *f;unsigned n=0;
 while((f=readdir(d))){if(!filename_valid(f->d_name))continue;char full[512];snprintf(full,sizeof(full),"%s/%s",folder,f->d_name);huginn_flight_manifest_entry_t e={0};HfmScanResult s=scan_file(full,f->d_name,&e);if(n++)printf(",");printf("{\"result\":\"%s\",\"entry\":",scan_result_name(s));entry_json(&e);printf("}");}
 closedir(d);printf("],\"recovery_on_disposable\":%s,\"pages\":[",recovered?"true":"false");
 g_flight_manifest=m;hfc_snapshot_t snapshot={0};assert(huginn_flight_courier_snapshot(&snapshot)==HFC_SNAPSHOT_OK);
 uint8_t nonce[16]={7};hfc_query_t q={.limit=8};uint16_t ordinal=0;char json[HFC_LIST_BYTES];unsigned page=0;
 while(ordinal<snapshot.count){if(page++)printf(",");assert(hfc_list_encode(&snapshot,&q,nonce,ordinal,json,sizeof(json)));printf("%s",json);if(ordinal+q.limit>=snapshot.count)break;char cursor[39];assert(hfc_cursor_encode(snapshot.generation,nonce,ordinal+q.limit,q.limit,cursor));assert(hfc_cursor_decode(cursor,&snapshot,nonce,q.limit,&ordinal)==HFC_OK);}
 printf("]}");return 0;
}
