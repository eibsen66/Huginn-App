// Freeze the already built candidate. No rebuild, network, credentials or device I/O.
import {readFile,writeFile,readdir,mkdir,copyFile} from 'node:fs/promises';import {createHash} from 'node:crypto';
const out='build/reconnect-review',dist='dist/pwa',hash=b=>createHash('sha256').update(b).digest('hex');
const raw=await readFile(dist+'/build.json'),build=JSON.parse(raw),old='build/navigation-review/candidate-eb5241dc6e9995ba';
if(build.version!=='1902bcca0f2edc78'||build.full_ack_gate_pass!==false)throw Error('Unexpected candidate');
const files=[...Object.keys(build.files),'build.json'].sort();if(files.length!==32)throw Error('Wrong inventory');
const dir=out+'/candidate-'+build.version;await mkdir(dir,{recursive:false});
const inventory={};for(const p of files){const b=await readFile(dist+'/'+p);if(p!=='build.json'&&hash(b)!==build.files[p])throw Error('Manifest mismatch '+p);await mkdir(dir+'/'+p.split('/').slice(0,-1).join('/'),{recursive:true});await copyFile(dist+'/'+p,dir+'/'+p);if(!b.equals(await readFile(dir+'/'+p)))throw Error('Copy mismatch');inventory[p]={bytes:b.length,sha256:hash(b)};}
const preserved=['adapter.mjs','flight-storage.mjs','flight-evidence.mjs','settings-v2.mjs','settings.mjs','settings-package.mjs','manifest.webmanifest','icons/huginn-logo-original.png','icons/icon-192.png','icons/icon-512.png','icons/icon-maskable-512.png','icons/apple-touch-icon.png','apple-touch-icon.png','fixtures/catalog.json','fixtures/complete.FLG','fixtures/incomplete.FLG','fixtures/ceiling.FLG'];
for(const p of preserved)if(!(await readFile(old+'/'+p)).equals(await readFile(dir+'/'+p)))throw Error('Preservation mismatch '+p);
const capture='C:/HuginnEIS/Evidence/REV2.4-COM5/console-20261104T210831Z',consoleRaw=await readFile(capture+'/console.raw');
if(hash(consoleRaw)!=='1753055d441c5aa5beda4dc44a617fc2edb8eade0d4f36c7c6dff2f299790b60')throw Error('Capture changed');
const chunks=(await readFile(capture+'/console.jsonl','utf8')).trim().split('\n').map(s=>JSON.parse(s)).filter(x=>'offset'in x);let offset=0;
for(const c of chunks){const b=Buffer.from(c.text);if(c.offset!==offset||b.length!==c.bytes||!b.equals(consoleRaw.subarray(offset,offset+b.length)))throw Error('Capture reconstruction failed');offset+=b.length;}if(offset!==consoleRaw.length)throw Error('Incomplete capture');
const testRaw=await readFile(out+'/focused-tests.log'),test=testRaw[0]===255?testRaw.subarray(2).toString('utf16le'):testRaw.toString();if(!/fail 0/.test(test))throw Error('Focused tests failed');
const receipt={created_utc:new Date().toISOString(),build:build.version,directory:'C:/HuginnAPP/'+dir,files:inventory,build_json_sha256:hash(raw),preserved_byte_identical:preserved,test_log_sha256:hash(testRaw),historical_vertical_slice:'FAIL FIRMWARE_HEAD; expected 2b7323b749e517fabab6134f4d4493ec22bc0b3b actual 74f45528a8aece434d9af1b757b18bc8caa8fe45; guard unchanged',capture:{path:capture,bytes:consoleRaw.length,sha256:hash(consoleRaw),jsonl_exact:true,settings_send_records:[],allocation_failure_records:[]},deployed:false,physical_iphone_recovery_verified:false};
await writeFile(out+'/candidate-review.json',JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify({build:receipt.build,directory:receipt.directory,files:files.length,build_json_sha256:receipt.build_json_sha256,preserved:preserved.length,capture_bytes:consoleRaw.length},null,2));
