const codes=new Set(['AUTH_REQUIRED','READ_ONLY_ROUTE','REDIRECT_REJECTED','SOURCE_CHANGED','SOURCE_IDENTITY','SESSION','GENERATION','ETAG','METADATA_DIGEST_MISMATCH','FILE_SIZE_LIMIT','RESPONSE_LENGTH','STREAM_REQUIRED','RANGE','RANGE_RESPONSE','OWNER_SELECTION_REQUIRED','CONFLICT','BUSY','DOWNLOAD_INCOMPLETE','CHUNK_REVALIDATION_FAILED','STAGING_CHANGED','CANCELLED','STRICT_UNAVAILABLE','TRANSACTION_ABORTED','DOWNLOAD_NOT_FOUND','FLIGHT_NOT_IMPORTED','EVIDENCE_CHANGED','INVALID_RESPONSE_JSON','STORAGE_FULL','FETCH_OR_TYPE_ERROR','TRANSFER_FAILED']);
for(const code of ['OUT_OF_MEMORY','SETTINGS_BUSY_OR_UNAVAILABLE','INVALID_OR_STALE_PACKAGE','INVALID_SETTINGS_OR_PROTECTED_FIELD','PREVIEW_REQUIRED_OR_EXPIRED','SAVE_OR_READBACK_FAILED','READBACK_UNAVAILABLE','READBACK_RESPONSE_UNAVAILABLE','SAVE_UNCERTAIN_TIMEOUT'])codes.add(code);
for(const code of ['FETCH_REJECTED','RESPONSE_READ_FAILED','INVALID_RESPONSE_ENCODING','RESPONSE_PROCESSING_FAILED','JAVASCRIPT_TYPE_ERROR'])codes.add(code);
const names=new Set(['Error','TypeError','AbortError','QuotaExceededError','InvalidStateError','DataError','NotSupportedError','OperationError','TransactionInactiveError','ConstraintError','SyntaxError','TransferError']);
const stages=new Set(['SELECTION','DETAIL','STAGING','RESUME_CHECK','RANGE','COMMIT_RANGE','VALIDATION_PUBLICATION','REOPEN','UI_RENDER','SETTINGS']);
export const flightServerErrors=new Set(['COURIER_BUSY','SOURCE_ID_UNAVAILABLE','INVALID_QUERY','CURSOR_STALE','INVALID_CURSOR','INVALID_REQUEST','NOT_FOUND','METHOD_NOT_ALLOWED']);
const errorBodyStates=new Set(['recognized','unknown','empty','invalid_utf8','invalid_json','invalid_schema','unreadable','too_large','interrupted','stale']);
export function transferDiagnostic(error,context={}){
 const previous=error?.diagnostic||{},merged={...previous,...context},message=String(error?.message||'');
 const d={stage:stages.has(merged.stage)?merged.stage:'SELECTION',code:codes.has(message)||/^HTTP_[1-5][0-9]{2}$/.test(message)?message:(codes.has(previous.code)||/^HTTP_[1-5][0-9]{2}$/.test(previous.code||'')?previous.code:null)|| (error?.name==='QuotaExceededError'?'STORAGE_FULL':error?.name==='AbortError'?'CANCELLED':error?.name==='TypeError'?'FETCH_OR_TYPE_ERROR':'TRANSFER_FAILED'),name:names.has(previous.name)?previous.name:names.has(error?.name)?error.name:'Error'};
 for(const k of ['httpStatus','declaredBytes','requestedOffset','committedOffset','expectedBytes','receivedBytes'])d[k]=Number.isSafeInteger(merged[k])&&merged[k]>=0?merged[k]:null;
 if(['fetch','response','headers','body','decode','json','validation','complete'].includes(merged.phase))d.phase=merged.phase;
 if(['GET','POST'].includes(merged.method))d.method=merged.method;
 if(['settings','flight'].includes(merged.endpoint))d.endpoint=merged.endpoint;
 if(errorBodyStates.has(merged.errorBodyStatus))d.errorBodyStatus=merged.errorBodyStatus;
 if(merged.errorBodyStatus==='recognized'&&flightServerErrors.has(merged.serverErrorCode))d.serverErrorCode=merged.serverErrorCode;
 d.dispatchAttempted=merged.dispatchAttempted===true;return Object.freeze(d);
}
export function transferError(error,context){const diagnostic=transferDiagnostic(error,context),safe=new Error(diagnostic.code);safe.name='TransferError';safe.diagnostic=diagnostic;return safe;}
export function identityMatches(a,b){return ['source_device_id','session_id','filename','physical_bytes','physical_sha256','metadata_sha256'].every(k=>String(a?.[k])===String(b?.[k]));}
