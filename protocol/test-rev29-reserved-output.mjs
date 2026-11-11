import {readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
const out='build/rev29-review',root='C:/HuginnEIS/Huginn/Firmware/huginn';
const source=await readFile(root+'/components/mbedtls/port/aes/dma/esp_aes_dma_core.c','utf8');
const before=await readFile(out+'/components__mbedtls__port__aes__dma__esp_aes_dma_core.c.before','utf8');
function extract(s,sig){let a=s.indexOf(sig),j=s.indexOf('{',a)+1,n=1;if(a<0)throw Error(sig);for(;n;j++){if(s[j]==='{')n++;if(s[j]==='}')n--;}return s.slice(a,j);}
let h=await readFile('build/rev28-review/host.c','utf8');
const sig='static int esp_aes_process_dma_ext_ram(';
// Match the actual definition, not its forward declaration.
const definition=s=>extract(s,sig+'esp_aes_context *ctx');
h=h.replace(definition(h),definition(source));
h=h.replace(extract(h,'static int original_bounce('),definition(before).replace('esp_aes_process_dma_ext_ram(','original_bounce('));
h=h.replace('assert(original_bounce(&ctx,in,out,4096,stream,0,1)==-1);EVP_CIPHER_CTX_free(ctx.cipher);balanced();reserve_pair=true;', 'assert(original_bounce(&ctx,in,out,4096,stream,0,1)==0);EVP_CIPHER_CTX_free(ctx.cipher);balanced();reserve_pair=true;');
h=h.replace('#define AES_MAX_CHUNK_WRITE_SIZE 1600',`#define AES_MAX_CHUNK_WRITE_SIZE 1600
#define DMA_ATTR
#define AES_BLOCK_BYTES 16
static __attribute__((aligned(16))) unsigned char s_s3_output_bounce[512];
static bool esp_ptr_dma_capable(const void *p){return p!=NULL;}`);
h=h.replace('assert(max_chunk==512);assert(peak<=544);','assert(max_chunk==512);assert(peak==0);assert(calls==0);assert(descriptor_calls==0);');
// Production wrapper holds the lock through the actual bounce cleanup.
h=h.replace('assert(!dma_active&&!transform_active);held=false;',`assert(!dma_active&&!transform_active);
 for(size_t z=0;z<sizeof(s_s3_output_bounce);z++)assert(s_s3_output_bounce[z]==0);
 held=false;`);
h=h.replaceAll('assert(candidate_bounce(&ctx,in,out,4096,stream,0,1)==-1);EVP_CIPHER_CTX_free(ctx.cipher);balanced();','assert(candidate_bounce(&ctx,in,out,4096,stream,0,1)==0);assert(calls==0);EVP_CIPHER_CTX_free(ctx.cipher);balanced();');
const extra=`
 /* Reproduce the recorded total/largest constraints with explicit synthetic
  * layouts. Reserve debit models static memory unavailable to other users;
  * it cannot reconstruct the physical heap's boot-time layout or timing. */
 size_t totals[]={2003,1723},largest_blocks[]={320,304};
 for(size_t case_id=0;case_id<2;case_id++)for(size_t pressure=0;pressure<=512;pressure+=128){
  reset(false);memset(blocks,0,sizeof(blocks));size_t left=totals[case_id]-pressure;
  for(int j=0;j<12&&left;j++){blocks[j]=MIN(largest_blocks[case_id],left);left-=blocks[j];}assert(!left);
  memcpy(initial,blocks,sizeof(blocks));ctx.cipher=cipher(1,128,1);
  assert(original_bounce(&ctx,in,out,4096,stream,0,1)==-1);EVP_CIPHER_CTX_free(ctx.cipher);balanced();
  calls=fail_at=0;ctx.cipher=cipher(1,128,1);assert(candidate_bounce(&ctx,in,out,4096,stream,0,1)==0);
  assert(calls==0&&descriptor_calls==0);EVP_CIPHER_CTX_free(ctx.cipher);balanced();
 }
 puts("PASS Rev2.8 512-byte allocation failure reproduced at 2003/320 and 1723/304; reserved candidate succeeds with zero scratch/short-descriptor heap calls, including up to 512-byte reserve/competition debit");
`;
h=h.replace(' size_t lens[]={',extra+'\n size_t lens[]={');
h=h.replace('REPRODUCED Rev. 2.7 1024-byte failure at observed 815 free / 736 largest; static pair worst-case 32-byte reserve accounted separately','REPRODUCED baseline dynamic scratch rejection under constrained eligible heap');
h=h.replace('REPRODUCED baseline dynamic scratch rejection under constrained eligible heap','PASS retained Rev2.8 512-byte baseline fits older 815/736 envelope');
h=h.replace('PASS actual entry/alignment routing, 815/831 constraints plus metadata/reservation and 128-byte competition; genuine pressure fails without retry; large-chain ownership, ISR/wait/cache failure cleanup','PASS entry/alignment routing, constrained heaps and competition; large-chain allocation/ISR/wait/cache failures propagate without retry');
h=h.replace('MODEL output-only peak <=544 plus 32-byte reserved descriptor budget; initial 815/736, remaining free >=239 and largest >=160. Not target heap/TLS/hardware proof.','MODEL reserved output scratch 512 bytes plus alignment; output-only operation performs zero scratch/short-descriptor heap allocations. No guarantee of target Wi-Fi/recorder headroom.');
h=h.replace('no retained scratch or allocation drift','reserved scratch zeroized after every operation; no heap allocation drift');
await writeFile(out+'/host.c',h);
const w=p=>'/mnt/c/HuginnAPP/'+p;
const run=args=>execFileSync('wsl',['-d','Ubuntu','--exec',...args],{encoding:'utf8',windowsHide:true,timeout:120000});
run(['gcc','-std=c11','-D_POSIX_C_SOURCE=200112L','-Wall','-Wextra','-Werror','-fsanitize=address,undefined','-g',w(out+'/host.c'),'-lcrypto','-pthread','-o',w(out+'/host')]);
const log=run([w(out+'/host')]);await writeFile(out+'/host-tests.log',log);console.log(log);
