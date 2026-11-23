import test from'node:test';import assert from'node:assert/strict';import{readFile}from'node:fs/promises';
import{exportFile}from'../dist/pwa/export-handoff.mjs';
test('native share contains exactly one original binary File and no auxiliary fields; cancellation preserved',async()=>{
 const raw=await readFile('C:/HuginnAPP/Evidence/EXPORT-REV2.43-20261123/F237001.FLG');
 const file=new File([raw],'F237001.FLG',{type:'application/octet-stream'}),p={file,filename:file.name,physical_bytes:file.size};let invoked=false;
 const result=exportFile(p,{navigator:{canShare:o=>{assert.deepEqual(Object.keys(o),['files']);return true;},share:async o=>{invoked=true;assert.deepEqual(Object.keys(o),['files']);assert.equal(o.files.length,1);assert.equal(o.files[0],file);assert.equal(file.size,10297088);assert.deepEqual(Buffer.from(await file.arrayBuffer()),raw);}}});
 assert.equal(invoked,true);assert.equal((await result).status,'HANDED_TO_SHARE_TARGET');
 assert.equal((await exportFile(p,{navigator:{canShare:()=>true,share:async()=>{throw new DOMException('cancel','AbortError')}}})).status,'CANCELLED');
 await assert.rejects(()=>exportFile(p,{navigator:{canShare:()=>true,share:async()=>{throw new DOMException('denied','NotAllowedError')}}}),/denied/);
});
test('only export payload and revision differ from published .43 package',async()=>{
 const root='C:/HuginnAPP/',old=root+'Evidence/EXPORT-REV2.43-20261123/app-review-0424b016afdbdaf5/',m=JSON.parse(await readFile(old+'build.json'));
 for(const f of Object.keys(m.files).filter(f=>!['export-handoff.mjs','index.html','entry.mjs','sw.js'].includes(f)))assert.deepEqual(await readFile(root+'dist/pwa/'+f),await readFile(old+f),f);
});
