import {readFile,writeFile as writeRaw,readdir} from 'node:fs/promises';import {createHash} from 'node:crypto';
async function writeFile(path,data,options){if(options?.flag==='wx'){try{const existing=await readFile(path);if(!existing.equals(Buffer.from(data)))throw Error('Refuse differing existing file '+path);return;}catch(e){if(e.code!=='ENOENT')throw e;}}await writeRaw(path,data,options);}
const root='C:/HuginnEIS/Huginn/Firmware/huginn',tools='C:/HuginnEIS/Tools',out='C:/HuginnAPP/build/rev210-review',sha=b=>createHash('sha256').update(b).digest('hex');
const convert=s=>s.replaceAll('rev29','rev210').replaceAll('rev2.9','rev2.10').replaceAll('Rev. 2.9','Rev. 2.10').replaceAll('REV2.9','REV2.10').replaceAll('2\\.9','2\\.10').replaceAll('20261108-review2','20261109').replaceAll('PREPARATION-REVIEW2','PREPARATION');
for(const name of ['ENV','BUILD','VERIFY','FLASH','CAPTURE','READ-DIAGNOSTIC'])await writeFile('C:/HuginnEIS/REV2.10-OWNER-'+name+'.ps1',convert(await readFile('C:/HuginnEIS/REV2.9-OWNER-'+name+'.ps1','utf8')),{flag:'wx'});
for(const name of ['release','capture','read_diagnostic']){let s=convert(await readFile(tools+'/rev29_'+name+'.py','utf8'));if(name==='release')s=s.replace("    pairing_selection(commands,map_text,nm)",`    pairing_selection(commands,map_text,nm)
    need('GET denied reason=%s' in (ROOT/'main/huginn_settings_v2.inc').read_text(),'Admission diagnostic missing from source')
    need(b'GET denied reason=%s' in (build/'lvgl_porting.bin').read_bytes(),'Admission log format not linked')
    for reason in ('modal','live_unavailable','persistence_inhibited','snapshot_alloc_failed','snapshot_baseline_missing'):
        need(reason.encode()+b'\\0' in (build/'lvgl_porting.bin').read_bytes(),'Admission reason not linked: '+reason)`);
 await writeFile(tools+'/rev210_'+name+'.py',s,{flag:'wx'});}
async function tree(dir,prefix=''){const r={};for(const d of await readdir(dir+'/'+prefix,{withFileTypes:true})){const p=prefix+d.name;if(d.isDirectory()){if(d.name!=='.git'&&d.name!=='__pycache__')Object.assign(r,await tree(dir,p+'/'));}else r[p]=sha(await readFile(dir+'/'+p));}return r;}
await writeFile(tools+'/rev210-diagnostic-inputs.json',await readFile(tools+'/rev29-diagnostic-inputs.json'),{flag:'wx'});
const preserved=JSON.parse(await readFile(tools+'/rev29-preserved-inputs.json'));
const changed=JSON.parse(await readFile(out+'/before.json'));
for(const p of changed.paths){const full=root+'/'+p;if(full in preserved){if(preserved[full]!==changed.before[p])throw Error('Unexpected prior source '+p);const backup=out+'/'+p.replaceAll('/','__')+'.before';if(sha(await readFile(backup))!==preserved[full])throw Error('Before-image changed');delete preserved[full];preserved[backup]=changed.before[p];}}
for(const dir of [root+'/build-rev2.9-20261108-review2','C:/HuginnEIS/Evidence/REV2.9-PREPARATION-REVIEW2','C:/HuginnEIS/Evidence/REV2.9-COM5/console-20261109T184048Z'])for(const [p,h]of Object.entries(await tree(dir)))preserved[dir+'/'+p]=h;
for(const p of ['rev29_release.py','rev29-diagnostic-inputs.json','rev29-functional-inputs.json','rev29-preserved-inputs.json'])preserved[tools+'/'+p]=sha(await readFile(tools+'/'+p));
for(const [p,h]of Object.entries(preserved))if(sha(await readFile(p))!==h)throw Error('Preserved input changed '+p);
await writeFile(tools+'/rev210-preserved-inputs.json',JSON.stringify(preserved,null,2)+'\n',{flag:'wx'});
const prior=JSON.parse(await readFile(tools+'/rev29-functional-inputs.json')),pins={...prior.source_pins},evidence={};
for(const p of JSON.parse(await readFile(out+'/before.json')).paths)pins[root+'/'+p]=sha(await readFile(root+'/'+p));
for(const p of Object.keys(pins))pins[p]=sha(await readFile(p));
for(const p of ['admission-host.c','job-layout.c','host-tests.log'])evidence[out+'/'+p]=sha(await readFile(out+'/'+p));
for(const p of ['protocol/prepare-rev210-admission.mjs','protocol/test-rev210-admission.mjs'])evidence['C:/HuginnAPP/'+p]=sha(await readFile(p));
await writeFile(tools+'/rev210-functional-inputs.json',JSON.stringify({...prior,revision:'HuginnEIS Rev. 2.10',source_pins:pins,review_evidence:evidence,physical_validation:false},null,2)+'\n',{flag:'wx'});
console.log('Fresh Rev2.10 tools/provenance prepared; existing SDK/AES diagnostics unchanged.');
