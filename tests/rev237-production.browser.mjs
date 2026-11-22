import {openPwa,DB_NAME} from './adapter.mjs';
import {createBrowserSource} from './source.mjs';
import {StreamingSha256} from './flight-stream.mjs';
import {evidenceKey} from './flight-storage.mjs';
const assert=(x,m)=>{if(!x)throw Error(m);};
const req=r=>new Promise((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
const rejected=async f=>{try{await f();}catch(e){return e;}throw Error('EXPECTED_FAILURE');};
const catalog={schema:'huginn.pwa.synthetic-fixtures',fixtures:[]};
async function config(){return (await(await fetch('/__fixture')).json());}
async function db(){return req(indexedDB.open(DB_NAME,1));}
async function snapshot(key){const d=await db();try{const t=d.transaction(['downloads','flights','chunks']);return {download:await req(t.objectStore('downloads').get(key)),published:await req(t.objectStore('flights').count(key)),chunks:await req(t.objectStore('chunks').index('evidence').count(key))};}finally{d.close();}}
const source=m=>createBrowserSource({origin:location.origin+'/',selectedOrigin:location.origin+'/',testLoopback:true,profile:'DEV_BROWSER_OS_TLS_V1',pairing:JSON.stringify({schema:'huginn.flight-courier.pair',schema_version:1,source_device_id:m.source_device_id,tls_spki_sha256:'0'.repeat(64),token:'A'.repeat(43)})});
async function fresh(){await req(indexedDB.deleteDatabase(DB_NAME));return openPwa({catalog});}
export async function runProduction237(phase='suite'){
  const {metadata:m}=await config(),key=evidenceKey(m),results=[];
  if(phase==='after-restart'){
    const app=await openPwa({catalog});try{const rows=await app.list();assert(rows.length===1,'RESTORED_LIST');const f=await app.verify(key);return {pass:true,bytes:Number(f.metadata.physical_bytes),sha256:f.metadata.physical_sha256,...await snapshot(key)};}finally{app.close();}
  }
  if(phase==='reimport'){
    const file=document.querySelector('#fixture-input').files[0];assert(file,'REAL_FILE_INPUT');const app=await openPwa({catalog});try{return {pass:(await app.reimport(key,file)).byteIdentical};}finally{app.close();}
  }
  const run=async(name,work)=>{try{results.push({name,pass:true,...await work()});}catch(e){results.push({name,pass:false,error:e.message,stack:e.stack});}};
  await run('production source+adapter download, strict chunks and independent durable verification',async()=>{
    const app=await fresh(),src=source(m);try{
      const result=await app.download(src,m.session_id);assert(result.status==='VERIFIED LOCAL','VERIFIED');
      const saved=await snapshot(key);assert(saved.published===1&&saved.chunks===Math.ceil(Number(m.physical_bytes)/16384),'DURABLE_LAYOUT');
      assert(!JSON.stringify(saved.download).includes('a'.repeat(32))&&!JSON.stringify(saved.download).includes('A'.repeat(43)),'NO_HANDLE_OR_TOKEN_IN_IDB');
      const listed=await app.list();assert(!('records' in (listed[0].validation??{})),'NO_RECORD_GRAPH');
      src.pause();await rejected(()=>src.readRange(m,0,127));
      await app.verify(key);return {bytes:Number(m.physical_bytes),chunks:saved.chunks};
    }finally{src.close();app.close();}
  });
  await run('production mid-response interruption commits zero unverified bytes',async()=>{
    const app=await fresh(),src=source(m);try{
      await fetch('/__control?drop=1');await rejected(()=>app.download(src,m.session_id));
      const saved=await snapshot(key);assert(saved.download.committed_offset==='0'&&saved.published===0&&saved.chunks===0,'NO_PARTIAL_RESPONSE_COMMIT');
    }finally{src.close();app.close();}
  });
  await run('strict commit interruption preserves old16KiB prefix and resumes after reopen',async()=>{
    let app=await fresh(),src=source(m);const original=IDBObjectStore.prototype.add;let injected=false;
    IDBObjectStore.prototype.add=function(value,k){if(this.name==='chunks'&&k.at(-1)==='16384'&&!injected){injected=true;throw new DOMException('Injected test quota','QuotaExceededError');}return original.call(this,value,k);};
    try{await rejected(()=>app.download(src,m.session_id));}finally{IDBObjectStore.prototype.add=original;src.close();app.close();}
    const saved=await snapshot(key);assert(saved.download.committed_offset==='16384'&&saved.published===0,'STRICT_PREFIX');
    await fetch('/__control?reset=1');app=await openPwa({catalog});src=source(m);
    try{await app.download(src,m.session_id);const stats=await(await fetch('/__stats')).json();assert(stats.ranges[0][0]===16384,'RESUME_OLD_OFFSET');await app.verify(key);}finally{src.close();app.close();}
    return {resume_offset:16384};
  });
  await run('module service worker streams verified export without whole-file Blob',async()=>{
    const reg=await navigator.serviceWorker.register('./sw.js',{scope:'./',type:'module'});
    await Promise.race([navigator.serviceWorker.ready,new Promise((_,j)=>setTimeout(()=>j(Error('SW_READY_TIMEOUT')),30000))]);
    if(!navigator.serviceWorker.controller)await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error('SW_CONTROL_TIMEOUT')),10000);navigator.serviceWorker.addEventListener('controllerchange',()=>{clearTimeout(t);resolve();},{once:true});});
    assert(reg.active,'ACTIVE_SW');
    const app=await openPwa({catalog});try{
      const descriptor=await app.export(key);assert(!('bytes' in descriptor)&&descriptor.streamKey,'NO_FILE_SIZED_EXPORT_PAYLOAD');
      const channel=new MessageChannel();const ready=new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error('EXPORT_PREPARE_TIMEOUT')),60000);channel.port1.onmessage=({data})=>{clearTimeout(t);data.error?reject(Error(data.error)):resolve(data);};});
      navigator.serviceWorker.controller.postMessage({type:'HUGINN_STREAM_EXPORT',dbName:DB_NAME,key},[channel.port2]);
      const info=await ready;channel.port1.close();const response=await fetch(info.url);assert(response.ok,'EXPORT_RESPONSE_'+response.status);
      const reader=response.body.getReader(),sha=new StreamingSha256();let count=0,maxChunk=0;
      for(;;){const r=await reader.read();if(r.done)break;sha.update(r.value);count+=r.value.length;maxChunk=Math.max(maxChunk,r.value.length);}
      assert(count===Number(m.physical_bytes)&&sha.digest()===m.physical_sha256,'EXPORTED_WHOLE_SHA');
      assert((await fetch(info.url)).status===410,'SINGLE_USE_EXPORT');return {bytes:count,max_response_chunk:maxChunk};
    }finally{app.close();}
  });
  return results;
}
