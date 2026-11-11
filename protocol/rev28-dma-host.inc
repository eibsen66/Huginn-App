/* Actual S3 DMA routing/ownership code below, mocked peripheral and heap.
 * Host pointers make descriptors larger than target; target size checked by
 * Xtensa and final ELF. OpenSSL is the hardware seam, not ESP AES/TLS proof. */
#define AES_BLOCK_BYTES 16
#define CONFIG_SPIRAM 1
#define SOC_PSRAM_DMA_CAPABLE 1
#define SOC_AHB_GDMA_VERSION 1
#define CONFIG_MBEDTLS_AES_USE_INTERRUPT 1
#define AES_DMA_INTR_TRIG_LEN 2000
#define ESP_OK 0
#define ESP_CACHE_MSYNC_FLAG_DIR_C2M 1
#define ESP_CACHE_MSYNC_FLAG_DIR_M2C 2
#define ESP_CACHE_MSYNC_FLAG_UNALIGNED 4
#define MALLOC_CAP_SPIRAM 1024
#define MBEDTLS_ERR_AES_INVALID_INPUT_LENGTH -22
#define DMA_DESCRIPTOR_BUFFER_OWNER_DMA 1
#define DMA_DESCRIPTOR_BUFFER_MAX_SIZE_16B_ALIGNED 4080
#define DMA_DESCRIPTOR_BUFFER_MAX_SIZE_4B_ALIGNED 4092
#define DRAM_ATTR
#define DMA_ATTR
typedef struct Desc Desc;
struct Desc {struct {unsigned size,length,suc_eof,owner;} dw0;void *buffer;Desc *next;};
typedef Desc crypto_dma_desc_t;
static crypto_dma_desc_t s_stream_in_desc,s_stream_out_desc;
static unsigned char s_stream_in[16],s_stream_out[16];
static __attribute__((aligned(8))) crypto_dma_desc_t s_s3_short_block_desc[2];
static pthread_mutex_t lock=PTHREAD_MUTEX_INITIALIZER;
static _Thread_local bool held,dma_active,transform_active,external_enabled,cache_fail;
static _Thread_local uintptr_t external_base;static _Thread_local size_t external_size,operation_length;
static _Thread_local esp_aes_context *operation_ctx;
static _Thread_local crypto_dma_desc_t *dma_input_head,*dma_output_head;
static _Thread_local unsigned wait_fail_at,wait_calls,abort_calls,descriptor_fail_at,descriptor_calls,isr_fail;
static bool esp_ptr_external_ram(const void *p){uintptr_t q=(uintptr_t)p;return external_enabled&&q>=external_base&&q<external_base+external_size;}
static bool s_check_dma_capable(const void *p){(void)p;return true;}
static int esp_cache_get_alignment(unsigned caps,size_t *n){(void)caps;*n=64;return 0;}
static int esp_cache_msync(void *p,size_t n,unsigned flags){(void)p;(void)n;return cache_fail&&(flags&ESP_CACHE_MSYNC_FLAG_DIR_M2C)?-1:0;}
static void *heap_caps_aligned_calloc(size_t a,size_t n,size_t size,unsigned caps){descriptor_calls++;if(descriptor_calls==descriptor_fail_at)return NULL;void *p=heap_caps_aligned_alloc(a,n*size,caps);if(p)memset(p,0,n*size);return p;}
static size_t dma_desc_get_required_num(size_t n,size_t max){return (n+max-1)/max;}
static int esp_aes_isr_initialise(void){assert(held);return isr_fail?-1:0;}
static void aes_hal_interrupt_enable(bool value){(void)value;assert(held);}
static int esp_aes_dma_start(const crypto_dma_desc_t *input,const crypto_dma_desc_t *output){assert(held&&!dma_active);dma_calls++;if(dma_calls==dma_fail_at)return -1;dma_input_head=(crypto_dma_desc_t *)input;dma_output_head=(crypto_dma_desc_t *)output;dma_active=true;return 0;}
static void aes_hal_transform_dma_start(size_t blocks){assert(held&&dma_active);assert(blocks*16>=operation_length);transform_active=true;}
static int esp_aes_dma_wait_complete(bool intr,crypto_dma_desc_t *tail){(void)intr;assert(held&&dma_active&&tail);wait_calls++;if(wait_calls==wait_fail_at)return -1;
 unsigned char input[65552],output[65552];size_t pos=0;for(Desc *d=dma_input_head;d;d=d->next){assert(pos+d->dw0.length<=sizeof(input));memcpy(input+pos,d->buffer,d->dw0.length);pos+=d->dw0.length;}assert(pos>=operation_length);
 int n=0;assert(EVP_CipherUpdate(operation_ctx->cipher,output,&n,input,(int)operation_length)==1);assert((size_t)n==operation_length);memset(output+n,0,pos-(size_t)n);
 size_t at=0;for(Desc *d=dma_output_head;d;d=d->next){memcpy(d->buffer,output+at,d->dw0.length);at+=d->dw0.length;d->dw0.owner=0;}assert(at>=operation_length);dma_active=false;return 0;}
static void aes_hal_transform_dma_finish(void){assert(held&&!dma_active);transform_active=false;}
static void esp_crypto_shared_gdma_abort(void){assert(held);dma_active=false;abort_calls++;}
static int actual_dma(esp_aes_context*,const unsigned char*,unsigned char*,size_t,uint8_t*);
static int original_dma(esp_aes_context*,const unsigned char*,unsigned char*,size_t,uint8_t*);
static int esp_aes_process_dma_ext_ram(esp_aes_context*,const unsigned char*,unsigned char*,size_t,uint8_t*,bool,bool);
static _Thread_local bool original_selected;
static int esp_aes_process_dma(esp_aes_context *ctx,const unsigned char *p,unsigned char *q,size_t n,uint8_t *stream){
 bool acquired=!held;if(acquired){assert(!pthread_mutex_lock(&lock));held=true;}size_t old_length=operation_length;esp_aes_context *old_ctx=operation_ctx;operation_length=n;operation_ctx=ctx;ctx->key_bytes=ctx->key_in_hardware=32;if(n>max_chunk)max_chunk=n;
 int result=original_selected?original_dma(ctx,p,q,n,stream):actual_dma(ctx,p,q,n,stream);assert(!dma_active&&!transform_active);operation_length=old_length;operation_ctx=old_ctx;if(acquired){held=false;assert(!pthread_mutex_unlock(&lock));}return result;
}
