import {readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const root='C:/HuginnEIS/Huginn/Firmware/huginn',out='C:/HuginnAPP/build/rev29-review',old=root+'/build-rev2.8-20261107',build=root+'/build-rev2.9-20261108-review2';
const sha=b=>createHash('sha256').update(b).digest('hex'),json=async p=>JSON.parse(await readFile(p));
const tools='C:/Espressif/tools/xtensa-esp-elf/esp-14.2.0_20251107/xtensa-esp-elf/bin/xtensa-esp32s3-elf-';
const exec=(name,args)=>execFileSync(tools+name+'.exe',args,{encoding:'utf8',windowsHide:true,maxBuffer:32*1024*1024});
const before=await json(out+'/source-before.json'),preserved=await json('C:/HuginnEIS/Tools/rev29-preserved-inputs.json');
function functionBody(s,sig){const a=s.lastIndexOf(sig);assert(a>=0,sig);let j=s.indexOf('{',a)+1,n=1;for(;n;j++){if(s[j]==='{')n++;if(s[j]==='}')n--;}return s.slice(a,j).replaceAll('\r\n','\n');}
const core=await readFile(root+'/components/mbedtls/port/aes/dma/esp_aes_dma_core.c','utf8'),host=await readFile(out+'/host.c','utf8');
assert.equal(functionBody(host,'int actual_dma(esp_aes_context *ctx').replace('actual_dma(','esp_aes_process_dma('),functionBody(core,'int esp_aes_process_dma(esp_aes_context *ctx'),'Host inner DMA routine must match current production S3 body');
for(const [p,h]of Object.entries(preserved))assert.equal(sha(await readFile(p)),h,'Preservation '+p);
assert.equal(sha(await readFile('C:/HuginnEIS/Evidence/REV2.8-COM5/console-20261108T191256Z/console.raw')),before.raw_sha256);
for(const p of ['main/main.c','CMakeLists.txt'])assert.equal((await readFile(root+'/'+p,'utf8')).replaceAll('HuginnEIS Rev. 2.9','HuginnEIS Rev. 2.8'),await readFile(out+'/'+p.replaceAll('/','__')+'.before','utf8'),'Unrelated metadata-file change');
let patch='';for(const p of before.paths){try{execFileSync('git',['-c','core.autocrlf=false','diff','--no-index','--ignore-cr-at-eol','--',out+'/'+p.replaceAll('/','__')+'.before',root+'/'+p],{encoding:'utf8',windowsHide:true});}catch(e){if(e.status!==1)throw e;patch+=e.stdout.replaceAll('a/'+out+'/'+p.replaceAll('/','__')+'.before','a/'+p).replaceAll('b/'+root+'/'+p,'b/'+p);}}
await writeFile('C:/HuginnAPP/protocol/rev29-reserved-output-and-version.patch',patch);
function sections(elf){const text=exec('size',['-A',elf]),r={};for(const m of text.matchAll(/^(\.[\w.]+)\s+(\d+)\s+(\d+)$/gm))r[m[1]]={bytes:Number(m[2]),address:Number(m[3])};return r;}
const oldSections=sections(old+'/lvgl_porting.elf'),newSections=sections(build+'/lvgl_porting.elf');
const oldNm=exec('nm',['-S','--defined-only',old+'/lvgl_porting.elf']),newNm=exec('nm',['-S','--defined-only',build+'/lvgl_porting.elf']);
function symbol(nm,name){const m=new RegExp('^([0-9a-fA-F]+)\\s+(?:([0-9a-fA-F]+)\\s+)?[a-zA-Z]\\s+'+name+'$','m').exec(nm);assert(m,'Symbol '+name);return {address:parseInt(m[1],16),bytes:m[2]?parseInt(m[2],16):null};}
const scratch=symbol(newNm,'s_s3_output_bounce'),pair=symbol(newNm,'s_s3_short_block_desc');assert.equal(scratch.bytes,512);assert.equal(scratch.address%16,0);assert.equal(pair.bytes,24);assert.equal(pair.address%8,0);
const data=newSections['.dram0.data'];assert(scratch.address>=data.address&&scratch.address+512<=data.address+data.bytes,'Scratch must be in actual internal .dram0.data section');
const stacks={};for(const name of ['g_flight_log_task_stack','g_flight_log_task_control']){stacks[name]={before:symbol(oldNm,name),after:symbol(newNm,name)};assert.equal(stacks[name].before.bytes,stacks[name].after.bytes);}
const memory={scratch,pair,sections:Object.fromEntries(['.dram0.data','.dram0.bss','.iram0.text'].map(name=>[name,{before:oldSections[name].bytes,after:newSections[name].bytes,delta:newSections[name].bytes-oldSections[name].bytes}])),heap_start:{before:symbol(oldNm,'_heap_start').address,after:symbol(newNm,'_heap_start').address},recorder:stacks};
memory.heap_start.delta=memory.heap_start.after-memory.heap_start.before;
const result=await json(build+'/owner-build-result.json'),complete=await json(build+'/owner-build-complete.json');assert.equal(result.successful,true);for(const [p,h]of Object.entries(complete.outputs))assert.equal(sha(await readFile(build+'/'+p)),h,'Build output '+p);
const binary=await readFile(build+'/lvgl_porting.bin');
const report={revision:'HuginnEIS Rev. 2.9',build,bytes:binary.length,sha256:sha(binary),memory,retained_files_verified:Object.keys(preserved).length,patch_sha256:sha(Buffer.from(patch)),host_tests_sha256:sha(await readFile(out+'/host-tests.log')),syntax:await json(out+'/syntax-checks.json'),physical_validation:false,com_access:false,flash_run:false};
await writeFile(out+'/review.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({revision:report.revision,build,bytes:report.bytes,sha256:report.sha256,memory,retained_files_verified:report.retained_files_verified},null,2));
