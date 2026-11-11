import test from 'node:test';import assert from 'node:assert/strict';
import {createBrowserSource} from '../dist/pwa/source.mjs';
import {createV2SettingsSession} from '../dist/pwa/settings-v2.mjs';
import {settingsHost} from './settings-protocol-host.mjs';
const device='AA:BB:CC:DD:EE:FF';
const options={origin:'https://192.168.4.1',selectedOrigin:'https://192.168.4.1',profile:'DEV_BROWSER_OS_TLS_V1',pairing:JSON.stringify({schema:'huginn.flight-courier.pair',schema_version:1,source_device_id:device,tls_spki_sha256:'6'.repeat(64),token:'A'.repeat(43)})};
function stream(bytes,{declared=true,truncate=false,error=false,chunk=4096}={}){let offset=0;return new Response(new ReadableStream({pull(c){if(offset===bytes.length){if(error)c.error(TypeError('sensitive fixture message'));else c.close();return;}const end=Math.min(bytes.length,offset+chunk);c.enqueue(bytes.slice(offset,end));offset=end;}}),{headers:declared?{'content-length':String(bytes.length+(truncate?1:0))}:{}});}
test('full source-derived settings and exact body boundaries, declared and chunked; partial data never succeeds',async()=>{
 const h=settingsHost();let config;try{config=await h.request({method:'get'});}finally{h.close();}
 const full=new TextEncoder().encode(JSON.stringify(config));assert(full.length>20480);
 for(const declared of [true,false]){
  for(const size of [full.length,32767,32768,32769,131071,131072,131073]){
   const bytes=new Uint8Array(size).fill(32);bytes.set(full);
   const source=createBrowserSource({...options,fetch:async()=>stream(bytes,{declared})});
   const session=createV2SettingsSession(source);
   if(size<=131072){await session.load();assert.equal(session.config.fields.length,config.fields.length);assert.equal(source.requestDiagnostic().receivedBytes,size);}
   else await assert.rejects(session.load(),e=>e.diagnostic.code==='RESPONSE_LENGTH');source.close();
  }
  // Smaller valid schema fixtures isolate the physical 20 KiB boundary from full document size.
  const small={...config,fields:['Display','Units','Aircraft','Engine','AUX','Fuel'].map(section=>config.fields.find(f=>f.section===section))};
  const raw=new TextEncoder().encode(JSON.stringify(small));
  for(const size of [20479,20480,20481]){const bytes=new Uint8Array(size).fill(32);bytes.set(raw);const source=createBrowserSource({...options,fetch:async()=>stream(bytes,{declared})});await createV2SettingsSession(source).load();assert.equal(source.requestDiagnostic().receivedBytes,size);source.close();}
 }
 for(const error of [true,false]){
  const bytes=full.slice(0,20480),source=createBrowserSource({...options,fetch:async()=>stream(bytes,{declared:true,truncate:!error,error})});
  await assert.rejects(createV2SettingsSession(source).load(),e=>{assert.equal(e.diagnostic.receivedBytes,20480);assert.equal(e.diagnostic.code,error?'RESPONSE_READ_FAILED':'RESPONSE_LENGTH');assert.equal(e.diagnostic.declaredBytes,error?20480:20481);return true;});source.close();
 }
 const partial=createBrowserSource({...options,fetch:async()=>stream(full.slice(0,20480),{declared:false})});await assert.rejects(createV2SettingsSession(partial).load(),e=>e.diagnostic.code==='INVALID_RESPONSE_JSON');partial.close();
});
