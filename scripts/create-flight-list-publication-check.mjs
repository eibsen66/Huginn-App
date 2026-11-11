import {readFile,writeFile} from 'node:fs/promises';
let s=await readFile('scripts/pages-pairing-publication.mjs','utf8');
s=s.replace("import './verify-pairing-candidate.mjs';",'// Frozen inventory is checked separately before and after publication.');
s=s.replaceAll('build/pairing-review/publication','build/flight-list-error-review/publication').replaceAll('build/pairing-review/candidate-271f2c06c31e3889','build/flight-list-error-review/candidate-acc6cd5e4cb6e49d');
s=s.replace('build/reconnect-review/candidate-1902bcca0f2edc78/_headers','build/pairing-review/candidate-271f2c06c31e3889/_headers');
s=s.replace('settings_admission_unresolved:true','flight_list_physical_cause_unresolved:true');
await writeFile('scripts/pages-flight-list-publication.mjs',s,{flag:'wx'});
