import http from 'node:http';import https from 'node:https';
import {readFile} from 'node:fs/promises';import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
export const CSP="default-src 'self'; connect-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'";
const MIME={'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png','.FLG':'application/octet-stream'};
export async function startServer({root=resolve(fileURLToPath(new URL('../dist/pwa/',import.meta.url))),host='127.0.0.1',port=8443,name=host,cert,key,testHttp=false}={}){
  if(testHttp&&host!=='127.0.0.1')throw new Error('HTTP_TEST_LOOPBACK_ONLY');
  if(!testHttp&&(!cert||!key))throw new Error('OWNER_SUPPLIED_TRUSTED_TLS_CERTIFICATE_AND_KEY_REQUIRED');
  const handler=async(req,res)=>{
    const send=(status,text)=>{res.writeHead(status,{'Content-Type':'text/plain'});res.end(text);};
    if(req.headers.host!==name+':'+server.address().port)return send(400,'Invalid Host');
    if(req.method!=='GET'&&req.method!=='HEAD')return send(405,'Read-only static host');
    if(req.url.includes('?')||req.url.includes('%')||req.url.includes('..')||req.url.includes('\\'))return send(400,'Invalid path');
    const path=req.url==='/'?'/index.html':req.url;
    const extension=path.slice(path.lastIndexOf('.')),type=MIME[extension];
    if(!type||!/^\/[a-zA-Z0-9_./-]+$/.test(path))return send(404,'Not found');
    try{
      const bytes=await readFile(join(root,path));
      res.writeHead(200,{'Content-Type':type,'Content-Length':bytes.length,'Content-Security-Policy':CSP,'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Cache-Control':path==='/sw.js'?'no-cache':'no-store'});
      res.end(req.method==='HEAD'?undefined:bytes);
    }catch{send(404,'Not found');}
  };
  const server=testHttp?http.createServer(handler):https.createServer({cert:await readFile(cert),key:await readFile(key),minVersion:'TLSv1.2'},handler);
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,host,resolve);});
  return server;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const args=process.argv.slice(2),option=name=>{const index=args.indexOf(name);return index<0?undefined:args[index+1];};
  try{
    const host=option('--host')||'127.0.0.1',name=option('--name')||host;
    const server=await startServer({host,name,port:Number(option('--port')||8443),cert:option('--cert'),key:option('--key')});
    console.log('READY https://'+name+':'+server.address().port+'/ — NO-ACK static PWA');
  }catch(e){console.error(e.message);process.exitCode=1;}
}
