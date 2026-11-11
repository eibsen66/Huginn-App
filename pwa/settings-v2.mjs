import {canonicalBytes} from '../settings-package.mjs';
const need=(ok,code)=>{if(!ok)throw Error(code);};
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const allowed=id=>/^(display\.(brightness_percent|auto_brightness)|units\.(altitude|baro|fuel|pressure|speed|temperature)|aircraft\.registration|engine\.(name|cylinders|turbo|cht_max_diff_c)|fuel\.(total_l|usable_l|cruise_burn|default_preset_index|preset\.[0-2])|aux\.(count|[0-3]\.(source|label))|parameters\.(?:[0-9]|1[0-4])\.(enabled|min|max|reference|topology|boundary\.[0-5]))$/.test(id);
const copy=x=>structuredClone(x);
export function validateConfigV2(c,device){
 need(c?.schema==='huginn.settings.config'&&c.schema_version===2&&c.source_device_id===device&&Number.isInteger(c.config_revision)&&c.config_revision>=0&&c.config_revision<=0xffffffff&&Array.isArray(c.fields)&&c.fields.length<=512,'SETTINGS_CONFIG_IDENTITY');
 const ids=new Set();for(const f of c.fields){need(f&&allowed(f.id)&&!ids.has(f.id)&&['Display','Units','Aircraft','Engine','AUX','Fuel'].includes(f.section)&&typeof f.label==='string'&&['boolean','integer','string'].includes(f.type)&&Number.isInteger(f.scale)&&f.scale>0,'SETTINGS_FIELD_DESCRIPTOR');ids.add(f.id);
  need(f.value!==undefined&&(f.type==='string'?typeof f.value==='string':f.type==='boolean'?typeof f.value==='boolean':Number.isSafeInteger(f.value)||f.nullable===true&&/^parameters\.(?:[0-9]|1[0-4])\.reference$/.test(f.id)&&f.value===null),'SETTINGS_FIELD_VALUE');
  if(f.options)need(Array.isArray(f.options)&&f.options.length<=32&&f.options.every(o=>o&&typeof o.label==='string'&&['string','number'].includes(typeof o.value)),'SETTINGS_OPTIONS');
 }
 need(['Display','Units','Aircraft','Engine','AUX','Fuel'].every(section=>c.fields.some(f=>f.section===section)),'SETTINGS_INCOMPLETE_SCHEMA');return copy(c);
}
function validateValue(f,v){
 need(allowed(f.id),'SETTINGS_PROTECTED_FIELD');
 need(f.type==='integer'?Number.isSafeInteger(v):typeof v===f.type,'SETTINGS_VALUE_TYPE');
 if(f.type==='integer')need(v>=f.min&&v<=f.max,'SETTINGS_RANGE');
 if(f.type==='string')need((!f.max_bytes||new TextEncoder().encode(v).length<=f.max_bytes)&&!/[\x00-\x1f\x7f]/.test(v)&&(!/^aux\.[0-3]\.label$/.test(f.id)||/^[\x20-\x7e]*$/.test(v)),'SETTINGS_TEXT');
 if(f.options)need(f.options.some(o=>equal(o.value,v)),'SETTINGS_OPTION');
 if(f.id==='fuel.cruise_burn')need(v%5===0,'SETTINGS_STEP');
}
export function settingsValueValid(field,value){try{validateValue(field,value);return true;}catch{return false;}}
export async function verifyV2Request(bytes){
 need(bytes instanceof Uint8Array&&bytes.length<=32768,'SETTINGS_REQUEST_SIZE');const r=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
 need(Object.keys(r).sort().join(',')==='base_revision,changes,product,schema,schema_version,source_device_id'&&r.schema==='huginn.settings-transfer'&&r.schema_version===2&&r.product==='HuginnAPP'&&/^(?:[0-9A-F]{2}:){5}[0-9A-F]{2}$/.test(r.source_device_id)&&Number.isInteger(r.base_revision)&&r.base_revision>=0&&r.base_revision<=0xffffffff&&Array.isArray(r.changes)&&r.changes.length<=256,'SETTINGS_PACKAGE');
 const ids=new Set();for(const c of r.changes){need(c&&Object.keys(c).sort().join(',')==='field,value'&&allowed(c.field)&&!ids.has(c.field)&&['string','number','boolean'].includes(typeof c.value)&&(typeof c.value!=='number'||Number.isSafeInteger(c.value)),'SETTINGS_PROTECTED_OR_DUPLICATE');ids.add(c.field);}need(equal([...canonicalBytes(r)],[...bytes]),'SETTINGS_NONCANONICAL');return r;
}
export const digestV2=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
// Seed only from an already validated authoritative readback. This detached
// session never shares a UI draft or preview with another save operation.
export async function settingsSessionFromReadback(source,config){
 let seed=validateConfigV2(config,source.sourceDeviceId);
 const proxy={sourceDeviceId:source.sourceDeviceId,hasAuthorization:()=>source.hasAuthorization(),
  settingsV2:()=>{if(seed){const value=seed;seed=null;return Promise.resolve(value);}return source.settingsV2();},
  settingsTransferV2:(...args)=>source.settingsTransferV2(...args)};
 const session=createV2SettingsSession(proxy);await session.load();return session;
}
export function matchSettingsSelection(config,expected,ids){
 const values=Object.fromEntries(config.fields.map(f=>[f.id,f.value]));
 return ids.filter(id=>Object.hasOwn(values,id)&&equal(values[id],expected[id]));
}
export async function saveSettingsSelection(source,baseline,draft,ids,{current=()=>true,onStage=()=>{},onDispatch=()=>{}}={}){
 const live=()=>need(current()&&source.hasAuthorization(),'SETTINGS_STALE');
 live();need(Array.isArray(ids)&&ids.length&&new Set(ids).size===ids.length,'SETTINGS_SELECTION');
 const selected=new Set(ids),before=Object.fromEntries(baseline.fields.map(f=>[f.id,f.value]));
 const chosen=copy(before);for(const id of ids){need(allowed(id)&&Object.hasOwn(draft,id),'SETTINGS_PROTECTED_FIELD');chosen[id]=copy(draft[id]);}
 const transaction=await settingsSessionFromReadback(source,baseline);
 try{
  onStage('checking');
  const topology=ids.filter(id=>id.endsWith('.topology')&&!equal(chosen[id],before[id]));
  if(topology.length){const initial=copy(before);for(const id of topology){initial[id]=chosen[id];initial[id.replace('topology','enabled')]=chosen[id.replace('topology','enabled')];}await transaction.edit(initial);const shaped=transaction.draft;for(const id of ids){need(Object.hasOwn(shaped,id),'SETTINGS_SELECTION_DEPENDENCY');shaped[id]=chosen[id];}await transaction.edit(shaped);}
  else await transaction.edit(chosen);
  live();await transaction.preview();live();
  // A per-field action must never smuggle other local drafts or implicit
  // server changes into apply. Dependent changes need an explicit bulk draft.
  for(const change of transaction.changes)need(selected.has(change.field)&&equal(change.proposed,draft[change.field]),'SETTINGS_SELECTION_DEPENDENCY');
  const expected=transaction.draft;
  for(const id of ids)need(equal(expected[id],draft[id]),'SETTINGS_PREVIEW_MISMATCH');
  live();onDispatch({ids:[...ids],expected:copy(expected),baseline:copy(baseline)});onStage('saving');
  try{await transaction.apply();live();return {config:transaction.config,matched:[...ids],reconciled:false};}
  catch(error){
   onStage('reconciling');const read=createV2SettingsSession(source);
   try{live();const config=await read.load();live();return {config,matched:matchSettingsSelection(config,expected,ids),reconciled:true,error};}
   catch(readError){readError.uncertainSave=true;readError.saveError=error;throw readError;}
   finally{read.close();}
  }
 }finally{transaction.close();}
}
export function createV2SettingsSession(source){
 let operationStage='retrieve';
 let closed=false,epoch=0,config=null,draftFields=null,values=null,preview=null,state='empty';const touched=new Set();const live=()=>need(!closed&&source.hasAuthorization(),'SETTINGS_DISCONNECTED');const current=e=>{live();need(e===epoch,'SETTINGS_STALE');};
 const documentValues=c=>Object.fromEntries(c.fields.map(f=>[f.id,f.value]));
 return {
  protocol:2,get state(){return state;},get operationStage(){return operationStage;},get config(){return copy(config);},get fields(){return copy(draftFields||config?.fields||[]);},get confirmed(){return config?documentValues(config):null;},get draft(){return copy(values);},get hasChanges(){const baseline=config&&documentValues(config);return !!(baseline&&values&&Object.entries(values).some(([id,v])=>!equal(v,baseline[id])));},get changes(){return copy(preview?.reply.changes||[]);},
  close(){closed=true;epoch++;config=draftFields=values=preview=null;touched.clear();state='disconnected';},invalidate(){epoch++;preview=null;if(!['invalid','incomplete'].includes(state))state=values?'pending':'empty';},
  async load(){operationStage='retrieve';live();const e=++epoch;preview=draftFields=null;touched.clear();state='loading';try{const c=validateConfigV2(await source.settingsV2(),source.sourceDeviceId);current(e);config=c;values=documentValues(c);state='loaded';return copy(c);}catch(err){if(e===epoch){config=values=null;state='failed';}throw err;}},
  async edit(v){live();need(config,'SETTINGS_NOT_LOADED');epoch++;preview=null;state='invalid';let schema=copy(draftFields||config.fields);const fields=new Map(schema.map(f=>[f.id,f]));for(const [id,value] of Object.entries(v)){const f=fields.get(id);need(f,'SETTINGS_UNKNOWN_FIELD');if(f.draft_new&&value===null)continue;if(!equal(value,values[id])){validateValue(f,value);touched.add(id);}}
   for(const [id,value] of Object.entries(v)){if(!id.endsWith('.topology')||equal(value,values[id]))continue;const prefix=id.slice(0,-'topology'.length);need(v[prefix+'enabled']===false,'SETTINGS_DISABLE_PARAMETER_FIRST');const template=fields.get(prefix+'min');need(template&&typeof value==='string'&&/^[RYG]*$/.test(value),'SETTINGS_TOPOLOGY');schema=schema.filter(f=>!f.id.startsWith(prefix+'boundary.'));for(const key of Object.keys(v))if(key.startsWith(prefix+'boundary.'))delete v[key];for(let i=0;i<Math.max(0,value.length-1);i++){const field=prefix+'boundary.'+i;schema.push({...copy(template),id:field,label:fields.get(id).label.split(' - ')[0]+' - boundary '+(i+1),value:null,draft_new:true});v[field]=null;}}
   draftFields=schema;values=copy(v);state=schema.some(f=>f.draft_new&&values[f.id]===null)?'incomplete':'pending';},
  async preview(){operationStage='preview';live();need(config&&values&&!['invalid','incomplete'].includes(state),'SETTINGS_NOT_LOADED');const e=++epoch;preview=null;state='pending';const confirmed=documentValues(config),changes=[];for(const [field,value] of Object.entries(values)){const boundary=field.match(/^(parameters\.\d+\.)boundary\./);if(touched.has(field)||boundary&&touched.has(boundary[1]+'topology')||!equal(value,confirmed[field])){validateValue((draftFields||config.fields).find(f=>f.id===field),value);changes.push({field,value});}}
   const bytes=canonicalBytes({schema:'huginn.settings-transfer',schema_version:2,product:'HuginnAPP',source_device_id:source.sourceDeviceId,base_revision:config.config_revision,changes});await verifyV2Request(bytes);const sha=await digestV2(bytes);current(e);const reply=await source.settingsTransferV2('preview',bytes);current(e);
   need(reply?.ok===true&&reply.applied===false&&reply.sha256===sha&&reply.source_device_id===source.sourceDeviceId&&reply.base_revision===config.config_revision&&Array.isArray(reply.changes),'SETTINGS_PREVIEW_IDENTITY');
   const proposed=validateConfigV2(reply.proposed,source.sourceDeviceId);need(proposed.config_revision===config.config_revision,'SETTINGS_REVISION');const pvalues=documentValues(proposed),seen=new Set();
   for(const c of reply.changes){need(c&&allowed(c.field)&&!seen.has(c.field)&&equal(c.proposed,pvalues[c.field])&&equal(c.current,confirmed[c.field]??null),'SETTINGS_PREVIEW_CHANGES');seen.add(c.field);}
   for(const c of changes)need(equal(c.value,pvalues[c.field]),'SETTINGS_PREVIEW_MISMATCH');for(const [id,v] of Object.entries(pvalues))need(equal(v,confirmed[id])||seen.has(id),'SETTINGS_PREVIEW_INCOMPLETE');
   preview={bytes,sha,reply,proposed};draftFields=copy(proposed.fields);values=documentValues(proposed);state='previewed';return copy(reply.changes);
  },
  async apply(){operationStage='save';live();need(preview&&state==='previewed','SETTINGS_PREVIEW_REQUIRED');const p=preview,e=++epoch;preview=null;state='unconfirmed';const reply=await source.settingsTransferV2('apply',p.bytes);current(e);
   need(reply?.ok===true&&reply.applied===true&&reply.sha256===p.sha&&reply.source_device_id===source.sourceDeviceId&&reply.base_revision===config.config_revision&&equal(reply.changes,p.reply.changes),'SETTINGS_SAVE_UNCONFIRMED');
   operationStage='readback';const saved=validateConfigV2(reply.settings,source.sourceDeviceId),read=validateConfigV2(await source.settingsV2(),source.sourceDeviceId);current(e);
   need(saved.config_revision===read.config_revision&&saved.config_revision===(p.reply.changes.length?config.config_revision+1:config.config_revision)&&equal(documentValues(saved),documentValues(read))&&equal(documentValues(saved),documentValues(p.proposed)),'SETTINGS_READBACK_FAILED');config=read;draftFields=null;values=documentValues(read);touched.clear();state='saved';
  }
 };
}
// One validation at a time, even when edits or connections replace its result.
// Failed validation is not retried until a new edit/read explicitly schedules it.
export function createDraftValidation({getSession,isAvailable,onState,delay=700,validFor=90000}){
 let generation=0,timer=null,expiry=null,deadline=0,inFlight=false,queued=false,due=0,state='idle';
 const emit=(next,error)=>{state=next;onState?.(next,error);};
 const eligible=()=>isAvailable()&&getSession()?.hasChanges&&!['invalid','incomplete','unconfirmed','failed','empty','loading'].includes(getSession()?.state);
 function kick(){clearTimeout(timer);timer=null;if(!queued||!eligible()){queued=false;return;}if(inFlight)return;const wait=due-Date.now();if(wait>0){timer=setTimeout(kick,wait);return;}
  queued=false;inFlight=true;const s=getSession(),g=generation,started=Date.now();emit('checking');
  Promise.resolve().then(()=>{if(g!==generation||s!==getSession()||!eligible())throw Error('SETTINGS_STALE');return s.preview();}).then(()=>{if(g===generation&&s===getSession()&&isAvailable()){
   // Firmware expires previews after 120 seconds. Count conservatively from
   // dispatch, including response time; never refresh/replay a write.
   deadline=started+validFor;
   if(s.state==='previewed'&&s.changes.length){
    if(Date.now()>=deadline){s.invalidate();emit('expired');return;}
    emit('ready');expiry=setTimeout(()=>{if(g===generation&&s===getSession()){s.invalidate();emit('expired');}},deadline-Date.now());
   }else emit('idle');
  }}).catch(e=>{if(g===generation&&s===getSession()&&isAvailable())emit('error',e);}).finally(()=>{inFlight=false;if(queued)kick();});
 }
 return {get state(){return state==='ready'&&Date.now()>=deadline?'expired':state;},get inFlight(){return inFlight;},cancel(){generation++;clearTimeout(timer);clearTimeout(expiry);timer=expiry=null;queued=false;emit('idle');},changed(){generation++;clearTimeout(timer);clearTimeout(expiry);expiry=null;queued=eligible();due=Date.now()+delay;emit(queued?'waiting':'idle');if(queued)kick();}};
}
