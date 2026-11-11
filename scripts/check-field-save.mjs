import {writeFile,mkdir} from 'node:fs/promises';import {execFileSync} from 'node:child_process';
const out='build/field-save-review';await mkdir(out,{recursive:true});
const names=['field-save-protocol','pwa-field-save-browser','pwa-field-save-upgrade','flight-list-error-diagnostics','settings-read-diagnostics','reconnect-source','pwa-auto-pairing-browser','settings-body-boundaries','pwa-storage-integrity','pwa-icons','flight-evidence','settings-preview-lifecycle','settings-v2-protocol'];
let log,code=0;try{log=execFileSync(process.execPath,['--test','--test-concurrency=1','--test-reporter=spec',...names.map(n=>'tests/'+n+'.test.mjs')],{encoding:'utf8',windowsHide:true,timeout:240000});}catch(e){log=(e.stdout||'')+(e.stderr||'');code=e.status??1;}
await writeFile(out+'/focused-tests.log',log);console.log(log.slice(-2200));if(code)process.exitCode=code;
