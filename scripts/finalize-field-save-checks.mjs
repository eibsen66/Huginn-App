import {readFile,writeFile} from 'node:fs/promises';
for(const p of ['pwa/settings-ui.mjs','protocol/field-save-ui.js']){let s=await readFile(p,'utf8');s=s.replace('showDiagnostic({readOnly:true,results});','showDiagnostic({readOnly:true,results},{open:true});');await writeFile(p,s);}
let s=await readFile('scripts/prepare-field-save-review.mjs','utf8');s=s.replaceAll("out+'/candidate-review.json'","out+'/final-candidate-review.json'").replace("+'/rollback-9dce699595b724ea'","+'/rollback-final-9dce699595b724ea'");await writeFile('scripts/prepare-field-save-final.mjs',s,{flag:'wx'});
