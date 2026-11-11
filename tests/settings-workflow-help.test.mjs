import test from 'node:test';import assert from 'node:assert/strict';import {bindSettings} from '../dist/pwa/settings-ui.mjs';
for(const lang of ['is','en'])test('workflow guidance uses '+lang+' and explains preview versus save',()=>{
 const saved=globalThis.document,nodes=new Map(),helpers=[];
 const element=()=>({set id(v){this.key=v;nodes.set(v,this);},get id(){return this.key;},textContent:'',disabled:false,setAttribute(){},before(n){helpers.push(n);},after(n){helpers.push(n);},replaceChildren(){},querySelectorAll(){return [];}});
 const get=id=>{if(!nodes.has(id)){const n=element();n.id=id;}return nodes.get(id);};
 globalThis.document={documentElement:{lang},getElementById:get,createElement:element};
 try{bindSettings({getSource:()=>null,isConnected:()=>false,run:()=>{}});const text=helpers.map(n=>n.textContent).join(' ');assert.match(text,lang==='is'?/Ekkert er vistað/:/Nothing is saved/);assert.match(text,lang==='is'?/Ný breyting krefst nýrrar forskoðunar/:/Another edit requires a new preview/);assert.match(get('settings-workflow-hint').textContent,lang==='is'?/nýjan endurlestur og forskoðun/:/fresh readback and preview/);}finally{globalThis.document=saved;}
});
