import {readFile,writeFile} from 'node:fs/promises';
const p='build/one-save-review/final-focused-tests.log',b=await readFile(p);
if(b[0]===255&&b[1]===254){await writeFile(p+'.powershell-utf16',b,{flag:'wx'});await writeFile(p,b.subarray(2).toString('utf16le'));}
