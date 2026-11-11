import {readFile,writeFile} from 'node:fs/promises';
for(const p of ['pwa/settings-ui.mjs','protocol/field-save-ui.js']){
 let s=await readFile(p,'utf8');
 s=s.replace("raw:[...rawEdits],invalid:[...invalidFields]}","raw:[...rawEdits],invalid:[...invalidFields],tickets:[...editTickets]}");
 s=s.replace("for(const id of retained.invalid)invalidFields.add(id);","for(const id of retained.invalid)invalidFields.add(id);for(const [id,ticket]of retained.tickets||[])editTickets.set(id,ticket);");
 s=s.replace("const uncertainError=!!pending;","const uncertainError=uncertain();");
 s=s.replace("stage==='saved'?t('Vistað — endurlestur staðfestur.','Saved — readback verified.')", "stage==='saved'?(changes().length?t('Send gildi staðfest. Nýrri eða önnur drög eru enn óvistuð.','Sent values verified. Newer or other drafts remain unsaved.'):t('Vistað — endurlestur staðfestur.','Saved — readback verified.'))");
 await writeFile(p,s);
}
