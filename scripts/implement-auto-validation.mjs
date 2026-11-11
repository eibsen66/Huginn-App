import {readFile,writeFile,mkdir} from 'node:fs/promises';
const out='build/one-save-review';await mkdir(out,{recursive:true});let s=await readFile('pwa/settings-ui.mjs','utf8');await writeFile(out+'/settings-ui.before.mjs',s,{flag:'wx'});
function rep(a,b){if(!s.includes(a))throw Error(a);s=s.replace(a,b);}
rep("import {createV2SettingsSession}","import {createV2SettingsSession,createDraftValidation}");
rep('let session=null,owner=null,uiEpoch=0,savedDraft=null;', 'let session=null,owner=null,uiEpoch=0,savedDraft=null,saving=false,verified=false,uncertainSave=null;');
rep("text('settings-preview','Forskoða breytingar','Preview changes');text('settings-apply','Staðfesta og vista','Confirm and apply');", "text('settings-apply','Vista breytingar','Save changes');");
const a=s.indexOf(' const workflowHint='),b=s.indexOf(' function diagnostic(',a);
s=s.slice(0,a)+` const workflowHint=document.createElement('p');workflowHint.id='settings-workflow-hint';workflowHint.setAttribute('role','status');el('settings-apply').before(workflowHint);
 const validation=createDraftValidation({getSession:()=>session,isAvailable:()=>!saving&&!uncertainForOwner()&&!invalidFields.size&&isConnected()&&owner===getSource()&&owner?.hasAuthorization(),onState:(state,error)=>{if(state==='error'){showDiagnostic(diagnostic(error,'preview'));message(t('Ekki tókst að staðfesta breytingar. Ekkert vistað.','Validation failed. Nothing saved.'));}if(state==='ready'){render();updateSummary();}controls();}});
 const saveHelp=document.createElement('p');saveHelp.className='small';saveHelp.textContent=t('Breytingar eru athugaðar sjálfkrafa. Aðeins Vista breytingar vistar; árangur krefst staðfests endurlesturs.','Changes are checked automatically. Only Save changes writes them; success requires verified readback.');el('settings-apply').after(saveHelp);
`+s.slice(b);
const c=s.indexOf(' function controls('),d=s.indexOf(' function reset(',c);s=s.slice(0,c)+await readFile('protocol/auto-save-controls.js','utf8')+s.slice(d);
rep('uiEpoch++;rawEdits.clear();','uiEpoch++;verified=false;validation.cancel();rawEdits.clear();');
// Preserve uncertainty through suspend/reset; it is connection/device-bound and
// can be cleared only by matching read-only reconciliation or verified save.
rep('render();el(\'settings-readonly\')',`const uncertain=uncertainForOwner();if(uncertain&&s.config.config_revision===uncertain.revision&&JSON.stringify(s.confirmed)===JSON.stringify(uncertain.values)){uncertainSave=null;verified=true;}
   render();if(!uncertainForOwner()&&s.hasChanges)validation.changed();el('settings-readonly')`);
rep("message(restored?t(","if(verified)message(t('Vistað og staðfest með endurlestri frá HuginnEIS.','Saved and verified by authoritative HuginnEIS readback.'));else if(uncertainForOwner())message(t('Vistun áfram óstaðfest. Núverandi gildi voru endurlesin; vistun verður ekki endurtekin.','Save remains uncertain. Current values were read; the write will not be repeated.'));else message(restored?t(");
s=s.replaceAll('Forskoðaðu aftur áður en þú vistar.','Bíddu eftir sjálfvirkri staðfestingu áður en þú vistar.').replaceAll('Preview again before saving.','Wait for automatic validation before saving.').replaceAll('sæktu stillingar aftur og forskoðaðu áður en þú vistar.','sæktu stillingar aftur áður en þú vistar.').replaceAll('retrieve settings and preview again before saving.','retrieve settings before saving.');
const p=s.indexOf(" el('settings-preview').onclick="),q=s.indexOf(' function localEdit(',p);
s=s.slice(0,p)+` el('settings-apply').onclick=()=>{
  if(saving||validation.state!=='ready'||invalidFields.size||uncertainForOwner()||!isConnected()||owner!==getSource()||session?.state!=='previewed')return;
  saving=true;verified=false;const target=session,active=owner,epoch=uiEpoch;
  uncertainSave={device:active.sourceDeviceId,origin:active.boundOrigin,revision:target.config.config_revision+(target.changes.length?1:0),values:target.draft};validation.cancel();controls();
  return run(()=>work('apply',async()=>{await target.apply();if(epoch!==uiEpoch||target!==session||active!==getSource())return;uncertainSave=null;verified=true;rawEdits.clear();invalidFields.clear();render();updateSummary();message(t('Vistað og staðfest með endurlestri frá HuginnEIS.','Saved and verified by authoritative HuginnEIS readback.'));})).finally(()=>{saving=false;controls();});
 };
`+s.slice(q);
rep("s.invalidate();el('settings-changes').textContent='';", "s.invalidate();verified=false;validation.cancel();el('settings-changes').textContent='';");
rep("controls();updateEditNotes();\n  edited.then", "controls();updateEditNotes();\n  edited.then");
rep("if(!current())return;if(f.id===", "if(!current())return;if(!invalidFields.size&&!['invalid','incomplete'].includes(s.state))validation.changed();if(f.id===");
// Summary refreshes synchronously on every input, including invalid raw text.
rep("function updateEditNotes(){", "function updateEditNotes(){\n  updateSummary();");
await writeFile('pwa/settings-ui.mjs',s);
let html=await readFile('pwa/index.html','utf8');await writeFile(out+'/index.before.html',html,{flag:'wx'});html=html.replace(/<button id="settings-preview"[^>]*>[^<]*<\/button>/,'').replace('>Staðfesta og vista</button>','>Vista breytingar</button>');await writeFile('pwa/index.html',html);
