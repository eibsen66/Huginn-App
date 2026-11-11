# Admitted Rev. 2.3 send — 2026-11-04 18:33 capture

**New physical evidence: an AES memory-allocation failure is logged immediately before the fatal Settings send. A phone-initiated reset is not established.** The exact failed allocation and its resource consumer are not recorded. A reproducible cleanup defect on one possible AES allocation path has an unapplied review patch below; it is not claimed to fix this physical request.

## Complete evidence and timeline

Read all 713 bytes of `C:/HuginnEIS/Evidence/REV2.3-COM5/console-20261104T183348Z/console.raw`, every JSONL record, status and saved summary. Raw SHA256 is `259fd06bbb485fa80746c7582b72a937cb4cf1f10f2a9b461d8c4f0471b8a61b`; JSONL text chunks exactly reconstruct the raw bytes with contiguous offsets. Capture stopped by owner interruption after about 27.2 seconds; it requested zero writes/resets/line/baud changes.

| Device log timestamp, milliseconds since boot | Record |
|---|---|
| 1729177 | HS2_SEND begin id=1, serialized bytes=29502 |
| 1729252 | **esp-aes: Failed to allocate memory** |
| 1729253 | esp-tls-mbedtls: write error :-0x0001 |
| 1729253 | HS2_SEND end: body accepted=8192, HTTP result=45062; raw/post-wrapper return=-1; errno snapshots=104; elapsed=76404 us |
| 1729273 | httpd_uri: uri handler execution failed |

The phone's HTTP 200 / 29502 declared / 8192 received / RESPONSE_READ_FAILED-body matches the server's 8192 positively accepted body bytes. **21,310 bytes are missing.** The earlier 20,480 endpoint is not a fixed limit. MAIN_CLOCK messages continue afterward. There is no Wi-Fi disconnect, handshake, panic or reset sequence recorded around this request. The initial partial clock line is buffered/incomplete text, not evidence of a new boot. Absence of a network log is not proof of no lower-level network event.

The URI warning arrives in a later host read chunk, but its device timestamp is only about 20 ms after the send-end line. Host chunk arrival must not be misread as a five-second server timeout. The measured send interval is **76.404 ms**, far below the configured five-second socket send timeout and the app's twenty-second abort timer.

## Error values and exact selected sources

The retained successful Rev. 2.3 build receipt matches the binary, ELF, sdkconfig, compile_commands, project_description and map hashes. Binary SHA256: `4df1ce79c3cd674c5fba42570c27a90105587872a30d817b2001dcc4930f74b7`; ELF SHA256: `7883a00e6601affe74d43b846fa51573a609930cc955f8e666c5b28a716e61c7`. Compile inputs select the local esp-tls/HTTPS instrumentation and shared 5.5.2 AES DMA/dynamic-buffer files. `build.ninja` links **--wrap=mbedtls_ssl_write**, and the map contains the wrapper and AES DMA routines. SDK Git version is v5.5.2; reviewed AES/dynamic-wrapper and underlying ssl_msg/net_sockets sources have no current Git diff. This verifies the retained build association, without a new physical firmware readback. Relevant current source hashes are recorded in [evidence.json](build/settings-send-183348-review/evidence.json).

| Value | Exact meaning |
|---|---|
| http_result 45062 = 0xB006 | `ESP_ERR_HTTPD_RESP_SEND`, defined as ESP_ERR_HTTPD_BASE + 6 in esp_http_server.h. A response send failed; it is not a specific socket/TLS error. |
| errno 104 | Newlib `ECONNRESET`. lwIP maps ERR_RST (-14) to ECONNRESET. These measurements are errno snapshots, not a saved socket syscall result. Neither the AES allocator nor all crypto error paths assign errno; a previous 104 can remain. |
| raw_tls -1 | Return observed immediately after the **link-wrapped** mbedtls_ssl_write call in local esp_tls_mbedtls.c. It is not an independently captured pre-wrapper error. |
| https_return -1 | esp_mbedtls_write propagates the hard negative return; httpd_ssl_send forwards it. Positive progress inside that failed outer call is lost from its return value but preserved by the separate counter. |
| tls_requested 4096 | Size passed to the final wrapped mbedtls_ssl_write; configured outgoing plaintext fragment cap is 4096. |
| https_requested 29502 | The first HTTP body send requested the full JSON. There was no positive outer body-send return followed by a 9022/21310-byte HTTPD retry in this attempt. |

The dynamic wrapper is `components/mbedtls/port/dynamic/esp_ssl_tls.c:__wrap_mbedtls_ssl_write`: add TX buffer; call `__real_mbedtls_ssl_write`; if tx_done, free/cache TX buffer; return ret. CHECK_OK returns a failed helper result unchanged. The add/free helpers return 0 or **MBEDTLS_ERR_SSL_ALLOC_FAILED (-0x7F00)**, and a cleanup failure can replace the earlier real SSL return. The host test demonstrates that information loss. For this specific observed **-1**, the helper failure code is not -1: it is consistent with the real SSL call propagating a generic -1 and cleanup not overriding it. The post-wrapper hook still cannot name the internal AES allocation branch.

AES DMA allocation failures in `components/mbedtls/port/aes/dma/esp_aes_dma_core.c` print this exact generic message and return **-1**. The selected S3 paths include bounce-buffer allocation and descriptor-array allocation with DMA-capable memory requirements. TLS buffers being allocated in PSRAM does not satisfy a separate MALLOC_CAP_DMA allocation. The log lacks allocation size/capabilities/call site and negotiated cipher, so neither a particular bounce buffer nor descriptor allocation can be selected retrospectively. Concurrent crypto activity is not task-tagged by this generic AES log; the immediate timing and compatible -1 support the request failure chain, but the exact allocation's attribution remains the missing detail.

For comparison, the socket adapter `mbedtls_net_send` maps an actual EPIPE/ECONNRESET write failure to **MBEDTLS_ERR_NET_CONN_RESET (-0x0050)**, not generic -1. WANT_WRITE is -0x6880 and WANT_READ is -0x6900; neither is the observed return. This does not prove no reset ever occurred, but **104 alone does not establish a fresh socket reset as the stopping operation or blame the phone**. A source-faithful host test preserves errno=104 through this error without performing any socket call.

## The 21 calls and termination

`calls` counts invocations of the wrapped mbedtls_ssl_write from the instrumented ESP-TLS loop, including headers. It does not count TCP writes, retransmissions, AES operations or only body fragments.

HTTPD emits one status/content-type/content-length block, four calls per custom header, then a blank CRLF. The Settings handler has three CORS headers plus Cache-Control, producing **1 + 4×4 + 1 = 18 small header calls**. All are smaller than 4096. With two successful body fragments and the next failure, this explains **18 + 3 = 21**:

| Calls | Reconstructed arguments/result |
|---|---|
| 1–18 | Header bytes, each successful |
| 19 | Body offset 0, requested 4096, returned 4096 |
| 20 | Body offset 4096, requested 4096, returned 4096 |
| 21 | Body offset 8192, requested 4096, returned -1 after the dynamic wrapper |

This is a reconstruction from current framing, fragment cap, minimal call count and aggregate counters, **not a recorded per-call trace**. It does not reconstruct internal cipher operations/handshake work inside a wrapped SSL call. The full host framing test reproduces it and records its injected sequence in [send-host.log](build/settings-send-183348-review/send-host.log).

The first outer body call asks for 29502. esp_mbedtls_write advances after each positive fragment, then returns the hard negative instead of an accumulated 8192. HTTPD immediately fails on that negative; it does not retry this fatal request. URI dispatch reports handler failure and session cleanup closes the HTTPS session. The response buffer and job stay alive through the synchronous send, then are freed as before. Content-Length was already sent; no alternate successful response or chunk terminator is appended to repair it.

The generic WANT retry path expects identical arguments for the pending fragment: after positive partial progress the SDK would return a positive count and HTTPD could reenter at the remaining pointer. It does not explain this observed hard -1, full outer requested size, and minimal 21-call count.

## App cancellation review

Reviewed the exact frozen eb5241dc6e9995ba source plus active source/session/UI callers. Explicit `source.pause()`/`source.close()` abort active requests; visibility/pagehide can trigger those paths. Re-pairing/consent/origin changes can replace/close a source; busy controls restrict them. The twenty-second request timer also aborts. An already-aborted controller at the catch maps to **CANCELLED**, unlike the phone's RESPONSE_READ_FAILED.

The reader's `reader.cancel()` is in finally after its read loop exits/errors. The catch's `timeout.abort()` is after it records whether an interruption already existed. On a normal stream rejection, that abort is cleanup after failure, not proof of its initial trigger. Temporary Settings-session close only clears session state; it does not close the shared source. Top-level tab selection only hides panels. Three focused frozen-source tests pass for pause, close and stream-error ordering: [app-abort-tests.log](build/settings-send-183348-review/app-abort-tests.log).

This makes an explicit app AbortController cancellation inconsistent with the reported diagnostic. Browser/OS/network actions outside those JavaScript paths are not recorded and cannot be categorically excluded. No cancellation, socket reset or crypto resource failure is attributed to the owner/phone from errno alone. No app defect was established; no app/UI change or new artifact was made.

## Demonstrated cleanup defect and unapplied patch

There is a concrete ownership defect in the common AES bounce routine: after input_buf allocation succeeds, output_buf allocation failure zeroizes the output and **returns without freeing input_buf**. An extracted actual-function test reproduces that leak (1600 bytes for its 4096-byte fixture). This is one of the allocation-failure paths consistent with the generic log; the capture does not prove this particular path ran or that this leak caused the shortage.

[aes-output-allocation-cleanup.patch](protocol/aes-output-allocation-cleanup.patch) changes that output-allocation failure from direct return to `ret=-1; goto cleanup;`. It frees the already-acquired input buffer while retaining the same error result and output zeroization. It does not retry encryption, change TLS/cipher/auth/configuration, raise limits, omit Settings fields or convert partial sends to success. **It cannot make a currently failing allocation succeed; it prevents a demonstrated leak on that failure path. It is not claimed as the complete physical-response fix.**

Original and proposed function tests under -Wall/-Werror and ASan/UBSan cover first allocation failure, second allocation failure, zeroization and all four input/output allocation ownership combinations. The exact patch passes `git apply --check` against the installed 5.5.2 SDK, but is **not applied**. Any later use must preserve the shared SDK via the owner's isolated component approach and a reviewed source pin update; no local mbedTLS override was installed here. Logs: [aes-host.log](build/settings-send-183348-review/aes-host.log).

The framing/wrapper tests use a complete source-derived Settings fixture of 29479 bytes padded with 23 legal whitespace bytes to the measured size. TLS and hardware/allocator failure results are injected. They establish source behavior and ownership defects, not physical crypto/network reproduction.

## One remaining discriminating check

If the exact allocation must be identified before choosing a resource correction, collect **one failed-allocation record scoped to the active Settings task/request**, using the existing IDF `heap_caps_register_failed_alloc_callback` API. Record only request ID, allocator function name, requested byte count and capability mask into preallocated RAM; emit it after returning to the request context. Do not allocate, print or block inside the callback. Preserve any pre-existing callback and exclude unrelated tasks/ISR activity.

This separates **a DMA bounce-buffer allocation** from **a DMA descriptor allocation**, and confirms whether the allocation belongs to this Settings request rather than coincident crypto in another task. The two bounce input/output allocations may still share a size/function signature; that record alone must not be described as proving which one failed. It does not by itself distinguish all heap consumers or all forms of fragmentation.

The concrete reason for this extra datum is the multiple allocation sites sharing the same `esp-aes` message; the existing send summary cannot select among them. An identical phone-only test or another capture with the same diagnostics cannot provide it. No new diagnostic firmware revision or physical attempt was performed/requested in this task. The functional cleanup patch is independently reviewable now; a transport/resource remedy remains conditional on that allocation evidence.

No target build, firmware/SDK/app source write, flash, reset, deployment, COM access, COM10 operation, Muninn change, commit or push occurred. The correction exists only as a patch and generated host proposal under HuginnAPP. Capture, retained build outputs, actual source files and frozen PWA inventory remain unchanged.
