import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {fixture} from './flight-fixtures.mjs';
const root=resolve(fileURLToPath(new URL('../',import.meta.url)));
test('actual Rev237 PWA/source/IDB/SW/export/reimport and full browser restart',{timeout:300000},async()=>{
  const out='C:/HuginnAPP/Evidence/UPDATE-REV2.42-20261123/production-browser-'+Date.now();await mkdir(out,{recursive:true});
  const samples=Number(process.env.REV237_PRODUCTION_SAMPLES??64351),f=fixture('complete',{samples,runtime:300000000n+BigInt(samples+1)*100000n});
  Object.assign(f.metadata,{schema:'huginn.flight-courier.metadata',schema_version:1,manifest_generation:17,eligible:true,reason:'AUTOMATIC',transfer_state:'NOT_TRANSFERRED'});
  const input=join(out,'SYNTHETIC-CAPACITY.FLG');await writeFile(input,f.raw);
  let drop=false,ranges=[],prepares=0,busyResponses=0;
  const server=http.createServer(async(req,res)=>{try{
    const u=new URL(req.url,'http://127.0.0.1'),p=u.pathname;res.setHeader('Cache-Control','no-store');
    if(p==='/__fixture'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({metadata:f.metadata}));return;}
    if(p==='/__stats'){res.end(JSON.stringify({ranges,prepares}));return;}
    if(p==='/__control'){if(u.searchParams.has('drop'))drop=true;if(u.searchParams.has('reset')){ranges=[];prepares=0;}res.end('{}');return;}
    if(p.startsWith('/api/v1/flights/')){
      assert.equal(req.headers.authorization,'Bearer '+'A'.repeat(43));
      if(!p.endsWith('/evidence')){
        assert.equal(req.headers.accept,'application/vnd.huginn.flight-prepared+ndjson;version=1');prepares++;
        const n=f.raw.length,frames=[{event:'progress',stage:'snapshot_before',completed:0,total:0},{event:'progress',stage:'hash',completed:0,total:n},{event:'progress',stage:'hash',completed:n,total:n},{event:'progress',stage:'snapshot_after',completed:n,total:n},{event:'metadata',metadata:f.metadata,etag:`"hfl-sha256-${f.metadata.physical_sha256}-${n}"`,prepared:'a'.repeat(32)}];
        res.setHeader('Content-Type','application/vnd.huginn.flight-prepared+ndjson');res.end(frames.map(x=>JSON.stringify(x)+'\n').join(''));return;
      }
      assert.equal(req.headers['x-huginn-prepared'],'a'.repeat(32));assert.equal(req.headers.accept,'application/octet-stream');
      const m=/^bytes=(\d+)-(\d+)$/.exec(req.headers.range);assert(m);const start=+m[1],end=+m[2];assert(end-start<65536);ranges.push([start,end]);
      assert.equal(req.headers['if-match'],`"hfl-sha256-${f.metadata.physical_sha256}-${f.raw.length}"`);
      if(!busyResponses && start===65536){busyResponses++;res.writeHead(503,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'COURIER_BUSY'}));return;}
      const b=f.raw.subarray(start,end+1);res.writeHead(206,{'Content-Type':'application/octet-stream','Content-Length':b.length,'Content-Range':`bytes ${start}-${end}/${f.raw.length}`,'Accept-Ranges':'bytes',ETag:`"hfl-sha256-${f.metadata.physical_sha256}-${f.raw.length}"`});
      if(drop){drop=false;res.flushHeaders();res.write(b.subarray(0,Math.floor(b.length/2)));setTimeout(()=>res.destroy(),5);}else res.end(b);return;
    }
    if(p==='/test.html'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Rev237 isolated production PWA tests</title>');return;}
    assert(!p.includes('..'));const target=p==='/__tests.mjs'?join(root,'tests/rev237-production.browser.mjs'):join(root,'dist/pwa',p==='/'?'index.html':p.slice(1));
    const b=await readFile(target);res.setHeader('Content-Type',target.endsWith('.mjs')||target.endsWith('.js')?'text/javascript':target.endsWith('.json')?'application/json':target.endsWith('.html')?'text/html':target.endsWith('.png')?'image/png':'application/octet-stream');res.end(b);
  }catch(e){res.writeHead(500);res.end(e.message);}});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port,profile=join(out,'profile');let browser,ws,send;
  const start=async()=>{
    browser=spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',['--headless=new','--no-first-run','--disable-background-networking','--disable-sync','--user-data-dir='+profile,'--remote-debugging-port=0','about:blank'],{windowsHide:true,stdio:'ignore'});
    let endpoint;for(let n=0;n<150;n++){try{const port=(await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0];const e='http://127.0.0.1:'+port;const tabs=await(await fetch(e+'/json/list',{signal:AbortSignal.timeout(1000)})).json();if(tabs.some(t=>t.type==='page')){endpoint=e;break;}}catch{}await new Promise(r=>setTimeout(r,100));}
    assert(endpoint,'BROWSER_START');const target=(await(await fetch(endpoint+'/json/list')).json()).find(t=>t.type==='page');ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});let serial=0;const pending=new Map();
    ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);if(p)m.error?p.reject(Error(m.error.message)):p.resolve(m.result);}};
    send=(method,params={})=>new Promise((resolve,reject)=>{const id=++serial;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
    await send('Page.navigate',{url:origin+'/test.html'});for(let n=0;n<100;n++){const v=await send('Runtime.evaluate',{expression:'document.readyState',returnByValue:true});if(v.result.value==='complete')break;await new Promise(r=>setTimeout(r,20));}
  };
  const stop=async()=>{try{await send?.('Browser.close');}catch{}try{ws?.close();}catch{}if(browser&&browser.exitCode===null)await new Promise(r=>{const t=setTimeout(()=>{browser.kill();r();},5000);browser.once('exit',()=>{clearTimeout(t);r();});});};
  const run=async phase=>{const r=await send('Runtime.evaluate',{expression:`(async()=>{const m=await import('./__tests.mjs');return m.runProduction237(${JSON.stringify(phase)});})()`,awaitPromise:true,returnByValue:true});assert.equal(r.exceptionDetails,undefined,JSON.stringify(r.exceptionDetails));return r.result.value;};
  try{
    await start();const cases=await run('suite');await writeFile(join(out,'cases.json'),JSON.stringify(cases,null,2));for(const c of cases)console.log((c.pass?'PASS ':'FAIL ')+c.name+(c.error?' '+c.error:''));assert(cases.length===4&&cases.every(c=>c.pass),'PRODUCTION_PWA_FAILURE');assert.equal(busyResponses,1,'BOUNDED_BUSY_EXERCISED');
    await send('Runtime.evaluate',{expression:"document.body.innerHTML='<input type=file id=fixture-input>'"});const doc=await send('DOM.getDocument');const element=await send('DOM.querySelector',{nodeId:doc.root.nodeId,selector:'#fixture-input'});await send('DOM.setFileInputFiles',{nodeId:element.nodeId,files:[input]});const reimport=await run('reimport');assert(reimport.pass,'REIMPORT');
    await stop();await start();const reopened=await run('after-restart');assert(reopened.pass&&reopened.sha256===f.metadata.physical_sha256&&reopened.published===1,'COLD_REOPEN');
    await writeFile(join(out,'RESULT.json'),JSON.stringify({status:'PASS',scope:'HOST_PRODUCTION_PWA_REAL_EDGE_IDB_SW_NOT_ESP32_OR_IPHONE',busyResponses,bytes:f.raw.length,sha256:f.metadata.physical_sha256,cases,reimport,reopened,profile},null,2));console.log('Evidence: '+out);
  }finally{await stop();server.closeAllConnections();await new Promise(r=>server.close(r));}
});

