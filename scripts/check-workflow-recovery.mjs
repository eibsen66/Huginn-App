import {execFileSync} from 'node:child_process';import {readFile,writeFile,mkdir} from 'node:fs/promises';
const out='build/workflow-recovery-review';await mkdir(out,{recursive:true});
// Keep evidence of the two baseline failures, distinct from final passing tests.
for(const [name,extra]of [['unchanged-preview',{HUGINN_PREVIEW_BASELINE_ONLY:'1'}],['pending-reconnect',{HUGINN_NETWORK_REPRO_ONLY:'1'}]]){
 let text,code=0;try{text=execFileSync(process.execPath,['--test','tests/pwa-network-return-browser.test.mjs'],{encoding:'utf8',windowsHide:true,timeout:60000,env:{...process.env,HUGINN_NETWORK_BASELINE:'1',...extra}});}catch(e){text=(e.stdout||'')+(e.stderr||'');code=e.status??1;}
 await writeFile(out+'/baseline-'+name+'.log',text);if(code===0)throw Error('Baseline unexpectedly passed '+name);
}
const tests=['flight-list-error-diagnostics','settings-read-diagnostics','reconnect-source','pwa-reconnect-browser','pwa-settings-browser','pwa-auto-pairing-browser','settings-body-boundaries','pwa-storage-integrity','pwa-update-recovery','pwa-icons','flight-evidence','pwa-network-return-browser','settings-preview-lifecycle','settings-workflow-help','settings-v2-protocol'].map(n=>'tests/'+n+'.test.mjs');
let text,code=0;try{text=execFileSync(process.execPath,['--test','--test-concurrency=1','--test-reporter=spec',...tests],{encoding:'utf8',windowsHide:true,timeout:180000});}catch(e){text=(e.stdout||'')+(e.stderr||'');code=e.status??1;}
await writeFile(out+'/focused-tests.log',text);console.log(text.slice(-4000));if(code)process.exitCode=code;
