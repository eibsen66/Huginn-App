# Slice 3B-Mobile owner review record

HUGINN FLIGHT LOG V1 SLICE 3B-MOBILE:
READY FOR OWNER REVIEW

Date: 2026-10-05. Source baseline: HuginnAPP main 4718829. Firmware baseline: huginn-M1.16a-identity-hours 13d50a0, read-only and clean. No staging, commit, push, device request, COM, firmware edit or SD evidence operation.

## Result and limits

Capacitor 8.5.2 exact pins + npm lockfile; static UI preserved. Temporary dev identifier is.huginn.foundation.dev; app 0.1.0/build 1. Android/iOS projects generated and local plugin wired. System SQLite through visible app-local plugin V1; no external SQLite/SQLCipher plugin. Schema V1 has downloads/chunks/flights/ack_outbox/clients, S/E identities, original bounded binary BLOBs, explicit transactions, multiple-version conflict retention. Serialized ownership, DELETE/EXTRA/foreign-key readback, actual committed/reopened binary probe, secure-store and space checks. Local physical storage supports up to 4,294,967,295 bytes; 108-byte wire encoding remains unchanged.

Native credentials: device-only/unlocked iOS Keychain; Android Keystore non-exportable AES/GCM key encrypts token bytes into private no-backup AtomicFile ciphertext. Synthetic fixture writes only; no JS token API. Hardware backing is not assumed. API <28 denies Android unlocked-Keystore qualification.

Native local gate may pass. FULL_ACK_GATE_PASS is always false. Release builds deny synthetic ACK/credential creation; debug builds label outbox and flight states PENDING_SYNTHETIC/ACKED_SYNTHETIC. No network/device trust or phone qualification exists. Both qualification lists remain empty and separate. The complete 14-operation API, schema, effective durability checks and owner sequence are in ../FLIGHT_COURIER_3B.md.

IMPLEMENTED / STATICALLY CHECKED, not platform runtime proven.
ANDROID BUILT: NO (no JDK/javac, Gradle, adb or SDK visible; no installation detour).
IOS BUILD: PENDING OWNER MAC/XCODE (generated source/SPM project only).

## Validation evidence

| Check | Exact result | What it establishes |
|---|---|---|
| node --test tests/flight-mobile.test.mjs | 29/29 | Mock native contract + real host SQLite BLOB/multichunk/rollback/atomic transitions/conflicts/dedup/staging/reopen/pending new-process read/synthetic ACK/opaque credential mocks/gates/no transport/empty manifest; eight frozen vectors included |
| node --test tests/flight-evidence.test.mjs tests/flight-local.test.mjs | 23/23 top-level | 20 unchanged parser/vector checks, two launcher checks and one Edge wrapper |
| Edge wrapper's actual IndexedDB suite | 27/27, Edg/154.0.4258.53 | Preserved real desktop adapter checks; synthetic qualification only |
| npm run test:regression | 54/54 | Existing settings/status/direct receipt/Muninn/UI regression checks |
| native syntax | 5 Java + 7 Swift files parsed, zero syntax errors | Grammar only, not compiler/SDK/link/runtime validation |
| npm run mobile:sync | PASS Android + iOS copy/sync | Generated projects/assets and exact Capacitor SPM version; not compilation |
| npm audit | 0 vulnerabilities | Registry audit of locked npm graph at review time |
| git diff --check | PASS | Tracked whitespace check; untracked text separately scanned |

Syntax tools were isolated temporary packages: java-parser 3.0.1, web-tree-sitter 0.20.8, tree-sitter-wasms 0.1.13. The first parser run printed zero syntax errors then failed in Node V8 WebAssembly background teardown; rerun with --liftoff-only --no-wasm-tier-up exited 0. No JDK, SDK, global package, or project parser dependency was installed. Native method registration and Xcode source membership also pass the host static test.

The npm CLI's xcode transitive uuid 7 audit finding was resolved with exact compatible uuid 11.1.1 override. The xcode parser uses v4(), and project parsing plus Capacitor sync passed after the override. No npm audit force-update was used.

Host SQLite uses Node node:sqlite, not the phone backends. Host credential tests are mocks, not Keychain/Keystore proof. Process restart test opens the committed database in a separate OS process; it is not a simulated phone power cut. Native streaming HFL verifiers require owner compilation and cross-vector runtime proof.

## Preserved source and harness

Unchanged source in this slice: index.html, style.css, app.js; all existing settings/status/receipt/Muninn modules and regression tests; flight-evidence.mjs; tests/fixtures/flight-v1-vectors.json; flight-storage.mjs; the launcher; original flight evidence/fixture/browser/local-host tests. Frozen 108 bytes and original vector bytes were not edited. Desktop adapter's legacy production naming refers only to its old fixed harness origin, never phone authority.

Edited pre-existing dirty work: README.md, .gitignore, FLIGHT_COURIER_3B.md, flight-compatibility.json (explicit desktop scope). Prior useful uncommitted files remain uncommitted. New work consists of package/config/lockfile, mobile modules/schema/model/runner, asset script, native platform scaffold/custom services, and mobile/SQLite tests. The inventory below lists every tracked modification and every untracked file, including prior Slice 3B files.

## No device transport proof

The new Courier bridge has only local operations. Static tests scan native stores/plugins and JS bridge/entry for fetch/XMLHttpRequest/WebSocket/URLSession/HttpURLConnection/OkHttp/device URL/Authorization/production routes; none exists. Fixture runner receives bundled vectors from its caller and has no transport API. CapacitorHttp interception is disabled; no remote server.url. ACK methods are native local synthetic writes behind compile-time debug guards, with no network call or device ACK success. Existing unrelated development settings/status networking is preserved as authorized; this is not a claim that the entire legacy app is offline.

## Owner next steps

1. Review all listed source, temporary identity, backup/protection policy, supported local size and the dependency choice. No signing or store identifier is final.
2. Compile Android with owner-configured JDK/SDK; compile iOS on owner Mac/Xcode with exact SPM 8.5.2. Resolve SDK/type/link issues before treating these as runnable native services. Sign a disposable dev/TestFlight build, never infer build success from this report.
3. Run local native diagnostics, secure-store locked/unlocked tests, private storage/backup checks, and bundled eight-vector WebView/native verification on fresh synthetic installs. Record actual app/OS/model/WebView/SQLite versions and effective DELETE/EXTRA values.
4. Interrupt/reopen each critical transition on iPhone and Samsung: BLOB+offset, import+state, pending+flight status, synthetic success+flight status. Verify quota rollback, conflicts and duplicate E. No physical firmware evidence is involved.
5. Keep mobile qualification empty and full ACK false. Local-network permission, TLS trust, real pairing, QR, discovery, enumeration/download/ACK transport and real phone qualification remain later slices. No permission or network test is authorized/executed in this slice.

## Complete working-tree inventory

2 tracked modifications; 107 untracked files (92 new files in this mobile slice plus 15 preserved earlier untracked files). Nothing staged.

```text
 M .gitignore
 M README.md
?? FLIGHT_COURIER_3B.md
?? android/.gitignore
?? android/app/.gitignore
?? android/app/build.gradle
?? android/app/capacitor.build.gradle
?? android/app/proguard-rules.pro
?? android/app/src/main/AndroidManifest.xml
?? android/app/src/main/java/is/huginn/foundation/dev/CourierCredentials.java
?? android/app/src/main/java/is/huginn/foundation/dev/CourierStore.java
?? android/app/src/main/java/is/huginn/foundation/dev/EvidenceVerifier.java
?? android/app/src/main/java/is/huginn/foundation/dev/FlightCourierPlugin.java
?? android/app/src/main/java/is/huginn/foundation/dev/MainActivity.java
?? android/app/src/main/res/drawable-land-hdpi/splash.png
?? android/app/src/main/res/drawable-land-mdpi/splash.png
?? android/app/src/main/res/drawable-land-xhdpi/splash.png
?? android/app/src/main/res/drawable-land-xxhdpi/splash.png
?? android/app/src/main/res/drawable-land-xxxhdpi/splash.png
?? android/app/src/main/res/drawable-port-hdpi/splash.png
?? android/app/src/main/res/drawable-port-mdpi/splash.png
?? android/app/src/main/res/drawable-port-xhdpi/splash.png
?? android/app/src/main/res/drawable-port-xxhdpi/splash.png
?? android/app/src/main/res/drawable-port-xxxhdpi/splash.png
?? android/app/src/main/res/drawable-v24/ic_launcher_foreground.xml
?? android/app/src/main/res/drawable/ic_launcher_background.xml
?? android/app/src/main/res/drawable/splash.png
?? android/app/src/main/res/layout/activity_main.xml
?? android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml
?? android/app/src/main/res/mipmap-anydpi-v26/ic_launcher_round.xml
?? android/app/src/main/res/mipmap-hdpi/ic_launcher.png
?? android/app/src/main/res/mipmap-hdpi/ic_launcher_foreground.png
?? android/app/src/main/res/mipmap-hdpi/ic_launcher_round.png
?? android/app/src/main/res/mipmap-mdpi/ic_launcher.png
?? android/app/src/main/res/mipmap-mdpi/ic_launcher_foreground.png
?? android/app/src/main/res/mipmap-mdpi/ic_launcher_round.png
?? android/app/src/main/res/mipmap-xhdpi/ic_launcher.png
?? android/app/src/main/res/mipmap-xhdpi/ic_launcher_foreground.png
?? android/app/src/main/res/mipmap-xhdpi/ic_launcher_round.png
?? android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png
?? android/app/src/main/res/mipmap-xxhdpi/ic_launcher_foreground.png
?? android/app/src/main/res/mipmap-xxhdpi/ic_launcher_round.png
?? android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png
?? android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_foreground.png
?? android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_round.png
?? android/app/src/main/res/values/ic_launcher_background.xml
?? android/app/src/main/res/values/strings.xml
?? android/app/src/main/res/values/styles.xml
?? android/app/src/main/res/xml/file_paths.xml
?? android/build.gradle
?? android/capacitor.settings.gradle
?? android/gradle.properties
?? android/gradle/wrapper/gradle-wrapper.jar
?? android/gradle/wrapper/gradle-wrapper.properties
?? android/gradlew
?? android/gradlew.bat
?? android/settings.gradle
?? android/variables.gradle
?? capacitor.config.json
?? flight-compatibility.json
?? flight-evidence.mjs
?? flight-mobile.mjs
?? flight-storage.mjs
?? ios/.gitignore
?? ios/App/App.xcodeproj/project.pbxproj
?? ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/IDEWorkspaceChecks.plist
?? ios/App/App/AppDelegate.swift
?? ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png
?? ios/App/App/Assets.xcassets/AppIcon.appiconset/Contents.json
?? ios/App/App/Assets.xcassets/Contents.json
?? ios/App/App/Assets.xcassets/Splash.imageset/Contents.json
?? ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732-1.png
?? ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732-2.png
?? ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732.png
?? ios/App/App/Base.lproj/LaunchScreen.storyboard
?? ios/App/App/Base.lproj/Main.storyboard
?? ios/App/App/CourierCredentials.swift
?? ios/App/App/CourierStore.swift
?? ios/App/App/CourierViewController.swift
?? ios/App/App/EvidenceVerifier.swift
?? ios/App/App/FlightCourierPlugin.swift
?? ios/App/App/Info.plist
?? ios/App/App/SceneDelegate.swift
?? ios/App/CapApp-SPM/.gitignore
?? ios/App/CapApp-SPM/Package.swift
?? ios/App/CapApp-SPM/README.md
?? ios/App/CapApp-SPM/Sources/CapApp-SPM/CapApp-SPM.swift
?? ios/debug.xcconfig
?? launcher/HuginnAPP.csproj
?? launcher/Program.cs
?? launcher/publish.ps1
?? launcher/test-source-host.ps1
?? mobile/OWNER_REVIEW.md
?? mobile/entry.mjs
?? mobile/fixture-runner.mjs
?? mobile/qualification.json
?? mobile/schema.sql
?? package-lock.json
?? package.json
?? scripts/mobile-assets.mjs
?? tests/fixtures/flight-v1-vectors.json
?? tests/flight-evidence.test.mjs
?? tests/flight-fixtures.mjs
?? tests/flight-local.test.mjs
?? tests/flight-mobile.test.mjs
?? tests/flight-sqlite-host.mjs
?? tests/flight-storage.browser.mjs
?? tests/flight-test-host.mjs
?? tests/generate-flight-vectors.mjs
```

## Preserved artifact hashes (current source)

- flight-evidence.mjs: SHA-256 eb4ae465d93fff7b5153a1a7e9d135c645d8bae90ff266967e917d07e180c510
- tests/fixtures/flight-v1-vectors.json: SHA-256 a02920ce2efce2c825f5eefd33975ee0192c3f7de79242948f8e7193afa95005
- index.html: SHA-256 9a1aae642026232ade5ab43cefc7c54fd199522677ee8e526c7b26eeacf12f7d
- app.js: SHA-256 57a9e7596035cbf387e871f4e86cc602db976feaa0300291b2e65e1e0bce9fff
- style.css: SHA-256 d7cf3455df3b887ffc4c60d962584b3b4a1f99f7615ad507801add6cb0b83476
- flight-storage.mjs: SHA-256 d504768523440a24f2a4b368fa166a7f45a99d27effa680253a17b09514132de
