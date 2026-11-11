# Immediate input feedback and POST preview investigation — 2026-11-06

**Final deployed build: a891e07022384c69**, production **ff580b82-8aed-43b8-9a59-6fa9bdd1911b**, canonical **https://huginnapp-pwa-test.pages.dev**, immutable **https://ff580b82.huginnapp-pwa-test.pages.dev**. All 32 frozen files rechecked before/after upload; canonical/immutable identity and all 30 public asset hashes, MIME and CSP passed. Final evidence: `build/immediate-edit-preview-final/publication/after.json`. The immediately preceding deployment **c3b8348c-ce8f-4cbe-b84e-e680af7a2dae / 9371c1e32e8e0be9** and the earlier **6d03282f-a671-4de1-b83c-159cc87b28f5 / 4408c1fe2f4cc02e** remain retained. The intermediate publication record below is historical, not the current phone update target. Firmware/physical POST status is unchanged.

**Final follow-up candidate reviewed: a891e07022384c69.** The strengthened browser case reproduced an obsolete invalid-boundary marker against intermediate 9371c1e32e8e0be9. The keyed renderer now removes raw/invalid/ticket entries for fields actually removed by a topology change; empty/bad numeric input is also rejected before it can mutate the model, including newly nullable boundary drafts. The final 103-test run passes, with baseline failure proof at `build/immediate-edit-preview-final/baseline-removed-field.log`. One initial edge-case fixture used an unsupported topology value; it was corrected to the actual supported Clear/unconfigured option without weakening the assertion. No firmware or transport policy changed.

Final frozen directory: `C:/HuginnAPP/build/immediate-edit-preview-final/candidate-a891e07022384c69`, 32 files; SHA256(build.json) **46f5502ce29409c0551096476bc833749a3e6b6ce3b922e931d798983530e727**. Source changes remain confined to the Settings UI. `build/immediate-edit-preview-final/candidate-review.json` pins the inventory and final test log. Prior candidate, publication, logs and rollback evidence remain intact. This final correction was reviewed before its separately recorded upload; the intermediate deployment record below is retained historically.

**Published after review and passing checks under Egill's overnight authorization:** **9371c1e32e8e0be9**, production deployment **c3b8348c-ce8f-4cbe-b84e-e680af7a2dae**, canonical **https://huginnapp-pwa-test.pages.dev**, immutable **https://c3b8348c.huginnapp-pwa-test.pages.dev**. All 32 frozen files were rechecked before upload and afterward; no rebuild occurred during upload. Canonical/immutable build.json and all 30 public assets (including Settings module, worker, manifest, icons), JavaScript MIME and effective CSP match. Rollback **6d03282f-a671-4de1-b83c-159cc87b28f5 / 4408c1fe2f4cc02e** remains present with matching immutable manifest and preserved assets. Evidence: `build/immediate-edit-preview-review/publication/before.json` and `after.json`. Initial API HTTP 401/code 10000 was resolved by the existing Wrangler's normal OAuth refresh, without account/permission change or credential disclosure. Public checks do not prove installed-iPhone activation or physical preview success.

Morning handoff and the single next owner procedure: [MORNING-HANDOFF-20261106.md](MORNING-HANDOFF-20261106.md). The physical POST blocker remains; COM5 firmware stays Rev. 2.7 and no physical brightness write or restoration was attempted.

Reviewed app candidate **9371c1e32e8e0be9**, 32 frozen files. The owner has authorized publication after this review and passing checks. No firmware change or new diagnostic-only revision is selected: the physical POST failure mechanism is not yet demonstrated.

## Physical evidence and last confirmed value

Owner-reported latest attempt: app 4408c1fe2f4cc02e, COM5 Rev. 2.7, freshly retrieved brightness **95**, locally edited **80**. Preview POST returned HTTP 200, declaredBytes=29,773, receivedBytes=4,096, RESPONSE_READ_FAILED, phase=body. There was **no matching serial capture**; no older capture is associated with this request. There is no confirmed save of 80; it is a draft. Last confirmed physical observation remains **95, reported by the owner**, not a new agent readback. No physical save or restoration was attempted in this work.

The withdrawn 95-versus-90 recollection is not investigated. This work concerns edit events and incomplete preview transport, not numeric conversion.

## Demonstrated app cause and correction

The active V2 form used `onchange`, so numeric/text edits were not committed to the local draft until blur/change. Using the global asynchronous action wrapper for every keystroke would also temporarily disable controls, risking dropped input/focus. Some structural field changes rebuilt the whole form.

The correction is confined to `pwa/settings-ui.mjs`:

- Numeric/text **input** events update the local model immediately. Checkbox/select input and change events are supported. A matching duplicate change event is ignored so blur cannot unnecessarily invalidate a preview already matching that input.
- Local editing does not run through the network-operation busy lock, send requests, preview automatically or save. Validation and model epoch invalidation still run for every new value. A subsequent valid edit can enable Preview while the field retains focus; Apply remains gated on the existing complete, identity-validated server preview.
- Empty/bad numbers are treated as invalid, not converted to zero. The visible raw value is retained, with per-field invalid status and pending/error feedback. Invalid values cannot preview, including when another field is edited afterward. Raw invalid drafts are retained in RAM with the existing safe-draft baseline checks across reconnection.
- Keyed rows preserve existing field nodes across structural changes instead of replacing the whole form. Active values/caret are not rewritten. Labels, dependency enablement, engine status and proposed descriptor ranges update without detaching the active control. New/removed topology boundary rows are reconciled separately.
- Pending local changes and invalid fields are identified beside the fields and in Icelandic/English feedback. Existing preview/apply hashing, device/source identity, revision, validation and authoritative readback requirements are unchanged. Raw UI edits are cleared only after confirmed apply/readback or the existing session reset rules; nothing is stored as a pairing secret or automatically replayed.

**103 focused tests passed.** A new real-browser fixture covers input without blur, empty/out-of-range numbers, focus and text caret/node identity, a structural engine-name edit, checkbox/select input, duplicate change, invalidation of Apply and successful new preview. Existing preview races, connection lifecycle, protected-time exclusion, full Settings boundary validation, exact-byte download/resume/export, storage pressure, worker/offline recovery, pairing and accepted icon checks also pass. These are host/browser results; actual iPhone keyboard behavior is not claimed verified.

Evidence: `build/immediate-edit-preview-review/focused-tests.log`. Command: `node scripts/check-immediate-editor.mjs`. Initial browser fixture failures were corrected to choose a genuinely changed value and run after its synthetic connection had been restored; no production guards or assertions were weakened. Before-source snapshot: `build/immediate-edit-preview-review/settings-ui.before.mjs`.

## POST source trace and findings

Exact retained firmware: `C:/HuginnEIS/Huginn/Firmware/huginn/main/huginn_settings_v2.inc`.

1. Route/auth/header/body bounds are checked. Preview is POST `/api/v2/settings/preview`, with `j->apply=false`; only the distinct apply route enters `hs2_save`. Preview modifies only the bounded in-RAM preview authorization, not settings/fuel/protected times/recordings.
2. The request body is allocated using **SPIRAM|8BIT**. `httpd_req_recv` fills its explicit length. SHA256 is computed over those bytes. Parse is conditional, but **free(body) is unconditional after parsing**; read/hash/parse error paths free their acquired resources. The parsed `j->input` owns its cJSON data independently of the raw buffer.
3. The owner callback uses PSRAM snapshots and cJSON hooks explicitly allocating in PSRAM. It validates candidate settings, builds complete `proposed` plus changes and digest, and releases temporary base/candidate/before objects. The job, parsed input and response tree remain reference-counted until HTTP completion. The semaphore remains alive until the final job release. No demonstrated use-after-free or POST leak was found.
4. `cJSON_PrintUnformatted` creates a separate response buffer. `strlen` supplies its byte length to `httpd_resp_send`; that buffer remains alive until send returns, then is freed, followed by job release. The request body is not retained as the response. Serializer failure follows an error response path, not acceptance of partial JSON.
5. The HTTPS send path is shared with GET: HTTP response send → local HTTPS wrapper → `esp_mbedtls_write` → dynamic wrapped `mbedtls_ssl_write` → cipher/AES/DMA. TLS writes are at most the configured **4,096 plaintext bytes** per call. The Rev. 2.7 S3 output-only DMA bounce path uses **1,024 bytes**, with its separate descriptor allocation still required. Other bounce/descriptor paths remain possible; prior GET success does not reserve POST headroom.
6. POST adds request receive/decrypt/hash and parsed-input lifetime. The SHA DMA helper has its own bounded internal buffer path and frees it at cleanup; hardware SHA acquisition/release paths were inspected. Dynamic RX/TX buffers use the configured external mbedTLS allocator and are released according to record consumption/output completion. No retained-source evidence proves these changed the physical DMA heap at the failure.
7. **Rev. 2.7's HS2_SEND/HS2_ALLOC request scope is GET-only** (`request->method == HTTP_GET` and top-level `fields`). A POST preview has top-level `proposed`; it does not enter that measurement scope. Empty scoped records for POST would not diagnose or disprove a failure. Generic AES/TLS console errors may still be emitted. No firmware instrumentation change was applied.

The app still has a 131,072-byte Settings limit. A body failing at 4,096 of 29,773 bytes is not demonstrated to hit that limit. The physical trigger remains unknown: a POST-specific eligible-heap allocation failure, another TLS/server failure, and a connection interruption cannot be selected from the phone result alone.

## POST-specific host reproduction — limits explicit

`node protocol/reproduce-post-preview.mjs` used the actual current host owner code to construct **50 complete previews** and one deliberately interrupted preview; **zero apply requests**. The synthetic initial value was 80 and draft 79, distinct from the owner's physical 95/80. Its full preview serialized to **29,751 bytes**, reflecting fixture data, not a recovered physical body. The injected interruption after 4,096 bytes produced POST/HTTP 200/RESPONSE_READ_FAILED/body, preserved the draft, blocked Apply, and left all authoritative host values unchanged. This reproduces client handling, not the physical transport mechanism.

The retained actual AES bounce routine was also exercised with that full POST-sized body: 200 complete response sequences, AES-128/256 CBC/CTR/GCM reference comparisons and authenticated tags, constrained fragmented heap plus descriptor cost, repeated calls and allocation/DMA failure cleanup, under ASan/UBSan. All passed. Hardware/allocator seams are explicit models; these do not recreate the physical POST heap, cipher timing, iPhone connection or firmware HTTP server.

Evidence: `post-host-result.json`, `host-full-preview.json` (synthetic), `post-aes-host.log`, `post-host-pins.json` under `build/immediate-edit-preview-review/`. No reviewed Rev. 2.7 test/evidence input was overwritten.

These results justify the app edit fix and keeping complete-response rejection. They do **not** justify shrinking DMA scratch again, changing allocation preferences/TLS, retries, early freeing of owner data, or claiming POST fixed. No speculative firmware correction or diagnostic-only release was prepared.

## Physical validation blocker

The laptop currently has no pairing authorization supplied to an authenticated host client; the phone's token is intentionally confined to that PWA's memory. Its current Wi-Fi address is on a different subnet, so device routing/trust also has not been established. No device endpoint requests were made without first having a viable authorized test/capture plan. An existing-browser session check was attempted using the computer-use skill; window inspection returned **“Computer Use app approval timed out”**, so no usable laptop PWA authorization was established that way either. This is not an automatic approval rejection or proof that no such tab exists.

Consequently **no serial capture was opened**, no authenticated physical GET/POST/save was performed, and COM5 was not reset or flashed. Starting an otherwise idle capture would not reproduce the missing POST request. Essential owner pairing/access interaction is required before safe autonomous physical requests can proceed; no credentials were recovered from flash/backups or printed. COM10 was not connected or operated.

## Candidate review and preservation

Frozen directory **C:/HuginnAPP/build/immediate-edit-preview-review/candidate-9371c1e32e8e0be9**; **32 files**. SHA256(build.json): **e725b5efc85b3a4a3382e73a0a46bf2ea45c328601b9cc3fd336532c13410ad0**. Inventory/test-log pins: `candidate-review.json` in the parent review folder.

Only settings-ui.mjs has functional asset changes. Entry/HTML/worker differences are build stamps; source transport, model/protocol validation, storage/adapter, manifest, icons, QR/reconnection, styles and fixture files are byte-identical to deployed 4408c1fe2f4cc02e. NO-ACK and protected-time safeguards remain. Retained COM5 Rev. 2.7 image remains SHA256 **3e19713449125cf1ec927159e0c280722fc0392733d18cd1b095392fe09be3c4**; no firmware changes/build/flash. The historical FIRMWARE_HEAD failure remains failed and its guard was not changed or counted passed. REC FAIL remains separate and flight readiness is not claimed.

The focused diff and test results were reviewed before publication under the owner's overnight deployment authorization. Rollback build **4408c1fe2f4cc02e** and deployment **6d03282f-a671-4de1-b83c-159cc87b28f5** must be retained; publication identity and live asset verification are recorded separately after upload.
