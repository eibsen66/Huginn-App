import {prepareRetained,selected} from './retained-huginn-host.mjs';
import {execFileSync} from 'node:child_process';
import test from 'node:test';import assert from 'node:assert/strict';
import http from 'node:http';import {readFile,mkdir,writeFile,mkdtemp} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {spawn} from 'node:child_process';import {createHash} from 'node:crypto';
import {fixture} from './flight-fixtures.mjs';import {parseHfl,metadataSha256} from '../flight-evidence.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex'),root=new URL('../',import.meta.url);
test('real loopback firmware protocol / Fetch / IndexedDB / NO-ACK vertical slice',{timeout:240000},async()=>{
 const output=new URL('build/no-ack-transfer/candidate-reference-20261021/browser/',root);await mkdir(output,{recursive:true});prepareRetained(new URL('.',output).pathname.replace(/^\/(?:([A-Za-z]:))/,'$1'));
 const selectedBytes=await readFile(selected.path);assert.equal(selectedBytes.length,selected.bytes);assert.equal(hash(selectedBytes),selected.sha256);
 const catalog=JSON.parse(await readFile(new URL('pwa/fixtures/catalog.json',root)));
 const sd700=await readFile('C:/HuginnEIS/Evidence/Huginn_SD700s_Run1/B0FF1/FLIGHT/FE9123B.FLG');
 const sd900=await readFile('C:/HuginnEIS/Evidence/Huginn_SD900s_Run1/B0FF1/FLIGHT/FF94A29.FLG');
 assert.equal(hash(sd700),'cb766103e409b344e237eac2f24d60d66e30c1ff7dc1e2cdf72187d3ef28015b');
 assert.equal(hash(sd900),'1130407540ef7de586faa9de8e1811d7352cd2084002ac38824dedefbc89f98f');
 const raws={retained:selectedBytes,complete:fixture('complete').raw,incomplete:fixture('incomplete').raw,torn:fixture('torn').raw,provisional:fixture('provisional').raw,ceiling:await readFile(new URL('pwa/fixtures/ceiling.FLG',root)),sd700,sd900,hourly:fixture('complete',{samples:36000,runtime:3900000000n}).raw};
 let raw=raws.complete,metadata,fault='none',ranges=0,currentKind='complete';const calls=[],all=[];
 async function prepare(kind,mode){currentKind=kind;raw=Buffer.from(raws[kind]);if(mode==='corrupt')raw[128+4*160+24]^=1;const p=parseHfl(raw),clean=parseHfl(raws[kind]);
  metadata={source_device_id:'02:00:00:00:00:A1',filename:kind==='retained'?'F578CE0.FLG':kind==='sd700'?'FE9123B.FLG':kind==='sd900'?'FF94A29.FLG':'F123ABC.FLG'};
  for(const key of ['session_id','physical_bytes','start_utc','runtime_us','record_count','valid_bytes','state','complete','integrity','hfl_version'])metadata[key]=(mode==='corrupt'?clean:p)[key];
  metadata.physical_sha256=mode==='hash'?'0'.repeat(64):hash(raw);metadata.metadata_sha256=await metadataSha256(metadata);
  Object.assign(metadata,{schema:'huginn.flight-courier.metadata',schema_version:1,manifest_generation:kind==='retained'?selected.disposable_recovery.generation:1,transfer_state:'NOT_TRANSFERRED',eligible:true,reason:metadata.state==='PROVISIONAL'?'OWNER_SELECTION_REQUIRED_PROVISIONAL':'AUTOMATIC'});
  fault=mode;ranges=0;calls.length=0;return metadata;
 }
 await prepare('complete','none');
 let origin,sourceOrigin;const preflights=[];
 const handler=async(req,res)=>{try{
  if(req.headers.origin===origin){res.setHeader("Access-Control-Allow-Origin",origin);res.setHeader("Access-Control-Expose-Headers","ETag, Content-Range, Content-Length, Accept-Ranges");}
  if(req.method==="OPTIONS"){preflights.push(req.url);res.writeHead(204,{"Access-Control-Allow-Methods":"GET, OPTIONS","Access-Control-Allow-Headers":"Authorization, Range, If-Match"});res.end();return;}
  const u=new URL(req.url,'http://127.0.0.1');const send=(body,status=200,headers={})=>{const b=Buffer.isBuffer(body)?body:Buffer.from(JSON.stringify(body));res.writeHead(status,{'Content-Type':'application/json','Content-Length':b.length,...headers});res.end(b);};
  if(u.pathname==='/__control')return send(await prepare(u.searchParams.get('kind'),u.searchParams.get('fault')));
  if(u.pathname==='/__fault-off'){fault='none';return send({ok:true});}
  if(u.pathname==='/__original')return send(raw);
  if(u.pathname==='/__calls')return send(calls);
  if(u.pathname==='/__all-calls')return send(all);
  if(u.pathname.startsWith('/api/')){
   const entry={method:req.method,path:u.pathname,range:req.headers.range};calls.push(entry);all.push(entry);
   if(req.method!=='GET')return send({error:'METHOD_NOT_ALLOWED'},405);
   if(req.headers.authorization!=='Bearer '+'AQ'.repeat(21)+'A'||fault==='auth'||fault==='revoked'&&ranges>=1)return send({error:'INVALID_TOKEN'},401);
   if(u.pathname==='/api/v1/flights'&&currentKind==='retained'){
    const pages=selected.disposable_recovery.pages,cursor=u.searchParams.get('cursor');const index=cursor===null?0:pages.findIndex((_,i)=>i>0&&pages[i-1].next_cursor===cursor);
    if(index<0)return send({error:'INVALID_CURSOR'},400);return send(pages[index]);
   }
   if(u.pathname==='/api/v1/flights')return send({schema:'huginn.flight-courier.list',schema_version:1,source_device_id:metadata.source_device_id,manifest_generation:1,count:1,capacity:64,entries:[{...metadata,physical_sha256:null,metadata_sha256:null}],next_cursor:null});
   const etag='"hfl-sha256-'+metadata.physical_sha256+'-'+metadata.physical_bytes+'"';
   if(!u.pathname.endsWith('/evidence'))return send({...metadata,source_device_id:fault==='identity'?'02:00:00:00:00:A1':metadata.source_device_id},200,{ETag:etag});
   ranges++;if(ranges===2&&fault==='interrupt')return send({error:'COURIER_BUSY'},503);
   if(ranges>=2&&fault==='network'){req.socket.destroy();return;}
   if(req.headers['if-match']!==etag)return send({error:'EVIDENCE_CHANGED'},409);
   const match=/^bytes=(\d+)-(\d+)$/.exec(req.headers.range||'');if(!match)return send({error:'INVALID_RANGE'},400);
   const start=+match[1],end=+match[2],body=raw.subarray(start,end+1);const headers={'Content-Type':'application/octet-stream','Content-Length':body.length,'Content-Range':`bytes ${fault==='range'?start+1:start}-${end}/${raw.length}`,'Accept-Ranges':'bytes',ETag:fault==='changed'&&ranges===2?'"changed"':etag};
   if(fault==='length')headers['Content-Length']=body.length+1;
   res.writeHead(206,headers);res.end(body);return;
  }
  if(u.pathname==='/transfer-tests.mjs'){const b=await readFile(new URL('tests/pwa-transfer.browser.mjs',root));res.writeHead(200,{'Content-Type':'text/javascript'});res.end(b);return;}
  if(u.pathname==='/test.html'){res.writeHead(200,{'Content-Type':'text/html'});res.end('<script type="module">window.testSourceOrigin='+JSON.stringify(sourceOrigin)+';import {runTransferTests} from "./transfer-tests.mjs"; window.result=await runTransferTests();</script>');return;}
  const relative=u.pathname.slice(1);if(!/^[A-Za-z0-9_./-]+$/.test(relative)||relative.includes('..'))return send({},404);
  try{const b=await readFile(new URL('dist/pwa/'+relative,root));res.writeHead(200,{'Content-Type':relative.endsWith('.mjs')?'text/javascript':relative.endsWith('.json')?'application/json':'application/octet-stream'});res.end(b);}catch{send({},404);}
 }catch(e){res.writeHead(500);res.end('Simulator failure');}};
 const server=http.createServer(handler),sourceServer=http.createServer(handler);
 await new Promise(r=>server.listen(0,'127.0.0.1',r));origin='http://127.0.0.1:'+server.address().port;
 await new Promise(r=>sourceServer.listen(0,'127.0.0.1',r));sourceOrigin='http://127.0.0.1:'+sourceServer.address().port;
 const profile=await mkdtemp(join(tmpdir(),'huginn-noack-transfer-edge-')),browser=spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',['--headless=new','--no-first-run','--disable-background-networking','--disable-sync','--user-data-dir='+profile,'--remote-debugging-port=0','about:blank'],{windowsHide:true,stdio:'ignore'});let ws,send;
 try{
  let port;for(let i=0;i<200;i++){try{port=(await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0];break;}catch{await new Promise(r=>setTimeout(r,100));}}
  assert.ok(port);const target=(await(await fetch('http://127.0.0.1:'+port+'/json/list')).json()).find(t=>t.type==='page');ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});
  let n=0;const pending=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}};send=(method,params={})=>new Promise((resolve,reject)=>{const id=++n;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
  await send('Page.navigate',{url:origin+'/test.html'});
  const out=await send('Runtime.evaluate',{expression:'new Promise((resolve,reject)=>{let n=0;const t=setInterval(()=>{if(window.result){clearInterval(t);resolve(window.result);}else if(++n>1500){clearInterval(t);reject(Error("suite timeout"));}},100);})',awaitPromise:true,returnByValue:true});
  assert.equal(out.exceptionDetails,undefined,JSON.stringify(out.exceptionDetails));const results=out.result.value;
  await mkdir(new URL('build/no-ack-transfer/candidate-reference-20261021/browser/',root),{recursive:true});await writeFile(new URL('build/no-ack-transfer/candidate-reference-20261021/browser/results.json',root),JSON.stringify({results,calls:all,cross_origin_preflights:preflights,fixtures:Object.entries(raws).map(([name,b])=>({name,bytes:b.length,sha256:hash(b),provenance:name==='retained'?'Historical owner-saved HUGINN backup; simulator source identity, not authenticated device provenance':name.startsWith('sd')?'Owner saved DEV synthetic recording; simulator metadata derived locally, not live authenticated aircraft provenance':'Synthetic test fixture'}))},null,2));
  const exported=await send('Runtime.evaluate',{expression:'globalThis.savedSD700Export',returnByValue:true});
  const exportBytes=Buffer.from(exported.result.value,'base64');assert.deepEqual(exportBytes,sd700);
  await writeFile(new URL('build/no-ack-transfer/candidate-reference-20261021/browser/exported-FE9123B.FLG',root),exportBytes);
  const saved=await send('Runtime.evaluate',{expression:'globalThis.savedRetainedExport',returnByValue:true});const retainedExport=Buffer.from(saved.result.value,'base64');assert.deepEqual(retainedExport,selectedBytes);
  const exportPath=new URL('exported-F578CE0.FLG',output);await writeFile(exportPath,retainedExport);
  const filePath=url=>url.pathname.replace(/^\/(?:([A-Za-z]:))/,'$1');
  const muninn=JSON.parse(execFileSync('C:/Espressif/tools/python/v5.5.2/venv/Scripts/python.exe',['-B',filePath(new URL('tests/retained-huginn-muninn.py',root)),selected.path,filePath(exportPath),filePath(output)],{encoding:'utf8',windowsHide:true,env:{...process.env,PYTHONDONTWRITEBYTECODE:'1',PYTHONUTF8:'1'}}));assert.equal(muninn.sha256,selected.sha256);assert.equal(muninn.acceptance,'ACCEPTED');
  await writeFile(new URL('muninn-selected-readback.json',output),JSON.stringify(muninn,null,2));console.log('HOST selected retained original -> browser export -> unchanged Muninn archive/reopen PASS');
  for(const r of results)console.log((r.pass?'PASS ':'FAIL ')+r.name+(r.error?' '+r.error:''));assert.ok(results.every(r=>r.pass));assert.ok(preflights.length>0);assert.ok(all.every(c=>c.method==='GET'&&!/ack|delete|complete/i.test(c.path)));
 }finally{if(send&&ws?.readyState===1)try{await Promise.race([send('Browser.close'),new Promise(r=>setTimeout(r,1000))]);}catch{}ws?.close();browser.kill();server.closeAllConnections();sourceServer.closeAllConnections();await Promise.all([new Promise(r=>server.close(r)),new Promise(r=>sourceServer.close(r))]);}
});
