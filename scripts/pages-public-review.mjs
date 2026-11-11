// Public HTTPS GETs only. Normal platform TLS validation remains enabled.
import {readFile,writeFile,mkdir} from 'node:fs/promises';import {createHash} from 'node:crypto';
const info=JSON.parse(await readFile('build/pages-deployment-review/cloudflare-readonly.json','utf8'));
const base='https://'+info.subdomain,rollback=info.canonical_deployment.url,out='build/pages-deployment-review';
const hash=b=>createHash('sha256').update(b).digest('hex');
async function get(origin,path){let url=origin+'/'+path;for(let n=0;n<5;n++){const r=await fetch(url,{redirect:'manual',headers:{'Cache-Control':'no-cache'}});if([301,302,303,307,308].includes(r.status)){const next=new URL(r.headers.get('location'),url);if(next.origin!==origin)throw Error('Unexpected cross-origin redirect for '+url+' to '+next.origin);url=next.href;continue;}return {r,bytes:Buffer.from(await r.arrayBuffer())};}throw Error('Redirect limit '+origin+'/'+path);}
const stable=await get(base,'build.json'),immutable=await get(rollback,'build.json');
if(stable.r.status!==200||immutable.r.status!==200)throw Error('Public build manifest unavailable: stable='+stable.r.status+', deployment='+immutable.r.status);
if(!stable.bytes.equals(immutable.bytes))throw Error('Stable alias build does not match canonical deployment');
const manifest=JSON.parse(stable.bytes.toString()),folder=out+'/rollback-'+info.canonical_deployment.id;
await mkdir(folder,{recursive:true});await writeFile(folder+'/build.json',stable.bytes);
const files=[];
for(const [path,expected]of Object.entries(manifest.files)){
 if(path.includes('..')||!/^[-A-Za-z0-9_./]+$/.test(path))throw Error('Unsafe manifest path');
 const {r,bytes}=await get(rollback,path);const actual=hash(bytes);
 // _headers is Pages control input and is not served as a public asset.
 const valid=r.status===200&&actual===expected;
 if(valid){const p=folder+'/'+path;await mkdir(p.slice(0,p.lastIndexOf('/')),{recursive:true});await writeFile(p,bytes);}
 files.push({path,status:r.status,bytes:bytes.length,sha256:actual,expected_sha256:expected,match:valid});
}
const html=await get(base,''),settings=await get(base,'settings-v2.mjs'),entry=await get(base,'entry.mjs'),sw=await get(base,'sw.js');
const result={checked_utc:new Date().toISOString(),origin:base,deployment_url:rollback,deployment_id:info.canonical_deployment.id,public_build:manifest.version,manifest_sha256:hash(stable.bytes),alias_matches_deployment:true,headers:{status:html.r.status,content_type:html.r.headers.get('content-type'),csp:html.r.headers.get('content-security-policy'),cache_control:html.r.headers.get('cache-control')},settings_v2:{listed:Object.hasOwn(manifest.files,'settings-v2.mjs'),status:settings.r.status,content_type:settings.r.headers.get('content-type'),is_module:settings.bytes.toString().includes('createV2SettingsSession')},entry_imports_settings:entry.bytes.toString().includes('settings-ui.mjs'),worker_contains_settings_v2:sw.bytes.toString().includes('settings-v2.mjs'),files};
await writeFile(out+'/public-review.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({...result,files:files.map(f=>({path:f.path,status:f.status,match:f.match}))},null,2));
