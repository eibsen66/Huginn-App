// Asset-only offline cache. No device routes, credentials, evidence DB or ACK transport.
const BUILD='__HUGINN_BUILD_ID__';
const CACHE='huginn-pwa-p1-'+BUILD;
const ASSETS=['./apple-touch-icon.png','./','./index.html','./style.css','./entry.mjs','./version-info.mjs','./adapter.mjs','./flight-evidence.mjs','./flight-storage.mjs','./manifest.webmanifest','./icons/huginn-logo-original.png','./icons/icon-192.png','./icons/icon-512.png','./icons/icon-maskable-512.png','./icons/apple-touch-icon.png','./fixtures/catalog.json','./fixtures/complete.FLG','./fixtures/incomplete.FLG','./fixtures/ceiling.FLG'];
const allowed=new Set(ASSETS.map(path=>new URL(path,self.registration.scope).href));
self.addEventListener('install',event=>event.waitUntil((async()=>{
  const cache=await caches.open(CACHE);
  try{await cache.addAll(ASSETS);}catch(e){await caches.delete(CACHE);throw e;}
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
