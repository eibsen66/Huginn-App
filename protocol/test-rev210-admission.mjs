import {readFile,writeFile,mkdir} from 'node:fs/promises';import {execFileSync} from 'node:child_process';import assert from 'node:assert/strict';
const out='build/rev210-review',root='C:/HuginnEIS/Huginn/Firmware/huginn',s=(await readFile(root+'/main/huginn_settings_v2.inc','utf8')).replaceAll('\r\n','\n');
function fn(sig){const a=s.indexOf(sig);assert(a>=0,sig);let j=s.indexOf('{',a)+1,n=1;for(;n;j++){if(s[j]==='{')n++;if(s[j]==='}')n--;}return s.slice(a,j);}
const enumStart=s.indexOf('enum {\n    HS2_DENIAL_NONE'),enumEnd=s.indexOf('};',enumStart)+2;
const job=fn('typedef struct {\n    SemaphoreHandle_t done;').replace(/}$/, '} Hs2Job;');
// Real structure and prior structure must use the same allocation size.
const jobOld=job.replace('    uint8_t denial_reason;\n','').replace('Hs2Job;','Hs2JobBefore;');
const declarations=`#include <stdint.h>
#include <stdbool.h>
#include <stddef.h>
typedef void *SemaphoreHandle_t;typedef void cJSON;
${jobOld}\n${job}
_Static_assert(sizeof(Hs2Job)==sizeof(Hs2JobBefore),"No extra job allocation bytes");
`;
await writeFile(out+'/job-layout.c',declarations);
let h=declarations+`
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <assert.h>
#include <errno.h>
typedef struct {int settings,ports,aux,revision,engine;} Hs2Config;
typedef struct {int settings,ports_configuration,aux_configuration,config_revision;} HuginnCommittedConfigSnapshot;
static int g_aircraft_engine_configuration=5;
static void *g_settings_modal;
static bool live,inhibited,allocation_fails,baseline;
static char trace[32],last_reason[40];static unsigned position,logs;
static void note(char c){trace[position++]=c;trace[position]=0;}
static bool huginn_live_authority_available(void){note('L');return live;}
static bool huginn_settings_persistence_inhibited(void){note('P');return inhibited;}
static void *hs2_alloc(size_t bytes){note('A');return allocation_fails?NULL:calloc(1,bytes);}
static bool huginn_committed_config_snapshot_copy(HuginnCommittedConfigSnapshot *p){note('C');*p=(HuginnCommittedConfigSnapshot){1,2,3,4};return baseline;}
static void checked_free(void *p){note('F');free(p);}
#define free checked_free
#define ESP_LOGW(tag,format,name) do{assert(!strcmp(tag,"HS2_ADMISSION"));assert(!strcmp(format,"GET denied reason=%s"));logs++;strcpy(last_reason,name);errno=77;}while(0)
${s.slice(enumStart,enumEnd)}
${fn('static bool hs2_snapshot(')}
${fn('static uint8_t hs2_admission(')}
${fn('static const char *hs2_denial_name(')}
${fn('static void hs2_log_get_denial(')}
int main(void){
 const char *names[]={"modal","live_unavailable","persistence_inhibited","snapshot_alloc_failed","snapshot_baseline_missing"};
 const char *traces[]={"","L","LP","LPA","LPACF"};
 for(unsigned selected=0;selected<5;selected++){
  /* All later conditions also fail: only the first may be evaluated. */
  g_settings_modal=selected==0?(void*)1:NULL;live=selected>1;inhibited=selected<=2;allocation_fails=selected<=3;baseline=false;
  position=logs=0;trace[0]=last_reason[0]=0;Hs2Config c={0};uint8_t reason=hs2_admission(&c);
  assert(reason==selected+1);assert(!strcmp(trace,traces[selected]));errno=19;hs2_log_get_denial(true,reason);
  assert(logs==1&&!strcmp(last_reason,names[selected])&&errno==19);
  hs2_log_get_denial(false,reason);assert(logs==1&&errno==19);
 }
 g_settings_modal=NULL;live=true;inhibited=allocation_fails=false;baseline=true;position=logs=0;trace[0]=0;Hs2Config c={0};
 uint8_t reason=hs2_admission(&c);assert(reason==HS2_DENIAL_NONE&&!strcmp(trace,"LPACF"));
 hs2_log_get_denial(true,reason);assert(logs==0&&c.settings==1&&c.ports==2&&c.aux==3&&c.revision==4&&c.engine==5);
 /* Existing apply readback uses no diagnostic destination. */
 allocation_fails=true;assert(!hs2_snapshot(&c,NULL));allocation_fails=false;baseline=false;assert(!hs2_snapshot(&c,NULL));
 puts("PASS five first-denial branches, short-circuit order, exact allowlisted names, one GET log, no POST/success log, unchanged errno, NULL apply-readback destination, unchanged job allocation size");
}
`;
await writeFile(out+'/admission-host.c',h);
const w=p=>'/mnt/c/HuginnAPP/'+p,run=a=>execFileSync('wsl',['-d','Ubuntu','--exec',...a],{encoding:'utf8',windowsHide:true,timeout:120000});
run(['gcc','-std=c11','-Wall','-Wextra','-Werror','-fsanitize=address,undefined','-g',w(out+'/admission-host.c'),'-o',w(out+'/admission-host')]);
let log=run([w(out+'/admission-host')]);
// Independently compile complete old/new protocol owners and compare GET bytes.
for(const phase of ['baseline','candidate']){
 await mkdir(out+'/'+phase+'-model',{recursive:true});
 await writeFile(out+'/'+phase+'-model/huginn_settings_send_diag.h',await readFile('build/settings-protocol-host/huginn_settings_send_diag.h'));
 let generator=await readFile('protocol/prepare-host.mjs','utf8');
 generator=generator.replace('C:/HuginnAPP/build/settings-protocol-host','C:/HuginnAPP/'+out+'/'+phase+'-model');
 if(phase==='baseline')generator=generator.replace("root+'/main/huginn_settings_v2.inc'","'C:/HuginnAPP/'+out+'/main__huginn_settings_v2.inc.before'");
 generator=generator.replace("const root='C:/HuginnEIS", "const outBase='build/rev210-review';const root='C:/HuginnEIS");
 generator=generator.replace("'C:/HuginnAPP/'+out+'/main__", "'C:/HuginnAPP/'+outBase+'/main__");
 generator=generator.replace("code+=await readFile('protocol/host-seams.c','utf8');", "code+='#define ESP_LOGW(...) ((void)0)\\n';code+=await readFile('protocol/host-seams.c','utf8');");
 await writeFile(out+'/generate-'+phase+'.mjs',generator);
 execFileSync(process.execPath,[out+'/generate-'+phase+'.mjs','--active'],{encoding:'utf8',windowsHide:true,timeout:120000});
}
const get=p=>execFileSync('wsl',['-d','Ubuntu','--exec',w(out+'/'+p+'-model/model')],{input:'{"method":"get"}\n{"method":"get","fault":"busy"}\n',encoding:'utf8',windowsHide:true,timeout:30000});
const old=get('baseline'),current=get('candidate');assert.equal(current,old,'Successful GET and modal 409 body must be byte-identical');
log+='PASS complete original/candidate protocol owner: successful GET bytes and modal error JSON bytes are identical; protected-state/fuel/fault/recording sentinels retained\n';
await writeFile(out+'/host-tests.log',log);console.log(log);
