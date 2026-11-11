/* Actual DMA bounce routine; allocator/DMA hardware seams are explicitly simulated. */
#include <assert.h>
#include <stdint.h>
#include <stdbool.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#define MIN(a,b) ((a)<(b)?(a):(b))
#define AES_MAX_CHUNK_WRITE_SIZE 1600
#define MALLOC_CAP_DMA 8
#define ESP_LOGE(...) ((void)0)
typedef struct {int dummy;} esp_aes_context;
static int allocations,frees,fail_at;static void *owned[4];
static void *heap_caps_aligned_alloc(size_t a,size_t n,uint32_t caps){(void)a;(void)caps;allocations++;if(allocations==fail_at)return NULL;void *p=malloc(n);assert(p);owned[allocations-1]=p;return p;}
static void tracked_free(void *p){if(!p)return;for(int i=0;i<4;i++)if(owned[i]==p){owned[i]=NULL;frees++;free(p);return;}abort();}
static void mbedtls_platform_zeroize(void *p,size_t n){memset(p,0,n);}
static int esp_aes_process_dma(esp_aes_context *c,const unsigned char *p,unsigned char *q,size_t n,uint8_t *s){(void)c;(void)s;memcpy(q,p,n);return 0;}
#define free tracked_free
/* ORIGINAL */
/* FIXED */
#undef free
static void reset(void){for(int i=0;i<4;i++)if(owned[i]){free(owned[i]);owned[i]=NULL;}allocations=frees=0;}
int main(void){
 uint8_t in[4096],out[4096];memset(in,7,sizeof(in));esp_aes_context ctx={0};
 fail_at=2;int r=original_ext_ram(&ctx,in,out,4096,NULL,1,1);assert(r==-1&&allocations==2&&frees==0&&owned[0]);
 puts("REPRODUCED original: second/output allocation fails, first/input 1600-byte DMA allocation leaks");reset();
 r=fixed_ext_ram(&ctx,in,out,4096,NULL,1,1);assert(r==-1&&allocations==2&&frees==1&&!owned[0]);for(unsigned i=0;i<sizeof(out);i++)assert(out[i]==0);reset();
 fail_at=1;r=fixed_ext_ram(&ctx,in,out,4096,NULL,1,1);assert(r==-1&&frees==0);reset();
 for(int i=0;i<2;i++)for(int o=0;o<2;o++){fail_at=0;memset(out,0,sizeof(out));r=fixed_ext_ram(&ctx,in,out,4096,NULL,i,o);assert(r==0&&!memcmp(in,out,sizeof(in)));assert(allocations==frees);reset();}
 puts("PASS proposed cleanup: error return/output zeroization unchanged, acquired input freed on output failure, first-allocation failure and all four success ownership combinations balanced; ASan/UBSan");return 0;
}
