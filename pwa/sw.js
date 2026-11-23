import {bindStreamExport} from './stream-export-sw.mjs';
bindStreamExport();
// Asset-only offline cache. No device routes, credentials, evidence DB or ACK transport.
const BUILD='__HUGINN_BUILD_ID__';
const CACHE='huginn-pwa-p1-'+BUILD;
const ASSETS=['./export-handoff.mjs','./app-update.mjs','./flight-size-policy.mjs','./flight-stream.mjs','./flight-stream-storage.mjs','./flight-stream-worker.mjs','./flight-stream-client.mjs','./stream-export-sw.mjs','./settings-v2.mjs','./settings.mjs','./settings-ui.mjs','./settings-package.mjs','./download-diagnostics.mjs','./wake-guard.mjs','./ui-model.mjs','./pairing-scanner.mjs','./vendor/jsQR-1.4.0.js','./vendor/jsQR-LICENSE.txt','./apple-touch-icon.png','./','./index.html','./style.css','./flight-progress.mjs','./download-progress.mjs','./transfer-queue.mjs','./entry.mjs','./version-info.mjs','./adapter.mjs','./source.mjs','./flight-evidence.mjs','./flight-storage.mjs','./manifest.webmanifest','./icons/huginn-logo-original.png','./icons/icon-192.png','./icons/icon-512.png','./icons/icon-maskable-512.png','./icons/apple-touch-icon.png','./fixtures/catalog.json','./fixtures/complete.FLG','./fixtures/incomplete.FLG','./fixtures/ceiling.FLG'];
const allowed=new Set(ASSETS.map(path=>new URL(path,self.registration.scope).href));
self.addEventListener('install',event=>event.waitUntil((async()=>{
 const cache=await caches.open(CACHE);
 try{
  const response=await fetch('./build.json?install='+BUILD,{cache:'no-store'});
  if(!response.ok)throw Error('PACKAGE_MANIFEST_HTTP');
  const manifest=await response.json();if(manifest.version!==BUILD)throw Error('PACKAGE_MANIFEST_BUILD');
  let done=0;
  for(const path of ASSETS){
   const url=new URL(path,self.registration.scope),r=await fetch(url,{cache:'no-store'});
   if(!r.ok)throw Error('PACKAGE_ASSET_HTTP '+path);
   const bytes=await r.clone().arrayBuffer();
   const sha=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
   if(sha!==manifest.files[path==='./'?'index.html':path.slice(2)])throw Error('PACKAGE_ASSET_HASH '+path);
   await cache.put(url,r);done++;
   for(const client of await self.clients.matchAll({includeUncontrolled:true}))client.postMessage({type:'PACKAGE_PROGRESS',done,total:ASSETS.length});
  }
  const receipts=await caches.open('huginn-package-receipts-v1');
  const key=new URL('./__package_receipt/'+BUILD,self.registration.scope);
  if(!await receipts.match(key))await receipts.put(key,new Response(JSON.stringify({build:BUILD,revision:manifest.revision,verifiedAt:new Date().toISOString()})));
 }catch(e){await caches.delete(CACHE);throw e;}
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  for(const key of await caches.keys())if(key.startsWith('huginn-pwa-p1-')&&key!==CACHE)await caches.delete(key);
  await self.clients.claim();
})()));
self.addEventListener('message',event=>{
  if(event.data?.type==='HUGINN_VERSION_QUERY'){
    if(event.data.protocol===1&&typeof event.data.id==='string'&&event.data.id.length<=128)
      event.ports?.[0]?.postMessage({type:'HUGINN_VERSION_REPLY',protocol:1,id:event.data.id,build:BUILD,cache:CACHE,scope:self.registration.scope,assets:ASSETS});
    return;
  }
  if(event.data?.type==='ACTIVATE_WHILE_IDLE')event.waitUntil((async()=>{
    const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    if(windows.length!==1||windows[0].id!==event.source?.id){event.source?.postMessage({type:'UPDATE_BLOCKED_OTHER_WINDOWS'});return;}
    await self.skipWaiting();
  })());
});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET'||!allowed.has(event.request.url))return;
  event.respondWith((async()=>{
    const response=await (await caches.open(CACHE)).match(event.request);
    return response||fetch(event.request);
  })());
});
