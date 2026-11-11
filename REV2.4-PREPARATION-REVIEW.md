# HuginnEIS Rev. 2.4 — bounded Settings allocation measurement

Prepared under Egill's explicit authorization. Firmware compilation, linkage, installation and physical acceptance remain pending. No board, serial port or Muninn was accessed; no PWA deployment occurred.

## Focused source changes

- Firmware `CMakeLists.txt` PROJECT_VER and `main/main.c` HUGINN_BUILD_ID both say **HuginnEIS Rev. 2.4** (SYSTEM / APP uses that build ID).
- A complete project-local copy of the installed ESP-IDF 5.5.2 `mbedtls` component overrides the SDK component through normal IDF component resolution. Dependency sources/versions are retained; shared ESP-IDF remains unchanged. Local mbedTLS differs only in CMake diagnostic inclusion, the AES file below, and two new diagnostic files.
- Applied `protocol/aes-output-allocation-cleanup.patch` to the **local** AES DMA file. Output bounce allocation failure still zeroizes output and returns -1, but now uses cleanup, freeing an already-acquired input buffer. NULL output cleanup is safe. First input allocation failure owns no buffer; all normal/error DMA paths retain their cleanup. AES acquire/release stays in the unchanged caller; the bounce routine does not acquire/release locks. Caller CBC/CTR/CFB/OFB error paths still release hardware. Descriptor ownership and cleanup are unchanged.
- Four explicit failure calls cover the active S3 AES allocation sites: `bounce_input`, `bounce_output`, `block_descriptors`, and conditional `gcm_descriptors`. Each captures the original requested byte count/capability mask, constant site, function and source line **before** the existing zeroization/log/error path. No allocator arguments, alignment, return, retries or timeout changed. P4-only allocation branches are not instrumented; this build is strictly ESP32-S3. AES interrupt initialization has a different fatal log; PM-lock paths have different logs (PM is disabled in the retained configuration). These are not silently classified as the measured generic allocation error.
- New `port/huginn_aes_alloc_diag.c` retains at most eight records plus a saturating dropped count. It records elapsed microseconds and associates records with the existing HS2_SEND ID/task. It allocates nothing, logs nothing and takes no lock in the failure hook. One task-local boolean excludes foreign tasks before they access the request buffer; ISR activity is excluded. The selected Xtensa FreeRTOS port initializes compiler TLS in task stack setup (`uxInitialiseStackTLS`); there is no lazy hook allocation. This adds one boolean plus alignment to each task's TLS, without changing configured stack sizes. Scope begin/end are exclusively called by the existing single HTTPD task. No global failed-allocation callback is registered or replaced.
- Existing send diagnostics begin/end delimit the allocation scope. Reporting occurs afterward, outside AES hardware locks. The hook and scope/report functions preserve errno. Original TLS/HTTPS immediate errno captures and return propagation remain unchanged. No payload, bearer, pairing secret, certificate or key is logged. The saved reader allowlists numeric fields and constant site/function names; it excludes arbitrary task-name strings.

**The leak is demonstrated by host tests. Its contribution to the physical Settings failure is unproven.** Fixing its cleanup cannot make the failing allocation succeed. A successful next retrieval would establish that result, not retrospectively prove the old cause.

## Preservation, configuration and provenance

Retained and rehashed **2,007 files** covering the Rev. 2.3 build, receipts, owner scripts, preparation evidence and saved COM5 captures. None changed. Receipt: `C:/HuginnEIS/Tools/rev24-preserved-inputs.json`; before/after checks and component deltas: `C:/HuginnAPP/build/rev24-preparation/`.

Fresh owner build: `C:/HuginnEIS/Huginn/Firmware/huginn/build-rev2.4-20261104` (not created during preparation). The same validated Rev. 2.2 effective sdkconfig seed and Rev. 2.3 CMake options are retained: ESP32-S3, existing seven-partition layout, normal recorder, bench inputs OFF, pairing QR ON, existing TLS/authentication and AppOrigin **https://huginnapp-pwa-test.pages.dev**. The historical internal profile selector remains unchanged; it is not a board classification or owner gate.

Pre-compilation attestation created and checked successfully: `C:/HuginnEIS/Evidence/REV2.4-PREPARATION/prepared.json`. The existing official environment reports Python 3.12.0, satisfied pinned dependencies and ESP-IDF v5.5.2. All full source/component inventories exclude Git metadata and Python bytecode consistently; no compilation input is omitted by that filter. Actual compiled/link selection still awaits the owner build and mandatory VERIFY.

Final review also compared MAIN against its exact retained Rev. 2.3 source hash: original mixed line endings were retained byte-for-byte, with only the authorized build-ID bytes changed. An earlier unbuilt Rev. 2.4 attestation is retained under `REV2.4-PREPARATION-before-line-ending-preservation`; the fresh default attestation above pins the final bytes. No previous receipt was overwritten.

`REV2.4-OWNER-{ENV,BUILD,VERIFY,FLASH,CAPTURE,READ-DIAGNOSTIC}.ps1` use the existing ESP-IDF 5.5.2/Python environment. `Tools/rev24_release.py` pins current source, full local/shared component inventories, toolchain, configuration seed, scripts and AppOrigin before compilation. BUILD only builds. VERIFY requires successful/fresh receipts, exact output hashes, unchanged inputs, configuration, revision, ESP32-S3 target, image checksum/hash/size, partition compatibility and app-only bounds. It requires compile commands to use local AES, dynamic-wrapper and diagnostic sources, the final map to contain AES and diagnostic objects in libmbedcrypto, the dynamic TLS wrap flag, and diagnostic symbols in the final ELF. A patch file or resolver probe alone is not sufficient.

FLASH repeats verification, takes and verifies a full COM5 backup, compares live partitions/OTA selection, writes only the verified application at **0x20000**, maximum **0x400000**, then independently reads back and checks all bytes outside the app erase envelope. It preserves NVS, protected times/settings, bootloader, partition table and unrelated storage. It does not rebuild or retry automatically. Its bootloader entry/normal reboot happen only when the owner executes FLASH.

## Checks actually run

- GCC host checks with `-Wall -Wextra -Werror` and ASan/UBSan: original leak reproduction; applied cleanup on first/second allocation failures, zeroization, all four buffer ownership combinations, DMA-error cleanup; bounded record/drop behavior, exact fields, foreign-task/ISR exclusion, reset of request scope, errno retention. Hardware/allocator faults are injected.
- Actual SDK HTTP framing, TLS loop and dynamic-wrapper host regression with a complete 29,502-byte source-derived Settings fixture: normal full response and injected error propagation/partial progress retained. This does not prove physical TLS transmission.
- Five **Xtensa syntax-only** checks using existing Rev. 2.3 generated headers: MAIN, send diagnostic, TLS wrapper, actual local AES core and allocation diagnostic. Warnings retained, including `-Wall` and `-Werror=misleading-indentation`; no firmware configure/build/link occurred. An initial atomic lock-free assertion failed on Xtensa; the prepared implementation instead uses preallocated task TLS. The final five checks pass.
- **13 disposable owner-script/reader tests pass**, including stale/failed builds, changed source/config/artifact rejection, local-component selection, fresh retry, mocked app-only flash containment, capture source checks and sanitized allocation parsing. Mock flash output is not device verification.
- Installed IDF component resolver probe selects local esp-tls, esp_https_server and mbedtls. It is a compiler-free standalone CMake probe, not a target configuration/build.
- Owner PowerShell scripts parse successfully. Shared SDK hashes and retained evidence hashes match. Focused component diff reviewed; no allocator preference, TLS limit, transport policy, recording, CAN, CHT, UI-layout, settings/protected-time or PWA source change.

Logs and commands: `C:/HuginnAPP/build/rev24-preparation/{allocation-host.log,aes-host.log,send-host.log,xtensa-checks.json,owner-tests.log,component-delta.json,focused-component-diff.patch}`. The frozen PWA remains eb5241dc6e9995ba; it was not rebuilt or deployed.

## Owner commands and one physical attempt

Run these separately, stopping on any error. BUILD uses the AppOrigin above without Read-Host.

1. Build only; the wrapper loads ENV automatically:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File C:/HuginnEIS/REV2.4-OWNER-BUILD.ps1
```

2. Verify offline, without opening COM5:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File C:/HuginnEIS/REV2.4-OWNER-VERIFY.ps1
```

3. Close competing serial readers. Owner app-only COM5 flash, backup and readback:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File C:/HuginnEIS/REV2.4-OWNER-FLASH.ps1
```

4. Wait for normal boot. Confirm **HuginnEIS Rev. 2.4** and yellow **REC WAIT**. Then start receive-only capture; do not press RESET while it is open:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File C:/HuginnEIS/REV2.4-OWNER-CAPTURE.ps1
```

5. Pair the existing HuginnAPP through **Connectivity > Flight Courier**. Return to **MAIN** on HuginnEIS. In the existing PWA, open **Settings / Stillingar > Greining / Diagnostics > Check connection (read only) / Athuga tengingu (aðeins lestur)** once. Do not preview/apply settings or start a recording. Preserve the sanitized phone result: flight-list/settings HTTP status, declaredBytes, receivedBytes, diagnostic code and phase.
6. Stop capture with Ctrl+C normally (no reset). Read the latest stopped saved capture only:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File C:/HuginnEIS/REV2.4-OWNER-READ-DIAGNOSTIC.ps1
```

Share its sanitized JSON and capture folder under `C:/HuginnEIS/Evidence/REV2.4-COM5/`, together with the phone result. Match request IDs across HS2_SEND and HS2_ALLOC; use `site`, `function`, `line`, `bytes`, `caps`, `task`, `elapsed_us`, record/drop counts and the original send result/accepted bytes. `raw_tls` remains a post-dynamic-wrapper return, not a separately captured original mbedTLS error. A zero-record summary means no instrumented request-task AES allocation failure was observed, not that all possible system allocations succeeded. A rejected 409 GET is not admitted to this send scope and is not expected to produce these records.

If retrieval succeeds, report observed success without claiming the old physical cause proven. If it fails, use the captured allocation identity to choose a concrete correction; do not assume TLS/CORS/phone causation from errno alone. No automatic repeat or unrelated memory optimization is part of this plan.

## Supported compilation retry

Preserve the failed directory and logs. For a retry of **identical pinned source/configuration**, use a fresh directory; no stale binary is accepted:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File C:/HuginnEIS/REV2.4-OWNER-BUILD.ps1 -BuildDir C:/HuginnEIS/Huginn/Firmware/huginn/build-rev2.4-20261104-retry01
powershell -NoProfile -ExecutionPolicy Bypass -File C:/HuginnEIS/REV2.4-OWNER-VERIFY.ps1 -BuildDir C:/HuginnEIS/Huginn/Firmware/huginn/build-rev2.4-20261104-retry01
```

If that retry verifies, supply the same `-BuildDir` to FLASH. If a source correction is required, stop and review it; existing preparation pins intentionally reject it. Preserve the old receipt and create a separate reviewed preparation attestation before compilation. Do not overwrite or silently refresh the old receipt.
