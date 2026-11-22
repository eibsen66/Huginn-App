import test from 'node:test';import assert from 'node:assert/strict';
import {createBrowserSource,evidenceEtag} from '../dist/pwa/source.mjs';
import {fixture} from './flight-fixtures.mjs';
import {preparationPresentation} from '../dist/pwa/download-progress.mjs';
const pair={schema:'huginn.flight-courier.pair',schema_version:1,source_device_id:'AA:BB:CC:DD:EE:FF',tls_spki_sha256:'6'.repeat(64),token:'A'.repeat(43)};
async function setup(sequence){
 const f=fixture();Object.assign(f.metadata,{schema:'huginn.flight-courier.metadata',schema_version:1,manifest_generation:17,eligible:true,reason:'AUTOMATIC',transfer_state:'NOT_TRANSFERRED'});let requests=[];
 const source=createBrowserSource({origin:'https://192.168.4.1',selectedOrigin:'https://192.168.4.1',profile:'DEV_BROWSER_OS_TLS_V1',pairing:JSON.stringify(pair),fetch:async(url,options)=>{
  if(!url.endsWith('/evidence')){
   const n=f.raw.length;const frames=[{event:'progress',stage:'snapshot_before',completed:0,total:0},{event:'progress',stage:'hash',completed:0,total:n},{event:'progress',stage:'hash',completed:n,total:n},{event:'progress',stage:'snapshot_after',completed:n,total:n},{event:'metadata',metadata:f.metadata,etag:evidenceEtag(f.metadata),prepared:'a'.repeat(32)}];
   return new Response(frames.map(v=>JSON.stringify(v)+'\n').join(''),{headers:{'content-type':'application/vnd.huginn.flight-prepared+ndjson'}});
  }
  const headers=new Headers(options.headers);requests.push({range:headers.get('range'),handle:headers.get('x-huginn-prepared'),etag:headers.get('if-match')});const status=sequence.shift()??'ok';
  if(status!=='ok')return Response.json({error:status},{status:status==='EVIDENCE_CHANGED'?412:503});
  const [a,b]=headers.get('range').slice(6).split('-').map(Number);return new Response(f.raw.subarray(a,b+1),{status:206,headers:{etag:evidenceEtag(f.metadata),'accept-ranges':'bytes','content-range':`bytes ${a}-${b}/${f.raw.length}`,'content-length':String(b-a+1)}});
 }});const m=await source.detail(f.metadata.session_id);return {source,m,f,requests};
}
test('one typed BUSY resubmits exact range/handle/etag once without offset mutation',async()=>{
 const s=await setup(['COURIER_BUSY','ok']);const events=[];const bytes=await s.source.readRange(s.m,128,255,{onProgress:p=>events.push(p)});
 assert.deepEqual(Buffer.from(bytes),s.f.raw.subarray(128,256));assert.equal(s.requests.length,2);assert.deepEqual(s.requests[0],s.requests[1]);const busy=events.filter(p=>p.state==='COURIER BUSY');assert.equal(busy.length,1);assert.equal(busy[0].offset,128);assert(preparationPresentation(busy[0]).text.includes('einu sinni'));s.source.close();
});
test('persistent BUSY stops after one resubmission and preserves first error',async()=>{
 const s=await setup(['COURIER_BUSY','COURIER_BUSY','ok']);await assert.rejects(s.source.readRange(s.m,0,127),e=>e.diagnostic.serverErrorCode==='COURIER_BUSY'&&e.diagnostic.requestedOffset===0);assert.equal(s.requests.length,2);s.source.close();
});
test('one preparation permits at most three BUSY resubmissions across ranges',async()=>{
 const s=await setup(Array.from({length:4},()=>['COURIER_BUSY','ok']).flat());for(let i=0;i<3;i++)await s.source.readRange(s.m,0,127);
 await assert.rejects(s.source.readRange(s.m,0,127));assert.equal(s.requests.length,7);s.source.close();
});
for(const code of ['EVIDENCE_CHANGED','IO_FAILED','MEMORY_UNAVAILABLE'])test(code+' is never resubmitted',async()=>{const s=await setup([code,'ok']);await assert.rejects(s.source.readRange(s.m,0,127));assert.equal(s.requests.length,1);s.source.close();});
test('caller abort during BUSY wait dispatches no second request',async()=>{const s=await setup(['COURIER_BUSY','ok']),c=new AbortController();await assert.rejects(s.source.readRange(s.m,0,127,{signal:c.signal,onProgress:p=>{if(p.state==='COURIER BUSY')c.abort('USER_CANCELLED');}}));assert.equal(s.requests.length,1);s.source.close();});
test('pause/replaced source invalidates delayed resubmission',async()=>{const s=await setup(['COURIER_BUSY','ok']);await assert.rejects(s.source.readRange(s.m,0,127,{onProgress:p=>{if(p.state==='COURIER BUSY')s.source.pause();}}));assert.equal(s.requests.length,1);s.source.close();});
