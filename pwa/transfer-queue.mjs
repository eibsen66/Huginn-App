// A batch exists only after an explicit owner action. No retries or concurrency.
export function automaticCandidates(rows){return rows.filter(m=>m.eligible===true&&['COMPLETE','INCOMPLETE'].includes(m.state));}
export async function runSequential(rows,download,{signal,onProgress=()=>{}}={}){
 const completed=[];const total=rows.length;
 for(let index=0;index<total;index++){
  if(signal?.aborted)return {state:'CANCELLED',completed,total,next:rows[index]};
  const current=rows[index];onProgress({current,index,completed:completed.length,total});
  let ok;try{ok=await download(current);}catch(error){return {state:'FAILED',completed,total,failed:current,error};}
  if(ok!==true)return {state:signal?.aborted?'CANCELLED':'FAILED',completed,total,failed:current};
  completed.push(current);
 }
 return {state:'COMPLETE',completed,total};
}
