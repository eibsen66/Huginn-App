import {readFile,writeFile} from 'node:fs/promises';import {execFileSync} from 'node:child_process';
const p='C:/HuginnEIS/Huginn/Firmware/huginn/components/mbedtls/port/crypto_shared_gdma/esp_crypto_shared_gdma.c',s=await readFile(p,'utf8');const a=s.indexOf('void esp_crypto_shared_gdma_abort(void)');let at=s.indexOf('{',a)+1,n=1;for(;n;at++){if(s[at]==='{')n++;if(s[at]==='}')n--;}const fn=s.slice(a,at);
const code=`#include <assert.h>
#include <stdbool.h>
#include <stdint.h>
#include <stdio.h>
#include <setjmp.h>
static void *tx_channel=(void *)1,*rx_channel=(void *)2;
static bool held,active,reused;static int calls,fail_at,trace[4];static jmp_buf failure;
static int gdma_stop(void *p){assert(held);trace[calls]=(int)(uintptr_t)p*10+1;calls++;return calls==fail_at?-1:0;}
static int gdma_reset(void *p){assert(held);trace[calls]=(int)(uintptr_t)p*10+2;calls++;if(calls==fail_at)return -1;if(p==rx_channel)active=false;return 0;}
#define ESP_ERROR_CHECK(x) do{if((x)!=0)longjmp(failure,1);}while(0)
${fn}
int main(void){held=true;active=true;esp_crypto_shared_gdma_abort();assert(calls==4&&!active);assert(trace[0]==11&&trace[1]==12&&trace[2]==21&&trace[3]==22);
for(int f=1;f<=4;f++){calls=0;fail_at=f;reused=false;if(!setjmp(failure)){esp_crypto_shared_gdma_abort();reused=true;}assert(!reused&&calls==f);}
calls=fail_at=0;tx_channel=rx_channel=NULL;esp_crypto_shared_gdma_abort();assert(calls==0);puts("PASS actual abort function: held lock, TX stop/reset then RX stop/reset; four API failures fail closed before descriptor reuse; no allocation or retry");return 0;}
`;
const out='build/rev28-review';await writeFile(out+'/abort-check.c',code);const run=args=>execFileSync('wsl',['-d','Ubuntu','--exec',...args],{encoding:'utf8',windowsHide:true});run(['gcc','-std=c11','-Wall','-Wextra','-Werror','-fsanitize=address,undefined','/mnt/c/HuginnAPP/'+out+'/abort-check.c','-o','/mnt/c/HuginnAPP/'+out+'/abort-check']);const log=run(['/mnt/c/HuginnAPP/'+out+'/abort-check']);await writeFile(out+'/abort-check.log',log);console.log(log);
