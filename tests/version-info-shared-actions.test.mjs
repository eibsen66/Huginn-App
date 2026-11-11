import test from 'node:test';import assert from 'node:assert/strict';
import {bindVersionInformation} from '../pwa/version-info.mjs';
test('both version buttons share one guarded inspection and localized result',async()=>{
 const nodes=new Map(),document={documentElement:{lang:'is'},getElementById:id=>{if(!nodes.has(id))nodes.set(id,{textContent:'',disabled:false});return nodes.get(id);}};
 let calls=0,resolve,reject;const inspect=()=>{calls++;return new Promise((a,b)=>{resolve=a;reject=b;});};
 const A='aaaaaaaaaaaaaaaa',result={appBuild:A,controller:{status:'Known',build:A},active:{status:'Known',build:A},waiting:{status:'None'},cache:'Complete expected shell',mismatch:false,htmlMismatch:false};
 const initial=bindVersionInformation({appBuild:A,htmlBuild:A,document,inspect});
 const first=nodes.get('info-refresh'),second=nodes.get('info-refresh-huginn');
 assert.equal(first.onclick,second.onclick);assert(first.disabled&&second.disabled);
 await second.onclick();assert.equal(calls,1);resolve(result);await initial;assert(!first.disabled&&!second.disabled);
 assert.equal(nodes.get('info-result').textContent,nodes.get('info-result-huginn').textContent);assert.match(nodes.get('info-result').textContent,/samræmast/);
 const pending=second.onclick();await first.onclick();assert.equal(calls,2);resolve({...result,mismatch:true});await pending;assert.match(nodes.get('info-result-huginn').textContent,/samræmast ekki/);
 const failed=first.onclick();reject(Error('fixture'));await failed;assert.match(nodes.get('info-result-huginn').textContent,/Ekki tókst/);assert.equal(nodes.get('info-result').textContent,nodes.get('info-result-huginn').textContent);assert(!first.disabled&&!second.disabled);
});
