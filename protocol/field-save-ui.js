import {createV2SettingsSession,settingsSessionFromReadback,saveSettingsSelection,matchSettingsSelection,settingsValueValid} from './settings-v2.mjs';
import {transferDiagnostic} from './download-diagnostics.mjs';
export function bindSettings({getSource,isConnected=()=>true,run,onAuthorizationLost,onConnectionFailure}){
 const el=id=>document.getElementById(id),is=document.documentElement.lang.startsWith('is'),t=(a,b)=>is?a:b,equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 let appBusy=false;let session=null,owner=null,uiEpoch=0,saving=false,stage='idle',savedDraft=null,pending=null;
 const rawEdits=new Map(),invalidFields=new Set(),editTickets=new Map(),savedFields=new Set(),rowErrors=new Map();
 const message=s=>el('settings-message').textContent=s;
 const displayValue=(f,v)=>f?.options?(f.options.find(o=>equal(o.value,v))?.label??String(v)):typeof v==='boolean'?t(v?'Já':'Nei',v?'Yes':'No'):f?.type==='integer'?String(v/f.scale)+(f.unit||''):String(v??'—');
 const text=(id,a,b)=>el(id).textContent=t(a,b);
 text('settings-tab','Stillingar','Settings');text('settings-heading','Stillingar HuginnEIS','HuginnEIS settings');text('settings-load','Sækja núverandi stillingar','Retrieve current settings');text('settings-apply','Vista allar breytingar','Save all changes');text('settings-diagnose','Athuga tengingu (aðeins lestur)','Check connection (read only)');
 const hint=document.createElement('p');hint.id='settings-workflow-hint';hint.setAttribute('role','status');el('settings-apply').before(hint);
 const reread=document.createElement('button');reread.id='settings-reconcile';reread.type='button';reread.textContent=t('Lesa stöðu aftur','Read status again');reread.hidden=true;el('settings-apply').after(reread);
 const help=document.createElement('p');help.className='small';help.textContent=t('Vista breytingu sendir aðeins þann lið. Vista allar breytingar sendir öll gild drög. Vistað birtist eftir staðfestan endurlestur.','Save change sends only that field. Save all changes sends all valid drafts. Saved appears after verified readback.');reread.after(help);
 /* DIAGNOSTIC */
 function authorizationFailure(active){if(active===getSource()&&!active.hasAuthorization()){suspend();onAuthorizationLost?.();}}
 function connected(){return isConnected()&&owner===getSource()&&owner?.hasAuthorization();}
 function uncertain(){return pending&&owner&&pending.device===owner.sourceDeviceId&&pending.origin===owner.boundOrigin;}
 function changes(){return session?.draft?session.fields.filter(f=>invalidFields.has(f.id)||!equal(session.draft[f.id],session.confirmed?.[f.id])).map(f=>f.id):[];}
 function controls(externalBusy){
  if(typeof externalBusy==='boolean')appBusy=externalBusy;
  if(owner&&owner!==getSource()){suspend();return;}
  const live=connected(),busy=saving||appBusy;
  el('settings-load').disabled=busy||!getSource()?.hasAuthorization();el('settings-diagnose').disabled=busy||!getSource()?.hasAuthorization();
  el('settings-apply').disabled=busy||!live||uncertain()||!changes().length||invalidFields.size>0||session?.state==='incomplete';
  reread.hidden=!uncertain();reread.disabled=busy||!live;
  // Keep typing possible during the captured operation. New input is a newer
  // local draft, never a mutation of the immutable request being sent.
  for(const input of el('settings-fields').querySelectorAll('input,select'))input.disabled=!live||(!saving&&appBusy)||input.dataset.settingsInactive==='true';
  for(const button of el('settings-fields').querySelectorAll('[data-save-field]')){
   const id=button.dataset.saveField;button.disabled=busy||!live||uncertain()||invalidFields.has(id)||!session?.draft||equal(session.draft[id],session.confirmed?.[id]);
  }
  hint.dataset.state=!live?'disconnected':saving?stage:uncertain()?'uncertain':invalidFields.size?'invalid':stage;
  hint.textContent=!live?t('Tengdu HuginnEIS og sækðu núverandi stillingar.','Connect HuginnEIS and retrieve current settings.'):saving?stage==='checking'?t('Staðfesti breytingar…','Validating changes…'):stage==='reconciling'?t('Staðfesti vistun…','Confirming save…'):t('Vista breytingar…','Saving changes…'):uncertain()?t('Óvíst hvort vistun tókst. Lestu stöðuna aftur áður en þú vistar.','Save outcome uncertain. Read status again before saving.'):invalidFields.size?t('Ógildir reitir eru merktir. Ekki er hægt að vista öll drög.','Invalid fields are marked. All drafts cannot be saved.'):stage==='saved'?(changes().length?t('Send gildi staðfest. Nýrri eða önnur drög eru enn óvistuð.','Sent values verified. Newer or other drafts remain unsaved.'):t('Vistað — endurlestur staðfestur.','Saved — readback verified.')):stage==='error'?t('Vistun tókst ekki að fullu. Sjá stöðu við reitina.','Save did not fully succeed. See each field status.'):changes().length?t('Óvistað. Veldu Vista við reit eða Vista allar breytingar.','Unsaved. Choose Save beside a field or Save all changes.'):t('Engar óvistaðar breytingar.','No unsaved changes.');
 }
 function snapshot(){return session?.draft&&owner?{device:owner.sourceDeviceId,origin:owner.boundOrigin,base:session.confirmed,draft:session.draft,raw:[...rawEdits],invalid:[...invalidFields],tickets:[...editTickets]}:null;}
 function reset({keepDraft=false}={}){if(!keepDraft)savedDraft=null;uiEpoch++;session?.close();session=null;owner=null;rawEdits.clear();invalidFields.clear();editTickets.clear();savedFields.clear();rowErrors.clear();el('settings-fields').replaceChildren();el('settings-changes').textContent='';el('settings-readonly').textContent='';stage='idle';controls();}
 function suspend(){const draft=snapshot();if(draft)savedDraft=draft;reset({keepDraft:true});message(t('Tenging rofin. Drög haldast í minni; sæktu stillingar aftur.','Disconnected. Drafts remain in memory; retrieve settings again.'));}
 function updateSummary(){if(!session?.draft){el('settings-changes').textContent='';return;}const d=session.draft,b=session.confirmed;el('settings-changes').textContent=session.fields.filter(f=>invalidFields.has(f.id)||!equal(d[f.id],b[f.id])).map(f=>{const value=v=>f.type==='integer'?String(v/f.scale)+(f.unit||''):String(v);return (f.id==='display.brightness_percent'?t('Birta','Brightness'):f.label)+': '+value(b[f.id])+' → '+(invalidFields.has(f.id)?String(rawEdits.get(f.id)??''):value(d[f.id]))+' — '+t('Óvistað','Unsaved');}).join('\n');}
 function updateEditNotes(){
  updateSummary();for(const input of el('settings-fields').querySelectorAll('[data-settings-field]')){
   const id=input.dataset.settingsField,label=input.closest('label');let note=label.querySelector('.setting-edit-note'),button=label.querySelector('[data-save-field]');
   if(!note){note=document.createElement('span');note.className='small setting-edit-note';note.setAttribute('role','status');label.append(note);}
   if(!button){button=document.createElement('button');button.type='button';button.dataset.saveField=id;button.textContent=t('Vista breytingu','Save change');button.style.display='block';button.onclick=event=>{event.preventDefault();startSave([id]);};label.append(button);}
   const invalid=invalidFields.has(id),changed=invalid||!equal(session?.draft?.[id],session?.confirmed?.[id]),inOperation=saving&&activeIds.has(id);
   input.setAttribute('aria-invalid',String(invalid));
   note.textContent=inOperation?(stage==='checking'?t('Staðfesti breytingu…','Validating change…'):stage==='reconciling'?t('Staðfesti vistun…','Confirming save…'):t('Vista…','Saving…')):rowErrors.get(id)|| (invalid?t('Óvistað — ógilt eða ófullgert gildi.','Unsaved — invalid or incomplete value.'):changed?t('Óvistað','Unsaved'):savedFields.has(id)?t('Vistað','Saved'):'');
  }controls();
 }
 function render(){if(!session)return;renderV2();}
 function localEdit(input,f){
  if(!connected()||!session||!el('settings-fields').contains(input))return;
  const raw=input.type==='checkbox'?input.checked:input.value;if(rawEdits.has(f.id)&&Object.is(rawEdits.get(f.id),raw))return;
  rawEdits.set(f.id,raw);editTickets.set(f.id,Symbol());savedFields.delete(f.id);rowErrors.delete(f.id);stage=saving?stage:'idle';
  const s=session,epoch=uiEpoch,ticket=editTickets.get(f.id);s.invalidate();
  let value;try{value=f.options?JSON.parse(input.value):input.type==='checkbox'?input.checked:input.type==='number'?(input.value===''?NaN:Number((input.valueAsNumber*f.scale).toFixed(6))):input.value;}catch{value=undefined;}
  if(!settingsValueValid(f,value)){invalidFields.add(f.id);updateEditNotes();return;}
  invalidFields.delete(f.id);const d=s.draft;d[f.id]=value;
  if(f.id==='engine.name'){const model=s.config.engine_models?.find(m=>m.name===value);if(model){d['engine.cylinders']=model.cylinders;d['engine.turbo']=model.turbo;}}
  const edit=s.edit(d);updateEditNotes();
  edit.then(()=>{if(s!==session||epoch!==uiEpoch||ticket!==editTickets.get(f.id))return;if(f.id==='engine.name'||f.id==='aux.count'||f.id.endsWith('.enabled')||f.id.endsWith('.topology'))render();updateEditNotes();}).catch(()=>{if(s!==session||epoch!==uiEpoch||ticket!==editTickets.get(f.id))return;invalidFields.add(f.id);updateEditNotes();});
 }
 let activeIds=new Set();
 async function rebase(config,{matched=[],expected={},tickets=new Map()}={}){
  const active=owner,epoch=uiEpoch,old=session,oldDraft=old?.draft,oldBase=old?.confirmed||{},schema=new Set(config.fields.map(f=>f.id));
  const next=await settingsSessionFromReadback(active,config);if(epoch!==uiEpoch||active!==getSource()){next.close();return;}
  const merged=next.draft;
  for(const [id,v]of Object.entries(oldDraft||{}))if(schema.has(id)&&(!equal(v,oldBase[id])||invalidFields.has(id))){
   if(matched.includes(id)&&equal(v,expected[id])&&tickets.get(id)===editTickets.get(id)&&!invalidFields.has(id)){rawEdits.delete(id);savedFields.add(id);}else merged[id]=v;
  }
  for(const id of matched){if(tickets.get(id)===editTickets.get(id)&&!invalidFields.has(id)&&equal(oldDraft?.[id],expected[id])){savedFields.add(id);rawEdits.delete(id);}rowErrors.delete(id);}
  try{await next.edit(merged);}catch{/* Raw invalid input remains visible and blocks bulk save. */}
  old?.close();session=next;render();
 }
 async function startSave(ids){
  if(saving||appBusy||!connected()||uncertain()||!ids.length)return;
  if(ids.some(id=>invalidFields.has(id))||ids.length>1&&session.state==='incomplete'){for(const id of invalidFields)rowErrors.set(id,t('Óvistað — lagfærðu gildið.','Unsaved — correct this value.'));stage='error';updateEditNotes();return;}
  const active=owner,epoch=uiEpoch,baseline=session.config,draft=session.draft,tickets=new Map(editTickets);activeIds=new Set(ids);saving=true;stage='checking';for(const id of ids)rowErrors.delete(id);controls();updateEditNotes();
  const current=()=>epoch===uiEpoch&&owner===active&&getSource()===active&&isConnected();
  await run(async()=>{
   try{
    const result=await saveSettingsSelection(active,baseline,draft,ids,{current,onStage:s=>{if(current()){stage=s;controls();updateEditNotes();}},onDispatch:record=>{pending={...record,tickets,device:active.sourceDeviceId,origin:active.boundOrigin};}});
    if(!current())return;const record=pending;pending=null;
    await rebase(result.config,{matched:result.matched,expected:record.expected,tickets});
    for(const id of ids)if(!result.matched.includes(id)){const actual=result.config.fields.find(f=>f.id===id);rowErrors.set(id,t('Óvistað. Tækið skilaði: ','Unsaved. Device returned: ')+displayValue(actual,actual?.value));}
    stage=result.matched.length===ids.length?'saved':'error';if(result.error)showDiagnostic(diagnostic(result.error,'apply',active));
   }catch(error){
    if(!current())return;const uncertainError=uncertain();stage='error';for(const id of ids)rowErrors.set(id,uncertainError?t('Óvíst hvort vistun tókst. Lestu stöðuna aftur.','Save outcome uncertain. Read status again.'):t('Óvistað — staðfesting mistókst.','Unsaved — validation failed.'));showDiagnostic(diagnostic(error,uncertainError?'readback':'preview',active));if(!uncertainError&&error.message==='SETTINGS_SELECTION_DEPENDENCY')for(const id of ids)rowErrors.set(id,t('Óvistað. Tækið lagði til breytingar utan valdra draga; engin skrif send.','Unsaved. Device proposed changes outside the selected drafts; no write sent.'));authorizationFailure(active);
   }finally{saving=false;activeIds.clear();controls();if(session)updateEditNotes();}
  });
 }
 el('settings-apply').onclick=()=>startSave(changes());
 async function retrieve(){
  if(saving||!getSource()?.hasAuthorization())return;const retained=snapshot()||savedDraft,active=getSource(),epoch=++uiEpoch;owner=active;stage='loading';saving=true;controls();
  await run(async()=>{const read=createV2SettingsSession(active);try{
   const config=await read.load();if(epoch!==uiEpoch||active!==getSource())return;
   if(retained&&retained.device===active.sourceDeviceId&&retained.origin===active.boundOrigin){
    const base=Object.fromEntries(config.fields.map(f=>[f.id,f.value]));
    if(!session){session=await settingsSessionFromReadback(active,config);const draft={...base};for(const [id,v]of Object.entries(retained.draft))if(Object.hasOwn(base,id)&&(!equal(v,retained.base[id])||retained.invalid.includes(id)))draft[id]=v;try{await session.edit(draft);}catch{}for(const [id,v]of retained.raw)rawEdits.set(id,v);for(const id of retained.invalid)invalidFields.add(id);for(const [id,ticket]of retained.tickets||[])editTickets.set(id,ticket);}
   }
   const record=uncertain()?pending:null,matched=record?matchSettingsSelection(config,record.expected,record.ids):[];
   if(session)await rebase(config,{matched,expected:record?.expected||{},tickets:record?.tickets||new Map()});else session=await settingsSessionFromReadback(active,config);
   if(epoch!==uiEpoch||active!==getSource())return;
   if(record){pending=null;for(const id of record.ids)if(!matched.includes(id)){const f=config.fields.find(f=>f.id===id);rowErrors.set(id,t('Óvistað. Tækið skilaði: ','Unsaved. Device returned: ')+displayValue(f,f?.value));}stage=matched.length===record.ids.length?'saved':'error';}else stage='idle';
   savedDraft=null;render();el('settings-readonly').textContent=config.calibration||'';message(t('Núverandi stillingar sóttar frá HuginnEIS.','Current settings retrieved from HuginnEIS.'));
  }catch(error){if(epoch===uiEpoch&&active===getSource()){message(t('Ekki tókst að sækja gögn','Could not retrieve data'));showDiagnostic(diagnostic(error,'retrieve',active));authorizationFailure(active);}}
  finally{read.close();saving=false;controls();if(session)updateEditNotes();}});
 }
 el('settings-load').onclick=retrieve;reread.onclick=retrieve;
 el('settings-diagnose').onclick=()=>run(async()=>{const active=getSource(),epoch=uiEpoch;if(!active?.hasAuthorization())return;const results=[];for(const operation of ['flight-list','retrieve']){const read=createV2SettingsSession(active);try{if(operation==='flight-list')await active.list();else await read.load();results.push({operation,outcome:'valid',...active.requestDiagnostic?.()});}catch(error){results.push({outcome:'failed',...diagnostic(error,operation,active)});}finally{read.close();}if(epoch!==uiEpoch||active!==getSource())return;}showDiagnostic({readOnly:true,results},{open:true});});
 /* RENDER */
 reset();return {reset,suspend,invalidate(){session?.invalidate();controls();},controls};
}
