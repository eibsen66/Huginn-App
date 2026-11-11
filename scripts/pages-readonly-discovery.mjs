// Read-only GETs using existing Wrangler OAuth. Never prints or saves credentials.
import {readFile,mkdir,writeFile} from 'node:fs/promises';
const account='afc733ae88054c22d7214b083132bfbc',project='huginnapp-pwa-test';
const config=await readFile('C:/Users/egill/AppData/Roaming/xdg.config/.wrangler/config/default.toml','utf8');
const token=/^oauth_token\s*=\s*"([^"\r\n]+)"/m.exec(config)?.[1];
if(!token)throw Error('Existing Wrangler OAuth token not found; no authentication change attempted');
async function get(path){const r=await fetch('https://api.cloudflare.com/client/v4/accounts/'+account+'/pages/projects/'+project+path,{headers:{Authorization:'Bearer '+token}});const j=await r.json();if(!r.ok||!j.success)throw Error('Cloudflare GET '+path+' HTTP '+r.status+' '+JSON.stringify(j.errors));return j.result;}
const p=await get(''),domains=await get('/domains'),deployments=await get('/deployments');
const deployment=d=>d&&({id:d.id,url:d.url,aliases:d.aliases,environment:d.environment,created_on:d.created_on,latest_stage:d.latest_stage,trigger:d.deployment_trigger});
const result={queried_utc:new Date().toISOString(),account_id:account,project:p.name,subdomain:p.subdomain,domains:p.domains,production_branch:p.production_branch,canonical_deployment:deployment(p.canonical_deployment),latest_deployment:deployment(p.latest_deployment),configured_domains:domains.map(d=>({name:d.name,status:d.status,created_on:d.created_on,validation_data:d.validation_data})),deployments:deployments.map(deployment)};
await mkdir('build/pages-deployment-review',{recursive:true});
await writeFile('build/pages-deployment-review/cloudflare-readonly.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
