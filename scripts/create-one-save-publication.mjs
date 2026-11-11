import {readFile,writeFile} from 'node:fs/promises';
let s=await readFile('scripts/pages-immediate-editor-final-publication.mjs','utf8');
s=s.replaceAll('build/immediate-edit-preview-final/publication','build/one-save-review/publication').replaceAll('build/immediate-edit-preview-final/candidate-a891e07022384c69','build/one-save-review/candidate-9dce699595b724ea').replace('build/immediate-edit-preview-review/candidate-9371c1e32e8e0be9/_headers','build/immediate-edit-preview-final/candidate-a891e07022384c69/_headers').replace('flight_list_physical_cause_unresolved:true','physical_post_transport_unresolved:true,uncorrelated_aes_allocation_failures:2');
await writeFile('scripts/pages-one-save-publication.mjs',s,{flag:'wx'});
