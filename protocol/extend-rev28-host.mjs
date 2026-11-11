import {readFile,writeFile} from 'node:fs/promises';
const p='build/rev28-review/host.c';let s=await readFile(p,'utf8');
s=s.replace('fixture[29502]','fixture[29503]').replace('fread(fixture,1,sizeof(fixture),file)==sizeof(fixture)','fread(fixture,1,sizeof(fixture)-1,file)==sizeof(fixture)-1').replace('assert(fgetc(file)==EOF);fclose(file);','assert(fgetc(file)==EOF);fclose(file);fixture[sizeof(fixture)-1]=32;');
s=s.replaceAll('run(29502,','run(29503,').replaceAll('at<29502','at<29503').replaceAll('29502-at','29503-at').replaceAll('29502-byte response sequences','29503-byte response sequences');
s=s.replace('1,15,16,17,1008','1,15,16,17,511,512,513,1008').replace('29502,29504','29502,29503,29504');
const extra=`
 /* Both captured total-free values, alignment/metadata and competing users.
  * Reconstructing the original heap block layout is impossible from totals;
  * these explicit synthetic layouts are constraints, not recovered layouts. */
 for(int more=0;more<=16;more+=16){
  for(size_t pressure=0;pressure<=128;pressure+=128){reset(true);blocks[3]=(size_t)more;blocks[0]-=pressure;memcpy(initial,blocks,sizeof(blocks));ctx.cipher=cipher(1,128,1);assert(candidate_bounce(&ctx,in,out,4096,stream,0,1)==0);assert(min_free>=111);EVP_CIPHER_CTX_free(ctx.cipher);balanced();}
 }
 reset(true);blocks[0]-=200;memcpy(initial,blocks,sizeof(blocks));ctx.cipher=cipher(1,128,1);assert(candidate_bounce(&ctx,in,out,4096,stream,0,1)==-1);EVP_CIPHER_CTX_free(ctx.cipher);balanced();
 for(int which=0;which<3;which++){unsigned char *large=malloc(4096),*largeout=malloc(4096);assert(large&&largeout);memset(large,7,4096);reset(false);if(which==0)descriptor_fail_at=1;if(which==1)isr_fail=1;if(which==2)wait_fail_at=1;ctx.cipher=cipher(1,128,1);assert(esp_aes_process_dma(&ctx,large,largeout,4096,stream)==-1);assert(descriptor_calls==1);if(which==2)assert(abort_calls==1);EVP_CIPHER_CTX_free(ctx.cipher);balanced();free(large);free(largeout);}
 // Actual entry -> alignment detection -> bounce -> inner descriptors.
 size_t top_lens[]={1,15,16,17,511,512,513,4096,29503};
 for(int mode=0;mode<3;mode++)for(int off=0;off<5;off++)for(size_t k=0;k<sizeof(top_lens)/sizeof(top_lens[0]);k++){
  size_t len=top_lens[k];if(mode==0&&len%16)continue;size_t offsets[]={0,1,9,17,41};unsigned char *base=NULL;assert(posix_memalign((void **)&base,64,len+128)==0);unsigned char *buf=base+offsets[off],*plain=malloc(len),*expected=malloc(len);assert(plain&&expected);for(size_t j=0;j<len;j++)plain[j]=(unsigned char)(j*13);memcpy(buf,plain,len);unsigned char tag1[16]={0},tag2[16]={0};int n;EVP_CIPHER_CTX *ref=cipher(mode,128,1);assert(EVP_CipherUpdate(ref,expected,&n,plain,(int)len)==1);finish(ref,mode,tag1,1);
  reset(false);external_enabled=true;external_base=(uintptr_t)base;external_size=len+128;ctx.cipher=cipher(mode,128,1);assert(esp_aes_process_dma(&ctx,buf,buf,len,stream)==0);finish(ctx.cipher,mode,tag2,1);assert(!memcmp(buf,expected,len));if(mode==2)assert(!memcmp(tag1,tag2,16));balanced();external_enabled=false;free(expected);free(plain);free(base);
 }
 // External aligned output cache failure after DMA completion: still finish
 // and free the owned large descriptor chain through the common cleanup.
 unsigned char *external=NULL;assert(posix_memalign((void **)&external,64,4096)==0);memset(external,1,4096);reset(false);external_enabled=true;external_base=(uintptr_t)external;external_size=4096;cache_fail=true;ctx.cipher=cipher(1,128,1);assert(esp_aes_process_dma(&ctx,external,external,4096,stream)==-1);assert(abort_calls==1);EVP_CIPHER_CTX_free(ctx.cipher);balanced();external_enabled=false;free(external);
 puts("PASS actual entry/alignment routing, 815/831 constraints plus metadata/reservation and 128-byte competition; genuine pressure fails without retry; large-chain ownership, ISR/wait/cache failure cleanup");
`;
s=s.replace(' puts("MODEL output-only peak',extra+'\n puts("MODEL output-only peak');await writeFile(p,s);
