import test from 'node:test';import assert from 'node:assert/strict';
import {createBrowserSource} from '../dist/pwa/source.mjs';
const pairing=JSON.stringify({schema:'huginn.flight-courier.pair',schema_version:1,source_device_id:'AA:BB:CC:DD:EE:FF',tls_spki_sha256:'6'.repeat(64),token:'A'.repeat(43)});
const options={origin:'https://192.168.4.1',selectedOrigin:'https://192.168.4.1',profile:'DEV_BROWSER_OS_TLS_V1',pairing};
const list=()=>Response.json({schema:'huginn.flight-courier.list',schema_version:1,source_device_id:'AA:BB:CC:DD:EE:FF',capacity:64,count:0,entries:[],next_cursor:null,manifest_generation:1});
test('transport failure then repeated reconnect reuses only current memory authorization',async()=>{
 let fail=true;const s=createBrowserSource({...options,fetch:async()=>{if(fail)throw TypeError('offline');return list();}});
 await assert.rejects(s.list());assert(s.hasAuthorization());s.pause();fail=false;assert.deepEqual(await s.list(),[]);assert.deepEqual(await s.list(),[]);s.close();assert(!s.hasAuthorization());
});
test('pause settles a fetch ignoring AbortSignal, and ignores its late 401 without revoking the current session',async()=>{
 let release,n=0;const s=createBrowserSource({...options,fetch:async()=>++n===1?new Promise(r=>release=r):list()});
 const old=s.list();s.pause();await assert.rejects(old,/CANCELLED/);assert.deepEqual(await s.list(),[]);
 release(new Response('{}',{status:401}));await new Promise(r=>setTimeout(r,0));assert(s.hasAuthorization());assert.deepEqual(await s.list(),[]);s.close();
});
test('close settles pending body read even if reader cancellation never resolves',async()=>{
 const s=createBrowserSource({...options,fetch:async()=>new Response(new ReadableStream({pull(){return new Promise(()=>{});},cancel(){return new Promise(()=>{});}}))});
 const pending=s.settingsV2();await new Promise(r=>setTimeout(r,0));s.close();await assert.rejects(pending,/CANCELLED/);assert(!s.hasAuthorization());
});
test('complete Settings 409 leaves authenticated flight listing usable',async()=>{
 const s=createBrowserSource({...options,fetch:async url=>url.endsWith('/settings')?new Response('{"ok":false,"error":"SETTINGS_BUSY_OR_UNAVAILABLE"}',{status:409,headers:{'Content-Length':'51'}}):list()});
 await assert.rejects(s.settingsV2(),/SETTINGS_BUSY_OR_UNAVAILABLE/);assert(s.hasAuthorization());assert.deepEqual(await s.list(),[]);assert.equal(s.settingsDiagnostic().receivedBytes,51);s.close();
});
for(const status of [401,403])test('expired/revoked authorization '+status+' requires a fresh pairing source',async()=>{
 const old=createBrowserSource({...options,fetch:async()=>new Response('{}',{status})});await assert.rejects(old.list(),/AUTH_REQUIRED/);assert(!old.hasAuthorization());await assert.rejects(old.list(),/AUTH_REQUIRED/);
 const fresh=createBrowserSource({...options,fetch:async()=>list()});assert.deepEqual(await fresh.list(),[]);fresh.close();old.close();
});
