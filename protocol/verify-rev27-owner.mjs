import {readFile,access} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root='C:/HuginnEIS/Huginn/Firmware/huginn',tools='C:/HuginnEIS/Tools';
const digest=async p=>createHash('sha256').update(await readFile(p)).digest('hex');
const read=async p=>JSON.parse(await readFile(p));
const audit=await read('build/rev27-preparation/final-audit.json');
const receipt='C:/HuginnEIS/Evidence/REV2.7-PREPARATION/prepared.json';
if(await digest(receipt)!==audit.prepared_sha256)throw Error('sealed receipt changed');
const p=await read(receipt);let checked=0;
async function verify(entries){for(const [path,hash] of Object.entries(entries)){if(await digest(path)!==hash)throw Error('changed: '+path);checked++;}}
await verify(Object.fromEntries(Object.entries(p.sources).map(([path,h])=>[root+'/'+path,h])));
await verify(p.scripts);
await verify(Object.fromEntries(Object.values(p.toolchain).map(t=>[t.path,t.sha256])));
const functional=await read(tools+'/rev27-functional-inputs.json');
await verify(functional.source_pins);await verify(functional.review_evidence);
await verify(await read(tools+'/rev27-preserved-inputs.json'));
for(const [type,base] of [['local',root+'/components'],['original','C:/esp/v5.5.2/esp-idf/components']])for(const [component,files] of Object.entries(p.diagnostics[type]))await verify(Object.fromEntries(Object.entries(files).map(([path,h])=>[base+'/'+component+'/'+path,h])));
if(await digest('REV2.7-OWNER-HANDOFF.md')!==await digest('C:/HuginnEIS/REV2.7-OWNER-HANDOFF.md'))throw Error('handoff copies differ');
let buildDirectoryExists=true;try{await access(root+'/build-rev2.7-20261105');}catch{buildDirectoryExists=false;}
console.log(JSON.stringify({revision:p.revision,origin:p.origin,sealed_receipt_sha256:audit.prepared_sha256,hash_checks:checked,preserved_files:audit.preserved_files_unchanged,host_tests:audit.owner_host_tests,build_directory_exists:buildDirectoryExists,physical_validation:false},null,2));
