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
No unlimited-file claim; iPhone validation of the same ceiling remains required.
WebCrypto and the reused parser/storage reconstruct whole buffers and records. This deliberately small ceiling bounds that P1 work.
No background transfer guarantee. Screen lock, OS termination, reboot, low storage and origin eviction need owner tests.
Strict durability is mandatory; browsers without it fail closed. Browser persistence is requested explicitly and is not archival assurance.
File sharing/type/size support is capability-tested; download fallback is browser-controlled. Neither offers a silent Files destination.
Home Screen, Chrome and Safari contexts may have separate storage. Clearing website data/uninstalling can lose local evidence.
Native durability, TLS pinning and phone qualification remain separate; ACK stays false even if every P1 owner test passes.

## Acceptance matrix
Automated: integrity/hash/CRC, size rejection, strict IndexedDB, interrupted chunk/offset rollback, restart/resume, duplicate preservation,
export/reimport byte identity, share cancellation/download fallback, unsupported features, no ACK store and offline fresh-document startup.
Owner results: Safari-installed Home Screen cold launch and 1088-byte COMPLETE round-trip/reopen passed as recorded below. Remaining: Chrome/other contexts, full 1 MiB round trip, force termination/reboot,
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

Evidence provenance: owner-observed physical-device results supplied on 2026-10-10, reported as supported by screenshots. No screenshot attachments or archive paths were supplied with this request; they were not independently inspected in this documentation session. The local catalog, fixture bytes/hash, build identity and source gate were checked independently. Exact export destination/provider and OS reboot were not recorded; application close/reopen must not be relabelled as an OS reboot.

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
| Physical Safari-installed iPhone PWA | Eight PASS results above | Owner-observed 1088-byte synthetic COMPLETE fixture on the named build. |
| Synthetic data | Catalog fixture identity and SHA match locally | No real aircraft evidence tested or authorized. |
| Native Android/iOS and HuginnEIS integration | Not qualified by this record | Existing Android APK is preflight-only; no native phone/TLS/pairing/network/ACK validation added. |

Source authority remains unchanged: pwa/adapter.mjs exports FULL_ACK_GATE_PASS=false, has a 1 MiB ceiling and denies ACK operations. mobile/qualification.json and flight-compatibility.json both retain empty qualified_builds. No PWA result is inserted into either list. NO-ACK, synthetic fixtures only, no pairing, no device connection and no cloud upload remain in force.

### Remaining P1 acceptance gates

These are the outstanding tests from the acceptance matrix above, with additional risk characterization explicitly identified below. A PASS in one browser/context does not qualify another.

| Gate | Current evidence | Remaining owner test |
|---|---|---|
| Tested size and classifications | iPhone COMPLETE 1088 bytes; desktop ceiling verified | Physical import/verify/export/re-import of bundled INCOMPLETE and exact 1 MiB torn-tail ceiling fixture; preserve state/integrity distinctions and rejection of oversized/non-catalogued input. |
| Interrupted writes and recovery | Automated rollback/resume coverage; normal iPhone app restart passed | Synthetic import interrupted during staging/publication, then reopen; offsets, visibility and bytes must remain consistent. Distinguish a normal close from actual OS termination. |
| Lifecycle | Offline cold launch and app close/reopen passed | Screen lock/background, OS termination, ordinary phone reboot and low-battery interruption; record exact OS/build and operation timing. No invasive power-cut procedure. |
| Storage pressure/persistence | Strict local verification passed on this device | Persistence request granted/denied/unavailable; quota/write failure and low-storage recovery. Verification must fail safely and never imply archival retention. |
| Export destinations | One successful round-trip; provider not recorded | Explicit On My iPhone/local Files versus iCloud provider, offline availability, cancellation/failure and byte verification from the selected saved file. Cloud testing remains separately authorized later work. |
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
2. Run the remaining synthetic physical P1 size/classification, destination and lifecycle tests, beginning with INCOMPLETE and 1 MiB round-trips plus ordinary reboot. Confirm local exports remain readable and hash-identical offline.
3. Agree and execute a disposable-data recovery matrix for interrupted writes, quota/persistence refusal, storage pressure and concurrent windows. Only then review whether a narrowly scoped PWA recovery/UX correction is needed.
4. Qualify installed-app update/rollback behavior and the other browser/platform contexts independently. Keep deployment and implementation subject to separate approval.
5. Review a NO-ACK end-to-end transfer/import specification and Muninn HFL/Replay scope before implementing device transport or PC integration. Manual cloud transfer tests need separate authorization and online access; OAuth must not become a prerequisite for offline operation. Native phone qualification stays a separate track.

No blocker prevents recording these results. Remaining blockers to broader readiness are untested iPhone recovery/size/storage/update behavior, untested browser/device trust and networking, and absent Muninn HFL Replay import. None is marked passed. No application code, assets, protocol, qualification file, firmware, Muninn source, hardware or deployment was changed by this documentation update.
