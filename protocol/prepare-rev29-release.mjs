import {readFile,writeFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root='C:/HuginnEIS/Huginn/Firmware/huginn',tools='C:/HuginnEIS/Tools',out='C:/HuginnAPP/build/rev29-review',sha=b=>createHash('sha256').update(b).digest('hex');
const convert=s=>s.replaceAll('rev28','rev29').replaceAll('rev2.8','rev2.9').replaceAll('Rev. 2.8','Rev. 2.9').replaceAll('REV2.8','REV2.9').replaceAll('2\\.8','2\\.9').replaceAll('20261107','20261108');
for(const name of ['ENV','BUILD','VERIFY','FLASH','CAPTURE','READ-DIAGNOSTIC'])await writeFile('C:/HuginnEIS/REV2.9-OWNER-'+name+'.ps1',convert(await readFile('C:/HuginnEIS/REV2.8-OWNER-'+name+'.ps1','utf8')),{flag:'wx'});
for(const name of ['capture','read_diagnostic'])await writeFile(tools+'/rev29_'+name+'.py',convert(await readFile(tools+'/rev28_'+name+'.py','utf8')),{flag:'wx'});
let release=convert(await readFile(tools+'/rev28_release.py','utf8'));
const anchor="    print('PASS DMA pair: '";const i=release.indexOf(anchor);if(i<0)throw Error('Verifier anchor missing');
release=release.slice(0,i)+`    scratch=re.search(r'^([0-9a-fA-F]+)\\s+([0-9a-fA-F]+)\\s+[dDbB]\\s+s_s3_output_bounce$',sized,re.M)
    need(scratch is not None,'Reserved output scratch not linked')
    scratch_address,scratch_bytes=int(scratch[1],16),int(scratch[2],16)
    need(scratch_bytes==512 and scratch_address%16==0 and 0x3fc88000<=scratch_address and scratch_address+scratch_bytes<=0x3fd00000,'Scratch size/alignment/internal DRAM mismatch')
    print('PASS reserved scratch: '+hex(scratch_address)+' / 512 bytes, 16-aligned internal DRAM')
`+release.slice(i);
release=release.replace("expected['descriptor_pair_bytes']==24,", "expected['descriptor_pair_bytes']==24 and expected['reserved_output_bytes']==512,");
await writeFile(tools+'/rev29_release.py',release,{flag:'wx'});
async function tree(dir,prefix=''){const r={};for(const d of await readdir(dir+'/'+prefix,{withFileTypes:true})){const p=prefix+d.name;if(d.isDirectory()){if(d.name!=='.git'&&d.name!=='__pycache__')Object.assign(r,await tree(dir,p+'/'));}else r[p]=sha(await readFile(dir+'/'+p));}return r;}
const diagnostics=JSON.parse(await readFile(tools+'/rev28-diagnostic-inputs.json'));for(const name of ['esp-tls','esp_https_server','mbedtls'])diagnostics.local[name]=await tree(root+'/components/'+name);await writeFile(tools+'/rev29-diagnostic-inputs.json',JSON.stringify(diagnostics,null,2)+'\n',{flag:'wx'});
const preserved=JSON.parse(await readFile(tools+'/rev28-preserved-inputs.json'));
// Retain every Rev2.8 output/config/provenance file, including nested build logs.
for(const [p,h]of Object.entries(await tree(root+'/build-rev2.8-20261107')))preserved[root+'/build-rev2.8-20261107/'+p]=h;
for(const [p,h]of Object.entries(await tree('C:/HuginnEIS/Evidence/REV2.8-PREPARATION')))preserved['C:/HuginnEIS/Evidence/REV2.8-PREPARATION/'+p]=h;
for(const p of ['rev28_release.py','rev28-diagnostic-inputs.json','rev28-functional-inputs.json','rev28-preserved-inputs.json'])preserved[tools+'/'+p]=sha(await readFile(tools+'/'+p));
for(const [p,h]of Object.entries(preserved))if(sha(await readFile(p))!==h)throw Error('Preserved evidence changed '+p);
await writeFile(tools+'/rev29-preserved-inputs.json',JSON.stringify(preserved,null,2)+'\n',{flag:'wx'});
const pins={},evidence={};for(const p of JSON.parse(await readFile(out+'/source-before.json')).paths)pins[root+'/'+p]=sha(await readFile(root+'/'+p));
for(const p of ['host.c','host-tests.log'])evidence[out+'/'+p]=sha(await readFile(out+'/'+p));
for(const p of ['protocol/test-rev29-reserved-output.mjs','protocol/prepare-rev29-reserved-output.mjs'])evidence['C:/HuginnAPP/'+p]=sha(await readFile(p));
await writeFile(tools+'/rev29-functional-inputs.json',JSON.stringify({revision:'HuginnEIS Rev. 2.9',scratch_bytes:512,reserved_output_bytes:512,descriptor_pair_bytes:24,source_pins:pins,review_evidence:evidence,physical_validation:false},null,2)+'\n',{flag:'wx'});
console.log('Fresh Rev2.9 tools prepared. No flash/COM access.');
