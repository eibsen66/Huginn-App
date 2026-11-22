// Dedicated verifier: at most one outstanding 64 KiB message, no saved hash state.
import {StreamingSha256,StreamingHfl,validateStreamSummary} from './flight-stream.mjs';
import {MAX_PHYSICAL_BYTES,TRANSPORT_RANGE_BYTES} from './flight-size-policy.mjs';
import {encodeMetadata,bytesOf} from './flight-evidence.mjs';
let sha,parser,metadata,count=0,finished=false,working=false;
self.onmessage=async({data})=>{
  if(working){self.postMessage({id:data?.id,error:'WORKER_CONCURRENT_MESSAGE'});self.close();return;}
  working=true;
  try{
    const {id,kind}=data;if(!Number.isSafeInteger(id))throw Error('WORKER_PROTOCOL');
    if(kind==='init'){
      if(sha||finished)throw Error('WORKER_PROTOCOL');metadata=data.metadata;encodeMetadata(metadata);
      const total=Number(metadata.physical_bytes);
      if(!Number.isSafeInteger(total)||total<128||total>MAX_PHYSICAL_BYTES)throw Error('FILE_SIZE_LIMIT');
      sha=new StreamingSha256();parser=new StreamingHfl();self.postMessage({id,ready:true});
    }else if(kind==='chunk'){
      if(!sha||finished)throw Error('WORKER_PROTOCOL');const b=bytesOf(data.bytes);
      if(!b.length||b.length>TRANSPORT_RANGE_BYTES||count+b.length>Number(metadata.physical_bytes))throw Error('STREAM_CHUNK_LENGTH');
      sha.update(b);parser.update(b);count+=b.length;self.postMessage({id,accepted:b.length});
    }else if(kind==='finish'){
      if(!sha||finished)throw Error('WORKER_PROTOCOL');finished=true;
      if(count!==Number(metadata.physical_bytes))throw Error('DOWNLOAD_INCOMPLETE');
      self.postMessage({id,result:await validateStreamSummary(parser.finish(),sha.digest(),metadata)});
      sha=null;parser=null;metadata=null;
    }else throw Error('WORKER_PROTOCOL');
  }catch(e){finished=true;sha=null;parser=null;metadata=null;self.postMessage({id:data?.id,error:e.message});}
  finally{working=false;}
};
