# HuginnEIS Rev. 2.5 owner build handoff — 2026-11-05

**Preparation complete; target compilation, verification of a real Rev. 2.5 artifact and owner installation remain pending. No board/COM port was accessed. No phone experiment is requested now.**

## App deployment completed

Canonical **https://huginnapp-pwa-test.pages.dev** serves reviewed build **271f2c06c31e3889**, deployment **5d7cc058-f4cc-4c2a-ab1a-d64e6b12f8df**. Immutable URL: `https://5d7cc058.huginnapp-pwa-test.pages.dev`. Existing account `afc733ae88054c22d7214b083132bfbc`, project `huginnapp-pwa-test`, production branch `main`.

The exact frozen 32-file artifact was verified and uploaded without rebuilding. Canonical/immutable build.json agree; all **30 public assets** match the reviewed candidate, including automatic-pairing modules, service worker, manifest and accepted icons. Effective CSP/JavaScript MIME checks passed. `_headers` is the retained control input, not a publicly served file. No owner browser storage or recordings were accessed; installation identity, storage schema and NO-ACK remain unchanged.

Retain rollback deployment **c1f0e7c2-f13f-49f5-837c-e5145bf5a625**, build **1902bcca0f2edc78**, immutable URL `https://c1f0e7c2.huginnapp-pwa-test.pages.dev`. Hash-verified local copy: `C:/HuginnAPP/build/pairing-review/publication/rollback-c1f0e7c2-f13f-49f5-837c-e5145bf5a625`. No prior deployment was deleted. API/public receipts: `before.json`, `after.json`, `deployment-receipt.json` in that publication folder. Public deployment checks do not prove installed-phone activation or new physical pairing behavior. Egill already confirmed reconnection on 1902bcca0f2edc78.

## Firmware scope and preserved inputs

Source and SYSTEM / APP metadata consistently say **HuginnEIS Rev. 2.5**. The functional change remains only the reviewed **Pair Flight Courier** UI simplification: selecting it invokes the existing pairing/replacement operation once without the extra confirmation. Token rotation/revocation, readiness, QR presentation/cleanup, explicit revoke confirmation and cancellation remain unchanged. Settings transport/admission, send/allocation diagnostics, recording, CAN, CHT thresholds, MAIN layout, local settings/protected-time behavior and state are unchanged.

Reviewed source diff: `C:/HuginnAPP/protocol/pairing-ui-rev25.patch`; SHA256 **dce7440ea77bfd100a550e3099005b402f7539fa4c934e827d593275ce187bca**. Only pairing UI, MAIN build-ID bytes and CMake PROJECT_VER differ from the retained Rev. 2.4 source inventory. No further firmware source change occurred in this script-preparation task.

**1,992 retained Rev. 2.4 files** match preserved hashes, including binaries, configuration, scripts, build provenance and capture evidence. Existing Rev. 2.4 evidence/owner scripts were not edited or reused as new build evidence. Shared SDK and project-local diagnostic components retain the Rev. 2.4 hashes.

Fresh default build directory: **C:/HuginnEIS/Huginn/Firmware/huginn/build-rev2.5-20261105**. It does not yet exist. Fresh preparation receipt: **C:/HuginnEIS/Evidence/REV2.5-PREPARATION/prepared.json**, created and checked **before compilation**. No old binary is accepted as a new artifact.

AppOrigin is pinned to **https://huginnapp-pwa-test.pages.dev**, without Read-Host. The configuration retains the normal recording/services and QR support, with bench inputs OFF, the existing ESP32-S3 target and established partition geometry. The historical internal CMake profile selector is retained unchanged; it is not a board classification or MAC approval gate. The effective sdkconfig must match the established seed exactly.

The existing **ESP-IDF 5.5.2 / Python 3.12.0** environment is used without reinstall/upgrade. Toolchain, source/configuration, full local/shared component inventories and new owner scripts are pinned. ENV confirms the existing dependency environment; prepare/check passed. Actual compiled/link selection is enforced when the owner builds/verifies, not inferred from patch presence.

## Owner scripts and safeguards

All scripts are under **C:/HuginnEIS**:

| Script | Action |
|---|---|
| REV2.5-OWNER-ENV.ps1 | Load/check the existing environment; no build or device action. |
| REV2.5-OWNER-BUILD.ps1 | Fresh source/configuration pin before one target build; save raw merged log/result. Build only. |
| REV2.5-OWNER-VERIFY.ps1 | Offline revision/target/image checksum/size/hash, freshness, successful receipts, exact inputs/configuration, partitions and app-only bounds. |
| REV2.5-OWNER-FLASH.ps1 | Repeat verification, full COM5 backup/live-layout checks, one app-only write, independent readback and outside-envelope comparison. No rebuild. |
| REV2.5-OWNER-CAPTURE.ps1 | Offline-verify the intended build first, then exclusive non-resetting receive-only COM5 capture after normal boot. No write/baud/control-line changes, no automatic reconnect. |
| REV2.5-OWNER-READ-DIAGNOSTIC.ps1 | Read only an explicitly supplied stopped Rev. 2.5 capture folder; no latest-folder fallback or COM access. |

VERIFY must find compile commands for the local instrumented TLS/HTTPS/mbedTLS sources and reviewed pairing UI, their linked objects/symbols, the dynamic TLS wrapper, and all send/allocation diagnostic symbols. Source, configuration, script or toolchain mismatch, failed build, stale/mutated output, wrong revision/target or incompatible partitions causes rejection.

FLASH uses **COM5**, **app offset 0x20000**, **OTA0 capacity 0x400000** only after compatibility checks. It preserves NVS/settings/protected times, bootloader, partition table, OTA selection and unrelated flash/SD storage. Backup/readback evidence is new under `Evidence/REV2.5-COM5/flash-...`. Bootloader entry/reset happens only if the owner later executes FLASH. No automatic retry or rollback occurs on failure; retain the evidence.

CAPTURE requires the intended build to verify. It records the intended artifact hash/build path as host provenance; this is explicitly **not** a physical running-image readback. The owner must confirm Rev. 2.5 on the display after installation. The reader prints allowlisted send/allocation fields, not credentials, pairing secrets or settings bodies.

## First owner action: build only

The wrapper loads ENV automatically. Run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File C:/HuginnEIS/REV2.5-OWNER-BUILD.ps1
```

After BUILD succeeds, verify offline:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File C:/HuginnEIS/REV2.5-OWNER-VERIFY.ps1
```

Only after verification, the owner may separately execute installation:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File C:/HuginnEIS/REV2.5-OWNER-FLASH.ps1
```

No command above was executed by this preparation task. Do not use Rev. 2.4 BUILD/VERIFY/FLASH scripts for changed Rev. 2.5 source.

## Supported build retry

Keep the original failed build, logs and result unchanged. For unchanged pinned source/configuration, use a new directory:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File C:/HuginnEIS/REV2.5-OWNER-BUILD.ps1 -BuildDir C:/HuginnEIS/Huginn/Firmware/huginn/build-rev2.5-20261105-retry01
powershell -NoProfile -ExecutionPolicy Bypass -File C:/HuginnEIS/REV2.5-OWNER-VERIFY.ps1 -BuildDir C:/HuginnEIS/Huginn/Firmware/huginn/build-rev2.5-20261105-retry01
```

If successful, use that same `-BuildDir` for FLASH and CAPTURE. If compilation requires a source correction, review it and prepare a separate new attestation before compilation; never overwrite or silently repin the original receipt. Existing strict checks intentionally reject changed inputs.

## Physical testing gate — not a request to test now

Physical testing waits until the owner has installed/confirmed **both app 271f2c06c31e3889 (running/active/controlling worker) and firmware Rev. 2.5**, with normal REC WAIT. No phone experiment is requested during preparation. After owner readiness/authorization, capture must start **before any phone pairing or Settings action**:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File C:/HuginnEIS/REV2.5-OWNER-CAPTURE.ps1
```

Close competing readers first. Wait for **ARMED** and retain its exact `C:/HuginnEIS/Evidence/REV2.5-COM5/console-...` path. If it does not arm, do not proceed with phone actions. Do not press RESET while capture is open. A complete numbered acceptance procedure will be used only after the intended versions are confirmed installed; the earlier Rev. 2.4 procedure is superseded for this next update.

After a later capture is stopped normally, assign `$captureFolder` to that exact ARMED folder, then read saved evidence only:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File C:/HuginnEIS/REV2.5-OWNER-READ-DIAGNOSTIC.ps1 -CaptureFolder $captureFolder
```

There is no automatic latest-folder selection. No older capture may be associated with a new attempt.

## Checks and unresolved evidence

**16 disposable owner-script host tests passed**: fresh pinning, failed/stale/mutated artifact and source/configuration rejection, local diagnostic selection, actual pairing source/link checks, fresh retry, mocked app-only flash containment, exclusive receive-only capture source, capture preflight and explicit-folder/sanitized reader behavior. All new PowerShell scripts parse and helper Python AST checks pass. These were host/fixture checks; mock flash output is not physical success. Evidence: `C:/HuginnAPP/build/rev25-owner/{host-test-results.json,script-checks.json,preservation.json}`. Existing 69 app tests and pairing firmware host/syntax results remain recorded in PAIRING-SIMPLIFICATION-REVIEW.md; no target build was run.

Historical **FIRMWARE_HEAD remains failed**, guard unchanged: expected **2b7323b749e517fabab6134f4d4493ec22bc0b3b**, actual **74f45528a8aece434d9af1b757b18bc8caa8fe45**. It is not reported as a passed vertical slice.

Latest physical Settings evidence remains screenshot-only: **HTTP 200, declared 29502, received 4096, RESPONSE_READ_FAILED, phase=body**, successful flight list **200 / 4234 / 4234**. No matching capture existed for that attempt and no allocation conclusion can be extracted from it. Earlier complete Settings 409 denials remain a separate admission issue. No Settings transport/admission correction is included in Rev. 2.5.

No target firmware build, flash, reset, capture, COM access, COM10 operation, Muninn change, commit or push occurred. The only published change in this task is the explicitly authorized frozen PWA artifact.
