# Existing Cloudflare Pages deployment preparation — 2026-11-02

**Deployed with Egill's explicit authorization on 2026-11-02.** Production deployment `aaa7d0d7-7454-4e0b-aae8-7e1b13340f20` serves the reviewed build `99272816b3082d1a` at `https://huginnapp-pwa-test.pages.dev`. Immutable URL: `https://aaa7d0d7.huginnapp-pwa-test.pages.dev`. The candidate's exact 32-file inventory and all hashes were rechecked before upload; no rebuild occurred. No firmware build/flash/reset, device settings write, certificate creation, authentication change, commit or push occurred. HuginnEIS source and owner scripts were not changed. No local TLS setup is required for this path.

Post-deployment GET-only verification at 2026-11-02T19:04:34Z confirmed Cloudflare's canonical production identity/status, identical candidate `build.json` at both URLs, and exact hashes for all 30 public assets, including Settings modules with JavaScript MIME, manifest, worker, icons and fixture FLGs. `_headers` is the 31st manifest-listed control input and is not publicly served; the effective public CSP was checked. Candidate bytes remained unchanged after upload. Receipt: `build/pages-deployment-review/deployed-verification.json`.

Rollback deployment `9775164c-2e37-438a-8c1b-c31b47ebeac1` remains present in Cloudflare, its immutable public manifest still matches build `8eaf91dd9489b3cf`, and all locally retained rollback hashes match. No owner's browser storage or recordings were accessed. Public deployment success does not prove installed-phone activation, phone offline behavior or device integration. The pre-deployment discovery/preparation record below is retained as historical evidence.

## Current diagnostic deployment review — 2026-11-03

**Latest authorized publication:** build `eb5241dc6e9995ba`, deployment `c1fc89a1-f365-49a8-ae7b-97b3c0b3c89d`, canonical https://huginnapp-pwa-test.pages.dev. No rebuild; exact 32-file candidate checked before upload, all 30 public asset hashes verified afterward. Three tabs/diagnostics/worker/manifest/icons verified. Prior deployments and rollback hashes retained. See NAVIGATION-AND-SETTINGS-BODY-REVIEW.md publication section and build/navigation-review/publication/after.json. Earlier undeployed/current-build statements below are historical. Physical Settings stream failure remains unresolved.

**Newer local navigation/body candidate, not published:** `eb5241dc6e9995ba`; exact directory build/navigation-review/candidate-eb5241dc6e9995ba, 32 files, manifest SHA256 8a5f6692fdeb890373165689e41e91e6e376cdfb606b02c1872237d118c86dc6. See NAVIGATION-AND-SETTINGS-BODY-REVIEW.md for 91/91 focused checks, screenshots and the unresolved physical body-stream failure. No upload occurred in this navigation task; last published build remains 2f894e47c73920ab.

**Published after Egill's explicit authorization:** exact candidate `2f894e47c73920ab`, deployment `34652dba-8307-4daf-82bc-a025545e3235`, canonical https://huginnapp-pwa-test.pages.dev. Existing Wrangler OAuth succeeded; no interactive login/account/permission change was needed. Canonical/immutable manifests and all 30 public asset hashes/MIME/CSP passed at 18:44:33Z. Previous deployments aaa7d0d7-7454-4e0b-aae8-7e1b13340f20 and 9775164c-2e37-438a-8c1b-c31b47ebeac1 retained. No rebuild. See the publication section in DIAGNOSTIC-DEPLOYMENT-REVIEW.md and build/settings-read-diagnostics-review/published-20261103/deployed-verification.json. Pending/401 text below is historical.

See [DIAGNOSTIC-DEPLOYMENT-REVIEW.md](DIAGNOSTIC-DEPLOYMENT-REVIEW.md) for pending candidate `2f894e47c73920ab`, the exact 32-file/hash recheck, upload command and phone diagnostic steps. No rebuild or deployment occurred. Public HTTPS recheck confirms live build `99272816b3082d1a` and all 30 public asset hashes. Authenticated project GET now returns **HTTP 401 / code 10000 / Authentication error**; current API identity/domain/permission verification remains unavailable. No authentication change was made. Historical deployment evidence is retained.

## Pre-deployment live discovery

Existing cached Wrangler **4.149.0** successfully used the existing OAuth login. Its identity query includes the specified account and Pages write scope. Authenticated read-only Pages GETs succeeded. No login/logout or credential replacement was requested; credential values were neither printed nor saved to project evidence. There is no project Wrangler config selecting an alternative destination; this is the existing direct-upload Pages workflow with explicit project/account/branch.

| Item | Actual Cloudflare result |
|---|---|
| Account | `afc733ae88054c22d7214b083132bfbc` |
| Project | `huginnapp-pwa-test` |
| Production branch | `main` |
| Stable domain returned by API | `huginnapp-pwa-test.pages.dev` |
| Custom domains | None (`/domains` returned an empty list) |
| Stable public URL / intended AppOrigin | `https://huginnapp-pwa-test.pages.dev` |
| Current canonical production deployment | `9775164c-2e37-438a-8c1b-c31b47ebeac1` |
| Immutable deployment URL returned by API | `https://9775164c.huginnapp-pwa-test.pages.dev` |
| Created / deployment status | `2026-10-26T17:48:05.126463Z` / success |
| Deployment source metadata | `cf81c52a2932fb635feb89e652cd4b77a73a2dec`, dirty=true; not a clean-source attestation |
| Actual deployed build | `8eaf91dd9489b3cf` |
| Prepared candidate build | `99272816b3082d1a` |

Read-only project/domain/deployment evidence is in `build/pages-deployment-review/cloudflare-readonly.json`; public response/hash evidence is in `public-review.json`. The first API deployment-list request rejected `per_page=100` with HTTP 400/code 8000024, "Invalid list options provided. Review the `page` or `per_page` parameter." Default pagination succeeded. This was not an authentication/permission failure. The general web retrieval tool could not open this site; direct normal-TLS HTTPS GETs from the host succeeded.

The public root returned HTTP 200 HTML with the expected CSP permitting only self and `https://192.168.4.1` for connections. Public stable and immutable deployment `build.json` bytes matched. All 26 publicly served manifest assets were retrieved and SHA256-matched. Pages does not expose its `_headers` control file as that file; its request returned fallback HTML. The local `pwa/_headers` has exactly the expected published manifest SHA256 and was preserved as the rollback control input. The rollback package now matches every listed hash.

The new Settings implementation is **not currently deployed**: no settings modules in the public manifest, no entry import of `settings-ui.mjs`, and no `settings-v2.mjs` worker entry. HTTP 200 for `/settings-v2.mjs` is fallback HTML (`text/html`), not evidence of the module. The repository's older deployment notes identify earlier owner-tested builds; they are historical and do not identify today's current production deployment.

## Frozen deployment artifact and preservation

Exact upload directory: `C:/HuginnAPP/build/pages-deployment-review/candidate-99272816b3082d1a`.

It contains exactly **32 files**: the rebuilt static manifest's 31 listed files plus `build.json`, with no credentials, firmware files, owner recordings, test harnesses, source repository or private evidence. Every file hash was checked after freezing. `SHA256(build.json)` is `c0428b6d5ca1bf64fb3b601aec8507a7ce2d308f1dd585e17ab67918639b7503`. Receipt: `build/pages-deployment-review/prepared-artifact.json`.

Compared to the public build, all accepted icon PNGs/master, `manifest.webmanifest` (same app identity/start URL/scope), fixture catalogue/FLGs and `flight-storage.mjs` are byte-identical. The PWA adapter retains the same `huginn-pwa-p1-no-ack` IndexedDB name and version 1. No storage clearing, schema migration or owner data edits were performed. The same stable origin retains the installation's storage boundary; the immutable deployment URL is for reference, not a replacement installation origin.

The new Settings modules are present in both the artifact and worker inventory. Device settings/drafts remain connection-bound; device routes/auth and downloaded evidence are not added to the asset cache. NO-ACK remains false for confirmation (`FULL_ACK_GATE_PASS=false`): download/export is not confirmed Muninn import and does not permit source deletion or transferred markers.

## Validation actually run

`node scripts/pwa-build.mjs` rebuilt build `99272816b3082d1a`. The following serial focused run completed successfully with exit code 0 using disposable browser profiles/databases and synthetic files:

```powershell
node --test --test-concurrency=1 --test-reporter=dot tests/pwa-deployment-csp.test.mjs tests/pwa-icons.test.mjs tests/pwa-version-info.test.mjs tests/pwa-settings-browser.test.mjs tests/pwa-storage-integrity.test.mjs tests/pwa-storage-pressure.test.mjs tests/pwa-update-recovery.test.mjs tests/flight-evidence.test.mjs
```

This covers deployment CSP, approved icons, installed-version diagnostics, settings retrieval/edit/apply/failure and >1 MiB flight download/resume, strict IndexedDB integrity/pressure, worker replacement/candidate failure/offline recovery, and FLG evidence parsing. `pages-prepare-artifact.mjs` then checked exact candidate and rollback inventories/hashes and byte-identical preservation boundaries. `pages-verify-artifact.mjs` checks the frozen directory again without rebuilding. These are host/fixture checks, not actual phone/device integration. No app logic or appearance was changed by this deployment-preparation task.

## Reviewed deployment commands — subsequently executed as authorized

Optional final offline artifact verification, before any separately authorized upload:

```powershell
Set-Location C:/HuginnAPP
node scripts/pages-verify-artifact.mjs
```

The following exact reviewed command was executed once after authorization, to the existing project's production branch/stable origin, using the already-installed Wrangler and existing authentication:

```powershell
Set-Location C:/HuginnAPP
$env:CLOUDFLARE_ACCOUNT_ID = 'afc733ae88054c22d7214b083132bfbc'
$env:WRANGLER_SEND_METRICS = 'false'
node C:/Users/egill/AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/wrangler/bin/wrangler.js pages deploy C:/HuginnAPP/build/pages-deployment-review/candidate-99272816b3082d1a --project-name huginnapp-pwa-test --branch main --commit-dirty=true
```

Deployment completed successfully: `aaa7d0d7-7454-4e0b-aae8-7e1b13340f20`. Post-deployment public asset/identity checks passed as recorded above. Deployment success is not proof that an installed phone has activated the update. Do not rerun this deployment command merely to update a phone.

The Rev. 2.2 owner firmware BUILD command with the confirmed, unchanged stable AppOrigin is:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File C:/HuginnEIS/REV2.2-OWNER-BUILD.ps1 -AppOrigin 'https://huginnapp-pwa-test.pages.dev'
```

This firmware command is provided only; it was not executed. No development hostname, local certificate or Cloudflare dashboard URL is used as AppOrigin.

## Rollback reference

Retain deployment **`9775164c-2e37-438a-8c1b-c31b47ebeac1`**, immutable URL `https://9775164c.huginnapp-pwa-test.pages.dev`, public build **`8eaf91dd9489b3cf`**. Do not delete it. Hash-verified asset/control-input copy: `build/pages-deployment-review/rollback-9775164c-2e37-438a-8c1b-c31b47ebeac1`. Cloudflare has not been asked to roll back or delete anything.

A server-side rollback restores what the stable URL serves; it does not instantly replace an already-controlling offline worker. Existing activated workers may require their normal update flow when online. No automatic activated-version rollback or storage restoration is promised. Keep independent verified exports of valuable local flights; do not uninstall or clear website data to update.

## Phone workflow with HuginnEIS Wi-Fi and no Internet

1. After a separately approved deployment, while the phone has Internet, open the **same stable origin** in the existing installed PWA. Complete its normal idle update with other app windows closed and no transfer/import/settings operation in progress. Confirm running app plus active/controlling worker identify `99272816b3082d1a`, and expected shell assets are cached. A successful server `build.json` request alone does not prove this.
2. Preserve existing local flights and independent backups. Verify an offline cold launch before switching networks. An interrupted/failed candidate cache must retain the previous usable worker; host recovery checks passed, but this actual installed-phone update has not been tested.
3. Join the HuginnEIS AP and cold-launch the cached installed PWA. Its browser origin remains `https://huginnapp-pwa-test.pages.dev` even when the public server is unreachable. The cached shell/modules/catalogue allow local UI and stored-flight access without Internet. A new install or uncached update cannot be fetched from Cloudflare on that offline AP.
4. Pair with the one powered HuginnEIS through the existing workflow. Device settings/file requests go directly to `https://192.168.4.1`; Cloudflare is not a proxy and is not required to transfer device files once the shell is cached. Connection credentials are not persisted in the service-worker cache; reconnect/re-pair when required.
5. Independently validate the actual phone's device TLS trust, matching hostname/IP certificate, AP routing/local-network permission, device HTTPS startup and bearer/exact-origin acceptance. A trusted public Pages certificate proves none of those device-endpoint conditions. Physical settings persistence, protected-state retention and real-file/Muninn transfer checks remain the Rev. 2.2 owner acceptance steps.

Discovery established the existing public origin and host TLS reachability; no phone was operated, no device HTTPS request was made, and no physical acceptance step was marked passed.
## Current production — owner-authorized reconnection deployment, 2026-11-05

Canonical `https://huginnapp-pwa-test.pages.dev` now serves **1902bcca0f2edc78**, deployment **c1f0e7c2-f13f-49f5-837c-e5145bf5a625**. Exact frozen artifact uploaded without rebuilding; canonical/immutable build and all 30 public assets verified. Retained previous production **c1fc89a1-f365-49a8-ae7b-97b3c0b3c89d**, build **eb5241dc6e9995ba**, plus hash-verified local rollback assets/control input. See [RECONNECTION-REVIEW.md](RECONNECTION-REVIEW.md) and `build/reconnect-review/publication/after.json`. Historical FIRMWARE_HEAD remains failed with its guard unchanged. Phone activation/reconnection and Settings 409 admission remain physically unverified/unresolved. Earlier deployment records below are historical.

## Current production — owner-authorized automatic pairing deployment, 2026-11-05

Build **271f2c06c31e3889**, deployment **5d7cc058-f4cc-4c2a-ab1a-d64e6b12f8df**, now serves `https://huginnapp-pwa-test.pages.dev`. Exact frozen artifact uploaded without rebuilding; canonical build and all 30 public assets verified, including service worker/manifest/icons. Previous **c1f0e7c2-f13f-49f5-837c-e5145bf5a625 / 1902bcca0f2edc78** remains available for rollback with local hash-verified assets. See PAIRING-SIMPLIFICATION-REVIEW.md and `build/pairing-review/publication/after.json`. FIRMWARE_HEAD remains failed with unchanged guard. Firmware Rev. 2.5 build/installation and physical validation remain pending. Earlier production entries below are historical.

