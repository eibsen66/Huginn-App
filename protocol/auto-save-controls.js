 function controls(busy=false){
  if(owner&&owner!==getSource()){reset();return;}
  const connected=isConnected()&&owner===getSource()&&owner?.hasAuthorization();
  busy=busy||saving||!!session&&!connected;
  el('settings-diagnose').disabled=busy||!getSource()?.hasAuthorization();el('settings-load').disabled=busy||!getSource()?.hasAuthorization();
  el('settings-apply').disabled=busy||invalidFields.size>0||!connected||!!uncertainForOwner()||validation.state!=='ready'||session?.state!=='previewed'||!session.changes.length;
  for(const input of el('settings-fields').querySelectorAll('input,select'))input.disabled=busy||!session?.draft||input.dataset.settingsInactive==='true';
  const status=!connected?'disconnected':saving?'saving':uncertainForOwner()?'uncertain':invalidFields.size||['invalid','incomplete'].includes(session?.state)?'invalid':validation.state==='ready'?'ready':validation.state==='checking'||validation.state==='waiting'?'checking':validation.state==='error'?'error':verified?'saved':'idle';
  workflowHint.dataset.state=status;
  workflowHint.textContent=({disconnected:t('Tengdu HuginnEIS og sæktu núverandi stillingar.','Connect HuginnEIS and retrieve current settings.'),saving:t('Vista og staðfesti endurlestur. Ekki endurtaka vistun.','Saving and verifying readback. Do not repeat the save.'),uncertain:t('Vistun er óstaðfest. Sæktu núverandi stillingar til endurlesturs; ekki endurtaka vistun.','Save is uncertain. Retrieve current settings to reconcile; do not repeat the write.'),invalid:t('Ófullgert eða ógilt gildi. Lagfærðu reitinn; ekkert vistað.','Incomplete or invalid value. Correct the field; nothing saved.'),checking:t('Athuga breytingar á HuginnEIS — ekkert vistað.','Checking changes on HuginnEIS — nothing saved.'),ready:t('Breytingar staðfestar. Veldu Vista breytingar þegar þú ert tilbúinn.','Changes validated. Choose Save changes when ready.'),error:t('Ekki tókst að staðfesta breytingar. Ekkert vistað. Sjá greiningu.','Validation failed. Nothing saved. See Diagnostics.'),saved:t('Vistað og staðfest með endurlestri frá HuginnEIS.','Saved and verified by authoritative HuginnEIS readback.'),idle:session?.draft?t('Engar breytingar í bið.','No pending changes.'):t('Veldu Sækja núverandi stillingar til að opna ritilinn.','Choose Retrieve current settings to open the editor.')})[status];
 }
 function uncertainForOwner(){return uncertainSave&&owner&&uncertainSave.device===owner.sourceDeviceId&&uncertainSave.origin===owner.boundOrigin?uncertainSave:null;}
 function updateSummary(){
  if(!session?.draft){el('settings-changes').textContent='';return;}
  const before=session.confirmed,draft=session.draft,lines=[];
  for(const f of session.fields){const invalid=invalidFields.has(f.id);if(!invalid&&JSON.stringify(before[f.id])===JSON.stringify(draft[f.id]))continue;
   const value=v=>f.options?(f.options.find(o=>JSON.stringify(o.value)===JSON.stringify(v))?.label??String(v)):typeof v==='boolean'?t(v?'Já':'Nei',v?'Yes':'No'):v===null?'—':f.type==='integer'?String(v/f.scale)+(f.unit==='%'?'%':f.unit?' '+f.unit:''):String(v);
   const label=f.id==='display.brightness_percent'?t('Birta','Brightness'):f.label;
   lines.push(label+': '+value(before[f.id])+' → '+(invalid?String(rawEdits.get(f.id)??'')+t(' (ógilt/ófullgert)',' (invalid/incomplete)'):value(draft[f.id])));
  }
  el('settings-changes').textContent=lines.join('\n');
 }
