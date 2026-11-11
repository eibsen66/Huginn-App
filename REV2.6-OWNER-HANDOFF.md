# HuginnEIS Rev. 2.6 — scoped DMA heap observation

Prepared 2026-11-05. **No target build, flash, reset, deployment or COM access occurred. Rev. 2.6 is prepared source, not an installed image or a functional fix.**

## What changed and what a failed request records

The reviewed measurement-only patch was applied to the **project-local mbedTLS component**. Shared ESP-IDF remains unchanged. The additional buffer-constraint fields below close a gap in the original proposal; no allocation policy was changed. SYSTEM / APP build ID and PROJECT_VER consistently say **HuginnEIS Rev. 2.6**.

The first failed output bounce allocation in an admitted Settings request produces one bounded **HS2_DMA_HEAP** record. Existing HS2_SEND and HS2_ALLOC records remain. Together they record:

| Information | Fields |
|---|---|
| Allocation identity | site=bounce_output, function=esp_aes_process_dma_ext_ram, bytes, caps; source line in matching HS2_ALLOC |
| Relevant heap state | before_free / before_largest / before_blocks and after_free / after_largest / after_blocks, using the original requested caps |
| Buffer constraints | original AES invocation length, requested allocation alignment, input_bounce, in_place, original input/output external-memory and DMA-capability flags |
| Cache/block constraints | cache_line, input_mod_cache, output_mod_cache, input_mod16, output_mod16, cache_result |
| Correlation/timing | request id, task id, before_us / after_us; existing failure elapsed time and send result/accepted bytes |

Offsets and classifications are logged, **not raw buffer addresses, settings bodies, credentials, pairing tokens or keys**. In this ESP32-S3 caps-8 path, requested_alignment is 1 while the allocator supplies its normal native alignment; the external cache-line fields describe the **original buffers**, not a new allocation request. Largest-free-block is the SDK's native-aligned allocatable payload bound for matching heaps; it is not a promise for arbitrary stronger alignment. Capability **8 = MALLOC_CAP_DMA**, not MALLOC_CAP_8BIT. Free PSRAM alone does not satisfy this explicit caps-8 request.

The before snapshot is taken in normal AES request context immediately before the original output allocation, after any input bounce allocation. The after snapshot is taken after NULL return and **before cleanup frees the input buffer**. before_us is recorded after reading the before statistics, and after_us after reading the after statistics. Thus allocation lies between them; the interval includes post-snapshot work and is not a pure allocator latency. The existing failure timestamp now follows that normal-context post-observation.

One preallocated first-failure record is retained per request; later observations cannot overwrite it. Its maximum formatted numeric body is **662 characters**, excluding the ordinary log prefix. Heap statistics are queried before output-allocation candidates until the first failure; success does not produce a heap-failure log. No heap queries run for unrelated tasks/ISR activity. Storage/log output is fixed/bounded; query work depends on the scoped AES calls and registered heaps.

**The existing allocation-failure hook is byte-for-byte unchanged**: RAM-only recording, no allocation, heap-statistics call or blocking logging. Statistics collection occurs in the normal caller, not an allocator callback. The SDK information API uses normal heap locks; the AES-to-heap lock order already exists for allocation. New logging runs after send return, outside the AES operation. Errno is preserved before diagnostic work. Encryption, TLS/authentication, allocator arguments, allocation preferences, chunk size, retry policy, validation and cleanup are unchanged.

## Limits under concurrent allocations

Heap information aggregates matching heaps and is not an atomic view across all regions. Other tasks/ISR allocators may change memory between individual heap reads, between the before snapshot and allocation, or before the after snapshot. Identical before/after values do not exclude a transient allocation/free (ABA). Largest block can change while total free is stable. Multiple disjoint eligible heaps cannot be combined into one block.

The diagnostic itself adds a small bounded BSS record and heap-query work, changing available memory/timing slightly. A changed failure threshold or success is not retrospective proof of the Rev. 2.5 root cause. These fields provide the relevant decision inputs for a normally reproduced failure, **not a guarantee that one concurrently changing snapshot proves a unique root cause**. If ambiguous, no speculative correction is justified.

## Preservation, scope and provenance

Exactly five firmware inputs differ from the retained Rev. 2.5 build-start inventory: local AES call-site, local allocation diagnostic helper/header, and the two revision identifiers. Removing the observation calls reproduces the prior AES source exactly. MAIN/CMake differ only in revision bytes. Settings transport/admission, existing send/allocation diagnostics, pairing workflow, recording, CAN, CHT, UI layout, settings/protected times and device state were not functionally changed.

**1,991 retained Rev. 2.5 files and 1,992 older reference files were hash-verified unchanged**, including binaries, build configuration, provenance, scripts and captures. Shared SDK component inventories match. New exact source diff: `C:/HuginnAPP/protocol/rev26-dma-heap-observation.patch`, SHA256 **508a9b254fb41c417cec94d5934c2ac5f37e7bf7abfe187d60cece63f4884d69**. It describes changes already applied in the working tree; do not reapply it.

Fresh build path: **C:/HuginnEIS/Huginn/Firmware/huginn/build-rev2.6-20261105** (not yet created). Pre-compilation attestation: **C:/HuginnEIS/Evidence/REV2.6-PREPARATION/prepared.json**, created and checked successfully before any target compilation. AppOrigin remains **https://huginnapp-pwa-test.pages.dev**. Existing ESP-IDF **5.5.2**, Python **3.12.0** and dependency versions are retained. Normal configuration/services and QR support are retained; bench inputs remain OFF.

Owner ENV, BUILD, VERIFY, FLASH, CAPTURE and READ-DIAGNOSTIC scripts are under **C:/HuginnEIS**. BUILD is build-only and pins inputs before compilation. VERIFY rejects unsuccessful/stale/mutated outputs and source/configuration/toolchain/script mismatches, checks revision/target/image/partition/size/hash and app-only bounds, and requires the actual local diagnostic objects/functions (including all three output probe functions) and pairing UI to be compiled/linked. No mere patch-file presence counts as instrumentation proof.

Owner FLASH repeats verification, backs up/validates live COM5 layout, writes only the app at **0x20000**, capacity **0x400000**, and independently checks readback plus all bytes outside the app erase envelope. No rebuild or automatic retry. NVS/settings/protected times, bootloader, partition table, OTA selection and unrelated storage are preserved. It is not executed by this preparation.

CAPTURE offline-verifies the intended artifact before opening COM5, then uses the established exclusive receive-only non-resetting reader. It records intended artifact hash separately from physical running-image proof. READ-DIAGNOSTIC **requires -CaptureFolder** and never chooses the latest/older capture. It includes dma_heap_observations and request_correlations, rejects truncated/duplicate/wrong-site records, and marks incomplete or task/caps/size-mismatched correlations rather than inventing a complete observation.

## Checks actually run

- Host GCC `-Wall -Wextra -Werror`, ASan/UBSan: scoped heap observations, first-failure retention, foreign-task/ISR exclusion, errno preservation, DMA/cache classifications and offsets; low-total and fragmented simulated heaps; success/error reset. Fixture numbers are not physical measurements.
- Actual retained AES function with injected DMA/allocator seams: output-allocation failures with/without an input buffer, zeroization/ownership, and **500 repeated full-length success/failure cycles** pass. This is not physical cryptographic proof.
- **20 owner/reader host tests pass**: fresh provenance, failed/stale/mutated artifacts, source/configuration rejection, local components/pairing linkage, retry, mocked app-only flash containment, capture preflight, required folder, sanitized/full/truncated/duplicate observations and request/task correlation.
- **Three Xtensa syntax-only checks pass**: MAIN, AES core and diagnostic helper, with warnings enabled and retained Rev. 2.5 generated headers. No target configure/build/link occurred. The required SDK-private cache declaration was included after the initial syntax check exposed it.
- Owner PowerShell/Python parsers, source behavior audit, exact reverse patch check, retained artifacts and shared SDK hashes pass. Evidence: `C:/HuginnAPP/build/rev26-preparation/` (owner-tests.log, probe-host.log, cleanup-host.log, syntax-checks.json, behavior-audit.json, final-audit.json).

Historical **FIRMWARE_HEAD remains failed**, with unchanged guard: expected **2b7323b749e517fabab6134f4d4493ec22bc0b3b**, actual **74f45528a8aece434d9af1b757b18bc8caa8fe45**. It is not included as a passing test. This is unrelated to REC FAIL; that investigation was not resumed.

## Complete numbered owner procedure

These are future **owner-run** actions, not operations performed during preparation. Run each command separately and stop on error. No phone action occurs before step 4 is ARMED.

1. **Build only**, in the existing environment (the wrapper loads ENV):

   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File C:/HuginnEIS/REV2.6-OWNER-BUILD.ps1
   ```

2. **Verify offline** after a successful build:

   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File C:/HuginnEIS/REV2.6-OWNER-VERIFY.ps1
   ```

3. Close competing serial readers. **Owner app-only COM5 installation**:

   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File C:/HuginnEIS/REV2.6-OWNER-FLASH.ps1
   ```

   Wait for normal boot; confirm **HuginnEIS Rev. 2.6** and normal **REC WAIT**. Do not start an engine/recording for this diagnostic. Compilation/installation must succeed before continuing.

4. **Start capture before opening/using the phone app**:

   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File C:/HuginnEIS/REV2.6-OWNER-CAPTURE.ps1
   ```

   Wait for **ARMED**. Save the exact newly printed `C:/HuginnEIS/Evidence/REV2.6-COM5/console-...` path. Leave this window open. **Do not press RESET, flash, restart/reconnect the board or open another reader while capture is open.** If capture fails or reaches its 600-second bound, do not perform phone actions or substitute an older capture.

5. Now open the existing iPhone PWA. Confirm running app, active worker and controlling worker identify deployed **271f2c06c31e3889**. Do not clear data or reinstall. If the intended version is not active, stop this attempt without a Settings request. Join HuginnEIS Wi-Fi. If pairing is needed, use **Connectivity > Flight Courier > Pair Flight Courier** and scan in the app; the existing automatic pairing shows the HuginnEIS list. Return the device to **MAIN** without revoking pairing. Record the approximate action time.

6. Run exactly **one** **Settings > Greining / Diagnostics > Athuga tengingu (aðeins lestur) / Check connection (read only)** attempt. This existing action reads the flight list and Settings. Record phone HTTP status, declared/received bytes, code, phase and app build. **Do not preview/apply settings or repeat a failed GET manually.** If it is a complete 409 denial, retain that outcome; do not bypass admission guards.

7. After the result, allow the final device log lines to arrive, then stop capture normally with **Ctrl+C**. Confirm **STOPPED** and the same folder from step 4. In a second PowerShell window set `$captureFolder` to that exact ARMED path. Read only that capture, including the required argument:

   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File C:/HuginnEIS/REV2.6-OWNER-READ-DIAGNOSTIC.ps1 -CaptureFolder $captureFolder
   ```

   Do not guess a timestamp or use an older folder. Missing/wrong folder is a stop condition. Share the sanitized JSON, exact folder/raw SHA256 and matching phone result; no secrets or settings bodies are needed. Stop after this single attempt.

## How the one result guides a correction

Always first check request_correlations, zero dropped allocation records, complete heap line, matching id/task/bytes/caps/site, cache_result and observation timing. Compare block sizes with the pinned allocator's native alignment/overheads; the snapshot is not a general aligned-allocation guarantee.

| Observed outcome | Smallest justified direction; no change is automatic |
|---|---|
| Low total eligible free bytes and insufficient largest block in both snapshots | Eligible DMA capacity pressure. Review scoped temporary lifetimes/overlap and reduce the specific internal scratch peak if justified; do not blindly increase the global reserve or use stack memory. The heap owner/leak is not identified merely by low free memory. |
| Enough aggregate free bytes but largest block too small | Fragmentation or distribution across disjoint eligible heaps. Target the contiguous temporary requirement/lifetime rather than assuming free PSRAM or total free can satisfy it. Do not label this a leak without a trend/owner evidence. |
| input_bounce=1, in_place=1, matching constraints | Review whether one already-acquired scratch buffer can safely serve both directions for the actual modes, with exact ownership/alias/tail tests. input_bounce=0 rules out that shortcut. |
| External DMA-capable output with cache misalignment and compatible full-block lengths | Review a strictly local aligned-external scratch alternative, including every tail/block case. An aligned pointer alone is insufficient; a bad substitution can recursively bounce again. No global preference change or blind PSRAM substitution. |
| Largest block appears sufficient, or before/after/free-block values change | Inspect alignment/heap-selection/accounting and concurrency. Snapshot races/ABA or integrity problems remain possible. Do not hide it with a retry or claim a memory fix from these values alone. |
| Nonzero cache_result, missing/truncated/duplicate record, task/size/caps mismatch or dropped records | Observation is insufficient/inconsistent; no functional correction is selected. Preserve raw evidence and identify the specific missing fact rather than repeating the same phone-only test. |
| Full Settings retrieval succeeds with no output allocation failure | Record observed success. It does not retrospectively establish why Rev. 2.5 failed or prove a functional fix; Rev. 2.6 is measurement-only. |
| HTTP 409 / SETTINGS_BUSY_OR_UNAVAILABLE with no admitted send | Separate admission result; empty allocation/heap arrays are expected and prove neither memory success nor broken instrumentation. Do not retry or change admission guards. |

The fields are sufficient to distinguish the common stable-state cases and select the next focused source review. **They cannot guarantee a unique correction under concurrent heap changes.** No speculative functional fix is included in this revision.

## Supported compilation retry

Keep the original failed build/logs/result unchanged. With identical pinned source/configuration, retry into a fresh directory:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File C:/HuginnEIS/REV2.6-OWNER-BUILD.ps1 -BuildDir C:/HuginnEIS/Huginn/Firmware/huginn/build-rev2.6-20261105-retry01
powershell -NoProfile -ExecutionPolicy Bypass -File C:/HuginnEIS/REV2.6-OWNER-VERIFY.ps1 -BuildDir C:/HuginnEIS/Huginn/Firmware/huginn/build-rev2.6-20261105-retry01
```

Use that same `-BuildDir` for FLASH and CAPTURE if it verifies. A necessary source correction requires review and a separate new pre-compilation attestation; never overwrite or silently refresh old evidence.
