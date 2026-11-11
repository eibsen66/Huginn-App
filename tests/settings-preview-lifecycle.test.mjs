import test from 'node:test';import assert from 'node:assert/strict';
import {createV2SettingsSession} from '../pwa/settings-v2.mjs';import {settingsHost} from './settings-protocol-host.mjs';
const device='AA:BB:CC:DD:EE:FF';
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
async function fixture(fn){const h=settingsHost();const source={sourceDeviceId:device,hasAuthorization:()=>true,settingsV2:()=>h.request({method:'get'}),settingsTransferV2:(method,b)=>h.request({method,raw:new TextDecoder().decode(b)})};try{await fn(h,source);}finally{h.close();}}
test('unchanged load, valid edit, preview, further edit, re-preview and authoritative save',()=>fixture(async(h,source)=>{
 const s=createV2SettingsSession(source);await s.load();assert.equal(s.hasChanges,false);let d=s.draft;d['display.brightness_percent']=d['display.brightness_percent']===100?99:100;await s.edit(d);assert.equal(s.hasChanges,true);await assert.rejects(s.apply(),/PREVIEW_REQUIRED/);await s.preview();assert.equal(s.state,'previewed');
 d=s.draft;d['aircraft.registration']='WORKFLOW';await s.edit(d);assert.equal(s.state,'pending');await assert.rejects(s.apply(),/PREVIEW_REQUIRED/);await s.preview();await s.apply();assert.equal(s.state,'saved');assert.equal(s.hasChanges,false);assert.equal(s.confirmed['aircraft.registration'],'WORKFLOW');
}));
test('late preview cannot overwrite newer draft or enable old apply',()=>fixture(async(h,source)=>{
 const gate=deferred(),started=deferred(),original=source.settingsTransferV2;source.settingsTransferV2=async(method,b)=>{const result=await original(method,b);if(method==='preview'){started.resolve();await gate.promise;}return result;};
 const s=createV2SettingsSession(source);await s.load();let d=s.draft;d['aircraft.registration']='FIRST';await s.edit(d);const p=s.preview(),rejected=assert.rejects(p,/SETTINGS_STALE/);await started.promise;d=s.draft;d['aircraft.registration']='LATEST';await s.edit(d);gate.resolve();await rejected;assert.equal(s.draft['aircraft.registration'],'LATEST');assert.equal(s.state,'pending');await assert.rejects(s.apply(),/PREVIEW_REQUIRED/);
}));
test('obsolete load cannot replace newer authoritative data',()=>fixture(async(h,source)=>{
 const config=await h.request({method:'get'}),old=deferred(),fresh=deferred();let calls=0;source.settingsV2=()=>calls++?fresh.promise:old.promise;const s=createV2SettingsSession(source),p=s.load(),rejected=assert.rejects(p,/STALE/),q=s.load();const newer=structuredClone(config);newer.fields.find(f=>f.id==='aircraft.registration').value='NEW';fresh.resolve(newer);await q;old.resolve(config);await rejected;assert.equal(s.draft['aircraft.registration'],'NEW');assert.equal(s.hasChanges,false);
}));
test('save stays unconfirmed if authoritative readback differs; never replay apply',()=>fixture(async(h,source)=>{
 let bad=false,saves=0;const get=source.settingsV2,send=source.settingsTransferV2;source.settingsV2=async()=>{const c=await get();if(bad)c.fields.find(f=>f.id==='aircraft.registration').value='DIFFERENT';return c;};source.settingsTransferV2=async(m,b)=>{if(m==='apply')saves++;return send(m,b);};
 const s=createV2SettingsSession(source);await s.load();const before=s.confirmed,d=s.draft;d['aircraft.registration']='DRAFT';await s.edit(d);await s.preview();bad=true;await assert.rejects(s.apply(),/READBACK_FAILED/);assert.notEqual(s.state,'saved');assert.deepEqual(s.confirmed,before);await assert.rejects(s.apply(),/PREVIEW_REQUIRED/);assert.equal(saves,1);
}));
test('invalid draft and a closed old connection cannot retain a usable preview',()=>fixture(async(h,source)=>{
 const s=createV2SettingsSession(source);await s.load();const d=s.draft;d['display.brightness_percent']=101;await assert.rejects(s.edit(d),/RANGE/);assert.equal(s.state,'invalid');await assert.rejects(s.preview());s.close();await assert.rejects(s.apply(),/DISCONNECTED/);const fresh=createV2SettingsSession(source);assert.equal(fresh.state,'empty');await assert.rejects(fresh.apply(),/PREVIEW_REQUIRED/);
}));
