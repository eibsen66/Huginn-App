// GET-only post-deployment attestation. No rebuild, storage mutation or rollback.
import {readFile,writeFile} from 'node:fs/promises';import {createHash} from 'node:crypto';
const out='build/settings-read-diagnostics-review/published-20261103',receipt={candidate_directory:'build/settings-read-diagnostics-review/candidate-2f894e47c73920ab',account_id:'afc733ae88054c22d7214b083132bfbc',project:'huginnapp-pwa-test',origin:'https://huginnapp-pwa-test.pages.dev',rollback_deployment_id:'aaa7d0d7-7454-4e0b-aae8-7e1b13340f20',rollback_deployment_url:'https://aaa7d0d7.huginnapp-pwa-test.pages.dev'};
const root=receipt.candidate_directory,expectedRaw=await readFile(root+'/build.json'),expected=JSON.parse(expectedRaw);
const hash=b=>createHash('sha256').update(b).digest('hex');
const toml=await readFile('C:/Users/egill/AppData/Roaming/xdg.config/.wrangler/config/default.toml','utf8');
const token=/^oauth_token\s*=\s*"([^"\r\n]+)"/m.exec(toml)?.[1];if(!token)throw Error('Existing OAuth unavailable');
const api='https://api.cloudflare.com/client/v4/accounts/'+receipt.account_id+'/pages/projects/'+receipt.project;
async function getApi(path){const r=await fetch(api+path,{headers:{Authorization:'Bearer '+token}}),j=await r.json();if(!r.ok||!j.success)throw Error('Cloudflare GET '+path+' HTTP '+r.status+' '+JSON.stringify(j.errors));return j.result;}
const project=await getApi(''),current=project.canonical_deployment,retained=await getApi('/deployments/'+receipt.rollback_deployment_id);
if(current.id===retained.id||current.latest_stage.status!=='success'||!project.domains.includes(new URL(receipt.origin).hostname))throw Error('Unexpected canonical deployment');
async function get(origin,path){let url=origin+'/'+path;for(let i=0;i<5;i++){const r=await fetch(url,{redirect:'manual',headers:{'Cache-Control':'no-cache'}});if([301,302,303,307,308].includes(r.status)){const next=new URL(r.headers.get('location'),url);if(next.origin!==origin)throw Error('Cross-origin redirect '+url);url=next.href;continue;}return {r,bytes:Buffer.from(await r.arrayBuffer())};}throw Error('Redirect limit');}
const manifests=[];
for(const origin of [receipt.origin,current.url]){const {r,bytes}=await get(origin,'build.json');if(r.status!==200||!bytes.equals(expectedRaw))throw Error('Live build mismatch '+origin);manifests.push({origin,status:r.status,sha256:hash(bytes)});}
const files=[];
for(const [path,sha256]of Object.entries(expected.files)){
 if(path==='_headers')continue;
 const {r,bytes}=await get(receipt.origin,path);
 if(r.status!==200||hash(bytes)!==sha256)throw Error('Public asset mismatch '+path+' HTTP '+r.status);
 if(path.endsWith('.mjs')&&!/javascript/.test(r.headers.get('content-type')||''))throw Error('Wrong module MIME '+path);
 if(path==='index.html'&&r.headers.get('content-security-policy')!=="default-src 'self'; connect-src 'self' https://192.168.4.1; script-src 'self'; style-src 'self'; img-src 'self'; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'")throw Error('Unexpected public CSP');
 files.push({path,status:r.status,sha256,bytes:bytes.length,content_type:r.headers.get('content-type'),cache_control:r.headers.get('cache-control')});
}
const rollbackManifest=await get(receipt.rollback_deployment_url,'build.json');
const savedRollback=await readFile('build/pages-deployment-review/candidate-99272816b3082d1a/build.json');
if(rollbackManifest.r.status!==200||!rollbackManifest.bytes.equals(savedRollback))throw Error('Retained rollback public manifest changed');
const old=JSON.parse(savedRollback);for(const [path,sha]of Object.entries(old.files))if(hash(await readFile('build/pages-deployment-review/candidate-99272816b3082d1a/'+path))!==sha)throw Error('Local rollback evidence changed '+path);
for(const [path,sha]of Object.entries(expected.files))if(hash(await readFile(root+'/'+path))!==sha)throw Error('Candidate changed during deployment '+path);
const earlier=await getApi('/deployments/9775164c-2e37-438a-8c1b-c31b47ebeac1'); if(earlier.latest_stage.status!=='success')throw Error('Earlier rollback not retained'); const summary={earlier_rollback_retained:earlier.id,verified_utc:new Date().toISOString(),origin:receipt.origin,account_id:receipt.account_id,project:receipt.project,deployment_id:current.id,deployment_url:current.url,environment:current.environment,stage:current.latest_stage,build:expected.version,manifest_sha256:hash(expectedRaw),manifests,files,settings_assets_verified:['settings-v2.mjs','settings-ui.mjs','settings.mjs','settings-package.mjs'],rollback:{id:retained.id,url:retained.url,build:old.version,retained:true,local_evidence_hashes_match:true},candidate_unchanged:true,phone_verified:false,device_verified:false};
await writeFile(out+'/deployed-verification.json',JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify({...summary,files:files.map(f=>f.path)},null,2));
