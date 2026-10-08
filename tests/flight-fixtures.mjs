// Synthetic bytes only. CRC table generator is independent of the production bitwise implementation.
import {createHash} from 'node:crypto';
export const source='AA:BB:CC:DD:EE:FF';
const table=Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
export function referenceCrc(bytes){let n=0xffffffff;for(const b of bytes)n=table[(n^b)&255]^(n>>>8);return (~n)>>>0;}
export function fixture(kind='complete',{version=2,start=1700000000n,runtime=301000000n,samples=0}={}) {
  const header=Buffer.alloc(128);header.write('HFL1');header[4]=version;header[5]=128;
  Buffer.from('00112233445566778899aabbccddeeff','hex').copy(header,8);header.writeBigInt64LE(start,32);
  header.writeUInt32LE(referenceCrc(header.subarray(0,124)),124);
  const definitions=[[2,0n],[3,0n]];
  if(kind!=='provisional')definitions.push([5,300000000n]);
  if(samples)for(let i=0;i<samples;i++)definitions.push([1,300000000n+BigInt(i)*100000n]);
  else definitions.push([1,kind==='provisional'?1000000n:runtime]);
  if(kind==='complete')definitions.push([4,runtime],[10,runtime]);
  const records=definitions.map(([type,at],i)=>{const r=Buffer.alloc(160);r.writeUInt32LE(i+1);r[4]=type;
    r.writeBigUInt64LE(at,8);r.writeBigInt64LE(start,16);if(type===1){r.writeInt32LE(1700000,24);r[124]=1;}
    r.writeUInt32LE(referenceCrc(r.subarray(0,156)),156);return r;});
  let raw=Buffer.concat([header,...records]);
  if(kind==='torn')raw=Buffer.concat([raw,Buffer.alloc(80,0xa5)]);
  if(kind==='corrupt')raw[128+3*160+24]^=1;
  const count=kind==='corrupt'?3:records.length;
  const metadata={source_device_id:source,session_id:'00112233445566778899aabbccddeeff',filename:'F123ABC.FLG',
    physical_sha256:createHash('sha256').update(raw).digest('hex'),physical_bytes:String(raw.length),start_utc:String(start),
    runtime_us:kind==='provisional'?'0':kind==='corrupt'?'300000000':String(runtime),record_count:count,
    valid_bytes:128+160*count,state:kind==='complete'?'COMPLETE':kind==='provisional'?'PROVISIONAL':kind==='corrupt'?'CORRUPT':'INCOMPLETE',
    complete:kind==='complete',integrity:kind==='corrupt'?3:kind==='torn'?2:1,hfl_version:version};
  metadata.metadata_sha256=createHash('sha256').update(referenceEncoding(metadata)).digest('hex');return {raw,metadata};
}
// Separate Buffer/concatenation reference: no production encoder imports and no shared offsets.
export function referenceEncoding(m){
  const u16=n=>{const b=Buffer.alloc(2);b.writeUInt16LE(n);return b;};
  const u32=n=>{const b=Buffer.alloc(4);b.writeUInt32LE(n);return b;};
  const u64=n=>{const b=Buffer.alloc(8);b.writeBigUInt64LE(BigInt(n));return b;};
  const i64=n=>{const b=Buffer.alloc(8);b.writeBigInt64LE(BigInt(n));return b;};
  return Buffer.concat([Buffer.from('HFCM'),u16(1),u16(11),Buffer.from(m.session_id,'hex'),Buffer.from(m.physical_sha256,'hex'),
    u64(m.physical_bytes),i64(m.start_utc),u64(m.runtime_us),u32(m.record_count),u32(m.valid_bytes),
    Buffer.from([{PROVISIONAL:1,QUALIFIED_OPEN:2,COMPLETE:3,INCOMPLETE:4,CORRUPT:5}[m.state],m.integrity,+m.complete,m.hfl_version]),
    Buffer.from(m.filename,'ascii'),Buffer.alloc(5)]);
}
