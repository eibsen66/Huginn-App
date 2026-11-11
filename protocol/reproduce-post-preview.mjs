// Actual host owner implementation; network/AES seams are fixtures, not a board.
import {settingsHost} from '../tests/settings-protocol-host.mjs';
import {createV2SettingsSession} from '../dist/pwa/settings-v2.mjs';
import {createBrowserSource} from '../dist/pwa/source.mjs';
import {readFile,writeFile,mkdir} from 'node:fs/promises';import {execFileSync} from 'node:child_process';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
const out='build/immediate-edit-preview-review',h=settingsHost();await mkdir(out,{recursive:true});
let truncate=false,post=0,lastBytes;
const opts={origin:'https://192.168.4.1',selectedOrigin:'https://192.168.4.1',profile:'DEV_BROWSER_OS_TLS_V1',pairing:JSON.stringify({schema:'huginn.flight-courier.pair',schema_version:1,source_device_id:'AA:BB:CC:DD:EE:FF',tls_spki_sha256:'6'.repeat(64),token:'A'.repeat(43)})};
const s=createBrowserSource({...opts,fetch:async(url,o)=>{
 const get=o.method==='GET';assert(get||url.endsWith('/preview'),'No apply request permitted in this fixture');
 const data=await h.request(get?{method:'get'}:{method:'preview',raw:new TextDecoder().decode(o.body)});if(!get)post++;
 const bytes=new TextEncoder().encode(JSON.stringify(data));if(!get)lastBytes=bytes;
 if(!get&&truncate){let sent=false;return new Response(new ReadableStream({pull(c){if(!sent){sent=true;c.enqueue(bytes.subarray(0,4096));}else c.error(TypeError('injected transport failure'));}}),{status:200,headers:{'Content-Length':String(bytes.length)}});}
 return new Response(bytes,{status:200,headers:{'Content-Length':String(bytes.length)}});
}});
try{
 const session=createV2SettingsSession(s);await session.load();const baseline=session.confirmed,initial=baseline['display.brightness_percent'],d=session.draft;d['display.brightness_percent']=initial===80?79:80;await session.edit(d);
 for(let i=0;i<50;i++)await session.preview();assert.equal(session.state,'previewed');await writeFile(out+'/host-full-preview.json',lastBytes);
 truncate=true;let diagnostic;await assert.rejects(session.preview(),e=>{diagnostic=e.diagnostic;return diagnostic.code==='RESPONSE_READ_FAILED'&&diagnostic.httpStatus===200&&diagnostic.receivedBytes===4096&&diagnostic.phase==='body';});
 await assert.rejects(session.apply(),/PREVIEW_REQUIRED/);assert.deepEqual(session.confirmed,baseline);assert.equal(session.draft['display.brightness_percent'],d['display.brightness_percent']);const after=await h.request({method:'get'});assert.deepEqual(Object.fromEntries(after.fields.map(f=>[f.id,f.value])),baseline);
 const report={meaning:'HOST owner response + injected stream failure; not physical mechanism proof',post_preview_requests:post,host_initial:initial,host_draft:d['display.brightness_percent'],serialized_preview_bytes:lastBytes.length,failed_preview_diagnostic:diagnostic,apply_requests:0,authoritative_values_unchanged:true};
 await writeFile(out+'/post-host-result.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
 // Reuse the previously tested actual bounce routine, adapted only to the
 // serialized POST fixture and its byte length. Do not rewrite retained tests.
 let c=await readFile('build/aes-scratch-candidate/host.c','utf8');c=c.replaceAll('29502',String(lastBytes.length)).replace('/mnt/c/HuginnAPP/build/settings-send-review/settings-full-'+lastBytes.length+'.json','/mnt/c/HuginnAPP/'+out+'/host-full-preview.json');
 await writeFile(out+'/post-aes-host.c',c);
 const w=p=>p.replace('C:/','/mnt/c/');const run=args=>execFileSync('wsl',['-d','Ubuntu','--exec',...args],{encoding:'utf8',windowsHide:true});
 run(['gcc','-std=c11','-D_POSIX_C_SOURCE=200112L','-Wall','-Wextra','-Werror','-fsanitize=address,undefined','-g',w('C:/HuginnAPP/'+out+'/post-aes-host.c'),'-lcrypto','-pthread','-o',w('C:/HuginnAPP/'+out+'/post-aes-host')]);const log=run([w('C:/HuginnAPP/'+out+'/post-aes-host')]);await writeFile(out+'/post-aes-host.log',log);console.log(log);
 await writeFile(out+'/post-host-pins.json',JSON.stringify({firmware_include_sha256:createHash('sha256').update(await readFile('C:/HuginnEIS/Huginn/Firmware/huginn/main/huginn_settings_v2.inc')).digest('hex'),preview_sha256:createHash('sha256').update(lastBytes).digest('hex'),host_checks_passed:true,physical_post_test:false},null,2));
}finally{s.close();h.close();}
