import {StreamFlightStorage} from './flight-stream-storage.mjs';
import {validateEvidenceStream} from './flight-stream.mjs';
const DB_NAME='huginn-pwa-p1-no-ack';
export function bindStreamExport(){
  const pending=new Map();let busy=false;
  const close=async entry=>{clearTimeout(entry.timer);try{await entry.payload.stream.cancel();}catch{}entry.store.close();};
  self.addEventListener('message',event=>{
    if(event.data?.type!=='HUGINN_STREAM_EXPORT')return;
    event.waitUntil((async()=>{
      const port=event.ports?.[0];let store,owned=false,registered;
      try{
        const client=await self.clients.get(event.source?.id);
        if(!port||!client||!client.url.startsWith(self.registration.scope)||event.data.dbName!==DB_NAME||busy)throw Error('STREAM_EXPORT_UNAVAILABLE');
        const key=event.data.key;if(!Array.isArray(key)||key.length!==3||key.some(v=>typeof v!=='string'))throw Error('INVALID_LOCAL_KEY');
        busy=true;owned=true;
        const r=indexedDB.open(DB_NAME,1);r.onupgradeneeded=()=>r.transaction.abort();
        const db=await new Promise((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
        if([...db.objectStoreNames].sort().join()!==['chunks','clients','downloads','flights'].join()){db.close();throw Error('UNEXPECTED_DATABASE_SCHEMA');}
        store=new StreamFlightStorage(db,{validateStream:validateEvidenceStream});
        const payload=await store.createVerifiedExportStream(key),id=crypto.randomUUID(),entry={payload,store,clientId:client.id};
        entry.timer=setTimeout(()=>{if(pending.delete(id)){close(entry);busy=false;}},120000);pending.set(id,entry);registered=id;
        port.postMessage({url:new URL('./__flg_export/'+id,self.registration.scope).href,filename:payload.filename,sha256:payload.sha256});
        store=null;
      }catch(e){if(registered){const entry=pending.get(registered);pending.delete(registered);if(entry)await close(entry);}store?.close();if(owned)busy=false;port?.postMessage({error:e.message});}
    })());
  });
  self.addEventListener('fetch',event=>{
    const u=new URL(event.request.url),base=new URL('./__flg_export/',self.registration.scope);
    if(u.origin!==base.origin||!u.pathname.startsWith(base.pathname))return;
    event.respondWith((async()=>{
      const id=u.pathname.slice(base.pathname.length),entry=pending.get(id);
      if(event.request.method!=='GET'||!entry||event.clientId!==entry.clientId)return new Response('Export expired or unavailable',{status:410,headers:{'Cache-Control':'no-store'}});
      pending.delete(id);clearTimeout(entry.timer);
      const source=entry.payload.stream.getReader();
      let ended=false;const finish=()=>{if(!ended){ended=true;entry.store.close();busy=false;}};
      const stream=new ReadableStream({
        async pull(c){try{const r=await source.read();if(r.done){finish();c.close();}else c.enqueue(r.value);}catch(e){finish();c.error(e);}},
        async cancel(){try{await source.cancel();}finally{finish();}}
      },{highWaterMark:0});
      return new Response(stream,{headers:{'Content-Type':'application/octet-stream','Content-Length':String(entry.payload.physical_bytes),'Content-Disposition':'attachment; filename="'+entry.payload.filename+'"','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
    })());
  });
}
