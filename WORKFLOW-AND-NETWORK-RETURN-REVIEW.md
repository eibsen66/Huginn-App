# Settings workflow and network-return recovery — 2026-11-06

**Owner-authorized deployment completed:** production **6d03282f-a671-4de1-b83c-159cc87b28f5** now serves **4408c1fe2f4cc02e** at **https://huginnapp-pwa-test.pages.dev**, immutable **https://6d03282f.huginnapp-pwa-test.pages.dev**. All 32 frozen files were rechecked immediately before upload and afterward; no rebuild occurred. GET-only post-publication checks confirm canonical/immutable candidate build.json, all 30 public asset hashes (including entry/settings modules, worker, manifest and icons), JavaScript MIME and effective CSP. `_headers` remains a verified control input rather than a public asset. Installed-phone activation and physical recovery remain unverified.

Retained rollback: **796dd3cf-9ad9-4dca-80db-574976c7630e / acc6cd5e4cb6e49d**, still present with matching immutable manifest. Current account/project/production identity was checked through authenticated Pages GETs before and after publication, superseding the preparation-only identity note below. The initial GET returned HTTP 401/code 10000; existing Wrangler 4.149.0 `whoami` completed normal OAuth refresh, then checks succeeded. No account/permission/login change or credential disclosure occurred. Evidence: `build/workflow-recovery-review/publication/before.json`, `after.json`, and the retained complete rollback copy under that publication directory. Historical FIRMWARE_HEAD remains failed. No owner browser storage, downloaded files, firmware, device settings or COM port was accessed or changed. Preparation references to pending deployment below are historical; the owner procedure is recorded in [iPhone update and acceptance](WORKFLOW-RECOVERY-PHONE-ACCEPTANCE.md).

**Reviewed candidate: `4408c1fe2f4cc02e`, not deployed.** Existing public build remains `acc6cd5e4cb6e49d`. No firmware source/configuration/artifact change, target build, flash, reset, COM access, deployment or physical Settings write occurred. No new physical test is requested by this handoff.

## Owner correction and limits

The owner confirms that the selected brightness value was the value observed after confirmation. The earlier 95-versus-90 account was a recollection error and is withdrawn. **No numeric conversion or brightness mismatch was investigated or inferred.** Synthetic tests use valid edits solely to exercise state transitions.

The owner's exact Preview-click sequence is unknown. Apply being disabled before a successful preview is correct behavior, not itself a demonstrated defect. The screenshot showing Connecting and a disabled Reconnect button does not establish which internal flag was active, how long the attempt ran, or an iOS/radio/TLS cause.

Rev. 2.7 has two previously documented physically successful Settings retrievals; neither proves this new app candidate's physical behavior, device-restart persistence or flight release. The earlier unexplained flight-list 503 remains unresolved and separate.

## Preview / Apply findings and change

Baseline browser reproduction against frozen deployed `acc6cd5e4cb6e49d` confirms **Preview was enabled after loading an unchanged draft**. New UI enablement requires a valid, actually changed draft. `settings-v2.mjs` adds a read-only `hasChanges` getter comparing draft values with authoritative confirmed values; existing request construction, preview validation, apply and readback logic are unchanged.

Verified workflow:

1. Retrieve current settings. With no changes, Preview and Apply remain disabled.
2. A valid changed draft enables **Forskoða breytingar / Preview changes**. Invalid/incomplete drafts cannot preview.
3. A successful, identity-validated preview enables **Staðfesta og vista / Confirm and apply** only for that exact draft, base revision and current connection/session.
4. Another edit invalidates the preview. Apply stays disabled until another successful preview. Obsolete preview/load responses cannot overwrite a newer draft or authorize an old apply.
5. A save is reported confirmed only after matching authoritative readback: response identity/hash/changes, expected configuration revision, returned saved settings, fresh GET values and previewed proposed values must agree. Failure remains unconfirmed; Apply is not automatically retried.

`settings-ui.mjs` adds bilingual guidance immediately beside the controls. Examples:

- **“Veldu Forskoða breytingar næst. Staðfesta og vista verður virkt eftir staðfesta forskoðun.”** / “Choose Preview changes next. Confirm and apply becomes available after a successful preview.”
- **“Forskoðun staðfest. Farðu yfir breytingarnar og veldu Staðfesta og vista þegar þú ert tilbúinn.”** / “Preview confirmed. Review the changes and choose Confirm and apply when ready.”
- **“Forskoðun sendir drög til HuginnEIS til yfirferðar. Ekkert er vistað.”** / “Preview sends the draft to HuginnEIS for review. Nothing is saved.”
- **“Vista má aðeins staðfesta forskoðun. Ný breyting krefst nýrrar forskoðunar.”** / “Only a confirmed preview can be saved. Another edit requires a new preview.”

The same guidance identifies unchanged drafts, invalid/incomplete edits, ongoing operations, uncertain saves and the need for fresh readback/preview after reconnection. No unrelated settings, validation ranges or protected-time rules changed.

## Network A → B → A and backgrounding

The browser fixture dispatches actual visibility/page lifecycle and offline/online events while controlling synthetic reachability and deliberately unresolved Fetch promises. This simulates the app lifecycle around HuginnEIS Wi-Fi → another network → HuginnEIS Wi-Fi; it does **not** switch the laptop's networks or emulate iOS radio/certificate behavior.

**Demonstrated baseline limitation:** after background/foreground transitions, a pending automatic reconnect sets `resuming=true`, and the controls explicitly disable Reconnect for that state. The baseline regression fails on that exact disabled-button assertion. The existing source request timeout was already 20 seconds, including cancellation races for Fetch that ignores AbortSignal. This review does not claim the baseline probe was proven permanently unbounded or that this is the unique cause of the owner's physical failure.

Focused `entry.mjs` correction:

- **Tengjast aftur / Reconnect stays usable during a pending reconnect probe.** Clicking it invalidates the old connection/action generations, pauses failed requests and begins a fresh authenticated GET using still-valid in-memory authorization. Existing fresh-pairing cancellation remains available; a current 401/403 still revokes authorization and offers fresh QR.
- The reconnect operation has a **20-second total deadline**, covering any wait for the previous download task to settle and the subsequent list request. On failure/timeout, cancellation, generation invalidation and busy/resuming cleanup run before recovery is offered. The bound does not force a storage transaction to succeed or allow overlapping unsafe file writes.
- Foreground and persisted **pageshow** recovery replace obsolete pending reconnect attempts. **offline** invalidates the active attempt; **online** prompts an authenticated probe only when not already connected. Online status itself is not treated as device reachability.
- Late replies, including obsolete 401 responses, cannot revoke or replace the newer connection. Only one source/device remains active. No credentials are persisted and no Settings POST is automatically replayed.

Browser JavaScript cannot execute timer callbacks while the OS suspends it. The deadline is enforced when execution runs; foreground recovery/cancelable probes address that lifecycle. No claim is made that a timer fires on an iPhone while its PWA is frozen.

**Additional reproduced draft issue:** suspending while an Apply response was pending discarded the draft because `unconfirmed` was absent from the retained-draft states. The intermediate browser regression failed on lost draft contents. The fix retains those contents in RAM along with their old confirmed baseline, but never retains an Apply authorization or replays the request. After reconnect, fresh device GET is mandatory. Draft restoration requires the existing device/origin/protocol/baseline equality checks; if authoritative values changed, pending values are not overlaid. A new preview is required before any later save. An uncertain earlier save is never described as confirmed merely because its draft was retained.

## Verification actually run

Final focused suite: **102 tests passed, 0 failed**:

```powershell
node scripts/check-workflow-recovery.mjs
```

Evidence: `build/workflow-recovery-review/focused-tests.log`. Two **expected baseline failures** are separately preserved as `baseline-unchanged-preview.log` and `baseline-pending-reconnect.log`; they are not counted as passed tests.

Coverage includes:

- Unchanged/valid/invalid drafts, edit → preview → edit → new preview → apply, exact draft identity, late preview and retrieval responses, mismatching authoritative readback and prevention of automatic apply replay.
- Icelandic/English workflow-help rendering, browser button enablement and guidance, RAM draft retention through reconnect and a synthetic pending save, with fresh readback and disabled old Apply.
- Background/foreground A → B → A with unresolved requests, immediate manual recovery, offline/online, persisted pagehide/pageshow, late obsolete 401, timeout cleanup, current authorization expiry and fresh automatic QR pairing.
- Connection-limit timers are accelerated **only inside the disposable browser fixture**, not in product code. The request timeout and outer deadline both remain 20 seconds in the candidate.
- Existing sanitized flight diagnostics, complete Settings response/boundary validation, protected/unknown field rejection, AUX/engine validation, confirmed readback requirements, exact-byte COMPLETE/INCOMPLETE download/resume/export, temporary storage and service-worker/offline recovery, accepted icons and flight classification.

The first preservation run found an older auth-expiry browser fixture trying to Preview an unchanged fresh load; it now makes an explicit valid edit before exercising the same 401 assertion. Its failed log is preserved as `previous-unchanged-preview-assumption.log`. A new test's duplicate lexical declaration was corrected in its fixture. No production guard was weakened. Model save/readback tests use the existing host C fixture, not a physical device or target firmware build.

The historical **FIRMWARE_HEAD** test remains recorded **failed**, expected `2b7323b749e517fabab6134f4d4493ec22bc0b3b`, actual `74f45528a8aece434d9af1b757b18bc8caa8fe45`. It was not changed or reclassified as passing and is excluded from the 102.

## Frozen candidate and preservation

- Exact directory: **C:/HuginnAPP/build/workflow-recovery-review/candidate-4408c1fe2f4cc02e**.
- Exactly **32 files**; file lengths and SHA256 inventory in `build/workflow-recovery-review/candidate-review.json`.
- **SHA256(build.json): `6fb032ce9a69e8d710b00c237c30a2de76f977adbaaf90ecfa46fcd9d942025f`.**
- Functional changes only in `entry.mjs`, `settings-ui.mjs`, `settings-v2.mjs`. HTML and worker changes are generated identity stamps only. All other assets are byte-identical to deployed `acc6cd5e4cb6e49d`, including the actual source transport/TLS/auth guards, QR scanner, app adapter, storage, manifest/install identity, icons, styles, sanitized diagnostic helper and FLG fixtures. NO-ACK remains false for import confirmation.
- Rev. 2.7 retained app SHA256 remains **3e19713449125cf1ec927159e0c280722fc0392733d18cd1b095392fe09be3c4**. A saved-evidence check also confirmed its build receipts/outputs and all current firmware source pins still match. No firmware owner-script provenance was changed.

Canonical and recorded immutable public build.json were GET-checked and still match `acc6cd5e4cb6e49d`. Retain last recorded production deployment **796dd3cf-9ad9-4dca-80db-574976c7630e**, immutable **https://796dd3cf.huginnapp-pwa-test.pages.dev**, plus prior rollback evidence. Its exact 32-file rollback copy is `build/workflow-recovery-review/rollback-acc6cd5e4cb6e49d`. No authenticated Pages API identity re-query or upload was performed in this preparation.

Recheck the frozen candidate without rebuilding:

```powershell
Set-Location C:/HuginnAPP
node scripts/prepare-workflow-recovery.mjs --verify
```

Exact prospective deployment command, **provided only; not authorized or executed by this task**:

```powershell
Set-Location C:/HuginnAPP
$env:CLOUDFLARE_ACCOUNT_ID = 'afc733ae88054c22d7214b083132bfbc'
$env:WRANGLER_SEND_METRICS = 'false'
node C:/Users/egill/AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/wrangler/bin/wrangler.js pages deploy C:/HuginnAPP/build/workflow-recovery-review/candidate-4408c1fe2f4cc02e --project-name huginnapp-pwa-test --branch main --commit-dirty=true
```

This handoff is for candidate review. The owner-confirmed earlier Wi-Fi off/on recovery remains valid evidence for that older lifecycle; the Anunnaki/background/return scenario and this candidate remain physically unverified. No additional phone experiment is requested now. Device-restart persistence has not been verified.
