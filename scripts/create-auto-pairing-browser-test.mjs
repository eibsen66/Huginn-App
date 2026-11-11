import {readFile,writeFile} from 'node:fs/promises';
let s=await readFile('tests/pwa-reconnect-browser.test.mjs','utf8');
s=s.slice(0,s.indexOf("  await wait(\"document.querySelector('#source-status').textContent"));
s=s.replace("running PWA reconnect after consumed pairing and transport failure", "automatic QR pairing validates, connects once, cancels and retries without confirmation");
// A test-only scanner fault duplicates its valid callback. Product bytes stay frozen.
const seam="if(req.url.startsWith('/__device/'))";
s=s.replace(seam,`if(req.url==='/pairing-scanner.mjs'){readFile('dist/pwa/pairing-scanner.mjs','utf8').then(text=>{res.writeHead(200,{'Content-Type':'text/javascript'});res.end(text.replace('onValid(text,parsed);','onValid(text,parsed);onValid(text,parsed);'));});return;}if(req.url.startsWith('/__device/'))`);
const setupStart=s.indexOf('  await evaluate(`globalThis.calls=[];');
let setup=s.slice(setupStart);
setup=setup.slice(0,setup.indexOf("document.querySelector('#open-connection').click();"))+"`);\n";
s=s.slice(0,setupStart)+setup;
const body=await readFile('tests/auto-pairing-browser-body.txt','utf8');
s+=body;
await writeFile('tests/pwa-auto-pairing-browser.test.mjs',s);
