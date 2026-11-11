# Diagnostic candidate deployment review — 2026-11-03

## Published with Egill's explicit authorization — 2026-11-03

Production deployment **34652dba-8307-4daf-82bc-a025545e3235** now serves exact reviewed candidate **2f894e47c73920ab** at https://huginnapp-pwa-test.pages.dev. Immutable URL: https://34652dba.huginnapp-pwa-test.pages.dev. No rebuild occurred. Exact 32-file inventory was rechecked before upload; original and final candidate bytes remain unchanged. The preparation text below is retained historically; its pending/authentication-blocked statements no longer describe current status.

Authentication: existing Wrangler 4.149.0 `whoami` succeeded using the existing OAuth account and Pages permission. Process, User and Machine credential-override names were checked without values; none were present. No project .env/.dev.vars/Wrangler config files were found in the root check. Stored OAuth/refresh credentials were present, and expiry after the check was 2026-11-03T19:43:19.890Z. Authenticated project/domains/deployment GETs subsequently succeeded. The prior raw-token GET did not perform Wrangler's OAuth refresh handling; stale/expired OAuth is consistent with the sequence, but the previous token's expiry was not retained, so it is not proved as the sole cause. No interactive login, token creation, account switch, scope expansion, credential deletion or manual override change was needed or performed. Existing broad scopes were reported, not expanded. Credential values were not printed or retained in evidence.

Before upload, API confirmed account/project, production main branch, no custom domains, canonical deployment aaa7d0d7-7454-4e0b-aae8-7e1b13340f20 and the older retained rollback. Prewrite receipts are preserved in build/settings-read-diagnostics-review/published-20261103/before-*.json. Upload used the exact reviewed command below once; Wrangler uploaded nine changed files, reused 22 and processed _headers.

GET-only verification at **2026-11-03T18:44:33Z** confirmed successful production API identity, exact candidate build.json at canonical and new immutable URLs, every public manifest asset hash (30), JavaScript MIME, CSP, Settings/diagnostic modules, worker, manifest and icons. _headers is the nonpublic control input. Immediate rollback aaa7d0d7-7454-4e0b-aae8-7e1b13340f20 / 99272816b3082d1a remains in Cloudflare, its public manifest matches the retained local candidate and every local hash matches. Older rollback 9775164c-2e37-438a-8c1b-c31b47ebeac1 also remains successful in the API. Neither was deleted. Receipt: [deployed-verification.json](build/settings-read-diagnostics-review/published-20261103/deployed-verification.json).

Public deployment success does not prove installed-phone activation, device TLS reachability or settings success. Use the phone steps below now; they no longer require waiting for deployment. No browser storage, flight files, device settings, firmware, COM port or Muninn data was accessed. No build/flash/reset, commit or push occurred. Further REC investigation remains paused; COM10 untouched.

**Prepared, not deployed. Requires Egill's authorization for candidate `2f894e47c73920ab`.** No app rebuild or runtime source change was made in this review. REC investigation is paused; COM10 was untouched. Owner reports both boards now run Rev. 2.2 and COM10 MAIN/REC WAIT are normal; flight validation remains pending weather.

## Frozen artifact and checks

Exact upload directory: `C:/HuginnAPP/build/settings-read-diagnostics-review/candidate-2f894e47c73920ab`.

Exactly 32 files: 31 manifest-listed inputs plus `build.json`. Build ID `2f894e47c73920ab`; SHA256(build.json) `9dbdaeb7514cd40ef0a13d99616d18207754a4e0e6b6d27575517fff9ad5cbcd`.

All file sizes/SHA256s, exact inventory, build stamps and preservation comparisons were checked again. Full inventory: [candidate-verification.json](build/settings-read-diagnostics-review/deployment-review-20261103/candidate-verification.json). The frozen bytes match `dist/pwa` used by the diagnostic tests. The original preparation receipt and test log remain unchanged.

Recorded focused results: 109 passed, zero failed; original log SHA256 `5f97cb6ba121c33a7c2f7217bba055877f3c622c7c21fa139412eff61b000143`. The retained log is UTF-16LE; the new verifier handles its actual encoding. Rerun in this review: eight diagnostic tests passed, covering fetch rejection, response-stream failure, UTF-8, JSON, response-processing TypeError, HTTP status, invalid schema and old c0 error conflation, including credential redaction. Rerun output: [diagnostic-tests.log](build/settings-read-diagnostics-review/deployment-review-20261103/diagnostic-tests.log). The 109-test suite was not rerun here; its recorded results and matching candidate distribution were verified. These are host/fixture checks, not phone/device validation.

Compared with deployed 99272816b3082d1a, eight manifest-listed assets differ: settings-v2.mjs, settings.mjs, settings-ui.mjs, download-diagnostics.mjs, index.html, entry.mjs, source.mjs and sw.js; build.json also changes. These are the already-prepared retrieval/guidance/diagnostic changes, not new changes made today. The exact Icelandic retrieval failure is **Ekki tókst að sækja gögn**, with a separate diagnostic. Settings HTTP 409 preserves recognized firmware errors rather than blanket SOURCE_CHANGED. GET failures are not save failures.

Adapter, flight-storage, fixture files/catalogue, manifest identity and all accepted icons remain byte-identical to deployed build. Existing storage schema, offline update/recovery, connection guards, protected-time exclusion and NO-ACK semantics are retained. No owner storage or recording was accessed. No firmware/Muninn change, build, flash, reset, device settings write, deployment, commit or push occurred.

## Live checks and access limitation

Normal-TLS public GETs at **2026-11-03T12:55:51Z** verified:

- Canonical origin `https://huginnapp-pwa-test.pages.dev` serves build **99272816b3082d1a**.
- Canonical build.json is byte-identical to retained immutable URL `https://aaa7d0d7.huginnapp-pwa-test.pages.dev`; SHA256 `c0428b6d5ca1bf64fb3b601aec8507a7ce2d308f1dd585e17ab67918639b7503`.
- All 30 public manifest assets hash-match, including Settings modules, manifest, worker and icons. `_headers` is a Pages control input, not a served asset.
- Diagnostic candidate is not publicly deployed.

Existing Wrangler OAuth was tried for an authenticated project GET. **HTTP 401 / Cloudflare code 10000 / “Authentication error”.** No login, refresh, credential replacement or other authentication change was attempted. Current API deployment identity, domain configuration and account permissions therefore could not be freshly verified. The retained production deployment identity is `aaa7d0d7-7454-4e0b-aae8-7e1b13340f20`; matching public immutable bytes are verified today, but do not prove today's API alias identity. Existing credentials were neither printed nor copied into evidence. The initial sandbox network denial was bypassed only for authorized read-only HTTPS checks; the subsequent 401 came from Cloudflare. No approval rejection occurred.

Public receipt: [public-verification.json](build/settings-read-diagnostics-review/deployment-review-20261103/public-verification.json).

## Rollback and destination

Retain current last-confirmed deployment `aaa7d0d7-7454-4e0b-aae8-7e1b13340f20` / build 99272816b3082d1a and its frozen local candidate/deployment evidence. Also retain prior rollback `9775164c-2e37-438a-8c1b-c31b47ebeac1` / build 8eaf91dd9489b3cf. Its immutable public manifest and every locally retained rollback asset/control hash were reverified. API presence cannot currently be confirmed because of the 401. Nothing was deleted or rolled back. Offline phones require their normal worker update flow even after a server rollback.

Intended destination, unchanged from reviewed deployment: account `afc733ae88054c22d7214b083132bfbc`, Pages project `huginnapp-pwa-test`, production branch `main`, stable AppOrigin `https://huginnapp-pwa-test.pages.dev`. No dashboard URL, local TLS setup or new install origin.

After separate owner authorization, recheck the artifact without rebuilding:

```powershell
Set-Location C:/HuginnAPP
node scripts/review-diagnostic-candidate.mjs --offline
```

Exact intended upload command — **not executed; authentication must be resolved before successful upload**:

```powershell
Set-Location C:/HuginnAPP
$env:CLOUDFLARE_ACCOUNT_ID = 'afc733ae88054c22d7214b083132bfbc'
$env:WRANGLER_SEND_METRICS = 'false'
node C:/Users/egill/AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/wrangler/bin/wrangler.js pages deploy C:/HuginnAPP/build/settings-read-diagnostics-review/candidate-2f894e47c73920ab --project-name huginnapp-pwa-test --branch main --commit-dirty=true
```

After an authorized upload, verify API identity when access works, canonical build/asset hashes, manifest/worker/icons and retention of rollback. Do not use the older scripts hard-coded to candidate 99272816b3082d1a as verification of this new candidate.

## Subsequent owner phone diagnostic — only after deployment

1. While online, open the existing installed HuginnAPP at the same canonical origin. Finish operations, disconnect its device session and close other HuginnAPP windows. Use its normal **Uppfæra HuginnAPP** update action when offered; do not clear browser data or uninstall. The current live server still serves the old build, so these steps cannot activate the candidate yet.
2. In **Stillingar (neðst á síðunni) > Tæknilegar upplýsingar > Útgáfa og offline-geymsla**, choose **Endurlesa upplýsingar**. Confirm **App build**, **Controlling Service Worker** and **Active Service Worker** all show `2f894e47c73920ab`, and offline cache is ready. A server build.json alone does not prove phone activation. Verify an offline cold launch before moving to device Wi-Fi; uncached updates require Internet.
3. Use the board currently associated with COM5; the phone connects over Wi-Fi, not the COM port. On its touchscreen open **Connectivity > Flight Courier** and follow existing pairing instructions. In HuginnAPP use **Tengjast HuginnEIS**, existing trust consent/QR scan and **Tengja**. Close Flight Courier and Connectivity without revoking pairing before the settings check. Source inspection says those closes do not stop HTTPS or revoke pairing; actual server health remains unverified. Leave COM10 untouched.
4. Open **Stillingar / Settings > Greining / Diagnostics > Athuga tengingu (aðeins lestur) / Check connection (read only)** once. It requests flight list then settings using GET only, validates the responses in a temporary settings session, and displays JSON with `readOnly:true` and two result entries. It does not preview/apply/save settings, download/delete files, change drafts or write flight storage. Do not press preview/apply or edit fields during this diagnostic.
5. Copy/select the text in that diagnostic JSON panel (or photograph just that panel), and share it with the three build/worker identifiers and whether both device screens were closed. The panel intentionally contains only bounded codes, outcome/operation, safe error class, phase, method, endpoint category, HTTP status, byte count and dispatch flag. It excludes tokens, pairing secrets, raw URLs, response bodies and raw exception messages/stacks. Share no QR/pairing screen, manual pairing JSON, credentials or browser network dump. If the output is empty/blocked, report that observation instead of changing device settings.

Interpret the next physical result precisely:

| Result | What it establishes |
|---|---|
| FETCH_REJECTED, phase fetch, null status | Fetch rejected before exposing an HTTP response. Does not distinguish TLS, CORS, routing or other causes. |
| HTTP status with HTTP_nnn or recognized SETTINGS_* code | A response was exposed. Keep status and recognized firmware code; do not convert every 409 to source switching. |
| RESPONSE_READ_FAILED, phase body | Response stream failed. |
| INVALID_RESPONSE_ENCODING, phase decode | Invalid UTF-8. |
| INVALID_RESPONSE_JSON, phase json | Received UTF-8 was not valid JSON. |
| SETTINGS_* / phase validation after HTTP success | Parsed data failed settings identity/schema validation. |
| RESPONSE_PROCESSING_FAILED or JAVASCRIPT_TYPE_ERROR | Separate JavaScript response-processing/validation fault; not automatically rejected Fetch. |

The original physical settings failure remains unresolved. A trusted public PWA certificate does not establish device HTTPS trust/reachability. Do not infer a firmware defect or change firmware from a generic fetch error. This next step collects read-only evidence; settings persistence/write tests remain outside it.
