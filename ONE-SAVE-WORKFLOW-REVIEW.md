# One explicit Save with automatic validation — 2026-11-06

## Resumption verification — 2026-11-07

Read-only authenticated Cloudflare and normal-TLS canonical/immutable checks confirmed **9dce699595b724ea is already live**, production deployment **ed68bd11-ba85-45e5-9894-e844e8fe8b09**. **No redeployment or rebuild was performed.** All 32 frozen files matched the recorded inventory/lengths/hashes; all 30 publicly served assets matched the candidate, including settings modules/HTML, worker, manifest and icons. Effective CSP and JavaScript MIME checks passed. Rollback **ff580b82-8aed-43b8-9a59-6fa9bdd1911b / a891e07022384c69** remains present with matching immutable manifest and retained local copy. Evidence: [recheck-20261107-1794010536024.json](build/one-save-review/publication/recheck-20261107-1794010536024.json). Existing Wrangler OAuth required normal refresh before API checks succeeded; no account/permissions change occurred.

The 105 tests are the retained preparation results, not newly rerun tests. Historical FIRMWARE_HEAD remains failed, unchanged and not counted passed. Two uncorrelated AES allocation failures and the physical POST validation transport issue remain unresolved. Successful GET or public deployment does not prove POST success. No firmware/device operation, settings write or autonomous COM access occurred. SD investigation is paused; the owner has no replacement card. COM10 remains untouched.

The current validation-only procedure below remains applicable. Retrieve the actual authoritative brightness first: **95 was the last owner-confirmed value; 80 was only an unconfirmed draft**. Do not assume either is the current readback. Make one valid draft edit, observe automatic validation, and **never click Save during this acceptance**. Preserve the matching phone result and stopped capture folder. The folder does not exist in this task yet; use its actual printed path with the required `-CaptureFolder` argument when reading it, never an older/latest guessed folder.

## Authorized publication — completed 2026-11-06

Egill authorized and published the exact frozen **9dce699595b724ea** candidate, without rebuilding. Production deployment **`ed68bd11-ba85-45e5-9894-e844e8fe8b09`**, immutable URL `https://ed68bd11.huginnapp-pwa-test.pages.dev`, now serves `https://huginnapp-pwa-test.pages.dev`.

All **32 frozen files** matched the reviewed inventory/lengths/SHA256 before upload and remained unchanged afterward. Authenticated project/production GETs and normal-TLS public GETs verified canonical/immutable `build.json`, all **30 publicly served manifest assets** against candidate bytes, JavaScript MIME, changed settings modules/HTML, service worker, manifest/icons and effective CSP. `_headers` is the non-public control input, uploaded separately by Wrangler. Post-check: **2026-11-06T13:46:37.742Z**. Evidence: [before.json](build/one-save-review/publication/before.json), [after.json](build/one-save-review/publication/after.json).

Rollback **`ff580b82-8aed-43b8-9a59-6fa9bdd1911b` / `a891e07022384c69`** remains present and its immutable manifest still matches; a complete verified local package is retained under `build/one-save-review/publication/rollback-ff580b82-8aed-43b8-9a59-6fa9bdd1911b`. Initial API access returned HTTP 401/code 10000, Authentication error. Existing Wrangler 4.149.0 `whoami` completed normal OAuth refresh; subsequent API checks succeeded. No login/account/permission change or credential disclosure occurred.

The **two uncorrelated AES allocation failures and physical POST transport issue remain unresolved**. The UI simplification is not a transport fix. Historical FIRMWARE_HEAD remains failed. No firmware build/change, flash, reset, COM access, device settings write, browser-storage access, commit or push occurred. Public verification does not establish installed-iPhone activation or physical automatic-validation success. The preparation record below is retained as historical evidence; its undeployed wording is superseded by this publication record.

### Current first acceptance — validation only, no Save

1. While online at the existing canonical origin, open the installed PWA with no transfer, pairing scan or settings operation running. Close other HuginnAPP windows. Under **Stillingar → Stillingar apps**, use **Uppfæra HuginnAPP** when offered; let its normal reload finish. If not yet offered, close/reopen the existing app while online and check again. Do not clear data or reinstall.
2. Under **Ítarlegt → Útgáfa og offline-geymsla**, press **Athuga útgáfu og geymslu**. Require App build, Active Service Worker and Controlling Service Worker all **9dce699595b724ea**. This check alone does not install an update. Confirm offline cache status before leaving Internet access.
3. With COM5 already normally booted in Rev. 2.7/REC WAIT, no competing reader and no reset, start the owner capture command below. Wait for **ARMED before pairing, retrieving or editing on the phone**. Do not press RESET while capture is open.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File C:/HuginnEIS/REV2.7-OWNER-CAPTURE.ps1
```

4. Join HuginnEIS Wi-Fi. On HuginnEIS open **Connectivity → Flight Courier** as needed for pairing, follow the existing pairing/reconnect workflow, then leave MAIN visible. In HuginnAPP open **Stillingar → Sækja núverandi stillingar** and note the retrieved brightness.
5. Make **one modest valid brightness draft edit**. Keep focus in the field. Confirm the immediate summary, checking state and automatic validation result. **Do not click Vista breytingar, even if enabled.** This sends non-persistent preview only. If it fails, do not repeat the same attempt.
6. Retain the phone result: operation/method, HTTP status, declaredBytes, receivedBytes, phase, code and visible validation state. Stop capture normally and retain its full raw log and exact printed folder. Use the existing reader with **`-CaptureFolder` plus that actual folder**, not a guessed/latest folder. GET-scoped counters do not cover POST; inspect generic AES/TLS errors in the full capture as well. Share sanitized diagnostics only, never pairing data. No save or persistence test is part of this first acceptance.

**Prepared, not deployed: `9dce699595b724ea`.** No firmware change, target build, flash, reset, COM access or physical settings write occurred. COM10 remained untouched. Retained Rev. 2.7 binary SHA256 remains `3e19713449125cf1ec927159e0c280722fc0392733d18cd1b095392fe09be3c4`.

## Reviewed behavior

- Removed the Preview button. One **Vista breytingar / Save changes** button remains.
- Numeric/text `input`, checkbox `input` and select `input/change` update the draft and local summary immediately. Empty or invalid numeric text remains visible and blocks validation/save; it is not converted to zero. Keyed controls preserve focus/caret during validation and dependent-field updates.
- A 700 ms debounce submits the existing **non-persistent** POST preview protocol. Only one automatic validation is in flight. Edits during that request immediately invalidate its authority and coalesce into the latest valid draft; obsolete responses cannot enable Save. No failed validation is automatically retried. Edit a field to validate again.
- Localized control-adjacent states distinguish checking, ready, invalid, failed validation, disconnected, saving, uncertain save and verified saved. The summary exists before server validation, for example `Birta: 95% → 90%`; screenshots use disposable fixture values.
- Save requires a complete validated preview of the current draft, baseline and connection. Firmware previews expire after 120 seconds; readiness conservatively expires 90 seconds from request dispatch, including response time. A late response cannot enable Save. Expiry does not refresh automatically: edit a field to validate again.
- Only an explicit Save click sends apply. Duplicate clicks are blocked. The same canonical request bytes validated by the server are used for apply; existing SHA, identity, revision, proposed-field and authoritative readback guards remain unchanged.
- An uncertain save blocks further writes. Its intended values/revision stay in memory, bound to device/origin, through reconnect. A fresh explicit GET can confirm it only if all authoritative values and revision match. A differing readback remains uncertain; no automatic write/retry occurs. No claim of persistence across device restart is made.
- Reconnection retains safe drafts, but requires fresh device readback and new validation. No pairing secrets or settings writes are persisted/replayed. Browser storage, downloaded files, exact-byte transfer/export, NO-ACK, protected-time exclusion, QR/reconnect logic, three tabs, style, manifest and icons are preserved.

Functional changes are confined to `pwa/settings-ui.mjs`, the new controller appended to `pwa/settings-v2.mjs`, and the settings controls in `pwa/index.html`. Entry/worker changes are build stamps only. Source transport and pre-existing protocol/session validation are unchanged. The supported Rev. 2.7 device uses settings V2; this review exercises that actual protocol.

## Full saved capture, independently checked

Read all 4,054 raw bytes of `C:/HuginnEIS/Evidence/REV2.7-COM5/console-20261106T095424Z/console.raw`. SHA256 matches **`5d444f40c5b0a7b6b4b39e98bcc4ad6c6c23d736a7509980597f1f3e21166357`**; JSONL chunks also match the raw evidence. Analysis receipt: [capture-review.json](build/one-save-review/capture-review.json).

| Device uptime (ms) | Established observation |
|---|---|
| 47443103–47443118 | Local settings page entry/build/load markers. |
| 47451189 / 47451276 | Station leaves, then rejoins; DHCP follows. |
| 47479860–47479987 | GET-scoped HS2 request 15: 29,502 bytes serialized/accepted; HTTP result 0; HTTPS return 29,502; zero allocation records/drops. |
| 47503128–47503185 | Generic `esp-aes: Failed to allocate memory`, TLS write `-0x0001`, then URI handler failure. |
| 47517156 | Another HTTPS handshake. |
| 47518495–47518553 | Second generic AES allocation failure, TLS write error and URI handler failure. |
| 47546064 | Station leaves later, after both errors. |

The summary misses the two generic AES errors because Rev. 2.7's request-scoped send/allocation instrumentation admits **GET with top-level fields only**. POST preview returns top-level `proposed` and does not enter that scope. Empty POST diagnostic records do not establish successful preview or broken instrumentation.

The errors establish allocation failures on AES/TLS paths, but do not record route/method, request ID, allocation site/size/caps or eligible-heap state for those failures. They are compatible with the reported preview failure; this capture cannot conclusively attribute either error to that preview or select its failing allocation. The wrapped TLS `-1` is not a recovered original mbedTLS error. The later Wi-Fi departure does not establish the trigger of the earlier failures.

### Event and response path

The retained pre-change UI snapshot shows Preview click → `run` → `work('preview')` → `session.preview()` → canonical patch/SHA → `settingsTransferV2('preview')` → authenticated POST `/api/v2/settings/preview`. Success is rendered only after the full bounded body, UTF-8, JSON, schema, identity, baseline, digest and proposed-value checks. A failed body prevents preview authority. The capture cannot establish whether a particular click was disabled, dispatched or successfully validated; removing the button is not a transport correction.

The new scheduler calls the same session method. The source still caps Settings bodies at 131,072 bytes and retains stream/length checks, timeout/cancellation and stale-generation guards. A 4,096-byte interruption is not accepted as a partial success.

Read-only firmware trace: the handler receives the complete POST body, hashes/parses it and **unconditionally frees its request buffer after parsing**, before owner-job scheduling. It builds the full detached proposed response, serializes it, sends its exact `strlen` through `httpd_resp_send`, then frees serialization and releases the job. Existing TLS/AES behavior is unchanged. Host preview tests construct actual full proposed responses and inject interrupted streams; they do not reproduce the physical allocator or prove full device delivery. A safe firmware correction cannot be selected from this capture's unidentified allocation site. No speculative firmware patch/revision was prepared.

## Checks actually run

`node scripts/pwa-build.mjs` produced the reviewed static PWA. The final serial focused run passed **105 tests, 0 failed/skipped/cancelled**, using disposable host settings and browser profiles:

```powershell
Set-Location C:/HuginnAPP
node scripts/check-one-save.mjs
```

Coverage includes automatic debounce/coalescing and expiry, actual host-protocol edit/preview/apply/readback, duplicate Save, rapid edits, delayed old responses, invalid/empty numeric input, text/caret, checkbox/select events, server denial, truncated POST body, disconnect/reconnect with draft retention and fresh validation, uncertain save followed by read-only reconciliation, protected fields, QR pairing, source lifecycle, Settings/error diagnostics, bounded response edges, IndexedDB integrity/pressure, worker update recovery, approved icons and FLG integrity.

The AUX extension initially expected readiness after changing a profile to empty. The actual host firmware correctly denied that profile. The final test requires the validation POST to occur after removed-invalid-marker cleanup, then asserts the real rejection code and disabled Save. Validation was not weakened to accept the invalid profile. Initial failed runs remain in `build/one-save-review/extended-browser*.log`. The initial sandbox run could not execute the host/browser fixtures; its incomplete log is retained, and only that stalled test tree was terminated. The authorized run passed. These are host/browser results, not physical iPhone or firmware-server proof.

Older manual-Preview UI scripts retain their obsolete button sequence and were not counted as passed. Their active workflow cases are covered by `tests/pwa-one-save-browser.test.mjs`; model/protocol guards are retained and tested. The historical **FIRMWARE_HEAD remains failed**, expected `2b7323b749e517fabab6134f4d4493ec22bc0b3b`, actual `74f45528a8aece434d9af1b757b18bc8caa8fe45`; its guard is unchanged and it is not included as passing. Syntax checks for both settings modules and `git diff --check` passed (existing line-ending notices only).

Final log: [final-focused-tests.log](build/one-save-review/final-focused-tests.log), SHA256 `9faaa222f1a567d4aba5e40b6c20cd85fb4c1d36a6cb191e78b1856e4d352f40`.

## Phone-sized screenshots

390 × 844 disposable Edge browser fixtures, visually reviewed; not iPhone captures:

- [Checking](build/one-save-review/screenshots/checking.png)
- [Ready to save](build/one-save-review/screenshots/ready.png)
- [Invalid input](build/one-save-review/screenshots/invalid.png)
- [Validation denial](build/one-save-review/screenshots/validation-error.png)
- [Interrupted response](build/one-save-review/screenshots/response-body-error.png)
- [Uncertain save](build/one-save-review/screenshots/uncertain-save.png)
- [Verified saved](build/one-save-review/screenshots/verified-saved.png)

## Frozen candidate and rollback

Exact directory: **`C:/HuginnAPP/build/one-save-review/candidate-9dce699595b724ea`**, exactly **32 files**. Every name, byte length and SHA256 is recorded in [final-candidate-review.json](build/one-save-review/final-candidate-review.json). `SHA256(build.json)` = **`6547ed24798fe157390ec1001949e63c85d6fc6815316ab9a6159639ada462e1`**. Intermediate `effdb35b51a6d13f` predates expiry handling and is superseded; it is not the candidate for deployment.

Read-only normal-TLS public GETs confirmed canonical and retained immutable `build.json` match deployed **`a891e07022384c69`**. Last recorded deployment **`ff580b82-8aed-43b8-9a59-6fa9bdd1911b`** / `https://ff580b82.huginnapp-pwa-test.pages.dev` is the rollback reference; Cloudflare API identity was not requeried. Its complete hash-verified 32-file package is retained at `build/one-save-review/rollback-final-a891e07022384c69`. No Cloudflare changes occurred.

Offline final artifact verification, without rebuild:

```powershell
Set-Location C:/HuginnAPP
node scripts/prepare-one-save-review.mjs --verify
```

Prepared command **for later explicit authorization only; not executed**:

```powershell
Set-Location C:/HuginnAPP
$env:CLOUDFLARE_ACCOUNT_ID = 'afc733ae88054c22d7214b083132bfbc'
$env:WRANGLER_SEND_METRICS = 'false'
node C:/Users/egill/AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/wrangler/bin/wrangler.js pages deploy C:/HuginnAPP/build/one-save-review/candidate-9dce699595b724ea --project-name huginnapp-pwa-test --branch main --commit-dirty=true
```

## Historical proposed acceptance — superseded by validation-only procedure above

No physical test was performed or requested during preparation. Future steps:

1. Online, update the existing PWA at the same canonical origin using its normal idle update flow. Confirm app, active worker and controlling worker all show `9dce699595b724ea`. Preserve browser data and installation.
2. With COM5 normally booted in Rev. 2.7/REC WAIT and no competing serial reader, start the existing `REV2.7-OWNER-CAPTURE.ps1` and wait for **ARMED before any phone request**. Do not press RESET while capture is open. This capture retains generic POST errors; the existing scoped counters remain GET-only.
3. Join HuginnEIS Wi-Fi, pair/reconnect through the existing workflow, leave MAIN visible, open **Stillingar**, then **Sækja núverandi stillingar**. Record the authoritative initial value. This first stage is read-only.
4. For an owner-approved reversible brightness edit, type the draft while retaining focus. Confirm the immediate summary and checking state. Wait for readiness. If validation fails, **stop without Save** and retain the sanitized POST status/declaredBytes/receivedBytes/phase/code plus capture; do not repeat identical failed requests.
5. Only after successful full validation, the owner may explicitly choose **Vista breytingar** once. Require verified authoritative readback. If uncertain, use **Sækja núverandi stillingar** for read-only reconciliation; never replay an uncertain save. After a confirmed changed value, restoring the initial value requires its own validation, explicit Save and verified readback. Stop writes if recovery is uncertain.
6. Stop capture normally. Retain the folder it prints; use the existing reader with the required `-CaptureFolder 'C:/HuginnEIS/Evidence/REV2.7-COM5/console-<actual timestamp>'` argument. Correlate phone results with the full raw capture. Complete Settings response delivery, repeated reliability, restart persistence and flight release remain unverified.
