// GET-only deployment evidence. Upload is a separate, explicit owner command.
// Frozen inventory is checked separately before and after publication.
import {readFile,writeFile,mkdir} from 'node:fs/promises';import {createHash} from 'node:crypto';
const after=process.argv.includes('--after'),out='build/field-save-review/publication',candidate='build/field-save-review/candidate-3f1a35d5e2fe39bd';
await mkdir(out,{recursive:true});const hash=b=>createHash('sha256').update(b).digest('hex');
const cfg=await readFile('C:/Users/egill/AppData/Roaming/xdg.config/.wrangler/config/default.toml','utf8');
const token=/^oauth_token\s*=\s*"([^"\r\n]+)"/m.exec(cfg)?.[1];if(!token)throw Error('Existing OAuth unavailable');
const account='afc733ae88054c22d7214b083132bfbc',project='huginnapp-pwa-test',origin='https://huginnapp-pwa-test.pages.dev';
async function api(path=''){const r=await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/pages/projects/${project}${path}`,{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(30000)});const j=await r.json();if(!r.ok||!j.success)throw Error('Cloudflare GET HTTP '+r.status+' '+JSON.stringify(j.errors));return j.result;}
async function get(base,path){let url=base+'/'+path;for(let n=0;n<5;n++){const r=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(30000),headers:{'Cache-Control':'no-cache'}});if([301,302,303,307,308].includes(r.status)){const next=new URL(r.headers.get('location'),url);if(next.origin!==base)throw Error('Cross-origin redirect');url=next.href;continue;}if(r.status!==200)throw Error('Public HTTP '+r.status+' '+path);return {bytes:Buffer.from(await r.arrayBuffer()),mime:r.headers.get('content-type'),csp:r.headers.get('content-security-policy'),cache:r.headers.get('cache-control')};}throw Error('Redirect limit');}
const p=await api(),current=p.canonical_deployment;
if(p.name!==project||p.subdomain!==new URL(origin).hostname||p.production_branch!=='main'||current.latest_stage.status!=='success')throw Error('Project/production identity mismatch');
const [stable,immutable]=await Promise.all([get(origin,'build.json'),get(current.url,'build.json')]);if(!stable.bytes.equals(immutable.bytes))throw Error('Stable/immutable build mismatch');
const live=JSON.parse(stable.bytes),frozen=await readFile(candidate+'/build.json');if(after&&!stable.bytes.equals(frozen))throw Error('Canonical build is not authorized candidate');
const retained=after?JSON.parse(await readFile(out+'/before.json','utf8')):null;
const rollback=after?retained.rollback:{id:current.id,url:current.url,build:live.version,build_json_sha256:hash(stable.bytes),folder:out+'/rollback-'+current.id};
if(!after){await mkdir(rollback.folder,{recursive:false});await writeFile(rollback.folder+'/build.json',stable.bytes);}
else {const old=await api('/deployments/'+rollback.id),r=await get(old.url,'build.json');if(old.id!==rollback.id||hash(r.bytes)!==rollback.build_json_sha256)throw Error('Rollback identity changed');}
const assets=await Promise.all(Object.entries(live.files).filter(([f])=>f!=='_headers').map(async([file,sha])=>{
 const r=await get(origin,file);if(hash(r.bytes)!==sha||file.endsWith('.mjs')&&!/javascript/.test(r.mime))throw Error('Asset hash/MIME mismatch '+file);
 if(after&&!r.bytes.equals(await readFile(candidate+'/'+file)))throw Error('Candidate asset mismatch '+file);
 if(!after){await mkdir(rollback.folder+'/'+file.split('/').slice(0,-1).join('/'),{recursive:true});await writeFile(rollback.folder+'/'+file,r.bytes);}
 return {file,bytes:r.bytes.length,sha256:sha,mime:r.mime,cache:r.cache};
}));
if(!after){const control=await readFile('build/one-save-review/candidate-9dce699595b724ea/_headers');if(hash(control)!==live.files._headers)throw Error('Rollback control input differs');await writeFile(rollback.folder+'/_headers',control);}
const root=await get(origin,'');if(!root.csp?.includes("connect-src 'self' https://192.168.4.1")||!root.csp.includes("script-src 'self'"))throw Error('Effective CSP mismatch');
const result={checked_utc:new Date().toISOString(),account,project,origin,deployment_id:current.id,deployment_url:current.url,status:current.latest_stage.status,build:live.version,build_json_sha256:hash(stable.bytes),assets,rollback,public_csp:root.csp,custom_domains:after?undefined:await api('/domains'),candidate_rebuilt:false,phone_verified:false,physical_post_transport_unresolved:true,uncorrelated_aes_allocation_failures:2,historical_firmware_head_test:'FAILED; guard unchanged'};
const path=out+'/'+(after?'after':'before')+'.json';await writeFile(path,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({phase:after?'after':'before',deployment:current.id,url:current.url,build:live.version,assets_verified:assets.length,rollback:rollback.id,evidence:path},null,2));
