# Morning handoff — 6 November 2026

**The immediate-edit app fix is deployed. The physical POST-preview failure is not solved.**

| Item | Actual outcome |
|---|---|
| Live app | **a891e07022384c69** at **https://huginnapp-pwa-test.pages.dev**; deployment **ff580b82-8aed-43b8-9a59-6fa9bdd1911b** |
| COM5 firmware | **Unchanged, last owner-confirmed HuginnEIS Rev. 2.7**; no new device readback, build, flash or reset |
| Retained app image | SHA256 **3e19713449125cf1ec927159e0c280722fc0392733d18cd1b095392fe09be3c4**; source/build receipts still match |
| Brightness | Last confirmed physical observation **95**, from the owner's fresh retrieval. **80 is an unconfirmed local draft**, not an established save |
| Physical writes/restoration | **None attempted.** No restoration performed; no uncertain write replayed |
| COM10 | No connection, reset, flash or write; last owner-confirmed revision remains **2.2** |

The demonstrated UI cause was `onchange`: typing did not update the draft until blur. Current V2 numeric/text/checkbox/select controls now handle input immediately, keep raw invalid/empty numeric text, show pending/error states and gate Preview/Apply correctly. Keyed field reuse retains focused nodes and text caret instead of rebuilding the form. This passed browser tests; **actual iPhone keyboard/focus behavior remains unverified**. No automatic preview or save was introduced.

A strengthened final case also reproduced obsolete invalid markers after removing a custom boundary. The final UI prunes only removed-field markers and rejects empty/bad numeric input before model mutation. This follow-up was fully retested and published as **a891e07022384c69**, superseding intermediate 9371c1e32e8e0be9; all intermediate artifacts/logs remain preserved.

**103 tests passed**, including immediate input, invalid/empty fields, preview identity/races/readback, reconnect, QR, protected-time exclusion, full Settings boundaries, exact-byte file resume/export, offline worker/storage recovery and accepted icons. Existing host owner code produced 50 successful full POST previews; an injected 4,096-byte interruption preserved the draft and blocked Apply. Actual retained AES bounce code passed 200 full POST-sized sequences with crypto/reference, constrained-heap/descriptor and sanitizer checks. These are host fixtures, **not reproduction or proof of the physical POST trigger**.

Source review found the raw POST body is freed before sending; cJSON/work buffers use PSRAM and response lifetime spans send completion. The request, response and TLS/DMA path were traced. No demonstrated POST leak, lifetime bug or justified memory-policy correction was found. **Rev. 2.7's detailed send/allocation scope is GET-only**; the latest uncaptured POST must not be associated with older captures. Neither 4,096 received bytes nor GET success establishes which POST allocation/socket condition failed. No new diagnostic-only firmware revision was prepared.

**Physical work stopped at an essential access boundary:** no usable host pairing authorization was established, laptop device routing/trust was not established, and inspecting an existing browser session returned **“Computer Use app approval timed out.”** No authenticated device request or serial capture was started. This was not a firmware/build failure or an automatic approval rejection. Owner pairing/access interaction is needed before autonomous hardware requests can safely continue; no secrets were extracted or logged. The computer-use skill was used only to attempt an existing-session check.

Preserved evidence:

- Review and source trace: `C:/HuginnAPP/IMMEDIATE-EDIT-AND-PREVIEW-REVIEW.md`.
- Final app inventory, 103-test log, baseline regression proof and publication receipts: `C:/HuginnAPP/build/immediate-edit-preview-final/`.
- Synthetic POST results, sanitizer log, source snapshot and intermediate evidence: `C:/HuginnAPP/build/immediate-edit-preview-review/`.
- Retain both rollback deployments **c3b8348c-ce8f-4cbe-b84e-e680af7a2dae / 9371c1e32e8e0be9** and **6d03282f-a671-4de1-b83c-159cc87b28f5 / 4408c1fe2f4cc02e**; no previous deployment/evidence was deleted.
- Original Rev. 2.7 build/artifact and both successful retrieval captures remain under `C:/HuginnEIS/Huginn/Firmware/huginn/build-rev2.7-20261105` and `C:/HuginnEIS/Evidence/REV2.7-COM5/`. The historical unexplained 503, FIRMWARE_HEAD failure and in-flight REC FAIL remain separate/unresolved. No persistence or flight-readiness claim is made.

## One next owner acceptance procedure — input and one captured preview, no save

1. While online, use the existing PWA's normal idle update. Record any unsaved draft first; **do not save it to the device to prepare an update**. Confirm app, active worker and controlling worker all show **a891e07022384c69** under **Stillingar → Ítarlegt → Tæknilegar upplýsingar → Útgáfa og offline-geymsla**. Do not clear data or reinstall.
2. Leave COM5 normally booted on MAIN. Close all other serial readers. Start the existing non-resetting capture in a laptop PowerShell window:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File C:/HuginnEIS/REV2.7-OWNER-CAPTURE.ps1
```

3. **Wait for ARMED before pairing or any device test request.** Note that exact folder. Do not press RESET, power-cycle or open another serial reader while capture is open. Join HuginnEIS Wi-Fi on the phone and use the existing pairing workflow if necessary; then leave MAIN visible on HuginnEIS.
4. In **Stillingar**, press **Sækja núverandi stillingar** and record the newly retrieved brightness. If restored drafts are reported, do not mistake a pending value for authoritative readback; stop and report that state. Otherwise choose a modest valid draft change, e.g. **95 → 94** if the newly retrieved value really is 95. **Keep focus in the numeric field:** pending feedback and Preview availability should update while typing, without a tap elsewhere. Do not alter other settings.
5. Press **Forskoða breytingar once**. Record HTTP status, declared/received bytes, code, phase and whether a complete validated preview enables Apply. **Do not press Staðfesta og vista**, even if it becomes available. A failed preview leaves the value as a local draft and must not enable Apply. Do not retry automatically or change networks during this one attempt.
6. Stop capture with **Ctrl+C**, without resetting. Run the exact **Saved diagnostic command** printed by the capture tool; it already includes **-CaptureFolder** with the actual folder. Share that saved result and the sanitized phone result from this same attempt. Keep raw logs private. GET records may appear; detailed POST records are not expected from current GET-only instrumentation. Adjacent generic AES/TLS errors can distinguish a server allocation/TLS failure from a bare phone-side body error, but may still leave the exact trigger/site unknown.
7. Stop after this one preview. Report the observed initial brightness and explicitly state **no Apply/save performed**. No restoration is required for a preview-only test. If preview succeeds, that is one observed preview success, not proof of the old cause or permission to replay any earlier uncertain write. A controlled save/restore can follow only after successful preview and reliable authoritative readback are established under the existing authorization.
