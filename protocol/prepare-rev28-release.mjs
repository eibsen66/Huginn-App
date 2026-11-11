import {readFile,writeFile,readdir} from 'node:fs/promises';import {createHash} from 'node:crypto';
const root='C:/HuginnEIS/Huginn/Firmware/huginn',tools='C:/HuginnEIS/Tools',out='C:/HuginnAPP/build/rev28-review',sha=b=>createHash('sha256').update(b).digest('hex');
const convert=s=>s.replaceAll('rev27','rev28').replaceAll('rev2.7','rev2.8').replaceAll('Rev. 2.7','Rev. 2.8').replaceAll('REV2.7','REV2.8').replaceAll('2\\.7','2\\.8').replaceAll('20261105','20261107');
if(!process.argv.includes('--release-only')){
for(const name of ['ENV','BUILD','VERIFY','FLASH','CAPTURE','READ-DIAGNOSTIC'])await writeFile('C:/HuginnEIS/REV2.8-OWNER-'+name+'.ps1',convert(await readFile('C:/HuginnEIS/REV2.7-OWNER-'+name+'.ps1','utf8')),{flag:'wx'});
for(const name of ['capture','read_diagnostic'])await writeFile(tools+'/rev28_'+name+'.py',convert(await readFile(tools+'/rev27_'+name+'.py','utf8')),{flag:'wx'});
}
let script=convert(await readFile(tools+'/rev27_release.py','utf8'));
script=script.replace("expected['scratch_bytes']==1024","expected['scratch_bytes']==512 and expected['descriptor_pair_bytes']==24");
script=script.replace('    pairing_selection(commands,map_text,nm)',()=>`    pairing_selection(commands,map_text,nm)
    sized=run([toolchain()['nm']['path'],'-S','--defined-only',build/'lvgl_porting.elf'])
    m=re.search(r'^([0-9a-fA-F]+)\\s+([0-9a-fA-F]+)\\s+[dDbB]\\s+s_s3_short_block_desc$',sized,re.M)
    need(m is not None,'Reusable descriptor symbol missing')
    address,size=int(m[1],16),int(m[2],16)
    need(size==24 and address%8==0 and 0x3fc88000<=address and address+size<=0x3fd00000,'Descriptor size/alignment/internal-DRAM mismatch')
    need(re.search(r'\\besp_crypto_shared_gdma_abort$',nm,re.M),'DMA stop/reset cleanup not linked')
    print('PASS DMA pair: '+hex(address)+' / '+str(size)+' bytes, 8-aligned internal DRAM; abort linked')`);
await writeFile(tools+'/rev28_release.py',script,{flag:process.argv.includes('--release-only')?'w':'wx'});
if(process.argv.includes('--release-only'))process.exit(0);
async function tree(dir,prefix=''){const r={};for(const d of await readdir(dir+'/'+prefix,{withFileTypes:true})){const p=prefix+d.name;if(d.isDirectory()){if(d.name!=='.git'&&d.name!=='__pycache__')Object.assign(r,await tree(dir,p+'/'));}else r[p]=sha(await readFile(dir+'/'+p));}return r;}
const diagnostics=JSON.parse(await readFile(tools+'/rev27-diagnostic-inputs.json'));for(const name of ['esp-tls','esp_https_server','mbedtls'])diagnostics.local[name]=await tree(root+'/components/'+name);await writeFile(tools+'/rev28-diagnostic-inputs.json',JSON.stringify(diagnostics,null,2)+'\n',{flag:'wx'});
const change=JSON.parse(await readFile(out+'/source-changes.json')),preserved=JSON.parse(await readFile(out+'/preserved.json'));for(const p of change.paths)delete preserved[root+'/'+p];
for(const [p,h]of Object.entries(preserved))if(sha(await readFile(p))!==h)throw Error('Retained evidence changed '+p);
await writeFile(tools+'/rev28-preserved-inputs.json',JSON.stringify(preserved,null,2)+'\n',{flag:'wx'});
const pins={};for(const p of change.paths)pins[root+'/'+p]=sha(await readFile(root+'/'+p));
const evidence={};for(const p of ['host.c','host-tests.log'])evidence[out+'/'+p]=sha(await readFile(out+'/'+p));for(const p of ['protocol/rev28-dma-host.inc','protocol/rev28-tlsf-host.c','protocol/generate-rev28-host.mjs','protocol/extend-rev28-host.mjs'])evidence['C:/HuginnAPP/'+p]=sha(await readFile(p));
await writeFile(tools+'/rev28-functional-inputs.json',JSON.stringify({revision:'HuginnEIS Rev. 2.8',scratch_bytes:512,descriptor_pair_bytes:24,source_pins:pins,review_evidence:evidence,physical_validation:false},null,2)+'\n',{flag:'wx'});
console.log('Created fresh Rev. 2.8 owner-only scripts and strict source/component/functional provenance; no build/COM action');
