import {readFile,writeFile,mkdir} from 'node:fs/promises';
const path='pwa/settings-ui.mjs';let s=await readFile(path,'utf8');
s=s.replace("el('settings-diagnose').after(diagnosticResult);",`el('settings-diagnose').after(diagnosticResult);
 const previewDiagnostic=document.createElement('button');previewDiagnostic.id='settings-preview-diagnose';previewDiagnostic.type='button';previewDiagnostic.textContent=t('Prófa staðfestingu án vistunar','Test validation without saving');diagnosticResult.after(previewDiagnostic);`);
s=s.replace("reread.hidden=!uncertain();", "previewDiagnostic.disabled=busy||!live||!fresh||!session?.draft||invalidFields.size>0||session.state==='incomplete';\n  reread.hidden=!uncertain();");
s=s.replace(" el('settings-load').onclick=retrieve;reread.onclick=retrieve;",` el('settings-load').onclick=retrieve;reread.onclick=retrieve;
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
`);
await writeFile(path,s);
await mkdir('build/freshness-review/screenshots',{recursive:true});
let test=await readFile('scripts/create-freshness-browser.mjs','utf8');
test=test.replace("await writeFile('tests/pwa-freshness-browser.test.mjs',s);",`s=s.replaceAll('build/field-save-review/screenshots/','build/freshness-review/screenshots/');await writeFile('tests/pwa-freshness-browser.test.mjs',s);`);await writeFile('scripts/create-freshness-browser.mjs',test);
let upgrade=await readFile('tests/pwa-field-save-upgrade.test.mjs','utf8');upgrade=upgrade.replaceAll('build/field-save-review/upgrade/','build/freshness-review/upgrade/');await writeFile('tests/pwa-freshness-upgrade.test.mjs',upgrade);
