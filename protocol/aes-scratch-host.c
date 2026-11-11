/* Extracted production bounce routines. Hardware/DMA and eligible-heap seams
 * below are modeled: this is not a target TLS or hardware AES execution. */
#include <assert.h>
#include <stdbool.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <pthread.h>
#include <openssl/evp.h>
#define MIN(a,b) ((a)<(b)?(a):(b))
#define CONFIG_IDF_TARGET_ESP32S3 1
#define AES_MAX_CHUNK_WRITE_SIZE 1600
#define MALLOC_CAP_DMA 8
#define ESP_LOGE(...) ((void)0)
#define huginn_aes_alloc_diag_failure(...) ((void)0)
#define huginn_aes_output_probe_constraints(...) ((void)0)
#define huginn_aes_output_probe_before(...) ((void)0)
#define huginn_aes_output_probe_after(...) ((void)0)
typedef struct {EVP_CIPHER_CTX *cipher;} esp_aes_context;
static unsigned char fixture[29502];
static size_t fixture_offset;
typedef struct {void *p;size_t charge,slot;} Allocation;
static _Thread_local size_t blocks[12],initial[12],live,peak,min_free,min_largest;
static _Thread_local Allocation owned[8];
static _Thread_local unsigned calls,fail_at,dma_calls,dma_fail_at;
static _Thread_local size_t max_chunk;
static size_t total(void){size_t n=0;for(int i=0;i<12;i++)n+=blocks[i];return n;}
static size_t largest(void){size_t n=0;for(int i=0;i<12;i++)if(blocks[i]>n)n=blocks[i];return n;}
static void reset(bool constrained){
 assert(live==0);memset(blocks,0,sizeof(blocks));memset(owned,0,sizeof(owned));
 if(constrained){blocks[0]=1536;for(int i=1;i<=8;i++)blocks[i]=64;for(int i=9;i<12;i++)blocks[i]=1;assert(total()==2051);}
 else blocks[0]=16384;
 memcpy(initial,blocks,sizeof(blocks));calls=fail_at=dma_calls=dma_fail_at=0;peak=0;max_chunk=0;min_free=total();min_largest=largest();
}
/* Conservative artificial split cost 32 bytes/allocation; alignment >=16.
 * It is not a byte-identical ESP heap implementation or an atomic device snapshot. */
static void *heap_caps_aligned_alloc(size_t a,size_t n,uint32_t caps){
 assert(caps==8);calls++;if(calls==fail_at)return NULL;if(a<16)a=16;
 size_t charge=(n+a-1)/a*a+32;
 for(int i=0;i<12;i++)if(blocks[i]>=charge){
  void *p=NULL;assert(posix_memalign(&p,a,(n+a-1)/a*a)==0);
  int j=0;while(j<8&&owned[j].p)j++;assert(j<8);owned[j]=(Allocation){p,charge,(size_t)i};blocks[i]-=charge;live+=charge;
  if(live>peak)peak=live;
  if(total()<min_free)min_free=total();
  if(largest()<min_largest)min_largest=largest();
  return p;
 }return NULL;
}
static void tracked_free(void *p){
 if(!p)return;
 for(int i=0;i<8;i++)if(owned[i].p==p){blocks[owned[i].slot]+=owned[i].charge;live-=owned[i].charge;owned[i].p=NULL;free(p);return;}
 abort();
}
static void mbedtls_platform_zeroize(void *p,size_t n){memset(p,0,n);}
/* S3 inner DMA allocation is 2 descriptors of 12 bytes for chunks <=4080.
 * sizeof and exact allocation expression are checked against target source.
 * EVP provides the crypto hardware seam, retaining mode state across updates. */
static int esp_aes_process_dma(esp_aes_context *ctx,const unsigned char *p,unsigned char *q,size_t n,uint8_t *s){
 (void)s;dma_calls++;if(n>max_chunk)max_chunk=n;
 size_t full=n-n%16;
 void *desc=full?heap_caps_aligned_alloc(8,((full+4079)/4080)*2*12,8):NULL;
 if((full&&!desc)||dma_calls==dma_fail_at){tracked_free(desc);memset(q,0,n);return -1;}
 int written=0;assert(EVP_CipherUpdate(ctx->cipher,q,&written,p,(int)n)==1);assert(written==(int)n);
 tracked_free(desc);return 0;
}
#define free tracked_free
/* ACTUAL_BOUNCE_ROUTINES */
#undef free
typedef int (*Bounce)(esp_aes_context*,const unsigned char*,unsigned char*,size_t,uint8_t*,bool,bool);
static EVP_CIPHER_CTX *cipher(int mode,int bits,int enc){
 const EVP_CIPHER *kind=mode==0?(bits==128?EVP_aes_128_cbc():EVP_aes_256_cbc()):mode==1?(bits==128?EVP_aes_128_ctr():EVP_aes_256_ctr()):(bits==128?EVP_aes_128_gcm():EVP_aes_256_gcm());
 unsigned char key[32],iv[16],aad[23];for(int i=0;i<32;i++)key[i]=(unsigned char)i;memset(iv,3,16);memset(aad,9,23);
 EVP_CIPHER_CTX *c=EVP_CIPHER_CTX_new();assert(c);assert(EVP_CipherInit_ex(c,kind,NULL,key,iv,enc)==1);assert(EVP_CIPHER_CTX_set_padding(c,0)==1);
 if(mode==2){int n;assert(EVP_CipherUpdate(c,NULL,&n,aad,23)==1);}return c;
}
static void finish(EVP_CIPHER_CTX *c,int mode,unsigned char tag[16],int enc){
 unsigned char tail[32];int n;if(mode==2&&!enc)assert(EVP_CIPHER_CTX_ctrl(c,EVP_CTRL_GCM_SET_TAG,16,tag)==1);
 assert(EVP_CipherFinal_ex(c,tail,&n)==1&&n==0);
 if(mode==2&&enc)assert(EVP_CIPHER_CTX_ctrl(c,EVP_CTRL_GCM_GET_TAG,16,tag)==1);
 EVP_CIPHER_CTX_free(c);
}
static void balanced(void){assert(live==0&&!memcmp(blocks,initial,sizeof(blocks)));}
static void run(size_t length,int mode,int bits,bool in_place,bool i,bool o){
 unsigned char *plain=malloc(length),*expect=malloc(length),*actual=malloc(length),*decoded=malloc(length);assert(plain&&expect&&actual&&decoded);
 for(size_t k=0;k<length;k++)plain[k]=(unsigned char)(k*37+11);
 if(length<=4096&&fixture_offset+length<=sizeof(fixture))memcpy(plain,fixture+fixture_offset,length);
 unsigned char t1[16]={0},t2[16]={0},stream[16];int n;
 EVP_CIPHER_CTX *ref=cipher(mode,bits,1);assert(EVP_CipherUpdate(ref,expect,&n,plain,(int)length)==1&&(size_t)n==length);finish(ref,mode,t1,1);
 reset(!i&&o);esp_aes_context ctx={cipher(mode,bits,1)};if(in_place)memcpy(actual,plain,length);
 assert(candidate_bounce(&ctx,in_place?actual:plain,actual,length,stream,i,o)==0);finish(ctx.cipher,mode,t2,1);
 assert(!memcmp(expect,actual,length));if(mode==2)assert(!memcmp(t1,t2,16));balanced();
 if(!i&&o&&length>=1024){assert(max_chunk==1024);assert(peak<=1120);assert(min_free>=931);assert(min_largest>=416);}
 reset(!i&&o);ctx.cipher=cipher(mode,bits,0);assert(candidate_bounce(&ctx,actual,decoded,length,stream,i,o)==0);finish(ctx.cipher,mode,t1,0);assert(!memcmp(decoded,plain,length));balanced();
 free(decoded);free(actual);free(expect);free(plain);
}
static pthread_mutex_t lock=PTHREAD_MUTEX_INITIALIZER;
static void *thread_run(void *arg){(void)arg;for(int k=0;k<50;k++){assert(!pthread_mutex_lock(&lock));run(29502,2,256,true,false,true);assert(!pthread_mutex_unlock(&lock));}return NULL;}
static void compare(Bounce fn,size_t limit){
 unsigned char in[4096]={0},out[4096],stream[16];reset(true);esp_aes_context ctx={cipher(1,128,1)};
 assert(fn(&ctx,in,out,sizeof(in),stream,0,1)==0);EVP_CIPHER_CTX_free(ctx.cipher);balanced();assert(max_chunk==limit);
 printf("COMPARE scratch=%zu peak=%zu remaining_free=%zu remaining_largest=%zu DMA_calls_per_4096=%u\n",limit,peak,min_free,min_largest,dma_calls);
}
int main(void){
 FILE *file=fopen("/mnt/c/HuginnAPP/build/settings-send-review/settings-full-29502.json","rb");assert(file);assert(fread(fixture,1,sizeof(fixture),file)==sizeof(fixture));assert(fgetc(file)==EOF);fclose(file);
 unsigned char in[4096],out[4096],stream[16];memset(in,7,sizeof(in));esp_aes_context ctx;
 reset(true);ctx.cipher=cipher(1,128,1);assert(original_bounce(&ctx,in,out,sizeof(in),stream,0,1)==-1);for(size_t k=0;k<sizeof(out);k++)assert(out[k]==0);EVP_CIPHER_CTX_free(ctx.cipher);balanced();
 puts("REPRODUCED actual original routine: 1600-byte output allocation fails at 2051 free / 1536 largest / 12 blocks");
 compare(compare_512,512);compare(compare_768,768);compare(candidate_bounce,1024);compare(compare_1280,1280);
 size_t lens[]={1,15,16,17,1008,1023,1024,1025,1040,1536,1599,1600,1601,4095,4096,4097,29502,29504};
 for(int mode=0;mode<3;mode++)for(int bits=128;bits<=256;bits+=128)for(unsigned k=0;k<sizeof(lens)/sizeof(lens[0]);k++)if(mode||lens[k]%16==0)for(int place=0;place<2;place++)for(int i=0;i<2;i++)for(int o=0;o<2;o++)run(lens[k],mode,bits,place,i,o);
 puts("PASS actual candidate routine: AES-128/256 CBC/CTR/GCM ciphertext, decrypt and GCM tags; boundaries/tails, in-place/out-of-place, all ownership combinations");
 /* Every allocation position and every inner DMA call must propagate failure
  * without leaks; caller must discard failed records, never replay them. */
 for(int i=0;i<2;i++)for(int o=0;o<2;o++){
  reset(false);ctx.cipher=cipher(1,128,1);assert(candidate_bounce(&ctx,in,out,4096,stream,i,o)==0);unsigned count=calls,ndma=dma_calls;EVP_CIPHER_CTX_free(ctx.cipher);balanced();
  for(unsigned f=1;f<=count;f++){reset(false);fail_at=f;ctx.cipher=cipher(1,128,1);assert(candidate_bounce(&ctx,in,out,4096,stream,i,o)==-1);EVP_CIPHER_CTX_free(ctx.cipher);balanced();}
  for(unsigned f=1;f<=ndma;f++){reset(false);dma_fail_at=f;ctx.cipher=cipher(1,128,1);assert(candidate_bounce(&ctx,in,out,4096,stream,i,o)==-1);EVP_CIPHER_CTX_free(ctx.cipher);balanced();}
 }
 reset(true);blocks[0]=1000;memcpy(initial,blocks,sizeof(blocks));ctx.cipher=cipher(1,128,1);assert(candidate_bounce(&ctx,in,out,4096,stream,0,1)==-1);EVP_CIPHER_CTX_free(ctx.cipher);balanced();
 puts("PASS output/input/descriptor allocation failures, each DMA failure position, zeroization on initial allocation failure, and genuine insufficient-memory rejection; ownership balanced");
 /* Repeated full-body records, with TLS-record-sized boundaries modeled. */
 for(int repeat=0;repeat<200;repeat++) {
  for(size_t at=0;at<29502;at+=4096) {
   fixture_offset=at;
   run(MIN((size_t)4096,29502-at),2,128,true,0,1);
  }
 }
 fixture_offset=0;
 pthread_t threads[4];for(int i=0;i<4;i++)assert(!pthread_create(&threads[i],NULL,thread_run,NULL));for(int i=0;i<4;i++)assert(!pthread_join(threads[i],NULL));
 puts("PASS 200 complete 29502-byte response sequences and 200 full-body calls across four serialized callers; no retained scratch or allocation drift");
 puts("MODEL peak <=1120 bytes including 32-byte artificial overhead per allocation; remaining free >=931 and largest >=416. Not target heap/TLS/hardware proof.");
 return 0;
}
