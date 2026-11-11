# Pairing simplification — owner review, 2026-11-05

**Owner-authorized deployment completed on 2026-11-05: app `271f2c06c31e3889`. Firmware Rev. 2.5 owner preparation is complete; target build/installation remain pending.**

Production **5d7cc058-f4cc-4c2a-ab1a-d64e6b12f8df** serves the canonical `https://huginnapp-pwa-test.pages.dev`; immutable URL `https://5d7cc058.huginnapp-pwa-test.pages.dev`. The frozen 32-file artifact was rechecked and uploaded without rebuilding; canonical/immutable build identity and all 30 public assets, service worker, manifest, icons and effective CSP match. Retain rollback **c1f0e7c2-f13f-49f5-837c-e5145bf5a625 / 1902bcca0f2edc78**, with local public assets/control input in `build/pairing-review/publication/rollback-c1f0e7c2-f13f-49f5-837c-e5145bf5a625`. Receipts: publication `before.json`, `after.json`, `deployment-receipt.json`.

Fresh BUILD/VERIFY/COM5 app-only FLASH/CAPTURE/exact-folder READ-DIAGNOSTIC scripts and pre-compilation provenance are ready; see **C:/HuginnEIS/REV2.5-OWNER-HANDOFF.md** (review copy: `C:/HuginnAPP/REV2.5-OWNER-HANDOFF.md`). Sixteen new host tests and script parser checks passed; retained Rev. 2.4 inputs remain unchanged. No target build/flash/reset/COM action occurred. No phone experiment is requested yet: both intended app and firmware versions must be installed and capture armed before phone actions. The historical FIRMWARE_HEAD failure remains explicitly failed. Original source/app preparation findings below are retained as historical evidence; earlier references to pending deployment/build-script preparation are superseded by this update.

Egill confirms that deployed app **1902bcca0f2edc78 reconnects on the physical iPhone without restarting**. This is recorded as owner physical confirmation of that build's reconnection behavior. The new automatic-pairing behavior has host/browser coverage below, not physical approval. Current owner-reported firmware on COM5 remains **Rev. 2.4**.

## Focused implementation

### HuginnAPP

`pwa/index.html` removes the consent checkbox and extra Connect button. **Skanna QR og tengjast / Scan QR and connect** is the owner's connection intent. The established browser TLS profile is selected by default; the exact supported origin/profile checks still reject unsupported choices. OS/iOS camera permission remains required. No certificate trust is granted by removing this app checkbox.

`pwa/entry.mjs` connects automatically after the existing scanner validates a supported QR. It consumes a single scan intent before invoking connection work; duplicate valid callbacks cannot start another connection. The existing scanner still stops tracks and wipes frame data before its callback. Pending connection controls cannot start a second pairing. A new **Hætta við pörun / Cancel pairing** button cancels pending connection work, closes the obsolete source and invalidates its epoch. Scanner cancellation, backgrounding, late responses and one-source ownership retain their safeguards.

A successful connection closes the pairing view, selects **HuginnEIS**, and shows its fresh flight list. Invalid/unsupported QR produces clear Icelandic/English feedback without an attempted connection; a server-rejected expired/revoked authorization offers fresh QR in the same app. Transport/TLS failure is not mislabeled as proof that the QR expired. There is no automatic network retry or settings save.

The physically confirmed Reconnect path remains. Safe drafts survive same-device QR replacement in memory through the existing draft mechanism, but require fresh matching readback and a new preview; another device's baseline is never applied automatically. Endpoint/profile changes still discard the old source/draft. Stored downloads, resume validation, export, NO-ACK and protected times are untouched.

### HuginnEIS

`main/huginn_flight_pairing_ui.c`: selecting **Pair Flight Courier** now sets pairing intent and invokes the existing pairing path once. It no longer opens the additional initial/replacement confirmation page. The old operation itself is unchanged: revoke an active pairing first, require HTTPS/AP identity readiness, obtain entropy, call hfa_pair, generate/present QR, scrub temporary buffers and revoke on presentation failure. Selecting replacement therefore still invalidates the old token even if new readiness/presentation fails.

**Revoke Flight Courier** retains its own confirmation/cancel behavior. Close still hides/wipes the displayed token without revoking the active pairing. No authorization implementation, Settings admission guard, transport, allocation, recording, CAN, CHT, MAIN layout, settings or protected-time logic changed.

## Revision and provenance handling

The only firmware input changes relative to the retained Rev. 2.4 build-start source inventory are:

1. `main/huginn_flight_pairing_ui.c`: direct pairing action and intent comment.
2. `main/main.c`: HUGINN_BUILD_ID becomes **HuginnEIS Rev. 2.5**; every other byte, including mixed line endings, is unchanged.
3. `CMakeLists.txt`: PROJECT_VER becomes **HuginnEIS Rev. 2.5**.

The source changes are applied in the authorized working tree. Review diff: **C:/HuginnAPP/protocol/pairing-ui-rev25.patch**. SHA256: **dce7440ea77bfd100a550e3099005b402f7539fa4c934e827d593275ce187bca**. Its reverse-apply check passes against the actual current source. It is an exact review diff, not a patch to reapply to the already-changed tree.

**1,992 retained Rev. 2.4 files were hash-verified unchanged**, including build outputs/configuration, owner scripts, preparation/provenance and capture evidence. No retained artifact was relabeled Rev. 2.5. Audit: `build/pairing-review/firmware-audit.json`; original hashes: `rev24-preservation.json`; task-start source copies: `firmware-before/`.

Do **not** run the Rev. 2.4 BUILD wrapper against the changed Rev. 2.5 source. Its source pins should reject this mismatch, rather than silently build the change under old provenance. A later owner build requires a fresh Rev. 2.5 directory, attestation and matching BUILD/VERIFY/FLASH preparation. That target-build handoff is pending; this task delivers the focused source diff only. Existing Rev. 2.4 scripts/receipts were not modified. Shared ESP-IDF and dependency versions were untouched.

## Latest physical Settings evidence — no matching capture

Owner's correction is authoritative: **no serial capture was running** during the latest attempt. The screenshot is the only evidence:

| Endpoint | HTTP | Declared bytes | Received bytes | Result |
|---|---:|---:|---:|---|
| flight-list | 200 | 4234 | 4234 | Successful |
| Settings | 200 | 29502 | 4096 | RESPONSE_READ_FAILED, phase=body |

The Settings body is short by **25,406 bytes**. This is another incomplete Settings response, not the earlier complete 409 admission denial. It does not identify the failed allocation, request-side trigger or underlying cause, and does not establish that the cleanup correction resolved the physical problem. **No matching HS2_SEND/HS2_ALLOC diagnostics exist. No older capture is attributed to this attempt.** No additional experiment, capture or COM access was performed here. Settings admission guards and diagnostics remain unchanged.

## Verification actually performed

- **69 focused app tests passed**, including real temporary-browser automatic pairing, absent confirmation controls, invalid QR with no request, expired authorization, retry, pending-fetch cancellation, duplicate validated callbacks, successful tab/list presentation, fresh QR replacement, retained reconnection and safe drafts requiring readback/preview. The duplicate test deliberately invokes the scanner's valid callback twice through a test-only served module; production scanner bytes are unchanged.
- Actual offline PWA cold reopening and dense QR decoding use synthetic camera frames without a network dependency. The validated QR starts exactly one mocked device request; failure/retry does not persist pairing data. OS camera prompts themselves remain a physical iPhone check.
- Existing Settings response boundaries/diagnostics, TLS/origin/authentication restrictions, source changes/late responses, navigation during COMPLETE/INCOMPLETE fixture transfers and offline local export, CSP and accepted icons pass. Tests use temporary browser profiles/data and fixture endpoints.
- Firmware host harness compiles the **actual modified UI, actual authorization/token implementation and actual QR encoder** with GCC `-Wall -Werror -Werror=misleading-indentation`, ASan/UBSan. LVGL/readiness/entropy are simulated. A link wrapper counts real hfa_pair calls. First/replacement pairing runs once per selection, old tokens fail, readiness and presentation errors revoke, Close wipes display while keeping authorization, explicit revoke confirms/cancels, and pairing after a canceled revoke resets intent. No real token is printed.
- Two **Xtensa syntax-only checks pass**: pairing UI and MAIN, with retained Rev. 2.4 generated headers and warnings enabled. No target configure/build/link occurred and there is no Rev. 2.5 binary/ELF. Logs: `build/pairing-review/target-checks.json`, `*.syntax.log`, `host/result.log`.
- Exact firmware scope/preservation audit and reverse patch check pass. Git diff whitespace checks pass with existing Windows line-ending advisories.

The historical FIRMWARE_HEAD vertical-slice failure remains **failed**, not reclassified as passed or weakened: expected **2b7323b749e517fabab6134f4d4493ec22bc0b3b**, actual **74f45528a8aece434d9af1b757b18bc8caa8fe45**. Its existing record remains in RECONNECTION-REVIEW.md. It is not included in the 69 passed focused tests.

## Frozen app artifact

Directory: **C:/HuginnAPP/build/pairing-review/candidate-271f2c06c31e3889**. Exactly **32 files**.

SHA256(build.json): **a64372b561a20949d6881206c0a68d0ad331f22e26c8dca8ce8c1de02aab42ec**.

Full inventory/hashes: `build/pairing-review/candidate-review.json`. Twenty-eight manifest assets are byte-identical to deployed 1902bcca0f2edc78, including scanner/transport/settings protocol modules, draft UI, adapter/storage/evidence, app manifest, approved icons and fixture flights. Only entry/HTML behavior and normal service-worker build identity differ. Worker behavior and IndexedDB identity/schema are unchanged. Existing deployed/rollback candidates remain intact; no upload occurred.

Offline verification without rebuilding:

```powershell
Set-Location C:/HuginnAPP
node scripts/verify-pairing-candidate.mjs
```

## One complete procedure for a later owner-authorized physical attempt

**Do not run another attempt now.** This procedure is for later review/authorization, using the already-installed, instrumented **Rev. 2.4** on COM5. It does not require resetting, flashing or starting a recording. New app behavior requires separate deployment approval first. The unbuilt Rev. 2.5 touchscreen change cannot be physically accepted using Rev. 2.4.

1. While the iPhone has Internet, complete the installed PWA's normal idle update after a separately authorized deployment. Confirm app plus active/controlling worker show **271f2c06c31e3889**; preserve flights and do not clear data/reinstall. On the already-running COM5 board, confirm **Rev. 2.4** and normal **REC WAIT**. Close competing serial monitors/readers. Do not reset or reconnect the board to obtain cleaner logs.
2. **Before any phone pairing/Settings action**, start the existing receive-only capture from PowerShell:

   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File C:/HuginnEIS/REV2.4-OWNER-CAPTURE.ps1
   ```

   Wait for **ARMED**. Copy its exact `C:/HuginnEIS/Evidence/REV2.4-COM5/console-...` folder path. If it does not arm, stop this procedure; do not run the phone action or substitute an older capture. Keep this window open; **do not press RESET**.
3. On HuginnEIS open **Connectivity > Flight Courier > Pair Flight Courier**. Installed Rev. 2.4 still has its old confirmation; complete that existing step. On the phone choose **Scan QR and connect** and grant camera permission if iOS asks. Scan once. Verify automatic connection, pairing view closure and the HuginnEIS flight-list tab. Return the board to **MAIN** without revoking pairing. Record the approximate action time. Do not save settings.
4. Run exactly one **Settings > Diagnostics > Check connection (read only)**. Preserve its sanitized result: app build, HTTP status, declared/received byte counts, code and phase for both flight-list and Settings. Record the approximate action time. Do not preview/apply settings or start a recording.
5. Stop capture normally with Ctrl+C. Confirm **STOPPED** and the same folder path from step 2. In a second PowerShell window assign `$captureFolder` to that exact ARMED folder path, then read only that saved capture:

   ```powershell
   & C:/Espressif/tools/python/v5.5.2/venv/Scripts/python.exe -B C:/HuginnEIS/Tools/rev24_read_diagnostic.py --folder $captureFolder
   ```

   Do not use an earlier/latest-by-guess folder. If the capture failed or cannot be matched, report that limitation instead of correlating other diagnostics.
6. Share the sanitized saved summary and phone result together, including capture folder, raw SHA256, matching HS2_SEND request IDs and any HS2_ALLOC site/function/line/bytes/capabilities/task/timing/drop count. No bearer/pairing secrets or settings bodies are needed. A 409 with no send scope remains an admission issue. A complete retrieval establishes observed success only; a short response with matching allocation data permits a concrete next correction. Stop after this one attempt—no automatic repeat.

Firmware Rev. 2.5 pairing UI installation/physical acceptance remains a separate later owner build/verification/installation step with fresh provenance. No deployment, target build, flash, reset, serial capture or COM operation occurred in this task.
