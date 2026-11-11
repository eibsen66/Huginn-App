import {spawn} from 'node:child_process';import {createInterface} from 'node:readline';
import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
export function settingsHost(){
 const pins=JSON.parse(readFileSync('build/settings-protocol-host/pins.json','utf8'));for(const [path,hash] of Object.entries(pins))if(createHash('sha256').update(readFileSync(path)).digest('hex')!==hash)throw Error('HOST_MODEL_STALE: run node protocol/prepare-host.mjs');
 const child=spawn('wsl',['-d','Ubuntu','--exec','stdbuf','-oL','/mnt/c/HuginnAPP/build/settings-protocol-host/model'],{windowsHide:true,stdio:['pipe','pipe','pipe']});const pending=[];let stderr='';child.stderr.on('data',b=>stderr+=b);
 createInterface({input:child.stdout}).on('line',line=>{const p=pending.shift();if(p){clearTimeout(p.timer);try{p.resolve(JSON.parse(line));}catch(e){p.reject(e);}}});
 child.on('error',err=>{for(const p of pending.splice(0)){clearTimeout(p.timer);p.reject(err);}});child.on('exit',code=>{for(const p of pending.splice(0)){clearTimeout(p.timer);p.reject(Error('HOST_EXIT '+code+' '+stderr));}});
 return {request(message){return new Promise((resolve,reject)=>{const p={resolve,reject,timer:setTimeout(()=>reject(Error('PROTOCOL_HOST_TIMEOUT')),15000)};pending.push(p);child.stdin.write(JSON.stringify(message)+'\n');});},close(){child.stdin.end();child.kill();}};
}
