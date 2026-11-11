import {createV2SettingsSession,settingsSessionFromReadback,saveSettingsSelection,matchSettingsSelection,settingsValueValid} from './settings-v2.mjs';
import {transferDiagnostic} from './download-diagnostics.mjs';
export function bindSettings({getSource,isConnected=()=>true,run,onAuthorizationLost,onConnectionFailure}){
 const el=id=>document.getElementById(id),is=document.documentElement.lang.startsWith('is'),t=(a,b)=>is?a:b,equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 let fresh=false;let appBusy=false;let session=null,owner=null,uiEpoch=0,saving=false,stage='idle',savedDraft=null,pending=null;
 const rawEdits=new Map(),invalidFields=new Set(),editTickets=new Map(),savedFields=new Set(),rowErrors=new Map();
 const message=s=>el('settings-message').textContent=s;
 const diagnosticResult=document.createElement('p');diagnosticResult.id='settings-diagnostic-result';diagnosticResult.setAttribute('role','status');el('settings-diagnose').after(diagnosticResult);
 const previewDiagnostic=document.createElement('button');previewDiagnostic.id='settings-preview-diagnose';previewDiagnostic.type='button';previewDiagnostic.textContent=t('Prófa staðfestingu án vistunar','Test validation without saving');diagnosticResult.after(previewDiagnostic);
 const displayValue=(f,v)=>f?.options?(f.options.find(o=>equal(o.value,v))?.label??String(v)):typeof v==='boolean'?t(v?'Já':'Nei',v?'Yes':'No'):f?.type==='integer'?String(v/f.scale)+(f.unit||''):String(v??'—');
 const text=(id,a,b)=>el(id).textContent=t(a,b);
 text('settings-tab','Stillingar','Settings');text('settings-heading','Stillingar HuginnEIS','HuginnEIS settings');text('settings-load','Sækja núverandi stillingar','Retrieve current settings');text('settings-apply','Vista allar breytingar','Save all changes');text('settings-diagnose','Athuga tengingu (aðeins lestur)','Check connection (read only)');
 const hint=document.createElement('p');hint.id='settings-workflow-hint';hint.setAttribute('role','status');el('settings-apply').before(hint);
 const reread=document.createElement('button');reread.id='settings-reconcile';reread.type='button';reread.textContent=t('Lesa stöðu aftur','Read status again');reread.hidden=true;el('settings-apply').after(reread);
 const help=document.createElement('p');help.className='small';help.textContent=t('Vista breytingu sendir aðeins þann lið. Vista allar breytingar sendir öll gild drög. Vistað birtist eftir staðfestan endurlestur.','Save change sends only that field. Save all changes sends all valid drafts. Saved appears after verified readback.');reread.after(help);
  function diagnostic(error,operation,source=owner){
  const d=error?.diagnostic||source?.requestDiagnostic?.()||{};
  const known=/^(SETTINGS_[A-Z_]+|LIST_IDENTITY|SOURCE_IDENTITY|GENERATION|AUTH_REQUIRED)$/.test(error?.message||'');
  const code=error?.diagnostic?.code||(known?error.message:error?.name==='TypeError'?'JAVASCRIPT_TYPE_ERROR':'TRANSFER_FAILED');
  const name=['TypeError','SyntaxError','Error','TransferError','AbortError'].includes(error?.name)?error.name:'Error';
  const body=transferDiagnostic(error,d);
  return {operation,code,name,phase:error?.diagnostic?.phase||(d.phase==='complete'?'validation':d.phase||'validation'),method:d.method||'GET',endpoint:d.endpoint||'settings',httpStatus:d.httpStatus??null,declaredBytes:d.declaredBytes??null,receivedBytes:d.receivedBytes??null,dispatchAttempted:d.dispatchAttempted===true,...(body.errorBodyStatus?{errorBodyStatus:body.errorBodyStatus}:{}),...(body.serverErrorCode?{serverErrorCode:body.serverErrorCode}:{})};
 }
 function showDiagnostic(value,{open=false}={}){el('settings-diagnostic').textContent=JSON.stringify(value,null,2);if(open)el('settings-diagnostics').open=true;}

 function authorizationFailure(active){if(active===getSource()&&!active.hasAuthorization()){suspend();onAuthorizationLost?.();}}
 function connected(){return isConnected()&&owner===getSource()&&owner?.hasAuthorization();}
 function uncertain(){return pending&&owner&&pending.device===owner.sourceDeviceId&&pending.origin===owner.boundOrigin;}
 function changes(){return session?.draft?session.fields.filter(f=>invalidFields.has(f.id)||!equal(session.draft[f.id],session.confirmed?.[f.id])).map(f=>f.id):[];}
 function controls(externalBusy){
  if(typeof externalBusy==='boolean')appBusy=externalBusy;
  if(owner&&owner!==getSource()){suspend();return;}
  const live=connected(),busy=saving||appBusy;
  el('settings-load').disabled=busy||!getSource()?.hasAuthorization();el('settings-diagnose').disabled=busy||!getSource()?.hasAuthorization();
  el('settings-apply').disabled=busy||!live||!fresh||uncertain()||!changes().length||invalidFields.size>0||session?.state==='incomplete';
  previewDiagnostic.disabled=busy||!live||!fresh||!session?.draft||invalidFields.size>0||session.state==='incomplete';
  reread.hidden=!uncertain();reread.disabled=busy||!live;
  // Keep typing possible during the captured operation. New input is a newer
  // local draft, never a mutation of the immutable request being sent.
  for(const input of el('settings-fields').querySelectorAll('input,select'))input.disabled=!live||(!saving&&appBusy)||input.dataset.settingsInactive==='true';
  for(const button of el('settings-fields').querySelectorAll('[data-save-field]')){
   const id=button.dataset.saveField;button.disabled=busy||!live||!fresh||uncertain()||invalidFields.has(id)||!session?.draft||equal(session.draft[id],session.confirmed?.[id]);
  }
  hint.dataset.state=!live?'disconnected':saving?stage:uncertain()?'uncertain':!fresh?'stale':invalidFields.size?'invalid':stage;
  hint.textContent=!live?t('Tengdu HuginnEIS og sæktu núverandi stillingar.','Connect HuginnEIS and retrieve current settings.'):saving?stage==='loading'?t('Sæki núverandi stillingar…','Retrieving current settings…'):stage==='checking'?t('Staðfesti breytingar…','Validating changes…'):stage==='reconciling'?t('Staðfesti vistun…','Confirming save…'):t('Vista breytingar…','Saving changes…'):uncertain()?t('Óvíst hvort vistun tókst. Lestu stöðuna aftur áður en þú vistar.','Save outcome uncertain. Read status again before saving.'):!fresh?t('Áður sótt — nýr lestur mistókst. Sæktu núverandi stillingar áður en þú vistar.','Previously retrieved — fresh read failed. Retrieve current settings before saving.'):invalidFields.size?t('Ógildir reitir eru merktir. Ekki er hægt að vista öll drög.','Invalid fields are marked. All drafts cannot be saved.'):stage==='saved'?(changes().length?t('Send gildi staðfest. Nýrri eða önnur drög eru enn óvistuð.','Sent values verified. Newer or other drafts remain unsaved.'):t('Vistað — endurlestur staðfestur.','Saved — readback verified.')):stage==='error'?t('Vistun tókst ekki að fullu. Sjá stöðu við reitina.','Save did not fully succeed. See each field status.'):changes().length?t('Óvistað. Veldu Vista við reit eða Vista allar breytingar.','Unsaved. Choose Save beside a field or Save all changes.'):t('Engar óvistaðar breytingar.','No unsaved changes.');
 }
 function snapshot(){return session?.draft&&owner?{device:owner.sourceDeviceId,origin:owner.boundOrigin,base:session.confirmed,draft:session.draft,raw:[...rawEdits],invalid:[...invalidFields],tickets:[...editTickets]}:null;}
 function reset({keepDraft=false}={}){if(!keepDraft)savedDraft=null;diagnosticResult.textContent='';uiEpoch++;fresh=false;session?.close();session=null;owner=null;rawEdits.clear();invalidFields.clear();editTickets.clear();savedFields.clear();rowErrors.clear();el('settings-fields').replaceChildren();el('settings-changes').textContent='';el('settings-readonly').textContent='';stage='idle';controls();}
 function suspend(){const draft=snapshot();if(draft)savedDraft=draft;reset({keepDraft:true});message(t('Tenging rofin. Drög haldast í minni; sæktu stillingar aftur.','Disconnected. Drafts remain in memory; retrieve settings again.'));}
 function updateSummary(){if(!session?.draft){el('settings-changes').textContent='';return;}const d=session.draft,b=session.confirmed;el('settings-changes').textContent=session.fields.filter(f=>invalidFields.has(f.id)||!equal(d[f.id],b[f.id])).map(f=>{const value=v=>f.type==='integer'?String(v/f.scale)+(f.unit||''):String(v);return (f.id==='display.brightness_percent'?t('Birta','Brightness'):f.label)+': '+value(b[f.id])+' → '+(invalidFields.has(f.id)?String(rawEdits.get(f.id)??''):value(d[f.id]))+' — '+t('Óvistað','Unsaved');}).join('\n');}
 function updateEditNotes(){
  updateSummary();for(const input of el('settings-fields').querySelectorAll('[data-settings-field]')){
   const id=input.dataset.settingsField,label=input.closest('label');let note=label.querySelector('.setting-edit-note'),button=label.querySelector('[data-save-field]');
   if(!note){note=document.createElement('span');note.className='small setting-edit-note';note.setAttribute('role','status');label.append(note);}
   if(!button){button=document.createElement('button');button.type='button';button.dataset.saveField=id;button.textContent=t('Vista breytingu','Save change');button.style.display='block';button.onclick=event=>{event.preventDefault();startSave([id]);};label.append(button);}
   const invalid=invalidFields.has(id),changed=invalid||!equal(session?.draft?.[id],session?.confirmed?.[id]),inOperation=saving&&activeIds.has(id);
   input.setAttribute('aria-invalid',String(invalid));
   note.textContent=!fresh&&stage==='read_failed'?(changed?t('Óvistað. Áður sótt — nýr lestur mistókst.','Unsaved. Previously retrieved — fresh read failed.'):t('Áður sótt — nýr lestur mistókst','Previously retrieved — fresh read failed')):inOperation?(stage==='checking'?t('Staðfesti breytingu…','Validating change…'):stage==='reconciling'?t('Staðfesti vistun…','Confirming save…'):t('Vista…','Saving…')):rowErrors.get(id)|| (invalid?t('Óvistað — ógilt eða ófullgert gildi.','Unsaved — invalid or incomplete value.'):changed?t('Óvistað','Unsaved'):savedFields.has(id)?t('Vistað','Saved'):'');
  }controls();
 }
 function render(){if(!session)return;renderV2();}
 function localEdit(input,f){
  if(!connected()||!session||!el('settings-fields').contains(input))return;
  const raw=input.type==='checkbox'?input.checked:input.value;if(rawEdits.has(f.id)&&Object.is(rawEdits.get(f.id),raw))return;
  rawEdits.set(f.id,raw);editTickets.set(f.id,Symbol());savedFields.delete(f.id);rowErrors.delete(f.id);stage=saving||!fresh?stage:'idle';
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
  try{
   await next.edit(merged);
   // A pending topology may recreate fields absent from the device baseline.
   // Restore only values accepted by those newly generated descriptors.
   const shaped=next.draft;let restore=false;
   for(const f of next.fields)if(f.draft_new&&Object.hasOwn(oldDraft||{},f.id)&&settingsValueValid(f,oldDraft[f.id])){shaped[f.id]=oldDraft[f.id];restore=true;}
   if(restore)await next.edit(shaped);
  }catch{/* Raw invalid input remains visible and blocks bulk save. */}
  old?.close();session=next;render();
 }
 async function startSave(ids){
  if(saving||appBusy||!fresh||!connected()||uncertain()||!ids.length)return;
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
  if(saving||!getSource()?.hasAuthorization())return;const retained=snapshot()||savedDraft,active=getSource(),epoch=++uiEpoch;owner=active;fresh=false;stage='loading';saving=true;controls();
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
   fresh=true;savedDraft=null;render();el('settings-readonly').textContent=config.calibration||'';message(t('Núverandi stillingar sóttar frá HuginnEIS.','Current settings retrieved from HuginnEIS.'));
  }catch(error){if(epoch===uiEpoch&&active===getSource()){fresh=false;stage='read_failed';message(session?t('Áður sótt — nýr lestur mistókst','Previously retrieved — fresh read failed'):t('Ekki tókst að sækja gögn','Could not retrieve data'));showDiagnostic(diagnostic(error,'retrieve',active));authorizationFailure(active);}}
  finally{read.close();saving=false;controls();if(session)updateEditNotes();}});
 }
 el('settings-load').onclick=retrieve;reread.onclick=retrieve;
 previewDiagnostic.onclick=()=>{
  if(appBusy||saving||!fresh||!connected()||invalidFields.size||session?.state==='incomplete')return;
  const active=owner,epoch=uiEpoch,config=session.config,draft=session.draft;
  return run(async()=>{const read=await settingsSessionFromReadback(active,config);try{
   await read.edit(draft);await read.preview();
   if(epoch!==uiEpoch||active!==getSource())return;
   diagnosticResult.textContent=t('Óvaranleg POST-staðfesting tókst. Ekkert vistað. Ritillinn er óbreyttur.','Non-persistent POST validation succeeded. Nothing saved. Editor unchanged.');
   showDiagnostic({readOnly:false,nonPersistent:true,operation:'preview',outcome:'valid',...active.requestDiagnostic?.()},{open:true});
  }catch(error){if(epoch!==uiEpoch||active!==getSource())return;diagnosticResult.textContent=t('Óvaranleg POST-staðfesting mistókst. Ekkert vistað. Ritillinn er óbreyttur.','Non-persistent POST validation failed. Nothing saved. Editor unchanged.');showDiagnostic({nonPersistent:true,...diagnostic(error,'preview',active)},{open:true});authorizationFailure(active);}
  finally{read.close();}});
 };

 el('settings-diagnose').onclick=()=>run(async()=>{const active=getSource(),epoch=uiEpoch;if(!active?.hasAuthorization())return;const results=[];for(const operation of ['flight-list','retrieve']){const read=createV2SettingsSession(active);try{if(operation==='flight-list')await active.list();else await read.load();results.push({operation,outcome:'valid',...active.requestDiagnostic?.()});}catch(error){results.push({operation,outcome:'failed',...diagnostic(error,operation,active)});}finally{read.close();}if(epoch!==uiEpoch||active!==getSource())return;}diagnosticResult.textContent=results.map(r=>(r.operation==='flight-list'?t('Skráalisti','Flight list'):t('Stillingalestur í greiningu','Diagnostic settings read'))+': '+(r.outcome==='valid'?t('tókst','succeeded'):t('mistókst','failed'))+' (HTTP '+(r.httpStatus??'—')+')').join(' · ')+t('. Ritillinn er óbreyttur; þessi athugun opnar ekki fyrir vistun.','. Editor unchanged; this check does not enable saving.');showDiagnostic({readOnly:true,results},{open:true});});
  function renderV2(){
  const names={Display:t('Skjár','Display'),Units:t('Einingar','Units'),Aircraft:t('Loftfar','Aircraft'),Engine:t('Hreyfill','Engine'),AUX:'AUX',Fuel:t('Eldsneyti','Fuel')};
  const fields=session.fields,ids=new Set(fields.map(f=>f.id)),draft=session.draft;
  for(const id of new Set([...rawEdits.keys(),...invalidFields]))if(!ids.has(id)){rawEdits.delete(id);invalidFields.delete(id);editTickets.delete(id);}
  // Reconcile keyed rows: do not detach the focused input, even for engine,
  // AUX or topology changes. Keep caret, focus and the mobile keyboard.
  for(const old of el('settings-fields').querySelectorAll('[data-settings-field]'))if(!ids.has(old.dataset.settingsField))old.closest('label').remove();
  for(const section of ['Display','Units','Aircraft','Engine','AUX','Fuel']){
   let group=el('settings-fields').querySelector('[data-settings-section="'+section+'"]');
   if(!group){group=document.createElement('fieldset');group.dataset.settingsSection=section;const legend=document.createElement('legend');legend.textContent=names[section];group.append(legend);el('settings-fields').append(group);if(section==='AUX'){const note=document.createElement('p');note.textContent=t('Röð AUX-reita ákvarðar forgang á MAIN. Ónotaðir reitir eru óvirkir.','AUX slot order determines MAIN priority. Unused slots are disabled.');group.append(note);}if(section==='Engine'&&session.config.engine_status){const note=document.createElement('p');note.textContent=session.config.engine_status;group.append(note);}}
   if(section==='Engine'){let status=group.querySelector(':scope > p');if(session.config.engine_status){if(!status){status=document.createElement('p');group.insertBefore(status,group.children[1]||null);}status.textContent=session.config.engine_status;}else status?.remove();}
   for(const f of fields.filter(f=>f.section===section)){
    let parent=group;
    if(f.id.startsWith('parameters.')){const key=f.id.split('.')[1];let detail=group.querySelector('[data-settings-parameter="'+key+'"]');if(!detail){detail=document.createElement('details');detail.dataset.settingsParameter=key;const summary=document.createElement('summary');summary.textContent=f.label.split(' - ')[0];detail.append(summary);group.append(detail);}parent=detail;}
    let input=group.querySelector('[data-settings-field="'+f.id+'"]');
    if(!input){const label=document.createElement('label');label.append(document.createTextNode(f.label+(f.unit&&f.type==='integer'?' ('+f.unit+')':'')+' '));input=document.createElement(f.options?'select':'input');input.dataset.settingsField=f.id;label.append(input);parent.append(label);}
    if(f.options){const options=JSON.stringify(f.options);if(input.dataset.options!==options){input.replaceChildren();for(const o of f.options){const option=document.createElement('option');option.value=JSON.stringify(o.value);option.textContent=o.label;input.append(option);}input.dataset.options=options;}if(input!==document.activeElement)input.value=JSON.stringify(draft[f.id]);if(input.selectedIndex<0){const o=document.createElement('option');o.value=JSON.stringify(draft[f.id]);o.textContent=String(draft[f.id]||t('Óstillt','Unconfigured'));input.append(o);input.value=o.value;}}
    else{const type=f.type==='boolean'?'checkbox':f.type==='integer'?'number':'text';if(input.type!==type)input.type=type;if(input.type==='number'){input.min=f.min/f.scale;input.max=f.max/f.scale;input.step=f.id==='fuel.cruise_burn'?0.5:1/f.scale;}if(input!==document.activeElement){if(input.type==='checkbox')input.checked=draft[f.id];else input.value=invalidFields.has(f.id)&&rawEdits.has(f.id)?rawEdits.get(f.id):draft[f.id]===null?'':input.type==='number'?draft[f.id]/f.scale:draft[f.id];}if(f.max_bytes)input.maxLength=f.max_bytes;}
    input.closest('label').firstChild.nodeValue=f.label+(f.unit&&f.type==='integer'?' ('+f.unit+')':'')+' ';
    const slot=/^aux\.([0-3])\./.exec(f.id);input.dataset.settingsInactive=String(!!(slot&&+slot[1]>=draft['aux.count']||f.id.endsWith('.topology')&&draft[f.id.replace('topology','enabled')]));
    input.oninput=()=>localEdit(input,f);input.onchange=()=>localEdit(input,f);
    if(f.id==='engine.name'&&session.config.engine_models?.length){input.setAttribute('list','settings-engine-models');if(!group.querySelector('#settings-engine-models')){const models=document.createElement('datalist');models.id='settings-engine-models';for(const m of session.config.engine_models){const o=document.createElement('option');o.value=m.name;models.append(o);}group.append(models);}}
   }
  }
  controls();updateEditNotes();
 }

 reset();return {reset,suspend,invalidate(){session?.invalidate();controls();},controls};
}
