import {execFileSync} from 'node:child_process';import {writeFile} from 'node:fs/promises';
const out='build/rev28-review',sdk='/mnt/c/esp/v5.5.2/esp-idf/components/heap/tlsf';
const run=args=>execFileSync('wsl',['-d','Ubuntu','--exec',...args],{encoding:'utf8',windowsHide:true});
run(['gcc','-std=c11','-Wall','-Wextra','-Werror','-fsanitize=address,undefined','-I'+sdk+'/include','/mnt/c/HuginnAPP/protocol/rev28-tlsf-host.c',sdk+'/tlsf.c','-o','/mnt/c/HuginnAPP/'+out+'/tlsf-host']);
const text=run(['/mnt/c/HuginnAPP/'+out+'/tlsf-host']);await writeFile(out+'/tlsf-tests.log',text);console.log(text);
console.log(execFileSync('C:/Espressif/tools/python/v5.5.2/venv/Scripts/python.exe',['-B','protocol/check-rev28-syntax.py'],{encoding:'utf8',windowsHide:true}));
