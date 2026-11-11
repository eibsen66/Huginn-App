import test from 'node:test';import assert from 'node:assert/strict';
import {createBrowserSource} from '../dist/pwa/source.mjs';import {createV2SettingsSession} from '../dist/pwa/settings-v2.mjs';
const opts={origin:'https://192.168.4.1',selectedOrigin:'https://192.168.4.1',profile:'DEV_BROWSER_OS_TLS_V1',pairing:JSON.stringify({schema:'huginn.flight-courier.pair',schema_version:1,source_device_id:'AA:BB:CC:DD:EE:FF',tls_spki_sha256:'6'.repeat(64),token:'A'.repeat(43)})};
for(const [name,fetch,code,phase,status]of [
 ['fetch rejection',async()=>{throw new TypeError('SECRET bearer '+JSON.parse(opts.pairing).token);},'FETCH_REJECTED','fetch',null],
 ['body rejection',async()=>new Response(new ReadableStream({pull(c){c.error(new TypeError('SECRET'));}})),'RESPONSE_READ_FAILED','body',200],
 ['invalid UTF8',async()=>new Response(Uint8Array.of(255)),'INVALID_RESPONSE_ENCODING','decode',200],
 ['invalid JSON',async()=>new Response('{invalid SECRET}'),'INVALID_RESPONSE_JSON','json',200],
 ['response processing TypeError',async()=>({status:200,ok:true,headers:{get(){throw new TypeError('SECRET');}}}),'RESPONSE_PROCESSING_FAILED','headers',200],
 ['HTTP status',async()=>Response.json({ok:false,error:'SECRET'},{status:503}),'HTTP_503','body',503]
])test('read-only settings diagnostics distinguish '+name,async()=>{
 let calls=0;const source=createBrowserSource({...opts,fetch:async(url,o)=>{calls++;assert.equal(o.method,'GET');return fetch(url,o);}});
 await assert.rejects(source.settingsV2(),e=>{assert.equal(e.message,code);assert.equal(e.diagnostic.phase,phase);assert.equal(e.diagnostic.httpStatus,status);assert.equal(e.diagnostic.method,'GET');assert.doesNotMatch(JSON.stringify(e.diagnostic),/SECRET|Bearer|AAAAA|token|192\.168/);return true;});
 assert.equal(calls,1);assert.equal(source.hasAuthorization(),true);assert.equal(source.settingsDiagnostic().code,code);source.close();
});
test('valid HTTP/JSON with invalid schema is a validation error, not fetch rejection',async()=>{
 const source=createBrowserSource({...opts,fetch:async()=>Response.json(null)});await assert.rejects(createV2SettingsSession(source).load(),/SETTINGS_/);
 assert.equal(source.settingsDiagnostic().phase,'complete');assert.equal(source.settingsDiagnostic().httpStatus,200);source.close();
});
test('prepared c0 transport conflates rejected fetch and UTF8 TypeError; corrected transport separates them',async()=>{
 const {createBrowserSource:before}=await import('../build/settings-retrieval-review/candidate-c0f222305a4d2c25/source.mjs');
 for(const fetch of [async()=>{throw TypeError('fixture rejection');},async()=>new Response(Uint8Array.of(255))]){
  const s=before({...opts,fetch});await assert.rejects(s.settingsV2(),e=>e.diagnostic.code==='FETCH_OR_TYPE_ERROR');s.close();
 }
});
