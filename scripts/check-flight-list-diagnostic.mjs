import {execFileSync} from 'node:child_process';import {writeFile,mkdir} from 'node:fs/promises';
const out='build/flight-list-error-review';await mkdir(out,{recursive:true});
const tests=['flight-list-error-diagnostics','settings-read-diagnostics','reconnect-source','pwa-reconnect-browser','pwa-settings-browser','pwa-auto-pairing-browser','settings-body-boundaries','pwa-storage-integrity','pwa-update-recovery','pwa-icons','flight-evidence'].map(n=>'tests/'+n+'.test.mjs');
let log,code=0;try{log=execFileSync(process.execPath,['--test','--test-concurrency=1','--test-reporter=spec',...tests],{encoding:'utf8',windowsHide:true,timeout:180000});}catch(e){log=(e.stdout||'')+(e.stderr||'');code=e.status??1;}
await writeFile(out+'/focused-tests.log',log);console.log(log.slice(-6500));if(code)process.exitCode=code;
