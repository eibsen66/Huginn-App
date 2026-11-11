/* Exact IDF TLSF implementation; host metadata differs from Xtensa. */
#include <assert.h>
#include <stdbool.h>
#include <stdio.h>
#include <stdlib.h>
#include "tlsf.h"
static size_t largest;
static bool walk(void *p,size_t n,int used,void *u){(void)p;(void)u;if(!used&&n>largest)largest=n;return true;}
int main(void){
 void *control=malloc(8192);assert(control);tlsf_t t=tlsf_create(control,8192);assert(t);
 size_t bytes=736+tlsf_pool_overhead();void *memory=malloc(bytes);assert(memory);pool_t pool=tlsf_add_pool(t,memory,bytes);assert(pool);
 largest=0;tlsf_walk_pool(pool,walk,NULL);assert(largest==736);assert(!tlsf_memalign(t,4,1024));
 // Conservative charge against this pool for the target's 24-byte static pair
 // and up to 7 bytes padding; this is not a new runtime descriptor allocation.
 void *reserve=tlsf_memalign(t,8,32);assert(reserve);size_t minimum=736;
 for(int i=0;i<10000;i++){void *p=tlsf_memalign(t,16,512);assert(p&&((size_t)p%16)==0);largest=0;tlsf_walk_pool(pool,walk,NULL);if(largest<minimum)minimum=largest;tlsf_free(t,p);assert(!tlsf_check(t));}
 tlsf_free(t,reserve);largest=0;tlsf_walk_pool(pool,walk,NULL);assert(largest==736);tlsf_remove_pool(t,pool);tlsf_destroy(t);free(memory);free(control);
 printf("PASS actual IDF 5.5.2 TLSF: 736 largest rejects 1024; reserved 32 plus 512 aligned scratch succeeds 10000 times with host metadata; minimum largest=%zu, no drift\n",minimum);return 0;
}
