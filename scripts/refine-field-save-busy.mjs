import {readFile,writeFile} from 'node:fs/promises';
for(const p of ['pwa/settings-ui.mjs','protocol/field-save-ui.js']){
 let s=await readFile(p,'utf8');
 s=s.replace("let session=null,owner=null,uiEpoch=0,saving=false,stage=", "let appBusy=false;let session=null,owner=null,uiEpoch=0,saving=false,stage=");
 s=s.replace('function controls(externalBusy=false){','function controls(externalBusy){\n  if(typeof externalBusy===\'boolean\')appBusy=externalBusy;');
 s=s.replace('const live=connected(),busy=saving||externalBusy;','const live=connected(),busy=saving||appBusy;').replace('(!saving&&externalBusy)','(!saving&&appBusy)');
 s=s.replace('if(saving||!connected()||uncertain()||!ids.length)return;','if(saving||appBusy||!connected()||uncertain()||!ids.length)return;');
 s=s.replace("const message=s=>el('settings-message').textContent=s;", "const message=s=>el('settings-message').textContent=s;\n const displayValue=(f,v)=>f?.options?(f.options.find(o=>equal(o.value,v))?.label??String(v)):typeof v==='boolean'?t(v?'Já':'Nei',v?'Yes':'No'):f?.type==='integer'?String(v/f.scale)+(f.unit||''):String(v??'—');");
 s=s.replaceAll("String(actual?.value??'—')","displayValue(actual,actual?.value)").replaceAll("String(f?.value??'—')","displayValue(f,f?.value)");
 await writeFile(p,s);
}
