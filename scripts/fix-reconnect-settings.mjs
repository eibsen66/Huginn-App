import {readFile,writeFile} from 'node:fs/promises';
let s=await readFile('pwa/settings-ui.mjs','utf8');
s=s.replace('bindSettings({getSource,run,onAuthorizationLost})','bindSettings({getSource,isConnected=()=>true,run,onAuthorizationLost,onConnectionFailure})');
s=s.replace('let session=null,owner=null,uiEpoch=0;', 'let session=null,owner=null,uiEpoch=0,savedDraft=null;');
s=s.replace('const connected=owner===getSource()&&owner?.hasAuthorization();','const connected=isConnected()&&owner===getSource()&&owner?.hasAuthorization();');
s=s.replace("||!session?.draft||['invalid','incomplete'].includes(session.state)","||!session?.draft||!['loaded','pending','previewed','saved'].includes(session.state)");
s=s.replace("function reset(){uiEpoch++;", "function reset({keepDraft=false}={}){if(!keepDraft)savedDraft=null;uiEpoch++;");
const point=s.indexOf(' function field(');if(point<0)throw Error('field seam');
s=s.slice(0,point)+` function suspend(){
  if(session?.draft&&session.confirmed&&['loaded','pending','previewed','invalid','incomplete'].includes(session.state))savedDraft={device:owner.sourceDeviceId,origin:owner.boundOrigin,protocol:session.protocol||1,base:session.confirmed,draft:session.draft};
  reset({keepDraft:true});message(t('Tenging rofin. Drög eru geymd í minni; sæktu stillingar aftur og forskoðaðu áður en þú vistar.','Connection interrupted. Drafts remain in memory; retrieve settings and preview again before saving.'));
 }
`+s.slice(point);
s=s.replace("   const code=e.diagnostic?.code||e.message;", "   const code=e.diagnostic?.code||e.message;\n   const transportLost=e.diagnostic?.httpStatus==null&&['FETCH_REJECTED','FETCH_OR_TYPE_ERROR'].includes(code);");
s=s.replace("message(prefix);showDiagnostic({...diagnostic(e,readback?'readback':operation,activeOwner),hint:guidance.trim()});", "const result={...diagnostic(e,readback?'readback':operation,activeOwner),hint:guidance.trim()};if(transportLost)onConnectionFailure?.();message(prefix);showDiagnostic(result);");
// A generic 409 admission denial says nothing about which firmware guard denied it.
const g=s.indexOf("   const guidance=code==='SETTINGS_BUSY_OR_UNAVAILABLE'");const ge=s.indexOf('\n',g);
s=s.slice(0,g)+"   const guidance=code==='SETTINGS_BUSY_OR_UNAVAILABLE'?t(' Tækið afgreiddi ekki stillingabeiðnina. Ástæðan er óþekkt; skráalisti getur enn verið tiltækur.','The device declined the settings request. The reason is unknown; flight listing may still be available.'):'';"+s.slice(ge);
s=s.replace("   catch(e){results.push({outcome:'failed',...diagnostic(e,operation,active)});}", "   catch(e){results.push({outcome:'failed',...diagnostic(e,operation,active)});if(!active.hasAuthorization()){onAuthorizationLost?.();showDiagnostic({readOnly:true,results});return;}}");
s=s.replace("  showDiagnostic({readOnly:true,results});", "  if(results.some(r=>r.httpStatus==null&&r.outcome==='failed'))onConnectionFailure?.();\n  showDiagnostic({readOnly:true,results});");
s=s.replace('  reset();owner=getSource();','  reset({keepDraft:true});owner=getSource();');
s=s.replace("   render();el('settings-readonly')", `   let restored=false;
   if(savedDraft&&savedDraft.device===active.sourceDeviceId&&savedDraft.origin===active.boundOrigin&&savedDraft.protocol===(s.protocol||1)&&JSON.stringify(savedDraft.base)===JSON.stringify(s.confirmed)){
    const pending=savedDraft;await s.edit(pending.draft);if(session!==s||getSource()!==active)return;savedDraft=null;restored=true;
   }
   render();el('settings-readonly')`);
s=s.replace("   message(t('Núverandi stillingar sóttar. Engar breytingar vistaðar.','Current settings retrieved. No changes saved.'));", "   message(restored?t('Stillingar sóttar aftur og drög endurheimt. Forskoðaðu aftur áður en þú vistar.','Settings retrieved and drafts restored. Preview again before saving.'):savedDraft?t('Stillingar tækisins hafa breyst. Fyrri drög eru enn í minni en voru ekki sett yfir ný gögn.','Device settings changed. Earlier drafts remain in memory and were not placed over new data.'):t('Núverandi stillingar sóttar. Engar breytingar vistaðar.','Current settings retrieved. No changes saved.'));");
s=s.replace('return {reset,invalidate()', 'return {reset,suspend,invalidate()');
await writeFile('pwa/settings-ui.mjs',s);
