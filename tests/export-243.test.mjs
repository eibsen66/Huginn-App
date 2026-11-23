import test from'node:test';import assert from'node:assert/strict';import{readFile}from'node:fs/promises';
import{prepareExportFile,exportFile}from'../dist/pwa/export-handoff.mjs';import{sha256}from'../flight-evidence.mjs';
const bytes=new Uint8Array([0,255,72,70,76,0,128]);const descriptor={streamKey:['a','b','c'],dbName:'test',filename:'F237001.FLG',physical_bytes:bytes.length,sha256:await sha256(bytes)};
const location={href:'https://example.test/',origin:'https://example.test'};
function env(response){return {location,navigator:{serviceWorker:{controller:{postMessage(message,ports){if(message.type==='HUGINN_STREAM_EXPORT')queueMicrotask(()=>ports[0].postMessage({url:location.href+'__flg_export/id',filename:descriptor.filename,sha256:descriptor.sha256}));}}}},fetch:async()=>response};}
function response(body=bytes){return new Response(body,{headers:{'Content-Type':'application/octet-stream','Content-Length':String(bytes.length),'Content-Disposition':'attachment; filename="F237001.FLG"'}});}
test('29-byte HTTP error, wrong MIME, wrong size and wrong whole SHA never become a File',async()=>{
 await assert.rejects(()=>prepareExportFile(descriptor,env(new Response('Export expired or unavailable',{status:410}))),/EXPORT_HTTP_410/);
 await assert.rejects(()=>prepareExportFile(descriptor,env(new Response(bytes))),/EXPORT_RESPONSE_IDENTITY/);
 await assert.rejects(()=>prepareExportFile(descriptor,env(response(new Uint8Array(1)))),/EXPORT_SHA_OR_SIZE/);
 await assert.rejects(()=>prepareExportFile(descriptor,env(response(new Uint8Array(bytes.length)))),/EXPORT_SHA_OR_SIZE/);
});
test('binary bytes/name/type survive preparation; share invoked in original synchronous click',async()=>{
 const prepared=await prepareExportFile(descriptor,env(response()));assert.equal(prepared.file.name,'F237001.FLG');assert.equal(prepared.file.type,'application/octet-stream');assert.deepEqual(new Uint8Array(await prepared.file.arrayBuffer()),bytes);
 let invoked=false;const pending=exportFile(prepared,{navigator:{canShare:()=>true,share:async({files})=>{invoked=true;assert.equal(files[0],prepared.file);}}});assert.equal(invoked,true);assert.equal((await pending).status,'HANDED_TO_SHARE_TARGET');
 const cancelled=await exportFile(prepared,{navigator:{canShare:()=>true,share:async()=>{throw new DOMException('Cancelled','AbortError')}}});assert.equal(cancelled.status,'CANCELLED');
 await assert.rejects(()=>exportFile(prepared,{navigator:{canShare:()=>true,share:async()=>{throw new DOMException('denied','NotAllowedError')}}}),/denied/);
});
test('preparation cancellation remains AbortError and cannot hand off a partial file',async()=>{
 const controller=new AbortController();await assert.rejects(()=>prepareExportFile(descriptor,{...env(response()),signal:controller.signal,onProgress:()=>controller.abort()}),e=>e.name==='AbortError');
});
test('download/verification/storage code and all persisted schema bytes are unchanged',async()=>{
 const root='C:/HuginnAPP/',prior=root+'Evidence/UPDATE-REV2.42-20261123/app-review-a3b9ebefa12555a3/';
 for(const file of ['source.mjs','flight-stream.mjs','flight-stream-storage.mjs','flight-stream-worker.mjs','flight-stream-client.mjs','flight-storage.mjs','flight-evidence.mjs','app-update.mjs'])assert.deepEqual(await readFile(root+'dist/pwa/'+file),await readFile(prior+file),file);
 const before=await readFile(root+'Evidence/EXPORT-REV2.43-20261123/before/adapter.mjs','utf8'),after=await readFile(root+'pwa/adapter.mjs','utf8');assert.equal(after.slice(0,after.indexOf('export {prepareExportFile')),before.slice(0,before.indexOf('export async function exportFile(')));
});
