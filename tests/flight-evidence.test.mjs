import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {parseHfl,crc32,sha256,encodeMetadata,metadataSha256,validateEvidence,hexOf} from '../flight-evidence.mjs';
import {fixture,referenceCrc} from './flight-fixtures.mjs';
const asset=JSON.parse(await readFile(new URL('./fixtures/flight-v1-vectors.json',import.meta.url),'utf8'));
for(const v of asset.vectors)test(`frozen vector ${v.name}`,async()=>{
  const raw=Buffer.from(v.hfl_hex,'hex');assert.equal(hexOf(encodeMetadata(v.metadata)),v.encoded_hex);
  assert.equal(await sha256(raw),v.physical_sha256);assert.equal(await metadataSha256(v.metadata),v.metadata_sha256);
  assert.equal(createHash('sha256').update(Buffer.from(v.encoded_hex,'hex')).digest('hex'),v.metadata_sha256);
  await validateEvidence(raw,v.metadata);
});
test('CRC known vector, slice boundaries, and raw bytes unchanged',async()=>{
 assert.equal(crc32(new TextEncoder().encode('123456789')),0xcbf43926);
 const {raw,metadata}=fixture('torn'),before=raw.toString('hex');await validateEvidence(raw,metadata);assert.equal(raw.toString('hex'),before);
 const padded=Buffer.concat([Buffer.alloc(9),raw,Buffer.alloc(9)]);assert.equal(await sha256(padded.subarray(9,-9)),await sha256(raw));
});
for(const [kind,state,integrity] of [['complete','COMPLETE',1],['incomplete','INCOMPLETE',1],['torn','INCOMPLETE',2],['corrupt','CORRUPT',3],['provisional','PROVISIONAL',1]])
 test(`classification ${kind}`,()=>{const {raw}=fixture(kind);const p=parseHfl(raw);assert.equal(p.state,state);assert.equal(p.integrity,integrity);
 assert.equal(p.physical_bytes,String(raw.length));assert.equal(p.valid_bytes,128+160*p.record_count);});
test('bad/truncated/unsupported headers are untrusted',()=>{
 const {raw}=fixture();assert.equal(parseHfl(raw.subarray(0,127)).header_status,'TRUNCATED_HEADER');
 const bad=Buffer.from(raw);bad[10]^=1;assert.equal(parseHfl(bad).header_status,'BAD_HEADER_CRC');
 bad[10]^=1;bad[4]=3;bad.writeUInt32LE(referenceCrc(bad.subarray(0,124)),124);
 assert.equal(parseHfl(bad).header_status,'UNSUPPORTED_HFL_VERSION');assert.equal(parseHfl(bad).session_id,null);
});
test('v1 terminal authority differs from v2 trailing records',()=>{
 for(const version of [1,2]){const {raw}=fixture('complete',{version});const extra=Buffer.from(raw.subarray(128,288));
 extra.writeUInt32LE(7);extra.writeUInt32LE(referenceCrc(extra.subarray(0,156)),156);
 const p=parseHfl(Buffer.concat([raw,extra]));assert.equal(p.session_complete,true);assert.equal(p.integrity,version===1?3:1);}
});
test('bad final full record is corrupt, not a torn tail',()=>{const {raw}=fixture();raw[raw.length-1]^=1;
 const p=parseHfl(raw);assert.equal(p.integrity,3);assert.equal(p.issue,'FINAL_RECORD_CORRUPTION');assert.equal(p.complete,false);});
test('encoder rejects ambiguous integers, IDs, filenames and trust boundaries',()=>{
 const {metadata:m}=fixture();for(const patch of [{filename:'../123A.FLG'},{filename:'F123abc.FLG'},
 {session_id:m.session_id.toUpperCase()},{physical_sha256:'AA'.repeat(32)},{runtime_us:9007199254740993},
 {state:'toString'},{state:'UNKNOWN'},{filename:m.filename+'\n'},{session_id:m.session_id+'\n'},{physical_sha256:m.physical_sha256+'\n'},{runtime_us:'1\n'},{runtime_us:'01'},{start_utc:'-0'},{runtime_us:'18446744073709551616'},{complete:false},{valid_bytes:127},{record_count:-1}])
 assert.throws(()=>encodeMetadata({...m,...patch}));
});
test('transfer byte, generation and property order excluded from digest',async()=>{const {metadata:m}=fixture();
 assert.equal(await metadataSha256(m),await metadataSha256({...Object.fromEntries(Object.entries(m).reverse()),transfer_state:'TRANSFERRED',manifest_generation:123}));});
test('valid CRC but wrong sequence cannot receive local ACK authority',async()=>{const {raw,metadata}=fixture();raw.writeUInt32LE(99,128);
 raw.writeUInt32LE(referenceCrc(raw.subarray(128,284)),284);metadata.physical_sha256=await sha256(raw);metadata.metadata_sha256=await metadataSha256(metadata);
 assert.equal(parseHfl(raw).sequence_valid,false);await assert.rejects(validateEvidence(raw,metadata),/INVALID_RECORD_SEQUENCE/);});
