import {readFile,writeFile} from 'node:fs/promises';
let s=await readFile('tests/pwa-reconnect-browser.test.mjs','utf8');
s=s.replace("if(globalThis.rejectFlights&&path.startsWith('/api/v1/flights'))", "if(globalThis.expireFlights&&path.startsWith('/api/v1/flights'))return new Response('{}',{status:401});if(globalThis.delayFlights&&path.startsWith('/api/v1/flights'))return new Promise(r=>globalThis.releaseOldFlight=r);if(globalThis.rejectFlights&&path.startsWith('/api/v1/flights'))");
const marker=' }finally{ws?.close();browser.kill();protocol.close();await new Promise(r=>server.close(r));}';
if(!s.includes(marker))throw Error('finally seam');
s=s.replace(marker,(await readFile('build/reconnect-review/browser-extra.txt','utf8'))+marker);
await writeFile('tests/pwa-reconnect-browser.test.mjs',s);
