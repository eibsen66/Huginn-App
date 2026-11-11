import {bindSettings} from './settings-ui.mjs';
import {transferDiagnostic} from './download-diagnostics.mjs';
import {createWakeGuard} from './wake-guard.mjs';
﻿import {createBrowserSource,checkTransferSize} from './source.mjs';
import {createPairingScanner,validateScannedPairing} from './pairing-scanner.mjs';
import {bindVersionInformation} from './version-info.mjs';
import {openPwa,checkSize,requireFeatures,exportFile,FULL_ACK_GATE_PASS} from './adapter.mjs';
import {evidenceKey} from './flight-storage.mjs';
import {displayUtc,friendlySize,isKnownFixture,connectionLabel,transitionConnection,safeCode,userError,recordingLabel} from './ui-model.mjs';
const APP_BUILD='__HUGINN_BUILD_ID__',HTML_BUILD=document.querySelector('meta[name="huginn-build"]')?.content;
const el=id=>document.getElementById(id),node=(tag,text)=>{const n=document.createElement(tag);n.textContent=text;return n;};
let app,catalog,busy=false,registration,updateRequested=false,source,downloadController,scannedPairing='',connection='disconnected',selectedLocalKey=null,pendingDownload=null,downloadTask=null,resuming=false,suspended=false;
// Tabs hide existing DOM only: no source/session teardown or transfer cancellation.
function selectTab(id){for(const tab of document.querySelectorAll('.top-tabs [role=tab]')){const selected=tab.id===id;tab.setAttribute('aria-selected',String(selected));tab.tabIndex=selected?0:-1;el(tab.getAttribute('aria-controls')).hidden=!selected;}}
for(const tab of document.querySelectorAll('.top-tabs [role=tab]')){tab.addEventListener('click',()=>selectTab(tab.id));tab.addEventListener('keydown',event=>{const tabs=[...document.querySelectorAll('.top-tabs [role=tab]')];let i=tabs.indexOf(tab);if(event.key==='ArrowRight')i=(i+1)%tabs.length;else if(event.key==='ArrowLeft')i=(i+tabs.length-1)%tabs.length;else if(event.key==='Home')i=0;else if(event.key==='End')i=tabs.length-1;else return;event.preventDefault();selectTab(tabs[i].id);tabs[i].focus();});}
for(const node of document.querySelectorAll('[data-is][data-en]'))node.textContent=document.documentElement.lang.startsWith('is')?node.dataset.is:node.dataset.en;
document.getElementById('connection-guidance').textContent=document.documentElement.lang.startsWith('is')?'Á HuginnEIS: opnaðu Connectivity > Flight Courier og fylgdu pörunarleiðbeiningunum.':'On HuginnEIS, open Connectivity > Flight Courier, then follow the pairing instructions.';
const t=(is,en)=>document.documentElement.lang.startsWith('is')?is:en;
let connectionEpoch=0,actionEpoch=0,qrIntent=false,pairingPending=false,qrRecoveryAvailable=false,manualAttempt=false;
const settingsUI=bindSettings({getSource:()=>source,isConnected:()=>connection==='connected',run:work=>action(work),onConnectionFailure:()=>{source?.pause();settingsUI.suspend();setConnection('failure');},onAuthorizationLost:()=>{connectionEpoch++;source?.close();source=null;setConnection('failure');offerPairing();}});
function offerPairing(){el('connection-panel').hidden=false;feedback(t('Pörunarheimild er ekki tiltæk. Skannaðu nýjan QR-kóða á HuginnEIS.','Pairing authorization is unavailable. Scan a fresh QR code from HuginnEIS.'));}
function interruptConnection(){qrIntent=false;pairingPending=false;connectionEpoch++;actionEpoch++;busy=false;resuming=false;source?.pause();downloadController?.abort();settingsUI.suspend();}
function currentConnection(active,epoch){return source===active&&epoch===connectionEpoch&&!document.hidden;}
const wake=createWakeGuard();
function setConnection(event){connection=transitionConnection(connection,event);el('source-status').textContent=document.documentElement.lang.startsWith('is')?connectionLabel(connection):({connected:'Connected to HuginnEIS',connecting:'Connecting to HuginnEIS…',lost:'Connection to HuginnEIS lost',disconnected:'Not connected to HuginnEIS'}[connection]);document.querySelector('.connection-card').dataset.state=connection;el('fetch-recordings').hidden=connection!=='connected';el('open-connection').hidden=connection==='connected'||!source?.hasAuthorization();el('open-connection').textContent=t('Tengjast aftur','Reconnect');el('source-scan').hidden=connection==='connected'||!!source?.hasAuthorization();el('remote-list-state').textContent=connection==='connected'?'':t('Áður sóttur skráalisti — tengstu aftur áður en þú sækir skrár.','Previously retrieved file list — reconnect before downloading.');controls();}
function controls(){
 if(connection==='connected')qrRecoveryAvailable=false;
 if(connection==='lost')qrRecoveryAvailable=true;
 for(const button of document.querySelectorAll('button,input,select'))button.disabled=busy;
 for(const tab of document.querySelectorAll('.top-tabs button'))tab.disabled=false;
 el('open-connection').disabled=pairingPending||(busy&&connection==='connected');el('source-scan').disabled=!app||busy||resuming||pairingPending||scanner.active;
 el('repair-qr').hidden=!qrRecoveryAvailable;el('repair-qr').disabled=!app||pairingPending||scanner.active;
 el('pairing-cancel').hidden=!pairingPending;el('pairing-cancel').disabled=!pairingPending;
 for(const id of ['source-profile','source-origin','source-pairing'])el(id).disabled=busy||resuming||pairingPending||scanner.active;
 el('manual-connect').disabled=!app||busy||resuming||pairingPending||scanner.active;el('open-manual').disabled=!app||busy||resuming||pairingPending||scanner.active;el('manual-close').disabled=false;el('import').disabled=!app||busy;el('persist').disabled=!app||busy||typeof navigator.storage?.persist!=='function';
 el('source-cancel').disabled=!downloadController;el('source-cancel').hidden=!downloadController;
 for(const b of document.querySelectorAll('[data-source-unavailable="true"]'))b.disabled=true;for(const b of el('source-recordings').querySelectorAll('button'))b.disabled=busy||resuming||connection!=='connected'||b.dataset.sourceUnavailable==='true';
 settingsUI.controls(busy||resuming||pairingPending);
 el('update').disabled=busy||pairingPending||scanner.active||!!scannedPairing||!!selectedLocalKey||app?.isBusy();
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
el('source-cancel').onclick=()=>{suspended=false;pendingDownload=null;downloadController?.abort();};
function hideSession(){interruptConnection();suspended=true;scanner.stop();downloadController?.abort();source?.pause();wake.release();setConnection('hidden');if(pendingDownload)el('download-status').textContent='Niðurhal í bið — opnaðu appið til að halda áfram.';}
async function resumeSession(){
 if(resuming||document.hidden)return;
 if(!source?.hasAuthorization()){offerPairing();return;}
 interruptConnection();const active=source,epoch=connectionEpoch,deadline=Date.now()+20000;resuming=true;controls();setConnection('attempt');feedback(t('Tengist HuginnEIS. Veldu Tengjast aftur til að hefja nýja tilraun ef þörf krefur.','Connecting to HuginnEIS. Choose Reconnect to start a new attempt if needed.'));
 const bounded=async promise=>{let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('CONNECTION_TIMEOUT')),Math.max(0,deadline-Date.now()));})]);}finally{clearTimeout(timer);}};
 try{if(downloadTask)await bounded(downloadTask);if(!currentConnection(active,epoch))return;const rows=await bounded(active.list());if(!currentConnection(active,epoch))return;
  setConnection('authenticated');renderDevice(rows);el('connection-panel').hidden=true;feedback(t('Tenging endurheimt. Sæktu stillingar aftur áður en þú forskoðar breytingar.','Reconnected. Retrieve settings before previewing changes.'));
  if(suspended&&pendingDownload){const selected=rows.find(m=>m.session_id===pendingDownload.metadata.session_id);if(!selected)throw Error('SOURCE_CHANGED');suspended=false;await action(()=>runDownload(selected));}
 }catch(e){if(!currentConnection(active,epoch))return;interruptConnection();setConnection('failure');feedback(t('Ekki náðist tenging. Veldu Tengjast aftur þegar Wi-Fi HuginnEIS er tiltækt.','Could not connect. Choose Reconnect when HuginnEIS Wi-Fi is available.'),safeCode(e));if(!active.hasAuthorization()){active.close();source=null;offerPairing();}}
 finally{if(epoch===connectionEpoch){resuming=false;controls();}}
}
window.addEventListener('pagehide',event=>{hideSession();if(!event.persisted){settingsUI.reset();source?.close();source=null;scannedPairing='';el('source-pairing').value='';}});
function recoverVisible(){if(document.hidden)return;if(resuming)interruptConnection();resumeSession();}
document.addEventListener('visibilitychange',()=>{if(document.hidden)hideSession();else recoverVisible();});
window.addEventListener('pageshow',event=>{if(event.persisted)recoverVisible();});
window.addEventListener('offline',()=>{if(!source)return;interruptConnection();setConnection('failure');feedback(t('Net breyttist eða rofnaði. Farðu aftur á Wi-Fi HuginnEIS og veldu Tengjast aftur.','Network changed or disconnected. Return to HuginnEIS Wi-Fi and choose Reconnect.'));});
window.addEventListener('online',()=>{if(source&&connection!=='connected')recoverVisible();});
function detailBlock(metadata){const details=node('details',''),summary=node('summary','Nánar');details.append(summary,node('pre','SHA-256: '+metadata.physical_sha256+'\nBæti: '+metadata.physical_bytes+'\nTími: '+displayUtc(metadata.start_utc,{seconds:true})+'\nUppruni: '+metadata.source_device_id+'\nSession: '+metadata.session_id+'\nFlokkun: '+metadata.state));return details;}
function recordingSummary(m){return displayUtc(m.start_utc)+' · '+friendlySize(m.physical_bytes);}
function renderDevice(rows){el('source-recordings').replaceChildren();el('device-files').hidden=false;for(const m of rows){const li=node('li','');li.dataset.session=m.session_id;li.append(node('h3',m.filename),node('p',recordingSummary(m)),node('p',recordingLabel(m)));const button=node('button','Sækja');button.dataset.sourceUnavailable=String(m.eligible!==true||!['COMPLETE','INCOMPLETE','PROVISIONAL'].includes(m.state));const note=node('p',''),details=detailBlock(m),diagnostic=node('pre','');note.className='file-progress';note.setAttribute('role','status');diagnostic.className='transfer-diagnostic';details.append(diagnostic);if(m.state==='INCOMPLETE')details.append(node('p','Skráin hefur ekki staðfest lok upptöku. Það þýðir ekki að hún sé ónýt eða að upptaka sé enn í gangi.'));if(button.dataset.sourceUnavailable==='true')note.textContent='Niðurhal ekki heimilt: '+(m.reason||m.state);button.onclick=()=>{if(m.state==='PROVISIONAL'&&!confirm('Sækja óstaðfesta upptöku?'))return;action(()=>runDownload(m));};li.append(button,note,details);el('source-recordings').append(li);}if(!rows.length)el('source-recordings').append(node('li','Engar skrár tiltækar frá HuginnEIS.'));controls();}
async function runDownload(m){
 if(connection!=='connected'||!source?.hasAuthorization())return;
 const epoch=connectionEpoch;
 const row=[...el('source-recordings').children].find(li=>li.dataset.session===m.session_id),note=row?.querySelector('.file-progress'),diagnostic=row?.querySelector('.transfer-diagnostic');
 const old=pendingDownload?.metadata.session_id===m.session_id?pendingDownload:null;pendingDownload={metadata:m,identity:old?.identity||null};downloadController=new AbortController();const controller=downloadController,activeSource=source;controls();el('source-progress').hidden=false;note&&(note.textContent='Sæki…');wake.acquire();
 const work=(async()=>{try{await app.download(activeSource,m.session_id,{signal:controller.signal,expectedIdentity:pendingDownload.identity,ownerSelected:m.state==='PROVISIONAL',onProgress:p=>{if(epoch!==connectionEpoch)return;if(p.metadata&&pendingDownload)pendingDownload.identity=p.metadata;const text=p.state==='VERIFIED LOCAL'?'Sótt og sannreynt':p.state==='VALIDATING'?'Sannprófa skrá…':p.state==='INCOMPLETE DOWNLOAD'?(suspended?'Niðurhal í bið — opnaðu appið til að halda áfram.':'Niðurhal ólokið'):p.state==='VALIDATION FAILED'?'Skráin stenst ekki sannprófun':'Sæki…';if(note)note.textContent=text;el('download-status').textContent=text;el('source-progress').value=p.physical_bytes?100*p.offset/p.physical_bytes:0;if(p.diagnostic&&diagnostic)diagnostic.textContent=JSON.stringify(p.diagnostic,null,2);}});if(epoch!==connectionEpoch)return false;pendingDownload=null;await render();return true;}catch(e){if(epoch!==connectionEpoch)return false;const d=transferDiagnostic(e);if(diagnostic)diagnostic.textContent=JSON.stringify(d,null,2);if(note)note.textContent=suspended?'Niðurhal í bið — opnaðu appið til að halda áfram.':d.code==='STORAGE_FULL'?'Geymsla símans er full.':({DETAIL:'Ekki tókst að lesa upplýsingar um skrána.',RANGE:'Ekki tókst að sækja næsta hluta skráarinnar. Athugaðu tenginguna og reyndu aftur.',COMMIT_RANGE:'Ekki tókst að vista skrána í símanum.',VALIDATION_PUBLICATION:'Skráin stenst ekki sannprófun eða vistun mistókst.',REOPEN:'Ekki tókst að enduropna og sannprófa afritið.'}[d.stage]||'Niðurhal mistókst. Sjá Nánar við skrána.');settingsUI.suspend();setConnection('failure');if(!activeSource?.hasAuthorization()){source?.close();source=null;feedback('Skannaðu QR aftur til að tengjast.',d.code);}return false;}finally{downloadController=null;el('source-progress').hidden=true;await wake.release();controls();}})();downloadTask=work;try{return await work;}finally{if(downloadTask===work)downloadTask=null;}
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
el('fetch-recordings').onclick=()=>action(async()=>{const active=source,epoch=connectionEpoch;if(!active)return;try{const rows=await active.list();if(!currentConnection(active,epoch))return;setConnection('authenticated');renderDevice(rows);el('device-files').scrollIntoView({block:'start'});}catch(e){if(!currentConnection(active,epoch))return;active.pause();settingsUI.suspend();if(!active.hasAuthorization()){active.close();source=null;offerPairing();}setConnection('failure');if(active.hasAuthorization())feedback(t('Tenging rofnaði. Veldu Tengjast aftur.','Connection lost. Choose Reconnect.'),safeCode(e));}});
function requestDelete(key,m){if(busy||app?.isBusy())return;selectedLocalKey=[...key];el('delete-filename').textContent=m.filename;el('delete-dialog').showModal();el('delete-cancel').focus();controls();}
function cancelDelete(){selectedLocalKey=null;el('delete-dialog').close();controls();}
el('delete-cancel').onclick=cancelDelete;el('delete-dialog').addEventListener('cancel',event=>{event.preventDefault();cancelDelete();});
el('delete-confirm').onclick=()=>{if(!selectedLocalKey||busy)return;const key=[...selectedLocalKey];action(async()=>{try{await app.removeLocal(key);el('local-message').textContent='Afritinu var eytt úr símanum. Engin eyðing var send til annarra tækja.';await render();}finally{cancelDelete();}});};
async function render(){
 el('flights').replaceChildren();el('fixture-flights').replaceChildren();el('pending-downloads').replaceChildren();let fixtures=0,normal=0;
 for(const flight of await app.list()){
  const m=flight.metadata,key=evidenceKey(m),card=node('article','');card.className='flight';card.append(node('h3',m.filename),node('p',recordingSummary(m)));const state=node('p','Sannprófa skrá…');state.className='state';card.append(state);if(m.state==='INCOMPLETE')card.append(node('p','Lok upptöku óstaðfest · niðurhal er heilt og sannreynt.'));if(m.state==='PROVISIONAL')card.append(node('p','Óstaðfest upptaka'));
  const exportButton=node('button','Senda í Muninn'),share=node('button','Vista eða deila'),remove=node('button','Eyða úr símanum'),exportNote=node('p','');share.hidden=true;let payload;const actions=node('div','');actions.className='record-actions';actions.append(exportButton,share,remove);card.append(actions,exportNote);
  exportButton.onclick=()=>action(async()=>{payload=await app.export(key);exportNote.textContent='Skrá tilbúin. Vistaðu eða deildu skránni og opnaðu hana síðan í Muninn í tölvunni.';share.hidden=false;});
  share.onclick=()=>action(async()=>{await exportFile(payload);exportNote.textContent='Afhending í vafra framkvæmd. Móttaka í Muninn hefur ekki verið staðfest. Afritinu í símanum er haldið.';});remove.onclick=()=>requestDelete(key,m);
  const details=detailBlock(m),verify=node('button','Sannprófa aftur'),input=document.createElement('input'),label=node('label','Endurinnlestur til samanburðar');input.type='file';input.accept='.FLG,.flg,application/octet-stream';label.append(input);verify.onclick=()=>action(async()=>{await app.verify(key);state.textContent='Sótt og sannreynt';});input.onchange=()=>action(async()=>{await app.reimport(key,await readFile(input.files[0],{original:true}));input.value='';el('local-message').textContent='Endurinnlesin skrá er bæti fyrir bæti eins. Móttaka í Muninn er ekki staðfest.';});details.append(verify,label);card.append(details);
  if(isKnownFixture(m,catalog)){fixtures++;el('fixture-flights').append(card);}else{normal++;el('flights').append(card);}
  try{await app.verify(key);state.textContent='Sótt og sannreynt';}catch{state.textContent='Skráin stenst ekki sannprófun';exportButton.disabled=true;exportButton.dataset.sourceUnavailable='true';}
 }
 el('fixture-count').textContent='('+fixtures+')';el('test-records').hidden=!fixtures;if(!normal)el('flights').append(node('p','Engar sóttar HuginnEIS-skrár í símanum enn.'));
 for(const d of await app.incomplete())el('pending-downloads').append(node('p','Niðurhal ólokið · '+d.metadata.filename+' · '+friendlySize(d.committed_offset)+' af '+friendlySize(d.metadata.physical_bytes)));
}
async function initialize(){requireFeatures();const response=await fetch('./fixtures/catalog.json',{cache:'no-cache'});if(!response.ok)throw Error('FIXTURE_CATALOG_UNAVAILABLE');catalog=await response.json();app=await openPwa({catalog});el('capabilities').textContent='Strict IndexedDB probe passed. FULL_ACK_GATE_PASS = '+FULL_ACK_GATE_PASS;for(const f of catalog.fixtures){const li=node('li',''),a=node('a','Prófunarskrá '+f.label+' · '+friendlySize(f.metadata.physical_bytes));a.href='./fixtures/'+f.file;a.download=f.metadata.filename;li.append(a);el('fixtures').append(li);}el('import').onchange=()=>action(async()=>{await app.import(await readFile(el('import').files[0]));el('import').value='';await render();});el('persistence').textContent=typeof navigator.storage?.persist==='function'?t('Þú getur beðið vafrann um betri varðveislu skráa.','You can ask the browser to retain files more reliably.'):t('Þessi vafri styður ekki beiðni um betri varðveislu skráa. Geymdu sjálfstætt afrit.','This browser does not support this file retention request. Keep an independent backup.');
el('persist').onclick=()=>action(async()=>{try{const granted=await navigator.storage.persist();el('persistence').textContent=granted?t('Vafrinn samþykkti betri varðveislu skráa. Þetta er ekki öryggisafrit.','The browser granted improved file retention. This is not a backup.'):t('Vafrinn samþykkti ekki beiðnina. Geymdu sjálfstætt afrit mikilvægra skráa.','The browser did not grant the request. Keep an independent copy of important files.');}catch(e){error(e);el('persistence').textContent=t('Ekki tókst að athuga varðveislu skráa í vafranum. Geymdu sjálfstætt afrit.','Could not check file retention in the browser. Keep an independent backup.');}});await render();controls();if(sessionStorage.getItem('huginn-update-pending')==='1'){sessionStorage.removeItem('huginn-update-pending');el('update-panel').hidden=false;el('update-heading').textContent='Uppfærsla lokið';}}
async function offline(){if(!navigator.serviceWorker){el('offline').textContent='Offline-geymsla ekki tiltæk.';return;}registration=await navigator.serviceWorker.register('./sw.js',{scope:'./'});await navigator.serviceWorker.ready;el('offline').textContent='Offline app shell cached.';function offer(){if(registration.waiting){el('update-panel').hidden=false;el('update').hidden=false;controls();}}registration.addEventListener('updatefound',()=>registration.installing?.addEventListener('statechange',offer));offer();el('update').onclick=()=>{if(busy||app?.isBusy()||scanner.active||scannedPairing||selectedLocalKey){el('update-status').textContent='Ljúktu núverandi aðgerð fyrst.';return;}updateRequested=true;registration.waiting?.postMessage({type:'ACTIVATE_WHILE_IDLE'});el('update').hidden=true;el('update-status').textContent='Uppfæri HuginnAPP…';};navigator.serviceWorker.addEventListener('message',event=>{if(event.data?.type==='UPDATE_BLOCKED_OTHER_WINDOWS'){updateRequested=false;el('update').hidden=false;el('update-status').textContent='Lokaðu öðrum HuginnAPP-gluggum áður en þú uppfærir.';}});navigator.serviceWorker.addEventListener('controllerchange',()=>{if(updateRequested&&!busy){sessionStorage.setItem('huginn-update-pending','1');location.reload();}});}
offline().catch(()=>{el('offline').textContent='Offline-geymsla ekki staðfest.';});initialize().catch(error);bindVersionInformation({appBuild:APP_BUILD,htmlBuild:HTML_BUILD});
