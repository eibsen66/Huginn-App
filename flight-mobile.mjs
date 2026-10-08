export const RANGE_BYTES=16384;
export const OPERATIONS=Object.freeze(['platformInfo','storageQualification','evidenceCreateStaging','evidenceCommitRange','evidenceGetStatus','evidenceListImported','evidenceReadRange','evidenceImport','evidenceReopenVerify','evidenceCreateAckPending','evidenceMarkAcked','credentialStore','credentialExists','credentialDelete']);
const fail=code=>{throw new Error(code);};
function bounded(o){if(o===null||typeof o!=='object'||Array.isArray(o))fail('INVALID_REQUEST');if(JSON.stringify(o).length>24000)fail('BRIDGE_REQUEST_LIMIT');for(const key of Object.keys(o))if(/token|secret|durable|qualified|eligible|gate|success|sql/i.test(key))fail('FORBIDDEN_AUTHORITY_FIELD');}
export function createCourierBridge(native){
  const api={};
  for(const operation of OPERATIONS)api[operation]=async(options={})=>{
    bounded(options);
    if(!native||typeof native[operation]!=='function')fail('NATIVE_COURIER_UNAVAILABLE');
    if(options.bytes_base64!==undefined&&(!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(options.bytes_base64)||options.bytes_base64.length>21848||options.bytes_base64.length/4*3-(options.bytes_base64.endsWith("==")?2:options.bytes_base64.endsWith("=")?1:0)>RANGE_BYTES))fail('RANGE_LIMIT');
    if(operation==='evidenceReadRange'&&(!Number.isInteger(options.length)||options.length<1||options.length>RANGE_BYTES))fail('RANGE_LIMIT');
    const result=await native[operation](structuredClone(options));
    if(operation==='storageQualification'&&result.FULL_ACK_GATE_PASS!==false)fail('FULL_ACK_FORBIDDEN');
    if(operation.startsWith('credential')&&(!result||Object.keys(result).some(k=>!['credential_ref','exists','synthetic'].includes(k))||typeof result.credential_ref!=='string'||typeof result.exists!=='boolean'))fail('CREDENTIAL_RESPONSE');
    return result;
  };
  return Object.freeze(api);
}
