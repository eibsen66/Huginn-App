// Ordered strict-IDB reader and atomic publication. Existing byte layout is unchanged.
import {FlightStorage,evidenceKey,sessionKey} from './flight-storage.mjs';
import {bytesOf,sha256,hexBytes,RANGE_BYTES,encodeMetadata,metadataSha256} from './flight-evidence.mjs';
import {validateEvidenceInWorker} from './flight-stream-client.mjs';
import {StreamingSha256} from './flight-stream.mjs';
import {MAX_PHYSICAL_BYTES} from './flight-size-policy.mjs';

const req=r=>new Promise((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
const fail=code=>{throw Error(code);};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const version=d=>[d?.stream_instance,d?.stream_revision,d?.committed_offset,d?.phase,d?.metadata?.metadata_sha256];
export class StreamFlightStorage extends FlightStorage {
  constructor(db,options={}){super(db,options);this.validateStream=options.validateStream??validateEvidenceInWorker;this.receipts=new Map();}
  async createStaging(metadata){
    const m=structuredClone(metadata);encodeMetadata(m);
    if(['token','prepared','prepared_handle'].some(k=>Object.hasOwn(m,k)))fail('INVALID_SOURCE_DEVICE');
    if(typeof m.source_device_id!=='string'||!/^(?:[0-9A-F]{2}:){5}[0-9A-F]{2}$/.test(m.source_device_id))fail('INVALID_SOURCE_DEVICE');
    if(await metadataSha256(m)!==m.metadata_sha256)fail('METADATA_DIGEST_MISMATCH');
    const E=evidenceKey(m),S=sessionKey(m);
    return this.transaction(['downloads','flights'],'readwrite',async tx=>{
      const ds=tx.objectStore('downloads'),fs=tx.objectStore('flights'),existing=await req(ds.get(E));
      if(existing)return existing;
      const conflict=!!(await req(ds.index('session').count(S)))||!!(await req(fs.index('session').count(S)));
      const record={session:S,metadata:m,phase:'STAGING',committed_offset:'0',conflict,owner_accepted:false,stream_instance:crypto.randomUUID(),stream_revision:0};
      await req(ds.add(record,E));return record;
    });
  }
  summary(pin,validation=null){return {session:sessionKey(pin.metadata),metadata:pin.metadata,validation,
    local_state:'STORED_LOCAL_AWAITING_VERIFICATION',ack_status:'NONE',conflict:pin.conflict,owner_accepted:pin.owner_accepted===true};}
  async listFlights(){
    // Read keys only: old flight values can contain whole record-object arrays.
    const keys=await this.transaction(['flights'],'readonly',tx=>req(tx.objectStore('flights').getAllKeys()));
    const out=[];for(const E of keys){const d=await this.get('downloads',E);if(!d||d.phase!=='IMPORTED')fail('STAGING_CHANGED');out.push(this.summary(d));}return out;
  }
  async pinEvidence(E,{allowPartial=false}={}){
    // Give legacy staging its own instance in a short transaction before reading.
    // No capability, SHA state or file-sized object is persisted.
    return this.transaction(['downloads','chunks'],'readwrite',async tx=>{
      const ds=tx.objectStore('downloads'),d=await req(ds.get(E));if(!d)fail('DOWNLOAD_NOT_FOUND');
      if(!same(evidenceKey(d.metadata),E))fail('LOCAL_OWNERSHIP_MISMATCH');
      const total=Number(d.metadata.physical_bytes),committed=Number(d.committed_offset);
      if(!Number.isSafeInteger(total)||total<128||total>MAX_PHYSICAL_BYTES)fail('FILE_SIZE_LIMIT');
      if(typeof d.committed_offset!=='string'||!/^(0|[1-9][0-9]*)$/.test(d.committed_offset)||
         !Number.isSafeInteger(committed)||committed<0||committed>total||
         committed<total&&committed%RANGE_BYTES)fail('CHUNK_REVALIDATION_FAILED');
      if(!allowPartial&&committed!==total)fail('DOWNLOAD_INCOMPLETE');
      if(d.phase==='QUARANTINED')fail('CHUNK_REVALIDATION_FAILED');
      if(!d.stream_instance){d.stream_instance=crypto.randomUUID();d.stream_revision=0;await req(ds.put(d,E));}
      if(typeof d.stream_instance!=='string'||!Number.isSafeInteger(d.stream_revision)||d.stream_revision<0)fail('STAGING_CHANGED');
      const count=await req(tx.objectStore('chunks').index('evidence').count(E));
      if(count!==Math.ceil(committed/RANGE_BYTES))fail('CHUNK_REVALIDATION_FAILED');
      return d;
    });
  }
  async assertPinned(E,pin,tx){
    const d=await req(tx.objectStore('downloads').get(E));
    if(!d||!same(version(d),version(pin))||!same(d.metadata,pin.metadata))fail('STAGING_CHANGED');
    return d;
  }
  async *orderedChunks(E,pin,{signal,onChunk=()=>{}}={}){
    const committed=Number(pin.committed_offset),total=Number(pin.metadata.physical_bytes);
    for(let offset=0;offset<committed;offset+=RANGE_BYTES){
      if(signal?.aborted)fail('CANCELLED');
      const c=await this.transaction(['downloads','chunks'],'readonly',async tx=>{
        await this.assertPinned(E,pin,tx);return req(tx.objectStore('chunks').get([...E,String(offset)]));
      });
      if(!c||!same(c.evidence,E)||c.start_offset!==String(offset))fail('CHUNK_REVALIDATION_FAILED');
      const b=bytesOf(c.bytes),expected=Math.min(RANGE_BYTES,total-offset);
      if(c.length!==expected||b.length!==expected||offset+b.length>committed)fail('CHUNK_REVALIDATION_FAILED');
      const actual=await sha256(b);if(actual!==c.chunk_sha256)fail('CHUNK_REVALIDATION_FAILED');
      onChunk({offset,bytes:b.length,sha256:actual});yield b;
    }
    await this.transaction(['downloads','chunks'],'readonly',async tx=>{
      await this.assertPinned(E,pin,tx);
      if(await req(tx.objectStore('chunks').index('evidence').count(E))!==Math.ceil(committed/RANGE_BYTES))fail('CHUNK_REVALIDATION_FAILED');
    });
  }
  async validateStored(E,{signal,onChunk}={}){
    const pin=await this.pinEvidence(E),validation=await this.validateStream(this.orderedChunks(E,pin,{signal,onChunk}),pin.metadata,{signal});
    return {pin,validation};
  }
  async commitRange(E,start,value){
    const bytes=bytesOf(value).slice(),chunk_sha256=await sha256(bytes);
    if(typeof start!=='string'||!/^(0|[1-9][0-9]*)$/.test(start))fail('INVALID_OFFSET');
    return this.transaction(['downloads','chunks'],'readwrite',async tx=>{
      const ds=tx.objectStore('downloads'),cs=tx.objectStore('chunks'),d=await req(ds.get(E));
      if(!d||d.phase!=='STAGING'||d.committed_offset!==start)fail('NONCONTIGUOUS_RANGE');
      const total=Number(d.metadata.physical_bytes),offset=Number(start);
      if(!Number.isSafeInteger(total)||total<128||total>MAX_PHYSICAL_BYTES||!Number.isSafeInteger(offset))fail('FILE_SIZE_LIMIT');
      const expected=Math.min(RANGE_BYTES,total-offset);
      if(expected<=0||bytes.length!==expected||offset%RANGE_BYTES)fail('INVALID_RANGE_LENGTH');
      if(!d.stream_instance){d.stream_instance=crypto.randomUUID();d.stream_revision=0;}
      if(!Number.isSafeInteger(d.stream_revision)||d.stream_revision>=Number.MAX_SAFE_INTEGER)fail('STAGING_CHANGED');
      await req(cs.add({evidence:E,start_offset:start,length:bytes.length,chunk_sha256,bytes:bytes.buffer},[...E,start]));
      d.committed_offset=String(offset+bytes.length);d.stream_revision++;await req(ds.put(d,E));return d;
    });
  }
  async resume(E,{signal}={}){
    try{const pin=await this.pinEvidence(E,{allowPartial:true});for await(const ignored of this.orderedChunks(E,pin,{signal})){void ignored;}return pin;}
    catch(e){
      // Cancellation is not evidence corruption. Preserve unrelated/new instances.
      if(e.message!=='CANCELLED'&&e.message!=='STAGING_CHANGED')await this.transaction(['downloads'],'readwrite',async tx=>{
        const ds=tx.objectStore('downloads'),d=await req(ds.get(E));if(d&&d.phase==='STAGING'){d.phase='QUARANTINED';await req(ds.put(d,E));}
      });throw e;
    }
  }
  async importEvidence(E,{shouldPublish=()=>true,signal}={}){
    const {pin,validation}=await this.validateStored(E,{signal});
    if(signal?.aborted||!shouldPublish())fail('CANCELLED');
    let abortTransaction;
    try{return await this.transaction(['downloads','flights'],'readwrite',async tx=>{
      abortTransaction=()=>{try{tx.abort();}catch{}};
      signal?.addEventListener('abort',abortTransaction,{once:true});
      if(signal?.aborted)fail('CANCELLED');
      const current=await this.assertPinned(E,pin,tx);
      if(signal?.aborted||!shouldPublish())fail('CANCELLED');
      const ds=tx.objectStore('downloads'),fs=tx.objectStore('flights'),existing=await req(fs.count(E));
      if(existing)return this.summary(current,validation.parsed);
      const flight={session:sessionKey(current.metadata),metadata:current.metadata,validation:validation.parsed,
        local_state:'STORED_LOCAL_AWAITING_VERIFICATION',ack_status:'NONE',conflict:current.conflict,owner_accepted:false};
      if(signal?.aborted||!shouldPublish())fail('CANCELLED');
      await req(fs.add(flight,E));
      if(signal?.aborted||!shouldPublish())fail('CANCELLED');
      current.phase='IMPORTED';await req(ds.put(current,E));return flight;
    });}finally{if(abortTransaction)signal?.removeEventListener('abort',abortTransaction);}
  }
  async reopen(E,{signal,useReceipt=false}={}){
    if(!await this.transaction(['flights'],'readonly',tx=>req(tx.objectStore('flights').count(E))))fail('FLIGHT_NOT_IMPORTED');
    const pin=await this.pinEvidence(E);if(pin.phase!=='IMPORTED')fail('STAGING_CHANGED');
    const key=JSON.stringify(E),receipt=this.receipts.get(key);
    if(useReceipt&&receipt&&same(receipt.version,version(pin)))return this.summary(pin,receipt.validation);
    const validation=await this.validateStream(this.orderedChunks(E,pin,{signal}),pin.metadata,{signal});
    this.receipts.set(key,{version:version(pin),validation:validation.parsed});return this.summary(pin,validation.parsed);
  }
  async createVerifiedExportStream(E,{signal,onBuffers=()=>{}}={}){
    const pin=await this.pinEvidence(E);
    if(pin.phase!=='IMPORTED')fail('FLIGHT_NOT_IMPORTED');
    const total=Number(pin.metadata.physical_bytes),digests=new Uint8Array(Math.ceil(total/RANGE_BYTES)*32);
    // Independent whole-file verification establishes this private digest table.
    // Never trust saved chunk hashes as export authority after this pass.
    await this.validateStream(this.orderedChunks(E,pin,{signal,onChunk:c=>digests.set(hexBytes(c.sha256,32),c.offset/RANGE_BYTES*32)}),pin.metadata,{signal});
    const iterator=this.orderedChunks(E,pin,{signal})[Symbol.asyncIterator](),sha=new StreamingSha256();
    let offset=0,ended=false;
    const cleanup=async()=>{ended=true;digests.fill(0);await iterator.return?.();};
    const stream=new ReadableStream({
      pull:async controller=>{
        if(ended)return;
        try{
          if(signal?.aborted)fail('CANCELLED');
          const next=await iterator.next();if(next.done)fail('DOWNLOAD_INCOMPLETE');
          if(signal?.aborted)fail('CANCELLED');
          const b=next.value,actual=hexBytes(await sha256(b),32),i=offset/RANGE_BYTES*32;
          if(actual.some((v,n)=>v!==digests[i+n]))fail('EXPORT_CHANGED');
          sha.update(b);offset+=b.length;
          if(signal?.aborted)fail('CANCELLED');
          // Hold the final bytes until EOF, version and independent whole-SHA pass.
          // A caller cannot receive all declared bytes before the final check.
          if(offset===total){
            if(!(await iterator.next()).done||sha.digest()!==pin.metadata.physical_sha256)fail('EXPORT_CHANGED');
            await cleanup();controller.enqueue(b);controller.close();
          }else{
            if(offset>total)fail('EXPORT_CHANGED');controller.enqueue(b);
          }
          onBuffers({digest_table_bytes:digests.byteLength,chunk_bytes:b.length,queued_chunks:1});
        }catch(e){await cleanup();controller.error(e);}
      },
      cancel:async()=>{await cleanup();}
    },{highWaterMark:0});
    return {stream,filename:pin.metadata.filename,physical_bytes:total,sha256:pin.metadata.physical_sha256,
      scope:'BYTE_VERIFIED_STREAM_NOT_RECIPIENT_ACCEPTANCE'};
  }
}
