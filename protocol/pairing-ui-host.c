/* Actual pairing UI and authorization code; LVGL, entropy/readiness are fixtures. */
#include <assert.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "lvgl.h"
#include "huginn_flight_authorization.h"
static lv_obj_t objects[1024],*buttons[128];static unsigned object_count,button_count,random_calls;
static bool ready=true,allocation_failure;static unsigned char pixels[12808];
static unsigned pair_calls;
bool __real_hfa_pair(const uint8_t raw[32],char text[44]);
bool __wrap_hfa_pair(const uint8_t raw[32],char text[44]){++pair_calls;return __real_hfa_pair(raw,text);}
static lv_img_dsc_t image={.header={320,320},.data=pixels};
int lv_font_montserrat_20;
lv_obj_t *lv_obj_create(lv_obj_t *p){assert(object_count<1024);lv_obj_t *o=&objects[object_count++];memset(o,0,sizeof(*o));o->parent=p;return o;}
lv_obj_t *lv_btn_create(lv_obj_t *p){lv_obj_t *o=lv_obj_create(p);o->button=true;buttons[button_count++]=o;return o;}
lv_obj_t *lv_label_create(lv_obj_t *p){return lv_obj_create(p);}
void lv_label_set_text(lv_obj_t *o,const char *s){if(o->parent&&o->parent->button)snprintf(o->parent->caption,sizeof(o->parent->caption),"%s",s);}
void lv_label_set_text_static(lv_obj_t *o,const char *s){(void)o;(void)s;}
void lv_obj_add_event_cb(lv_obj_t *o,lv_event_cb_t cb,int type,void *data){(void)data;o->callback=cb;o->event=type;}
void lv_obj_del(lv_obj_t *o){button_count=0;if(o->event==LV_EVENT_DELETE&&o->callback)o->callback(NULL);}
lv_obj_t *lv_qrcode_create(lv_obj_t *p,int side,lv_color_t a,lv_color_t b){(void)side;(void)a;(void)b;return lv_obj_create(p);}
lv_img_dsc_t *lv_canvas_get_img(lv_obj_t *o){(void)o;return &image;}
void lv_canvas_fill_bg(lv_obj_t *o,lv_color_t c,int opacity){(void)o;(void)c;(void)opacity;memset(pixels,255,sizeof(pixels));}
void lv_canvas_set_px_color(lv_obj_t *o,int x,int y,lv_color_t c){(void)o;(void)x;(void)y;(void)c;}
void *heap_caps_malloc(size_t n,unsigned caps){(void)caps;return allocation_failure?NULL:malloc(n);}
void heap_caps_free(void *p){free(p);}
void esp_fill_random(void *p,size_t n){++random_calls;memset(p,(int)random_calls,n);}
static bool identity(char device[18],uint8_t spki[32]){if(!ready)return false;strcpy(device,"AA:BB:CC:DD:EE:FF");memset(spki,6,32);return true;}
#include "huginn_flight_pairing_ui.c"
static void click(const char *name){for(unsigned i=0;i<button_count;i++)if(!strcmp(buttons[i]->caption,name)){lv_event_cb_t cb=buttons[i]->callback;cb(NULL);return;}assert(!"button missing");}
static bool has(const char *name){for(unsigned i=0;i<button_count;i++)if(!strcmp(buttons[i]->caption,name))return true;return false;}
int main(void){
 hfp_ui_open(NULL,identity);assert(!hfa_active());click("Pair Flight Courier");assert(random_calls==1&&hfa_active()&&!has("Confirm")&&has("Close"));
 char first[51]="Bearer ";memcpy(first+7,displayed_token,44);uint64_t epoch;assert(hfa_admit(first,50,&epoch)==HFA_OK);
 click("Close");assert(hfa_active());for(unsigned i=0;i<sizeof(displayed_token);i++)assert(displayed_token[i]==0);
 hfp_ui_open(NULL,identity);click("Pair Flight Courier");assert(random_calls==2&&hfa_active()&&!has("Confirm"));assert(hfa_admit(first,50,&epoch)!=HFA_OK);
 char second[51]="Bearer ";memcpy(second+7,displayed_token,44);assert(hfa_admit(second,50,&epoch)==HFA_OK);
 close_screen(NULL);hfp_ui_open(NULL,identity);ready=false;click("Pair Flight Courier");assert(random_calls==2&&!hfa_active());assert(hfa_admit(second,50,&epoch)!=HFA_OK);
 close_screen(NULL);hfp_ui_open(NULL,identity);ready=true;allocation_failure=true;click("Pair Flight Courier");assert(random_calls==3&&!hfa_active());allocation_failure=false;
 close_screen(NULL);hfp_ui_open(NULL,identity);click("Pair Flight Courier");assert(random_calls==4&&hfa_active());close_screen(NULL);hfp_ui_open(NULL,identity);click("Revoke Flight Courier");assert(has("Confirm")&&has("Cancel")&&hfa_active());click("Cancel");assert(hfa_active());click("Pair Flight Courier");assert(random_calls==5&&hfa_active());close_screen(NULL);hfp_ui_open(NULL,identity);click("Revoke Flight Courier");click("Confirm");assert(!hfa_active()&&random_calls==5);
 close_screen(NULL);assert(pair_calls==5);puts("PASS first/replacement pairing executes once; old token invalid; readiness/presentation failures revoke; Close wipes display and preserves authorization; explicit revoke still confirms/cancels; pair after canceled revoke resets intent; real authorization + QR encoder; host fixtures only");return 0;
}
