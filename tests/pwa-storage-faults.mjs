// Local-only P2 storage fault subclass. Never copied into production.
import {FlightStorage as Base} from './recovery-storage.mjs';
export {evidenceKey} from './flight-storage.mjs';
export const storagePlan={quota:null,writes:0,hold:false,paused:false,release:null};
export class FlightStorage extends Base {
 async commitRange(key,start,bytes){
  if(storagePlan.hold){storagePlan.paused=true;await new Promise(r=>storagePlan.release=r);storagePlan.hold=false;}
  const result=await super.commitRange(key,start,bytes);storagePlan.writes++;return result;
 }
 async importEvidence(key){
  storagePlan.publication=true;
  try{return await super.importEvidence(key);}finally{storagePlan.publication=false;}
 }
 async transaction(names,mode,work){
  const fail=storagePlan.quota;
  if(mode==='readwrite'&&((fail===0&&names.includes('chunks'))||(fail===4&&names.includes('chunks')&&storagePlan.writes===4)||(fail==='publication'&&storagePlan.publication&&names.includes('flights')))){
   return super.transaction(names,mode,async tx=>{
    await work(tx);throw new DOMException('P2 simulated quota exhaustion','QuotaExceededError');
   });
  }
  return super.transaction(names,mode,work);
 }
}
