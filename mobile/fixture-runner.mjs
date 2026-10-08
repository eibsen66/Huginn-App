// Owner-run packaged WebView/native fixture runner; caller supplies the bundled synthetic vectors.
import {encodeMetadata,validateEvidence,hexOf,hexBytes} from '../flight-evidence.mjs';
const base64=b=>btoa(Array.from(b,v=>String.fromCharCode(v)).join(''));
export async function runLocalFixtures(bridge,asset){
  const platform=await bridge.platformInfo();if(!platform.fixture_build)throw new Error('FIXTURE_BUILD_REQUIRED');
  const results=[];
  for(const vector of asset.vectors){
    const m=vector.metadata,raw=hexBytes(vector.hfl_hex,vector.hfl_hex.length/2);
    await validateEvidence(raw,m);if(hexOf(encodeMetadata(m))!==vector.encoded_hex)throw new Error('FROZEN_VECTOR_MISMATCH');
    const created=await bridge.evidenceCreateStaging({source_device_id:m.source_device_id,metadata_base64:base64(encodeMetadata(m)),metadata_sha256:m.metadata_sha256});
    const evidence_ref=created.evidence_ref;
    if(created.state==='STAGING')for(let offset=Number(created.offset);offset<raw.length;offset+=16384){await bridge.evidenceCommitRange({evidence_ref,offset:String(offset),bytes_base64:base64(raw.subarray(offset,offset+16384))});}
    await bridge.evidenceImport({evidence_ref});
    const reopened=await bridge.evidenceReopenVerify({evidence_ref});if(reopened.verified!==true)throw new Error('REOPEN_VERIFY_FAILED');
    for(let offset=0;offset<raw.length;offset+=16384){const r=await bridge.evidenceReadRange({evidence_ref,offset:String(offset),length:Math.min(16384,raw.length-offset)});const b=Uint8Array.from(atob(r.bytes_base64),s=>s.charCodeAt(0));if(hexOf(b)!==hexOf(raw.subarray(offset,offset+16384)))throw new Error('RAW_ROUNDTRIP');}
    results.push({name:vector.name,verified:true});
  }
  const gate=await bridge.storageQualification();if(gate.FULL_ACK_GATE_PASS!==false)throw new Error('FULL_ACK_FORBIDDEN');
  // Shared synthetic session intentionally creates conflicts. No manifest write or device transport.
  return {synthetic:true,results,gate,phone_qualified:false};
}
