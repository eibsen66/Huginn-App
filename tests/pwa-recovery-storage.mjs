// Test-only subclass; served only by the P2 loopback allowlist.
import {FlightStorage as Base,evidenceKey} from './flight-storage.mjs';
export {evidenceKey};
export const plan={mode:null,count:0,writes:[],enabled:false};
export class FlightStorage extends Base {
  async commitRange(key,start,bytes){
    if(!this.db.name.startsWith('huginn-p2-'))throw Error('ISOLATION_REQUIRED');
    if(plan.enabled&&plan.mode==='before'&&plan.count===0)throw Error('P2_INTERRUPT');
    const result=await super.commitRange(key,start,bytes);
    if(plan.enabled){plan.count++;plan.writes.push(start);
      if(plan.count===plan.mode)throw Error('P2_INTERRUPT');}
    return result;
  }
  async importEvidence(key){
    if(plan.enabled&&plan.mode==='publication')throw Error('P2_INTERRUPT');
    plan.publishing=true;try{return await super.importEvidence(key);}finally{plan.publishing=false;}
  }
  async transaction(names,mode,work){
    if(!this.db.name.startsWith('huginn-p2-'))throw Error('ISOLATION_REQUIRED');
    if(plan.enabled&&mode==='readwrite'&&((plan.mode==='abort'&&names.includes('chunks'))||(plan.mode==='publishAbort'&&plan.publishing&&names.includes('flights')))){
      return super.transaction(names,mode,async tx=>{
        const result=await work(tx);tx.abort();return result;
      });
    }
    return super.transaction(names,mode,work);
  }
}
