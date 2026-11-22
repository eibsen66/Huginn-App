const codes=new Set(['AUTH_REQUIRED','READ_ONLY_ROUTE','REDIRECT_REJECTED','SOURCE_CHANGED','SOURCE_IDENTITY','SESSION','GENERATION','ETAG','METADATA_DIGEST_MISMATCH','FILE_SIZE_LIMIT','RESPONSE_LENGTH','STREAM_REQUIRED','RANGE','RANGE_RESPONSE','OWNER_SELECTION_REQUIRED','CONFLICT','BUSY','DOWNLOAD_INCOMPLETE','CHUNK_REVALIDATION_FAILED','STAGING_CHANGED','CANCELLED','REQUEST_TIMEOUT','STRICT_UNAVAILABLE','TRANSACTION_ABORTED','DOWNLOAD_NOT_FOUND','FLIGHT_NOT_IMPORTED','EVIDENCE_CHANGED','INVALID_RESPONSE_JSON','STORAGE_FULL','FETCH_OR_TYPE_ERROR','TRANSFER_FAILED']);
for(const code of ['METADATA_MISMATCH_runtime_us','OUT_OF_MEMORY','SETTINGS_BUSY_OR_UNAVAILABLE','INVALID_OR_STALE_PACKAGE','INVALID_SETTINGS_OR_PROTECTED_FIELD','PREVIEW_REQUIRED_OR_EXPIRED','SAVE_OR_READBACK_FAILED','READBACK_UNAVAILABLE','READBACK_RESPONSE_UNAVAILABLE','SAVE_UNCERTAIN_TIMEOUT'])codes.add(code);
for(const code of ['FETCH_REJECTED','RESPONSE_READ_FAILED','INVALID_RESPONSE_ENCODING','RESPONSE_PROCESSING_FAILED','JAVASCRIPT_TYPE_ERROR'])codes.add(code);
// Finite evidence-validator codes preserve the first integrity failure safely.
for(const code of ['IDENTITY_MISMATCH','INVALID_BYTES','INVALID_HEX','CRYPTO_UNAVAILABLE','INVALID_DECIMAL','INVALID_UINT64','INVALID_UINT32','INVALID_FILENAME','INVALID_ENUM','INVALID_COMPLETE','INVALID_TRUST_BOUNDARY','TRUNCATED_HEADER','INVALID_HEADER','BAD_HEADER_CRC','INVALID_RECORD_SEQUENCE','INVALID_SOURCE_DEVICE','INVALID_OFFSET','NONCONTIGUOUS_RANGE','INVALID_RANGE_LENGTH','EVIDENCE_TOO_LARGE','INVALID_LOCAL_KEY','LOCAL_OWNERSHIP_MISMATCH','STAGING_DISCARD_FORBIDDEN','PROGRESS_PROTOCOL','PROGRESS_LIMIT','PROGRESS_INCOMPLETE','FLIGHT_PREPARATION_FAILED','PREPARATION_TIMEOUT','TRANSFER_CANCELLED'])codes.add(code);
for(const field of ['session_id','hfl_version','physical_bytes','start_utc','record_count','valid_bytes','integrity','state','complete','runtime_us'])codes.add('METADATA_MISMATCH_'+field);
const names=new Set(['Error','TypeError','AbortError','QuotaExceededError','InvalidStateError','DataError','NotSupportedError','OperationError','TransactionInactiveError','ConstraintError','SyntaxError','TransferError']);
const stages=new Set(['SELECTION','DETAIL','STAGING','RESUME_CHECK','RANGE','COMMIT_RANGE','VALIDATION_PUBLICATION','REOPEN','UI_RENDER','SETTINGS']);
export const flightServerErrors=new Set(['COURIER_BUSY','SOURCE_ID_UNAVAILABLE','INVALID_QUERY','CURSOR_STALE','INVALID_CURSOR','INVALID_REQUEST','NOT_FOUND','METHOD_NOT_ALLOWED','RANGE_REQUIRED','INVALID_RANGE','RANGE_TOO_LARGE','RANGE_NOT_SATISFIABLE','IF_MATCH_REQUIRED','INVALID_IF_MATCH','EVIDENCE_CHANGED','SESSION_NOT_FOUND','AMBIGUOUS_SESSION','UNTRUSTED_SESSION','UNSUPPORTED_HFL_VERSION','SOURCE_UNAVAILABLE','ACTIVE_FLIGHT','IO_FAILED','MEMORY_UNAVAILABLE','RECOVERY_PENDING','SD_UNAVAILABLE']);
flightServerErrors.add('PREPARATION_TIMEOUT');flightServerErrors.add('TRANSFER_CANCELLED');flightServerErrors.add('PREPARATION_REQUIRED');flightServerErrors.add('FILE_SIZE_LIMIT');
for(const code of flightServerErrors)codes.add(code);
const errorBodyStates=new Set(['recognized','unknown','empty','invalid_utf8','invalid_json','invalid_schema','unreadable','too_large','interrupted','stale']);
export function transferDiagnostic(error,context={}){
 const previous=error?.diagnostic||{},merged={...previous,...context},message=String(error?.message||'');
 const d={stage:stages.has(merged.stage)?merged.stage:'SELECTION',code:codes.has(message)||/^HTTP_[1-5][0-9]{2}$/.test(message)?message:(codes.has(previous.code)||/^HTTP_[1-5][0-9]{2}$/.test(previous.code||'')?previous.code:null)|| (error?.name==='QuotaExceededError'?'STORAGE_FULL':error?.name==='AbortError'?'CANCELLED':error?.name==='TypeError'?'FETCH_OR_TYPE_ERROR':'TRANSFER_FAILED'),name:names.has(previous.name)?previous.name:names.has(error?.name)?error.name:'Error'};
 for(const k of ['elapsedMs','timeoutMs','httpStatus','declaredBytes','requestedOffset','committedOffset','expectedBytes','receivedBytes'])d[k]=Number.isSafeInteger(merged[k])&&merged[k]>=0?merged[k]:null;
 if(merged.operation==='DOWNLOAD'){d.operation='DOWNLOAD';for(const k of ['operationElapsedMs','attemptId'])d[k]=Number.isSafeInteger(merged[k])&&merged[k]>=0?merged[k]:null;}
 if(['fetch','response','headers','body','decode','json','validation','complete'].includes(merged.phase))d.phase=merged.phase;
 if(['FIRST_RESPONSE','PREPARATION_IDLE','PREPARATION_LIMIT','BODY_IDLE'].includes(merged.timeoutKind))d.timeoutKind=merged.timeoutKind;
 if(['connection','preparation','body'].includes(merged.requestPhase))d.requestPhase=merged.requestPhase;
 if(['GET','POST'].includes(merged.method))d.method=merged.method;
 if(['settings','flight'].includes(merged.endpoint))d.endpoint=merged.endpoint;
 if(errorBodyStates.has(merged.errorBodyStatus))d.errorBodyStatus=merged.errorBodyStatus;
 if(merged.errorBodyStatus==='recognized'&&flightServerErrors.has(merged.serverErrorCode))d.serverErrorCode=merged.serverErrorCode;
 if(['REQUEST_TIMEOUT','USER_CANCELLED','DOCUMENT_HIDDEN','PAGEHIDE','CONNECTION_REPLACED','SOURCE_PAUSED','SOURCE_CLOSED','SETTINGS_FAILURE','LIST_FAILURE','CALLER_CANCELLED','NETWORK_OFFLINE'].includes(merged.abortCause))d.abortCause=merged.abortCause;
 d.dispatchAttempted=merged.dispatchAttempted===true;return Object.freeze(d);
}
export function transferError(error,context){const diagnostic=transferDiagnostic(error,context),safe=new Error(diagnostic.code);safe.name='TransferError';safe.diagnostic=diagnostic;return safe;}
export function identityMatches(a,b){return ['source_device_id','session_id','filename','physical_bytes','physical_sha256','metadata_sha256'].every(k=>String(a?.[k])===String(b?.[k]));}
