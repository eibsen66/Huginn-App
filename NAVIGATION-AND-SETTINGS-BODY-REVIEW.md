# Navigation and Settings body review — 2026-11-03

## Published with Egill's explicit authorization

On 2026-11-03 exact candidate **eb5241dc6e9995ba** was uploaded without rebuilding. Production deployment **c1fc89a1-f365-49a8-ae7b-97b3c0b3c89d** serves https://huginnapp-pwa-test.pages.dev; immutable URL https://c1fc89a1.huginnapp-pwa-test.pages.dev. Pre-upload exact 32-file sizes/hashes and the retained 91-test log hash matched the reviewed inventory. Wrangler used existing OAuth and the specified account/project/main branch; no authentication/account/permission change was needed. Eight files uploaded, 23 reused; _headers processed separately. The older preparation/pending text below is historical.

GET-only verification at **2026-11-03T19:22:29Z** confirmed successful production identity, identical canonical/immutable build.json, all 30 public asset hashes and module MIME, three-tab markup, declaredBytes/receivedBytes diagnostics, service-worker module inventory, manifest and accepted icons. Candidate remained unchanged after upload. Pre/post receipts: [before.json](build/navigation-review/publication/before.json) and [after.json](build/navigation-review/publication/after.json). Immediate rollback **34652dba-8307-4daf-82bc-a025545e3235** / 2f894e47c73920ab remains successful, as do aaa7d0d7-7454-4e0b-aae8-7e1b13340f20 and 9775164c-2e37-438a-8c1b-c31b47ebeac1; their public manifests and local asset/control hashes were reverified. No rollback evidence or deployment was deleted.

The historical failed test remains failed: tests/pwa-transfer.test.mjs -> prepareRetained -> assertApprovedFirmware -> assertApprovedSnapshot asserts **FIRMWARE_HEAD** at tests/firmware-reference.mjs:51. Expected fixture HEAD **2b7323b749e517fabab6134f4d4493ec22bc0b3b** versus actual **74f45528a8aece434d9af1b757b18bc8caa8fe45** (read-only Git check reconfirmed). No guard/fixture was weakened and this test was not rerun or described as passed during deployment.

Only public deployment was verified; no installed phone or device was operated. No browser storage/recording/draft was accessed, schema migrated, firmware modified/built/flashed/reset, settings written, COM10 accessed, commit or push performed. Existing install identity and data/transfer modules remain unchanged. Update only while idle; in-memory operations should finish before normal worker activation reload.

### Owner update and GET-only diagnostic

1. Online, open the existing installed PWA at the same canonical origin, finish transfers/settings operations, and close other HuginnAPP windows. Choose **Uppfæra HuginnAPP** when offered. Do not clear data or reinstall.
2. Open top **Stillingar** tab > **Ítarlegt > Tæknilegar upplýsingar > Útgáfa og offline-geymsla**. Choose **Athuga útgáfu og geymslu**. App build, Active Service Worker and Controlling Service Worker must all read **eb5241dc6e9995ba**; confirm offline cache readiness before switching to device Wi-Fi. This inspection does not itself install an update.
3. On the COM5-associated board, open **Connectivity > Flight Courier**, use existing Wi-Fi/pairing instructions, and connect through the **HuginnEIS** tab. Close both device screens without revoking pairing. No serial/COM operation is involved; leave COM10 untouched.
4. Open top **Stillingar** tab > device **Stillingar HuginnEIS > Greining / Diagnostics > Athuga tengingu (aðeins lestur)** once. It performs flight-list and Settings GETs; do not edit, preview or apply settings.
5. Share only the diagnostic JSON and app/worker build IDs, including both operation outcomes and **code, httpStatus, declaredBytes (declared Content-Length), receivedBytes, phase, method, endpoint and dispatchAttempted**. Keep null values: null declaredBytes means no usable declared length was captured, not zero. Include whether the two device screens were closed. Do not share QR/pairing information, bearer tokens or raw response/network contents.

**The physical Settings response-stream problem remains unresolved.** HTTP success plus a body failure is not proof of complete Settings retrieval. Neither firmware, TLS nor CORS is assigned as its cause. These steps are diagnostic only; no settings save test is requested.

Prepared local candidate **eb5241dc6e9995ba**; **not deployed**. Exact directory: `C:/HuginnAPP/build/navigation-review/candidate-eb5241dc6e9995ba`. It contains 32 files, with SHA256(build.json) `8a5f6692fdeb890373165689e41e91e6e376cdfb606b02c1872237d118c86dc6`. Freeze/preservation receipt: [prepared.json](build/navigation-review/prepared.json). The last published build remains 2f894e47c73920ab; this task made no public request or deployment.

## Implemented UI

- `pwa/index.html`, `pwa/entry.mjs`, `pwa/style.css`: actual mutually exclusive HuginnEIS, **Sóttar skrár / Downloaded files**, and **Stillingar / Settings** tabs. Tab buttons stay usable during operations, support arrow/Home/End keyboard navigation, and hide existing DOM without reconnecting, resetting drafts or cancelling transfers. HuginnEIS contains connection/remote files; local downloads/export/Muninn actions remain usable offline. Settings separates device settings from app preferences. Existing technical/manual/version/storage/test controls remain in collapsed advanced sections; connection help is expandable and successful connection remains compact.
- `pwa/settings-ui.mjs`: no longer toggles device-settings visibility itself; the top-level tab controls visibility without closing the settings session. Source replacement/disconnect and protected-time/preview/apply safeguards remain.
- Manual button: **Tengja án QR-kóða / Connect without a QR code**, explaining that it uses pairing information supplied by HuginnEIS. Existing parsePairing/origin/trust/authorization checks remain; no new pairing mechanism.
- Information button: **Athuga útgáfu og geymslu / Check version and storage**, explaining it inspects version/cache information and does not install an update. `bindVersionInformation` only inspects existing registration/cache/identities; update activation remains a separate idle action.
- Persistence button: **Bæta varðveislu skráa / Improve file retention**, explaining that `navigator.storage.persist()` is a browser request, with no guaranteed permanent retention and no replacement for independent backup. Grant/deny/unavailable/error behavior remains tested.
- Existing safe-area insets/viewport-fit, logo, colors and install identity remain; file rows/actions are more compact. New labels/help use the existing document-language mechanism. No new preference or storage schema was invented.

## Physical evidence and exact body path

Owner-confirmed installed app, active and controlling workers: 2f894e47c73920ab. Flight-list GET HTTP 200, valid, 4,234 bytes. Settings GET HTTP 200, RESPONSE_READ_FAILED, phase body, 20,480 received bytes. Connection remains usable after leaving Flight Courier/Connectivity. A successful physical Settings retrieval remains **unverified**.

`createBrowserSource.settingsV2()` calls the existing bounded request reader with **131,072 bytes**, not 20,480 or the generic flight-list limit of 49,152. The 32,768 limit is for outgoing Settings request bodies, not GET responses. Declared Content-Length is checked before reading; accumulated bytes are bounded while reading, exact length is checked at EOF when declared, and only then do fatal UTF-8, JSON, schema and connection checks permit success.

`receivedBytes` counts Uint8Array bytes from successfully resolved `reader.read()` chunks. A TypeError thrown while phase=body maps to RESPONSE_READ_FAILED. The next failed read contributes no bytes; 20,480 is the delivered prefix, not total advertised size or a demonstrated ceiling. Limit violations produce RESPONSE_LENGTH; decode/JSON/schema failures have their own phases. An aborted app request maps to CANCELLED. Returning the prefix as Settings would be incorrect.

App change: diagnostics now preserve bounded numeric **declaredBytes** (and expectedBytes for JSON when available), alongside receivedBytes. They expose neither response text nor credentials. The existing byte limit and reading/validation algorithm were retained. **No app defect explaining the physical rejected stream was established, and no physical-response fix is claimed.** This candidate improves navigation and the evidence needed for the remaining diagnosis.

## Read-only firmware/SDK findings

Reviewed actual Rev. 2.2 `main/huginn_settings_v2.inc`: HS2_RESPONSE_MAX is 131,072. The owner creates a coherent full JSON document; the HTTP handler uses cJSON_PrintUnformatted, checks size, sets JSON/no-store headers and calls httpd_resp_sendstr. It retains the send result and frees the response after the synchronous call. There is no 20,480-byte truncation branch.

ESP-IDF 5.5.2 `esp_http_server/src/httpd_txrx.c` sends an explicit Content-Length for httpd_resp_sendstr, not a chunked Settings body; `httpd_send_all` handles partial positive sends and fails on negative send results. `esp_https_server/src/https_server.c` forwards through esp_tls_conn_write. `esp-tls/esp_tls_mbedtls.c` fragments writes by MBEDTLS_SSL_OUT_CONTENT_LEN and handles partial progress. The retained Rev. 2.2 sdkconfig has OUT_CONTENT_LEN=4,096 and IN_CONTENT_LEN=16,384. The observed 20,480 is five configured outgoing fragment sizes, which is a **lead, not proof** of a TLS/firmware fault. Browser-delivered chunk boundaries are not guaranteed to equal TLS record boundaries. No exact failing TLS/socket operation was supplied.

No demonstrated firmware defect warrants a blind correction or a limit increase. If another physical diagnostic still rejects the body, the precise missing dependency is target-side evidence for **this settings send**: generated byte length, httpd_resp_sendstr return, and contemporaneous HTTPS/TLS/socket error. A minimal proposed firmware diagnostic change would log those bounded values immediately around that call (no settings content, bearer or pairing secrets), using existing error reporting. No firmware patch, build, reset, serial access or capture was performed. Changing send chunk sizes/timeouts without that evidence is not proposed as a proven fix.

## Focused verification

`tests/settings-body-boundaries.test.mjs` uses a real source-derived full host response (29,479 bytes, all fields), tests full settings at 32,767/32,768/32,769 and 131,071/131,072/131,073 bytes with JSON whitespace padding, declared lengths and undeclared streams. Complete documents through 131,072 pass; above the cap fails. Smaller valid six-section schemas isolate 20,479/20,480/20,481, all passing. These smaller fixtures are not misrepresented as the full firmware response.

A stream error after exactly 20,480 reproduces RESPONSE_READ_FAILED; declared truncated EOF produces RESPONSE_LENGTH, and undeclared truncated JSON produces INVALID_RESPONSE_JSON. None yields a loaded settings session. Existing rejection/UTF-8/JSON/schema/redaction and stale-connection tests remain.

`tests/pwa-navigation-browser.test.mjs` exercises the actual built PWA in a disposable Edge profile: exclusive panels, draft retention across tabs, connection continuity, existing preview/apply/failure/protected guards, tab changes during exact-byte adapter download/resume progress, >1 MiB COMPLETE/INCOMPLETE/torn fixtures, and offline local UI/export preparation after network access is disabled. Byte-identical exports and truthful file states remain checked. Screenshots are 390×844 host browser views, not an actual iPhone or real device connection. Width checks include 320/390/430. The worker update/recovery suite separately exercises offline process restart.

Final focused suite: **91/91 passed**, zero failed; [focused-tests.log](build/navigation-review/focused-tests.log). One additional historical retained-firmware vertical-slice test was attempted and **blocked by its existing FIRMWARE_HEAD pin**: current 74f45528a8aece434d9af1b757b18bc8caa8fe45 versus expected 2b7323b749e517fabab6134f4d4493ec22bc0b3b. That broader first run had 91 passes and one failure. The guard was not weakened, fixture authority was not silently changed, and this test is not reported as passed. Its failure is independent of the new body reader tests. The final applicable suite excludes that blocked historical test; detailed totals are in the log. Module syntax and git diff --check passed.

Adapter, flight-storage, fixture catalogue/FLGs, manifest and every accepted icon hash remain identical to candidate 2f894e47c73920ab. NO-ACK/FULL_ACK_GATE_PASS=false remains; export is not confirmed Muninn import. Owner browser storage and actual recordings were not accessed. No firmware/Muninn writes, build/flash/reset, COM10 access, deployment, commit or push occurred.

## Phone-sized review screenshots

- [HuginnEIS](build/navigation-review/screenshots/huginn.png)
- [Downloaded files](build/navigation-review/screenshots/downloads.png)
- [Offline local file/export](build/navigation-review/screenshots/downloads-offline.png)
- [Settings and retained draft](build/navigation-review/screenshots/settings.png)
- [Manual connection help](build/navigation-review/screenshots/help.png)
- [Version/storage help](build/navigation-review/screenshots/storage-help.png)

All connection/data examples are labelled simulated host tests. Browser-native file chooser language follows the host OS. Review the three tabs and help screenshots first. Publishing this candidate requires separate owner authorization. After any later authorized deployment, use the normal data-preserving PWA update and GET-only connection diagnostic on COM5. Share sanitized declaredBytes/receivedBytes, HTTP status, phase and code. Do not save settings or treat passing host streams as proof that the real Settings response now completes.
