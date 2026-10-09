# HUGINN FLIGHT LOG V1 SLICE 3G

READY FOR OWNER REVIEW

IMPLEMENTED: mobile native networking, durable transfer/resume and ACK outbox source. This is source and host/static evidence, not an Android/iOS build, phone qualification or real-device ACK.

## Authority and repository boundaries

App: C:/Huginn-App, main at c4455b59c282605b72ebed6ea1443ddc3bfec909. Firmware: C:/Huginn-Muninn, huginn-M1.16a-identity-hours at 7ef63a95d2f9fe44579bccfc141d2af019691ef4, clean and unchanged. Work is unstaged; no commit or push. No COM5, COM10, TF-WOW, flashing, aircraft/engine-hours state, NVS, physical HFM mutation or real-device ACK was used.

## Public trust evidence

Only public certificates were copied. The authoritative PEM and CER contain the same certificate; CER is the original DER encoding. Subject and issuer CN=Huginn DEV Root CA; CA=true; Certificate Signing/CRL Signing; validity 2026-08-31 to 2036-08-28; matching SKI/AKI ef2ac7e4f820b185b55a7b2f1b756510725d9b4b.

- Copied CA: mobile/trust/dev/huginn_dev_root_ca_cert.pem and huginn_dev_root_ca.cer.
- Certificate SHA-256: c8e47c813db321f292ef83d087f63620e5f17803de1ab2d26c6551674e247811.
- Root SPKI SHA-256: 20e858a94e45fe602fa048ebb4df7317bf5cfa9017936efcab51a2c6b517a7d7.
- Paired leaf SPKI SHA-256: 6cffc99004265d8b768a46b5721c314464f0ccdd6f64596b4086664002b1dcd8. Root SPKI is never the paired leaf authority.
- Public firmware leaf verifies against copied CA: Node signature verification and OpenSSL chain verification PASS (OK). Leaf IP SAN is 192.168.4.1; DNS SAN huginn.local.
- Repository scan: no private-key asset or private-key PEM block. Private CA/server keys and CA serial file were not consumed or copied. Test leaf assets contain public certificates only.

The explicit DEVELOPMENT profile is debug-only. The separate PRODUCTION profile remains disabled and unprovisioned; release transport fails closed. There is no system/user-CA substitute or trust-all fallback.

## Native architecture and bridge

Android uses a Network-scoped socket on the connected 192.168.4.x Wi-Fi network, layered SSLSocket with the exact approved root and normal HTTPS endpoint identification, explicit IP SAN, current validity and original DER SPKI hashing. No process-wide network binding, proxy, cookie store or redirect handling is used. [Android Network API](https://developer.android.com/reference/android/net/Network) documents network-bound socket routing.

iOS uses ephemeral URLSession and Security trust evaluation with the approved anchor only, SSL/IP policy, explicit signed IP SAN and exact original DER SPKI. Cookies/cache/credential storage/proxies and redirects are disabled. [Apple trust evaluation](https://developer.apple.com/documentation/foundation/performing-manual-server-trust-authentication) describes the native trust seam.

The actual iOS C SPKI extractor was compiled on the host with gcc -std=c11 -Wall -Wextra -Werror. Its original leaf SPKI slice is 294 bytes and hashes to the paired leaf fingerprint above. Its 990 truncated-prefix checks, malformed tag/length cases and IP SAN mismatch checks PASS. Android implements the same bounded DER walk and has native assertions for the expected fingerprint; Android execution is pending, so no Android runtime fingerprint PASS is claimed.

Six metadata-only native operations: courierConnection, courierList, courierDetail, courierDownload, courierRetryAcks and courierCancel. JS also has orchestration/resume and metadata progress subscriptions. Pairing intake is native-only, ready for the Slice 3H UI; it is not exposed as a JS QR/token method. Existing 14 local bridge operations remain; raw fixture operations cannot read or mutate real network-bound evidence. No token, raw network HFL bytes, arbitrary URL or caller-supplied ACK identity crosses the public bridge. Exceptions/server errors map to fixed public error codes.

Pairing accepts exactly the frozen five keys, rejects duplicate decoded keys, unknown fields, invalid UTF-8, trailing data, wrong JSON types and noncanonical MAC/pin/token. Secure storage holds the token. SQLite contains only opaque credential association. Replacement creates a new private credential first, then atomically updates the public pairing association; transaction failure preserves the prior credential association. Old secure items are retained for later owner-directed repair cleanup.

## Transfer and durability

Enumeration uses limit=8, at most 64 entries/eight pages, strict metadata/source/schema checks and at most three stale-cursor snapshot restarts. List hashes must be null; detail hashes nonnull. UInt64 decimal strings remain exact; completeness/state, count/valid/physical lengths and the frozen 108-byte identity are checked. AUTO accepts COMPLETE/INCOMPLETE only. PROVISIONAL/CORRUPT owner-forensic selection belongs to later UI; QUALIFIED_OPEN/ACTIVE_FLIGHT cannot be automatically selected.

Before ranges, a fresh detail is bound to persisted physical identity and strong ETag. Sequential ranges are at most 16,384 bytes and use If-Match. Status 206, Content-Length, Content-Range, strong ETag, Accept-Ranges, content type/encoding and actual received size are checked before an atomic native SQLite BLOB + offset commit. Progress publishes committed offset/status only and coalesces queued UI notifications.

Resume reopens/checks committed chunks before fresh detail and starts at the committed offset only if identity still matches. Changed identity or 412 quarantines the old evidence as SOURCE_CHANGED, preserving chunks and any pending outbox. Comparison precedes automatic-selection policy, including a source transition into CORRUPT. It never silently creates a new version or permits ACK. Global conflicts/quarantine conservatively block ACK eligibility until owner resolution.

Complete transfer streams bounded native physical SHA/header/session/HFL1/HFL2/metadata verification; IMPORT is transactional, then evidence is reopened/rehashed before durable PENDING creation. Network loss, write failure, quota failure and cancellation preserve prior commits. A new foreground explicit sync/resume request performs recovery; ambient automatic network resume/UI is not implemented in this foundation.

ACK is generated from the persisted identity, stored durably, and retried using exactly the persisted request bytes. Before a request, native code independently checks qualification, credential/repair state, validated peer and reopened evidence. OUTCOME_UNKNOWN is persisted before sending. Only an exact validated TRANSFERRED response with matching identity, generation and already_transferred boolean advances outbox and evidence to ACKED atomically. Lost-response retries reconcile duplicate success without reimporting. 401 AUTH_REQUIRED/INVALID_TOKEN and 403 TOKEN_REVOKED persist REPAIR_REQUIRED and retain evidence/outbox; retries stay denied until native re-pair. 503 Retry-After=1 has at most three attempts with foreground-aware waits.

Background/cancel closes native transport and changes operation epochs, preventing subsequent ranges/ACKs while retaining committed data. Android uses a serialized worker; iOS callbacks use a separate serial delegate queue to avoid blocking the SQLite worker.

## Bounds and qualification

Network bodies/ranges and hash buffers: 16 KiB. List: 16 KiB; detail: 2 KiB; ACK result: 1 KiB; error JSON: 512 bytes. Android HTTP headers: 8 KiB/32 unique fields; no transfer encoding. Certificate DER extractor: 16 KiB. Bridge replies: 64 KiB; progress: 2 KiB; nesting 8/arrays 64. Physical file storage limit inherited from the local foundation is 4,294,967,295 bytes; there is no Flight-length native allocation. SQLite BLOB commit size is at most one range.

mobile/qualification.json remains unchanged with qualified_builds=[]. Normal FULL_ACK_GATE_PASS=false. Native matching requires owner-qualified exact platform/model/OS/app build/Capacitor/WebView/SQLite identity, storage/TLS/permission PASS records and the development profile plus current native local/peer/credential gates. There is no JS override. Synthetic qualified ACK behavior exists only in the test oracle, which is excluded from packaged assets. The existence of a CA does not qualify a phone.

## Validation results and limits

- 194/194 top-level host/regression tests PASS: 88 new Courier, 29 mobile, 20 evidence, 54 existing app and three launcher/Edge wrappers. Real Edge IndexedDB suite inside the wrapper: 27/27 PASS. These are local synthetic evidence, not phone SQLite durability.
- Final post-test-target Courier rerun: 88/88 PASS. Native grammar: 12 Java + 12 Swift files PASS, not compiler/type/link validation.
- Capacitor Android/iOS asset sync PASS. No new dependencies. npm audit: zero vulnerabilities.
- Actual iOS C extractor host compilation/selftests and OpenSSL certificate verification PASS as detailed above.
- Xcode project parser and hosted test-target dependency/source/resource registration checks PASS. Shared CourierNativeTests scheme bundles public fixtures. Nine XCTest cases and eleven Android instrumentation cases are present, but NOT executed.
- Android SDK/JDK/Gradle build was not run: no installed Java/JDK/Android SDK discovered. iOS build/tests require owner Mac/Xcode. No phone/platform qualification claimed.
- Final git diff --check and changed-text whitespace scan PASS. Firmware remains clean at the exact pinned HEAD and branch. App remains at the original HEAD with 14 modified and 27 new files (41 total), all unstaged. Tracked diff: 243 insertions/16 deletions; new files are listed below and are not included in that tracked-only statistic.

Host oracle tests exercise modeled state/transport behavior backed by host SQLite. Source/static cases inspect native implementation; they are not native execution. TLS oracle tests validate the public fixture on the host, not URLSession/Android handshakes. Native Apple Security and Android permission/routing behavior remain owner-run gates.

## G1-G80 coverage

| Gate | Evidence | Result/method |
| --- | --- | --- |
| G1 | pairing exact contract oracle | PASS: host model/oracle |
| G2 | pairing duplicate and unknown keys | PASS: host model/oracle |
| G3 | token canonical unused bits | PASS: host model/oracle |
| G4 | pin lowercase exact length | PASS: host model/oracle |
| G5 | actual JS bridge rejects secret reply | PASS: executed JS bridge |
| G6 | source: opaque pairing reference stored durably | PASS: source/static |
| G7 | source device binding | PASS: host model/oracle |
| G8 | plaintext fails closed | PASS: host model/oracle |
| G9 | redirect fails closed | PASS: host model/oracle |
| G10 | source: Authorization native only | PASS: source/static |
| G11 | source: no secret logging | PASS: source/static |
| G12 | source: no cookies or caches | PASS: source/static |
| G13 | approved certificate chain and time | PASS: host model/oracle |
| G14 | exact leaf SPKI pin | PASS: host model/oracle |
| G15 | mismatched pin denied | PASS: host model/oracle |
| G16 | untrusted anchor denied | PASS: host model/oracle |
| G17 | IP SAN mismatch denied | PASS: host model/oracle |
| G18 | schema/type mismatch | PASS: host model/oracle |
| G19 | enumeration source mismatch | PASS: host model/oracle |
| G20 | bounded eight-entry pagination | PASS: host model/oracle |
| G21 | stale cursor discards snapshot only | PASS: host model/oracle |
| G22 | detail binds exact ETag | PASS: host model/oracle |
| G23 | list null hashes | PASS: host model/oracle |
| G24 | detail hashes nonnull | PASS: host model/oracle |
| G25 | full uint64 decimal strings preserved | PASS: host model/oracle |
| G26 | automatic COMPLETE | PASS: host model/oracle |
| G27 | automatic INCOMPLETE | PASS: host model/oracle |
| G28 | provisional is owner-only | PASS: host model/oracle |
| G29 | corrupt is forensic owner-only | PASS: host model/oracle |
| G30 | qualified open/active never automatic | PASS: host model/oracle |
| G31 | first range exactly 16384 | PASS: host model/oracle |
| G32 | final range exact remaining bytes | PASS: host model/oracle |
| G33 | range rejects content-range | PASS: host model/oracle |
| G34 | range rejects content-length | PASS: host model/oracle |
| G35 | range rejects etag | PASS: host model/oracle |
| G36 | actual transport bridge rejects raw range bytes | PASS: executed JS bridge |
| G37 | source: direct native SQLite BLOB path | PASS: source/static |
| G38 | loss before commit repeats range | PASS: host model/oracle |
| G39 | resume from committed offset | PASS: host model/oracle |
| G40 | reopened process-like store resumes bytes | PASS: host model/oracle |
| G41 | changed physical identity preserves old staging | PASS: host model/oracle |
| G42 | 412 conflict has no outbox | PASS: host model/oracle |
| G43 | reopened evidence full SHA | PASS: host model/oracle |
| G44 | header/session mismatch never imports | PASS: host model/oracle |
| G45 | metadata SHA mismatch never imports | PASS: host model/oracle |
| G46 | integrity-2 torn tail remains exact bytes | PASS: host model/oracle |
| G47 | integrity-3 forensic bytes preserved in explicit test owner mode | PASS: host model/oracle |
| G48 | import follows full validation | PASS: host model/oracle |
| G49 | import rehash precedes pending | PASS: host model/oracle |
| G50 | pending durable before network ACK | PASS: host model/oracle |
| G51 | actual JS retry cannot forward arbitrary identity | PASS: executed JS bridge |
| G52 | mock ACK generated from durable outbox | PASS: host model/oracle |
| G53 | unqualified denies ACK before request | PASS: host model/oracle |
| G54 | explicit test qualification exercises mock ACK only | PASS: host model/oracle |
| G55 | validated exact ACK becomes ACKED | PASS: host model/oracle |
| G56 | duplicate ACK becomes ACKED | PASS: host model/oracle |
| G57 | duplicate retry creates no duplicate import | PASS: host model/oracle |
| G58 | lost response retains unknown outcome | PASS: host model/oracle |
| G59 | lost ACK retry reconciles same identity | PASS: host model/oracle |
| G60 | INVALID_TOKEN retains evidence and outbox | PASS: host model/oracle |
| G61 | TOKEN_REVOKED retains evidence and outbox | PASS: host model/oracle |
| G62 | 503 model records required one-second waits | PASS: host model/oracle |
| G63 | 503 foreground budget is bounded | PASS: host model/oracle |
| G64 | background retains staging | PASS: host model/oracle |
| G65 | background never starts ACK | PASS: host model/oracle |
| G66 | cancel retains committed chunk | PASS: host model/oracle |
| G67 | new metadata identity conflict preserved | PASS: host model/oracle |
| G68 | SQLite quota/write error never creates outbox | PASS: host model/oracle |
| G69 | storage gate denied creates no pending ACK | PASS: host model/oracle |
| G70 | owner qualification remains empty | PASS: source/static |
| G71 | source: normal native full ACK gate false | PASS: source/static |
| G72 | firmware clean and pinned | PASS: source/static |
| G76 | source: network body independent of Flight length | PASS: source/static |
| G77 | source: range buffer caps | PASS: source/static |
| G78 | production assets exclude test secrets and oracle | PASS: source/static |
| G79 | source: no HTTP fallback | PASS: source/static |
| G80 | source: explicit trust only, no permissive verifier | PASS: source/static |

| G73 | Existing evidence/parser and mobile foundation suites | PASS: 20 + 29 executed host cases |
| G74 | Existing real Edge IndexedDB suite | PASS: 27 executed cases, synthetic local data |
| G75 | Existing app regression suites | PASS: 54 executed cases |

## Changed files

- android/app/src/androidTest/assets/dev-server-public.pem
- android/app/src/androidTest/java/is/huginn/foundation/dev/CourierNativeContractTest.java
- android/app/src/main/java/is/huginn/foundation/dev/CourierContract.java
- android/app/src/main/java/is/huginn/foundation/dev/CourierDer.java
- android/app/src/main/java/is/huginn/foundation/dev/CourierErrors.java
- android/app/src/main/java/is/huginn/foundation/dev/CourierHttps.java
- android/app/src/main/java/is/huginn/foundation/dev/CourierNetwork.java
- android/app/src/main/java/is/huginn/foundation/dev/CourierQualification.java
- flight-courier.mjs
- ios/App/App.xcodeproj/xcshareddata/xcschemes/CourierNativeTests.xcscheme
- ios/App/App/Courier-Bridging-Header.h
- ios/App/App/CourierHTTPS.swift
- ios/App/App/CourierNetwork.swift
- ios/App/App/CourierQualification.swift
- ios/App/App/CourierSPKI.c
- ios/App/App/CourierSPKI.h
- ios/App/App/CourierWire.swift
- mobile/trust/dev/huginn_dev_root_ca.cer
- mobile/trust/dev/huginn_dev_root_ca_cert.pem
- mobile/trust/profiles.json
- scripts/check-courier-native-syntax.mjs
- tests/courier-network-model.mjs
- tests/fixtures/tls/dev-server-public.pem
- tests/flight-courier.test.mjs
- tests/native/CourierNativeTrustTests.swift
- tests/native/spki_probe.c
- .gitignore
- android/app/src/main/AndroidManifest.xml
- android/app/src/main/java/is/huginn/foundation/dev/CourierCredentials.java
- android/app/src/main/java/is/huginn/foundation/dev/CourierStore.java
- android/app/src/main/java/is/huginn/foundation/dev/FlightCourierPlugin.java
- ios/App/App.xcodeproj/project.pbxproj
- ios/App/App/CourierCredentials.swift
- ios/App/App/CourierStore.swift
- ios/App/App/FlightCourierPlugin.swift
- ios/App/App/Info.plist
- mobile/entry.mjs
- mobile/schema.sql
- package.json
- scripts/mobile-assets.mjs
- mobile/SLICE_3G_REVIEW.md

## Remaining owner gates

Slice 3H: native camera/manual pairing and repair UI, explicit forensic/version selection, permission UX and progress presentation. Production PKI provisioning is a separate release gate. Slice 3I: Android/iOS compiler and native test execution, native CA/SAN/SPKI failures, real phone AP routing with cellular default, local-network permission refusal, durable storage/restart/power-loss/locking/quota behavior and owner-qualified build records. Only after separate authorization and full native qualification may a real-device ACK/HFM change be tested.
