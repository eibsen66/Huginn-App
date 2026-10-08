# HuginnAPP Flight Courier Slice 3B-Mobile

Production target: signed, bundled Capacitor iOS/iPhone and Android/Samsung apps. Windows/Edge/IndexedDB is a development harness only. No real phone or OS build is qualified.

## Implemented local foundation

Capacitor core/CLI/iOS/Android are pinned to **8.5.2** in `package.json` and `package-lock.json`. Existing `index.html`, `style.css`, and `app.js` remain the UI. `scripts/mobile-assets.mjs` copies an explicit asset list to ignored `dist/mobile`; the generated entry point loads `mobile/entry.mjs`. There is no remote `server.url`. Native Android and iOS project source was generated on Windows and custom plugins are registered in MainActivity / CourierViewController.

**Temporary development identifier: `is.huginn.foundation.dev`**, shared by both projects. It is not an owner-approved App Store/Play Store identity. Before signing/distribution, the owner must choose the final identifier and update `capacitor.config.json`, Android namespace/applicationId/package path, iOS build settings, and the Keychain service namespace together. Version 0.1.0, build 1. No signing material was created.

## SQLite dependency audit and choice

Reviewed the [community SQLite releases](https://github.com/capacitor-community/sqlite/releases) and [8.1.0 source API](https://github.com/capacitor-community/sqlite/blob/v8.1.0/src/definitions.ts). It supports Capacitor 8, both platforms, and explicit begin/commit/rollback, but exposes general SQL and other database operations to JavaScript; its distribution uses SQLCipher. These capabilities are reasonable for general applications. Courier would still need a restrictive native transaction/validation authority wrapper, and SQLCipher is not needed for evidence in this slice.

Chosen implementation: app-local FlightCourier plugin V1, no external SQLite plugin dependency. Android uses `android.database.sqlite.SQLiteDatabase`; iOS uses system SQLite3. This is a deliberately small native boundary rather than a claim that the community plugin is unsafe. Native backend code is visible in the generated projects. The OS SQLite version cannot be pinned as an npm dependency: the plugin contract/schema is version 1, the Capacitor dependencies are exact pins, and effective SQLite implementation/version is diagnosed and eventually tied to each qualified OS build. An OS change requires requalification. No SQLite encryption or cloud storage dependency was added.

## Bridge contract

`flight-mobile.mjs` exposes a mockable `createCourierBridge(native)`; `mobile/entry.mjs` binds the packaged native plugin as `huginnCourierLocal`. Browser calls without native support fail closed. Neither JS nor native accepts SQL, a caller's durability/qualification boolean, or secret tokens. Native request fields are allowlisted. Base64 is only bounded bridge framing; SQLite stores the decoded exact BLOBs.

| Operation | Request | Result / authority |
|---|---|---|
| platformInfo | none | native platform, app/build, SQLite, fixture-build diagnostics |
| storageQualification | none | native checks, effective PRAGMAs, local gate, full gate false |
| evidenceCreateStaging | source_device_id, metadata_base64, metadata_sha256 | canonical E reference, staging status; native validates 108 bytes/digest |
| evidenceCommitRange | evidence_ref, offset decimal string, bytes_base64 | native contiguous offset; exactly 16,384 bytes except final chunk |
| evidenceGetStatus | evidence_ref | local state, conflict, ACK status, decimal offset |
| evidenceListImported | optional after reference | at most 64 derived flight statuses, ordered by E; staging excluded |
| evidenceReadRange | evidence_ref, offset decimal string, length 1..16,384 | exact bytes_base64, including reads crossing chunk boundaries |
| evidenceImport | evidence_ref | native streamed physical SHA/HFL/metadata verification; atomic import |
| evidenceReopenVerify | evidence_ref | actual connection close/reopen + native raw verification |
| evidenceCreateAckPending | evidence_ref | **debug fixture build only**, verified/local-gated PENDING_SYNTHETIC |
| evidenceMarkAcked | evidence_ref | **debug fixture build only**, verified/local-gated ACKED_SYNTHETIC |
| credentialStore | fixture_id: courier-v1 | **debug fixture build only**, native fixed synthetic credential; opaque ref |
| credentialExists | credential_ref | opaque ref/status, no bytes |
| credentialDelete | credential_ref | deletion status, no bytes |

Requests are bounded to 24,000 serialized characters, range data to 16 KiB; imported lists to 64 rows. Metadata input is exactly 108 bytes. Native local physical-size support is 128..4,294,967,295 bytes; this is a storage implementation limit, not a change to the frozen unsigned-64 wire encoder. Runtime/UTC values are read as exact 64-bit values, including the vectors beyond JavaScript's safe integer range. Native verifiers stream stored ranges and 160-byte records; no whole multi-MB object crosses the bridge. The host reference reconstructs bytes for the unchanged JS parser only and is not packaged.

## Schema and ownership

Authoritative schema: `mobile/schema.sql`, user_version 1. Logical S is device/session; E is device/session/metadata SHA. Canonical native references join validated identities with `|`, so separators cannot occur in components.

| Table | Key / contents |
|---|---|
| downloads | E primary key, S index, frozen metadata BLOB, contiguous offset, STAGING/IMPORTED |
| chunks | (E,offset) primary key, original BLOB (1..16 KiB), SHA-256, foreign key |
| flights | E primary key, S index, derived ACK status; imported rows only |
| ack_outbox | E primary key; PENDING_SYNTHETIC / ACKED_SYNTHETIC only |
| clients | local client/probe BLOBs; no secret tokens |

Duplicate E preserves the existing row. Multiple E for one S are retained and produce an unresolved conflict; no destructive conflict resolver exists. Original BLOBs are authoritative; parsed fields are derived and verification checks header identity/CRC, physical SHA, valid prefix CRC/type, sequence/monotonic progression, runtime, completion, and the metadata tuple. CORRUPT forensic prefixes remain distinct from COMPLETE and torn INCOMPLETE.

Android owns the connection on one ExecutorService worker; iOS on one serial DispatchQueue. JavaScript never owns it. All critical writes explicitly BEGIN IMMEDIATE / COMMIT, with rollback on errors: staging; chunk + offset; flight row + import state; outbox + pending status; outbox + synthetic success. Retry after synthetic success stays ACKED_SYNTHETIC. There is no TRANSFERRED state as device proof.

Database location is app-private: Android noBackupFilesDir; iOS Application Support/FlightCourier, excluded from backup with complete file protection. Android app backup is disabled for this scaffold. Durability requests DELETE journaling, EXTRA synchronous, foreign_keys ON; diagnostics read effective journal_mode, synchronous (must equal 3), and foreign_keys. No PRAGMA request alone establishes qualification. The probe commits a known binary BLOB, closes/reopens the connection, reads exact bytes, and removes the probe transactionally. This is not phone power-loss proof.

## Secure credentials and gates

Native-only token-write seams are not bridge methods. No pairing, real token generation, or token-reading JS API exists. Fixed synthetic credentials are used for probes/debug fixture tests.

- iOS: generic-password Keychain, `kSecAttrAccessibleWhenUnlockedThisDeviceOnly`, synchronizable false. Only opaque reference/exists/delete status reaches JavaScript.
- Android: non-exportable AndroidKeyStore AES key, AES/GCM with fresh IV; arbitrary token bytes are encrypted, not used as a Keystore key. Ciphertext is written via AtomicFile in no-backup private storage. Keys require the device unlocked; API <28 fails the secure probe closed. Device Keystore operations, lock behavior, and file persistence still require owner-run tests. Hardware backing is not assumed.

LOCAL_STORAGE_GATE_PASS is calculated natively from packaged context/no remote server, recognized platform, private SQLite, effective durability, serialized worker, adequate free space (remaining staging bytes plus 2 MiB reserve), actual committed/reopened probe, secure-store write/read/delete probe, and absence of conflicts. Probe/open failures deny eligibility. Callers cannot override these checks.

FULL_ACK_GATE_PASS is **always false**. TLS trust, real pairing, real device networking, and owner mobile qualification are absent. Release builds reject synthetic credential creation and ACK transition methods. Debug fixture builds may record local synthetic transitions, never device state.

`mobile/qualification.json` is the mobile data model: **qualified_builds = []**. It lists future required platform/model/OS/app version/build/Capacitor/WebView/SQLite/durability/TLS/permission fields. Host tests never write it. `flight-compatibility.json` is explicitly scoped to desktop development; its old schema/API is retained for harness compatibility and its list remains empty. Windows qualification cannot qualify mobile.

## Build and test reality

Windows reproduction:

```powershell
npm ci --ignore-scripts
npm run mobile:sync
npm run test:mobile
node --test tests/flight-evidence.test.mjs tests/flight-local.test.mjs
npm run test:regression
```

The existing launcher, Edge source-host runner, and IndexedDB adapter remain development tools. Existing misleading `PRODUCTION_ORIGIN`/test-case names in the preserved harness mean its fixed packaged-desktop origin only, never mobile production authority. No NativeAOT packaging is required for this slice.

IMPLEMENTED: local native source, bridge, schema, project wiring, secure service, synthetic runner, mobile manifest, desktop preservation.
STATICALLY CHECKED: source syntax/project registration/bridge method correspondence, dependency pins, asset wiring, and network API absence. Static checks do not establish SDK API/type correctness or platform runtime behavior.
ANDROID BUILT: **NO**; JDK/javac/Gradle/adb/SDK were not available in this session. No toolchain detour or phone operation.
IOS BUILD: **PENDING OWNER MAC/XCODE**; Windows generated the Xcode/SPM source, not an iOS binary.

Current host results and complete changed/untracked file inventory are recorded in `mobile/OWNER_REVIEW.md`. Host SQLite and credential mocks are not native SQLite/Keychain/Keystore runtime proof.

## Owner review and later phone gates (not executed)

1. Review the temporary identifier, private storage/backup policy, native code, explicit 4 GiB local limit, and signed-build identity. Keep the qualification lists empty.
2. On configured Android development machine: `npm ci --ignore-scripts`, `npm run mobile:sync`, then build app with JDK/SDK required by Capacitor 8. On owner Mac: same sync, open `ios/App/App.xcodeproj`, resolve exact Capacitor 8.5.2 SPM package, compile and sign a dev/TestFlight build. Resolve any SDK/type errors before testing. No build PASS is inferred from syntax parsing.
3. On a fresh disposable synthetic app installation, inspect `huginnCourierLocal.platformInfo()` and `storageQualification()`. Record actual app/build/OS/model/WebView/SQLite versions and effective DELETE/EXTRA/foreign_keys values. Confirm a locked secure store denies local eligibility and release synthetic write/ACK methods reject. The full gate must stay false.
4. For debug fixture builds only, use WebView inspection to run the bundled vectors:

```javascript
const {runLocalFixtures}=await import('/mobile/fixture-runner.mjs');
const vectors=await (await fetch('/tests/fixtures/flight-v1-vectors.json')).json();
await runLocalFixtures(huginnCourierLocal,vectors);
```

This fetch is **bundled local asset loading in an owner diagnostic command**, not Courier device transport. The runner receives vectors from the caller and itself has no networking API. It writes only synthetic evidence; shared synthetic S intentionally creates conflicts, so its local gate then denies and full gate remains false. It does not qualify the phone.

5. On iPhone, verify device-only/unlocked Keychain behavior and private database protection/backup exclusion. On Samsung, verify non-exportable Keystore key, fresh-IV encryption, ciphertext-only private files and reboot/locked behavior. Use synthetic references only.
6. Interrupt the app/process during staging, range commit, import, pending and synthetic success. Reopen and verify exact BLOBs, offsets, visibility, rollback and both atomic status rows. Test quota/storage failure and OS/app restart. Actual mobile interruption/power-loss proof is required; host process-reopen tests do not substitute.
7. Document local-network permission as **deferred/unexercised** now. iPhone local-network permission/ATS and Android applicable permissions must be designed and tested in the later networking slice. No prompt, Wi-Fi, QR/camera, discovery, certificate trust, Authorization, enumeration, Range download, device ACK or permission grant is added here. Existing unrelated settings/status DEV UI remains as before.
8. Review local proof first. Later TLS/pairing/network and explicit owner qualification are separate slices; this work does not enable transfer or ACK transport.
