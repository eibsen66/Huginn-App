import {readFile,writeFile} from 'node:fs/promises';
let s=await readFile('scripts/pages-one-save-publication.mjs','utf8');
s=s.replaceAll('build/one-save-review/publication','build/field-save-review/publication').replaceAll('build/one-save-review/candidate-9dce699595b724ea','build/field-save-review/candidate-3f1a35d5e2fe39bd').replace('build/immediate-edit-preview-final/candidate-a891e07022384c69/_headers','build/one-save-review/candidate-9dce699595b724ea/_headers');
await writeFile('scripts/pages-field-save-publication.mjs',s,{flag:'wx'});
