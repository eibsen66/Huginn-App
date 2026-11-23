// Package updates are independent of flight storage and transport.
const receiptCache='huginn-package-receipts-v1';
export async function onlinePackage(fetcher=fetch){
 const response=await fetcher('./build.json?update='+Date.now(),{cache:'no-store',signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw Error('NET_HTTP_'+response.status);
 const m=await response.json();
 if(m.schema!=='huginn.pwa.build'||!/^\d+\.\d+$/.test(m.revision)||!/^[a-f0-9]{16}$/.test(m.version)||!m.files?.['sw.js'])throw Error('INVALID_PACKAGE');
 return m;
}
export async function packageReceipt(build){
 const r=await(await caches.open(receiptCache)).match(new URL('./__package_receipt/'+build,location.href));
 return r?await r.json():null;
}
export function bindAppUpdate({build,isBusy,onActivating,registration}){
 const el=id=>document.getElementById(id),button=el('fetch-update');let running=false;
 const status=text=>{el('fetch-update-status').textContent=text;};
 const date=value=>value?new Date(value).toLocaleString():'Óþekkt';
 async function refresh(){
  const receipt=await packageReceipt(build).catch(()=>null);
  el('package-downloaded').textContent='Útgáfa sótt: '+date(receipt?.verifiedAt);
  try{const last=JSON.parse(localStorage.getItem('huginn-update-check'));el('last-update-check').textContent=last?'Síðasta uppfærsluleit: '+date(last.at)+' — '+last.result:'Síðasta uppfærsluleit: Óþekkt';}catch{}
 }
 function record(result){try{localStorage.setItem('huginn-update-check',JSON.stringify({at:new Date().toISOString(),result}));}catch{}refresh();}
 navigator.serviceWorker.addEventListener('message',event=>{
  if(event.data?.type==='PACKAGE_PROGRESS'&&running)status('Sæki og sannprófa uppfærslu: '+event.data.done+'/'+event.data.total);
  if(event.data?.type==='UPDATE_BLOCKED_OTHER_WINDOWS'&&running){status('Lokaðu öðrum HuginnAPP-gluggum og reyndu aftur.');record('Virkjun bíður annarra glugga.');}
 });
 button.onclick=async()=>{
  if(running)return;running=true;button.dataset.updating='1';button.disabled=true;let activating=false;
  try{
   status('Leita að nýjustu birtri útgáfu…');const latest=await onlinePackage();
   if(latest.version===build){status('Þú ert með nýjustu útgáfu.');record('Þú ert með nýjustu útgáfu.');return;}
   status('Sæki og sannprófa HuginnAPP Rev. '+latest.revision+'…');
   const reg=await registration();await reg.update();
   const worker=await new Promise((resolve,reject)=>{
    const installing=reg.installing;const started=Date.now();const timer=setInterval(()=>{
     if(reg.waiting){clearInterval(timer);resolve(reg.waiting);}
     else if(installing?.state==='redundant'||Date.now()-started>90000){clearInterval(timer);reject(Error('PACKAGE_INCOMPLETE'));}
    },100);
   });
   const {queryWorker}=await import('./version-info.mjs');const info=await queryWorker(worker,reg.scope);
   const receipt=await packageReceipt(latest.version);
   if(info.build!==latest.version||!receipt?.verifiedAt)throw Error('PACKAGE_NOT_VERIFIED');
   record('Nýr pakki sóttur og sannprófaður.');
   const deadline=Date.now()+120000;
   while(isBusy()){
    status('Uppfærsla tilbúin. Bíð eftir að niðurhali eða vistun ljúki.');
    if(Date.now()>deadline)throw Error('WAITING_FOR_IDLE');
    await new Promise(r=>setTimeout(r,250));
   }
   // Synchronous lock prevents a new action between the idle check and reload.
   onActivating();activating=true;status('Virkja sannprófaða uppfærslu…');
   const changed=new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(Error('ACTIVATION_BLOCKED')),15000);
    navigator.serviceWorker.addEventListener('controllerchange',()=>{clearTimeout(timer);resolve();},{once:true});
   });
   worker.postMessage({type:'ACTIVATE_WHILE_IDLE'});await changed;location.reload();
  }catch(e){
   const message=e.message==='WAITING_FOR_IDLE'?'Uppfærsla bíður. Ljúktu niðurhali eða vistun og veldu aftur Ná í uppfærslu.':e.message==='ACTIVATION_BLOCKED'?'Ekki tókst að virkja uppfærslu. Lokaðu öðrum HuginnAPP-gluggum. Fyrri útgáfa er áfram nothæf.':'Ekki tókst að sækja og staðfesta uppfærslu. Athugaðu internet og reyndu síðar. Fyrri útgáfa er áfram nothæf.';
   status(message);record(message+' ('+e.message+')');
  }finally{if(activating)onActivating(false);running=false;delete button.dataset.updating;button.disabled=false;}
 };
 refresh();
 navigator.serviceWorker.ready.then(refresh).catch(()=>{});
 navigator.serviceWorker.addEventListener('controllerchange',refresh);
}
