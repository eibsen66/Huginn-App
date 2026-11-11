# Read-only flight-list error diagnostic — 2026-11-05

**Deployed with Egill's explicit authorization on 2026-11-05.** Production deployment **796dd3cf-9ad9-4dca-80db-574976c7630e** now serves reviewed build **acc6cd5e4cb6e49d** at **https://huginnapp-pwa-test.pages.dev**; immutable URL **https://796dd3cf.huginnapp-pwa-test.pages.dev**. All 32 frozen files were hash/length-checked immediately before upload and again afterward; no rebuild occurred. Canonical/immutable build.json match the candidate, all 30 public asset hashes match (including diagnostic modules, service worker, manifest and icons), JavaScript MIME and effective CSP pass. `_headers` is the remaining manifest-listed control input, not a public file. Public verification does not establish installed-phone activation or physical diagnostic results.

Rollback deployment **5d7cc058-f4cc-4c2a-ab1a-d64e6b12f8df**, build **271f2c06c31e3889**, remains present and its immutable manifest matches retained evidence. Fresh GET-only API checks confirmed account/project/production identity before and after upload. Initial GET returned HTTP 401/code 10000; existing Wrangler 4.149.0 `whoami` completed normal OAuth refresh and subsequent API checks succeeded, without login/account/permission changes or credential disclosure. Publication evidence: `build/flight-list-error-review/publication/before.json` and `after.json`; the pre-upload live assets/control input are retained under that publication folder. Existing rollback copies remain unchanged. No firmware build/change/flash/reset, COM access, Settings write, commit or push occurred; no owner browser storage was accessed. The preparation record below is retained as historical evidence; its references to pending deployment are superseded by this status.

**Prepared candidate `acc6cd5e4cb6e49d`; not deployed.** The canonical public PWA still serves `271f2c06c31e3889`. HuginnEIS Rev. 2.7 and its retained artifact are unchanged. The physical flight-list 503 cause remains unknown; this update exposes the existing server error code for the next diagnostic, without interpreting every 503 as one cause.

## Focused change

`pwa/source.mjs` now reads non-success **flight-list** bodies through the existing bounded stream, length and connection-generation checks. Error-body limit: **4,096 bytes**, including responses without Content-Length; declared oversized responses are rejected before reading. Success response limits and file detail/range transfers are unchanged. HTTP 401/403 retain immediate authorization revocation and fresh-pairing handling. HTTP 409 retains the existing SOURCE_CHANGED guard; its recognized server code is an additional field, not a replacement for that guard.

`pwa/download-diagnostics.mjs` sanitizes the additional fields; `pwa/settings-ui.mjs` displays them in the existing collapsed **Greining / Diagnostics** view. No new navigation, pairing method, storage or device write is introduced.

| Field | Meaning |
|---|---|
| httpStatus | Original status, e.g. 503; retained even when reading/parsing fails. |
| code | Existing HTTP_503/SOURCE_CHANGED or bounded-read/cancellation error. |
| serverErrorCode | Present only for an allowlisted code from a complete, valid error object. |
| errorBodyStatus | recognized, unknown, empty, invalid_utf8, invalid_json, invalid_schema, unreadable, too_large, interrupted or stale. |
| phase / declaredBytes / receivedBytes | Phase, declared length and bytes actually read by this app. |

Allowlisted server codes: `COURIER_BUSY`, `SOURCE_ID_UNAVAILABLE`, `INVALID_QUERY`, `CURSOR_STALE`, `INVALID_CURSOR`, `INVALID_REQUEST`, `NOT_FOUND`, `METHOD_NOT_ALLOWED`. Error objects require a string `error`, reject duplicate error keys, and reject an `ok` value other than false when present. Other body fields are discarded. No arbitrary body strings, exception messages, credentials, URLs or pairing tokens are added to diagnostics. Malformed/unknown data never becomes a recognized code; a partial body never becomes success. Failed readers are canceled and request/listener/timer cleanup remains. Late obsolete list-error responses cannot replace the current connection diagnostic.

Example recognized result: `httpStatus=503`, `code=HTTP_503`, `serverErrorCode=COURIER_BUSY`, `errorBodyStatus=recognized`. **COURIER_BUSY still groups several firmware branches** (SD/recovery/mutex/snapshot allocation/list allocation/encoding); it is not proof of one specific cause. SOURCE_ID_UNAVAILABLE distinguishes the separate identity path. An unreadable or unknown body retains HTTP 503 without inventing a server code.

## Validation actually completed

Final focused run: **67 passed, 0 failed**. Command:

```powershell
node scripts/check-flight-list-diagnostic.mjs
```

The 22 new source tests cover recognized 503 codes, unknown/empty/malformed/invalid-UTF8/schema/duplicate-key bodies, length bounds/truncation, interrupted reads, explicit cancellation, delayed obsolete fetch/body responses, sanitization, retained 409 protection and authorization renewal with a fresh in-memory source. The browser Settings test confirms that the recognized flight error is displayed without secret fields, the following Settings diagnostic remains valid, and the connection remains intact.

The same run covers automatic QR connection/duplicate scan/cancel/retry, running-app reconnection, full Settings boundary validation, exact-byte COMPLETE/INCOMPLETE download/resume/export, temporary IndexedDB storage and worker replacement/offline recovery, approved icons and flight evidence classification. These are host/browser fixtures, **not physical phone verification of this candidate**. No owner browser data was accessed or cleared.

The old host-model fixture was stale after firmware revision changes. Its original files were preserved at `build/flight-list-error-review/retained-previous-host-fixture`; the host-only model was refreshed from read-only current Rev. 2.7 source using `node protocol/prepare-host.mjs --active`. This was host GCC/model preparation, not an ESP-IDF firmware build. Two added browser-fixture issues (fetch injection after the source had captured its fetch closure, and an assertion counting the newly added request) were corrected before the final pass; failed-run logs are retained alongside the final log. No production guard was weakened.

The historical **FIRMWARE_HEAD** failure remains failed: expected `2b7323b749e517fabab6134f4d4493ec22bc0b3b`, actual `74f45528a8aece434d9af1b757b18bc8caa8fe45`. Its guard/reference was not changed or counted as a passing test.

## Frozen deployment artifact

- Directory: **C:/HuginnAPP/build/flight-list-error-review/candidate-acc6cd5e4cb6e49d**.
- Exactly **32 files**, all byte lengths and SHA256 hashes pinned in `build/flight-list-error-review/candidate-review.json`.
- SHA256(build.json): **630947d45208805870fdd07c1d5e40acfc9818c1d86fe3218f5f785cdb6f09aa**.
- Source changes: `source.mjs`, `download-diagnostics.mjs`, `settings-ui.mjs`. Shell/worker files differ only in generated build stamps; build.json records the new identity/hashes. All other assets, including accepted icons, manifest/install identity, flight storage, adapter, QR scanner, styling and fixture FLGs, are byte-identical to the retained public build. Worker behavior is unchanged.
- NO-ACK remains false for confirmation; no source deletion, transfer marking or automatic Settings save is introduced. Existing drafts, one-device pairing guards and protected-time restrictions are unchanged.
- Retained Rev. 2.7 artifact SHA256 remains **3e19713449125cf1ec927159e0c280722fc0392733d18cd1b095392fe09be3c4**.

Offline recheck of the frozen inventory, test-log hash, rollback hashes and firmware artifact:

```powershell
Set-Location C:/HuginnAPP
node scripts/prepare-flight-list-diagnostic.mjs --verify
```

Do not rebuild before deploying this reviewed candidate. Another source change requires a new candidate/review.

## Destination and rollback

Account `afc733ae88054c22d7214b083132bfbc`; existing Pages project `huginnapp-pwa-test`; production branch `main`; canonical origin **https://huginnapp-pwa-test.pages.dev**.

Normal-TLS GETs during preparation confirmed canonical build `271f2c06c31e3889` and identical build.json at the recorded immutable URL **https://5d7cc058.huginnapp-pwa-test.pages.dev**. Retain recorded deployment **5d7cc058-f4cc-4c2a-ab1a-d64e6b12f8df** and all previous rollback evidence. A new authenticated Pages API deployment-identity query was not performed; this is a public-build/immutable-manifest check, not a fresh API identity attestation.

Hash-verified 32-file rollback copy, including matching `_headers` control input: `C:/HuginnAPP/build/flight-list-error-review/rollback-271f2c06c31e3889`. The earlier frozen candidate/publication evidence also remains intact. No Cloudflare deployment was changed or deleted, and no authentication was changed. The existing cached Wrangler entry point is present; upload authentication will need to succeed at the separately authorized deployment step.

Exact intended deployment command — **prepared only, not executed**:

```powershell
Set-Location C:/HuginnAPP
$env:CLOUDFLARE_ACCOUNT_ID = 'afc733ae88054c22d7214b083132bfbc'
$env:WRANGLER_SEND_METRICS = 'false'
node C:/Users/egill/AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/wrangler/bin/wrangler.js pages deploy C:/HuginnAPP/build/flight-list-error-review/candidate-acc6cd5e4cb6e49d --project-name huginnapp-pwa-test --branch main --commit-dirty=true
```

## After a separately authorized deployment

1. While online, use the existing installed PWA's normal idle update at the same canonical origin. Confirm app, active worker and controlling worker identify `acc6cd5e4cb6e49d`. Do not clear website data or reinstall. Keep cached offline launch and stored files intact.
2. Keep the existing Rev. 2.7 firmware. Before the phone action, start the existing non-resetting capture if correlating device evidence; wait for ARMED and do not reset or open a competing reader. No new firmware installation is required for this app diagnostic.
3. Use the established connection, then **Stillingar / Settings > Greining / Diagnostics > Athuga tengingu (aðeins lestur) / Check connection (read only)** once. It performs flight-list and Settings GETs, without saving settings.
4. Share only the sanitized result: operation, code, httpStatus, serverErrorCode when present, errorBodyStatus, phase, declaredBytes and receivedBytes. Keep a successful Settings result distinct from a denied flight list. A recognized COURIER_BUSY still requires evidence to select its underlying branch; do not infer the cause from status alone.

This task performed no deployment, firmware change/build/flash/reset, COM access or Settings write.
