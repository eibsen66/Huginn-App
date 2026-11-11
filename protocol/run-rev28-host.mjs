import {execFileSync} from 'node:child_process';import {writeFile} from 'node:fs/promises';
const out='build/rev28-review',w=p=>'/mnt/c/HuginnAPP/'+p;
const run=args=>execFileSync('wsl',['-d','Ubuntu','--exec',...args],{encoding:'utf8',windowsHide:true,timeout:120000});
run(['gcc','-std=c11','-D_POSIX_C_SOURCE=200112L','-Wall','-Wextra','-Werror','-fsanitize=address,undefined','-g',w(out+'/host.c'),'-lcrypto','-pthread','-o',w(out+'/host')]);
const log=run([w(out+'/host')]);await writeFile(out+'/host-tests.log',log);console.log(log);
