import {writeFile,mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
const out='build/one-save-review';await mkdir(out,{recursive:true});
const tests=['automatic-validation','validation-expiry','pwa-one-save-browser','flight-list-error-diagnostics','settings-read-diagnostics','reconnect-source','pwa-auto-pairing-browser','settings-body-boundaries','pwa-storage-integrity','pwa-update-recovery','pwa-icons','flight-evidence','settings-preview-lifecycle','settings-v2-protocol'].map(n=>'tests/'+n+'.test.mjs');
let text,code=0;try{text=execFileSync(process.execPath,['--test','--test-concurrency=1','--test-reporter=spec',...tests],{encoding:'utf8',windowsHide:true,timeout:240000});}catch(e){text=(e.stdout||'')+(e.stderr||'');code=e.status??1;}
await writeFile(out+'/final-focused-tests.log',text);console.log(text.slice(-1500));if(code)process.exitCode=code;
