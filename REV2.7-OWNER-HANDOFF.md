# HuginnEIS Rev. 2.7 — functional AES scratch correction

**Physical acceptance update — 2026-11-05:** The saved `console-20261105T205803Z` capture and owner-reported matching phone result establish **one successful, complete/schema-valid Settings retrieval** (29,502/29,502 bytes). See [physical acceptance review](REV2.7-PHYSICAL-ACCEPTANCE.md). Flight-list HTTP 503 remains unexplained; repeated reliability, Settings persistence and flight release are not established. The preparation/owner procedure below is retained as historical context; do not rebuild or flash merely to repeat this review.

Prepared 2026-11-05. **Source and owner workflow are sealed; firmware compilation, installation and physical acceptance remain pending.** No target build, flash, reset, deployment or COM access occurred during preparation. No further diagnostic-only revision is introduced.

## Candidate and safety checks

The functional change remains exactly the reviewed ESP32-S3 **output-bounce with no input bounce** path. Scratch/chunk size is 1,024 rather than 1,600 bytes. Other paths and targets retain their original limit. PROJECT_VER and SYSTEM / APP build ID consistently identify **HuginnEIS Rev. 2.7**. No application behavior changed during this owner-workflow preparation.

1,024 is a multiple of the actual **16-byte AES block** and measured **64-byte external cache line**. This does not align the original external pointer: its unaligned output still uses the internal bounce buffer. The existing allocation alignment/capability request is unchanged, with native internal DMA alignment supplied by the allocator. All intermediate chunks are complete AES blocks. The existing final stream-tail handling and stream_out propagation remain. Both initial allocation and loop processing use the same limit, covering the complete byte range once. In-place input is read before each scratch result is copied back; later input bytes are not overwritten early.

The actual extracted routine was tested at partial-final, boundary and full-response lengths, in-place/out-of-place and all ownership combinations. AES-128/256 CBC/CTR/GCM software-reference output, decrypt and GCM tags agree. Every allocation and inner DMA failure position was exercised; original error propagation, initial-allocation failure zeroization and balanced cleanup remain. This uses allocator and hardware seams, not the target AES peripheral or a real TLS exchange. The existing AES hardware locking, key/mode state, cache operations and cleanup code are unchanged; scratch remains invocation-owned, without shared mutable storage.

**A scratch allocation fitting alone is insufficient.** The target syntax assertions verify two **12-byte** descriptors for these chunk sizes, using the original 8-byte aligned allocation. The conservative host fragmentation model includes descriptors and 32 bytes charged per allocation: scratch plus descriptors peaks at 1,120 bytes, with at least 931 bytes free and a 416-byte largest block remaining in that model. Actual unmodified SDK TLSF compiled on the host admits scratch plus descriptors 10,000 times from a 1,536-byte pool, retaining a 472-byte largest block without drift. These are host margins, not a target reservation: concurrent allocations or a worse heap can still cause a genuine error. Input-bounce cases are not claimed solved. No hidden retry, permanent memory reserve, TLS/authentication change or global allocation-policy change was added.

Existing host results are pinned rather than rerun to manufacture a new result: 200 complete 29,502-byte fixture-response sequences, boundary/tail/ownership/error tests under ASan/UBSan, four serialized callers, actual SDK allocator check and Xtensa syntax-only check. Detailed mechanism, alternatives and limitations: `C:/HuginnAPP/SETTINGS-DMA-SCRATCH-CORRECTION-REVIEW.md`.

## Sealed inputs and verification

- Fresh default build: `C:/HuginnEIS/Huginn/Firmware/huginn/build-rev2.7-20261105` — **not created by preparation**.
- Pre-compilation attestation: `C:/HuginnEIS/Evidence/REV2.7-PREPARATION/prepared.json`, SHA256 `727d6f32cfefac417bbe7c87a34b6988210182754f318bfb010563db67812cd4`.
- Functional identity/test evidence: `C:/HuginnEIS/Tools/rev27-functional-inputs.json`, SHA256 `76b19dd89e3df3317bac26fa9a1ac38b300468810759a3b7e35434fc28d2bdbb`.
- Exact reviewed patch SHA256: `d10bf6a85fd36ff400ce661d5cc27a5cc2c9a0c8e306a95ed30ab4116d21bcb5`.
- AppOrigin remains **https://huginnapp-pwa-test.pages.dev**, pinned in the helper and receipt; no prompt or local TLS setup.
- Existing ESP-IDF **5.5.2**, Python **3.12.0**, dependency versions and established Rev. 2.2 configuration seed retained. Normal services and QR remain enabled; bench recording inputs remain OFF.

BUILD is build-only and pins current inputs before invoking IDF. VERIFY requires successful completion, fresh artifact timestamps, unchanged source/configuration/toolchain/scripts/functional evidence, correct target/revision, valid embedded image checksum/SHA256, partition compatibility, image size/hash and **0x20000 / 0x400000 OTA0** bounds. It requires actual project-local AES and diagnostic sources selected in compile commands and their objects/functions linked in the ELF/map, with the existing dynamic TLS wrapper present. A patch file alone is not proof of compilation.

FLASH repeats verification and performs the retained COM5 app-only procedure: verified full-flash backup, exact live partition/OTA-selection compatibility checks, one app write, independent readback and comparison of every byte outside the app erase envelope. It does not rebuild, erase NVS/SD, replace bootloader/partition table, or retry automatically. It enters the bootloader and requests normal boot only after verification succeeds. If it stops, preserve evidence and inspect the reported defect before any further action.

CAPTURE verifies the intended artifact before opening COM5, then uses the established exclusive receive-only reader. It requests no reset, writes, baud or serial-control-line changes. READ-DIAGNOSTIC reads saved files only, requires **-CaptureFolder**, and has no latest-folder fallback. At capture stop the tool prints the exact copyable reader command with the actual folder already supplied.

## Owner procedure — one read-only physical attempt

1. **Build only**. No board connection is used by this command:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File C:/HuginnEIS/REV2.7-OWNER-BUILD.ps1
```

2. **Verify offline**. Stop if any check fails:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File C:/HuginnEIS/REV2.7-OWNER-VERIFY.ps1
```

3. Close all serial readers. **Owner flash on COM5**, app-only; this command performs bootloader handoff and normal boot after a verified write:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File C:/HuginnEIS/REV2.7-OWNER-FLASH.ps1
```

4. After normal boot, confirm **HuginnEIS Rev. 2.7**, normal MAIN and yellow **REC WAIT**. Do not start a recording or alter settings. Confirm the installed iPhone PWA's app/active worker/controlling worker identify the intended existing build **271f2c06c31e3889**; no new app deployment is required by this task. Complete any normal online update before switching to HuginnEIS Wi-Fi; do not clear data or reinstall.

5. With no competing serial reader, **start capture after normal boot**:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File C:/HuginnEIS/REV2.7-OWNER-CAPTURE.ps1
```

Wait for **ARMED** and note its exact folder. **Do not press RESET, power-cycle, flash or open another reader while capture is open.** Capture must be ARMED before the following phone actions. A startup capture is unnecessary.

6. Open HuginnEIS **Connectivity > Flight Courier**, follow the existing pairing workflow with the PWA, then leave **MAIN** visible on HuginnEIS. In HuginnAPP open **Stillingar / Settings > Greining / Diagnostics** and press **Athuga tengingu (aðeins lestur) / Check connection (read only)** **once**. This performs authenticated flight-list GET and Settings GET; the Settings session validates the complete response/schema. Do not press Preview/Apply/Save, change fields or perform a second retrieval during this attempt.

7. Preserve the phone's sanitized diagnostic JSON. Require the Settings/retrieve result to say **outcome=valid**, **HTTP 200**, complete declared/received byte counts, and no UTF-8/JSON/schema failure. The expected unchanged response is currently 29,502 bytes, but compare the actual declared/received/serialized lengths rather than treating that number alone as validation. A vanished error, an HTTP 200 header, accepted TLS plaintext, or a working flight list alone is **not acceptance**. No settings save is part of this procedure.

8. Stop capture with **Ctrl+C** after that one attempt; do not reset the board. Copy and run the **Saved diagnostic command** printed by the capture tool. It has this form, with the actual ARMED folder substituted by the tool:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File C:/HuginnEIS/REV2.7-OWNER-READ-DIAGNOSTIC.ps1 -CaptureFolder 'C:/HuginnEIS/Evidence/REV2.7-COM5/console-YYYYMMDDTHHMMSSZ'
```

The displayed timestamp above is a template, not an existing capture. Use the exact printed command; do not substitute an older capture.

9. Share the saved reader result and phone diagnostic together. Correlate request ID, serialized bytes, TLS body accepted, HTTP result, raw/wrapped TLS returns, errno snapshots, send time and allocation summary (records/dropped/task). If an allocation fails, include site/bytes/caps and matching heap observations. Successful sends normally have no allocation-failure/heap-failure record; empty arrays alone prove neither success nor broken instrumentation. Device send success should report HTTP result **0** and accepted body bytes equal to serialized bytes, **and** the phone must report the complete schema-valid response. A 409 denial remains a separate admission issue and does not exercise this full-body path. On failure preserve this attempt; do not repeat automatically or infer a new cause from a generic error.

The reader excludes tokens, secrets and raw response bodies from its output. Keep raw console captures private. Phone diagnostics and device evidence must belong to this same attempt. Success would establish this attempt's complete retrieval, not the identity of earlier memory owners or a general absence of leaks.

## If owner compilation fails

Retain the failed directory, console/logs and all receipts. Do not run clean, overwrite the attempt or bypass VERIFY. If source/configuration and sealed inputs are unchanged and a retry is appropriate, choose a **new** directory:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File C:/HuginnEIS/REV2.7-OWNER-BUILD.ps1 -BuildDir C:/HuginnEIS/Huginn/Firmware/huginn/build-rev2.7-20261105-retry01
powershell -NoProfile -ExecutionPolicy Bypass -File C:/HuginnEIS/REV2.7-OWNER-VERIFY.ps1 -BuildDir C:/HuginnEIS/Huginn/Firmware/huginn/build-rev2.7-20261105-retry01
```

If that succeeds, pass the same **-BuildDir** to FLASH and CAPTURE. A source correction requires review and a new separate preparation attestation before compilation; old pins must not be edited to pretend it was the sealed candidate. Do not reuse an unsuccessful/stale binary.

## Preparation checks and preservation

**24 new owner/reader host tests passed** with disposable fixtures and mocked flash calls: freshness, failed builds, retry preservation, source/configuration/script/toolchain/functional-evidence identity, local component selection/linkage, app-only protection, capture/read-only behavior, required explicit folder, sanitized fields and complete/incomplete request correlation. Six PowerShell scripts and three Python helpers parsed successfully. Existing official IDF/Python/dependency inspection, prepare/check and candidate verification passed. Logs/receipt: `C:/HuginnAPP/build/rev27-preparation/`.

**3,604 retained files were hash-verified unchanged**, including retained Rev. 2.6 artifacts/configuration/receipts/scripts/captures and earlier pinned inputs. Shared SDK component inventories remain identical. The first attestation was launched without the official environment and failed its version query before any receipt/build; that empty attempt and error were preserved under `C:/HuginnEIS/Evidence/REV2.7-PREPARATION-ENV-FAILED/`. The successful sealed attestation used the official environment. No target build or physical operation occurred.

Recording, CAN, CHT thresholds, accepted UI, settings admission/transport, protected times, pairing behavior, HuginnAPP storage/NO-ACK, COM10 and Muninn remain untouched. The historical **FIRMWARE_HEAD** test failure remains recorded as failed (expected `2b7323b749e517fabab6134f4d4493ec22bc0b3b`, actual `74f45528a8aece434d9af1b757b18bc8caa8fe45`); its guard was not changed or claimed passed. REC FAIL investigation remains separate.
