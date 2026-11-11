import {readFile,writeFile} from 'node:fs/promises';
const out='build/rev28-review',root='C:/HuginnEIS/Huginn/Firmware/huginn';
const after=await readFile(root+'/components/mbedtls/port/aes/dma/esp_aes_dma_core.c','utf8'),before=await readFile(out+'/components__mbedtls__port__aes__dma__esp_aes_dma_core.c.before','utf8');
function extract(s,sig,last=false){const a=last?s.lastIndexOf(sig):s.indexOf(sig);if(a<0)throw Error(sig);let j=s.indexOf('{',a)+1,n=1;for(;n;j++){if(s[j]==='{')n++;if(s[j]==='}')n--;}return s.slice(a,j);}
let h=await readFile('protocol/aes-scratch-host.c','utf8');
h=h.replace('typedef struct {EVP_CIPHER_CTX *cipher;}','typedef struct {EVP_CIPHER_CTX *cipher;int key_bytes,key_in_hardware;}');
h=h.replace('static size_t fixture_offset;','static size_t fixture_offset;static bool reserve_pair=true;');
h=h.replace('blocks[0]=1536;for(int i=1;i<=8;i++)blocks[i]=64;for(int i=9;i<12;i++)blocks[i]=1;assert(total()==2051);','blocks[0]=736;blocks[1]=40;blocks[2]=39;assert(total()==815);if(reserve_pair)blocks[0]-=32;');
h=h.replace(' assert(live==0);memset(blocks',' wait_fail_at=wait_calls=abort_calls=descriptor_fail_at=descriptor_calls=isr_fail=0;cache_fail=external_enabled=false;assert(live==0);memset(blocks');
// declarations needed before reset; the actual hardware seam follows allocator.
h=h.replace('typedef struct {void *p;size_t charge,slot;} Allocation;',`static _Thread_local unsigned wait_fail_at,wait_calls,abort_calls,descriptor_fail_at,descriptor_calls,isr_fail;static _Thread_local bool cache_fail,external_enabled;
typedef struct {void *p;size_t charge,slot;} Allocation;`);
const stubStart=h.indexOf('static int esp_aes_process_dma('),stubEnd=h.indexOf('#define free tracked_free',stubStart);
let seam=await readFile('protocol/rev28-dma-host.inc','utf8');seam=seam.replace(',external_enabled,cache_fail','').replace('static _Thread_local unsigned wait_fail_at,wait_calls,abort_calls,descriptor_fail_at,descriptor_calls,isr_fail;','');
h=h.slice(0,stubStart)+seam+'\n'+h.slice(stubEnd);
const bounceSig='static int esp_aes_process_dma_ext_ram(',dmaSig='int esp_aes_process_dma(esp_aes_context *ctx';
const routines=[extract(after,'static inline void dma_desc_append('),extract(after,'static inline void dma_desc_setup_link('),extract(before,bounceSig).replace(bounceSig,'static int original_bounce('),extract(after,bounceSig),extract(before,dmaSig,true).replace(dmaSig,'static int original_dma(esp_aes_context *ctx').replaceAll('esp_aes_process_dma_ext_ram(', 'original_bounce('),extract(after,dmaSig,true).replace(dmaSig,'static int actual_dma(esp_aes_context *ctx')].join('\n');
h=h.replace('/* ACTUAL_BOUNCE_ROUTINES */',routines);
// Convenience wrapper applies the production caller's AES lock around bounce.
h=h.replace('#undef free',`#undef free
static int candidate_bounce(esp_aes_context *c,const unsigned char *i,unsigned char *o,size_t n,uint8_t *s,bool ri,bool ro){assert(!pthread_mutex_lock(&lock));held=true;int r=esp_aes_process_dma_ext_ram(c,i,o,n,s,ri,ro);assert(!dma_active&&!transform_active);held=false;assert(!pthread_mutex_unlock(&lock));return r;}`);
h=h.replace('static pthread_mutex_t lock=PTHREAD_MUTEX_INITIALIZER;\nstatic void *thread_run', 'static void *thread_run');
h=h.replace('assert(!pthread_mutex_lock(&lock));run(29502,2,256,true,false,true);assert(!pthread_mutex_unlock(&lock));','run(29502,2,256,true,false,true);');
h=h.replaceAll('ctx={cipher(', 'ctx={.cipher=cipher(').replaceAll("ctx={.cipher=cipher(1,128,1)}", "ctx={.cipher=cipher(1,128,1)}");
h=h.replace('if(!i&&o&&length>=1024){assert(max_chunk==1024);assert(peak<=1120);assert(min_free>=931);assert(min_largest>=416);}', 'if(!i&&o&&length>=512){assert(max_chunk==512);assert(peak<=544);assert(min_free>=239);assert(min_largest>=160);}');
const compareStart=h.indexOf('static void compare('),main=h.indexOf('int main(void)',compareStart);h=h.slice(0,compareStart)+h.slice(main);
const mainStart=h.indexOf(' unsigned char in[4096]'),compareEnd=h.indexOf(' size_t lens[]',mainStart);
h=h.slice(0,mainStart)+` unsigned char in[4096],out[4096],stream[16];memset(in,7,sizeof(in));esp_aes_context ctx;
 reserve_pair=false;reset(true);ctx.cipher=cipher(1,128,1);assert(original_bounce(&ctx,in,out,4096,stream,0,1)==-1);EVP_CIPHER_CTX_free(ctx.cipher);balanced();reserve_pair=true;
 puts("REPRODUCED Rev. 2.7 1024-byte failure at observed 815 free / 736 largest; static pair worst-case 32-byte reserve accounted separately");
`+h.slice(compareEnd);
h=h.replace('reset(true);blocks[0]=1000;','reset(true);blocks[0]=500;');
h=h.replace('for(int i=0;i<8;i++)if(owned[i].p==p){','assert(!dma_active);for(int i=0;i<8;i++)if(owned[i].p==p){'); // declaration follows; forward declare flag below.
h=h.replace('static _Thread_local bool cache_fail,external_enabled;', 'static _Thread_local bool cache_fail,external_enabled,dma_active;').replace('bool held,dma_active,transform_active;', 'bool held,transform_active;');
h=h.replace(' puts("MODEL peak <=1120 bytes',` /* Inject a descriptor failure in the original actual core, then prove the
  * candidate short core does not call the descriptor allocator at all. */
 reset(false);descriptor_fail_at=1;original_selected=true;ctx.cipher=cipher(1,128,1);assert(esp_aes_process_dma(&ctx,in,out,512,stream)==-1);EVP_CIPHER_CTX_free(ctx.cipher);balanced();original_selected=false;
 reset(true);descriptor_fail_at=1;ctx.cipher=cipher(1,128,1);assert(esp_aes_process_dma(&ctx,in,out,512,stream)==0);assert(descriptor_calls==0);EVP_CIPHER_CTX_free(ctx.cipher);balanced();
 for(unsigned f=1;f<=8;f++){reset(true);wait_fail_at=f;ctx.cipher=cipher(1,128,1);assert(candidate_bounce(&ctx,in,out,4096,stream,0,1)==-1);assert(abort_calls==1);EVP_CIPHER_CTX_free(ctx.cipher);balanced();}
 puts("PASS actual S3 core short pair ownership and stop/reset-before-reuse at each injected wait failure");
 puts("MODEL peak <=1120 bytes`);
h=h.replace('MODEL peak <=1120 bytes including 32-byte artificial overhead per allocation; remaining free >=931 and largest >=416.', 'MODEL output-only peak <=544 plus 32-byte reserved descriptor budget; initial 815/736, remaining free >=239 and largest >=160.');
await writeFile(out+'/host.c',h);console.log('Extracted actual before/after bounce and S3 DMA core functions');
