import {readFile,writeFile,mkdir} from 'node:fs/promises';
const path='pwa/settings-ui.mjs',out='build/immediate-edit-preview-review';await mkdir(out,{recursive:true});
let s=await readFile(path,'utf8');await writeFile(out+'/settings-ui.before.mjs',s,{flag:'wx'});
function replace(a,b){if(!s.includes(a))throw Error(a);s=s.replace(a,b);}
replace('let session=null,owner=null,uiEpoch=0,savedDraft=null;','let session=null,owner=null,uiEpoch=0,savedDraft=null;const rawEdits=new Map(),invalidFields=new Set(),editTickets=new Map();');
replace("el('settings-preview').disabled=busy||!connected||!changed", "el('settings-preview').disabled=busy||invalidFields.size>0||!connected||!changed");
replace("el('settings-apply').disabled=busy||!connected", "el('settings-apply').disabled=busy||invalidFields.size>0||!connected");
replace("['invalid','incomplete'].includes(session?.state)?", "(invalidFields.size>0||['invalid','incomplete'].includes(session?.state))?");
replace('uiEpoch++;session?.close();','uiEpoch++;rawEdits.clear();invalidFields.clear();editTickets.clear();session?.close();');
replace('base:session.confirmed,draft:session.draft};','base:session.confirmed,draft:session.draft,raw:[...rawEdits],invalid:[...invalidFields]};');
replace('savedDraft=null;restored=true;', 'savedDraft=null;for(const [id,value]of pending.raw||[])rawEdits.set(id,value);for(const id of pending.invalid||[])invalidFields.add(id);restored=true;');
replace("function render(){el('settings-fields').replaceChildren();if(session.protocol===2){renderV2();return;}","function render(){if(session.protocol===2){renderV2();return;}el('settings-fields').replaceChildren();");
replace("el('settings-preview').onclick=()=>run(()=>work('preview'", "el('settings-preview').onclick=()=>invalidFields.size?undefined:run(()=>work('preview'");
replace('await session.apply();render();','await session.apply();rawEdits.clear();invalidFields.clear();render();');
const begin=s.indexOf(' function renderV2(){'),end=s.indexOf('\n reset();return',begin);if(begin<0||end<0)throw Error('render boundary');s=s.slice(0,begin)+await readFile('protocol/immediate-editor-v2.js','utf8')+s.slice(end);
await writeFile(path,s);
