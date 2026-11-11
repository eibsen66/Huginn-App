import {canonicalBytes,verifySettingsPackage} from '../settings-package.mjs';
const need=(ok,code)=>{if(!ok)throw Error(code);};
export const UNIT_CHOICES={altitude:['ft','m'],baro:['hPa','inHg'],fuel:['L','US gal'],pressure:['psi','bar'],speed:['km/h','kt'],temperature:['C','F']};
export const PRESETS=['91 OCT E5','91 OCT E10','95 OCT E5','95 OCT E10','95 OCT E15','95 OCT E20','98 OCT E5','98 OCT E10','AVGAS UL91','AVGAS 100LL'].map(label=>{
 const n=label.match(/^(\d+) OCT E(\d+)$/);return {label,ron:n?+n[1]:label==='AVGAS UL91'?91:100,ethanol_percent:n?+n[2]:0,is_avgas:!n};
});
const copy=v=>structuredClone(v);
const eq=(a,b)=>new TextDecoder().decode(canonicalBytes(a))===new TextDecoder().decode(canonicalBytes(b));
export const verifyOutgoingSettings=bytes=>verifySettingsPackage(bytes,{sourceProduct:'HuginnAPP'});
export function fromConfig(c){
 const units={altitude:c.altitude_unit,baro:{hpa:'hPa',inhg:'inHg'}[c.barometric_pressure_unit],fuel:{l:'L',us_gal:'US gal'}[c.fuel_unit],pressure:c.pressure_unit,speed:{kmh:'km/h',kt:'kt'}[c.speed_unit],temperature:{c:'C',f:'F'}[c.temperature_unit]};
 return {display:{auto_brightness:c.auto_brightness,brightness_percent:c.brightness_percent,units},fuel:{default_preset_index:c.default_fuel_slot,presets:c.fuel_presets?.map(p=>({ethanol_percent:p.ethanol_percent,is_avgas:p.is_avgas,label:p.display_name,ron:p.ron}))}};
}
export async function makePackage(settings){
 const covered={schema:'huginn.settings-transfer',schema_version:1,provenance:{product:'HuginnAPP',created_at_utc:new Date().toISOString().slice(0,19)+'Z'},settings:copy(settings)};
 const bytes=canonicalBytes(covered),sha256=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
 const raw=canonicalBytes({...covered,integrity:{algorithm:'SHA-256',canonical_bytes:bytes.length,sha256}});
 await verifySettingsPackage(raw,{sourceProduct:'HuginnAPP'});return raw;
}
function leaves(s){const out={};for(const [k,v] of Object.entries(s.display.units))out['display.units.'+k]=v;out['display.brightness_percent']=s.display.brightness_percent;out['display.auto_brightness']=s.display.auto_brightness;out['fuel.default_preset_index']=s.fuel.default_preset_index;s.fuel.presets.forEach((p,i)=>{for(const [k,v] of Object.entries(p))out[`fuel.presets[${i}].${k}`]=v;});return out;}
function checkReply(r,p,settings,before){
 need(r?.ok===true&&r.schema===p.schema&&r.schema_version===1&&r.sha256===p.integrity.sha256&&r.canonical_bytes===p.integrity.canonical_bytes,'SETTINGS_RESPONSE');
 const allowed=leaves(settings),seen=new Set();need(Array.isArray(r.changes),'SETTINGS_CHANGES');
 for(const c of r.changes){need(c&&Object.hasOwn(allowed,c.field)&&!seen.has(c.field)&&Object.hasOwn(c,'current')&&eq(c.proposed,allowed[c.field]),'SETTINGS_CHANGES');seen.add(c.field);}
 if(before){const old=leaves(before);for(const k of Object.keys(allowed))need(eq(old[k],allowed[k])||seen.has(k),'SETTINGS_PREVIEW_INCOMPLETE');}
}
// The session never persists settings or proposals. A new connection gets a new instance.
export function createSettingsSession(source){
 let operationStage='retrieve';
 let closed=false,epoch=0,confirmed=null,draft=null,preview=null,state='empty';
 const live=()=>need(!closed&&source.hasAuthorization(),'SETTINGS_DISCONNECTED');
 const current=e=>{live();need(e===epoch,'SETTINGS_STALE');};
 return {
  get state(){return state;},get operationStage(){return operationStage;},get confirmed(){return copy(confirmed);},get draft(){return copy(draft);},get changes(){return copy(preview?.reply.changes||[]);},
  close(){closed=true;epoch++;confirmed=draft=preview=null;state='disconnected';},
  invalidate(){epoch++;preview=null;state=draft?'pending':'empty';},
  async load(){operationStage='retrieve';live();const e=++epoch;preview=null;state='loading';try{const c=await source.settings();current(e);const s=fromConfig(c);await makePackage(s);current(e);confirmed=copy(s);draft=copy(s);state='loaded';return copy(c);}catch(err){if(e===epoch){confirmed=draft=null;state='failed';}throw err;}},
  async edit(s){live();need(confirmed,'SETTINGS_NOT_LOADED');const e=++epoch;preview=null;state='pending';await makePackage(s);current(e);draft=copy(s);},
  async preview(){operationStage='preview';live();need(draft,'SETTINGS_NOT_LOADED');const e=++epoch;preview=null;state='pending';const s=copy(draft),bytes=await makePackage(s);current(e);const reply=await source.settingsTransfer('preview',bytes);current(e);checkReply(reply,JSON.parse(new TextDecoder().decode(bytes)),s,confirmed);preview={bytes,reply,settings:s};state='previewed';return copy(reply.changes);},
  async apply(){operationStage='save';live();need(preview&&state==='previewed','SETTINGS_PREVIEW_REQUIRED');const p=preview,e=++epoch;preview=null;state='unconfirmed';
   const reply=await source.settingsTransfer('apply',p.bytes);current(e);checkReply(reply,JSON.parse(new TextDecoder().decode(p.bytes)),p.settings);need(reply.applied===true,'SETTINGS_NOT_SAVED');
   need(eq(reply.changes,p.reply.changes),'SETTINGS_APPLY_CHANGED');
   operationStage='readback';const config=await source.settings();current(e);need(eq(fromConfig(config),p.settings),'SETTINGS_READBACK_FAILED');confirmed=copy(p.settings);draft=copy(p.settings);state='saved';
  }
 };
}
