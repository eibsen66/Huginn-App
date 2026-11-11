 function localEdit(input,f){
  const s=session,active=owner,epoch=uiEpoch;
  if(!s||!isConnected()||!active?.hasAuthorization())return;
  const raw=input.type==='checkbox'?input.checked:input.value;
  if(rawEdits.has(f.id)&&Object.is(rawEdits.get(f.id),raw))return;
  rawEdits.set(f.id,raw);
  const ticket=Symbol();editTickets.set(f.id,ticket);
  const current=()=>epoch===uiEpoch&&session===s&&owner===active&&getSource()===active&&editTickets.get(f.id)===ticket;
  s.invalidate();el('settings-changes').textContent='';
  const d=s.draft;
  let value;
  try{value=f.options?JSON.parse(input.value):input.type==='checkbox'?input.checked:input.type==='number'?(input.value===''||!Number.isFinite(input.valueAsNumber)?NaN:Number((input.valueAsNumber*f.scale).toFixed(6))):input.value;}catch{value=undefined;}
  if(f.id==='engine.name'){const model=s.config.engine_models?.find(m=>m.name===value);if(model){d['engine.cylinders']=model.cylinders;d['engine.turbo']=model.turbo;}}
  d[f.id]=value;
  // edit validates synchronously before its Promise settles. Never coerce an
  // empty/bad number to zero or replace the visible text with an older value.
  const edited=s.edit(d);
  if(s.state==='invalid')invalidFields.add(f.id);else invalidFields.delete(f.id);
  message(invalidFields.size?t('Gildið er ófullgert eða ógilt. Textinn helst í reitnum; ekkert er vistað.','The value is incomplete or invalid. Your input stays in the field; nothing is saved.'):t('Breytingar í bið í símanum — ekkert vistað.','Local changes pending — nothing saved.'));
  controls();updateEditNotes();
  edited.then(()=>{if(!current())return;if(f.id==='engine.name'||f.id==='aux.count'||f.id.endsWith('.enabled')||f.id.endsWith('.topology'))render();controls();updateEditNotes();}).catch(()=>{if(!current())return;invalidFields.add(f.id);message(t('Gildið er ófullgert eða ógilt. Lagfærðu reitinn áður en þú forskoðar. Ekkert vistað.','The value is incomplete or invalid. Correct the field before previewing. Nothing saved.'));controls();updateEditNotes();});
 }
 function updateEditNotes(){
  for(const input of el('settings-fields').querySelectorAll('[data-settings-field]')){
   const id=input.dataset.settingsField,label=input.closest('label');let note=label.querySelector('.setting-edit-note');
   if(!note){note=document.createElement('span');note.className='small setting-edit-note';label.append(note);}
   const invalid=invalidFields.has(id),changed=rawEdits.has(id)&&session?.draft&&JSON.stringify(session.draft[id])!==JSON.stringify(session.confirmed?.[id]);
   input.setAttribute('aria-invalid',String(invalid));
   note.textContent=invalid?t(' Ófullgert/ógilt — ekki vistað.',' Incomplete/invalid — not saved.'):changed?(session.state==='previewed'?t(' Forskoðað — ekki vistað.',' Previewed — not saved.'):t(' Breyting í bið í símanum.',' Local change pending.')):'';
  }
 }
 function renderV2(){
  const names={Display:t('Skjár','Display'),Units:t('Einingar','Units'),Aircraft:t('Loftfar','Aircraft'),Engine:t('Hreyfill','Engine'),AUX:'AUX',Fuel:t('Eldsneyti','Fuel')};
  const fields=session.fields,ids=new Set(fields.map(f=>f.id)),draft=session.draft;
  // Reconcile keyed rows: do not detach the focused input, even for engine,
  // AUX or topology changes. Keep caret, focus and the mobile keyboard.
  for(const old of el('settings-fields').querySelectorAll('[data-settings-field]'))if(!ids.has(old.dataset.settingsField))old.closest('label').remove();
  for(const section of ['Display','Units','Aircraft','Engine','AUX','Fuel']){
   let group=el('settings-fields').querySelector('[data-settings-section="'+section+'"]');
   if(!group){group=document.createElement('fieldset');group.dataset.settingsSection=section;const legend=document.createElement('legend');legend.textContent=names[section];group.append(legend);el('settings-fields').append(group);if(section==='AUX'){const note=document.createElement('p');note.textContent=t('Röð AUX-reita ákvarðar forgang á MAIN. Ónotaðir reitir eru óvirkir.','AUX slot order determines MAIN priority. Unused slots are disabled.');group.append(note);}if(section==='Engine'&&session.config.engine_status){const note=document.createElement('p');note.textContent=session.config.engine_status;group.append(note);}}
   for(const f of fields.filter(f=>f.section===section)){
    let parent=group;
    if(f.id.startsWith('parameters.')){const key=f.id.split('.')[1];let detail=group.querySelector('[data-settings-parameter="'+key+'"]');if(!detail){detail=document.createElement('details');detail.dataset.settingsParameter=key;const summary=document.createElement('summary');summary.textContent=f.label.split(' - ')[0];detail.append(summary);group.append(detail);}parent=detail;}
    let input=group.querySelector('[data-settings-field="'+f.id+'"]');
    if(!input){const label=document.createElement('label');label.append(document.createTextNode(f.label+(f.unit&&f.type==='integer'?' ('+f.unit+')':'')+' '));input=document.createElement(f.options?'select':'input');input.dataset.settingsField=f.id;label.append(input);parent.append(label);}
    if(f.options){const options=JSON.stringify(f.options);if(input.dataset.options!==options){input.replaceChildren();for(const o of f.options){const option=document.createElement('option');option.value=JSON.stringify(o.value);option.textContent=o.label;input.append(option);}input.dataset.options=options;}if(input!==document.activeElement)input.value=JSON.stringify(draft[f.id]);if(input.selectedIndex<0){const o=document.createElement('option');o.value=JSON.stringify(draft[f.id]);o.textContent=String(draft[f.id]||t('Óstillt','Unconfigured'));input.append(o);input.value=o.value;}}
    else{input.type=f.type==='boolean'?'checkbox':f.type==='integer'?'number':'text';if(input.type==='number'){input.min=f.min/f.scale;input.max=f.max/f.scale;input.step=f.id==='fuel.cruise_burn'?0.5:1/f.scale;}if(input!==document.activeElement){if(input.type==='checkbox')input.checked=draft[f.id];else input.value=invalidFields.has(f.id)&&rawEdits.has(f.id)?rawEdits.get(f.id):draft[f.id]===null?'':input.type==='number'?draft[f.id]/f.scale:draft[f.id];}if(f.max_bytes)input.maxLength=f.max_bytes;}
    const slot=/^aux\.([0-3])\./.exec(f.id);input.dataset.settingsInactive=String(!!(slot&&+slot[1]>=draft['aux.count']||f.id.endsWith('.topology')&&draft[f.id.replace('topology','enabled')]));
    input.oninput=()=>localEdit(input,f);input.onchange=()=>localEdit(input,f);
    if(f.id==='engine.name'&&session.config.engine_models?.length){input.setAttribute('list','settings-engine-models');if(!group.querySelector('#settings-engine-models')){const models=document.createElement('datalist');models.id='settings-engine-models';for(const m of session.config.engine_models){const o=document.createElement('option');o.value=m.name;models.append(o);}group.append(models);}}
   }
  }
  controls();updateEditNotes();
 }
