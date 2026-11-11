import {readFile,writeFile} from 'node:fs/promises';
for(const p of ['pwa/settings-ui.mjs','protocol/field-save-ui.js']){
 let s=await readFile(p,'utf8');
 s=s.replace(' function connected(){'," function authorizationFailure(active){if(active===getSource()&&!active.hasAuthorization()){suspend();onAuthorizationLost?.();}}\n function connected(){");
 s=s.replace("showDiagnostic(diagnostic(error,uncertainError?'readback':'preview',active));", "showDiagnostic(diagnostic(error,uncertainError?'readback':'preview',active));if(!uncertainError&&error.message==='SETTINGS_SELECTION_DEPENDENCY')for(const id of ids)rowErrors.set(id,t('Óvistað. Tækið lagði til breytingar utan valdra draga; engin skrif send.','Unsaved. Device proposed changes outside the selected drafts; no write sent.'));authorizationFailure(active);");
 s=s.replace("showDiagnostic(diagnostic(error,'retrieve',active));", "showDiagnostic(diagnostic(error,'retrieve',active));authorizationFailure(active);");
 await writeFile(p,s);
}
