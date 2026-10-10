# HuginnAPP PWA P1 — synthetic offline NO-ACK
## Scope and authority
PWA is a parallel delivery target and reversible experiment. Capacitor is not deprecated or abandoned.
Preserve the complete native Android/iOS Courier transport, TLS pinning, SQLite, secure credentials, mobile UI/adapters, qualification gates, configuration, tests and buildability.
No deletion or destructive refactoring is authorized. If PWA work would break or substantially restructure Capacitor, stop for separate owner approval.
The existing Android debug APK is a preflight build artifact only, not physical phone qualification.
Standalone entry point; no Capacitor changes. Only catalogued synthetic HFL bytes are accepted.
No pairing, HuginnEIS connections, OAuth, ACK transport or ACK outbox. FULL_ACK_GATE_PASS is false.
Native mobile/qualification.json and flight-compatibility.json are unchanged. VERIFIED LOCAL is an integrity/storage result, not native qualification or archival retention.
The new database is huginn-pwa-p1-no-ack (version 1), separate from the existing Courier database. It has downloads/chunks/flights/clients only.
Existing FlightStorage strict transaction, chunk hash, resume, import and reopen methods are reused. Its ACK/gate methods are overridden to fail closed. The adapter exposes no storage object or ACK API.

## Build and tests (Windows PowerShell, Node 22+)
Set-Location C:\Huginn-App
node scripts/pwa-build.mjs
node --test tests/pwa.test.mjs
node --test --test-concurrency=1 "tests/*.test.mjs"

No dependency installation or new dependency is required. Existing package/lockfile remain unchanged.
Output: C:\Huginn-App\dist\pwa. This directory is ignored by Git; source is pwa/ plus the build scripts.
The build copies flight-evidence.mjs and flight-storage.mjs unchanged. Its cache version is derived from app-shell content.
Synthetic fixtures and icons are checked in as source assets. To reproduce them intentionally:
node scripts/pwa-generate-assets.mjs
node scripts/pwa-build.mjs

## Exact local HTTPS launch procedure
This slice must not create/install a CA, change DEV/production device certificates or bypass TLS.
Prerequisite: owner-supplied PEM certificate and matching private key already trusted by the testing browser, with SAN localhost.
Keep the key outside the repository. The host reads it only for TLS and never serves it.
Replace these example paths with those existing owner files:
Set-Location C:\Huginn-App
node scripts/pwa-build.mjs
node scripts/pwa-serve.mjs --host 127.0.0.1 --name localhost --port 8443 --cert "C:\OwnerTLS\localhost-cert.pem" --key "C:\OwnerTLS\localhost-key.pem"
Open https://localhost:8443/
Stop with Ctrl+C.

Without supplied TLS files, the server refuses to start. No insecure production fallback exists.
No suitable trusted localhost certificate was supplied in this session: the HTTPS procedure is implemented but local owner TLS qualification remains pending; the later public-HTTPS Safari PWA results are recorded below.
A certificate-warning bypass is not an acceptance method.

For a later owner-approved iPhone LAN test, the iPhone cannot use the PC's localhost.
Use an already trusted certificate whose SAN matches an owner-controlled hostname resolving to the PC LAN address:
node scripts/pwa-serve.mjs --host <PC-LAN-IP> --name <certificate-SAN-hostname> --port 8443 --cert "<existing-cert.pem>" --key "<existing-key.pem>"
Open https://<certificate-SAN-hostname>:8443/ on the iPhone.
Any necessary LAN/firewall/trust configuration belongs to a separately authorized owner setup; no such changes were made.
Use home/test networking, not HuginnEIS Wi-Fi. Do not expose this developer host to the public internet.
The automated tests use a loopback-only HTTP secure-context exception in a fresh desktop Edge profile; that is not iPhone/HTTPS qualification.

## Hosting plan — TEST deployment recorded below
Use a dedicated, stable, owner-controlled HTTPS origin with normal publicly trusted TLS. Host the CONTENTS of dist/pwa at the origin root.
Do not publish the repository root, test scripts, native assets, secrets or owner TLS keys.
Preserve manifest/start URL/scope as ./ at the origin root; redirects must stay on that stable origin.
Serve .mjs/.js as text/javascript, .webmanifest as application/manifest+json, PNG as image/png, FLG as application/octet-stream.
Use HTTPS for every resource; serve sw.js and index.html with Cache-Control: no-cache.
Serve the other fixed-name assets with revalidation (do not give them immutable caching). Do not apply a SPA fallback to missing assets.
Required security headers:
Content-Security-Policy: default-src 'self'; connect-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'
X-Content-Type-Options: nosniff
Referrer-Policy: no-referrer
Publish a complete release atomically and retain the previous release for rollback.
Build.json records the content version and hashes; inspect it before publication.
No analytics, CDN runtime dependencies, third-party scripts, Google OAuth or device endpoints.
The worker installs a complete new cache before activation. Failed installation removes only the candidate cache.
An update waits for an explicit idle activation; release versions use new cache names. Schema remains version 1 in P1.
Future schema migrations require separate crash/recovery tests.
Changing scheme/hostname/port creates a different origin and storage area: export/re-import before changing origins.
Deployment requires owner approval. The initial P1 session did not deploy; the later approved TEST deployment is identified below. No operational production deployment is claimed.

## Owner iPhone Chrome installation test — later, not performed
1. Use the approved trusted HTTPS host while internet/home networking is available.
2. In Chrome on iPhone 17 Pro Max/iOS 26, open the root URL; reject any TLS warning.
3. Wait for "Offline app shell cached" and the strict IndexedDB probe success.
4. Share -> Add to Home Screen -> Add. Launch the resulting Home Screen app.
5. Download/import a synthetic fixture from inside the installed app. Do not assume Chrome-tab storage is shared with Home Screen storage.
6. Close the app, disable networking, then cold-launch the Home Screen app.
7. Confirm the UI, catalog/fixtures and VERIFIED LOCAL imported evidence remain available.
8. Safari-installed Home Screen results are recorded below; Chrome remains a separate pending test. Record exact iOS/browser version, standalone mode, persistence result and tested size.
Android Chrome and Windows use their browser's Install/Add to Home Screen command.
An offline cache status is not proof of cold-launch success until step 6 passes.

## Evidence and export procedure
1. Download COMPLETE, INCOMPLETE or ceiling fixture using the page link.
2. Select that .FLG in Import. App verifies full-file SHA-256 against the synthetic catalog, CRC/structure and exact canonical metadata.
3. Strict range commits complete before offsets advance. Import completes before the adapter closes/reopens the database and verifies again.
4. UI reports IMPORTED while validating, then VERIFIED LOCAL. A failed reopen reports IMPORTED — VALIDATION FAILED.
5. Prepare export revalidates storage and snapshots original bytes. A second explicit Save/share click preserves Web Share user activation.
6. Select Save to Files/On My iPhone if offered, or complete the browser-controlled download. Browser support/provider availability is not assumed.
7. UI reports EXPORTED — NOT CLOUD CONFIRMED only after the share call resolves or download is dispatched.
   Download dispatch/share success cannot prove the selected destination saved anything. Cancellation produces an error, not success.
8. Select the actual saved file with Re-import. It must match metadata/hash and every original byte. No new evidence is created by this comparison.
9. A later online manual Drive upload is outside P1. This app does not upload or authorize any cloud operation.
No browser cache/IndexedDB/export event changes device transfer state or permits evidence deletion.

## Size and browser limitations
Hard ceiling: 1,048,576 bytes (1 MiB), checked before reading File contents and at adapter boundaries.
The largest bundled synthetic fixture exercises this ceiling in host and real desktop IndexedDB round-trip tests.
No unlimited-file claim. Owner-observed iPhone validation of the bundled 1 MiB fixture passed on 2026-10-10 as recorded below; larger files and other builds/devices are not qualified.
WebCrypto and the reused parser/storage reconstruct whole buffers and records. This deliberately small ceiling bounds that P1 work.
No background transfer guarantee. Ordinary offline power-cycle verification is owner-reported PASS below. Screen lock, termination during writes, low storage and origin eviction still need owner tests.
Strict durability is mandatory; browsers without it fail closed. Browser persistence is requested explicitly and is not archival assurance.
File sharing/type/size support is capability-tested; download fallback is browser-controlled. Neither offers a silent Files destination.
Home Screen, Chrome and Safari contexts may have separate storage. Clearing website data/uninstalling can lose local evidence.
Native durability, TLS pinning and phone qualification remain separate; ACK stays false even if every P1 owner test passes.

## Acceptance matrix
Automated: integrity/hash/CRC, size rejection, strict IndexedDB, interrupted chunk/offset rollback, restart/resume, duplicate preservation,
export/reimport byte identity, share cancellation/download fallback, unsupported features, no ACK store and offline fresh-document startup.
Owner results: Safari-installed Home Screen cold launch and COMPLETE, INCOMPLETE and 1 MiB ceiling fixture round-trip/reopen passed as recorded below. Remaining: Chrome/other contexts, interrupted imports, termination during writes,
denied persistence/quota failure, explicit Files destinations, app update while idle/busy and Android/Windows installed modes.
None of these tests requires pairing, a device endpoint, a real log, physical SD or an ACK.

## Historical initial P1 session validation evidence
Baseline checked clean: main eb9becb5920aabb4b6df9fa656522e86f49a5d40.
Existing app regressions: 257 top-level tests passed (full combined run: 263/263 before the additional worker test).
Final P1 suite: 7/7 top-level tests; 11/11 embedded real-browser tests, Edge 155.0.4283.45.
Exact 1 MiB fixture verified through strict storage, export and byte-identical reimport.
Offline fresh-document startup with networking disabled and persisted evidence reopen passed on desktop Edge.
Phone-width screenshot: ../build/p1/offline-phone-layout.png (ignored local test artifact, not an iPhone screenshot).
Worker failed-cache rollback and single-window update admission tested; activation refuses while other PWA windows remain open.
In that initial session, no HTTPS handshake, actual phone install, Files-provider interaction, Android/iOS qualification or deployment was performed. Later TEST deployment and physical PWA results are recorded below.
At that historical session end, native/protocol/qualification sources and both baseline HEADs were unchanged; new P1 source files were unstaged/untracked. This is historical Git evidence, not the current working-tree status.

## Physical iPhone owner test record — 2026-10-10

Status: the eight reported checks below PASS for this specific synthetic PWA test. This is not native iOS qualification, aircraft qualification, HuginnEIS communication qualification, archival retention qualification or authorization for operational flight data.

- Device: Apple iPhone 17 Pro Max; Safari Add to Home Screen installation.
- Exact iOS/Safari version/build: not supplied in this test record. Chrome installation/runtime is not covered.
- TEST origin: https://huginnapp-pwa-test.pages.dev
- Deployment ID: f57000f4-0b77-4a94-a8db-e9eceff80c83
- Source commit: 923d1e9831a7cd311ce4f564c8ad42cd2c944628
- PWA build: 7ce3de4a1f28cc68
- Fixture: F000001.FLG, synthetic COMPLETE, 1088 bytes; repository source pwa/fixtures/complete.FLG.
- Full-file SHA-256: 93e7956bc91945a4edae075b01f2fa3fa97f36cb1531d752c706b6f7dde93d5d.

Evidence provenance: owner-observed physical-device results supplied on 2026-10-10, reported as supported by screenshots. No screenshot attachments or archive paths were supplied with this request; they were not independently inspected in this documentation session. The local catalog, fixture bytes/hash, build identity and source gate were checked independently. Exact export destination/provider and OS reboot were not recorded in that original test; the separate power-cycle record below supplies later reboot evidence.

| Physical check | Owner result | Tested observation and limit |
|---|---|---|
| Installation | PASS | Safari Add to Home Screen installed the PWA. |
| Approved logo | PASS | Original Huginn logo visible on iPhone Home Screen. |
| Offline cold launch | PASS | App completely closed and reopened with Airplane Mode enabled and networking disabled. |
| Synthetic import | PASS | Synthetic COMPLETE F000001.FLG imported. |
| IndexedDB verification | PASS | Application displayed VERIFIED LOCAL. |
| Export/re-import | PASS | Exported synthetic FLG successfully selected and re-imported. |
| Exact byte round-trip | PASS | Application displayed BYTE-IDENTICAL ROUND-TRIP VERIFIED. |
| Persistence after app restart | PASS | Offline close/reopen and Verify local displayed “CRC, metadata identity and full-file SHA-256 verified after reopen.” |

Files also displayed iCloud synchronization errors while offline. This is not established as HuginnAPP corruption: IndexedDB verification succeeded independently of iCloud. No successful cloud upload, cloud retention or provider synchronization is claimed. EXPORTED — NOT CLOUD CONFIRMED remains the correct export status.

### Evidence classes and qualification authority

| Evidence class | Recorded result | Authority |
|---|---|---|
| Prior automated icon/PWA/mobile/Courier/UI regression run | 190/190 passed before approved deployment | Host/model/static coverage; not native phone execution. Not rerun for this documentation-only update. |
| Prior real desktop Edge PWA run | 11/11 embedded browser checks, Edge 155.0.4283.45 | Desktop IndexedDB/offline/1 MiB behavior only; not iPhone proof. |
| Physical Safari-installed iPhone PWA | Original eight PASS results plus extended fixture results below | Owner-observed synthetic COMPLETE 1088 bytes, INCOMPLETE 768 bytes and ceiling 1 MiB on the named build; no native qualification. |
| Synthetic data | Catalog fixture identity and SHA match locally | No real aircraft evidence tested or authorized. |
| Native Android/iOS and HuginnEIS integration | Not qualified by this record | Existing Android APK is preflight-only; no native phone/TLS/pairing/network/ACK validation added. |

Source authority remains unchanged: pwa/adapter.mjs exports FULL_ACK_GATE_PASS=false, has a 1 MiB ceiling and denies ACK operations. mobile/qualification.json and flight-compatibility.json both retain empty qualified_builds. No PWA result is inserted into either list. NO-ACK, synthetic fixtures only, no pairing, no device connection and no cloud upload remain in force.


### Extended physical iPhone fixture results — 2026-10-10

Owner-reported physical tests on iPhone 17 Pro Max, Safari-installed Home Screen PWA, TEST origin https://huginnapp-pwa-test.pages.dev, build 7ce3de4a1f28cc68. Documentation baseline: 95a68b3df82a67fc00b9fd7432aab3a4e6035d98; this documentation update does not change the deployed build.

| Fixture | Exact bytes | Reported classification | Offline import | IndexedDB verification | Export/re-import | Byte-identical hash/round-trip | Offline app restart persistence |
|---|---:|---|---|---|---|---|---|
| F000001.FLG (synthetic COMPLETE) | 1088 | COMPLETE | PASS | PASS | PASS | PASS | PASS |
| F000002.FLG (synthetic INCOMPLETE) | 768 | INCOMPLETE — correct classification PASS | PASS | PASS | PASS | PASS | PASS |
| F000003.FLG (synthetic ceiling) | 1048576 | INCOMPLETE — correct classification PASS | PASS | PASS | PASS | PASS | PASS |

Full-file SHA-256 identities:

- F000001.FLG: 93e7956bc91945a4edae075b01f2fa3fa97f36cb1531d752c706b6f7dde93d5d
- F000002.FLG: 1258a8be2cb0201dbb8aa6bed4e2d78e31c574682f8172584177e5950b87646a
- F000003.FLG: a665ab60cb630c78316cf0023f4165e2244ae06094f94ad65e6ba9118053fca9

The owner reported the application displayed: “CRC, metadata identity and full-file SHA-256 verified after reopen.”

Evidence is owner-observed and reported as supported by screenshots in ChatGPT. No independent screenshot inspection is claimed by this update; no repository screenshot evidence was supplied or inspected. Exact OS/browser build and export provider/path remain unrecorded. The original extended test covered app restart; the later power-cycle record below covers ordinary shutdown/restart, not abrupt power loss during writes.

Catalog/parser expectations, distinct from independently observed device diagnostics: the 768-byte fixture has integrity=1 and 768 valid bytes; the ceiling fixture has integrity=2, TORN_FINAL_RECORD and 1048448 valid bytes. Its full-file hash and byte-identical round-trip include the final 128 torn bytes. These bytes must not be trimmed and INCOMPLETE must not be converted to COMPLETE. The reported device classification/round-trip passes do not claim separate on-screen inspection of all parser internals.

The tested physical size ceiling is now 1 MiB for this particular bundled fixture/device/build. This does not prove arbitrary 1 MiB inputs, accumulated storage capacity, interruption recovery or indefinite retention. Prior automated and desktop results remain separate evidence classes; no tests were rerun solely for this documentation update. Native qualification lists stay empty, FULL_ACK_GATE_PASS=false and NO-ACK remains active.


### Offline physical iPhone power-cycle — 2026-10-10

Owner-observed iPhone 17 Pro Max, Safari-installed PWA, https://huginnapp-pwa-test.pages.dev, build 7ce3de4a1f28cc68. The owner completely powered down the phone and restarted it with networking disabled. No independent screenshot inspection is claimed.

| After ordinary power-cycle | Classification | Bytes | Local verification | Owner result |
|---|---|---:|---|---|
| F000001.FLG | COMPLETE | 1088 | VERIFIED LOCAL | PASS |
| F000002.FLG | INCOMPLETE | 768 | VERIFIED LOCAL | PASS |
| F000003.FLG | INCOMPLETE | 1048576 | VERIFIED LOCAL | PASS |

The application displayed “CRC, metadata identity and full-file SHA-256 verified after reopen.” The owner subsequently exported/re-imported the 1 MiB fixture offline and observed “BYTE-IDENTICAL ROUND-TRIP VERIFIED”, SHA-256 a665ab60cb630c78316cf0023f4165e2244ae06094f94ad65e6ba9118053fca9.

The system Airplane Mode networking warning is not evidence of HuginnAPP corruption. No cloud synchronization or retention is claimed. This verifies retention of already imported synthetic evidence across ordinary shutdown/startup; no active-write interruption, abrupt battery loss, quota, eviction or update recovery PASS is implied.

### Interrupted-import recovery plan — proposed, not executed

Source review: pwa/adapter.mjs import first validates the complete selected input against the synthetic catalog. It creates/reuses staging, revalidates all committed chunks through FlightStorage.resume(), then commits remaining 16384-byte ranges. Each chunk and offset share a strict transaction. Full evidence validation precedes an atomic flights-row plus IMPORTED staging update; connection reopen and full validation precede VERIFIED LOCAL. Startup lists imported flights only. Recovery is manual: select the same original file again; startup does not automatically resume hidden staging.

The 1 MiB fixture contains 64 ranges. Already imported fixtures deduplicate and skip range writes, so repeatedly importing F000003.FLG in the owner's current database cannot exercise fresh staged recovery. The present UI exposes neither committed offsets nor pause/abort controls. Manual swiping during a fast import cannot prove which phase was interrupted; a completed import is an inconclusive interruption test.

Proposed separately approved test-only harness, with no implementation/deployment authorized here:

1. Use a new named disposable database for each case, never huginn-pwa-p1-no-ack. Seed COMPLETE and INCOMPLETE as verified controls; keep the ceiling fixture absent. Assert database isolation before enabling any test hook. Keep catalog bytes and metadata unchanged. Do not clear/delete storage or write directly into existing chunks.
2. Record baseline control hashes/classifications. Add test-only phase/committed-offset reporting and deterministic pause points around existing operations; no shipping-app controls or global IndexedDB prototype patches.
3. Fresh cases: pause before staging; after staging; after range 1 (16384 bytes); after range 32 (524288 bytes); after range 64 but before publication; and after publication before reopen verification. Between-transaction pauses establish deterministic durable boundaries.
4. At a paused staging boundary, terminate the disposable test app, reopen it offline, verify both control rows, and confirm the ceiling row is absent until publication commits. In the post-publication case, its row may legitimately exist, but VERIFIED LOCAL must require full revalidation.
5. Inspect staging read-only through the harness: offset, chunk count/length/hash and phase must agree. Select the identical ceiling file again; validated committed ranges should be reused and only missing ranges written. At all-ranges/pre-publication, validate and publish without rewriting ranges. After publication, revalidate/deduplicate rather than create a second row.
6. Separate deterministic rollback cases should deliberately abort a test transaction after a chunk request but before offset commit, and during publication. Assert both members of each transaction roll back, no partial flight is listed, previous controls are unchanged, and same-file retry succeeds. A transaction-abort test is not OS-termination/power-loss proof. Do not hold an IndexedDB transaction alive merely to wait for a human; exact termination inside a live transaction may remain inconclusive.
7. Every recovered import must match catalog SHA/CRC/metadata, remain INCOMPLETE, export the full 1 MiB including torn tail, and pass byte-identical re-import after offline reopen. Repeat each independent case with a new disposable database; retain results without deleting databases in this procedure.
8. Rejection path: existing desktop tests alter disposable test chunks to exercise quarantine; that deliberate corruption is excluded from this owner's no-damage procedure. A harness may instead simulate a revalidation error without editing evidence and confirm fail-closed/quarantine behavior, labelled simulated error rather than proof of actual corrupted-chunk detection. Actual hash-mismatch recovery remains a separate untested physical gate.

Existing tests/pwa-browser.mjs cover transaction rollback, one-range resume and publication abort in fresh desktop databases; these are desktop automated evidence only. Their global prototype injection, direct corruption case and database-deletion cleanup must not be run against the owner's installed PWA or reused unchanged for these physical tests.

Code changes are unnecessary for the recorded power-cycle results or normal import/export. Deterministic physical interruption/reuse assertions require an isolated test harness and test-only observation/pause/abort seams; the deployed P1 UI cannot perform them repeatably today. Recommended next implementation, subject to separate approval: an excluded-from-production recovery harness using the same storage/verification paths, isolated database names and immutable synthetic fixtures, first verified on desktop before any approved physical iPhone delivery. No parser/format/qualification/ACK changes are needed. Keep NO-ACK and FULL_ACK_GATE_PASS=false.
### Recovery risk review and safest next tests

The ordinary power-cycle result is recorded below. Other failure-path items remain UNTESTED on the physical iPhone; no new PASS is assigned to them.

1. Ordinary reboot: owner-reported PASS is recorded below for all three rows and post-reboot 1 MiB round-trip. Abrupt loss during an active transaction is a separate, untested failure mode.
2. Interrupted imports: use a separately agreed disposable synthetic test context. Interrupt staging/publication, reopen and select the same original fixture to resume. Strict transactions should keep chunk/offset and import publication atomic, but real interruption timing is not proven. Previously committed ranges may remain while an incomplete import is not listed. Record an interruption as inconclusive if the operation already finished; existing UI has no deterministic interruption hook.
3. Persistence refusal and quota failure: record granted/denied/unavailable persistence behavior without clearing evidence. A denied persistence request does not block import or guarantee retention. The PWA has no quota-reserve preflight; write errors stop the operation and should abort the failing transaction while preserving earlier commits. Controlled failure injection requires a separately approved test setup; do not fill the owner's phone or clear website data merely to force failure.
4. Concurrent windows: the busy lock is per adapter instance, not a cross-window mutex. On disposable synthetic data, verify concurrent attempts cannot expose partial imports, replace evidence or create mismatched offsets. Do not declare cross-window safety from the single-window tests.
5. App update recovery: under separate deployment approval, test idle/busy/offline updates and incomplete asset delivery on a disposable installed test context. Preserve the previous usable shell and IndexedDB bytes; a successful cached cold launch does not prove update recovery.
6. Eviction: browser persistence is not an archive and cannot prevent user deletion, uninstall or device loss. Eviction/deletion tests must use disposable synthetic storage, independent verified exports and explicit authorization; do not destroy the current owner's evidence. There is no guaranteed recovery from total origin-data loss without an external copy.

Storage behavior still needs physical failure-path proof: strict writes abort on transaction failure; same-fixture re-selection validates committed chunks before resuming; corrupt staging is quarantined. There is no staging inspection/repair UI, deterministic quota/eviction/interruption control or browser-retention guarantee. Export dispatch is not a confirmed Files save or cloud upload. Keep all proposed tests offline/local and synthetic; no cloud upload, device pairing, transport or ACK is authorized here.
### Remaining P1 acceptance gates

These are the outstanding tests from the acceptance matrix above, with additional risk characterization explicitly identified below. A PASS in one browser/context does not qualify another.

| Gate | Current evidence | Remaining owner test |
|---|---|---|
| Tested size and classifications | Owner iPhone PASS: COMPLETE 1088 bytes, INCOMPLETE 768 bytes and exact 1 MiB ceiling, including round-trip/reopen | Oversized/non-catalogued rejection remains a physical-device negative test; no unlimited-size claim or broader file corpus qualification. |
| Interrupted writes and recovery | Automated rollback/resume coverage; normal iPhone app restart passed | Synthetic import interrupted during staging/publication, then reopen; offsets, visibility and bytes must remain consistent. Distinguish a normal close from actual OS termination. |
| Lifecycle | Owner PASS: offline cold launch, app restart and ordinary power-cycle; post-reboot ceiling round-trip | Screen lock/background, OS termination during writes and low-battery interruption; record exact OS/build and operation timing. No invasive power-cut procedure. |
| Storage pressure/persistence | Strict local verification passed on this device | Persistence request granted/denied/unavailable; quota/write failure and low-storage recovery. Verification must fail safely and never imply archival retention. |
| Export destinations | Three fixture round-trips reported; provider not recorded | Explicit On My iPhone/local Files versus iCloud provider, offline availability, cancellation/failure and byte verification from the selected saved file. Cloud testing remains separately authorized later work. |
| Installed-app updates | Desktop candidate-cache failure and window admission tests | Existing Home Screen installation updating while idle/busy/offline; retain synthetic evidence and last usable shell after incomplete asset delivery. No deployment authorized by this record. |
| Other contexts | Safari-installed Home Screen subset passed | Chrome-on-iOS installation and runtime separately; Safari browser-tab context, Android Chrome installed mode and Windows installed mode. Do not assume shared storage across contexts. |

Additional risk characterization proposed for owner review, not new approved qualification authority: multiple PWA windows share the same origin database while the adapter's busy lock is per instance; test concurrent operations before promising cross-window serialization. Characterize uninstall/website-data clearing, origin changes and OS eviction using disposable synthetic data only under an explicitly agreed destructive-test procedure. A separate verified export is needed before any such test. Multi-file accumulation and memory pressure remain unproven on iPhone even though each file is capped at 1 MiB. Parser/hash whole-buffer allocation and browser-managed storage prevent any unlimited-size or indefinite-retention claim.

### Current architecture and planned transfer relationship

Current P1: catalogued synthetic FLG -> shared flight-evidence.mjs CRC/identity/SHA verification -> shared flight-storage.mjs through pwa/adapter.mjs strict IndexedDB staging and reopen verification -> explicit browser export -> exact re-import comparison. The PWA has no HuginnEIS transport, native credential/TLS-pinning service, ACK outbox or Google Drive API. App-shell caching and evidence storage are separate; a cached shell alone does not prove evidence retention.

Capacitor remains a parallel native target. mobile/SLICE_3G_REVIEW.md and mobile/SLICE_3H_REVIEW.md describe native Courier transport, TLS/pairing, SQLite/secure credentials, resumability and gated ACK source. Those source/host reports are not physical native qualification. The historical early build-blocker statements in those reports do not override the later Android preflight artifact; neither an APK build nor this PWA result qualifies a phone. Native gates still require exact platform/build identity, storage/secure-store durability, TLS/SAN/SPKI failures, permissions/AP routing, lifecycle/recovery and separately authorized real device testing.

Planned end-to-end relationship: HuginnEIS supplies immutable flight evidence; HuginnAPP acts as a local courier; an explicitly saved raw file may later be manually transferred via a cloud provider to Windows; Muninn verifies and imports that copy for proposed Replay. This is a future integration, not an implemented P1 pipeline. Browser trust/local-network/CORS access requires a separate design and device test; native TLS pinning cannot be assumed available to a PWA.

Read-only source review of C:/Muninn/README.md and muninn_app/importer.py/ui.py finds a D1C journal-copy importer, not an HFL FLG Flight Replay import implementation. Existing Protected State JSON transfer is a different format/path. Before FLG integration, approve a transfer contract preserving original bytes, full-file SHA-256, canonical metadata identity and provenance; validate CRC/classification, retain conflicting versions, and handle byte-identical duplicates without silently overwriting evidence. Define how metadata accompanies a raw FLG without changing HFL/HFM ABI. A Files save/share or Drive upload attempt cannot establish this contract or authorize ACK/deletion.

### Recommended next sequence — approval required before further work

1. Complete the evidence record: archive owner screenshots, exact iOS/browser build, install context and chosen local export destination. Keep the current eight PASS entries limited to this build/fixture.
2. Ordinary offline power-cycle and post-reboot ceiling round-trip are now owner-reported PASS. Next review an isolated, deterministic interrupted-import harness as planned below; explicit local export destination still needs evidence.
3. Agree and execute a disposable-data recovery matrix for interrupted writes, quota/persistence refusal, storage pressure and concurrent windows. Only then review whether a narrowly scoped PWA recovery/UX correction is needed.
4. Qualify installed-app update/rollback behavior and the other browser/platform contexts independently. Keep deployment and implementation subject to separate approval.
5. Review a NO-ACK end-to-end transfer/import specification and Muninn HFL/Replay scope before implementing device transport or PC integration. Manual cloud transfer tests need separate authorization and online access; OAuth must not become a prerequisite for offline operation. Native phone qualification stays a separate track.

No blocker prevents recording these results. Remaining blockers to broader readiness are untested iPhone active-write interruption/storage/update behavior, untested browser/device trust and networking, and absent Muninn HFL Replay import. None is marked passed. No application code, assets, protocol, qualification file, firmware, Muninn source, hardware or deployment was changed by this documentation update.

### Read-only installed-app version diagnostics

The collapsed App information section reports the build captured by the running entry module, the controlling worker, registration active worker, waiting worker and expected offline shell cache. Refresh information only queries worker identities and reads existing cache entries. It does not register/update workers, activate a waiting worker, reload, delete caches or access flight records. The existing update admission/activation policy is unchanged.

The builder hashes ordered canonical source inputs with build placeholders, derives a 16-character identity, stamps HTML, entry and worker, and records final artifact hashes in build.json. A server build.json is deployment evidence, not proof of the installed application's running identity. HTML/entry disagreement is reported separately. Application and worker versions differ is displayed only when both identities are known and unequal.

Worker replies use a correlated versioned MessageChannel protocol with scope/cache validation and bounded timeout. Legacy workers, invalid replies and unavailable APIs report Unknown or Unavailable; controller changes invalidate the snapshot. Cache presence means expected shell assets are present, not durable evidence retention or complete attestation of every already-loaded module. Waiting worker information is a snapshot and does not promise activation or rollback.

Automated desktop diagnostics are separate from physical iPhone qualification. The last owner-tested iPhone build remains 7ce3de4a1f28cc68. This source change creates a new build identity; no deployment or installed-phone update is authorized by implementation. Physical qualification must record the running app and controlling worker, waiting state, offline cache and retained synthetic fixture hashes before and after an approved update. Preserve independent verified exports, NO-ACK and FULL_ACK_GATE_PASS=false.
