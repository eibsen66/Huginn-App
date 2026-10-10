const valid=v=>typeof v==='string'&&/^[0-9a-f]{16}$/.test(v);
export async function queryWorker(worker,scope,{Channel=globalThis.MessageChannel,timeout=1000}={}){
 if(!worker)return {status:'Unavailable'};
 if(typeof Channel!=='function')return {status:'Unknown'};
 return new Promise(resolve=>{
 const c=new Channel(),id=crypto.randomUUID();let timer;
 const done=r=>{clearTimeout(timer);c.port1.close();c.port2.close();resolve(r);};
 c.port1.onmessage=e=>{
 const r=e.data;
 try{
 if(!r||r.type!=='HUGINN_VERSION_REPLY'||r.protocol!==1||r.id!==id||!valid(r.build)||r.scope!==scope||r.cache!=='huginn-pwa-p1-'+r.build||!Array.isArray(r.assets)||!r.assets.length||r.assets.length>32||new Set(r.assets).size!==r.assets.length||r.assets.some(p=>typeof p!=='string'||!p.startsWith('./')||new URL(p,scope).origin!==new URL(scope).origin))throw Error();
 done({status:'Known',build:r.build,cache:r.cache,assets:r.assets,scope});
 }catch{done({status:'Unknown'});}
 };
 timer=setTimeout(()=>done({status:'Unknown'}),timeout);
 try{worker.postMessage({type:'HUGINN_VERSION_QUERY',protocol:1,id},[c.port2]);}catch{done({status:'Unknown'});}
 });
}
export async function inspectVersions(appBuild,htmlBuild,{serviceWorker=globalThis.navigator?.serviceWorker,cacheStorage=globalThis.caches,Channel=globalThis.MessageChannel,timeout=1000}={}){
 const unknown={status:'Unknown'},missing={status:'Unavailable'};
 const r={appBuild:valid(appBuild)?appBuild:'Unknown',controller:missing,active:missing,waiting:{status:'None'},cache:'Unknown worker identity',mismatch:false,htmlMismatch:valid(appBuild)&&valid(htmlBuild)&&appBuild!==htmlBuild};
 if(!serviceWorker)return r;
 let reg;try{reg=await serviceWorker.getRegistration();}catch{r.controller=r.active=r.waiting=unknown;return r;}
 const controller=serviceWorker.controller,active=reg?.active,waiting=reg?.waiting,scope=reg?.scope;
 if(!scope){r.controller=controller?unknown:missing;r.active=r.waiting=unknown;return r;}
 [r.controller,r.active,r.waiting]=await Promise.all([queryWorker(controller,scope,{Channel,timeout}),queryWorker(active,scope,{Channel,timeout}),waiting?queryWorker(waiting,scope,{Channel,timeout}):{status:'None'}]);
 const changed=()=>serviceWorker.controller!==controller||reg.active!==active||reg.waiting!==waiting;
 const invalidate=()=>{r.controller=r.active=r.waiting=unknown;r.mismatch=false;r.cache='Inspection changed; refresh information';};
 if(changed()){invalidate();return r;}
 r.mismatch=valid(appBuild)&&r.controller.status==='Known'&&appBuild!==r.controller.build;
 if(r.controller.status!=='Known')return r;
 try{
 if(!cacheStorage?.keys||!cacheStorage?.match)throw Error();
 const identity=r.controller;
 if(!(await cacheStorage.keys()).includes(identity.cache))r.cache='Missing cache: '+identity.cache;
 else{
 let missingCount=0;
 for(const asset of identity.assets){const response=await cacheStorage.match(new URL(asset,scope).href,{cacheName:identity.cache});if(!response?.ok)missingCount++;}
 r.cache=identity.cache+' — '+(missingCount?'Missing assets: '+missingCount:'Complete expected shell (assets present)');
 }
 }catch{r.cache='Unavailable cache inspection';}
 if(changed())invalidate();
 return r;
}
export function bindVersionInformation({appBuild,htmlBuild,document=globalThis.document,inspect=inspectVersions}){
 const el=id=>document.getElementById(id),label=v=>v.status==='Known'?v.build:v.status;
 let refreshing=false;
 async function refresh(){
 if(refreshing)return;refreshing=true;
 el('info-refresh').disabled=true;
 try{
 const r=await inspect(appBuild,htmlBuild);
 el('info-app').textContent=r.appBuild;el('info-controller').textContent=label(r.controller);el('info-active').textContent=label(r.active);el('info-waiting').textContent=label(r.waiting);el('info-cache').textContent=r.cache;
 el('info-warning').textContent=[r.htmlMismatch?'HTML and application versions differ':'',r.mismatch?'Application and worker versions differ':''].filter(Boolean).join('. ');
 }catch{el('info-warning').textContent='Version inspection unavailable';}
 finally{refreshing=false;el('info-refresh').disabled=false;}
 }
 el('info-refresh').onclick=refresh;return refresh();
}
