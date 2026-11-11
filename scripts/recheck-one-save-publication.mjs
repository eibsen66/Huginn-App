// Reuse the GET-only verifier without overwriting historical publication evidence.
import {readFile} from 'node:fs/promises';
let code=await readFile(new URL('./pages-one-save-publication.mjs',import.meta.url),'utf8');
code=code.replace("const path=out+'/'+(after?'after':'before')+'.json';","const path=out+'/recheck-20261107-'+Date.now()+'.json';");
if(!process.argv.includes('--after'))process.argv.push('--after');
try{await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));}
catch(e){console.error(e.message);process.exitCode=1;}
