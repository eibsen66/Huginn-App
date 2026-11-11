import {mkdir,writeFile,readFile} from 'node:fs/promises';import {execFileSync} from 'node:child_process';
const root='C:/HuginnEIS/Huginn/Firmware/huginn',out='C:/HuginnAPP/build/pairing-review/host';await mkdir(out,{recursive:true});
await writeFile(out+'/lvgl.h',`#pragma once
#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>
#define LV_USE_QRCODE 1
#define LV_EVENT_CLICKED 1
#define LV_EVENT_DELETE 2
#define LV_OBJ_FLAG_SCROLLABLE 1
#define LV_OPA_COVER 255
#define LV_CANVAS_BUF_SIZE_INDEXED_1BIT(w,h) (((w)*(h)+7)/8+8)
typedef struct {} lv_event_t;typedef void(*lv_event_cb_t)(lv_event_t*);
typedef struct lv_obj_t{struct lv_obj_t *parent;bool button;char caption[64];lv_event_cb_t callback;int event;} lv_obj_t;
typedef struct{unsigned full;}lv_color_t;typedef struct{struct{int w,h;}header;unsigned char *data;}lv_img_dsc_t;
extern int lv_font_montserrat_20;
lv_obj_t *lv_obj_create(lv_obj_t*);lv_obj_t *lv_btn_create(lv_obj_t*);lv_obj_t *lv_label_create(lv_obj_t*);
void lv_label_set_text(lv_obj_t*,const char*);void lv_label_set_text_static(lv_obj_t*,const char*);
void lv_obj_add_event_cb(lv_obj_t*,lv_event_cb_t,int,void*);void lv_obj_del(lv_obj_t*);
lv_obj_t *lv_qrcode_create(lv_obj_t*,int,lv_color_t,lv_color_t);lv_img_dsc_t *lv_canvas_get_img(lv_obj_t*);
void lv_canvas_fill_bg(lv_obj_t*,lv_color_t,int);void lv_canvas_set_px_color(lv_obj_t*,int,int,lv_color_t);
static inline lv_color_t lv_color_white(void){return(lv_color_t){1};}static inline lv_color_t lv_color_black(void){return(lv_color_t){0};}static inline lv_color_t lv_color_hex(unsigned n){return(lv_color_t){n};}
#define lv_obj_set_pos(...) ((void)0)
#define lv_obj_set_size(...) ((void)0)
#define lv_obj_set_width(...) ((void)0)
#define lv_obj_set_style_text_color(...) ((void)0)
#define lv_obj_set_style_text_font(...) ((void)0)
#define lv_obj_set_style_bg_color(...) ((void)0)
#define lv_obj_clear_flag(...) ((void)0)
#define lv_obj_center(...) ((void)0)
`);
await writeFile(out+'/esp_heap_caps.h','#pragma once\n#include <stddef.h>\n#define MALLOC_CAP_8BIT 4\nvoid *heap_caps_malloc(size_t,unsigned);void heap_caps_free(void*);\n');
await writeFile(out+'/esp_random.h','#pragma once\n#include <stddef.h>\nvoid esp_fill_random(void*,size_t);\n');
await writeFile(out+'/esp_http_server.h','#pragma once\ntypedef struct httpd_req httpd_req_t;typedef int esp_err_t;\n');
await writeFile(out+'/host-config.h','#define MBEDTLS_SHA256_C\n');
const w=p=>p.replace('C:/','/mnt/c/'),sdk='C:/esp/v5.5.2/esp-idf/components/mbedtls/mbedtls',component=root+'/components/huginn_flight_courier',lvgl=root+'/components/lvgl__lvgl';
const args=['gcc','-std=c11','-Wall','-Werror','-Werror=misleading-indentation','-fsanitize=address,undefined','-pthread','-DLV_CONF_SKIP','-DLV_USE_QRCODE=1','-DMBEDTLS_CONFIG_FILE="host-config.h"',... [out,root+'/main',component+'/include',lvgl,sdk+'/include'].map(p=>'-I'+w(p)),w('C:/HuginnAPP/protocol/pairing-ui-host.c'),w(component+'/huginn_flight_authorization.c'),w(lvgl+'/src/extra/libs/qrcode/qrcodegen.c'),w(sdk+'/library/sha256.c'),w(sdk+'/library/platform_util.c'),'-o',w(out+'/pairing-ui-host')];
args.push('-Wl,--wrap=hfa_pair');
execFileSync('wsl',['-d','Ubuntu','--exec',...args],{windowsHide:true,stdio:'pipe'});
const result=execFileSync('wsl',['-d','Ubuntu','--exec',w(out+'/pairing-ui-host')],{windowsHide:true,encoding:'utf8'});await writeFile(out+'/result.log',result);console.log(result);
