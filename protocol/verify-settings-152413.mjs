import {readFile,writeFile,mkdir} from 'node:fs/promises';import {createHash} from 'node:crypto';
const root='C:/HuginnEIS/Huginn/Firmware/huginn',build=root+'/build-rev2.5-20261105',capture='C:/HuginnEIS/Evidence/REV2.5-COM5/console-20261105T152413Z',out='build/settings-send-152413-review',hash=b=>createHash('sha256').update(b).digest('hex');await mkdir(out,{recursive:true});
const raw=await readFile(capture+'/console.raw');if(hash(raw)!=='46e620b68cafc8b1c45d654960c31993bfa4e2299df402577eb1e0214b229770')throw Error('Wrong capture');
const status=JSON.parse(await readFile(capture+'/status.json')),chunks=(await readFile(capture+'/console.jsonl','utf8')).trim().split('\n').map(x=>JSON.parse(x)).filter(x=>'offset'in x);let offset=0;
for(const c of chunks){const b=Buffer.from(c.text);if(c.offset!==offset||b.length!==c.bytes||!b.equals(raw.subarray(offset,offset+b.length)))throw Error('Capture mismatch');offset+=b.length;}if(offset!==raw.length||status.bytes_received!==raw.length||status.status!=='STOPPED')throw Error('Incomplete capture');
const text=raw.toString(),records=[];for(const id of [1,2]){
 const lines=text.split('\n').filter(l=>new RegExp('\\bid='+id+'\\b').test(l));
 const begin=lines.find(l=>l.includes('HS2_SEND: begin')),end=lines.find(l=>l.includes('HS2_SEND: end')),failure=lines.find(l=>l.includes('HS2_ALLOC: failure')),summary=lines.find(l=>l.includes('HS2_ALLOC: summary'));
 if(!begin||!end||!failure||!summary)throw Error('Missing request '+id);
 const values=l=>Object.fromEntries([...l.matchAll(/\b([a-z_]+)=(-?\d+)\b/g)].map(x=>[x[1],Number(x[2])])),e=values(end),f=values(failure),s=values(summary);
 if(e.bytes!==29502||e.tls_body_accepted!==4096||e.http_result!==45062||e.raw_tls!==-1||e.tls_errno!==0||f.bytes!==1600||f.caps!==8||f.line!==278||s.records!==1||s.dropped!==0||s.task!==f.task||!failure.includes('site=bounce_output function=esp_aes_process_dma_ext_ram'))throw Error('Correlation mismatch');
 records.push({id,begin,end,failure,summary,unaccepted_body_bytes:29502-4096});
}
const receipt=JSON.parse(await readFile(build+'/owner-build-complete.json')),start=JSON.parse(await readFile(build+'/owner-build-start.json'));
for(const [p,h]of Object.entries(receipt.outputs))if(hash(await readFile(build+'/'+p))!==h)throw Error('Build output changed '+p);
if(hash(await readFile(build+'/lvgl_porting.bin'))!==status.intended_app_sha256)throw Error('Capture intended image differs');
const names=['components/mbedtls/port/aes/dma/esp_aes_dma_core.c','components/mbedtls/port/aes/dma/esp_aes.c','components/mbedtls/port/huginn_aes_alloc_diag.c','components/mbedtls/port/esp_mem.c','components/esp-tls/esp_tls_mbedtls.c'];
const pins={};for(const p of names){pins[root+'/'+p]=hash(await readFile(root+'/'+p));if(pins[root+'/'+p]!==start.sources[p])throw Error('Compiled source drift '+p);}
const desc=JSON.parse(await readFile(build+'/project_description.json')),commands=JSON.parse(await readFile(build+'/compile_commands.json'));
for(const name of ['heap','esp_mm','soc'])if(!desc.build_component_info[name].dir.replaceAll('\\','/').startsWith('C:/esp/v5.5.2/esp-idf/components/'))throw Error('Unexpected SDK component '+name);
const selected=commands.filter(c=>/heap_caps\.c$|heap_caps_base\.c$|heap_align_hw\.c$|esp32s3[\\/]memory_layout\.c$/.test(c.file)).map(c=>c.file);
for(const p of selected)pins[p]=hash(await readFile(p));
await writeFile(out+'/evidence.json',JSON.stringify({capture,raw_bytes:raw.length,raw_sha256:hash(raw),jsonl_exact:true,status:'STOPPED',records,intended_app_sha256:status.intended_app_sha256,retained_build_outputs_verified:true,physical_image_readback:false,source_pins:pins,allocator_compile_units:selected},null,2));console.log('PASS exact raw/JSONL/status, both request correlations, all retained build output hashes and selected AES/allocator sources.');
