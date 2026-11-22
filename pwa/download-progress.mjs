import {friendlySize} from './ui-model.mjs';
export function preparationPresentation(p){
 if(p.state==='RECEIVING')return {text:'Tek á móti gögnum…',percent:null};
 if(p.state!=='PREPARING')return null;
 const title={snapshot_before:'Skoða skrá…',hash:'Undirbý skrá…',snapshot_after:'Staðfesti skrá…'}[p.stage]||'Undirbý skrá…';
 const known=Number.isSafeInteger(p.completed)&&Number.isSafeInteger(p.total)&&p.total>0&&p.completed>=0&&p.completed<=p.total;
 return {text:title+(known?' '+friendlySize(p.completed)+' / '+friendlySize(p.total):''),percent:known?100*p.completed/p.total:null};
}
