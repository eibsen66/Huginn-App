// Bounded primitives for durable-file verification. No IO or publication authority.
import {bytesOf,crc32,hexOf,encodeMetadata,metadataSha256} from './flight-evidence.mjs';
import {MAX_PHYSICAL_BYTES,TRANSPORT_RANGE_BYTES} from './flight-size-policy.mjs';

const K=new Uint32Array([
  0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
  0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
  0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
  0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
  0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
  0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
  0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
  0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2]);
const rotr=(x,n)=>(x>>>n)|(x<<(32-n));
const fail=code=>{throw Error(code);};
export class StreamingSha256 {
  constructor(){
    this.state=new Uint32Array([0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19]);
    this.block=new Uint8Array(64);this.words=new Uint32Array(64);this.used=0;this.length=0;this.finished=false;
  }
  compress(b,offset=0){
    const w=this.words,d=new DataView(b.buffer,b.byteOffset+offset,64);
    for(let i=0;i<16;i++)w[i]=d.getUint32(i*4);
    for(let i=16;i<64;i++){
      const x=w[i-15],y=w[i-2];
      w[i]=w[i-16]+(rotr(x,7)^rotr(x,18)^(x>>>3))+w[i-7]+(rotr(y,17)^rotr(y,19)^(y>>>10));
    }
    let [a,b0,c,d0,e,f,g,h]=this.state;
    for(let i=0;i<64;i++){
      const t1=(h+(rotr(e,6)^rotr(e,11)^rotr(e,25))+((e&f)^(~e&g))+K[i]+w[i])>>>0;
      const t2=((rotr(a,2)^rotr(a,13)^rotr(a,22))+((a&b0)^(a&c)^(b0&c)))>>>0;
      h=g;g=f;f=e;e=(d0+t1)>>>0;d0=c;c=b0;b0=a;a=(t1+t2)>>>0;
    }
    for(const [i,v] of [a,b0,c,d0,e,f,g,h].entries())this.state[i]=(this.state[i]+v)>>>0;
  }
  update(value){
    if(this.finished)fail('HASH_FINISHED');
    const b=bytesOf(value);if(!Number.isSafeInteger(this.length+b.length))fail('HASH_LENGTH');this.length+=b.length;
    let offset=0;
    if(this.used){const n=Math.min(64-this.used,b.length);this.block.set(b.subarray(0,n),this.used);this.used+=n;offset+=n;
      if(this.used===64){this.compress(this.block);this.used=0;}}
    while(offset+64<=b.length){this.compress(b,offset);offset+=64;}
    if(offset<b.length){this.block.set(b.subarray(offset));this.used=b.length-offset;}
    return this;
  }
  digest(){
    if(this.finished)fail('HASH_FINISHED');this.finished=true;
    this.block[this.used++]=128;
    if(this.used>56){this.block.fill(0,this.used);this.compress(this.block);this.used=0;}
    this.block.fill(0,this.used,56);new DataView(this.block.buffer).setBigUint64(56,BigInt(this.length)*8n);
    this.compress(this.block);const out=new Uint8Array(32),d=new DataView(out.buffer);
    for(let i=0;i<8;i++)d.setUint32(i*4,this.state[i]);
    this.block.fill(0);this.words.fill(0);return hexOf(out);
  }
}

// One header and one fixed record; never retains sample objects or input chunks.
export class StreamingHfl {
  constructor(){
    this.pending=new Uint8Array(160);this.used=0;this.physical=0;this.header=null;
    this.count=0;this.offset=128;this.integrity=1;this.issue=null;this.complete=false;this.qualified=false;
    this.running=false;this.lost=false;this.runStart=0n;this.runtime=0n;this.last=0n;this.haveLast=false;
    this.expectedSequence=1;this.sequenceValid=true;this.monotonicValid=true;this.lastType=null;this.stopped=false;this.finished=false;
  }
  update(value){
    if(this.finished)fail('PARSER_FINISHED');const b=bytesOf(value);this.physical+=b.length;
    if(!Number.isSafeInteger(this.physical))fail('HFL_LENGTH');
    let at=0;
    while(at<b.length&&!this.stopped){
      const target=this.header===null?128:160,n=Math.min(target-this.used,b.length-at);
      this.pending.set(b.subarray(at,at+n),this.used);this.used+=n;at+=n;
      if(this.used!==target)continue;
      if(this.header===null)this.parseHeader();else this.parseRecord();this.used=0;
    }
    return this;
  }
  parseHeader(){
    const b=this.pending,d=new DataView(b.buffer);
    this.version=b[4];
    if(String.fromCharCode(...b.subarray(0,4))!=='HFL1'||b[5]!==128)this.headerStatus='INVALID_HEADER';
    else if(d.getUint32(124,true)!==crc32(b.subarray(0,124)))this.headerStatus='BAD_HEADER_CRC';
    else if(![1,2].includes(this.version))this.headerStatus='UNSUPPORTED_HFL_VERSION';
    else{this.headerStatus='VALID';this.session=hexOf(b.subarray(8,24));this.startUtc=d.getBigInt64(32,true).toString();}
    this.header=true;if(this.headerStatus!=='VALID')this.stopped=true;
  }
  parseRecord(){
    const r=this.pending,d=new DataView(r.buffer),type=r[4];
    if(d.getUint32(156,true)!==crc32(r.subarray(0,156))||type<1||type>10){
      this.integrity=3;this.issue='RECORD_CORRUPTION';this.corruptEnd=this.offset+160;this.stopped=true;return;
    }
    const seq=d.getUint32(0,true),at=d.getBigUint64(8,true);
    if(seq!==this.expectedSequence)this.sequenceValid=false;this.expectedSequence=seq+1;
    if(this.haveLast&&at<this.last)this.monotonicValid=false;this.haveLast=true;this.last=at;this.lastType=type;
    this.count++;this.offset+=160;
    if(type===5)this.qualified=true;
    if(type===3||type===8||(this.version===1&&type===2)){
      if(!this.running){this.running=true;this.runStart=at;}
    }else if(type===4||type===6){
      if(this.running&&!this.lost&&at>=this.runStart)this.runtime+=at-this.runStart;
      this.running=false;this.lost=type===6;
    }else if(type===7)this.lost=false;
    else if(this.version===1&&type===1&&r[124]===1){
      const rpm=d.getInt32(24,true);if(this.lost)this.lost=false;
      if(rpm>=700000&&!this.running){this.running=true;this.runStart=at;}
      else if(rpm<700000&&this.running){if(!this.lost&&at>=this.runStart)this.runtime+=at-this.runStart;this.running=false;}
    }else if(this.version===1&&type===1){
      if(this.running&&!this.lost&&at>=this.runStart)this.runtime+=at-this.runStart;
      this.running=false;this.lost=true;
    }else if(type===10){
      if(this.running&&!this.lost&&at>=this.runStart)this.runtime+=at-this.runStart;
      this.running=false;this.complete=true;if(this.version===1)this.stopped=true;
    }
  }
  finish(){
    if(this.finished)fail('PARSER_FINISHED');this.finished=true;
    const physical_bytes=String(this.physical);
    if(this.header===null||this.headerStatus!=='VALID')return {header_valid:false,
      header_status:this.header===null?'TRUNCATED_HEADER':this.headerStatus,session_id:null,
      hfl_version:this.physical>4?this.pending[4]:null,physical_bytes,record_count:0,valid_bytes:0,
      integrity:3,state:'CORRUPT',complete:false,session_complete:false,terminal_session_complete:false};
    if(this.issue==='RECORD_CORRUPTION')this.issue=this.corruptEnd<this.physical?'INTERIOR_RECORD_CORRUPTION':'FINAL_RECORD_CORRUPTION';
    else if(this.version===1&&this.complete&&this.offset<this.physical){this.integrity=3;this.issue='DATA_AFTER_V1_COMPLETE';}
    else if(this.used){this.integrity=2;this.issue='TORN_FINAL_RECORD';}
    if(!this.complete&&this.running&&!this.lost&&this.haveLast&&this.last>=this.runStart)this.runtime+=this.last-this.runStart;
    return {header_valid:true,header_status:'VALID',session_id:this.session,hfl_version:this.version,physical_bytes,
      start_utc:this.startUtc,record_count:this.count,valid_bytes:this.offset,integrity:this.integrity,issue:this.issue,
      session_complete:this.complete,terminal_session_complete:this.lastType===10,complete:this.integrity!==3&&this.complete,
      state:this.integrity===3?'CORRUPT':this.complete?'COMPLETE':this.qualified?'INCOMPLETE':'PROVISIONAL',
      runtime_us:(this.qualified?this.runtime:0n).toString(),sequence_valid:this.sequenceValid,monotonic_valid:this.monotonicValid,
      trust_boundary:this.integrity===3?'FORENSIC_PREFIX':'AUTHORITATIVE_PREFIX'};
  }
}

export async function validateEvidenceStream(chunks,m,{signal,maxBytes=MAX_PHYSICAL_BYTES}={}){
  encodeMetadata(m);
  const total=Number(m.physical_bytes);
  if(!Number.isSafeInteger(total)||total<128||total>maxBytes)fail('FILE_SIZE_LIMIT');
  const sha=new StreamingSha256(),parser=new StreamingHfl();let count=0;
  for await(const value of chunks){
    if(signal?.aborted)fail('CANCELLED');const b=bytesOf(value);
    // The caller must provide bounded chunks, rather than hiding a full-file allocation.
    if(!b.length||b.length>TRANSPORT_RANGE_BYTES||count+b.length>total)fail('STREAM_CHUNK_LENGTH');
    sha.update(b);parser.update(b);count+=b.length;
  }
  if(signal?.aborted)fail('CANCELLED');if(count!==total)fail('DOWNLOAD_INCOMPLETE');
  return validateStreamSummary(parser.finish(),sha.digest(),m);
}

export async function validateStreamSummary(parsed,physical_sha256,m){
  encodeMetadata(m);const metadata_sha256=await metadataSha256(m);
  if(!parsed.header_valid)fail(parsed.header_status);
  if(physical_sha256!==m.physical_sha256||metadata_sha256!==m.metadata_sha256)fail('IDENTITY_MISMATCH');
  for(const field of ['session_id','hfl_version','physical_bytes','start_utc','record_count','valid_bytes','integrity','state','complete','runtime_us'])
    if(parsed[field]!==m[field])fail(`METADATA_MISMATCH_${field}`);
  if(!parsed.sequence_valid||!parsed.monotonic_valid)fail('INVALID_RECORD_SEQUENCE');
  if(m.state==='QUALIFIED_OPEN')fail('ACTIVE_FLIGHT');
  return {parsed,physical_sha256,metadata_sha256};
}
