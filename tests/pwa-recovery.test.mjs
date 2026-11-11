import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,writeFile,mkdir,readdir} from 'node:fs/promises';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {referenceCrc,referenceEncoding} from './flight-fixtures.mjs';
const root=new URL('../',import.meta.url);
const hash=b=>createHash('sha256').update(b).digest('hex');
test('P2 isolated deterministic recovery A-J',{timeout:240000},async()=>{
 const original=JSON.parse(await readFile(new URL('pwa/fixtures/catalog.json',root)));
 const originalBytes=await Promise.all(original.fixtures.map(f=>readFile(new URL('pwa/fixtures/'+f.file,root))));
 const assets=new Map([
  ['/source.mjs',{type:'text/javascript',body:await readFile(new URL('pwa/source.mjs',root))}],
  ['/',{type:'text/html',body:'<!doctype html><title>P2 LOCAL TEST ONLY</title>'}],
  ['/flight-storage.mjs',{type:'text/javascript',body:await readFile(new URL('flight-storage.mjs',root))}],
  ['/flight-evidence.mjs',{type:'text/javascript',body:await readFile(new URL('flight-evidence.mjs',root))}],
  ['/recovery-storage.mjs',{type:'text/javascript',body:await readFile(new URL('tests/pwa-recovery-storage.mjs',root))}],
  ['/recovery-browser.mjs',{type:'text/javascript',body:await readFile(new URL('tests/pwa-recovery-browser.mjs',root))}],
  ['/adapter.mjs',{type:'text/javascript',body:(await readFile(new URL('pwa/adapter.mjs',root),'utf8')).replace("from './flight-storage.mjs'","from './recovery-storage.mjs'")}]
 ]);
 const server=createServer((req,res)=>{
  const a=assets.get(req.url);
  if(req.method!=='GET'||!a){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'Content-Type':a.type,'Cache-Control':'no-store','Content-Security-Policy':"default-src 'self'; connect-src 'self'; script-src 'self'; object-src 'none'"});res.end(a.body);
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const origin='http://127.0.0.1:'+server.address().port;
 const profile=await mkdtemp(join(tmpdir(),'huginn-p2-isolated-edge-'));
 let browser,ws,send;
 async function start(){
  browser=spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',['--headless=new','--no-first-run','--disable-background-networking','--disable-component-update','--disable-sync','--user-data-dir='+profile,'--remote-debugging-port=0','about:blank'],{windowsHide:true,stdio:'ignore'});
  let endpoint;
  for(let n=0;n<200;n++){try{endpoint='http://127.0.0.1:'+(await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0];const targets=await (await fetch(endpoint+'/json/list')).json();if(targets.some(t=>t.type==='page'))break;}catch{}await new Promise(r=>setTimeout(r,100));}
  const target=(await (await fetch(endpoint+'/json/list')).json()).find(t=>t.type==='page');
  ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});
  let next=0;const pending=new Map();
  ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}};
  send=(method,params={})=>new Promise((resolve,reject)=>{const id=++next;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
  await send('Page.enable');await send('Page.navigate',{url:origin+'/'});
 }
 async function evaluate(expression){
  const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});
  assert.equal(r.exceptionDetails,undefined,JSON.stringify(r.exceptionDetails));return r.result.value;
 }
 async function stop(){
  const exited=new Promise(r=>browser.once('exit',r));
  try{await send('Browser.close');}catch{}
  ws.close();await Promise.race([exited,new Promise(r=>setTimeout(r,2000))]);
  browser.kill();
 }
 const results=[];
 try{
  await start();
  assert.equal(await evaluate('location.origin'),origin);
  assert.deepEqual(await evaluate('indexedDB.databases().then(v=>v.map(d=>d.name))'),[]);
  for(const name of ['A','B','C','D','E','G','P']){
   const catalog=structuredClone(original),inputs=[];
   for(let i=0;i<3;i++){
    const raw=Buffer.from(originalBytes[i]),m=catalog.fixtures[i].metadata;
    m.session_id=hash(Buffer.from('P2-isolated-'+name+'-'+i)).slice(0,32);
    m.source_device_id='02:00:00:00:02:'+String(i+1).padStart(2,'0');
    m.filename='F'+(['A','B','C','D','E','G','P'].indexOf(name)+1).toString(16).toUpperCase()+'0000'+(i+1)+'.FLG';
    Buffer.from(m.session_id,'hex').copy(raw,8);raw.writeUInt32LE(referenceCrc(raw.subarray(0,124)),124);
    m.physical_sha256=hash(raw);m.metadata_sha256=hash(referenceEncoding(m));inputs.push([...raw]);
   }
   const expression=phase=>"(async()=>{const {runRecovery}=await import('./recovery-browser.mjs');return runRecovery("+JSON.stringify(catalog)+","+JSON.stringify(inputs)+","+JSON.stringify(name)+","+JSON.stringify(phase)+");})()";
   const interrupted=await evaluate(expression('interrupt'));
   // Full browser process close/relaunch, same disposable profile and origin.
   await stop();await start();
   const recovered=await evaluate(expression('recover'));
   assert.equal(recovered.pass,true);
   assert.deepEqual(recovered.controlRows,interrupted.controlRows,'control records changed '+name);
   results.push({case:name,pass:true,offset:interrupted.offset,resumedWrites:recovered.writes.length});
   console.log('P2 '+name+': PASS '+JSON.stringify(results.at(-1)));
  }
  const names=await evaluate('indexedDB.databases().then(v=>v.map(d=>d.name))');
  assert.ok(names.every(n=>n.startsWith('huginn-p2-')));
  console.log('P2 F/H/I/J: PASS across restart, unchanged controls, exact exports and no partial publication.');
  await mkdir(new URL('build/p2/',root),{recursive:true});
  await writeFile(new URL('build/p2/recovery-results.json',root),JSON.stringify({origin,profile,scope:'desktop synthetic only; not iPhone power-loss qualification',results,gates:{F:true,H:true,I:true,J:true},databases:names},null,2));
 }finally{if(browser)await stop();await new Promise(r=>server.close(r));}
});
test('production artifact excludes P2 injection and disposable fixtures',async()=>{
 const build=JSON.parse(await readFile(new URL('dist/pwa/build.json',root)));
 assert.equal(build.full_ack_gate_pass,false);
 for(const name of Object.keys(build.files)){
  assert.ok(!/recovery|p2/i.test(name),'test artifact in manifest');
  if(/\.m?js$/.test(name))assert.doesNotMatch(await readFile(new URL('dist/pwa/'+name,root),'utf8'),/P2_INTERRUPT|recovery-storage|runRecovery|huginn-p2-/);
 }
 const walk=async dir=>{for(const e of await readdir(dir,{withFileTypes:true})){assert.ok(!/recovery|p2/i.test(e.name));if(e.isDirectory())await walk(new URL(e.name+'/',dir));}};
 await walk(new URL('dist/pwa/',root));
 for(let i=0;i<originalPaths.length;i++)assert.equal(hash(await readFile(new URL(originalPaths[i],root))),expectedHashes[i]);
});
const originalPaths=['pwa/fixtures/complete.FLG','pwa/fixtures/incomplete.FLG','pwa/fixtures/ceiling.FLG'];
const expectedHashes=['93e7956bc91945a4edae075b01f2fa3fa97f36cb1531d752c706b6f7dde93d5d','1258a8be2cb0201dbb8aa6bed4e2d78e31c574682f8172584177e5950b87646a','a665ab60cb630c78316cf0023f4165e2244ae06094f94ad65e6ba9118053fca9'];
