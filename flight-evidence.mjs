// Flight Courier V1 local evidence only. No networking or evidence mutation.
export class FlightEvidenceError extends Error {
  constructor(code) { super(code); this.name = 'FlightEvidenceError'; this.code = code; }
}
const fail = code => { throw new FlightEvidenceError(code); };
export const STATES = Object.freeze({PROVISIONAL:1, QUALIFIED_OPEN:2, COMPLETE:3, INCOMPLETE:4, CORRUPT:5});
export const HEADER_BYTES = 128, RECORD_BYTES = 160, RANGE_BYTES = 16384;
export function bytesOf(value) {
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  return fail('INVALID_BYTES');
}
export const hexOf = value => Array.from(bytesOf(value), b => b.toString(16).padStart(2,'0')).join('');
export function hexBytes(value, length) {
  if (typeof value !== 'string' || value.length!==length*2 || !new RegExp(`^[0-9a-f]{${length*2}}$`).test(value)) fail('INVALID_HEX');
  return Uint8Array.from(value.match(/../g), s => parseInt(s,16));
}
export function crc32(value) {
  let crc = 0xffffffff;
  for (const byte of bytesOf(value)) {
    crc ^= byte;
    for (let bit=0; bit<8; bit++) crc = (crc>>>1) ^ ((crc&1) ? 0xedb88320 : 0);
  }
  return (~crc)>>>0;
}
export async function sha256(value) {
  if (!globalThis.crypto?.subtle) fail('CRYPTO_UNAVAILABLE');
  // Snapshot before awaiting: a caller cannot alter the evidence being hashed.
  return hexOf(await crypto.subtle.digest('SHA-256', bytesOf(value).slice()));
}
function view(bytes) { return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength); }
export function parseHfl(value) {
  const raw = bytesOf(value), physical_bytes = String(raw.length);
  const bad = header_status => ({header_valid:false, header_status, session_id:null,
    hfl_version:raw.length>4?raw[4]:null, physical_bytes, record_count:0, valid_bytes:0,
    integrity:3, state:'CORRUPT', complete:false, session_complete:false,terminal_session_complete:false});
  if (raw.length<128) return bad('TRUNCATED_HEADER');
  if (String.fromCharCode(...raw.subarray(0,4))!=='HFL1' || raw[5]!==128) return bad('INVALID_HEADER');
  if (view(raw).getUint32(124,true)!==crc32(raw.subarray(0,124))) return bad('BAD_HEADER_CRC');
  if (![1,2].includes(raw[4])) return bad('UNSUPPORTED_HFL_VERSION');
  const d=view(raw), version=raw[4];
  let offset=128, count=0, integrity=1, issue=null, complete=false, qualified=false;
  let running=false, lost=false, runStart=0n, runtime=0n, last=0n, haveLast=false;
  let expectedSequence=1, sequence_valid=true, monotonic_valid=true;
  const records=[];
  while (offset<raw.length) {
    if (raw.length-offset<160) { integrity=2; issue='TORN_FINAL_RECORD'; break; }
    const r=raw.subarray(offset,offset+160), rd=view(r), type=r[4];
    if (rd.getUint32(156,true)!==crc32(r.subarray(0,156)) || type<1 || type>10) {
      integrity=3; issue=offset+160<raw.length?'INTERIOR_RECORD_CORRUPTION':'FINAL_RECORD_CORRUPTION'; break;
    }
    const sequence=rd.getUint32(0,true), at=rd.getBigUint64(8,true);
    if (sequence!==expectedSequence) sequence_valid=false;
    expectedSequence=sequence+1;
    if (haveLast && at<last) monotonic_valid=false;
    haveLast=true; last=at;
    records.push({sequence,type,monotonic_us:at.toString(),utc_seconds:rd.getBigInt64(16,true).toString()});
    count++; offset+=160;
    if (type===5) qualified=true;
    if ([2,3,8].includes(type)) {
      if (!running) {running=true;runStart=at;}
    } else if (type===4 || type===6) {
      if (running && !lost && at>=runStart) runtime+=at-runStart;
      running=false; lost=type===6;
    } else if (type===7) lost=false;
    else if (type===1 && r[124]===1) {
      const rpm=rd.getInt32(24,true);
      if (lost) lost=false;
      if (rpm>=700000 && !running) {running=true;runStart=at;}
      else if (rpm<700000 && running) {if (!lost && at>=runStart) runtime+=at-runStart;running=false;}
    } else if (type===1) {
      if (running && !lost && at>=runStart) runtime+=at-runStart;
      running=false;lost=true;
    } else if (type===10) {
      if (running && !lost && at>=runStart) runtime+=at-runStart;
      running=false;complete=true;
      // Firmware v1 stops at SESSION_COMPLETE; v2 verifies subsequent records.
      if (version===1) { if (offset<raw.length) {integrity=3;issue='DATA_AFTER_V1_COMPLETE';} break; }
    }
  }
  if (!complete && running && !lost && haveLast && last>=runStart) runtime+=last-runStart;
  return {header_valid:true,header_status:'VALID',session_id:hexOf(raw.subarray(8,24)),
    hfl_version:version,physical_bytes,start_utc:d.getBigInt64(32,true).toString(),
    record_count:count,valid_bytes:offset,integrity,issue,session_complete:complete,terminal_session_complete:records.at(-1)?.type===10,
    complete:integrity!==3 && complete,state:integrity===3?'CORRUPT':complete?'COMPLETE':qualified?'INCOMPLETE':'PROVISIONAL',
    runtime_us:(qualified?runtime:0n).toString(),sequence_valid,monotonic_valid,
    trust_boundary:integrity===3?'FORENSIC_PREFIX':'AUTHORITATIVE_PREFIX',records};
}
function integer64(value, signed=false) {
  if (typeof value==='string') {
    if (value.trim()!==value || !(signed?/^(0|-[1-9][0-9]*|[1-9][0-9]*)$/:/^(0|[1-9][0-9]*)$/).test(value)) fail('INVALID_DECIMAL');
    value=BigInt(value);
  }
  if (typeof value!=='bigint' || value<(signed?-(1n<<63n):0n) || value>(signed?(1n<<63n)-1n:(1n<<64n)-1n)) fail('INVALID_UINT64');
  return value;
}
function uint32(value) {
  if (!Number.isInteger(value)||value<0||value>0xffffffff) fail('INVALID_UINT32');
  return value;
}
export function encodeMetadata(m) {
  const sid=hexBytes(m.session_id,16), hash=hexBytes(m.physical_sha256,32);
  if (typeof m.filename!=='string'||m.filename.length!==11||!/^[PF][0-9A-F]{6}\.FLG$/.test(m.filename)) fail('INVALID_FILENAME');
  const physical=integer64(m.physical_bytes), start=integer64(m.start_utc,true), runtime=integer64(m.runtime_us);
  const count=uint32(m.record_count), valid=uint32(m.valid_bytes), state=STATES[m.state];
  if (typeof m.state!=='string' || !Object.hasOwn(STATES,m.state) || !state || ![1,2,3].includes(m.integrity)||![1,2].includes(m.hfl_version)) fail('INVALID_ENUM');
  if (typeof m.complete!=='boolean'||m.complete!==(m.state==='COMPLETE')) fail('INVALID_COMPLETE');
  if (BigInt(valid)>physical || BigInt(valid)!==128n+160n*BigInt(count)) fail('INVALID_TRUST_BOUNDARY');
  const out=new Uint8Array(108), d=view(out);
  out.set([72,70,67,77]);d.setUint16(4,1,true);d.setUint16(6,11,true);
  out.set(sid,8);out.set(hash,24);d.setBigUint64(56,physical,true);d.setBigInt64(64,start,true);
  d.setBigUint64(72,runtime,true);d.setUint32(80,count,true);d.setUint32(84,valid,true);
  out[88]=state;out[89]=m.integrity;out[90]=m.complete?1:0;out[91]=m.hfl_version;
  out.set(new TextEncoder().encode(m.filename),92);
  return out;
}
export async function metadataSha256(m) { return sha256(encodeMetadata(m)); }
export async function validateEvidence(value,m) {
  const raw=bytesOf(value).slice(), parsed=parseHfl(raw);
  encodeMetadata(m);
  if (!parsed.header_valid) fail(parsed.header_status);
  const physical_sha256=await sha256(raw), metadata_sha256=await metadataSha256(m);
  if (physical_sha256!==m.physical_sha256 || metadata_sha256!==m.metadata_sha256) fail('IDENTITY_MISMATCH');
  for (const field of ['session_id','hfl_version','physical_bytes','start_utc','record_count','valid_bytes','integrity','state','complete','runtime_us']) {
    if (parsed[field]!==m[field]) fail(`METADATA_MISMATCH_${field}`);
  }
  if (!parsed.sequence_valid || !parsed.monotonic_valid) fail('INVALID_RECORD_SEQUENCE');
  if (m.state==='QUALIFIED_OPEN') fail('ACTIVE_FLIGHT');
  return {parsed,physical_sha256,metadata_sha256};
}
