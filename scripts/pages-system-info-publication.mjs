// Established GET-only identity, rollback and public-asset checks for this release.
import {readFile} from 'node:fs/promises';
let source=await readFile(new URL('./pages-freshness-publication.mjs',import.meta.url),'utf8');
source=source.replaceAll('build/freshness-review/publication','build/system-info-review/publication')
 .replaceAll('build/freshness-review/candidate-efbccf3990a4390c','build/system-info-review/candidate-6a2d2ea1505b8acf')
 .replaceAll('build/field-save-review/candidate-3f1a35d5e2fe39bd/_headers','build/system-info-review/candidate-6a2d2ea1505b8acf/_headers');
try{await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));}
catch(e){console.error(e.message);process.exitCode=1;}
