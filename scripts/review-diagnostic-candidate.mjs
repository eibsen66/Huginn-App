// Read-only candidate/public/API verification. No build, upload or device requests.
import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const hash=b=>createHash('sha256').update(b).digest('hex');
const root='build/settings-read-diagnostics-review',out=root+'/deployment-review-20261103';
await mkdir(out,{recursive:true});
const receipt=JSON.parse(await readFile(root+'/prepared.json','utf8'));
const dir=receipt.directory,raw=await readFile(dir+'/build.json'),m=JSON.parse(raw);
if(m.version!=='2f894e47c73920ab'||hash(raw)!==receipt.manifest_sha256||m.full_ack_gate_pass!==false)throw Error('Candidate identity mismatch');
async function inventory(base,prefix=''){const a=[];for(const d of await readdir(base+'/'+prefix,{withFileTypes:true})){if(d.isSymbolicLink())throw Error('Unexpected symlink');const p=prefix+d.name;if(d.isDirectory())a.push(...await inventory(base,p+'/'));else a.push(p);}return a.sort();}
const expected=[...Object.keys(m.files),'build.json'].sort();
if(JSON.stringify(await inventory(dir))!==JSON.stringify(expected)||expected.length!==32)throw Error('Candidate inventory changed');
const files={};for(const p of expected){const b=await readFile(dir+'/'+p);if(p!=='build.json'&&hash(b)!==m.files[p])throw Error('Candidate changed: '+p);files[p]={bytes:b.length,sha256:hash(b)};}
for(const p of ['index.html','entry.mjs','sw.js'])if(!(await readFile(dir+'/'+p,'utf8')).includes(m.version))throw Error('Build stamp missing');
if(!(await readFile(dir+'/settings-ui.mjs','utf8')).includes('Ekki tókst að sækja gögn'))throw Error('Icelandic wording missing');
const old=JSON.parse(await readFile('build/pages-deployment-review/candidate-99272816b3082d1a/build.json','utf8'));
const changes=Object.keys(m.files).filter(p=>m.files[p]!==old.files[p]);
for(const p of receipt.preserved)if(m.files[p]!==old.files[p])throw Error('Preservation changed: '+p);
for(const p of expected)if(!Buffer.from(await readFile('dist/pwa/'+p)).equals(await readFile(dir+'/'+p)))throw Error('Test dist differs from frozen candidate: '+p);
const testBytes=await readFile(root+'/focused-tests.log');
const tests=testBytes.toString(testBytes[0]===255&&testBytes[1]===254?'utf16le':'utf8');
if(!/tests 109/.test(tests)||!/pass 109/.test(tests)||!/fail 0/.test(tests))throw Error('Recorded test results differ');
await writeFile(out+'/candidate-verification.json',JSON.stringify({checked_utc:new Date().toISOString(),directory:dir,build:m.version,files,changes_since_deployed:changes,preserved:receipt.preserved,test_dist_matches:true,recorded_tests:{pass:109,fail:0,log_sha256:hash(testBytes)},deployed:false},null,2)+'\n');
console.log('PASS frozen candidate '+m.version+': exact 32 files; test dist matches; recorded 109/109; no rebuild.');
if(process.argv.includes('--offline'))process.exit(0);
if(process.argv.includes('--public-only')){
 const origin='https://huginnapp-pwa-test.pages.dev',immutable='https://aaa7d0d7.huginnapp-pwa-test.pages.dev';
 async function publicGet(base,path){let url=base+'/'+path;for(let n=0;n<5;n++){const r=await fetch(url,{redirect:'manual',headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(30000)});if([301,302,303,307,308].includes(r.status)){const next=new URL(r.headers.get('location'),url);if(next.origin!==base)throw Error('Cross-origin public redirect: '+path);url=next.href;continue;}if(r.status!==200)throw Error('Public GET '+path+' HTTP '+r.status);return {bytes:Buffer.from(await r.arrayBuffer()),mime:r.headers.get('content-type')};}throw Error('Public redirect limit: '+path);}
 const stable=await publicGet(origin,'build.json'),pinned=await publicGet(immutable,'build.json');
 const live=JSON.parse(stable.bytes),assets=[];
 for(const [path,sha]of Object.entries(live.files)){if(path==='_headers')continue;const v=await publicGet(origin,path);if(hash(v.bytes)!==sha)throw Error('Public asset mismatch '+path);assets.push({path,sha256:sha,mime:v.mime});}
 const rollback='9775164c-2e37-438a-8c1b-c31b47ebeac1',rollbackDir='build/pages-deployment-review/rollback-'+rollback;
 const rollbackRaw=await publicGet('https://9775164c.huginnapp-pwa-test.pages.dev','build.json');
 if(!rollbackRaw.bytes.equals(await readFile(rollbackDir+'/build.json')))throw Error('Rollback public manifest differs');
 const rm=JSON.parse(rollbackRaw.bytes);for(const [p,h]of Object.entries(rm.files))if(hash(await readFile(rollbackDir+'/'+p))!==h)throw Error('Local rollback hash mismatch '+p);
 const result={checked_utc:new Date().toISOString(),origin,live_build:live.version,build_json_sha256:hash(stable.bytes),assets,retained_immutable_url:immutable,stable_manifest_matches_retained_immutable:stable.bytes.equals(pinned.bytes),cloudflare_api_current_identity_verified:false,api_error:{http_status:401,code:10000,message:'Authentication error'},rollback:{id:rollback,build:rm.version,public_manifest_and_local_hashes_verified:true},candidate_deployed:live.version===m.version};
 await writeFile(out+'/public-verification.json',JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({...result,assets:assets.length},null,2));process.exit(0);
}
const account='afc733ae88054c22d7214b083132bfbc',project='huginnapp-pwa-test';
const config=await readFile('C:/Users/egill/AppData/Roaming/xdg.config/.wrangler/config/default.toml','utf8');
const token=/^oauth_token\s*=\s*"([^"\r\n]+)"/m.exec(config)?.[1];
if(!token)throw Error('Existing Wrangler OAuth token not found; no authentication change attempted');
async function api(path){const r=await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/pages/projects/${project}${path}`,{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(30000)});const j=await r.json();if(!r.ok||!j.success)throw Error('Cloudflare GET '+path+' HTTP '+r.status+' '+JSON.stringify(j.errors));return j.result;}
const p=await api(''),domains=await api('/domains'),deployments=await api('/deployments');
const select=d=>d&&({id:d.id,url:d.url,environment:d.environment,created_on:d.created_on,latest_stage:d.latest_stage});
const info={queried_utc:new Date().toISOString(),account,project:p.name,subdomain:p.subdomain,production_branch:p.production_branch,canonical_deployment:select(p.canonical_deployment),domains:domains.map(d=>({name:d.name,status:d.status})),deployments:deployments.map(select)};
await writeFile(out+'/cloudflare-readonly.json',JSON.stringify(info,null,2)+'\n');
const origin='https://'+p.subdomain;
if(origin!=='https://huginnapp-pwa-test.pages.dev')throw Error('Unexpected public origin');
async function get(base,path){let url=base+'/'+path;for(let n=0;n<5;n++){const r=await fetch(url,{redirect:'manual',headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(30000)});if([301,302,303,307,308].includes(r.status)){const next=new URL(r.headers.get('location'),url);if(next.origin!==base)throw Error('Cross-origin public redirect: '+path);url=next.href;continue;}if(r.status!==200)throw Error('Public GET '+path+' HTTP '+r.status);return {bytes:Buffer.from(await r.arrayBuffer()),mime:r.headers.get('content-type')};}throw Error('Public redirect limit: '+path);}
const stable=await get(origin,'build.json'),immutable=await get(p.canonical_deployment.url,'build.json');
if(!stable.bytes.equals(immutable.bytes))throw Error('Canonical/immutable manifest mismatch');
const live=JSON.parse(stable.bytes),assets=[];
for(const [path,sha]of Object.entries(live.files)){if(path==='_headers')continue;const value=await get(origin,path);if(hash(value.bytes)!==sha)throw Error('Public asset mismatch '+path);assets.push({path,sha256:sha,mime:value.mime});}
const rollback=info.deployments.find(d=>d.id==='9775164c-2e37-438a-8c1b-c31b47ebeac1');
if(!rollback)throw Error('Retained rollback not found in returned deployments');
const rollbackRaw=await get(rollback.url,'build.json');
const rollbackLocal=await readFile('build/pages-deployment-review/rollback-'+rollback.id+'/build.json');
if(!rollbackRaw.bytes.equals(rollbackLocal))throw Error('Historical rollback manifest changed');
const result={checked_utc:new Date().toISOString(),origin,deployment:info.canonical_deployment,live_build:live.version,build_json_sha256:hash(stable.bytes),assets,rollback,rollback_build:JSON.parse(rollbackLocal).version,candidate_deployed:live.version===m.version};
await writeFile(out+'/public-verification.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({origin,deployment:result.deployment,live_build:live.version,public_assets_verified:assets.length,rollback:rollback.id,candidate_deployed:result.candidate_deployed},null,2));
