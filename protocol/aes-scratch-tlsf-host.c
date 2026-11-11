/* Actual ESP-IDF 5.5.2 TLSF, compiled on the host (64-bit metadata).
 * This tests aligned scratch plus descriptor coexistence, not heap_caps
 * region selection, concurrent device allocation, or target hardware. */
#include <assert.h>
#include <stdbool.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "tlsf.h"
static size_t largest;
static bool walk(void *p,size_t n,int used,void *u){(void)p;(void)u;if(!used&&n>largest)largest=n;return true;}
int main(void){
 void *arena=malloc(8192);assert(arena);tlsf_t t=tlsf_create(arena,8192);assert(t);
 size_t pool_bytes=1536+tlsf_pool_overhead();void *pool_memory=malloc(pool_bytes);assert(pool_memory);
 pool_t pool=tlsf_add_pool(t,pool_memory,pool_bytes);assert(pool);
 largest=0;tlsf_walk_pool(pool,walk,NULL);
 assert(largest==1536);size_t initial_largest=largest;assert(tlsf_memalign(t,4,1600)==NULL);
 size_t minimum=initial_largest;
 for(int i=0;i<10000;i++){
  void *scratch=tlsf_memalign(t,4,1024);assert(scratch);void *descs=tlsf_memalign(t,8,24);assert(descs);
  assert((size_t)descs%8==0);largest=0;tlsf_walk_pool(pool,walk,NULL);if(largest<minimum)minimum=largest;
  tlsf_free(t,descs);tlsf_free(t,scratch);assert(!tlsf_check(t));largest=0;tlsf_walk_pool(pool,walk,NULL);assert(largest==initial_largest);
 }
 tlsf_remove_pool(t,pool);tlsf_destroy(t);free(pool_memory);free(arena);
 printf("PASS actual IDF TLSF (host 64-bit): 1600 fails at largest=%zu; 1024 plus aligned 24-byte descriptors succeeds 10000 times; remaining largest=%zu; no drift or allocator integrity errors\n",initial_largest,minimum);
 return 0;
}
