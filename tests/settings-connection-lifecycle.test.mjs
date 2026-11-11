import test from 'node:test';import assert from 'node:assert/strict';
import {createBrowserSource} from '../dist/pwa/source.mjs';
import {createV2SettingsSession} from '../pwa/settings-v2.mjs';
import {settingsHost} from './settings-protocol-host.mjs';
const device='AA:BB:CC:DD:EE:FF',other='11:22:33:44:55:66';
const pair=id=>JSON.stringify({schema:'huginn.flight-courier.pair',schema_version:1,source_device_id:id,tls_spki_sha256:'6'.repeat(64),token:'A'.repeat(43)});
const make=(fetch,id=device,factory=createBrowserSource)=>factory({origin:'https://192.168.4.1',selectedOrigin:'https://192.168.4.1',profile:'DEV_BROWSER_OS_TLS_V1',pairing:pair(id),fetch});
test('real paired source reproduces modal 409, then repeated GET and list refresh without replacing connection',async()=>{
 const host=settingsHost();let modal=true,posts=0;const fetch=async(url,options)=>{
  assert.equal(options.headers.Authorization,'Bearer '+'A'.repeat(43));const path=new URL(url).pathname;
  if(path==='/api/v1/flights')return Response.json({schema:'huginn.flight-courier.list',schema_version:1,source_device_id:device,capacity:64,count:0,entries:[],next_cursor:null,manifest_generation:1});
  if(options.method==='POST')posts++;
  const value=await host.request({method:'get',fault:modal?'busy':undefined});return Response.json(value,{status:value.ok===false?409:200});
 };
 try{
  const {createBrowserSource:old}=await import('../build/pages-deployment-review/candidate-99272816b3082d1a/source.mjs');
  const before=make(fetch,device,old);await before.list();await assert.rejects(before.settingsV2(),/SOURCE_CHANGED/);before.close();
  const source=make(fetch);await source.list();const s=createV2SettingsSession(source);
  await assert.rejects(s.load(),e=>e.message==='SETTINGS_BUSY_OR_UNAVAILABLE'&&e.diagnostic.httpStatus===409);
  assert.equal(s.draft,null);assert.equal(source.hasAuthorization(),true);assert.equal(posts,0);
  modal=false;await s.load();assert.equal(s.state,'loaded');await Promise.all([s.load(),source.list()]);await s.load();assert(s.confirmed);assert.equal(posts,0);
  source.close();await assert.rejects(s.load(),/DISCONNECTED/);
  const next=make(fetch);const fresh=createV2SettingsSession(next);assert.equal(fresh.confirmed,null);await next.list();await fresh.load();next.close();
 }finally{host.close();}
});
test('new real source objects, changed identity and delayed obsolete response remain protected',async()=>{
 const host=settingsHost();try{
  const config=await host.request({method:'get'});let release,entered;
  const started=new Promise(r=>entered=r),gate=new Promise(r=>release=r);
  const obsolete=make(async()=>{entered();await gate;return Response.json(config);});const old=createV2SettingsSession(obsolete);const pending=old.load();await started;obsolete.close();old.close();
  const replacement=make(async()=>Response.json(config));const current=createV2SettingsSession(replacement);await current.load();release();await assert.rejects(pending,/AUTH_REQUIRED|DISCONNECTED|CANCELLED/);assert(current.confirmed);assert.equal(old.confirmed,null);
  const foreign=make(async()=>Response.json(config),other);await assert.rejects(createV2SettingsSession(foreign).load(),/IDENTITY/);
  const swapped=make(async()=>Response.json({...config,source_device_id:other}));await assert.rejects(createV2SettingsSession(swapped).load(),/IDENTITY/);
  replacement.close();foreign.close();swapped.close();
 }finally{host.close();}
});
test('settings error bodies are bounded/allowlisted; genuine flight 409 remains SOURCE_CHANGED',async()=>{
 const s=make(async()=>Response.json({ok:false,error:'UNTRUSTED_SECRET_TEXT'},{status:409}));await assert.rejects(s.settingsV2(),/HTTP_409/);await assert.rejects(s.list(),/SOURCE_CHANGED/);s.close();
});
