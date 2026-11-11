# First NO-ACK PWA flight-file transfer slice

Baseline: `main`, `cf81c52a2932fb635feb89e652cd4b77a73a2dec`; initially clean.
This is local APP implementation and simulator evidence, not DEVICE TRANSFER PASS.
No firmware/Muninn source edits, hardware access, native migration, deployment,
commit or push. The installed TEST PWA remains unchanged.

## Implemented path

The selected Add-to-Home-Screen PWA is retained. `pwa/source.mjs` adds the browser
Fetch implementation of the existing native/firmware HFC wire contract; it does
not replace the existing Capacitor adapter. The native bridge cannot be called
from a Home Screen PWA. Both native projects and their qualification records are
unchanged.

Connect to an explicitly selected origin using the existing owner pairing JSON
schema. Pairing input is cleared on submission; no token is persisted, cached,
put in a URL or included in reports. List recordings, explicitly select a file,
download with committed-range progress/cancel, validate, atomically publish,
close/reopen/revalidate, then prepare and save/share the original FLG. Existing
synthetic catalog import remains available and unchanged.

Reused `flight-evidence.mjs` validates the128-byte header,160-byte records,
CRC, sequence/time ordering, classification, full physical SHA256 and108-byte
canonical metadata identity. No HFL/HFM/schema/timestamp rewriting is added.
Reused `FlightStorage` and the PWA NoAckStorage retain the existing database,
strict transactions, chunk hashes, staging/publication and export model. The
shared publication method gains optional cancellation guards with transaction
abort; callers without a signal retain existing behavior. No ACK outbox exists
in the PWA schema, and the source adapter has only GET operations.

States distinguish CONNECTING, DOWNLOADING, INCOMPLETE DOWNLOAD,
VALIDATION FAILED and VERIFIED LOCAL. Staging status survives restart;
interrupted/cancelled work cannot appear in verified listings. Same-evidence
retry validates committed chunks and uses the newly revalidated detail identity.
Changed ETag/range/size/hash/source identity is rejected. Different metadata for
the same source/session retains the original and conflicting staging identity;
it is blocked, never spliced or silently overwritten. PROVISIONAL requires
explicit owner selection and is not Replay eligible. Corrupt downloads cannot
publish as accepted evidence.

Export snapshots unchanged physical bytes including torn tails. UI labels a
browser download as EXPORT REQUESTED / SAVE NOT CONFIRMED; successful Web Share
return still does not establish destination durability. Metadata/provenance
stays separate from FLG. Browser-local verification is not permanent OS storage
or an independent backup. An explicit re-import can prove a saved byte copy.

## Size limits and provenance

| Layer | Current bound |
|---|---|
| Original synthetic catalog/import |1MiB, retained |
| New PWA device download/reopen/export/re-import |8MiB per file |
| Wire response |16KiB range;48KiB JSON;20s request timeout |
| Shared JS validator |No prior independent file ceiling; all PWA entry paths now bounded before allocation |
| Muninn FLG codec/importer/database |1MiB; unchanged |

The8MiB bound covers the approximately5.76MB test recording, not arbitrary
flight duration. Whole-buffer hashing/validation and record objects still use
memory; multi-file accumulated quota, iPhone peak memory and OS retention are
not qualified. No file is truncated to fit Muninn. No unlimited allocation
exception replaces the bounds. Original1MiB fixtures retain their assertions.

| Test bytes | Bytes | Whole physical SHA256 |
|---|---:|---|
| Existing complete.FLG / F000001.FLG |1088|93e7956bc91945a4edae075b01f2fa3fa97f36cb1531d752c706b6f7dde93d5d|
| Existing incomplete.FLG / F000002.FLG |768|1258a8be2cb0201dbb8aa6bed4e2d78e31c574682f8172584177e5950b87646a|
| Saved DEV SD700s FE9123B.FLG |1018048|cb766103e409b344e237eac2f24d60d66e30c1ff7dc1e2cdf72187d3ef28015b|
| Saved DEV SD900s FF94A29.FLG |1427168|1130407540ef7de586faa9de8e1811d7352cd2084002ac38824dedefbc89f98f|
| Existing exact1MiB ceiling fixture |1048576|a665ab60cb630c78316cf0023f4165e2244ae06094f94ad65e6ba9118053fca9|
| Generated large stream |5760928|87966366d5b4a9897530d9fe8c74fccc53e0f73b77e9c60c9f2604b789d97212|

SD files were read from verified owner-saved host copies, not the card/device.
Their hashes match the independent SD700s/SD900s reports. They are DEV synthetic
test recordings, not operational aircraft flights. Simulator metadata was
derived locally using the established contract; it is not evidence of a real
source's authenticated manifest. Synthetic test tokens are unrelated to devices.

The browser-exported SD700s original was saved locally under ignored
`build/no-ack-transfer/exported-FE9123B.FLG` and read by the existing Muninn
importer: INCOMPLETE / ACCEPTED / codec Replay eligible. Exact hash and bytes
match. This is HOST export/import proof, not physical PHONE export/import PASS.
The SD900s original is rejected by Muninn with FILE_SIZE_LIMIT; the APP preserves
and exports it unchanged. All fixture results/hashes are in `results.json`.

## Historical first-slice transport STOP (superseded by approved profile below)

Intended PWA origin: the existing owner-selected installed TEST origin
`https://huginnapp-pwa-test.pages.dev` (no update deployed here).
Existing native device URL is `https://192.168.4.1`; certificate chain and SAN
must be valid and trusted on the actual phone. Existing pairing includes a
TLS SPKI pin. Standard Fetch exposes no peer-certificate/SPKI verification API.
This slice therefore FAILS CLOSED with `PWA_SPKI_TRUST_BLOCKED` for real sources;
it does not silently discard the pin or treat a hash as aircraft authentication.
Only the disposable explicit loopback-test mode can exercise requests. There
is no certificate-verification bypass, cloud proxy or security-disable flag.

The smallest owner decision is to approve a separate browser trust profile:
OS/browser-trusted certificate chain + correct device hostname/IP + explicitly
selected expected device identity + existing bearer pairing, with SPKI not
claimed in the PWA. That decision and actual certificate provisioning require
separate review; it is not enabled by this patch. Native SPKI verification
remains the parallel option and is not activated automatically.

Fetch Authorization/Range/If-Match require CORS preflight. Firmware must allow
exact PWA Origin with `HFC_DEV_ALLOWED_ORIGIN` (empty default denies browser
origins), GET/OPTIONS and the existing request headers, exposing ETag,
Content-Range, Content-Length and Accept-Ranges. PWA static CSP permits only
self and the existing device HTTPS origin. Service Worker caches only the
explicit shell assets, never device requests, pairing material or evidence.
The actual simulator uses two loopback origins, real browser CORS/preflight and
Fetch, not a Node-only model. HTTP loopback secure-context tests do not qualify
phone HTTPS trust, Wi-Fi routing, local-network policy or installed-PWA behavior.

Apple TN3179 distinguishes Safari/WebView traffic from native-app local-network
permissions; do not assume the native permission UI is the PWA's behavior.
Actual iPhone/Android browser/OS versions and any network permission must be
observed on the real setup. Official references:

- https://fetch.spec.whatwg.org/ (Fetch interfaces, TLS and CORS)
- https://developer.apple.com/documentation/technotes/tn3179-understanding-local-network-privacy

## Historical first-slice verification (before this continuation)

New real-browser vertical test:27/27 scenarios PASS. COMPLETE, accepted
INCOMPLETE, torn tail, explicit PROVISIONAL, interruption/restart resume,
cancellation before and during publication, network loss, authentication
refusal/revocation, changed identity/ETag, bad ranges/lengths, wrong hash,
corrupt stream, duplicate/conflict, quota failure, offline database reopening
and exact-byte export were exercised. Source logs contain only GET and
browser-generated OPTIONS; no ACK, completion POST or deletion is generated.
A persistent network fault is injected because a browser may transparently
retry a GET when a socket disappears before response headers.

Relevant existing regressions:295 run,293 PASS,2 FAIL. H60 firmware-clean pin
requires a clean reference tree, and G72 pins obsolete firmware commit
7ef63a95 rather than the owner-approved2b7323b UTC benchmark. These assertions
remain unchanged; the20 protected firmware dirty entries are not cleaned to
make tests pass. This is not an all-green native/Courier qualification claim.
Three isolated recovery test hosts now serve the new source module dependency;
all their original recovery/storage assertions pass. Final focused reruns are
recorded separately and are not added again to the distinct295 total.

Local commands (no deployment):

```powershell
node scripts/pwa-build.mjs
node --test tests/pwa-transfer.test.mjs
```

Evidence: ignored `build/no-ack-transfer/` contains browser results/GET traces,
regression logs, exact exported original and Muninn read-only inspection.
No current public build, native assets or qualification manifest is replaced.

## Minimal later DEV prerequisite and physical next step

The installed LOCAL_RECORDING_ONLY image intentionally registers no Courier
routes. A separately reviewed download-only firmware capability must preserve
recording while permitting authenticated list/detail/range GET and required
OPTIONS only. POST /ack and every transfer-completion mutation must be denied
before dispatch; ACK submission must remain disabled independently of APP
FULL_ACK_GATE_PASS. No deletion capability is required or permitted. Existing
source identity, pairing and Origin/CORS/TLS checks must remain enforced.
Simply setting LOCAL_ONLY OFF is not a safe NO-ACK configuration.

The browser trust-profile decision is now explicitly approved and implemented
as described below. After a verified download-only DEV build and confirmation
of existing phone certificate trust, one practical physical step is to download a saved <=1MiB DEV synthetic FLG into the installed iPhone
PWA, reopen it without the source, export it and compare exact SHA/bytes in
Muninn. No such device test was run here. Larger Muninn imports remain blocked.
Phone-time delivery is PENDING APP INTEGRATION and is not a download prerequisite.

NO-ACK. FULL_ACK_GATE_PASS=false.

## Exact task changes

- `README.md`
- `flight-storage.mjs`
- `pwa/adapter.mjs`
- `pwa/entry.mjs`
- `pwa/index.html`
- `pwa/sw.js`
- `scripts/pwa-build.mjs`
- `scripts/pwa-serve.mjs`
- `tests/pwa-recovery.test.mjs`
- `tests/pwa-storage-integrity.test.mjs`
- `tests/pwa-storage-pressure.test.mjs`
- `NO_ACK_TRANSFER.md`
- `pwa/source.mjs`
- `tests/pwa-transfer.browser.mjs`
- `tests/pwa-transfer.test.mjs`

Final index empty;15 APP status entries, all this slice. Baseline HEAD remains
`cf81c52a2932fb635feb89e652cd4b77a73a2dec`. No commit or deployment.

## Approved browser-profile continuation / 21.10.2026

This continuation reuses the existing Cloudflare TEST project, installed iPhone
PWA and all 15 dirty first-slice files. Baseline file hashes are preserved in
`build/no-ack-transfer/TRUST-CONTINUATION-BASELINE.json`; previous results remain
under their original names, with an additional `FINAL-RESULT-before-trust.json`.
New browser outputs go to `build/no-ack-transfer/browser-os-tls-v1/`.
No public deployment, device query, phone operation or certificate installation occurred.

### Reuse matrix and receipt boundary

| Prior evidence | Reused result / scope |
|---|---|
| `pwa/README.md`, recorded physical P2 section; `tests/PWA_P2_UPDATE.md` | Existing iPhone Home Screen, offline cold launch, power cycle, update with retained records, build/worker diagnostics, three fixture round trips and independent On My iPhone backup/re-import are owner-tested history. Not repeated or counted as new runs. |
| Public TEST build `964ed3fbe71579ba`; deployment `521bfb92-f358-4bf3-8360-41ddbef8aa7d` | Last documented public/owner-tested baseline at `https://huginnapp-pwa-test.pages.dev/`, project `huginnapp-pwa-test`; not replaced. |
| Local first slice `50539cac1ce8be0c`; `build/no-ack-transfer/FINAL-RESULT.json`, `results.json` | Existing local 27-case browser/Fetch/IndexedDB evidence reused and rerun only for changed profile integration; not a public/iPhone build. |
| Owner's earlier successful EIS-to-APP transfer report | Acknowledged. Bounded relevant P1/P2, 3G/3H and first-slice report review did not locate a receipt binding that transfer to a firmware version, transport and this installed PWA. Older native/manual/synthetic evidence does not prove this new PWA HTTPS route. No claim that transfer never occurred. |
| Saved SD700s/SD900s host copies and independent reports | Exact source bytes and hashes reused; no SD access/new recording. Source recordings remain DEV synthetic evidence. |
| `build/no-ack-transfer/muninn-readonly-check.json`, original exported SD700s | Prior HOST browser export and unchanged Muninn inspection reused, not repeated as a phone test. SD900s remains over Muninn's 1 MiB limit. |
| Native SPKI/qualification tests and profiles | Preserved, rerun as affected regressions. No native trust downgrade or qualification change. |
| Approved firmware benchmark `2b7323b749e517fabab6134f4d4493ec22bc0b3b` and tag `huginn-M1.16a-dev-utc-rtc-2026-10-21` | H60/G72 now enforce fixed saved HEAD/tag, exact 20-entry inventory with hashes, empty index and 53 source fingerprints. No accept-current rule or blanket dirty-tree exemption. |

### Exact missing behavior

Owner-authorized `DEV_BROWSER_OS_TLS_V1` is explicitly selectable; default is no
profile. It uses normal OS/browser HTTPS certificate-chain and hostname checks,
not SPKI and not a claim that a particular CA is pinned. The current DEV endpoint
is restricted to `https://192.168.4.1`, consistent with the existing CSP and leaf
SAN. A separately supplied selected-origin snapshot must exactly match before
pairing is parsed or any Authorization header is dispatched. Unknown profiles
fail; native/pin-required profiles fail closed in Fetch with no fallback.

Only the existing authenticated GET list/detail/range contract is exposed.
Redirects are rejected, including unexpected redirected/foreign-origin results.
Bearer data remains in RAM, outside URLs, cache, reports and persistent storage.
401/403 (including server expiry/revocation) invalidates this pairing. Closing,
changing origin/profile or hiding the document aborts work; changed origin/profile
also clears the pairing input and list and requires an explicit new connection.
Server-side token lifetime/reboot revocation remain authoritative; the pairing
schema gains no invented expiry field. Exact source identity, ETag, range,
size/CRC/hash and transaction guards remain. No ACK/completion/delete method exists.

The separate explicit HTTP loopback test hook exercises real cross-origin browser
CORS/Fetch/IndexedDB without claiming HTTPS trust qualification. It cannot enable
HTTP for a device address. Native Android/iOS code and trust manifests are unchanged.
Manifest/start URL/scope, hosting `_headers`/routing and Service Worker activation
policy are unchanged by this continuation; the existing shell includes source.mjs.

### Existing certificate material, no provisioning changes

| Existing public source | Result |
|---|---|
| `mobile/trust/dev/huginn_dev_root_ca_cert.pem` (and existing `.cer`) | Root DER SHA256 `c8e47c813db321f292ef83d087f63620e5f17803de1ab2d26c6551674e247811`; CN Huginn DEV Root CA; valid 31.08.2026 to 28.08.2036. |
| `tests/fixtures/tls/dev-server-public.pem` | Exact same DER as firmware `Huginn/Firmware/huginn/main/dev_https_local/huginn_dev_server_cert.pem`; leaf SHA256 `fb7d402bd7b8ff7066167b170e330712d2313a17b80bcf0967a54a0a3fe0714e`. |
| Leaf signature and identity | Signed by that root; SAN IP 192.168.4.1 / DNS huginn.local; validity 31.08.2026 to 31.08.2027. Existing source material reused. |

Offline public-certificate matching/signature validation is PASS. No private key
was read, certificate generated/rotated/installed or trust store changed. The
bounded receipts do not establish this root's current full trust in the installed
iPhone PWA or actual browser HTTPS/CORS reachability. Those remain a precise
physical check. No TLS-error bypass, custom CA injection or validation-disabled
real TLS test was used.

### Fixed firmware authority and focused negative controls

`tests/fixtures/approved-utc-firmware.json` derives only from independently saved
benchmark `BENCHMARK-MANIFEST.json`, `SOURCE-FINGERPRINTS-AFTER.json` and the UTC
Date DEV Benchmark `BASELINE.json`, not current files. Its normalized-LF SHA256
is pinned in `tests/firmware-reference.mjs`:
`44afa470379ca0c97335946f814db2fce704ca782478d7868750444ff24d6ca8`.
The actual approved firmware matches. Disposable cloned snapshots prove rejection
of protected main source fingerprint, staged index, extra dirty path, changed
retained file, wrong HEAD and wrong tag target. Original firmware/index untouched.

### One later physical sequence and precise prerequisites

Keep the existing 8 MiB transfer / 1 MiB synthetic / 1 MiB Muninn bounds. After a
separately approved update of this SAME public TEST PWA, use its existing update
flow; verify app/control/active worker build identity and retained records without
reinstallation or data clearing. Then, with a separately approved DEV download-only
capability, confirm existing certificate trust and reachability, explicitly choose
DEV_BROWSER_OS_TLS_V1 and pair to the exact DEV origin. Download ONE already
available <=1 MiB SD file from the device's supported manifest, reopen without
the source, export unchanged bytes, compare SHA256 and import in Muninn. Do not
move physical SD data or invent an unsupported namespace to expose a file.

The required DEV prerequisite is existing owner pairing plus authenticated
list/detail/range GET and required OPTIONS with exact allowed PWA Origin and
exposed range/ETag headers. ACK, completion and deletion must be denied BEFORE
dispatch. Current LOCAL_ONLY deliberately registers no Courier routes; merely
turning LOCAL_ONLY off is not acceptable. No firmware changes here. Phone-time
remains PENDING APP INTEGRATION and is not a download prerequisite.

Current continuation test totals/build identity and final Git inventories are
recorded in `build/no-ack-transfer/TRUST-FINAL-RESULT.json`. Prior 293/295 results
above remain historical; do not add their totals to current executions.

Additional/updated continuation files: `pwa/source.mjs`, `pwa/entry.mjs`,
`pwa/index.html`, `tests/pwa-transfer.browser.mjs`, `tests/pwa-transfer.test.mjs`,
`tests/courier-ui.test.mjs`, `tests/flight-courier.test.mjs`,
`tests/firmware-reference.mjs`, `tests/firmware-reference.test.mjs`,
`tests/fixtures/approved-utc-firmware.json`, `tests/pwa-trust.test.mjs`, and this report.
All other prior dirty files retain their pre-continuation hashes.

NO-ACK. FULL_ACK_GATE_PASS=false.

## Selected HUGINN file and reviewed candidate reference / 21.10.2026

This section resolves the two later preparation gaps. It does not change runtime PWA
code, deploy anything, or relabel historical APP323/323 as candidate execution.
Full evidence is under `build/no-ack-transfer/candidate-reference-20261021/`.

### Selected existing original

`C:\Users\egill\Documents\Huginn_SD_Backup\HUGINN\FLIGHT\F578CE0.FLG`

- Physical bytes482528; full SHA256
  `660c8a7cc27b6003cc910518965433e2b6201d1c9c21ae4b90fde8434e0b2693`.
- Session `e08c57360b59396192a40d0200000000`;3015 records; COMPLETE/ACCEPTED.
- Current production H2 scanner: VALID_QUALIFIED, COMPLETE/VERIFIED.
- Unchanged Muninn reader: header CRC, all record CRCs, sequence and monotonic
  timestamp checks PASS; accepted COMPLETE, valid prefix482528, tail0.
- Saved manifest membership and all selected entry fields match the actual scan,
  including end UTC and runtime301000000us. Source/clock/aircraft provenance is
  not established by codec acceptance; this is a historical owner-saved backup.
- Production Courier snapshot/list encoder gives AUTOMATIC / eligible=true,
  page2 position6 with8-entry pages. Both pages were consumed by the browser test.

The FE819CF lead also validates:482688 bytes,3016 records, INCOMPLETE/ACCEPTED,
full SHA256 `999c880ef756d104ca64cba108c7d08b3c4dec5373a965045298a4122a9acd05`.
It is page2 position5. F578CE0 was preferred because it is accepted COMPLETE.
No B0FF1 file was relocated or substituted. Physical card presence and current
live list/detail/evidence remain PENDING.

### Original manifest caveat, proved recovery only on disposable copy

The bounded original HUGINN backup has22 files including16 FLGs. Both saved HFM
slots pass CRC/layout: A generation34 CLEAN, B generation33 DIRTY. Current H2
rejects the whole clean fast path because PEA0ACF and P8EC809 still say128 valid
bytes/0 records while their streams contain3808 valid bytes/23 records. This is
not a CRC error or a defect in the selected COMPLETE entry.

Actual production `huginn_flight_manifest_recover` on a fresh disposable COPY
selects a new CLEAN B generation35; `load_valid` then passes. All16 original FLG
byte hashes remain unchanged. Actual MAIN snapshot and Courier list/cursor code
were compiled as host code with only OS/RTOS/Wi-Fi shims and read-root mapping.
The simulated source MAC is NOT authenticated physical device identity.
Original22 backup files and both original manifests remain byte-identical.
No manual manifest construction/repair, original write or SD action occurred.
`browser/production-manifest-inspection.json` records original and recovered
entries/pages; `muninn-original-inspections.json` records all16 current readers.
F504A16 is CORRUPT/BAD_RECORD_CRC (valid prefix288); provisional files are not
Replay eligible; FF66C88 is accepted INCOMPLETE with80 retained torn-tail bytes.
These are concrete per-file distinctions, not reasons to reject good candidates.

### Exact reviewed firmware authority, separate from historical UTC

Named test reference `DEV_DOWNLOAD_ONLY_20261021` is explicitly selected by H60/G72.
The unchanged historical UTC fixture/default profile and its323/323 result remain
historical. The historical guard intentionally rejects the newer35-entry state.

`tests/fixtures/reviewed-download-only-firmware.json` is derived solely from the
saved reviewed delta, candidate-source archive, artifact/configuration receipts
and historical UTC authority. Its normalized-LF SHA256 is pinned in the helper:
`cd6a5b9742f3183a7d2979c85fa73fa58ee05361ad44d9208e4de981cc73861c`.
It binds HEAD2b7323b749e517fabab6134f4d4493ec22bc0b3b, unchanged benchmark tag and
target, exact20 owner files and hashes, exact15 task files/hashes,59 relevant
source/test fingerprints, full35-entry status, empty index, reviewed receipts,
compile/cache hashes and intended effective configuration.

The exact candidate remains1906560 bytes / full SHA256
`d34225dca31fc864cb18d3521045c9451bc6ce647bb35af741a73295e25ed02f`.
LOCAL_ONLY OFF; explicit download-only ON; QR ON; BENCH/CADENCE/DEV_TEST/OBSERVE/EXPORT_MANUAL_TEST/DI0_BENCH_TEST
OFF; exact PWA Origin. No dynamic accept-current or blanket dirty
exemption exists. Unknown profiles/altered fixture contents fail closed.

Candidate negative controls reject unexpected MAIN/Courier bytes, removal of
ACK-blocking guards, extra dirty/staged content, changed owner bytes, wrong HEAD,
wrong tag/target, image/config changes and altered review authority. Reference
objects are frozen in memory. No firmware/Muninn edits or rebuild occurred.

### Actual final execution and unchanged runtime build

Affected final selection:200/200 Node tests PASS,0 failed/skipped. Included:
15 named-candidate guard cases,7 historical-reference guard cases,20 browser trust
cases, existing Courier/NO-ACK/storage tests and ONE transfer host wrapper.
That wrapper contains28 browser scenarios: the old27 plus this retained file.
Do not add nested28 or old323 to200. The wrapper also executes current production
H2/HFM/pagination and selected browser export -> unchanged Muninn archive/readback.

Selected file exact-byte download, duplicate/re-import, offline reopen and export
PASS. Exported482528 bytes/SHA/session equal the original. Unchanged Muninn codec
accepts COMPLETE; unchanged FlightDatabase archives into a fresh APP test folder,
reopens read-only and returns identical original bytes. No real Muninn database
or app data was touched. This is HOST proof, not phone/device transfer PASS.
`browser/muninn-selected-readback.json` records the exact database and results.
All source calls are GET plus browser CORS OPTIONS; no ACK/completion/deletion.
The generated result's generic provenance label was corrected descriptively for
the retained historical bytes; the pre-correction report is preserved. No assertion,
byte or outcome was changed, and no runtime behavior changed for that label fix.

Canonical runtime source hashes and every existing dist asset still match local
PWA3ecd97ba3e63139f. No PWA build was run. Public TEST964ed3fbe71579ba/deployment
521bfb92-f358-4bf3-8360-41ddbef8aa7d remains untouched. No owner P1/P2 retest.
`FINAL-RESULT.json` records exact task-only APP changes and final preservation.

### One consolidated later physical checklist (preparation only)

1. Separately authorize and install the exact reviewed download-only image using
   established fresh DEV identity/layout/protected backups and independent readback.
2. Update the SAME Cloudflare TEST/installed iPhone PWA through its existing
   non-destructive path; verify build/worker identity and retained records.
3. Verify existing iPhone HTTPS certificate trust, exact DEV origin and fresh
   physical pairing; use DEV_BROWSER_OS_TLS_V1 without a pin-profile downgrade.
4. Read all actual manifest pages and confirm F578CE0 session/size/hash/classification
   through actual detail. Allow normal recorder-owned recovery to finish if needed.
   Historical backup state does not establish current SD state or live enumeration.
5. Download that existing file over authenticated GET/ranges. If absent/different,
   report the difference and stop; never substitute host bytes or move/create files.
6. Reopen locally with the source unavailable.
7. Export exact bytes, compare full SHA256 and validate/import in unchanged Muninn.

This checklist grants no installation, deployment, phone or hardware execution.
NO-ACK. FULL_ACK_GATE_PASS=false.

## Required next work retained from owner: controlled cleanup

This APP-only download correction does not implement either requirement below.

1. **Controlled deletion from HuginnEIS, including corrupt files.** Requires a separate firmware slice with explicit source/filename/session/full physical SHA-256 confirmation, a fresh source-state check excluding active recordings, recorder-owned interruption-safe file/manifest coordination, recovery and backup consideration before deleting the only original. No ACK/default-mutation shortcut, automatic deletion, CRC repair or cosmetic nonworking button.
2. **Phone cleanup after confirmed Muninn SQLite archival.** Reuse Muninn commit and exact-original-byte readback. A future confirmation must bind the precise file, session, physical size and full SHA-256. Share/export dispatch, matching filename or an unverified/self-asserted receipt cannot establish archival. Missing/failed confirmation leaves the phone copy intact. This remains distinct from firmware ACK and EIS deletion; no new cloud/transport framework or Muninn change is part of this slice.

Physical listing on build `6d8b42c97036db17` succeeded; the reported subsequent `OPERATION_FAILED` has no per-stage trace. Its exact physical cause remains unproven. This correction preserves that gap, fixes the demonstrated destructive RAM-session handling on brief hide, and adds secret-free stage/status/offset diagnostics plus a real visible-button retained-file regression. Host success is not physical iPhone download PASS.
