import {bytesOf} from './flight-evidence.mjs';
import {TRANSPORT_RANGE_BYTES} from './flight-size-policy.mjs';

export async function validateEvidenceInWorker(chunks,metadata,{signal,Worker=globalThis.Worker,onBuffers=()=>{}}={}){
  if(typeof Worker!=='function')throw Error('STREAM_WORKER_UNAVAILABLE');
  const worker=new Worker(new URL('./flight-stream-worker.mjs',import.meta.url),{type:'module'});
  let serial=0,pending=null,stopped=false,stoppedError;
  const stop=error=>{stopped=true;stoppedError??=error;if(pending){const p=pending;pending=null;p.reject(stoppedError);}};
  const abort=()=>stop(Error('CANCELLED'));
  worker.onmessage=({data})=>{
    if(!pending||data?.id!==pending.id){stop(Error('WORKER_PROTOCOL'));return;}
    const p=pending;pending=null;data.error?p.reject(Error(data.error)):p.resolve(data);
  };
  worker.onerror=()=>stop(Error('STREAM_WORKER_FAILED'));
  worker.onmessageerror=()=>stop(Error('STREAM_WORKER_FAILED'));
  const send=(kind,body={},transfer=[])=>new Promise((resolve,reject)=>{
    if(stopped||signal?.aborted){reject(stoppedError??Error('CANCELLED'));return;}
    if(pending){reject(Error('WORKER_CONCURRENT_MESSAGE'));return;}
    const id=++serial;pending={id,resolve,reject};
    try{worker.postMessage({id,kind,...body},transfer);}catch(e){pending=null;reject(e);}
  });
  signal?.addEventListener('abort',abort,{once:true});
  try{
    await send('init',{metadata});
    for await(const value of chunks){
      const b=bytesOf(value);if(!b.length||b.length>TRANSPORT_RANGE_BYTES)throw Error('STREAM_CHUNK_LENGTH');
      const copy=b.slice();onBuffers({message_bytes:copy.length,outstanding_messages:1});
      const response=await send('chunk',{bytes:copy.buffer},[copy.buffer]);
      if(response.accepted!==b.length)throw Error('WORKER_PROTOCOL');
    }
    return (await send('finish')).result;
  }finally{signal?.removeEventListener('abort',abort);worker.terminate();pending=null;}
}
