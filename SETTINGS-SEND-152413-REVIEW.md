# Rev. 2.5 Settings output-allocation failure — 2026-11-05

**The physical stopping operation is now identified:** both admitted Settings sends encounter a failed **1600-byte MALLOC_CAP_DMA output bounce allocation** in `esp_aes_process_dma_ext_ram`, then return a fatal send error. **Why the eligible heap cannot satisfy it is not established.** No functional memory-policy correction is justified yet; the proposed patch below measures the missing fact and is **unapplied**.

## Verified physical evidence

Read the complete **3,640-byte** capture `C:/HuginnEIS/Evidence/REV2.5-COM5/console-20261105T152413Z/console.raw`. SHA256 matches **46e620b68cafc8b1c45d654960c31993bfa4e2299df402577eb1e0214b229770**. All JSONL chunks are contiguous and reconstruct the raw bytes exactly. Saved status is STOPPED after owner interruption, with zero requested serial writes/resets/baud/control-line changes. No port was opened in this investigation.

| Request | Begin device ms | Failed output allocation, elapsed us | Send elapsed us | Body accepted / declared | Records / dropped |
|---|---:|---:|---:|---:|---:|
| 1 | 1315201 | 26214 | 27069 | 4096 / 29502 | 1 / 0 |
| 2 | 1323839 | 23711 | 24790 | 4096 / 29502 | 1 / 0 |

Both allocation records name **bounce_output**, function **esp_aes_process_dma_ext_ram**, line **278**, bytes **1600**, caps **8**, task **1070369456**, matching the request's scoped HTTPD task. Both immediately lead to `esp-aes: Failed to allocate memory`, TLS write `-0x0001`, send result **45062**, wrapped TLS/HTTPS return **-1**, and errno snapshots **0**. URI-handler failure follows. The heap event is recorded in RAM at the allocation site and printed only after send return; printed line order must not be confused with allocation execution order. Allocation and send elapsed fields have slightly different start points, so their subtraction is not asserted as an exact latency.

The source/count reconstruction is **18 header writes, one accepted 4096-byte body write, then one failed body write**, consistent with `calls=20`. This is not a recorded per-call wire trace. The outer HTTPS call still requests the whole 29502; 25406 body bytes are not accepted. Positive TLS acceptance is not TCP acknowledgement. The phone's 4096/29502 result agrees with both failures; the screenshot alone does not select which request ID it represents.

There is Wi-Fi leave/rejoin activity earlier in the capture, a handshake before request 1 and another before request 2. No Wi-Fi leave/reset is logged at either roughly 25–27 ms send failure. MAIN_CLOCK continues afterward. The initial partial esp_image fragment is buffered/incomplete text, not proof of a new reset. No network-event trigger is inferred from these logs. This is an admitted HTTP 200 body failure, not a complete Settings 409 denial or the historical REC FAIL investigation.

## Compiled-image/source association and error values

All outputs listed in the retained successful Rev. 2.5 build-complete receipt were rehashed and match. The retained app hash matches capture's intended artifact **ab00bcade29bad32191af6fbe9f45bafdf56b54deeb6316293901551db6aed1d**. Relevant local AES, diagnostic, TLS and allocation source files match build-start source pins. The exact compiler inputs select standard SDK heap/esp_mm/ESP32-S3 region definitions from `C:/esp/v5.5.2/esp-idf`; that SDK is tag **v5.5.2**, and the reviewed heap/region/alignment/PSRAM paths have no Git diff. Source hashes and compile-unit paths are recorded in `build/settings-send-152413-review/evidence.json`.

This establishes the retained build association. The capture field `physical_image_readback=false` is preserved; no fresh physical image readback was performed. The saved reader's `physical_cause_proven=false` is a conservative fixed output, not a reason to ignore the now-recorded allocation site. The immediate stopping mechanism is established; its resource origin remains unknown.

45062 = **0xB006 / ESP_ERR_HTTPD_RESP_SEND**, the generic HTTP response-send failure. `raw_tls` is still the return **after the link-wrapped mbedtls_ssl_write**, not an independently preserved original internal mbedTLS error. AES returns generic -1 on this allocation error, the TLS loop propagates a hard negative, and HTTPD closes the failed response. Errno 0 is a snapshot; the AES allocation path does not need to assign errno. It is not evidence of a socket reset or a phone-caused failure. No timeout or app response-size limit explains the measured allocator failure.

## Capability 8 and actual eligible memory

Exact header: `components/heap/include/esp_heap_caps.h` defines **MALLOC_CAP_DMA = (1 << 3) = 8**. It is not MALLOC_CAP_8BIT (4), and the request does **not** include MALLOC_CAP_SPIRAM (1024).

The selected path is:

1. Local AES calls `heap_caps_aligned_alloc(1, 1600, MALLOC_CAP_DMA)` on the selected non-P4 path. These arguments pass the SDK's nonzero-size/power-of-two alignment checks.
2. `heap_caps.c` calls `heap_caps_aligned_alloc_base`; failed allocation reports through the heap-failure mechanism but does not assign a socket errno.
3. `heap_caps_base.c` calls `esp_heap_adjust_alignment_to_hw` in `esp_mm/heap_align_hw.c`. DMA requests ask the cache driver for alignment. On selected ESP32-S3, internal memory is not behind L1 cache; a caps-8-only request has no external-memory cache-alignment requirement. The allocator's normal native alignment still applies. No SPIRAM bit is introduced and this is not the default-malloc 16384-byte internal-preference threshold.
4. The allocator scans registered heaps by priority and requires **all** requested capabilities to match; it then needs one sufficiently large aligned contiguous allocation in a single eligible heap. It does not combine disjoint free blocks/heaps. Alignment/allocator metadata also consume space.

In selected `heap/port/esp32s3/memory_layout.c`, DIRAM banks from **0x3FC88000 through the usable end below 0x3FCF0000** have DMA capability, with internal DRAM aliases. With configured **32 KiB data cache**, the DRAM region **0x3FCF0000–0x3FCF8000** is also a potential DMA heap. Static data/BSS, IRAM code aliases, ROM/task/reserved regions are removed before heap registration; these nominal ranges are not all free at runtime. Pure IRAM, RTC and the SPIRAM heap descriptors do not satisfy this caps-8 request.

The configured **32768-byte internal reserve** is constructed by `esp_psram_extram_reserve_dma_pool` from internal DMA memory, possibly multiple non-contiguous chunks. Its caps include DMA/INTERNAL; it remains eligible for this request. It is not a private, unused AES allowance or proof that 32 KiB was free at failure time. Other internal/DMA users can consume it. Its runtime free state is not captured here.

Important distinction: **ESP32-S3 SOC_PSRAM_DMA_CAPABLE is 1**. `esp_ptr_dma_ext_capable()` can recognize an existing mapped PSRAM buffer, and the AES path may DMA it directly when its constraints are met. But the allocator's SPIRAM heap descriptor lacks MALLOC_CAP_DMA, so an **explicit caps-8 allocation** does not use free PSRAM. Hardware addressability and allocator capability selection are different layers. “There is free PSRAM” does not answer this failure.

## Why 1600 bytes, lifetime and what remains unknown

The selected SDK sets **AES_MAX_CHUNK_WRITE_SIZE=1600**. The common routine uses `min(1600, len)`, so this recorded invocation's length was at least 1600; the exact AES input length is not logged. It is not the HTTP chunk size, TLS record size or a fixed 4096/20480-byte response limit.

When the output needs bouncing, a single output scratch buffer is allocated for that AES invocation, reused over its 1600-byte-or-smaller chunks, copied back into the original output, then freed. It is not retained for the entire HTTP session. An input bounce buffer is separately conditional. The current Rev. 2.5 cleanup already frees an acquired input buffer when output allocation fails, keeps output zeroization and returns -1. The enclosing AES mode caller retains hardware-lock release on its error path.

The evidence establishes that **no eligible allocation was obtained then**. It does not show total free DMA memory, largest allocatable DMA block, free-block distribution, competing owners, heap integrity, or a trend proving a leak. Repeated failures on two requests do not establish a progressive leak. Host tests support the existing cleanup fix; they cannot certify physical heap health or exclude leaks elsewhere.

Nor does bounce_output prove an input bounce allocation succeeded: on S3, input can remain directly DMA-accessible in PSRAM while output requires a bounce for cache-line alignment or block-length constraints. The original pointers, input-bounce flag and length are absent. TLS's ordinary record encryption is in-place in the retained ssl_msg.c, but actual lower-level pointer/bounce details must not be invented from that alone.

The Settings allocator and cJSON hooks already explicitly request SPIRAM/8-bit memory; moving them globally to PSRAM is not a new demonstrated remedy. No global hook/preference change is proposed.

## Smallest correction review and one discriminating measurement

The correction belongs at **eligible-memory usage/availability**, not by truncating Settings or retrying a failed HTTP response. Current evidence is insufficient to choose a safe functional implementation:

| Candidate | Why it is not selected blindly |
|---|---|
| Reuse an input bounce buffer | An input allocation may not exist. The capture lacks that flag; an in-place claim alone does not establish scratch ownership. |
| Use aligned PSRAM output scratch | S3 supports external DMA, but recursive output-bounce checks include cache alignment **and block length**. A cache-line-aligned pointer alone can still bounce again for a non-multiple tail; an arbitrary substitution can recurse instead of fixing the send. |
| Reserve more internal memory, move scratch to stack, shrink chunks or retry | These shift pressure/stack risk or retry policy without identifying the constraint. They are not justified by free PSRAM or one failed size. |

**One next check:** collect the matching caps-8 heap's free bytes, largest free block and free-block count immediately **before and after the original failed output allocation**, together with invocation length, requested alignment, input-bounce/in-place flags and external-memory classifications. This separates low total eligible capacity from enough aggregate memory split into insufficient blocks, and establishes which localized scratch alternatives are even applicable. If the two snapshots differ, concurrent heap activity must remain a limitation rather than being mislabeled as fragmentation.

Prepared **unapplied, measurement-only** patch: [protocol/aes-output-heap-observation.patch](protocol/aes-output-heap-observation.patch). It changes only the project-local AES output-allocation call-site and existing diagnostic helper/header. It does not change allocation arguments/preferences, chunk size, retries, TLS, encryption, validation, error values, zeroization or ownership/cleanup. **No functional AES fix is claimed or applied.**

The new heap snapshots run in normal request context, not in a registered failed-allocation callback. The existing RAM-only failure hook remains free of heap/statistics/logging work. The SDK information API takes normal heap locks; lock order is the existing AES-to-heap order. These are observations bracketing allocation, not an atomic snapshot. A single preallocated first-failure record is kept per Settings request and printed after send return outside AES locks. Other tasks/ISR activity do not query heaps. Errno is preserved before diagnostic work. No addresses, payloads, keys or tokens are logged. The added static diagnostic record and heap-lock timing can perturb memory/timing; that limitation must accompany any later physical result.

This is a concrete reason for additional measurement, not a request to repeat the same phone-only screenshot. The existing reader does not yet parse the proposed new HS2_DMA_HEAP tag; its numeric raw record is retained in the capture. Any separately authorized installation needs a fresh visible revision/provenance and matching reader preparation. This task prepares no new firmware revision/build or experiment.

## Checks actually run and preservation

- Exact raw SHA/status/JSONL reconstruction, two request correlations and every retained successful build-output hash passed.
- Extracted **actual retained AES bounce function**: output-allocation failure with and without an input buffer, zeroization and allocation ownership passed; **500 repeated full-length success/failure cycles** remain balanced under GCC `-Wall -Wextra -Werror` and ASan/UBSan. DMA/allocator are injected copy seams, not hardware/cryptographic proof.
- Proposed diagnostic helper passes sanitizer tests for two simulated states producing the same failed allocation: **1000 total / 992 largest** versus **8000 total / 512 largest**. These numbers are host fixtures, not device measurements. Foreign-task/ISR exclusion, first-failure scope, success/failure reset and errno retention pass.
- Two Xtensa **syntax-only** checks of the unapplied staged AES/helper files pass with warnings enabled and retained Rev. 2.5 generated headers. No firmware configure/build/link occurred.
- Patch `git apply --check` passes against actual local components. It was **not applied**. Logs, commands and staged proposals are in `build/settings-send-152413-review/`.

No firmware/SDK/app implementation, owner data, recording, protected state, revision, build output or saved capture was changed. No target build, flash, reset, deployment, COM access, commit or push occurred. REC FAIL is outside this investigation. Historical FIRMWARE_HEAD remains a separately recorded failed identity-guard test; its guard/result was not changed.
## Subsequent owner-authorized Rev. 2.6 preparation — 2026-11-05

The reviewed measurement-only patch has now been applied to project-local components, with additional DMA/cache-alignment offset fields and strict reader correlation. Shared SDK and retained Rev. 2.5 evidence are unchanged. Fresh Rev. 2.6 BUILD/VERIFY/FLASH/CAPTURE/explicit-folder reader scripts and pre-compilation provenance are ready. See [REV2.6-OWNER-HANDOFF.md](REV2.6-OWNER-HANDOFF.md) for checks, concurrency limits, the complete capture-before-phone procedure and outcome guide. No target build or physical operation occurred. The original investigation/proposal below is retained as historical evidence; its earlier “unapplied” status is superseded for this authorized preparation. No functional memory-policy fix was added.

