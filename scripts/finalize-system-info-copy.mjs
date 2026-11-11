import {readFile,writeFile} from 'node:fs/promises';
let s=await readFile('pwa/index.html','utf8');
for(const [old,value]of [['Traustsni?','Traustsnið'],['Sl?? HuginnEIS','Slóð HuginnEIS'],['P?runaruppl?singar (JSON)','Pörunarupplýsingar (JSON)']])s=s.replaceAll(old,value);
await writeFile('pwa/index.html',s);
s=await readFile('pwa/entry.mjs','utf8');const old="}catch{el('persistence').textContent=";
if(!s.includes(old))throw Error('Persistence context');
await writeFile('pwa/entry.mjs',s.replace(old,"}catch(e){error(e);el('persistence').textContent="));
