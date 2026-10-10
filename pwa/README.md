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
No suitable trusted localhost certificate was supplied in this session: the HTTPS procedure is implemented but actual owner TLS/phone qualification remains pending.
A certificate-warning bypass is not an acceptance method.

For a later owner-approved iPhone LAN test, the iPhone cannot use the PC's localhost.
Use an already trusted certificate whose SAN matches an owner-controlled hostname resolving to the PC LAN address:
node scripts/pwa-serve.mjs --host <PC-LAN-IP> --name <certificate-SAN-hostname> --port 8443 --cert "<existing-cert.pem>" --key "<existing-key.pem>"
Open https://<certificate-SAN-hostname>:8443/ on the iPhone.
Any necessary LAN/firewall/trust configuration belongs to a separately authorized owner setup; no such changes were made.
Use home/test networking, not HuginnEIS Wi-Fi. Do not expose this developer host to the public internet.
The automated tests use a loopback-only HTTP secure-context exception in a fresh desktop Edge profile; that is not iPhone/HTTPS qualification.

## Production hosting plan — not deployed
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
Deployment needs owner approval and was not performed.

## Owner iPhone Chrome installation test — later, not performed
1. Use the approved trusted HTTPS host while internet/home networking is available.
2. In Chrome on iPhone 17 Pro Max/iOS 26, open the root URL; reject any TLS warning.
3. Wait for "Offline app shell cached" and the strict IndexedDB probe success.
4. Share -> Add to Home Screen -> Add. Launch the resulting Home Screen app.
5. Download/import a synthetic fixture from inside the installed app. Do not assume Chrome-tab storage is shared with Home Screen storage.
6. Close the app, disable networking, then cold-launch the Home Screen app.
7. Confirm the UI, catalog/fixtures and VERIFIED LOCAL imported evidence remain available.
8. Repeat separately for Safari installation. Record exact iOS/browser version, standalone mode, persistence result and tested size.
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
Owner pending: actual Chrome/Safari/Home Screen iOS 26 strict transactions, full 1 MiB round trip, force termination/reboot,
airplane-mode cold launch, denied persistence/quota failure, Files destinations, app update while idle/busy and Android/Windows installed modes.
None of these tests requires pairing, a device endpoint, a real log, physical SD or an ACK.

## Session validation evidence
Baseline checked clean: main eb9becb5920aabb4b6df9fa656522e86f49a5d40.
Existing app regressions: 257 top-level tests passed (full combined run: 263/263 before the additional worker test).
Final P1 suite: 7/7 top-level tests; 11/11 embedded real-browser tests, Edge 155.0.4283.45.
Exact 1 MiB fixture verified through strict storage, export and byte-identical reimport.
Offline fresh-document startup with networking disabled and persisted evidence reopen passed on desktop Edge.
Phone-width screenshot: ../build/p1/offline-phone-layout.png (ignored local test artifact, not an iPhone screenshot).
Worker failed-cache rollback and single-window update admission tested; activation refuses while other PWA windows remain open.
No HTTPS handshake, actual phone install, Files-provider interaction, Android/iOS qualification or deployment was performed.
All native/protocol/qualification sources and both baseline HEADs remain unchanged. New P1 source files are unstaged/untracked.