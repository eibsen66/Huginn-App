import test from 'node:test';import assert from 'node:assert/strict';
import {createBrowserSource} from '../build/navigation-review/candidate-eb5241dc6e9995ba/source.mjs';
const opts={origin:'https://192.168.4.1',selectedOrigin:'https://192.168.4.1',profile:'DEV_BROWSER_OS_TLS_V1',pairing:JSON.stringify({schema:'huginn.flight-courier.pair',schema_version:1,source_device_id:'AA:BB:CC:DD:EE:FF',tls_spki_sha256:'6'.repeat(64),token:'A'.repeat(43)})};
for(const operation of ['pause','close','stream-error'])test('review frozen app cancellation ordering: '+operation,async()=>{
 let controller,signal,ready;const seen=[],waiting=new Promise(r=>ready=r);let pulls=0;
 const source=createBrowserSource({...opts,fetch:async(url,o)=>{signal=o.signal;signal.addEventListener('abort',()=>{seen.push('abort');controller.error(new DOMException('fixture abort','AbortError'));});return new Response(new ReadableStream({start(c){controller=c;c.enqueue(new Uint8Array(8192));},pull(){if(++pulls>=1)ready();}}),{headers:{'content-length':'29502'}});}});
 const work=source.settingsV2();await waiting;await Promise.resolve();await Promise.resolve();
 if(operation==='stream-error'){seen.push('read-failure');controller.error(TypeError('fixture stream failure'));}else source[operation]();
 await assert.rejects(work,e=>{assert.equal(e.diagnostic.code,operation==='stream-error'?'RESPONSE_READ_FAILED':'CANCELLED');assert.equal(e.diagnostic.httpStatus,200);assert.equal(e.diagnostic.declaredBytes,29502);return true;});
 if(operation==='stream-error'){assert.deepEqual(seen,['read-failure','abort']);assert.equal(source.hasAuthorization(),true);}source.close();
});
