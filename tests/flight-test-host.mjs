import {spawn} from 'node:child_process';import {mkdtemp} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import net from 'node:net';
export async function sourceHost({development=true,browserTests=false}={}){
 const args=['-NoProfile','-ExecutionPolicy','Bypass','-File',new URL('../launcher/test-source-host.ps1',import.meta.url).pathname.replace(/^\//,''),...(development?['-Development']:[]),...(browserTests?['-BrowserTests']:[])];
 const child=spawn('powershell.exe',args,{windowsHide:true,stdio:['ignore','pipe','pipe']});let output='';
 child.stdout.on('data',b=>output+=b);child.stderr.on('data',b=>output+=b);
 await new Promise((resolve,reject)=>{const deadline=setTimeout(()=>{child.kill();reject(new Error(output||'host timeout'));},20000);
  const timer=setInterval(()=>{if(output.includes('READY ')){clearTimeout(deadline);clearInterval(timer);resolve();}},50);
  child.once('exit',code=>{clearTimeout(deadline);clearInterval(timer);reject(new Error(`host exit ${code}: ${output}`));});});
 return child;
}
export async function rawRequest(port,target='/',{host=`127.0.0.1:${port}`,method='GET',extra=''}={}){
 return new Promise((resolve,reject)=>{const socket=net.createConnection({host:'127.0.0.1',port}),parts=[];
 socket.on('connect',()=>socket.write(`${method} ${target} HTTP/1.1\r\nHost: ${host}\r\n${extra}\r\n`));
 socket.on('data',b=>parts.push(b));socket.on('error',reject);socket.on('end',()=>resolve(Buffer.concat(parts).toString('utf8')));socket.setTimeout(10000,()=>socket.destroy(new Error('request timeout')));});
}
export async function runBrowser({courier=false}={}){
 const host=await sourceHost({browserTests:true}),profile=await mkdtemp(join(tmpdir(),'huginn-3b-edge-'));
 const edge=spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',[
  '--headless=new','--no-first-run','--disable-background-networking','--disable-component-update','--disable-sync',
  `--user-data-dir=${profile}`,'--remote-debugging-port=0','about:blank'],{windowsHide:true,stdio:'ignore'});
 let ws, send;
 try{
  const {readFile}=await import('node:fs/promises');let endpoint;
  for(let n=0;n<200;n++){try{const content=await readFile(join(profile,'DevToolsActivePort'),'utf8');endpoint=`http://127.0.0.1:${content.split('\n')[0]}`;break;}catch{await new Promise(r=>setTimeout(r,100));}}
  if(!endpoint)throw new Error('Edge debugging endpoint unavailable');
  const targets=await (await fetch(endpoint+'/json/list')).json(),target=targets.find(t=>t.type==='page');
  ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});
  let next=0;const pending=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(new Error(JSON.stringify(m.error))):p.resolve(m.result);}};
  send=(method,params={})=>new Promise((resolve,reject)=>{const id=++next;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
  await send('Page.enable');if(courier)await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await send('Page.navigate',{url:courier?'http://127.0.0.1:8768/__test__/courier.html':'http://127.0.0.1:8768/__test__/index.html'});
  const result=await send('Runtime.evaluate',{expression:`new Promise((resolve,reject)=>{let n=0;const timer=setInterval(()=>{if(window.testResult){clearInterval(timer);resolve(window.testResult);}else if(++n>600){clearInterval(timer);reject(new Error('suite timeout'));}},100);})`,awaitPromise:true,returnByValue:true});
  if(result.exceptionDetails)throw new Error(JSON.stringify(result.exceptionDetails));
  if(courier){const {mkdir,writeFile}=await import('node:fs/promises');await mkdir(new URL('../build/3h/',import.meta.url),{recursive:true});const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(new URL('../build/3h/courier-phone.png',import.meta.url),Buffer.from(shot.data,'base64'));}
  return {...result.result.value,browser:await send('Browser.getVersion')};
 }finally{if(send&&ws?.readyState===1)try{await Promise.race([send('Browser.close'),new Promise(r=>setTimeout(r,1000))]);}catch{}if(ws)ws.close();edge.kill();host.kill();}
}
