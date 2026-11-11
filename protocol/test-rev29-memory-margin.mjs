// Supplement after linking: charge measured 520-byte static delta, plus
// 0/128/256 bytes of synthetic competition. Does not alter sealed build inputs.
import {readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
const out='build/rev29-review',w=p=>'/mnt/c/HuginnAPP/'+p;
let h=await readFile(out+'/host.c','utf8');
const old='for(size_t pressure=0;pressure<=512;pressure+=128)';
if(!h.includes(old))throw Error('Missing observed-heap cases');
h=h.replace(old,'for(size_t pressure=520;pressure<=776;pressure+=128)').replace('including up to 512-byte reserve/competition debit','including measured 520-byte reserve plus 0/128/256-byte competition debit');
await writeFile(out+'/memory-margin-host.c',h);
const run=args=>execFileSync('wsl',['-d','Ubuntu','--exec',...args],{encoding:'utf8',windowsHide:true,timeout:120000});
run(['gcc','-std=c11','-D_POSIX_C_SOURCE=200112L','-Wall','-Wextra','-Werror','-fsanitize=address,undefined','-g',w(out+'/memory-margin-host.c'),'-lcrypto','-pthread','-o',w(out+'/memory-margin-host')]);
const log=run([w(out+'/memory-margin-host')]);await writeFile(out+'/memory-margin-tests.log',log);console.log(log);
