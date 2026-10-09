# HUGINN FLIGHT LOG V1 SLICE 3H

READY FOR OWNER REVIEW

IMPLEMENTED: minimal mobile UI and the native UI seams it needs. Source/static/host/DOM checks pass. No Android/iOS build, real phone qualification, real QR scan or device ACK is claimed.

## Baselines and scope

Started CLEAN: HuginnAPP main at 53d91ee73027c3a327b3f507d98f9d8dcfa020b2. Firmware CLEAN on huginn-M1.16a-identity-hours at 7ef63a95d2f9fe44579bccfc141d2af019691ef4. Firmware remains unchanged. No staging, commit, push, device connection, COM5/COM10/TF-WOW, flash or physical HFM mutation.

app.js and the existing Settings/Protected State/Info/Config/Muninn modules were not edited. The original layout is preserved with one additional Flight Courier section. Courier UI loads only from the packaged mobile entry; the desktop page explains that the packaged app is required. The launcher additions are isolated to synthetic BrowserTests mode.

## UI architecture

Metadata-only courier-ui.mjs owns presentation and bounded orchestration; the accepted flight-courier.mjs retains all six 3G transport operations. New native UI seams are courierPairs, courierPairManual, courierOwnerTransfer and courierLocalList. Pair discovery is persistent after restart and permits device selection. Native local metadata pages contain at most 16 entries (after cursor); Show more supports larger offline histories. SQLite, evidence parsing, raw chunks, credential authority and ACK eligibility stay native. No Flight-length JS/DOM allocation.

The section shows device, paired/unpaired connection state, waiting entries, HFM count/64, capacity warning, gate status, queue, native committed progress and stored-on-phone evidence. HFM count comes from the last successfully enumerated queue; it is unknown before enumeration and is not inferred from local imports. Connection diagnostics show only trust profile and shortened leaf fingerprint. Row diagnostics use an explicit whitelist: session, filename, physical size, reason, shortened metadata hash and manifest generation.

## Pairing and QR

Manual pairing is implemented on Android and iOS using native EditText/UIAlertController secure input, not a DOM text field. Payload is limited to 4096 bytes/characters; the native strict 3G parser remains authoritative. Input is cleared before intake/result delivery and on cancellation. Android disables autofill and protects the dialog window; iOS disables corrections/capitalization and bounds text edits. JS supplies no payload and receives only opaque reference/device/status; discovery returns public trust diagnostics.

The dialog explicitly describes replacement of the credential association and preservation of stored evidence/pending acknowledgements. Existing atomic pairing replacement and secure-store behavior are preserved. Native intake checks foreground state.

QR DEFERRED: no camera/barcode dependency is installed. Android has no current decoder/scanner seam; iOS has no existing camera-scanner integration. A new cross-platform scanner would add permission, privacy, platform integration and owner-build work, so the explicitly allowed manual-first scope was used. No dependency was added; there is no camera permission request. Scan is disabled and explains the manual alternative. Maintenance/support/bundle/privacy audit of a specific scanner must precede any future addition.

## Connection and owner actions

UNPAIRED; PAIRED_OFFLINE; CONNECTING; CONNECTED; REPAIR_REQUIRED; TLS_ERROR; LOCAL_NETWORK_DENIED; DEVICE_MISMATCH. CONNECTED requires successful validated enumeration, not a cached pairing row. Messages are fixed owner-action text; arbitrary native exception/server strings are never rendered.

Native Android SSL/certificate failures report TLS_TRUST; security-policy denial reports LOCAL_NETWORK_DENIED. iOS passively observes an explicit localNetworkDenied path reason and reports it on transport failure. [Apple path reason documentation](https://developer.apple.com/documentation/Network/NWPath/UnsatisfiedReason-swift.enum/localNetworkDenied). A generic outage remains network-unavailable when native denial is not explicitly observed; no permission diagnosis is guessed. Actual permission/routing behavior remains a 3I phone gate.

401 AUTH_REQUIRED/INVALID_TOKEN and 403 TOKEN_REVOKED map to Re-pair required; evidence, staging and outbox are retained. Pair / re-pair is the repair action. Temporary 503/network errors show bounded retry availability; Connect / refresh and row Transfer / resume provide manual retry. Phone-storage errors have a separate storage action message. Cancel retains commits; existing bounded native retries and lifecycle epochs remain authoritative.

## State, identity and time

Technical states remain visible with COMPLETE=Flight complete; INCOMPLETE=Flight incomplete; PROVISIONAL=Unqualified / provisional; CORRUPT=Corrupt evidence; QUALIFIED_OPEN=Active / unavailable. Integrity 1=Verified; 2=Torn tail preserved; 3=Corrupt evidence preserved. Warnings remain after import/ACK.

Runtime uses exact runtime_us decimal input with BigInt division for HH:MM display only; no authority accumulation or rounding. start_utc=0 displays Time unknown. Known time is explicitly labelled UTC. Filename appears only inside diagnostics, never as primary identity. Deterministic session ordering is used; native source/session/identity checks remain authoritative.

Automatic action filters only COMPLETE/INCOMPLETE. PROVISIONAL and CORRUPT invoke a native confirmation after fresh detail. Provisional warns that the recording did not qualify as a Flight. Forensic confirmation warns of corruption and preserving original bytes. Approval is internal to native code and bound to the fresh metadata SHA; download refetches detail and checks the approval against that identity. JS cannot pass an approval flag/hash. QUALIFIED_OPEN/ACTIVE_FLIGHT or ineligible evidence cannot transfer. CORRUPT additionally requires integrity=3 and the frozen forensic reason. Native exact-byte verification/state is unchanged.

## Progress and durable state

Bytes/physical size and percentage come from committed native SQLite offset, not socket receipt. Regressive progress does not roll back UI; failed/uncommitted ranges do not advance it. Resume starts at persisted native offset. Native progress additionally publishes STORED_LOCAL/VERIFYING phases around full validation; these are presentation events, not changes to the staging schema. Coalescing may skip intermediate phase notifications.

DOWNLOADING, STORED_LOCAL, VERIFYING, IMPORTED, ACK_PENDING, ACKED, CONFLICT, SOURCE_CHANGED, REPAIR_REQUIRED and FAILED_RETRYABLE are distinct text. Imported evidence is Stored locally; pending/unknown outcomes are Stored locally - ACK pending. Only local ACKED means Transferred (device ACK accepted). A source queue TRANSFERRED value is explicitly presented as a device report. Automatic transfer does not auto-send ACK.

ACK retry is disabled unless the current native FULL_ACK_GATE_PASS is true after validated enumeration. Native code still independently gates every ACK request. No UI override exists. mobile/qualification.json is unchanged with qualified_builds=[]; normal FULL_ACK_GATE_PASS=false. UI clearly says ACK unavailable until this phone/build is qualified, separately from transfer failure.

SOURCE_CHANGED/conflict keeps old evidence visible and disables transfer/ACK eligibility for that identity; no overwrite, implicit version selection or conflict resolution is implemented. Diagnostics permit status inspection. Native conservative global conflict/qualification rules continue to apply.

## Capacity and offline behavior

0-55 normal; 56-59 WARNING; 60-63 CRITICAL; 64 FULL. Warning text explicitly says Transferring does not free Flight Log capacity. No delete, reclaim, archive or retention control. Imported/staged network evidence metadata is queried locally on launch and remains visible offline, with source device, UTC/unknown time, state, runtime, integrity and ACK status. No cloud or graph/data-analysis feature.

## Responsiveness and accessibility

Phone portrait first; flexible single-column controls, 48px minimum touch controls, wrapping metadata, no normal-use horizontal scroll. Synthetic real Edge DOM checks at 320/390/430 widths PASS. Status uses text, not color alone; section, controls and progress have accessible labels; status/action regions are live; keyboard focus is visible. Native dialog accessibility and actual iPhone/Samsung rendering await owner validation.

Visual inspection of the synthetic 390px phone screenshot: PASS. Artifact: build/3h/courier-phone.png (ignored, synthetic). Native dialogs were not rendered/executed here.

## Tests, audit and build evidence

- 63 new top-level tests PASS: H1-H60 (model/source/static checks), one real Edge DOM wrapper containing 29 PASS cases, one integration with the existing 3G HostCourier/SQLite loss/resume model, and one native bounds/permission-source check.
- All regressions: 88 existing 3G Courier + 29 mobile/storage + 20 evidence + 54 existing app + three launcher/Edge wrappers PASS. Existing embedded Edge IndexedDB: 27/27 PASS.
- Combined final serial run: 257/257 top-level PASS. Both browser suites use frozen localhost port 8768 and must run serially; an initial parallel run collided at that port, then was rerun with --test-concurrency=1.
- Existing 3G oracle integration verifies persisted offset after a lost range, 100% after resume, ACK-pending label and unqualified no-ACK behavior. The host model omits physical size from status, so the test adapter takes it from its persisted metadata; native status already includes it.
- Native grammar: 12 Java + 12 Swift PASS; not compilation, type checking, linkage or device runtime.
- Capacitor Android/iOS asset sync PASS. No dependency additions or lockfile changes. npm audit: zero vulnerabilities.
- Android build NOT RUN: no Java/javac or Android SDK found. iOS build NOT RUN: owner Mac/Xcode required. No native dialog, native permission, real AP routing, secure-store or phone SQLite durability PASS is claimed.
- git diff --check PASS; final changed-text whitespace scan and firmware proof checked at completion.

Privacy evidence: public UI/native result guards reject token/Authorization/secret/raw byte fields and typed arrays; no DOM pairing entry; no HFL range-read/base64/parser API in the UI; fixed diagnostics whitelist; native input clearing; source/static checks plus actual browser secret/XSS-injection rejection. These do not replace 3I native runtime/privacy validation.

## H1-H60 matrix

H56/H57 source checks retain the suites; their actual execution results are the regression counts above. Matrix cases are model/source/static unless the separate Edge DOM suite executes the corresponding presentation/action.

| Gate | Check | Result |
| --- | --- | --- |
| H1 | section exists | PASS |
| H2 | unpaired | PASS |
| H3 | paired offline | PASS |
| H4 | connected after enumeration | PASS |
| H5 | repair required | PASS |
| H6 | TLS error | PASS |
| H7 | device mismatch | PASS |
| H8 | manual pairing native only | PASS |
| H9 | no secret DOM field | PASS |
| H10 | QR deferred no permission request | PASS |
| H11 | COMPLETE label | PASS |
| H12 | INCOMPLETE label | PASS |
| H13 | PROVISIONAL label | PASS |
| H14 | CORRUPT label | PASS |
| H15 | QUALIFIED_OPEN label | PASS |
| H16 | integrity 1 | PASS |
| H17 | integrity 2 | PASS |
| H18 | integrity 3 | PASS |
| H19 | runtime exact display | PASS |
| H20 | unknown UTC | PASS |
| H21 | automatic COMPLETE | PASS |
| H22 | automatic INCOMPLETE | PASS |
| H23 | provisional not auto | PASS |
| H24 | corrupt not auto | PASS |
| H25 | provisional native confirmation | PASS |
| H26 | forensic native confirmation bound identity | PASS |
| H27 | committed offset | PASS |
| H28 | uncommitted bytes do not advance | PASS |
| H29 | resume offset | PASS |
| H30 | stored local distinct | PASS |
| H31 | ACK pending | PASS |
| H32 | ACK accepted | PASS |
| H33 | gate disables ACK | PASS |
| H34 | no gate override control | PASS |
| H35 | 401 repair | PASS |
| H36 | 403 repair | PASS |
| H37 | 503 retry | PASS |
| H38 | conflict | PASS |
| H39 | source changed | PASS |
| H40 | offline native list | PASS |
| H41 | count/64 | PASS |
| H42 | 56 warning | PASS |
| H43 | 60 critical | PASS |
| H44 | 64 full | PASS |
| H45 | no capacity reclaim claim | PASS |
| H46 | no delete control | PASS |
| H47 | source mismatch action | PASS |
| H48 | filename diagnostic only | PASS |
| H49 | no HFL DOM | PASS |
| H50 | diagnostic whitelist | PASS |
| H51 | portrait CSS | PASS |
| H52 | accessible buttons progress | PASS |
| H53 | text states not color alone | PASS |
| H54 | settings orchestration unchanged | PASS |
| H55 | protected state module unchanged | PASS |
| H56 | existing regressions retained | PASS |
| H57 | 3G tests retained | PASS |
| H58 | qualification empty | PASS |
| H59 | native full gate authoritative | PASS |
| H60 | firmware clean pin | PASS |

## Files changed/added

- courier-ui.mjs
- tests/courier-ui.browser.mjs
- tests/courier-ui.test.mjs
- android/app/src/main/java/is/huginn/foundation/dev/CourierErrors.java
- android/app/src/main/java/is/huginn/foundation/dev/CourierHttps.java
- android/app/src/main/java/is/huginn/foundation/dev/CourierNetwork.java
- android/app/src/main/java/is/huginn/foundation/dev/CourierStore.java
- android/app/src/main/java/is/huginn/foundation/dev/FlightCourierPlugin.java
- index.html
- ios/App/App/CourierHTTPS.swift
- ios/App/App/CourierNetwork.swift
- ios/App/App/FlightCourierPlugin.swift
- launcher/Program.cs
- mobile/entry.mjs
- package.json
- scripts/mobile-assets.mjs
- style.css
- tests/flight-test-host.mjs
- mobile/SLICE_3H_REVIEW.md

19 files total: 15 tracked modifications and four new files including this review.

## Git evidence

All implementation changes unstaged; HEAD remains the baseline. Final status:

```text
 M android/app/src/main/java/is/huginn/foundation/dev/CourierErrors.java
 M android/app/src/main/java/is/huginn/foundation/dev/CourierHttps.java
 M android/app/src/main/java/is/huginn/foundation/dev/CourierNetwork.java
 M android/app/src/main/java/is/huginn/foundation/dev/CourierStore.java
 M android/app/src/main/java/is/huginn/foundation/dev/FlightCourierPlugin.java
 M index.html
 M ios/App/App/CourierHTTPS.swift
 M ios/App/App/CourierNetwork.swift
 M ios/App/App/FlightCourierPlugin.swift
 M launcher/Program.cs
 M mobile/entry.mjs
 M package.json
 M scripts/mobile-assets.mjs
 M style.css
 M tests/flight-test-host.mjs
?? courier-ui.mjs
?? mobile/SLICE_3H_REVIEW.md
?? tests/courier-ui.browser.mjs
?? tests/courier-ui.test.mjs
```

Tracked diff statistics (exclude new UI/tests/review):

```text
 .../is/huginn/foundation/dev/CourierErrors.java    |  4 ++--
 .../is/huginn/foundation/dev/CourierHttps.java     |  4 ++--
 .../is/huginn/foundation/dev/CourierNetwork.java   |  9 +++++---
 .../is/huginn/foundation/dev/CourierStore.java     |  1 +
 .../huginn/foundation/dev/FlightCourierPlugin.java |  8 ++++++-
 index.html                                         | 25 ++++++++++++++++++++++
 ios/App/App/CourierHTTPS.swift                     |  7 +++++-
 ios/App/App/CourierNetwork.swift                   |  8 ++++---
 ios/App/App/FlightCourierPlugin.swift              | 19 ++++++++++++++++
 launcher/Program.cs                                |  2 +-
 mobile/entry.mjs                                   |  5 ++++-
 package.json                                       |  3 ++-
 scripts/mobile-assets.mjs                          |  2 +-
 style.css                                          | 15 +++++++++++++
 tests/flight-test-host.mjs                         |  5 +++--
 15 files changed, 99 insertions(+), 18 deletions(-)
```

## Deferred 3I owner validation

Android/iOS compilation and native tests; manual pairing dialogs/cancellation/replacement/input privacy; actual iPhone/Samsung accessibility/portrait layouts; local-network permission allowance/denial and AP routing while cellular is default; native committed progress/lifecycle/resume/storage capacity/conflicts; owner qualification records. QR remains deferred to an audited scanner integration. Conflict resolution, retention/delete/archive and production PKI remain outside this slice. No real-device ACK or HFM change until separately authorized and fully qualified.
