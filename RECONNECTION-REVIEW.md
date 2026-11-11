# Running-PWA reconnection review — 2026-11-04

**Deployed with Egill's authorization on 2026-11-05: `1902bcca0f2edc78`. Physical iPhone recovery remains unverified.**

Production deployment **c1f0e7c2-f13f-49f5-837c-e5145bf5a625** now serves `https://huginnapp-pwa-test.pages.dev`; immutable URL `https://c1f0e7c2.huginnapp-pwa-test.pages.dev`. The exact frozen 32-file inventory and focused-test receipt were rechecked before upload and after deployment. No rebuild occurred. Authenticated GETs confirmed project/account/production identity; canonical and immutable build.json match. All 30 public assets match their reviewed hashes, including reconnect/Settings modules, service worker, manifest and accepted icons; JavaScript MIME and effective CSP were checked. `_headers` is a control input, not a public asset.

Retain rollback deployment **c1fc89a1-f365-49a8-ae7b-97b3c0b3c89d**, build **eb5241dc6e9995ba**, immutable URL `https://c1fc89a1.huginnapp-pwa-test.pages.dev`. Its public assets and matching `_headers` input were preserved locally at `build/reconnect-review/publication/rollback-c1fc89a1-f365-49a8-ae7b-97b3c0b3c89d`; its deployment and immutable build remained present after upload. No deployment was deleted. Evidence: `build/reconnect-review/publication/before.json`, `after.json` and `deployment-receipt.json`.

The existing Wrangler 4.149.0 OAuth login succeeded for account `afc733ae88054c22d7214b083132bfbc`; no credential values were printed/saved, no login renewal or permission change was needed. The historical **FIRMWARE_HEAD failure remains failed**, unchanged as detailed below. Settings HTTP 409 admission remains unresolved. No firmware/build/flash/reset/COM operation occurred and no owner browser storage was accessed. The original preparation record below is retained as historical evidence; references below to pending deployment describe that earlier preparation stage.

## Demonstrated app defect

The existing manual connection action always executed `connect()`. That action consumed and cleared the pairing field on first connection. On a later click with no new pairing data it closed the still-authorized source and parsed the now-empty field, yielding **PAIR_JSON**. The frozen deployed artifact `eb5241dc6e9995ba` reproduces this in a disposable real-browser test: transport failure, restored transport, manual connection click, then failure with PAIR_JSON rather than a renewed authenticated list. Receipt: `build/reconnect-review/baseline-browser.log`.

That is a demonstrated app recovery defect, not proof that every physical iPhone failure took this exact path. Other source-confirmed weaknesses were missing connection epochs around async list results, a generic initial-connect label during recovery, and no explicit abort-race settlement for fetch/body operations that do not promptly settle on cancellation. These now have focused lifecycle coverage. No TLS, firmware or iPhone-specific cause was inferred from a screenshot.

## Focused implementation

- `pwa/entry.mjs`: the visible recovery control says **Tengjast aftur / Reconnect**. Empty manual connection input reuses the current in-memory source only while it still has authorization, then checks it with an authenticated flight-list GET. New pairing data explicitly replaces/closes the old source. An observed 401/403 discards authorization and opens fresh QR pairing in the same page. Initial network failure retains the in-memory pairing source for retry. Secrets are never persisted.
- Connection/action epochs reject obsolete list responses, catches and finally handlers. Recovery/foreground transitions pause old source requests, abort old transfers, invalidate settings approvals and release stale UI busy state. Only one current source is retained; reconnect does not replay any settings POST. Existing page/visibility listeners are reused, not re-added on each reconnect. Camera cleanup still runs on hide/navigation.
- `pwa/source.mjs`: pause/close invalidate the request generation. Fetch and reader awaits race cancellation, so an obsolete request cannot hold recovery open indefinitely even if it ignores AbortSignal. The reader is canceled without awaiting an indefinitely pending cancellation. Timers, external abort listeners and temporary race listeners are removed. Late old 401s cannot revoke the current generation's token. Existing TLS/authentication rules, timeouts, body bounds, decoding/schema validation and genuine identity guards remain.
- `pwa/settings-ui.mjs`: a complete **409 SETTINGS_BUSY_OR_UNAVAILABLE remains a settings-only denial**. It does not close the source or mark authenticated flight listing unavailable. Fetch rejection or actual authorization loss has separate recovery handling. The hint records that the Settings admission reason is unknown rather than naming a UI guard as its cause.
- Safe existing drafts remain only in memory on same-device reconnection. Session/preview approval is closed. Fresh device retrieval is mandatory; a retained draft is restored only when device identity, endpoint, protocol and all confirmed baseline values still match, and the existing validator accepts editing it. Changed device values do not get overwritten with an old draft. Apply remains disabled until a new explicit preview. Fresh pairing/device replacement discards the old draft. No save retry is automatic, including after uncertain save outcomes.
- `pwa/index.html` adds a status line for retained remote lists: **Áður sóttur skráalisti / Previously retrieved file list**. Remote download buttons are disabled while disconnected/reconnecting. Downloaded-files UI and local export remain independent of device connection. File classifications, resumable storage, NO-ACK and protected-time restrictions remain unchanged.

No firmware source, SDK, COM port, Muninn, owner browser storage or recordings were modified/accessed. The host Settings model was regenerated into disposable APP build files from read-only current firmware sources; this was not a target build. Existing unrelated local changes were retained. Task-start copies of the four app files are in `build/reconnect-review/before/`.

## Rev. 2.4 physical evidence, kept separate

Read all **2,549 bytes** of `C:/HuginnEIS/Evidence/REV2.4-COM5/console-20261104T210831Z/console.raw`. SHA256 matches **1753055d441c5aa5beda4dc44a617fc2edb8eade0d4f36c7c6dff2f299790b60**; contiguous JSONL chunks reconstruct the raw bytes exactly. No capture was started or serial port opened.

Device timestamps show station join at 1,979,627 ms, DHCP at 1,980,831; leave at 1,996,469 with reason 8; rejoin at 1,996,556 and DHCP at 1,996,693. HTTPS session-handshake messages appear at 2,004,070 and 2,054,663. At 2,027,861 the capture records `mbedtls_ssl_fetch_input error=80` and TLS **read** `-0x0050`. MAIN_CLOCK continues. The initial partial esp_image fragment is not evidence of a reset during this capture.

These establish saved network/TLS activity, not its trigger or which HTTP request encountered it. There is no HTTP/request-ID log identifying the Settings admission guard. The owner-correlated phone result is a complete **HTTP 409 / SETTINGS_BUSY_OR_UNAVAILABLE / declared 51 / received 51**, alongside successful flight listing **200 / 4234 / 4234**. It did not exercise the full 29,502-byte Settings body. No HS2_SEND/HS2_ALLOC records occur; empty arrays do not prove the cleanup succeeded/failed or instrumentation is broken. Admission reason remains unknown and is not part of this app correction.

## Tests actually run

**49 focused tests pass** on the final candidate. `build/reconnect-review/focused-tests.log` covers:

- Running browser recovery with consumed pairing input, visible Reconnect, repeated recovery, stale-list labels/disabled downloads and English feedback.
- Complete Settings 409 while flight endpoint remains authenticated, Settings read diagnostics and size/stream/UTF-8/JSON/schema boundaries.
- Draft retention across reconnect, mandatory fresh GET/new preview and no automatic apply.
- Delayed old response/401 ignored after foreground recovery, expired/revoked authorization, fresh QR scanner callback and confirmation with a different synthetic token, scope cleanup even for non-settling fetch/body cancellation.
- QR decoding, camera cleanup, deployment CSP and unchanged accepted icons. The QR camera/decoder and endpoints in lifecycle tests are fixtures, not an iPhone or physical HuginnEIS.

A separate preservation run has **25 passed, 1 failed** across navigation during large COMPLETE/INCOMPLETE fixture transfers, offline local export, flight evidence, IndexedDB integrity/pressure and worker update/recovery. The failed historical test is `tests/pwa-transfer.test.mjs`, **FIRMWARE_HEAD**: expected **2b7323b749e517fabab6134f4d4493ec22bc0b3b**, actual **74f45528a8aece434d9af1b757b18bc8caa8fe45**. It stopped before the retained-firmware vertical slice. Its guard/reference was not changed and that test is not claimed passed. Receipt: `build/reconnect-review/preservation-tests.log`.

The existing camera static assertion was updated to check scanner.stop within hideSession rather than require it as the first statement; running-browser cancellation and scanner lifecycle tests retain the behavior check. Firmware identity guards were untouched. `git diff --check` passes (existing Windows line-ending advisories only).

## Frozen deployment artifact

Directory: **C:/HuginnAPP/build/reconnect-review/candidate-1902bcca0f2edc78**.

Exactly **32 files**, matching build.json and independently hashed in `build/reconnect-review/candidate-review.json`.

SHA256(build.json): **ba98cdc51b167f2c698582f1b5b5eaadc523c9a766236dd66d56ebd38016d073**.

Seventeen preservation inputs are byte-identical to frozen eb5241dc6e9995ba: adapter, storage/evidence/settings protocol modules, manifest/app identity, approved icon files and all fixture FLGs/catalogue. The service worker changes only through normal build identity substitution; storage schema/update/recovery behavior is retained. No user data is included in the artifact.

Last confirmed deployed build remains **eb5241dc6e9995ba** at **https://huginnapp-pwa-test.pages.dev**. No live network/deployment identity query was performed in this task. Existing rollback artifacts/evidence remain untouched. The new candidate requires separate owner deployment authorization.

Offline recheck, without rebuilding:

```powershell
Set-Location C:/HuginnAPP
node scripts/verify-reconnection-candidate.mjs
```

## Short physical acceptance after a separately authorized deployment

1. While online, use the installed PWA's normal idle update flow. Confirm running app and active/controlling worker identify **1902bcca0f2edc78**. Keep existing flights; do not clear data or reinstall.
2. Join HuginnEIS Wi-Fi, pair through **Connectivity > Flight Courier**, and retrieve the flight list. Do not save settings or start a recording.
3. Briefly interrupt the phone's Wi-Fi connection, restore its HuginnEIS Wi-Fi connection, then use **Tengjast aftur / Reconnect** in the same running PWA. Confirm a fresh list replaces the previously retrieved label and remote download buttons become available. Repeat once without closing the app.
4. If the device rejects the retained authorization, use the offered fresh QR pairing and confirm connection within the same app. Do not deliberately revoke pairing or reset the board for this test.
5. Run **Settings > Diagnostics > Check connection (read only)**. Share sanitized results and whether recovery required fresh QR. A complete Settings 409 with a successful flight list remains a separate admission issue. Existing local-file access/export should remain available during disconnection.

Host results support the implementation; they do not establish physical iPhone recovery or successful real Settings retrieval. No deployment, firmware build/flash/reset or COM access occurred.
