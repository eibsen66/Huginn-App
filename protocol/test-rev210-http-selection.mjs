import {readFile,writeFile} from 'node:fs/promises';import {execFileSync} from 'node:child_process';import assert from 'node:assert/strict';
const out='build/rev210-review',s=await readFile('C:/HuginnEIS/Huginn/Firmware/huginn/main/huginn_settings_v2.inc','utf8');
const sig='        if (hs2_get(j->response, "ok") && cJSON_IsFalse(hs2_get(j->response, "ok"))) {';const a=s.indexOf(sig);assert(a>=0);let j=s.indexOf('{',a)+1,n=1;for(;n;j++){if(s[j]==='{')n++;if(s[j]==='}')n--;}const branch=s.slice(a,j);
let h=(await readFile(out+'/admission-host.c','utf8')).replace('int main(void){','static void admission_tests(void){');
h+=`
static const char *status;
static void *hs2_get(void *response,const char *key){assert(!strcmp(key,"ok"));return response;}
static bool cJSON_IsFalse(void *p){return p&&*(bool*)p==false;}
static void httpd_resp_set_status(void *request,const char *value){(void)request;status=value;}
static void select_response(bool get,Hs2Job *j){void *request=NULL;${branch}}
int main(void){
 admission_tests();bool error=false,success=true;Hs2Job job={0};job.response=&error;
 for(unsigned reason=1;reason<=5;reason++){
  job.denial_reason=(uint8_t)reason;logs=0;status="200 OK";select_response(true,&job);assert(logs==1&&!strcmp(status,"409 Conflict"));
  logs=0;status="200 OK";select_response(false,&job);assert(logs==0&&!strcmp(status,"409 Conflict"));
 }
 job.denial_reason=0;logs=0;status="200 OK";select_response(true,&job);assert(logs==0&&!strcmp(status,"409 Conflict"));
 job.response=&success;logs=0;status="200 OK";select_response(true,&job);assert(logs==0&&!strcmp(status,"200 OK"));
 puts("PASS actual HTTP status-selection branch: each GET admission denial keeps 409 and logs once; POST/unrelated errors do not log; successful GET keeps 200 without denial line");
}
`;
await writeFile(out+'/http-selection-host.c',h);const w=p=>'/mnt/c/HuginnAPP/'+p,run=a=>execFileSync('wsl',['-d','Ubuntu','--exec',...a],{encoding:'utf8',windowsHide:true,timeout:120000});
run(['gcc','-std=c11','-Wall','-Wextra','-Werror','-fsanitize=address,undefined','-g',w(out+'/http-selection-host.c'),'-o',w(out+'/http-selection-host')]);const log=run([w(out+'/http-selection-host')]);await writeFile(out+'/http-selection-tests.log',log);console.log(log);
