// Freeze exactly the validated static PWA manifest. Never deploys.
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';import {createHash} from 'node:crypto';
const base='build/pages-deployment-review',hash=b=>createHash('sha256').update(b).digest('hex');
const current=JSON.parse(await readFile(base+'/cloudflare-readonly.json','utf8'));
const publicInfo=JSON.parse(await readFile(base+'/public-review.json','utf8'));
const oldRoot=base+'/rollback-'+current.canonical_deployment.id;
const old=JSON.parse(await readFile(oldRoot+'/build.json','utf8'));
const manifest=JSON.parse(await readFile('dist/pwa/build.json','utf8')),dest=base+'/candidate-'+manifest.version;
if(manifest.full_ack_gate_pass!==false)throw Error('NO_ACK_REQUIRED');
const header=await readFile('pwa/_headers');if(hash(header)!==old.files._headers)throw Error('Cannot reconstruct rollback control input');
await writeFile(oldRoot+'/_headers',header);
const permitted=[...Object.keys(manifest.files),'build.json'];await mkdir(dest,{recursive:true});
for(const file of permitted){if(file.includes('..')||!/^[-A-Za-z0-9_./]+$/.test(file))throw Error('Invalid path');const data=await readFile('dist/pwa/'+file);if(file!=='build.json'&&hash(data)!==manifest.files[file])throw Error('Asset changed '+file);const path=dest+'/'+file;await mkdir(path.slice(0,path.lastIndexOf('/')),{recursive:true});await writeFile(path,data);}
async function list(root,prefix=''){const items=[];for(const d of await readdir(root+'/'+prefix,{withFileTypes:true})){const p=prefix+d.name;if(d.isDirectory())items.push(...await list(root,p+'/'));else items.push(p);}return items;}
const actual=await list(dest);if(JSON.stringify(actual.sort())!==JSON.stringify(permitted.sort()))throw Error('Unexpected candidate files');
for(const file of permitted){const data=await readFile(dest+'/'+file);if(file!=='build.json'&&hash(data)!==manifest.files[file])throw Error('Frozen asset mismatch');}
const preserved=[];for(const [file,expected]of Object.entries(old.files)){if(hash(await readFile(oldRoot+'/'+file))!==expected)throw Error('Rollback asset mismatch '+file);if(file.startsWith('icons/')||file==='apple-touch-icon.png'||file.startsWith('fixtures/')||file==='flight-storage.mjs'||file==='manifest.webmanifest'){if(manifest.files[file]!==expected)throw Error('Preservation boundary changed '+file);preserved.push(file);}}
for(const file of ['settings-v2.mjs','settings-ui.mjs','settings.mjs','settings-package.mjs'])if(!manifest.files[file])throw Error('Missing settings module');
const summary={prepared_utc:new Date().toISOString(),account_id:current.account_id,project:current.project,production_branch:current.production_branch,origin:publicInfo.origin,candidate_directory:dest,candidate_build:manifest.version,candidate_manifest_sha256:hash(await readFile(dest+'/build.json')),candidate_file_count:actual.length,rollback_deployment_id:current.canonical_deployment.id,rollback_deployment_url:current.canonical_deployment.url,rollback_build:old.version,rollback_assets_verified:true,rollback_headers_source:'matching local pwa/_headers, SHA256 equals published manifest; _headers itself is not publicly served',unchanged_from_public:preserved,full_ack_gate_pass:false,deployed:false};
await writeFile(base+'/prepared-artifact.json',JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify(summary,null,2));
