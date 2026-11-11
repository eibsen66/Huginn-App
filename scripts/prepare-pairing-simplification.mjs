import {readFile,writeFile,mkdir} from 'node:fs/promises';
const out='build/pairing-review/before';await mkdir(out,{recursive:true});
for(const f of ['entry.mjs','index.html'])await writeFile(out+'/'+f,await readFile('pwa/'+f),{flag:'wx'});
let s=await readFile('pwa/entry.mjs','utf8');
function edit(a,b){if(!s.includes(a))throw Error('Missing '+a);s=s.replace(a,b);}
edit('let connectionEpoch=0,actionEpoch=0;', 'let connectionEpoch=0,actionEpoch=0,qrIntent=false,pairingPending=false;');
edit("function interruptConnection(){connectionEpoch++;", "function interruptConnection(){qrIntent=false;pairingPending=false;connectionEpoch++;");
edit("el('open-connection').disabled=resuming||(busy&&connection==='connected');el('source-scan').disabled=!app||busy||resuming||resuming||!el('source-consent').checked;", "el('open-connection').disabled=pairingPending||resuming||(busy&&connection==='connected');el('source-scan').disabled=!app||busy||resuming||pairingPending||scanner.active;");
edit(" el('source-connect').disabled=!app||busy||resuming||resuming||scanner.active||!scannedPairing;el('source-connect').hidden=!scannedPairing;", " el('pairing-cancel').hidden=!pairingPending;el('pairing-cancel').disabled=!pairingPending;");
edit("['source-profile','source-origin','source-pairing','source-consent']", "['source-profile','source-origin','source-pairing']");
edit("el(id).disabled=busy||resuming||scanner.active;", "el(id).disabled=busy||resuming||pairingPending||scanner.active;");
edit("el('manual-connect').disabled=!app||busy||resuming;", "el('manual-connect').disabled=!app||busy||resuming||pairingPending||scanner.active;");
edit('settingsUI.controls(busy||resuming);', 'settingsUI.controls(busy||resuming||pairingPending);');
edit("el('update').disabled=busy||scanner.active", "el('update').disabled=busy||pairingPending||scanner.active");
const valid=s.indexOf(' onValid:'),validEnd=s.indexOf('\n onError:',valid);if(valid<0||validEnd<0)throw Error('valid seam');
s=s.slice(0,valid)+` onValid:(text,pair)=>{
  if(!qrIntent||pairingPending||busy||resuming)return;
  qrIntent=false;scannedPairing=text;el('source-pairing').value='';
  el('pairing-summary').textContent='HuginnEIS '+pair.source_device_id;
  feedback(t('QR-kóði sannreyndur. Tengist HuginnEIS…','QR validated. Connecting to HuginnEIS…'));
  action(connect);
 },`+s.slice(validEnd);
edit("onError:text=>{const code=", "onError:text=>{qrIntent=false;const code=");
edit("offerPairing();el('source-consent').focus();", "offerPairing();el('source-scan').focus();");
const consent=s.indexOf("el('source-consent').onchange="),consentEnd=s.indexOf('\n',consent);if(consent<0)throw Error('consent seam');s=s.slice(0,consent)+s.slice(consentEnd+1);
edit("disconnectSource();el('source-consent').checked=false;controls();", "disconnectSource();controls();");
const scan=s.indexOf("el('source-scan').onclick="),scanEnd=s.indexOf('\n',scan);
s=s.slice(0,scan)+`el('source-scan').onclick=()=>{
 if(busy||resuming||pairingPending||scanner.active)return;
 disconnectSource();
 if(el('source-profile').value!=='DEV_BROWSER_OS_TLS_V1'||el('source-origin').value!=='https://192.168.4.1'){
  feedback(t('QR-pörun krefst studds tengisniðs og réttrar slóðar HuginnEIS.','QR pairing requires the supported trust profile and exact HuginnEIS address.'),'PAIR_ORIGIN');return;
 }
 qrIntent=true;feedback('');el('source-scan').textContent=t('Skanna QR','Scan QR');scanner.start();
};`+s.slice(scanEnd);
edit("el('scanner-cancel').onclick=()=>{scanner.stop();", "el('scanner-cancel').onclick=()=>{qrIntent=false;scanner.stop();");
edit("el('source-cancel').onclick=", "el('pairing-cancel').onclick=()=>{disconnectSource();el('connection-panel').hidden=false;feedback(t('Pörun hætt. Þú getur skannað aftur.','Pairing canceled. You can scan again.'));};\nel('source-cancel').onclick=");
edit("async function connect(){\n const pairing=", "async function connect(){\n if(pairingPending)return;\n const pairing=");
edit("const epoch=connectionEpoch;let active;", "const epoch=connectionEpoch;let active;pairingPending=true;controls();");
edit("renderDevice(rows);el('connection-panel').hidden=true;}\n catch(e)", "renderDevice(rows);el('connection-panel').hidden=true;selectTab('huginn-tab');}\n catch(e)");
edit("if(!source?.hasAuthorization()){source?.close();source=null;offerPairing();}else feedback", "if(!source?.hasAuthorization()){source?.close();source=null;offerPairing();if(safeCode(e)==='AUTH_REQUIRED')feedback(t('Pörunarheimild er útrunnin eða afturkölluð. Skannaðu nýjan QR-kóða.','Pairing authorization expired or was revoked. Scan a fresh QR code.'),'AUTH_REQUIRED');}else feedback");
edit("}\nel('source-connect').onclick=()=>action(connect);el('manual-connect').onclick=()=>action(connect);", " finally{if(epoch===connectionEpoch){pairingPending=false;controls();}}\n}\nel('manual-connect').onclick=()=>action(connect);");
await writeFile('pwa/entry.mjs',s);
s=await readFile('pwa/index.html','utf8');
s=s.replace(/<label class="consent">.*?<\/label>/,'');
s=s.replace('<button id="source-scan" disabled>Skanna QR</button>','<button id="source-scan" disabled data-is="Skanna QR og tengjast" data-en="Scan QR and connect">Skanna QR og tengjast</button>');
s=s.replace('<button id="source-connect" hidden disabled>Tengja</button>', '<button id="pairing-cancel" hidden disabled data-is="Hætta við pörun" data-en="Cancel pairing">Hætta við pörun</button>');
s=s.replace('<option value="DEV_BROWSER_OS_TLS_V1">','<option value="DEV_BROWSER_OS_TLS_V1" selected>');
await writeFile('pwa/index.html',s);
