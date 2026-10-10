import test from 'node:test';import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';import {spawnSync} from 'node:child_process';import {createHash} from 'node:crypto';import {runInNewContext} from 'node:vm';
import {inspectVersions,queryWorker,bindVersionInformation} from '../pwa/version-info.mjs';
const A='aaaaaaaaaaaaaaaa',B='bbbbbbbbbbbbbbbb',C='cccccccccccccccc',scope='https://local.test/';
const worker=(build=A,{legacy=false,malformed=false,change}={})=>({postMessage(q,ports){
 change?.();if(legacy)return;
 ports[0].postMessage(malformed?{id:'wrong'}:{type:'HUGINN_VERSION_REPLY',protocol:1,id:q.id,build,scope,cache:'huginn-pwa-p1-'+build,assets:['./index.html','./entry.mjs']});
}});
const env=()=>{
 const w=worker(),reg={scope,active:w,waiting:null},sw={controller:w,getRegistration:async()=>reg};
 const calls=[],cache={keys:async()=>['huginn-pwa-p1-'+A],match:async(url,options)=>{calls.push({url,options});return {ok:true};}};
 return {serviceWorker:sw,cacheStorage:cache,timeout:10,reg,calls};
};
test('matching embedded app/controller identities',async()=>{const e=env(),r=await inspectVersions(A,A,e);assert.equal(r.controller.build,A);assert.equal(r.mismatch,false);assert.match(r.cache,/Complete expected shell/);});
test('different application/controller identities',async()=>{const r=await inspectVersions(B,B,env());assert.equal(r.mismatch,true);});
test('controller and registration active independently reported',async()=>{const e=env();e.reg.active=worker(B);const r=await inspectVersions(A,A,e);assert.equal(r.controller.build,A);assert.equal(r.active.build,B);});
test('waiting update independently reported',async()=>{const e=env();e.reg.waiting=worker(C);assert.equal((await inspectVersions(A,A,e)).waiting.build,C);});
test('old page/new controlling worker mismatch',async()=>{const e=env();e.serviceWorker.controller=e.reg.active=worker(B);const r=await inspectVersions(A,A,e);assert.equal(r.appBuild,A);assert.equal(r.controller.build,B);assert.equal(r.mismatch,true);});
test('legacy worker produces Unknown without inferred version',async()=>{const e=env();e.serviceWorker.controller=worker(A,{legacy:true});const r=await inspectVersions(A,A,e);assert.equal(r.controller.status,'Unknown');assert.equal(r.mismatch,false);});
test('missing controller is Unavailable',async()=>{const e=env();e.serviceWorker.controller=null;assert.equal((await inspectVersions(A,A,e)).controller.status,'Unavailable');});
test('bounded timeout produces Unknown',async()=>{assert.equal((await queryWorker(worker(A,{legacy:true}),scope,{timeout:5})).status,'Unknown');});
test('malformed reply is rejected',async()=>{assert.equal((await queryWorker(worker(A,{malformed:true}),scope)).status,'Unknown');});
test('controller changes invalidate identity snapshot',async()=>{const e=env();e.serviceWorker.controller=worker(A,{change:()=>e.serviceWorker.controller=worker(B)});const r=await inspectVersions(A,A,e);assert.equal(r.controller.status,'Unknown');assert.match(r.cache,/Inspection changed/);assert.equal(r.mismatch,false);});
test('missing cache assets are reported',async()=>{const e=env();e.cacheStorage.match=async()=>undefined;assert.match((await inspectVersions(A,A,e)).cache,/Missing assets: 2/);});
test('unavailable cache inspection is reported',async()=>{const e=env();e.cacheStorage.keys=async()=>{throw Error();};assert.equal((await inspectVersions(A,A,e)).cache,'Unavailable cache inspection');});
test('offline inspection performs no fetch',async()=>{const original=globalThis.fetch;globalThis.fetch=()=>{throw Error('NETWORK_FORBIDDEN');};try{assert.equal((await inspectVersions(A,A,env())).controller.build,A);}finally{globalThis.fetch=original;}});
test('inspection cannot write cache or IndexedDB',async()=>{const e=env();e.cacheStorage=new Proxy(e.cacheStorage,{get(t,k){if(!['keys','match'].includes(k))throw Error('WRITE_FORBIDDEN');return t[k];}});assert.equal((await inspectVersions(A,A,e)).controller.build,A);assert.equal(e.calls.length,2);});
test('worker identity handler has no activation/cache writes',async()=>{
 const handlers={},source=(await readFile(new URL('../pwa/sw.js',import.meta.url),'utf8')).replaceAll('__HUGINN_BUILD_ID__',A);
 const self={registration:{scope},addEventListener:(t,h)=>handlers[t]=h,skipWaiting:()=>{throw Error('ACTIVATION');}};
 runInNewContext(source,{self,URL,caches:new Proxy({},{get(){throw Error('CACHE_WRITE');}})});
 let reply;handlers.message({data:{type:'HUGINN_VERSION_QUERY',protocol:1,id:'test'},ports:[{postMessage:r=>reply=r}]});assert.equal(reply.build,A);assert.equal(reply.id,'test');
});
test('diagnostics do not register or trigger update',async()=>{const e=env();e.serviceWorker=new Proxy(e.serviceWorker,{get(t,k){if(!['controller','getRegistration'].includes(k))throw Error('WORKER_MUTATION');return t[k];}});assert.equal((await inspectVersions(A,A,e)).controller.build,A);});
test('HTML/entry mismatch is independent',async()=>{assert.equal((await inspectVersions(A,B,env())).htmlMismatch,true);assert.equal((await inspectVersions('Unknown',A,env())).mismatch,false);});
test('UI is collapsed and refresh displays mismatch without reload',async()=>{
 const html=await readFile(new URL('../pwa/index.html',import.meta.url),'utf8');assert.match(html,/<details class="app-info">/);
 const elements=new Map(),document={getElementById:id=>{if(!elements.has(id))elements.set(id,{textContent:'',disabled:false});return elements.get(id);}};
 await bindVersionInformation({appBuild:B,htmlBuild:B,document,inspect:(a,h)=>inspectVersions(a,h,env())});
 assert.equal(elements.get('info-app').textContent,B);assert.equal(elements.get('info-warning').textContent,'Application and worker versions differ');await elements.get('info-refresh').onclick();
});
test('NO-ACK and false gate unchanged in stamped artifacts',async()=>{
 const b=JSON.parse(await readFile(new URL('../dist/pwa/build.json',import.meta.url)));assert.equal(b.full_ack_gate_pass,false);
 assert.match(await readFile(new URL('../dist/pwa/adapter.mjs',import.meta.url),'utf8'),/FULL_ACK_GATE_PASS=false/);
 const source=await readFile(new URL('../pwa/version-info.mjs',import.meta.url),'utf8');assert.doesNotMatch(source,/indexedDB|\.register\(|\.update\(|skipWaiting|location\.reload|fetch\(/);
});
test('deterministic canonical stamping and final artifact hashes',async()=>{
 const root=new URL('../',import.meta.url),before=await readFile(new URL('dist/pwa/build.json',root),'utf8');
 for(let n=0;n<2;n++){const r=spawnSync(process.execPath,['scripts/pwa-build.mjs'],{cwd:root,encoding:'utf8',windowsHide:true});assert.equal(r.status,0,r.stderr);assert.equal(await readFile(new URL('dist/pwa/build.json',root),'utf8'),before);}
 const b=JSON.parse(before);for(const [p,hash] of Object.entries(b.files))assert.equal(createHash('sha256').update(await readFile(new URL('dist/pwa/'+p,root))).digest('hex'),hash);
 for(const p of ['entry.mjs','sw.js','index.html']){const s=await readFile(new URL('dist/pwa/'+p,root),'utf8');assert.ok(s.includes(b.version));assert.ok(!s.includes('__HUGINN_BUILD_ID__'));}
});
