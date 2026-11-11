import {readFile,writeFile,mkdir} from 'node:fs/promises';
const out='build/freshness-review';await mkdir(out,{recursive:true});
const path='pwa/settings-ui.mjs';let s=await readFile(path,'utf8');await writeFile(out+'/settings-ui.before.mjs',s,{flag:'wx'});
s=s.replace('let appBusy=false;','let fresh=false;let appBusy=false;');
s=s.replace("const message=s=>el('settings-message').textContent=s;", "const message=s=>el('settings-message').textContent=s;\n const diagnosticResult=document.createElement('p');diagnosticResult.id='settings-diagnostic-result';diagnosticResult.setAttribute('role','status');el('settings-diagnose').after(diagnosticResult);");
s=s.replace("busy||!live||uncertain()||!changes()", "busy||!live||!fresh||uncertain()||!changes()");
s=s.replace("button.disabled=busy||!live||uncertain()", "button.disabled=busy||!live||!fresh||uncertain()");
s=s.replace("uncertain()?'uncertain':invalidFields", "uncertain()?'uncertain':!fresh?'stale':invalidFields");
s=s.replace("invalidFields.size?t('Ógildir reitir", "!fresh?t('Áður sótt — nýr lestur mistókst. Sæktu núverandi stillingar áður en þú vistar.','Previously retrieved — fresh read failed. Retrieve current settings before saving.'):invalidFields.size?t('Ógildir reitir");
s=s.replace("uiEpoch++;session?.close();", "uiEpoch++;fresh=false;session?.close();");
s=s.replace("note.textContent=inOperation?", "note.textContent=!fresh&&stage==='read_failed'?(changed?t('Óvistað. Áður sótt — nýr lestur mistókst.','Unsaved. Previously retrieved — fresh read failed.'):t('Áður sótt — nýr lestur mistókst','Previously retrieved — fresh read failed')):inOperation?");
s=s.replace("if(saving||appBusy||!connected()", "if(saving||appBusy||!fresh||!connected()");
s=s.replace("owner=active;stage='loading';", "owner=active;fresh=false;stage='loading';");
s=s.replace("savedDraft=null;render();", "fresh=true;savedDraft=null;render();");
s=s.replace("message(t('Ekki tókst að sækja gögn','Could not retrieve data'));showDiagnostic", "fresh=false;stage='read_failed';message(session?t('Áður sótt — nýr lestur mistókst','Previously retrieved — fresh read failed'):t('Ekki tókst að sækja gögn','Could not retrieve data'));showDiagnostic");
s=s.replace("showDiagnostic({readOnly:true,results},{open:true});", "const settings=results.find(r=>r.operation==='retrieve');diagnosticResult.textContent=results.map(r=>(r.operation==='flight-list'?t('Skráalisti','Flight list'):t('Stillingalestur í greiningu','Diagnostic settings read'))+': '+(r.outcome==='valid'?t('tókst','succeeded'):t('mistókst','failed'))+' (HTTP '+(r.httpStatus??'—')+')').join(' · ')+t('. Ritillinn er óbreyttur; þessi athugun opnar ekki fyrir vistun.','. Editor unchanged; this check does not enable saving.');showDiagnostic({readOnly:true,results},{open:true});");
// Keep operation labels even when a diagnostic GET throws.
s=s.replace("results.push({outcome:'failed',...diagnostic(error,operation,active)})", "results.push({operation,outcome:'failed',...diagnostic(error,operation,active)})");
await writeFile(path,s);
