import test from 'node:test';import assert from 'node:assert/strict';
import {createBrowserSource} from '../dist/pwa/source.mjs';
import {transferDiagnostic} from '../dist/pwa/download-diagnostics.mjs';
const options={origin:'https://192.168.4.1',selectedOrigin:'https://192.168.4.1',profile:'DEV_BROWSER_OS_TLS_V1',pairing:JSON.stringify({schema:'huginn.flight-courier.pair',schema_version:1,source_device_id:'AA:BB:CC:DD:EE:FF',tls_spki_sha256:'6'.repeat(64),token:'A'.repeat(43)})};
const valid=()=>Response.json({schema:'huginn.flight-courier.list',schema_version:1,source_device_id:'AA:BB:CC:DD:EE:FF',capacity:64,count:0,entries:[],next_cursor:null,manifest_generation:1});
for(const [body,state,serverCode] of [
 ['{"error":"COURIER_BUSY"}','recognized','COURIER_BUSY'],['{"error":"SOURCE_ID_UNAVAILABLE"}','recognized','SOURCE_ID_UNAVAILABLE'],
 ['{"ok":false,"error":"COURIER_BUSY","token":"SECRET"}','recognized','COURIER_BUSY'],
 ['{"error":"SECRET"}','unknown'],['','empty'],['{SECRET','invalid_json'],['null','invalid_schema'],['[]','invalid_schema'],
 ['{"error":3}','invalid_schema'],['{"ok":true,"error":"COURIER_BUSY"}','invalid_schema'],['{"error":"SECRET","error":"COURIER_BUSY"}','invalid_schema'],[Uint8Array.of(255),'invalid_utf8']
])test('503 body '+state+' '+String(body).slice(0,35),async()=>{
 const s=createBrowserSource({...options,fetch:async()=>new Response(body,{status:503})});
 await assert.rejects(s.list(),e=>{assert.equal(e.message,'HTTP_503');assert.equal(e.diagnostic.httpStatus,503);assert.equal(e.diagnostic.errorBodyStatus,state);assert.equal(e.diagnostic.serverErrorCode,serverCode);assert.doesNotMatch(JSON.stringify(e),/SECRET|AAAAA|Bearer|token/);return true;});assert.equal(s.hasAuthorization(),true);s.close();
});
test('cursor 409 preserves original source-change guard and reports code separately',async()=>{
 const s=createBrowserSource({...options,fetch:async()=>Response.json({error:'CURSOR_STALE'},{status:409})});await assert.rejects(s.list(),e=>e.message==='SOURCE_CHANGED'&&e.diagnostic.httpStatus===409&&e.diagnostic.serverErrorCode==='CURSOR_STALE');s.close();
});
for(const declared of [null,'9000'])test('bounded error response rejects oversized '+declared,async()=>{
 const s=createBrowserSource({...options,fetch:async()=>new Response('x'.repeat(4097),{status:503,headers:declared?{'Content-Length':declared}:{}})});await assert.rejects(s.list(),e=>e.diagnostic.httpStatus===503&&e.diagnostic.errorBodyStatus==='too_large'&&!e.diagnostic.serverErrorCode);s.close();
});
test('broken stream retains HTTP status and received bytes without exception text',async()=>{
 let n=0;const s=createBrowserSource({...options,fetch:async()=>new Response(new ReadableStream({pull(c){if(n++===0)c.enqueue(new TextEncoder().encode('{"error":'));else c.error(TypeError('SECRET'));}}),{status:503,headers:{'Content-Length':'24'}})});
 await assert.rejects(s.list(),e=>e.message==='RESPONSE_READ_FAILED'&&e.diagnostic.httpStatus===503&&e.diagnostic.receivedBytes===9&&e.diagnostic.phase==='body'&&e.diagnostic.errorBodyStatus==='unreadable');s.close();
});
test('truncated declared length never accepts recognized partial body',async()=>{
 const s=createBrowserSource({...options,fetch:async()=>new Response('{"error":"COURIER_BUSY"}',{status:503,headers:{'Content-Length':'100'}})});await assert.rejects(s.list(),e=>e.message==='RESPONSE_LENGTH'&&e.diagnostic.errorBodyStatus==='unreadable'&&e.diagnostic.httpStatus===503&&!e.diagnostic.serverErrorCode);s.close();
});
for(const stage of ['fetch','body'])test('obsolete '+stage+' response cannot replace current diagnostic',async()=>{
 let release,started;const ready=new Promise(r=>started=r);let call=0;
 const s=createBrowserSource({...options,fetch:async()=>{if(call++)return valid();if(stage==='fetch'){started();return new Promise(r=>release=()=>r(Response.json({error:'COURIER_BUSY'},{status:503})));}return new Response(new ReadableStream({pull(c){started();return new Promise(r=>release=()=>{try{c.enqueue(new TextEncoder().encode('{"error":"COURIER_BUSY"}'));c.close();}catch{}r();});}}),{status:503});}});
 const old=s.list();const rejection=assert.rejects(old,/CANCELLED/);await ready;s.pause();await s.list();const current=s.requestDiagnostic();release();await rejection;await new Promise(r=>setTimeout(r,5));assert.deepEqual(s.requestDiagnostic(),current);assert.equal(current.phase,'complete');s.close();
});
test('explicit abort during body read does not report a server cause',async()=>{
 let ready;const begun=new Promise(r=>ready=r),abort=new AbortController();const s=createBrowserSource({...options,fetch:async()=>new Response(new ReadableStream({pull(){ready();return new Promise(()=>{});}}),{status:503})});
 const pending=s.list({signal:abort.signal});const rejected=assert.rejects(pending,e=>e.message==='CANCELLED'&&e.diagnostic.errorBodyStatus==='interrupted'&&e.diagnostic.httpStatus===503&&!e.diagnostic.serverErrorCode);await begun;abort.abort();await rejected;s.close();
});
test('sanitizer drops raw fields and non-allowlisted codes',()=>{
 const d=transferDiagnostic(Error('HTTP_503'),{errorBodyStatus:'recognized',serverErrorCode:'SECRET',raw:'SECRET',token:'SECRET',httpStatus:503});assert.equal(d.serverErrorCode,undefined);assert.doesNotMatch(JSON.stringify(d),/SECRET|raw|token/);
});
test('revocation and fresh in-memory pairing remain supported',async()=>{
 const s=createBrowserSource({...options,fetch:async()=>Response.json({error:'INVALID_TOKEN'},{status:401})});await assert.rejects(s.list(),/AUTH_REQUIRED/);assert.equal(s.hasAuthorization(),false);s.close();const fresh=createBrowserSource({...options,fetch:async()=>valid()});assert.deepEqual(await fresh.list(),[]);fresh.close();
});
