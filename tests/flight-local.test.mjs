import {execFile} from 'node:child_process';import {promisify} from 'node:util';
import test from 'node:test';import assert from 'node:assert/strict';import {sourceHost,rawRequest,runBrowser} from './flight-test-host.mjs';
import {spawn} from 'node:child_process';
test('launcher source HTTP security contract',async()=>{
 const host=await sourceHost();try{
  for(const [path,options,status] of [['/',{},200],['/flight-evidence.mjs',{},200],['/style.css',{},200],['/flight-compatibility.json',{},200],
   ['/',{host:'localhost:8768'},400],['/',{host:'foreign.example'},400],['/',{host:'127.0.0.1:8767'},400],
   ['/../secrets',{},400],['/%2e%2e/secrets',{},400],['/tests/',{},404],['/launcher/Program.cs',{},404],
   ['/',{method:'POST'},405],['/',{method:'PUT'},405],['/api/v1/flights',{},404],['/proxy?url=https://192.168.4.1',{},400],
   ['/',{extra:'Host: attacker\r\n'},400],['/',{extra:'Content-Length: 1\r\n'},400]]){
   const response=await rawRequest(8768,path,options);assert.match(response,new RegExp(`^HTTP/1.1 ${status} `));
  }
  assert.match(await rawRequest(8768,'/flight-evidence.mjs'),/Content-Type: text\/javascript/);
  assert.match(await rawRequest(8768,'/style.css'),/Content-Type: text\/css/);
  assert.match(await rawRequest(8768,'/flight-compatibility.json'),/Content-Type: application\/json/);
  assert.match(await rawRequest(8768,'/'),/<title>Huginn Connectivity Test/);
  const child=spawn('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File','C:/Huginn-App/launcher/test-source-host.ps1','-Development'],{windowsHide:true});
  let output='';child.stdout.on('data',b=>output+=b);child.stderr.on('data',b=>output+=b);
  const code=await new Promise(r=>child.on('exit',r));assert.equal(code,1);assert.match(output,/failed on fixed port 8768/);assert.doesNotMatch(output,/READY/);
 }finally{host.kill();}
});
test('real Edge IndexedDB local contract (synthetic qualification only)',{timeout:120000},async()=>{
 const result=await runBrowser();assert.equal(result.error,undefined,JSON.stringify(result));
 for(const r of result.results)assert.equal(r.pass,true,`${r.name}: ${r.error}\n${r.stack}`);
 console.log(`IndexedDB synthetic browser suite: ${result.passed} passed, ${result.failed} failed; exercised ${result.browser.product}`);assert.equal(result.failed,0);
});


const exec=promisify(execFile);
test('launcher binding and fixed production/development separation',async()=>{
 const production=await sourceHost({development:false}),development=await sourceHost();
 try{
  const {stdout}=await exec('powershell.exe',['-NoProfile','-Command',"Get-NetTCPConnection -State Listen -LocalPort 8767,8768 | Select-Object -ExpandProperty LocalAddress"],{windowsHide:true});
  const addresses=stdout.trim().split(/\r?\n/).map(s=>s.trim());assert.equal(addresses.length,2);assert.ok(addresses.every(s=>s==='127.0.0.1'));
  assert.match(await rawRequest(8767,'/'),/^HTTP\/1.1 200 /);assert.match(await rawRequest(8768,'/'),/^HTTP\/1.1 200 /);
  assert.match(await rawRequest(8767,'/',{host:'127.0.0.1:8768'}),/^HTTP\/1.1 400 /);
  assert.match(await rawRequest(8767,'/__test__/index.html'),/^HTTP\/1.1 404 /);
 }finally{production.kill();development.kill();}
});
