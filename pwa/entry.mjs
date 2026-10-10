import {openPwa,checkSize,requireFeatures,exportFile,FULL_ACK_GATE_PASS} from './adapter.mjs';
import {evidenceKey} from './flight-storage.mjs';
const el=id=>document.getElementById(id);
let app,catalog,busy=false,registration,updateRequested=false;
const message=text=>{el('message').textContent=text;};
function error(e){message('Stopped: '+(e?.message||String(e)));}
async function readFile(file){
  if(!file)throw new Error('CHOOSE_A_FILE');
  checkSize(file.size);return new Uint8Array(await file.arrayBuffer());
}
async function action(work){
  if(busy)return;busy=true;document.querySelectorAll('button,input').forEach(e=>e.disabled=true);
  try{await work();}catch(e){error(e);}finally{busy=false;document.querySelectorAll('button,input').forEach(e=>e.disabled=!app);}
}
function node(tag,text){const n=document.createElement(tag);n.textContent=text;return n;}
async function render(){
  const root=el('flights');root.replaceChildren();
  for(const flight of await app.list()){
    const key=evidenceKey(flight.metadata),card=node('article','');card.className='flight';
    card.append(node('h3',flight.metadata.filename+' · '+flight.metadata.state));
    const state=node('p','IMPORTED — reopening for validation…');state.className='state';card.append(state);
    card.append(node('pre','SHA-256: '+flight.metadata.physical_sha256+'\nBytes: '+flight.metadata.physical_bytes));
    const verify=node('button','Verify local');
    verify.onclick=()=>action(async()=>{await app.verify(key);state.textContent='VERIFIED LOCAL';message('CRC, metadata identity and full-file SHA-256 verified after reopen.');});
    const out=node('button','Prepare export'),share=node('button','Save / share original bytes');share.hidden=true;
    let payload;
    // A separate click preserves Web Share transient user activation.
    out.onclick=()=>action(async()=>{payload=await app.export(key);state.textContent='VERIFIED LOCAL';share.hidden=false;message('Export prepared. Tap Save / share original bytes.');});
    share.onclick=()=>action(async()=>{
      const result=await exportFile(payload);
      state.textContent=result.status;
      message('Export handed to the browser. Save completion and cloud retention are not confirmed. Re-import the saved file.');
    });
    const label=node('label','Re-import exported file'),input=document.createElement('input');
    input.type='file';input.accept='.FLG,.flg,application/octet-stream';
    input.onchange=()=>action(async()=>{const result=await app.reimport(key,await readFile(input.files[0]));state.textContent='VERIFIED LOCAL';message('BYTE-IDENTICAL ROUND-TRIP VERIFIED · SHA-256 '+result.sha256);input.value='';});
    label.append(input);card.append(verify,out,share,label);root.append(card);
    try{await app.verify(key);state.textContent='VERIFIED LOCAL';}catch(e){state.textContent='IMPORTED — VALIDATION FAILED';error(e);}
  }
  if(!root.children.length)root.append(node('p','No imported synthetic evidence.'));
}
async function initialize(){
  requireFeatures();
  const response=await fetch('./fixtures/catalog.json',{cache:'no-cache'});
  if(!response.ok)throw new Error('FIXTURE_CATALOG_UNAVAILABLE');
  catalog=await response.json();app=await openPwa({catalog});
  el('capabilities').textContent='Strict IndexedDB probe passed. Native/phone qualification unchanged. ACK gate: '+FULL_ACK_GATE_PASS;
  for(const f of catalog.fixtures){
    const li=node('li',''),a=node('a','Download synthetic '+f.label+' ('+f.metadata.physical_bytes+' bytes)');
    a.href='./fixtures/'+f.file;a.download=f.metadata.filename;li.append(a);el('fixtures').append(li);
  }
  el('import').disabled=false;el('persist').disabled=!navigator.storage?.persist;
  el('import').onchange=()=>action(async()=>{
    message('Importing and validating original bytes…');
    await app.import(await readFile(el('import').files[0]));
    message('IMPORTED → VERIFIED LOCAL. Database connection reopened and exact bytes revalidated.');
    el('import').value='';await render();
  });
  el('persist').onclick=()=>action(async()=>{
    const granted=await navigator.storage.persist();
    el('persistence').textContent=granted?'Browser persistence granted; user deletion and device loss remain possible.':'Browser persistence not granted. Export an independent copy.';
  });
  await render();
}
async function offline(){
  if(!navigator.serviceWorker){el('offline').textContent='Offline installation unsupported.';return;}
  registration=await navigator.serviceWorker.register('./sw.js',{scope:'./'});
  await navigator.serviceWorker.ready;
  // ready means activated; install populates the complete versioned cache first.
  el('offline').textContent='Offline app shell cached. Install, then test a cold launch with networking disabled.';
  function offer(){if(registration.waiting){el('update').hidden=false;}}
  registration.addEventListener('updatefound',()=>registration.installing?.addEventListener('statechange',offer));offer();
  el('update').onclick=()=>{
    if(busy||app?.isBusy()){message('Finish the current operation before updating.');return;}
    updateRequested=true;registration.waiting?.postMessage({type:'ACTIVATE_WHILE_IDLE'});el('update').hidden=true;
  };
  navigator.serviceWorker.addEventListener('message',event=>{if(event.data?.type==='UPDATE_BLOCKED_OTHER_WINDOWS'){updateRequested=false;el('update').hidden=false;message('Close other PWA windows before activating the update.');}});
  navigator.serviceWorker.addEventListener('controllerchange',()=>{if(updateRequested&&!busy)location.reload();});
}
offline().catch(e=>{el('offline').textContent='Offline cache unavailable: '+e.message;});
initialize().catch(error);
