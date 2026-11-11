import {readFile,writeFile,mkdir} from 'node:fs/promises';
await mkdir('build/reconnect-review/before',{recursive:true});
for(const name of ['entry.mjs','source.mjs','settings-ui.mjs','index.html'])await writeFile('build/reconnect-review/before/'+name,await readFile('pwa/'+name));
let s=await readFile('pwa/entry.mjs','utf8');
const change=(a,b)=>{if(!s.includes(a))throw Error('Missing seam '+a);s=s.replace(a,b);};
change("const settingsUI=bindSettings({getSource:()=>source,run:work=>action(work),onAuthorizationLost:()=>{source?.close();source=null;setConnection('failure');}});",`const t=(is,en)=>document.documentElement.lang.startsWith('is')?is:en;
let connectionEpoch=0,actionEpoch=0;
const settingsUI=bindSettings({getSource:()=>source,isConnected:()=>connection==='connected',run:work=>action(work),onConnectionFailure:()=>{source?.pause();settingsUI.suspend();setConnection('failure');},onAuthorizationLost:()=>{connectionEpoch++;source?.close();source=null;setConnection('failure');offerPairing();}});
function offerPairing(){el('connection-panel').hidden=false;feedback(t('Pörunarheimild er ekki tiltæk. Skannaðu nýjan QR-kóða á HuginnEIS.','Pairing authorization is unavailable. Scan a fresh QR code from HuginnEIS.'));}
function interruptConnection(){connectionEpoch++;actionEpoch++;busy=false;resuming=false;source?.pause();downloadController?.abort();settingsUI.suspend();}
function currentConnection(active,epoch){return source===active&&epoch===connectionEpoch&&!document.hidden;}`);
change("el('open-connection').hidden=connection==='connected';controls();",`el('open-connection').hidden=connection==='connected';el('open-connection').textContent=t(connection==='disconnected'&&!source?'Tengjast HuginnEIS':'Tengjast aftur',connection==='disconnected'&&!source?'Connect to HuginnEIS':'Reconnect');el('remote-list-state').textContent=connection==='connected'?'':t('Áður sóttur skráalisti — tengstu aftur áður en þú sækir skrár.','Previously retrieved file list — reconnect before downloading.');controls();`);
change("el('open-connection').disabled=busy;", "el('open-connection').disabled=resuming||(busy&&connection==='connected');");
change("for(const b of document.querySelectorAll('[data-source-unavailable=\"true\"]'))b.disabled=true;", "for(const b of document.querySelectorAll('[data-source-unavailable=\"true\"]'))b.disabled=true;for(const b of el('source-recordings').querySelectorAll('button'))b.disabled=busy||connection!=='connected'||b.dataset.sourceUnavailable==='true';");
change("async function action(work){if(busy)return;busy=true;controls();try{await work();}catch(e){error(e);}finally{busy=false;controls();}}", "async function action(work){if(busy)return;const epoch=actionEpoch;busy=true;controls();try{await work();}catch(e){if(epoch===actionEpoch)error(e);}finally{if(epoch===actionEpoch){busy=false;controls();}}}");
change("function disconnectSource(){scanner.stop();", "function disconnectSource(){interruptConnection();scanner.stop();");
change("el('open-connection').onclick=()=>{if(source?.hasAuthorization()){resumeSession();return;}el('connection-panel').hidden=false;el('source-consent').focus();};", "el('open-connection').onclick=()=>{if(source?.hasAuthorization()){resumeSession();return;}interruptConnection();offerPairing();el('source-consent').focus();};");
const start=s.indexOf('async function resumeSession()'),end=s.indexOf("window.addEventListener('pagehide'",start);if(start<0||end<0)throw Error('resume seam');
s=s.slice(0,start)+`async function resumeSession(){
 if(resuming||document.hidden)return;
 if(!source?.hasAuthorization()){offerPairing();return;}
 interruptConnection();const active=source,epoch=connectionEpoch;resuming=true;controls();setConnection('attempt');
 try{if(downloadTask)await downloadTask;if(!currentConnection(active,epoch))return;const rows=await active.list();if(!currentConnection(active,epoch))return;
  setConnection('authenticated');renderDevice(rows);el('connection-panel').hidden=true;feedback(t('Tenging endurheimt. Sæktu stillingar aftur áður en þú forskoðar breytingar.','Reconnected. Retrieve settings before previewing changes.'));
  if(suspended&&pendingDownload){const selected=rows.find(m=>m.session_id===pendingDownload.metadata.session_id);if(!selected)throw Error('SOURCE_CHANGED');suspended=false;await action(()=>runDownload(selected));}
 }catch(e){if(!currentConnection(active,epoch))return;setConnection('failure');feedback(t('Ekki náðist tenging. Veldu Tengjast aftur þegar Wi-Fi HuginnEIS er tiltækt.','Could not connect. Choose Reconnect when HuginnEIS Wi-Fi is available.'),safeCode(e));if(!active.hasAuthorization()){active.close();source=null;offerPairing();}}
 finally{if(epoch===connectionEpoch){resuming=false;controls();}}
}
`+s.slice(end);
change("function hideSession(){settingsUI.invalidate();", "function hideSession(){interruptConnection();");
change("async function runDownload(m){", "async function runDownload(m){\n if(connection!=='connected'||!source?.hasAuthorization())return;\n const epoch=connectionEpoch;");
change("onProgress:p=>{if(p.metadata", "onProgress:p=>{if(epoch!==connectionEpoch)return;if(p.metadata");
change("pendingDownload=null;await render();return true;", "if(epoch!==connectionEpoch)return false;pendingDownload=null;await render();return true;");
change("catch(e){const d=transferDiagnostic(e);", "catch(e){if(epoch!==connectionEpoch)return false;const d=transferDiagnostic(e);");
// Every reconnect invalidates settings previews; even file failures cannot leave an old apply enabled.
change("setConnection('failure');if(!activeSource?.hasAuthorization())", "settingsUI.suspend();setConnection('failure');if(!activeSource?.hasAuthorization())");
const cs=s.indexOf('async function connect(){'),ce=s.indexOf('function requestDelete(',cs);
s=s.slice(0,cs)+`async function connect(){
 const pairing=scannedPairing||el('source-pairing').value;
 if(!pairing){if(source?.hasAuthorization()){await resumeSession();return;}offerPairing();return;}
 interruptConnection();settingsUI.reset();scanner.stop();scannedPairing='';el('source-pairing').value='';el('pairing-summary').textContent='';source?.close();source=null;setConnection('attempt');feedback('');
 const epoch=connectionEpoch;let active;
 try{const origin=el('source-origin').value;active=source=createBrowserSource({origin,selectedOrigin:origin,profile:el('source-profile').value,pairing});const rows=await active.list();if(!currentConnection(active,epoch))return;setConnection('authenticated');renderDevice(rows);el('connection-panel').hidden=true;}
 catch(e){if(epoch!==connectionEpoch||active&&source!==active)return;setConnection('failure');if(!source?.hasAuthorization()){source?.close();source=null;offerPairing();}else feedback(t('Ekki náðist tenging. Veldu Tengjast aftur.','Could not connect. Choose Reconnect.'),safeCode(e));}
}
el('source-connect').onclick=()=>action(connect);el('manual-connect').onclick=()=>action(connect);
el('fetch-recordings').onclick=()=>action(async()=>{const active=source,epoch=connectionEpoch;if(!active)return;try{const rows=await active.list();if(!currentConnection(active,epoch))return;setConnection('authenticated');renderDevice(rows);el('device-files').scrollIntoView({block:'start'});}catch(e){if(!currentConnection(active,epoch))return;active.pause();settingsUI.suspend();if(!active.hasAuthorization()){active.close();source=null;offerPairing();}setConnection('failure');throw e;}});
`+s.slice(ce);
await writeFile('pwa/entry.mjs',s);
s=await readFile('pwa/index.html','utf8');s=s.replace('<p id="download-status"', '<p id="remote-list-state" role="status"></p><p id="download-status"');await writeFile('pwa/index.html',s);
s=await readFile('pwa/source.mjs','utf8');s=s.replace('lastRequestDiagnostic=null;const active','lastRequestDiagnostic=null,generation=0;const active');
s=s.replace("  active.add(timeout);",`  const requestGeneration=generation;
  const wait=async promise=>{let cancel;const aborted=new Promise((_,reject)=>{cancel=()=>reject(Object.assign(Error('CANCELLED'),{name:'AbortError'}));timeout.signal.addEventListener('abort',cancel,{once:true});if(timeout.signal.aborted)cancel();});try{return await Promise.race([promise,aborted]);}finally{timeout.signal.removeEventListener('abort',cancel);}};
  active.add(timeout);`);
s=s.replace('const r=await fetcher(', 'const r=await wait(fetcher(').replace("referrerPolicy:'no-referrer'});","referrerPolicy:'no-referrer'}));");
s=s.replaceAll("need(!closed&&!revoked&&!timeout.signal.aborted,'AUTH_REQUIRED');", "need(!closed&&!revoked&&requestGeneration===generation&&!timeout.signal.aborted,'AUTH_REQUIRED');");
s=s.replace('await reader.read()', 'await wait(reader.read())').replace('await reader.cancel().catch(()=>{});', 'reader.cancel().catch(()=>{});');
s=s.replace('pause(){for(', 'pause(){generation++;for(').replace("close(){closed=true;", "close(){generation++;closed=true;");
await writeFile('pwa/source.mjs',s);
