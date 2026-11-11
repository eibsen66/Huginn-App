import {readFile,writeFile} from 'node:fs/promises';
const p='scripts/prepare-one-save-review.mjs';let s=await readFile(p,'utf8');
s=s.replaceAll("out+'/candidate-review.json'","out+'/final-candidate-review.json'").replace("'/rollback-'+baseline.version","'/rollback-final-'+baseline.version");
await writeFile(p,s);
