import test from'node:test';import assert from'node:assert/strict';
import{onlinePackage}from'../pwa/app-update.mjs';import{readFile}from'node:fs/promises';
test('online release bypasses caches and HTTP failure is never latest',async()=>{
 let call;const m={schema:'huginn.pwa.build',revision:'2.42',version:'1234567890abcdef',files:{'sw.js':'x'}};
 assert.deepEqual(await onlinePackage(async(...args)=>{call=args;return Response.json(m);}),m);
 assert.match(call[0],/^\.\/build.json\?update=\d+$/);assert.equal(call[1].cache,'no-store');assert.ok(call[1].signal);
 await assert.rejects(()=>onlinePackage(async()=>new Response('',{status:503})),/NET_HTTP_503/);
 await assert.rejects(()=>onlinePackage(async()=>{throw Error('OFFLINE')}),/OFFLINE/);
 await assert.rejects(()=>onlinePackage(async()=>Response.json({version:'bad'})),/INVALID_PACKAGE/);
});
test('download core and data schema match frozen benchmark byte for byte',async()=>{
 const root='C:/HuginnAPP/dist/pwa/',old='C:/HuginnEIS/Evidence/REV2.41-20261122/app-review-a2f8f176d210e2e6/';
 for(const file of ['adapter.mjs','source.mjs','flight-stream.mjs','flight-stream-storage.mjs','flight-stream-client.mjs','flight-stream-worker.mjs','flight-evidence.mjs','flight-storage.mjs','stream-export-sw.mjs','settings.mjs','settings-v2.mjs','settings-ui.mjs','settings-package.mjs'])assert.deepEqual(await readFile(root+file),await readFile(old+file),file);
});
