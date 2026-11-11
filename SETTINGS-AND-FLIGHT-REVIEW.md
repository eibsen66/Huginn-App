# HuginnAPP settings and flight review - 2026-11-02

## Resumed diagnostic deployment preparation — 2026-11-03

### Owner-authorized Rev. 2.3 diagnostic preparation — 2026-11-04

Scoped Settings-send instrumentation and Rev. 2.3 metadata are applied in HuginnEIS source with isolated local 5.5.2 esp-tls/esp_https_server components. Shared SDK, old binaries/evidence and unrelated source hashes are preserved. No transport correction or PWA change was made. See SETTINGS-SEND-INVESTIGATION.md and C:/HuginnEIS/REV2.3-OWNER-HANDOFF.md for byte-counter semantics, passed host/compiler checks, strict fresh-build/verify/app-only COM5 scripts, supported preserved retry and the after-boot non-resetting capture plan. Actual target compilation/flash/physical measurement remain pending; COM10/Muninn untouched.

### Subsequent navigation/body review — local candidate eb5241dc6e9995ba

### Subsequent measured short-send investigation

Owner now measured Settings Content-Length 29502 versus 20480 delivered (9022 missing); flight list 4234/4234 valid. [SETTINGS-SEND-INVESTIGATION.md](SETTINGS-SEND-INVESTIGATION.md) traces the exact firmware/IDF send chain. Actual extracted SDK functions reproduce that endpoint under either injected repeated WANT_WRITE or an injected fatal write failure; neither is asserted as the physical cause. Normal host sends complete. Separate minimal firmware and SDK **diagnostic-only, unapplied** patches record serialized size, send result, elapsed time and raw nonpositive TLS result. Both applicability checks pass; proposed handler passes 17 sanitizer cleanup cases. The single next discriminating check is that correlated target send trace after separately authorized instrumentation/owner build. No app/UI/limits/validation change, deployment, target build, device/COM10 operation or firmware/SDK write occurred.

**Subsequently deployed with explicit owner authorization:** production c1fc89a1-f365-49a8-ae7b-97b3c0b3c89d serves exact eb5241dc6e9995ba at the canonical Pages origin. Exact inventory matched, no rebuild; public verification at 19:22:29Z passed all 30 assets, three tabs/diagnostics/worker/manifest/icons. Immediate rollback 34652dba-8307-4daf-82bc-a025545e3235 and earlier references retained. Historical FIRMWARE_HEAD mismatch remains a failed test, not a pass. No physical phone/device operation occurred and the body-stream problem is not claimed fixed. Diagnostic fields and update steps are in NAVIGATION-AND-SETTINGS-BODY-REVIEW.md. Pending publication text below is historical.

See [NAVIGATION-AND-SETTINGS-BODY-REVIEW.md](NAVIGATION-AND-SETTINGS-BODY-REVIEW.md). Three actual mutually exclusive tabs, retained connection/drafts/transfers, revised bilingual help, compact rows and phone screenshots are prepared. Candidate is frozen at build/navigation-review/candidate-eb5241dc6e9995ba (32 files), not deployed. Final focused host/browser suite passed 91/91; one extra historical firmware-reference transfer test failed its existing source HEAD guard and was not weakened. Full-body/limit/truncation tests preserve byte limits and validation.

Owner physical evidence: flight list HTTP 200/valid/4234 bytes; Settings HTTP 200/RESPONSE_READ_FAILED/body/20480 bytes; connection usable after device-screen closure. 20480 is a delivered prefix, not the app's 131072 response ceiling. Diagnostics now retain declared Content-Length separately. The real stream failure remains unresolved; no proven app defect or physical retrieval fix is claimed. Firmware/SDK inspection is read-only; 4096-byte configured outgoing TLS fragments are a lead only. No firmware/Muninn modification, device/COM10 access, deployment, reset, build/flash, commit or push occurred. All statuses below retain their historical context.

**Subsequently published with Egill's explicit authorization:** exact build `2f894e47c73920ab`, production deployment `34652dba-8307-4daf-82bc-a025545e3235`. Existing Wrangler OAuth worked and authenticated API checks succeeded, resolving the access blocker without interactive login or account/permission changes. All 32 frozen files rechecked; no rebuild. Canonical/immutable build manifests and all 30 public asset hashes verified. Previous deployments retained. Public receipt: build/settings-read-diagnostics-review/published-20261103/deployed-verification.json. Physical phone activation and GET-only diagnostic remain pending; no device/COM/settings operation occurred. Preparation status below is historical.

Candidate `2f894e47c73920ab` remains unchanged and undeployed: all 32 files/hashes reverified, exact test distribution matched, retained 109/109 results checked, and eight diagnostic/redaction tests passed again. No rebuild. [Current deployment handoff](DIAGNOSTIC-DEPLOYMENT-REVIEW.md) records the live public build `99272816b3082d1a`, rollback, exact intended command and read-only phone steps. Cloudflare authenticated GET failed HTTP 401/code 10000 (Authentication error); public canonical/immutable manifest and all 30 public assets matched. No authentication changes or upload occurred. Current API deployment identity cannot be freshly asserted.

Owner reports COM5 and COM10 have Rev. 2.2 installed and COM10 MAIN/yellow REC WAIT are normal; flight validation awaits weather. Further REC investigation is paused and COM10 untouched. The physical settings failure remains unresolved. Leaving Flight Courier/Connectivity does not stop HTTPS or revoke pairing according to source; actual healthy service on the failed physical attempt is not established. Next step after separate deployment authorization is the GET-only diagnostic on the COM5-associated board, with no settings save/device write test. Older unbuilt/uninstalled status statements below are historical.

## Fetch/response diagnostics and owner wording — next local review candidate

The next candidate continues from prepared `c0f222305a4d2c25` and implements the exact owner-requested Icelandic retrieval failure: **“Ekki tókst að sækja gögn”**. The diagnostic is displayed separately under **Greining / Diagnostics**. A failed GET has no save-related message. The previous candidate was not deployed; preparing it could not change the installed PWA's older message. This task also performs no deployment.

### FETCH_OR_TYPE_ERROR: established scope, unresolved physical cause

`transferDiagnostic` historically maps any JavaScript `TypeError` to FETCH_OR_TYPE_ERROR. In the c0 transport's single try/catch this can mean rejected Fetch, a failed response stream, invalid UTF-8 decoding, or a JavaScript response-processing error. A host differential test against the preserved c0 artifact demonstrates that both rejected Fetch and invalid UTF-8 produce the same old code. It does **not** establish which happened on the phone. No raw physical response/status was supplied, and no device connection or new capture was performed here. TLS, CORS, routing, endpoint failure and a device fault are not claimed as proven causes.

The corrected Settings transport distinguishes these without removing protections:

| Diagnostic | Meaning |
|---|---|
| FETCH_REJECTED / phase fetch / status null | The Fetch invocation rejected before exposing a response. Browser evidence alone cannot separate TLS, CORS, network or similar rejection causes. |
| RESPONSE_READ_FAILED / phase body | A response was exposed, but its stream failed. |
| INVALID_RESPONSE_ENCODING / phase decode | Received bytes are not valid UTF-8. |
| INVALID_RESPONSE_JSON / phase json | UTF-8 text is not valid JSON. |
| RESPONSE_PROCESSING_FAILED | A TypeError occurred after Fetch resolved while processing the response. |
| SETTINGS_* / phase validation / HTTP status retained | JSON arrived but failed device identity/settings schema checks. |
| HTTP_nnn or recognized device error | The response exposed an HTTP status; recognized device errors remain bounded and allowlisted. |
| JAVASCRIPT_TYPE_ERROR / phase validation | A non-transport TypeError reached the Settings UI. It is not labelled a rejected Fetch. |

Original safe error class, request phase, method, endpoint category, HTTP status, dispatched flag and received-byte count are retained. No raw exception message/stack, URL/query, Authorization header, token, pairing JSON or response body is copied to diagnostics. Unknown device error text is not displayed. Flight transfer retains its existing codes; added phase metadata supplies context without changing its transfer/storage rules. HTTP 401/403 still revokes the app's session; disconnect, cancellation, source switching and stale-response guards remain intact.

### Closing Flight Courier / Connectivity: source facts

- `huginn_flight_pairing_ui.c` Close/deletion wipes the displayed token/QR image and deletes UI objects. It does **not** call `hfa_revoke`. Pairing stores a separate SHA256 digest in the authorization component, so wiping the display buffer does not invalidate it. Explicit revoke, replacement pairing, presentation failure and reboot are different paths.
- `settings_close_modal_internal` closes the input overlay, stops UI timers, deletes/clears the modal, and executes the existing settings validation/save-if-changed logic. It does **not** stop Wi-Fi/HTTPS or revoke pairing. The only `httpd_ssl_stop` occurrence in main.c is the HTTPS startup route-registration failure path, not modal close.
- `/api/v2/settings` remains registered on the running HTTPS server independently of these screens. Clearing the modal removes that particular busy condition; LIVE authority, persistence inhibition and snapshot checks still apply.
- Therefore these closes are designed to leave HTTPS running and pairing usable. That source conclusion is **not physical confirmation** that the server remained healthy on this specific attempt. The saved Rev. 2.2 captures still lack a usable network/error sequence proving what happened. No exact firmware defect or firmware correction is established; none was modified or proposed as a blind TLS/CORS workaround.

### Working read-only diagnostic path for the next physical review

After a separately approved deployment and normal online update of the existing installed PWA (no reinstall/data clearing), open Settings/Stillingar, expand **Greining / Diagnostics**, and choose **Athuga tengingu (aðeins lestur)**. It performs `GET /api/v1/flights?limit=8` followed by `GET /api/v2/settings`, validates list identity and settings schema in a temporary session, and displays separate per-step outcomes. It sends no preview/apply/POST, changes no pending settings draft, writes no flight storage, and never auto-repairs/retries. An ordinary failed Settings retrieval also opens the redacted diagnostic automatically.

For the next physical result, retain the two displayed outcomes and exact app build ID. Status null with phase fetch means no HTTP response was exposed; an actual status distinguishes HTTP failure from transport rejection; HTTP success with decode/json/validation phase distinguishes invalid data. Keep device and phone conditions unchanged while observing this path. Do not share pairing QR/token data. This diagnostic must first reach the installed phone through a separately authorized deployment; it is not available there merely because its local artifact exists.

### Review artifact and tests

Prepared build **`2f894e47c73920ab`** at `C:/HuginnAPP/build/settings-read-diagnostics-review/candidate-2f894e47c73920ab`, exactly 32 hash-verified files. SHA256(build.json): `9dbdaeb7514cd40ef0a13d99616d18207754a4e0e6b6d27575517fff9ad5cbcd`. Receipt: `build/settings-read-diagnostics-review/prepared.json`. Prepared c0 artifact and its receipt remain retained. Adapter, flight-storage, fixture catalogue/FLGs, manifest and accepted icons are byte-identical to c0; NO-ACK and existing storage schema remain unchanged.

Eight targeted diagnostic tests pass: rejected Fetch, stream failure, invalid UTF-8, invalid JSON, response-processing TypeError, actual HTTP status, invalid schema and the c0 conflation reproduction, including credential-redaction assertions. The real-source/C-owner lifecycle still reproduces open-modal busy then successful closed-modal reads; the browser test reproduces a rejected Settings Fetch after close, asserts the exact Icelandic message and separate status-null diagnostic, then exercises the working GET-only diagnostic button. Existing English feedback, stale/disconnected/replaced-source handling, readback uncertainty, protected-time exclusion, >1 MiB exact-byte flight resume and offline/update/storage suites are included in the focused passing runs. Final full results are retained in `build/settings-read-diagnostics-review/focused-tests.log`.

Final recorded focused run: **109/109 passed**, zero failures, including all eight new diagnostics cases and the browser read-only path. Frozen artifact hashes were rechecked afterward. All runtime reproductions use host fixtures and disposable browser profiles/data. No new physical phone/device verification, firmware build/flash/reset, firmware modification, Cloudflare deployment, commit or push occurred.

## Live Settings retrieval correction — local review candidate

Owner physical evidence: the phone shows Settings/Stillingar, HuginnEIS displays Rev. 2.2, and pairing/file listing succeeds, but settings retrieval reports SOURCE_CHANGED with misleading save feedback. No new phone/device operation was performed in this correction task.

### Demonstrated cause and firmware boundary

The active GET path is `settings-load` -> `createV2SettingsSession.load()` -> the existing `createBrowserSource.settingsV2()` -> authenticated `GET /api/v2/settings`. The deployed transport converted **every HTTP 409** into SOURCE_CHANGED before reading its response body. No Settings session identity/reference check emits SOURCE_CHANGED. Thus this Settings error indicates HTTP 409; it does not demonstrate a changed source object or device.

Firmware's `hs2_owner` returns `SETTINGS_BUSY_OR_UNAVAILABLE` while `g_settings_modal` is open (also when LIVE configuration/authority/persistence/snapshot is unavailable). Connectivity creates that modal; opening Flight Courier does not clear it. File listing uses a different owner and can succeed concurrently. The actual C-owner host model plus real browser-source transport reproduces the precise sequence: pairing/file list succeeds, a settings GET with the modal open returns 409 and the deployed source reports SOURCE_CHANGED. After the simulated modal closes, repeated settings retrieval and file-list refresh succeed on the **same** source object. No object reconstruction was needed to reproduce the defect.

The owner's raw error response body was not captured, so the open-modal reason is a source-supported, reproduced explanation rather than a retrospective physical-body attestation. Other GET owner failures such as memory/authorization failure can also produce 409. The corrected app preserves a bounded allowlist of firmware error codes instead of labelling all those cases as source changes.

Existing owner sequence: open **Connectivity > Flight Courier**, pair/scan/connect, then **Close Flight Courier and close Connectivity without revoking pairing**, and retrieve Settings again. Pairing remains active when its display is closed. If the unavailable response persists, investigate its reported condition; the app does not assume that every busy/unavailable response is just an open modal. If retrieval must work while local modals remain open, firmware needs a coherent committed-settings snapshot independent of in-progress local drafts. That would be a separate firmware change; globally removing its guard is not proposed. No firmware file or protocol was changed here.

### SOURCE_CHANGED producer inventory

- `pwa/source.mjs`: the old blanket HTTP-409 mapping caused this Settings symptom. It is now retained only for non-Settings flight requests; bounded Settings responses preserve recognized device errors or HTTP status.
- `pwa/source.mjs` list pagination: response generation must match the first page; every listed entry must match that generation. These guards remain unchanged.
- `pwa/adapter.mjs` download/resume: detail identity must match the selected/resumed source/session/file/byte hashes. Unchanged.
- `pwa/entry.mjs` resume: a pending selected session must still appear in the refreshed list. Unchanged.
- Other active occurrences are diagnostic allowlists/consumers. The older separate Courier UI also consumes this status; it is not the active Settings retrieval producer.

`source` is reconstructed by pairing/connect, not ordinary `source.list()` refresh. Settings still binds to one source instance and device identity. Disconnect, authorization loss, source replacement and session epochs continue to invalidate drafts/previews and stale replies. The UI now also fences obsolete asynchronous errors so they cannot reset or overwrite the new connection's Settings display.

### Focused app changes

- `pwa/index.html` / `pwa/entry.mjs`: persistent connection-entry guidance, before pairing and on reconnect, in the existing document-language mechanism: **Connectivity > Flight Courier**, existing pairing instructions, then close those device screens before retrieving settings. No new connection method.
- `pwa/source.mjs` / `download-diagnostics.mjs`: Settings error bodies are still bounded by existing response limits and UTF-8/JSON rules; only recognized error identifiers are surfaced. Unknown body text is not copied to diagnostics. Flight source-change detection, TLS, bearer/origin/redirect policy and NO-ACK remain.
- `pwa/settings-ui.mjs`: distinct retrieval, edit, preview, save and readback feedback. Failed GET says **settings could not be retrieved; no save was attempted**, never an unconfirmed save. Busy/unavailable feedback explains the existing device-screen closure. Preview/apply remain disabled after failed GET, on disconnect/replacement, or before valid current settings arrive.
- `settings.mjs` / `settings-v2.mjs`: expose operation stage for accurate acknowledged-save/readback uncertainty while retaining existing unconfirmed failure state, validation, protected-time exclusion and fresh readback requirements.

### Tests and artifact

**101/101** focused tests passed: real-source/C-owner connection lifecycle, existing settings/protected fields, actual PWA browser, transfer/trust, CSP/icons/version diagnostics, strict storage integrity/pressure and worker update/recovery. After the final retrieval wording change, **26/26** lifecycle/browser/CSP/version tests passed again. The browser run also verifies English retrieval feedback and that a delayed obsolete real-source response cannot overwrite a newly connected session. All browser profiles/databases/files were disposable fixtures; no owner storage or real recording was touched.

Covered: original deployed transport reproduces SOURCE_CHANGED for the actual C-owner busy response; pairing/list then successful GET; repeated GET; concurrent/intervening list refresh; disconnect and a new source object; different paired/returned device identities; delayed obsolete response; retrieval/preview/save/readback errors; no POST on failed retrieval; disabled controls; byte-exact COMPLETE/INCOMPLETE download/resume and >1 MiB files. Initial test harness import/expectation issues were corrected before the passing runs. These are host reproductions, not physical phone acceptance.

Prepared **build `c0f222305a4d2c25`**, 32 files, at `C:/HuginnAPP/build/settings-retrieval-review/candidate-c0f222305a4d2c25`. Receipt: `build/settings-retrieval-review/prepared.json`. SHA256(build.json): `bd85c334cb997cea05062aca759ba119b861bcfb09c954c88ac9e851579ef557`. All frozen hashes were checked. Adapter, flight-storage, fixture catalogue/FLGs, manifest and all accepted icons are byte-identical to reviewed/deployed build `99272816b3082d1a`; the existing IndexedDB name/version and stable origin remain. No reinstall, browser-data clearing, firmware build/flash/reset, deployment, commit or push occurred. This candidate is **not deployed**; earlier public-deployment evidence below/in PAGES-DEPLOYMENT-REVIEW.md remains historical evidence for build 99272816b3082d1a.

Physical review after a separately authorized deployment: update the existing installed PWA normally while online, retain its data, verify running app/worker build IDs, pair through Connectivity > Flight Courier, close both device screens without revocation, and retrieve real settings. Verify busy feedback and repeat retrieval without re-pairing. Save/write tests remain separate owner acceptance actions; none was performed here.

## Owner Rev. 2.2 compilation correction

The complete owner `idf_py_stderr_output_39656` and `idf_py_stdout_output_39656` logs were inspected. Stderr contains the command header; stdout contains exactly three compiler errors, all `-Werror=misleading-indentation`, at original include lines 189 (`hs2_utf8`), 196 (`hs2_assign`) and 313 (`huginn_settings_v2_handler`). The five unused-function warnings and one unused-variable warning were left alone. Ninja stopped at main.c compilation; this was an actual owner firmware-build failure.

The entire `C:/HuginnEIS/Huginn/Firmware/huginn/main/huginn_settings_v2.inc` was expanded into consistently formatted statements and braced control blocks. UTF-8 continuation scanning remains after its length guard; string declarations remain after the type guard; JSON parsing remains conditional on `hs2_request_bytes`, while `free(body)` remains **unconditional after that block**. Receive/digest errors still free the body before releasing the job. Allocation/refcount/queue/timeout/revocation cleanup remains unchanged. All non-brace C tokens were compared unchanged; no validation, expressions, string literals, firmware compiler flags or revision metadata changed. The local `protocol/firmware/huginn_settings_v2.inc` host copy was synchronized; the original firmware patch remains historical.

Checks actually run after the correction:

- Host model compilation and HTTP-boundary syntax passed with `-Wall -Wextra -Werror -Werror=misleading-indentation`. The host harness's previous `-Wno-misleading-indentation` was removed; no firmware warning suppression was added.
- The retained actual Xtensa main.c command passed in **syntax-only mode**, retaining its warning flags and explicitly requiring misleading indentation as an error. Only object/dependency-output switches were removed for this focused check. No IDF/ninja, object output, link or firmware artifact was produced. Evidence: `build/settings-indentation-fix/target-syntax-result.json` and stdout/stderr files.
- 27 protocol/protection tests plus the isolated PWA settings/flight browser test passed (28/28).
- The actual HTTP handler passed 16 host success/error scenarios under ASan/UBSan: balanced body/job allocations, skipped parsing, malformed JSON, receive/digest/allocation failures, lock/queue failure, timeout with eventual cancelled-owner cleanup, revocation and GET/POST success. Simulated protected/fuel/fault/recording sentinels remained unchanged. These are not device HTTP/NVS tests.
- All 1,958 existing build/source files in the preservation inventory remained byte-identical, including the failed build directory, logs, config and original build-start receipt. `main.c` and both CMake files were unchanged. Evidence/source hashes: `build/settings-indentation-fix/final.json`; original include: `before.inc`. Revision stays HuginnEIS Rev. 2.2. Git whitespace checking passed.

Owner compilation retry, in the existing ESP-IDF 5.5.2 PowerShell, retaining the same build directory and cached normal-product options/AppOrigin:

```powershell
Set-Location C:/HuginnEIS/Huginn/Firmware/huginn
idf.py -B C:/HuginnEIS/Huginn/Firmware/huginn/build-rev2.2-20261102 "-DSDKCONFIG=C:/HuginnEIS/Huginn/Firmware/huginn/build-rev2.2-20261102/sdkconfig" build
```

This retries compilation only. Do not use the original fresh-directory BUILD wrapper: it intentionally refuses an existing directory. The preserved source-pin receipt predates this correction; a new retry attestation is required before the source-pinned VERIFY/FLASH workflow can accept a corrected artifact. No receipt was silently rebased or marked successful. No firmware build, flash, reset, deployment, commit or push was run during this correction task.

## Delivery status

The active PWA interface is implemented locally. Following Egill's direct chat authorization, **the exact five-file `protocol/settings-v2-firmware.patch` was applied to C:/HuginnEIS on 2026-11-02**. The current-source check passed without context changes, and all five applied files match the prepared versions byte for byte. Earlier automatic approval rejections are resolved; the authorized application succeeded without a further rejection.

Pre-application source copies and a full tracked/nonignored-untracked hash inventory are in `build/settings-applied-review/before/` and `before.json`; `after.json` records the applied hashes and preservation results. All 2,078 unrelated existing tracked/untracked files, HEAD, branch and Git index were unchanged. Revision metadata, existing REC-hour work, CAN acquisition, CHT default thresholds/algorithms, local protected-time interface and MAIN layout were retained. No device was accessed or reset.

No ESP-IDF build, flash, revision change, Cloudflare deployment, commit, push, Muninn source change, real recording change or owner database write occurred. Existing local work was retained. Installed firmware and the deployed PWA are unchanged. The next installation needs the owner's next revision designation before building; no new revision was assigned here.

## Active app

The active entry points remain `pwa/index.html` and `pwa/entry.mjs`; root `index.html`/`app.js` is the older separate interface. No disconnected settings interface was created there. Final local app build: `99272816b3082d1a`.

`pwa/settings-ui.mjs` renders Display, Units, Aircraft, Engine, AUX and Fuel sections in the accepted simple style, using values/options/constraints returned by firmware. Engine name supports the actual 16-entry catalogue and Other Engine text. Parameter details are expandable. No manufacturer limits or calibration coefficients are invented. Old firmware's HTTP 404 explains that complete settings support needs a firmware update, without presenting defaults as device values.

`pwa/settings-v2.mjs` binds retrieved settings, drafts, preview and readback to one source ID and config revision. Only permitted edited fields are sent. Editing/hiding invalidates preview. Disconnect/authorization loss clears the context; a new device starts without cached edits. Apply is an explicit separate action after device preview. Exact request digest, device, base revision, returned changes, `applied:true`, returned saved settings and a separate fresh matching GET are checked before reporting saved. Failure/mismatch/timeout remains failed or uncertain; apply is not retried. New custom topologies require explicit boundary entry, not invented defaults. Unset fuel-flow references are represented as null and displayed blank, not as a confirmed zero.

`pwa/source.mjs` uses the existing RAM-only bearer, exact origin binding, redirect rejection and browser certificate validation. No TLS, authentication or CSP bypass was added. New modules are included in the normal build and offline worker. Settings/Stillingar and section headings follow the document language; firmware field labels/options retain their supplied meaning. Logo, native target, offline evidence storage and NO-ACK behavior remain.

## Complete field inventory

Authority: `C:/HuginnEIS/Huginn/Firmware/huginn/main/main.c`, `main/huginn_ports.h/.c`, `main/huginn_aux.h/.c`, and the V1 settings component.

The source-derived default-profile host snapshot contains **121 fields**: Display 2, Units 6, Aircraft 1, Engine 87, AUX 18, Fuel 7. Boundary counts vary with actual profile/topology. Every field ID, label, value, type, option, range and scale is listed in `build/settings-review/source-derived-field-inventory.json`. It is explicitly a synthetic source-derived snapshot, not a device capture.

| Section | Fields and validation derived from the local interface |
|---|---|
| Display | Brightness integer 20..100%, auto brightness boolean |
| Units | Altitude ft/m, barometer hPa/inHg, fuel L/US gal, pressure psi/bar, speed km/h/kt, temperature C/F |
| Aircraft | Nonempty UTF-8 Registration within existing 16-byte storage including terminator |
| Engine identity | Engine/motor name within 32-byte storage, actual catalogue or Other Engine, cylinders 4/6, turbo. Same catalogue/profile computation as the local interface |
| Existing CHT setting | Existing permitted maximum-spread setting 5..60 C difference. No default, comparison, fault policy or threshold algorithm was changed |
| Engine parameters | All 15 actual IDs: volts, oil temperature, manifold air temperature, fuel pressure, fuel flow, throttle, oil pressure, EGT, CHT, outside air temperature, ECU ambient temperature, UCT, fuel temperature, heater temperature, RPM. Applicability, display min/max, fuel-flow cruise reference, supported USER/CUSTOM topologies and shared editable boundaries. Existing canonical milli-units, shape, RPM, contiguity and reference validators. Disable before changing topology; no invented limits for Other Engine |
| AUX optional sensor assignments | Current local V6 source/label/slot-priority editor, using CHT5/CHT6/EGT5/EGT6. Optional UCT/fuel/heater applicability and supported display limits are in parameter details. Legacy PORTS records are preserved and validated, not exposed as new writable controls absent from the current local interface |
| AUX V6 | Enabled count 0..4, unique slot sources, 1..10 printable ASCII-byte labels. Sequence is priority; inactive slots are canonically empty. As locally, the slot editor is available for four-cylinder configuration; existing six-cylinder automatic hiding and preserved configuration remain intact |
| Calibration | No editable AUX calibration coefficients exist in the inspected interface/model. None were invented. Supported sensor display ranges and operating limits are included above |
| Fuel | Total capacity 1..250 L, usable 0..total L, planning burn 50..500 tenths L/h in steps of 5 (shown as 5..50 L/h in 0.5 steps), three exact catalogue presets and default slot. Capacity/planning/presets are separate from current quantity |
| Excluded | Engine time/hours, airframe time, current fuel quantity, faults, recordings, checkpoints, storage metadata and unknown nested fields. No bulk state import/restore/defaults/reset route |

Local HuginnEIS editors remain present in the applied source. Wi-Fi provisioning, pairing, protected maintenance and diagnostic actions retain their established interfaces.

## Applied firmware changes

Readable implementation: `protocol/firmware/huginn_settings_v2.inc`. Exact patch: `protocol/settings-v2-firmware.patch`. Proposed complete files: `build/settings-proposed/`. Original pre-task bytes/hashes: `build/settings-source-baseline/`. `protocol/prepare-source.mjs` only prepares files inside HuginnAPP; it does not write HuginnEIS. Read-only application check passed with `core.autocrlf=false`, preserving mixed line endings.

Five firmware files are affected:

- `main/main.c`: routes, legacy bearer admission/revocation epoch, shared pure catalogue helpers, focused HTTPS stack allocation. Existing local entry points delegate to the same computation; previews never swap runtime globals.
- `main/huginn_settings_v2.inc` (new): descriptors, strict detached validation and owner-thread preview/apply/readback.
- `main/CMakeLists.txt`: existing ESP-IDF `json` dependency.
- `components/huginn_settings_transfer_v1/huginn_settings_transfer_v1.cpp`: legitimate HuginnAPP provenance alongside Muninn; canonical integrity/shape/whitelist checks retained.
- `components/huginn_flight_courier/CMakeLists.txt`: one bounded exact browser origin may be configured in a normal product build without enabling synthetic scenarios. Exact-origin enforcement and empty-origin fail-closed default remain. No recorder mode, ACK policy or build default was changed.

New HTTPS endpoints: `GET /api/v2/settings`, `POST /api/v2/settings/preview`, `POST /api/v2/settings/apply`. V1 formats/endpoints remain. Settings writes, including V1, require the existing valid bearer; unauthenticated legacy writes are intentionally rejected. Read-only V1 config compatibility remains.

V2 accepts only schema, schema_version=2, product=HuginnAPP, source_device_id, base_revision and a bounded array of `{field,value}` changes. Unknown/duplicate/protected root/nested fields are rejected before persistence. Body ceiling 32 KiB; response ceiling 128 KiB. The LVGL owner reads coherent settings while no physical Settings modal is being edited.

Preview returns exact-body SHA-256, complete device-computed differences (including catalogue side effects) and proposed settings. One RAM-only admission is bound to auth epoch, config revision, digest and two-minute expiry. Apply requires identical bytes, consumes admission, rechecks authority/revision in the owner and uses the existing reversible configuration save plus persisted readback. It returns saved settings, which the app separately rereads. Failures restore the complete settings/engine/PORTS/AUX aggregate where possible; uncertain rollback inhibits further persistence. Timeouts are uncertain, never silently retried. Credentials use existing scrubbing and are not logged.

The applied patch adds no protected-time/current-fuel/fault/recorder/CAN/file mutation calls. Physical NVS retention, power-loss recovery and live time accumulation still require installation testing; host save seams do not prove those claims.

## HTTPS startup evidence and applied source correction

Saved diagnostic evidence, not a new physical test: `C:/HuginnEIS/Evidence/REC-COM5-20261102/console-20261102T135105Z/console.jsonl`, entry 11. It records a 10240-byte server stack, internal largest block 11264 before startup, **45064 / ESP_ERR_HTTPD_TASK**, and largest block 7680 after failure. The earlier 1 November log recorded successful HTTPS startup.

The inspected ESP-IDF 5.5.2 `components/esp_http_server/src/httpd_main.c` and `src/port/esp32/osal.h` map that error to WithCaps server-task creation. This establishes the task-creation branch and internal contiguous-stack shortage, not a separate TLS handshake cause.

The applied source retains the 10 KiB stack, TLS and all services, selecting `config.httpd.task_caps = MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT` through the supported SDK API. Current sdkconfig already enables external task stacks. Flash writes stay delegated to the internal-stack LVGL owner. This fix is **applied to source, unbuilt and physically unverified**. Startup, stack headroom and a real authenticated HTTPS exchange remain owner installation checks. The saved SD-only benchmark image separately denies pairing; no REC code or benchmark flags were changed to bypass that boundary.

## Validation actually performed

After applying the patch, `node protocol/prepare-host.mjs --active` compiled the owner model and syntax-checked the HTTP boundary directly from the applied `main.c` and `huginn_settings_v2.inc`, with exact-source hash pins. The combined 27 protocol + 1 active browser + 1 Muninn test run passed **29/29**. Authorization/origin/header/revocation/CORS/scrubbing checks under UBSan and all five V1 compatibility/protection cases passed again. The V1 decoder was also recompiled directly from the applied component and passed. Reverse patch checking and both repositories' `git diff --check` passed. No target firmware build was run. The additional regression results below are from the preceding app implementation pass, not a claim they were all rerun after source application.

- 87/87 existing focused settings-package, evidence, download and trust tests passed.
- 27/27 proposed C-owner/app protocol tests passed: inventory, real validators, provenance, duplicate/stale/foreign requests, bounded JSON nesting/NUL rejection, protected-field exclusion, preview identity, authorization epoch, injected persistence/readback failures, untouched fields, custom topology entry, unset-value honesty and draft/disconnect/uncertain states.
- Active PWA browser test passed against the actual proposed C owner using an explicitly simulated same-origin fixture transport: retrieval/edit/preview/apply/returned settings/separate GET readback, failure, disconnect, language and phone widths. Production CSP/TLS/auth policies were retained.
- Existing Icelandic UI, strict IndexedDB quota/persistence/concurrency, simulated loss/restoration and worker replacement/offline recovery tests passed. Worker recovery was rerun after adding the new module to its cache inventory.
- COMPLETE and INCOMPLETE **1,920,928 / 1,920,608-byte** synthetic FLGs and a torn INCOMPLETE file passed interrupted download/resume, no duplicate initial chunk, exact export and local reopen. Existing 8 MiB ceiling, real classification and original tail bytes were retained.
- Unchanged Muninn decoder/archive/readback passed COMPLETE, INCOMPLETE, torn and >1 MiB fixtures in temporary databases using WSL Python with `-B`.
- Actual firmware bearer/origin/header/CORS/revocation/scrubbing code passed a host check under UBSan. Proposed V1 C++ decoder passed five compatibility/protection cases. Proposed HTTP boundary passed host syntax checking. These are not target-link or live TLS tests.
- Module syntax checks, `git diff --check` and read-only firmware patch check passed. Host model pins exact source hashes, preventing stale-binary test claims after failed compilation.

NVS/protected-storage/fault owner seams are simulated in the C host. Sentinel bytes and untouched configuration are checked there. **No physical phone/device test was performed.** NO-ACK remains active (`FULL_ACK_GATE_PASS=false`). Local download/export is not confirmed Muninn import and never authorizes source deletion or a transferred marker.

## Screenshots and owner review

Real desktop-browser captures, each labelled **SIMULATED CONNECTION - HOST TEST ONLY**:

- `build/settings-review/aircraft.png`
- `build/settings-review/engine.png` and `engine-limits.png`
- `build/settings-review/aux.png` and `aux-limits.png`
- `build/settings-review/display.png`, `units.png`, `fuel.png`

Copyable local checks, with no ESP-IDF build or flash:

```powershell
Set-Location C:/HuginnAPP
node protocol/prepare-host.mjs --active
if ($LASTEXITCODE -ne 0) { throw 'Host compilation failed' }
node scripts/pwa-build.mjs
node --test tests/settings-v2-protocol.test.mjs tests/pwa-settings-browser.test.mjs tests/muninn-flg-compatibility.test.mjs
node protocol/check-auth.mjs
node protocol/check-v1.mjs
```

For manual local review with existing trusted localhost TLS files:

```powershell
Set-Location C:/HuginnAPP
node scripts/pwa-serve.mjs --host 127.0.0.1 --name localhost --port 8443 --cert "<existing-trusted-localhost-certificate.pem>" --key "<existing-private-key.pem>"
```

Replace placeholders with your existing trusted files, open `https://localhost:8443/`, stop with Ctrl+C. No certificate-warning bypass is an acceptance method. The automated browser test supplies the simulated source/screenshots; the manual server does not impersonate HuginnEIS. Do not rerun the historical proposal generator against already-patched source; use the active-source host command above.

Remaining owner installation/physical acceptance steps (not performed here): designate the next revision before a separately authorized target build; build/install using the existing owner workflow; verify HTTPS startup/task headroom and trusted TLS; pair through the existing single-device connection with the exact allowed app origin; check actual retrieved settings against the local UI; exercise preview/apply/fresh readback and disconnect; verify engine/airframe times, current fuel, fault history, recordings, CAN and layout remain correct; retrieve real COMPLETE/INCOMPLETE FLGs and verify exact bytes and honest NO-ACK status. Physical NVS failure/power-loss recovery and live time accumulation remain unverified. No firmware installation or deployment command is authorized/run here.
## Running-PWA reconnection preparation — 2026-11-04

See [RECONNECTION-REVIEW.md](RECONNECTION-REVIEW.md) for prepared, undeployed candidate **1902bcca0f2edc78**, its exact 32-file inventory, demonstrated consumed-pairing recovery defect, fresh-readback/preview requirements, and owner acceptance steps. Final focused checks: **49 passed**. Preservation checks: **25 passed, 1 historical FIRMWARE_HEAD failure**, retained without weakening its guard. The complete Rev. 2.4 Settings 409 denial and empty send/allocation arrays remain separate from reconnection and do not establish a memory-fix result. No firmware/device/COM operation or deployment occurred.

## Pairing simplification and corrected physical evidence — 2026-11-05

Owner confirms deployed **1902bcca0f2edc78** reconnects on the iPhone without restarting. New undeployed app candidate **271f2c06c31e3889** removes the consent checkbox/extra Connect click and automatically connects after validated QR. Focused firmware source is prepared as **Rev. 2.5**, with retained Rev. 2.4 artifacts/provenance unchanged. See [PAIRING-SIMPLIFICATION-REVIEW.md](PAIRING-SIMPLIFICATION-REVIEW.md) for 69 passed focused tests, firmware host/syntax checks, the exact review patch and the complete capture-before-phone procedure for a later authorized attempt.

Latest owner screenshot: Settings **HTTP 200, declared 29502, received 4096, RESPONSE_READ_FAILED, body**. **No capture was running and no matching send/allocation diagnostics exist.** No older capture is associated with it; allocation site/cause and physical cleanup outcome remain unproven. No firmware build/flash/reset, deployment or COM access occurred.

