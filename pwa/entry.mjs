import {bindAppUpdate} from './app-update.mjs';
import {preparationPresentation} from './download-progress.mjs';
import {runSequential,automaticCandidates} from './transfer-queue.mjs';
import {bindSettings} from './settings-ui.mjs';
import {transferDiagnostic} from './download-diagnostics.mjs';
import {createWakeGuard} from './wake-guard.mjs';
﻿import {createBrowserSource,checkTransferSize} from './source.mjs';
import {createPairingScanner,validateScannedPairing} from './pairing-scanner.mjs';
import {bindVersionInformation} from './version-info.mjs';
import {openPwa,checkSize,requireFeatures,prepareExportFile,exportFile,FULL_ACK_GATE_PASS} from './adapter.mjs';
import {evidenceKey} from './flight-storage.mjs';
import {displayUtc,friendlySize,isKnownFixture,connectionLabel,transitionConnection,safeCode,userError,recordingLabel,downloadFailureKind} from './ui-model.mjs';
const selectedRemote=new Set(),selectedLocal=new Map();let remoteRows=[],batchController=null,batchProgress=null,deleteKeys=[];let discardPending=false;
function batchPrefix(){return batchProgress?`${batchProgress.index+1}/${batchProgress.total} · ${batchProgress.current.filename} · `:'';}
async function downloadBatch(rows){
 if(!rows.length||batchController||downloadTask)return;
 batchController=new AbortController();
 try{
  const result=await runSequential(rows,runDownload,{signal:batchController.signal,onProgress:p=>{batchProgress=p;el('batch-status').textContent=`${p.completed}/${p.total} lokið · ${p.current.filename}`;}});
  el('batch-status').textContent=`${result.completed.length}/${result.total} lokið`+(result.failed?` · Stöðvað við ${result.failed.filename}; sjá Nánar.`:result.state==='COMPLETE'?' · Lokið.':' · Stöðvað.');
 }finally{batchController=null;batchProgress=null;controls();}
}
const APP_BUILD='__HUGINN_BUILD_ID__',HTML_BUILD=document.querySelector('meta[name="huginn-build"]')?.content;
const el=id=>document.getElementById(id),node=(tag,text)=>{const n=document.createElement(tag);n.textContent=text;return n;};
let app,catalog,busy=false,registration,updateRequested=false,source,downloadController,scannedPairing='',connection='disconnected',selectedLocalKey=null,pendingDownload=null,downloadTask=null,resuming=false,suspended=false;
el('download-selected').onclick=()=>action(()=>downloadBatch(remoteRows.filter(m=>selectedRemote.has(m.session_id))));
el('download-all').onclick=()=>action(()=>downloadBatch(automaticCandidates(remoteRows)));
el('delete-selected').onclick=()=>{
 if(busy||!selectedLocal.size)return;
 discardPending=false;deleteKeys=[...selectedLocal.values()].map(x=>x.key);selectedLocalKey=[...deleteKeys[0]];
 el('delete-filename').textContent=`${deleteKeys.length} valdar skrár`;el('delete-dialog').showModal();controls();
};
// Tabs hide existing DOM only: no source/session teardown or transfer cancellation.
function selectTab(id){for(const tab of document.querySelectorAll('.top-tabs [role=tab]')){const selected=tab.id===id;tab.setAttribute('aria-selected',String(selected));tab.tabIndex=selected?0:-1;el(tab.getAttribute('aria-controls')).hidden=!selected;}}
for(const tab of document.querySelectorAll('.top-tabs [role=tab]')){tab.addEventListener('click',()=>selectTab(tab.id));tab.addEventListener('keydown',event=>{const tabs=[...document.querySelectorAll('.top-tabs [role=tab]')];let i=tabs.indexOf(tab);if(event.key==='ArrowRight')i=(i+1)%tabs.length;else if(event.key==='ArrowLeft')i=(i+tabs.length-1)%tabs.length;else if(event.key==='Home')i=0;else if(event.key==='End')i=tabs.length-1;else return;event.preventDefault();selectTab(tabs[i].id);tabs[i].focus();});}
for(const node of document.querySelectorAll('[data-is][data-en]'))node.textContent=document.documentElement.lang.startsWith('is')?node.dataset.is:node.dataset.en;
document.getElementById('connection-guidance').textContent=document.documentElement.lang.startsWith('is')?'Á HuginnEIS: opnaðu Connectivity > Flight Courier og fylgdu pörunarleiðbeiningunum.':'On HuginnEIS, open Connectivity > Flight Courier, then follow the pairing instructions.';
const t=(is,en)=>document.documentElement.lang.startsWith('is')?is:en;
let activeDownloadSession=null,downloadAttemptId=0;const firstDownloadErrors=new Map();
const sessionUsable=()=>['connected','uncertain'].includes(connection);
let connectionEpoch=0,actionEpoch=0,qrIntent=false,pairingPending=false,qrRecoveryAvailable=false,manualAttempt=false;
const settingsUI=bindSettings({getSource:()=>source,isConnected:()=>connection==='connected',run:work=>action(work),onConnectionFailure:()=>{source?.pause('SETTINGS_FAILURE');settingsUI.suspend();setConnection('failure');},onAuthorizationLost:()=>{connectionEpoch++;source?.close();source=null;setConnection('failure');offerPairing();}});
function offerPairing(){el('connection-panel').hidden=false;feedback(t('Pörunarheimild er ekki tiltæk. Skannaðu nýjan QR-kóða á HuginnEIS.','Pairing authorization is unavailable. Scan a fresh QR code from HuginnEIS.'));}
function interruptConnection(reason='CONNECTION_REPLACED'){qrIntent=false;pairingPending=false;connectionEpoch++;actionEpoch++;busy=false;resuming=false;source?.pause(reason);downloadController?.abort(reason);settingsUI.suspend();}
function currentConnection(active,epoch){return source===active&&epoch===connectionEpoch&&!document.hidden;}
const wake=createWakeGuard();
function setConnection(event){connection=transitionConnection(connection,event);el('source-status').textContent=document.documentElement.lang.startsWith('is')?connectionLabel(connection):({connected:'Connected to HuginnEIS',uncertain:'Connection unconfirmed after a failed request',connecting:'Connecting to HuginnEIS…',lost:'Connection to HuginnEIS lost',disconnected:'Not connected to HuginnEIS'}[connection]);document.querySelector('.connection-card').dataset.state=connection;el('fetch-recordings').hidden=!sessionUsable();el('open-connection').hidden=connection==='connected'||!source?.hasAuthorization();el('open-connection').textContent=t('Tengjast aftur','Reconnect');el('source-scan').hidden=connection==='connected'||!!source?.hasAuthorization();el('remote-list-state').textContent=sessionUsable()?'':t('Áður sóttur skráalisti — tengstu aftur áður en þú sækir skrár.','Previously retrieved file list — reconnect before downloading.');controls();}
function controls(){
 if(connection==='connected')qrRecoveryAvailable=false;
 if(connection==='lost')qrRecoveryAvailable=true;
 for(const button of document.querySelectorAll('button,input,select'))button.disabled=busy;
 for(const tab of document.querySelectorAll('.top-tabs button'))tab.disabled=false;
 el('open-connection').disabled=pairingPending||(busy&&sessionUsable());el('source-scan').disabled=!app||busy||resuming||pairingPending||scanner.active;
 el('repair-qr').hidden=!qrRecoveryAvailable;el('repair-qr').disabled=!app||pairingPending||scanner.active;
 el('pairing-cancel').hidden=!pairingPending;el('pairing-cancel').disabled=!pairingPending;
 for(const id of ['source-profile','source-origin','source-pairing'])el(id).disabled=busy||resuming||pairingPending||scanner.active;
 el('manual-connect').disabled=!app||busy||resuming||pairingPending||scanner.active;el('open-manual').disabled=!app||busy||resuming||pairingPending||scanner.active;el('manual-close').disabled=false;el('import').disabled=!app||busy;el('persist').disabled=!app||busy||typeof navigator.storage?.persist!=='function';
 el('source-cancel').disabled=!downloadController;el('source-cancel').hidden=!downloadController;
 for(const b of document.querySelectorAll('[data-source-unavailable="true"]'))b.disabled=true;for(const b of el('source-recordings').querySelectorAll('button'))b.disabled=busy||resuming||!sessionUsable()||b.dataset.sourceUnavailable==='true'||b.dataset.session===activeDownloadSession;
 settingsUI.controls(busy||resuming||pairingPending);
 el('update').disabled=busy||pairingPending||scanner.active||!!scannedPairing||!!selectedLocalKey||app?.isBusy();
 el('fetch-update').disabled=el('fetch-update').dataset.updating==='1';
}
function feedback(text,code=''){el('message').textContent=text;el('manual-message').textContent=text;el('pairing-code').textContent=code||'Enginn villukóði.';el('technical-code').textContent=code;}
function error(e){const code=e?.name==='QuotaExceededError'?'QUOTA_EXCEEDED':safeCode(e);feedback(userError(code),code);el('local-message').textContent=userError(code);}
const scanner=createPairingScanner({video:el('scanner-video'),canvas:document.createElement('canvas'),
 validate:text=>validateScannedPairing(text,el('source-origin').value,el('source-profile').value),
 onValid:(text,pair)=>{
  if(!qrIntent||pairingPending||busy||resuming)return;
  qrIntent=false;scannedPairing=text;el('source-pairing').value='';
  el('pairing-summary').textContent='HuginnEIS '+pair.source_device_id;
  feedback(t('QR-kóði sannreyndur. Tengist HuginnEIS…','QR validated. Connecting to HuginnEIS…'));
  action(connect);
 },
 onError:text=>{qrIntent=false;const code=text.match(/\[(PAIR_[A-Z_]+)\]/)?.[1]||'CAMERA_OR_QR';feedback(code.startsWith('PAIR_')?t('QR-kóðinn er ógildur eða ekki studdur. Skannaðu aftur.','The pairing QR is invalid or unsupported. Scan again.'):t(text,'Could not read the QR code. Check camera permission and scan again.'),code);el('source-scan').textContent=t('Skanna aftur','Scan again');controls();},
 onZoom:range=>{el('camera-zoom-label').hidden=!range;if(range)for(const key of ['min','max','step','value'])el('camera-zoom')[key]=range[key];},onStatus:text=>el('scanner-status').textContent=text,onActive:active=>{el('scanner-panel').hidden=!active;if(active){wake.acquire();requestAnimationFrame(()=>el('scanner-panel').scrollIntoView({block:'start'}));}else if(!downloadController)wake.release();controls();}
});
async function action(work){if(busy)return;const epoch=actionEpoch;busy=true;controls();try{await work();}catch(e){if(epoch===actionEpoch)error(e);}finally{if(epoch===actionEpoch){busy=false;controls();}}}
async function readFile(file,{original=false}={}){if(!file)throw Error('CHOOSE_A_FILE');(original?checkTransferSize:checkSize)(file.size);return new Uint8Array(await file.arrayBuffer());}
function disconnectSource({keepDraft=false}={}){interruptConnection();scanner.stop();scannedPairing='';el('pairing-summary').textContent='';downloadController?.abort();source?.close();source=null;settingsUI.reset({keepDraft});el('source-pairing').value='';el('source-recordings').replaceChildren();el('device-files').hidden=true;pendingDownload=null;suspended=false;setConnection('disconnect');}
el('open-connection').onclick=()=>{if(source?.hasAuthorization()){if(resuming)interruptConnection();resumeSession();return;}interruptConnection();offerPairing();el('source-scan').focus();};
for(const id of ['source-origin','source-profile'])el(id).addEventListener('input',()=>{disconnectSource({keepDraft:true});controls();});
function startQrPairing({replace=false}={}){
 if((!replace&&(busy||resuming))||pairingPending||scanner.active)return;
 qrRecoveryAvailable=false;
 disconnectSource({keepDraft:true});
 el('connection-panel').hidden=false;
 if(el('source-profile').value!=='DEV_BROWSER_OS_TLS_V1'||el('source-origin').value!=='https://192.168.4.1'){
  feedback(t('QR-pörun krefst studds tengisniðs og réttrar slóðar HuginnEIS.','QR pairing requires the supported trust profile and exact HuginnEIS address.'),'PAIR_ORIGIN');return;
 }
 qrIntent=true;feedback('');el('source-scan').textContent=t('Skanna QR','Scan QR');scanner.start();
}
el('source-scan').onclick=()=>startQrPairing();
el('repair-qr').onclick=()=>startQrPairing({replace:true});
el('camera-zoom').oninput=()=>scanner.setZoom(Number(el('camera-zoom').value));
const sizeViewport=()=>document.documentElement.style.setProperty('--visible-height',(globalThis.visualViewport?.height||innerHeight)+'px');globalThis.visualViewport?.addEventListener('resize',sizeViewport);sizeViewport();
el('scanner-cancel').onclick=()=>{qrIntent=false;scanner.stop();feedback(t('Skönnun hætt.','Scanning canceled.'));controls();};
el('pairing-cancel').onclick=()=>{disconnectSource({keepDraft:true});el('connection-panel').hidden=false;feedback(t('Pörun hætt. Þú getur skannað aftur.','Pairing canceled. You can scan again.'));};
el('source-cancel').onclick=()=>{batchController?.abort('USER_CANCELLED');(()=>{suspended=false;pendingDownload=null;downloadController?.abort('USER_CANCELLED');})();};
function hideSession(reason){interruptConnection(reason);suspended=true;scanner.stop();downloadController?.abort();source?.pause();wake.release();setConnection('hidden');if(pendingDownload)el('download-status').textContent='Niðurhal í bið — opnaðu appið til að halda áfram.';}
async function resumeSession(){
 if(resuming||document.hidden)return;
 if(!source?.hasAuthorization()){offerPairing();return;}
 interruptConnection();const active=source,epoch=connectionEpoch,deadline=Date.now()+20000;resuming=true;controls();setConnection('attempt');feedback(t('Tengist HuginnEIS. Veldu Tengjast aftur til að hefja nýja tilraun ef þörf krefur.','Connecting to HuginnEIS. Choose Reconnect to start a new attempt if needed.'));
 const bounded=async promise=>{let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('CONNECTION_TIMEOUT')),Math.max(0,deadline-Date.now()));})]);}finally{clearTimeout(timer);}};
 try{if(downloadTask)await bounded(downloadTask);if(!currentConnection(active,epoch))return;const rows=await bounded(active.list());if(!currentConnection(active,epoch))return;
  setConnection('authenticated');renderDevice(rows);el('connection-panel').hidden=true;feedback(t('Tenging endurheimt. Sæktu stillingar aftur áður en þú forskoðar breytingar.','Reconnected. Retrieve settings before previewing changes.'));
  if(suspended&&pendingDownload){suspended=false;el('download-status').textContent='Niðurhal í bið. Veldu Sækja sjálfur til að halda áfram.';}
 }catch(e){if(!currentConnection(active,epoch))return;interruptConnection();setConnection('failure');feedback(t('Ekki náðist tenging. Veldu Tengjast aftur þegar Wi-Fi HuginnEIS er tiltækt.','Could not connect. Choose Reconnect when HuginnEIS Wi-Fi is available.'),safeCode(e));if(!active.hasAuthorization()){active.close();source=null;offerPairing();}}
 finally{if(epoch===connectionEpoch){resuming=false;controls();}}
}
window.addEventListener('pagehide',event=>{hideSession('PAGEHIDE');if(!event.persisted){settingsUI.reset();source?.close();source=null;scannedPairing='';el('source-pairing').value='';}});
function recoverVisible(){if(document.hidden)return;if(resuming)interruptConnection();resumeSession();}
document.addEventListener('visibilitychange',()=>{if(document.hidden)hideSession('DOCUMENT_HIDDEN');else recoverVisible();});
window.addEventListener('pageshow',event=>{if(event.persisted)recoverVisible();});
window.addEventListener('offline',()=>{if(!source)return;feedback(t('Vafrinn tilkynnti breytta netstöðu. Skráarbeiðni heldur áfram meðan framvinda berst frá HuginnEIS.','The browser reported a network status change. The file request continues while HuginnEIS makes progress.'));});
window.addEventListener('online',()=>{if(source&&connection!=='connected'&&!downloadTask&&!busy&&!batchController)recoverVisible();});
function detailBlock(metadata){const details=node('details',''),summary=node('summary','Nánar');details.append(summary,node('pre','SHA-256: '+metadata.physical_sha256+'\nBæti: '+metadata.physical_bytes+'\nTími: '+displayUtc(metadata.start_utc,{seconds:true})+'\nUppruni: '+metadata.source_device_id+'\nSession: '+metadata.session_id+'\nFlokkun: '+metadata.state));return details;}
function recordingSummary(m){return displayUtc(m.start_utc)+' · '+friendlySize(m.physical_bytes);}
function renderDevice(rows){remoteRows=rows;selectedRemote.clear();el('source-recordings').replaceChildren();el('device-files').hidden=false;for(const m of rows){const li=node('li','');li.dataset.session=m.session_id;li.append(node('h3',m.filename),node('p',recordingSummary(m)),node('p',recordingLabel(m)));const button=node('button','Sækja');button.dataset.session=m.session_id;button.dataset.sourceUnavailable=String(m.eligible!==true||!['COMPLETE','INCOMPLETE','PROVISIONAL'].includes(m.state));const note=node('p',''),details=detailBlock(m),diagnostic=node('pre','');note.className='file-progress';note.setAttribute('role','status');diagnostic.className='transfer-diagnostic';if(firstDownloadErrors.has(m.source_device_id+':'+m.session_id))diagnostic.textContent=JSON.stringify(firstDownloadErrors.get(m.source_device_id+':'+m.session_id),null,2);details.append(diagnostic);if(m.state==='INCOMPLETE')details.append(node('p','Skráin hefur ekki staðfest lok upptöku. Það þýðir ekki að hún sé ónýt eða að upptaka sé enn í gangi.'));if(button.dataset.sourceUnavailable==='true')note.textContent='Niðurhal ekki heimilt: '+(m.reason||m.state);button.onclick=()=>{if(downloadTask||downloadController){note.textContent='Niðurhal í gangi — bíddu eftir að þeirri skrá lýkur.';return;}if(m.state==='PROVISIONAL'&&!confirm('Sækja óstaðfesta upptöku?'))return;action(()=>runDownload(m));};const choose=node('input','');choose.type='checkbox';choose.setAttribute('aria-label','Velja '+m.filename);choose.disabled=button.dataset.sourceUnavailable==='true';choose.dataset.sourceUnavailable=button.dataset.sourceUnavailable;choose.onchange=()=>{if(choose.checked)selectedRemote.add(m.session_id);else selectedRemote.delete(m.session_id);};const choice=node('label','Velja skrá ');choice.append(choose);li.append(choice,button,note,details);el('source-recordings').append(li);}if(!rows.length)el('source-recordings').append(node('li','Engar skrár tiltækar frá HuginnEIS.'));controls();}
async function runDownload(m){
 if(!sessionUsable()||!source?.hasAuthorization()||downloadController||downloadTask)return;
 const epoch=connectionEpoch,attemptId=++downloadAttemptId,attemptStarted=performance.now();let firstError=null,uiRendering=false;
 const remember=error=>{if(!firstError){firstError=transferDiagnostic(error,{...(uiRendering?{stage:'UI_RENDER'}:{}),operation:'DOWNLOAD',attemptId,operationElapsedMs:Math.round(performance.now()-attemptStarted)});firstDownloadErrors.set(m.source_device_id+':'+m.session_id,firstError);if(firstDownloadErrors.size>64)firstDownloadErrors.delete(firstDownloadErrors.keys().next().value);}return firstError;};
 const row=[...el('source-recordings').children].find(li=>li.dataset.session===m.session_id),note=row?.querySelector('.file-progress'),diagnostic=row?.querySelector('.transfer-diagnostic');
 const old=pendingDownload?.metadata.session_id===m.session_id?pendingDownload:null;pendingDownload={metadata:m,identity:old?.identity||null};activeDownloadSession=m.session_id;downloadController=new AbortController();const controller=downloadController,activeSource=source;controls();el('source-progress').hidden=false;note&&(note.textContent='Sæki upplýsingar um valda skrá…');feedback('');if(diagnostic)diagnostic.textContent='';wake.acquire();
 const work=(async()=>{try{await app.download(activeSource,m.session_id,{signal:controller.signal,expectedIdentity:pendingDownload.identity,ownerSelected:m.state==='PROVISIONAL',onProgress:p=>{if(p.diagnostic){const first=remember({diagnostic:p.diagnostic});if(diagnostic&&row?.isConnected)diagnostic.textContent=JSON.stringify(first,null,2);}if(epoch!==connectionEpoch)return;if(p.metadata&&pendingDownload)pendingDownload.identity=p.metadata;const prep=preparationPresentation(p);const text=prep?prep.text:p.state==='VERIFIED LOCAL'?'Sótt og sannreynt':p.state==='VALIDATING'?'Sannprófa skrá…':p.state==='INCOMPLETE DOWNLOAD'?(suspended?'Niðurhal í bið — opnaðu appið til að halda áfram.':'Niðurhal ólokið'):p.state==='VALIDATION FAILED'?'Skráin stenst ekki sannprófun':'Sæki…';if(note)note.textContent=p.state==='DOWNLOADING'?text+' '+friendlySize(p.offset)+' / '+friendlySize(p.physical_bytes):text;el('download-status').textContent=batchPrefix()+text+(p.physical_bytes?' '+friendlySize(p.offset||0)+' / '+friendlySize(p.physical_bytes):'');if(prep&&prep.percent===null)el('source-progress').removeAttribute('value');else el('source-progress').value=prep?prep.percent:p.physical_bytes?100*p.offset/p.physical_bytes:0;if(p.diagnostic&&diagnostic)diagnostic.textContent=JSON.stringify(firstError,null,2);}});if(epoch!==connectionEpoch)return false;pendingDownload=null;uiRendering=true;await render();return true;}catch(e){const d=remember(e);if(diagnostic&&row?.isConnected)diagnostic.textContent=JSON.stringify(d,null,2);if(epoch!==connectionEpoch){if(note&&row?.isConnected)note.textContent='Niðurhal stöðvað. Sjá Nánar.';return false;}if(diagnostic)diagnostic.textContent=JSON.stringify(d,null,2);if(note)note.textContent=suspended?'Niðurhal í bið — opnaðu appið til að halda áfram.':d.code==='STORAGE_FULL'?'Geymsla símans er full.':({DETAIL:'Ekki tókst að lesa upplýsingar um skrána.',RANGE:'Ekki tókst að sækja næsta hluta skráarinnar. Athugaðu tenginguna og reyndu aftur.',COMMIT_RANGE:'Ekki tókst að vista skrána í símanum.',VALIDATION_PUBLICATION:'Skráin stenst ekki sannprófun eða vistun mistókst.',REOPEN:'Ekki tókst að enduropna og sannprófa afritið.'}[d.stage]||'Niðurhal mistókst. Sjá Nánar við skrána.');const kind=downloadFailureKind(d);if(['TIMEOUT','TRANSPORT_UNCONFIRMED'].includes(kind))setConnection('request_uncertain');feedback(kind==='TIMEOUT'?'Skráarbeiðnin rann út á tíma. Sjá Nánar; sambandsslit eru ekki staðfest.':kind==='TRANSPORT_UNCONFIRMED'?'Skráarbeiðni mistókst; tenging er óstaðfest. Sjá Nánar.':'Niðurhal valdrar skrár mistókst. Sjá Nánar við skrána.',d.code);if(!activeSource?.hasAuthorization()){settingsUI.suspend();source?.close();source=null;setConnection('failure');feedback('Heimild vantar. Skannaðu QR aftur til að tengjast.',d.code);}return false;}finally{if(downloadController===controller)downloadController=null;activeDownloadSession=null;el('source-progress').hidden=true;await wake.release();controls();}})();downloadTask=work;try{return await work;}finally{if(downloadTask===work)downloadTask=null;}
}
async function connect(){
 if(pairingPending)return;
 const pairing=scannedPairing||el('source-pairing').value;
 if(!pairing){if(source?.hasAuthorization()){await resumeSession();return;}offerPairing();return;}
 interruptConnection();settingsUI.reset({keepDraft:true});scanner.stop();scannedPairing='';el('source-pairing').value='';el('pairing-summary').textContent='';source?.close();source=null;setConnection('attempt');feedback('');
 const epoch=connectionEpoch;let active;pairingPending=true;controls();
 try{const origin=el('source-origin').value;active=source=createBrowserSource({origin,selectedOrigin:origin,profile:el('source-profile').value,pairing});const rows=await active.list();if(!currentConnection(active,epoch))return;setConnection('authenticated');renderDevice(rows);el('connection-panel').hidden=true;selectTab('huginn-tab');if(el('manual-dialog').open)closeManualPairing();}
 catch(e){if(epoch!==connectionEpoch||active&&source!==active)return;setConnection('failure');if(!source?.hasAuthorization()){source?.close();source=null;offerPairing();if(safeCode(e)==='AUTH_REQUIRED')feedback(t('Pörunarheimild er útrunnin eða afturkölluð. Skannaðu nýjan QR-kóða.','Pairing authorization expired or was revoked. Scan a fresh QR code.'),'AUTH_REQUIRED');else if(safeCode(e).startsWith('PAIR_'))feedback(t('Pörunarupplýsingar eru ógildar eða ekki studdar. Athugaðu gögnin frá HuginnEIS.','Pairing information is invalid or unsupported. Check the information from HuginnEIS.'),safeCode(e));}else feedback(t('Ekki náðist tenging. Veldu Tengjast aftur.','Could not connect. Choose Reconnect.'),safeCode(e));}
 finally{if(epoch===connectionEpoch){pairingPending=false;controls();}}
}
function closeManualPairing(cancel=false){if(cancel&&manualAttempt){disconnectSource({keepDraft:true});manualAttempt=false;}el('source-pairing').value='';el('manual-dialog').close();}
el('open-manual').onclick=()=>{el('manual-message').textContent='';el('manual-dialog').showModal();};
el('manual-close').onclick=()=>closeManualPairing(true);
el('manual-dialog').addEventListener('cancel',event=>{event.preventDefault();closeManualPairing(true);});
el('manual-connect').onclick=()=>{if(busy)return;const attempt={};manualAttempt=attempt;action(connect).finally(()=>{if(manualAttempt===attempt)manualAttempt=false;});};
el('fetch-recordings').onclick=()=>action(async()=>{const active=source,epoch=connectionEpoch;if(!active)return;try{const rows=await active.list();if(!currentConnection(active,epoch))return;setConnection('authenticated');renderDevice(rows);el('device-files').scrollIntoView({block:'start'});}catch(e){if(!currentConnection(active,epoch))return;active.pause('LIST_FAILURE');settingsUI.suspend();if(!active.hasAuthorization()){active.close();source=null;offerPairing();}setConnection('failure');if(active.hasAuthorization())feedback(t('Tenging rofnaði. Veldu Tengjast aftur.','Connection lost. Choose Reconnect.'),safeCode(e));}});
function requestDelete(key,m){if(busy||app?.isBusy())return;discardPending=false;selectedLocalKey=[...key];deleteKeys=[[...key]];el('delete-filename').textContent=m.filename;el('delete-dialog').showModal();el('delete-cancel').focus();controls();}
function cancelDelete(){discardPending=false;selectedLocalKey=null;el('delete-dialog').close();controls();}
el('delete-cancel').onclick=cancelDelete;el('delete-dialog').addEventListener('cancel',event=>{event.preventDefault();cancelDelete();});
el('delete-confirm').onclick=()=>{if(!selectedLocalKey||busy)return;const keys=deleteKeys.map(k=>[...k]),discard=discardPending;action(async()=>{try{if(discard)await app.discardStaging(keys[0]);else await app.removeLocalMany(keys);selectedLocal.clear();el('local-message').textContent='Afritinu var eytt úr símanum. Engin eyðing var send til annarra tækja.';await render();}finally{cancelDelete();}});};
async function render(){selectedLocal.clear();
 el('flights').replaceChildren();el('pending-downloads').replaceChildren();let normal=0;
 for(const flight of await app.list()){
  const m=flight.metadata,key=evidenceKey(m),card=node('article','');card.className='flight';card.append(node('h3',m.filename),node('p',recordingSummary(m)));const state=node('p','Sannprófa skrá…');state.className='state';card.append(state);if(m.state==='INCOMPLETE')card.append(node('p','Lok upptöku óstaðfest · niðurhal er heilt og sannreynt.'));if(m.state==='PROVISIONAL')card.append(node('p','Óstaðfest upptaka'));
  const exportButton=node('button','Undirbúa FLG-skrá'),share=node('button','Vista eða deila'),remove=node('button','Eyða úr símanum'),exportNote=node('p','');exportButton.disabled=true;exportButton.dataset.sourceUnavailable='true';share.hidden=true;let payload;const actions=node('div','');actions.className='record-actions';actions.append(exportButton,share,remove);card.append(actions,exportNote);
  const cancelExport=node('button','Hætta við undirbúning');cancelExport.hidden=true;cancelExport.dataset.exportCancel='true';actions.append(cancelExport);let exportController;
  cancelExport.onclick=()=>exportController?.abort();
  exportButton.onclick=()=>action(async()=>{
    payload=null;share.hidden=true;exportController=new AbortController();cancelExport.hidden=false;cancelExport.disabled=false;
    exportNote.textContent='Undirbý og sannprófa upprunalega FLG-skrá…';
    try{payload=await prepareExportFile(await app.export(key),{signal:exportController.signal,onProgress:p=>{exportNote.textContent='Undirbý FLG: '+friendlySize(p.bytes)+' / '+friendlySize(p.total);}});exportNote.textContent='FLG-skrá sannreynd: '+payload.physical_bytes+' bæti. Vistaðu eða deildu og opnaðu afritið síðan í Muninn í tölvunni. Bein netsending í Muninn er ekki tiltæk.';share.hidden=false;}
    catch(e){exportNote.textContent=e.name==='AbortError'?'Hætt við undirbúning. Skráin í símanum er óbreytt.':'Ekki tókst að undirbúa FLG-skrá. Ekkert var afhent. Skráin í símanum er óbreytt. ('+e.message+')';}
    finally{cancelExport.hidden=true;exportController=null;}
  });
  share.onclick=()=>action(async()=>{
    try{const result=await exportFile(payload);exportNote.textContent=result.status==='CANCELLED'?'Hætt við deilingu. Skráin í símanum er óbreytt.':result.route==='native-file-share'?'FLG-skrá afhent deilingarvalmynd. Móttaka í Muninn er ekki staðfest. Afritið í símanum er varðveitt.':'FLG-skrá afhent vafranum til vistunar. Ef forskoðun opnast er hún í öðrum glugga; lokaðu honum til að snúa aftur. Móttaka í Muninn er ekki staðfest.';}
    catch(e){exportNote.textContent='Afhending mistókst. Skráin í símanum er óbreytt. ('+e.message+')';}
  });remove.onclick=()=>requestDelete(key,m);
  const details=detailBlock(m),verify=node('button','Sannprófa aftur'),input=document.createElement('input'),label=node('label','Endurinnlestur til samanburðar');input.type='file';input.accept='.FLG,.flg,application/octet-stream';label.append(input);verify.onclick=()=>action(async()=>{await app.verify(key);state.textContent='Sótt og sannreynt';});input.onchange=()=>action(async()=>{await app.reimport(key,input.files[0]);input.value='';el('local-message').textContent='Endurinnlesin skrá er bæti fyrir bæti eins. Móttaka í Muninn er ekki staðfest.';});details.append(verify,label);card.append(details);
  const choose=node('input','');choose.type='checkbox';choose.setAttribute('aria-label','Velja '+m.filename);choose.onchange=()=>{const id=JSON.stringify(key);if(choose.checked)selectedLocal.set(id,{key:[...key],metadata:m});else selectedLocal.delete(id);};const choice=node('label','Velja skrá ');choice.append(choose);card.prepend(choice);normal++;el('flights').append(card);
  try{await app.status(key);state.textContent='Sótt og sannreynt';delete exportButton.dataset.sourceUnavailable;exportButton.disabled=false;}catch{state.textContent='Skráin stenst ekki sannprófun';exportButton.disabled=true;exportButton.dataset.sourceUnavailable='true';}
 }
 if(!normal)el('flights').append(node('p','Engar sóttar HuginnEIS-skrár í símanum enn.'));
 for(const d of await app.incomplete()){
  const row=node('p','Niðurhal ólokið · '+d.metadata.filename+' · '+friendlySize(d.committed_offset)+' af '+friendlySize(d.metadata.physical_bytes));
  if(d.phase==='STAGING'){const discard=node('button','Fjarlægja ólokið afrit');discard.onclick=()=>{if(busy||app?.isBusy())return;discardPending=true;selectedLocalKey=evidenceKey(d.metadata);deleteKeys=[[...selectedLocalKey]];el('delete-filename').textContent='Ólokið afrit · '+d.metadata.filename;el('delete-dialog').showModal();el('delete-cancel').focus();controls();};row.append(discard);}
  el('pending-downloads').append(row);
 }
}
async function initialize(){requireFeatures();const response=await fetch('./fixtures/catalog.json',{cache:'no-cache'});if(!response.ok)throw Error('FIXTURE_CATALOG_UNAVAILABLE');catalog=await response.json();app=await openPwa({catalog});el('capabilities').textContent='Strict IndexedDB probe passed. FULL_ACK_GATE_PASS = '+FULL_ACK_GATE_PASS;await app.removeKnownFixtures();el('persistence').textContent=typeof navigator.storage?.persist==='function'?t('Þú getur beðið vafrann um betri varðveislu skráa.','You can ask the browser to retain files more reliably.'):t('Þessi vafri styður ekki beiðni um betri varðveislu skráa. Geymdu sjálfstætt afrit.','This browser does not support this file retention request. Keep an independent backup.');
el('persist').onclick=()=>action(async()=>{try{const granted=await navigator.storage.persist();el('persistence').textContent=granted?t('Vafrinn samþykkti betri varðveislu skráa. Þetta er ekki öryggisafrit.','The browser granted improved file retention. This is not a backup.'):t('Vafrinn samþykkti ekki beiðnina. Geymdu sjálfstætt afrit mikilvægra skráa.','The browser did not grant the request. Keep an independent copy of important files.');}catch(e){error(e);el('persistence').textContent=t('Ekki tókst að athuga varðveislu skráa í vafranum. Geymdu sjálfstætt afrit.','Could not check file retention in the browser. Keep an independent backup.');}});await render();controls();if(sessionStorage.getItem('huginn-update-pending')==='1'){sessionStorage.removeItem('huginn-update-pending');el('update-panel').hidden=false;el('update-heading').textContent='Uppfærsla lokið';}}
async function offline(){if(!navigator.serviceWorker){el('offline').textContent='Offline-geymsla ekki tiltæk.';return;}registration=await navigator.serviceWorker.register('./sw.js',{scope:'./',updateViaCache:'none'});await navigator.serviceWorker.ready;el('offline').textContent='Offline app shell cached.';function offer(){if(registration.waiting){el('update-panel').hidden=false;el('update').hidden=false;controls();}}registration.addEventListener('updatefound',()=>registration.installing?.addEventListener('statechange',offer));offer();el('update').onclick=()=>{if(busy||app?.isBusy()||scanner.active||scannedPairing||selectedLocalKey){el('update-status').textContent='Ljúktu núverandi aðgerð fyrst.';return;}updateRequested=true;registration.waiting?.postMessage({type:'ACTIVATE_WHILE_IDLE'});el('update').hidden=true;el('update-status').textContent='Uppfæri HuginnAPP…';};navigator.serviceWorker.addEventListener('message',event=>{if(event.data?.type==='UPDATE_BLOCKED_OTHER_WINDOWS'){updateRequested=false;el('update').hidden=false;el('update-status').textContent='Lokaðu öðrum HuginnAPP-gluggum áður en þú uppfærir.';}});navigator.serviceWorker.addEventListener('controllerchange',()=>{if(updateRequested&&!busy){sessionStorage.setItem('huginn-update-pending','1');location.reload();}});}
bindAppUpdate({build:APP_BUILD,isBusy:()=>busy||!!downloadTask||!!batchController||resuming||pairingPending||scanner.active||!!scannedPairing||app?.isBusy(),onActivating:(active=true)=>{document.body.inert=active;},registration:async()=>registration||await navigator.serviceWorker.getRegistration()});
offline().catch(()=>{el('offline').textContent='Offline-geymsla ekki staðfest.';});initialize().catch(error);bindVersionInformation({appBuild:APP_BUILD,htmlBuild:HTML_BUILD});
