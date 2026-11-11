# Rev. 2.7 saved physical acceptance — 2026-11-05

**Recorded outcome: two documented physically successful, read-only Settings retrievals.** The second also has an owner-reported valid flight list. These two observations do not establish general/repeated reliability, settings save/persistence, flight-file download acceptance or flight release. The earlier unexplained flight-list 503 remains unresolved; its non-recurrence in the second attempt does not identify its cause. No new firmware revision is prepared.

## Second successful attempt — console-20261105T222534Z

- Exact preserved capture: `C:/HuginnEIS/Evidence/REV2.7-COM5/console-20261105T222534Z`.
- **2,874 raw bytes**, SHA256 **d80d890a95905c49328dec2a4147026538e268d0eeb016b8fffc199eb5e8dca5**, verified against the owner's supplied value and saved summary. JSONL chunk offsets/lengths reconstruct the raw bytes without gaps; status STOPPED.
- Device request **2**, task **1070369752**: serialized=29,502; tls_body_accepted=29,502; https_return=29,502; http_result=0; elapsed=119,677 microseconds. Allocation summary records=0, dropped=0; no failed heap observations. The successful return values, not residual errno=104, determine send success.
- Matching phone screenshot, as reported by the owner: **Settings HTTP 200, declared/received 29,502/29,502, schema-valid**; **flight-list HTTP 200, declared/received 4,234/4,234, valid**. No separate screenshot image file was inspected in this review. The phone observation establishes receipt/validation beyond device plaintext acceptance alone.
- Retained Rev. 2.7 app SHA256 still **3e19713449125cf1ec927159e0c280722fc0392733d18cd1b095392fe09be3c4**, matching the capture intended-image identity. The capture's physical_image_readback flag remains false; no new readback was performed.

The entire raw capture was reviewed. It contains Wi-Fi leave/rejoin events before the successful send, but no flight-list failure branch or evidence resolving the first attempt's 503. The current app diagnostic improvement has separately been deployed as `acc6cd5e4cb6e49d`; the older proposal under "Smallest next step" below is retained as the first review's historical recommendation, not a request to implement it again.

## Read-only owner inspection of the normal editor

Source checked: the deployed candidate's `settings-ui.mjs` is byte-identical to current `pwa/settings-ui.mjs`. **Athuga tengingu (aðeins lestur) / Check connection (read only) does not populate or refresh the editor.** Its handler creates a temporary Settings session, retrieves/validates data and closes that session, displaying diagnostic results only. Any already-visible editor contents remain separate. The owner must press **Sækja núverandi stillingar / Retrieve current settings** to populate the normal editor from a new GET.

1. Keep the working Rev. 2.7 running. Use the existing HuginnAPP connection; if reconnection is needed, use the established Connectivity > Flight Courier pairing workflow. Do not reset or change device settings.
2. In HuginnAPP select the top-level **Stillingar / Settings** tab. Under **Stillingar HuginnEIS / HuginnEIS settings**, press **Sækja núverandi stillingar / Retrieve current settings** once. This is a retrieval, not a save; a previous successful diagnostic does not replace it.
3. Wait for the fields to appear and the normal success text **“Núverandi stillingar sóttar. Engar breytingar vistaðar.” / “Current settings retrieved. No changes saved.”** If retrieval fails, retain the displayed diagnostic and stop this inspection; do not reset or attempt a save.
4. Scroll through **Loftfar / Aircraft**, **Hreyfill / Engine**, then **AUX** within the same Settings page. These are field-group headings, not additional top-level tabs. Inspect displayed values only. Engine parameter groups use expandable controls labelled from the device's parameter names; expand those to inspect their fields, without changing inputs, selections or checkboxes. AUX slot order/unused disabled slots remain as configured; do not enable a sensor just to inspect it.
5. If the app instead says **“Stillingar sóttar aftur og drög endurheimt…” / “Settings retrieved and drafts restored…”**, existing safe drafts have been restored in memory. Displayed fields may then contain pending edits, so do not treat every visible value as confirmed device data. Preserve those drafts, note the message and stop for review rather than discarding them or saving. The retrieval handler preserves drafts only when its source/origin/protocol and baseline checks match; it does not apply them to the device.
6. Stop after inspection. Do **not** press **Forskoða breytingar / Preview changes** or **Staðfesta og vista / Confirm and apply**. Do not edit controls, start a recording or reset. Protected ENGINE TIME/AIRFRAME TIME remain excluded from editable app settings. This stage establishes editor visibility/readback only, not saving or persistence.

Review checks for this update were read-only saved-file/hash checks plus source inspection. Only this acceptance document and its EIS copy were updated; no application/firmware source, scripts, capture bytes, artifact or owner data changed. No deployment, build, flash, reset, COM access or Settings write occurred.

## First successful attempt — evidence verified

- Exact capture: `C:/HuginnEIS/Evidence/REV2.7-COM5/console-20261105T205803Z`.
- All **3,403 raw bytes** verified against SHA256 `a9c3fe07982e813c56e391317a3c775d58e672e0a9bc9c380a4e4f6c9801191a`. JSONL chunk offsets/bytes reconstruct the same raw capture without gaps; status is STOPPED, owner interruption. The saved capture reports no writes/reset/control-line/baud changes.
- Device request 1: serialized=29,502, tls_body_accepted=29,502, https_return=29,502, http_result=0; elapsed=123,872 microseconds. Allocation summary: records=0, dropped=0, matching task=1070369752. No failed heap observation is expected when no output allocation failure was recorded.
- Owner-reported matching phone screenshot: **HTTP 200, declaredBytes=29,502, receivedBytes=29,502, outcome=valid, phase=complete**. This supplies the complete/schema-valid phone receipt missing from device-send evidence alone. The screenshot values were supplied by the owner; no separate image file was inspected in this review.
- Retained app: **1,961,232 bytes**, SHA256 **3e19713449125cf1ec927159e0c280722fc0392733d18cd1b095392fe09be3c4**. All completion-receipt output hashes, successful-build/start receipt links and current source pins match the retained Rev. 2.7 build. The artifact/configuration/ELF/receipts remain in `C:/HuginnEIS/Huginn/Firmware/huginn/build-rev2.7-20261105`; none was replaced or relabeled. Capture intended-image identity matches this hash; its physical_image_readback flag remains false.

The successful send's errno snapshots are 104, but its actual send returns are successful (last TLS return/request 830/830, aggregate HTTPS return 29,502, HTTP result 0). Errno is not a fresh error indication following a successful operation. These snapshots do not turn this success into a demonstrated reset failure or establish where that errno was originally set.

Adjacent saved events: TLS handshakes at uptime 926,362 and 936,019 ms; TLS read error -0x0050 at 949,322 ms (the exact local mbedTLS header names this NET_CONN_RESET); Wi-Fi station leave/rejoin at 957,723/957,811 ms; another handshake at 970,309 ms; Settings send at 987,309–987,433 ms. These earlier network events do not identify the trigger of the flight-list 503. The capture has no timestamped flight-list status, JSON error body or branch log. The initial raw fragment is not a complete boot log and cannot establish SD initialization success/failure.

## Flight-list HTTP 503 — exact source paths

The running PWA's list request is `/api/v1/flights?limit=8` (and optional cursor), in `pwa/source.mjs:86`. It reaches `courier()` in `components/huginn_flight_courier/huginn_flight_courier_http.c`; registration is connected to `huginn_flight_courier_snapshot()` by `main/main.c:21564`. These current sources match the retained build-start pins.

| Explicit list-handler 503 path | Response JSON error | Exact condition |
|---|---|---|
| `huginn_flight_courier_http.c:65–66` | COURIER_BUSY | `calloc` for the bounded snapshot returns NULL. |
| `huginn_flight_courier_http.c:67–72` | SOURCE_ID_UNAVAILABLE | Snapshot cannot obtain an initialized AP MAC, MAC read fails, or MAC is all-zero/multicast (`main.c:21309–21314`). |
| Same snapshot-result branch | COURIER_BUSY | Snapshot reports SD unavailable, recovery pending, or snapshot busy. These different results are deliberately collapsed by the HTTP handler. |
| `huginn_flight_courier_http.c:81–84` | COURIER_BUSY | Allocation of the **16,384-byte** list JSON buffer fails, or `hfc_list_encode()` returns false. |

The snapshot conditions behind the collapsed COURIER_BUSY response are explicit in `main/main.c:21291–21319`:

- `!g_sd_mounted` → HFC_SD_UNAVAILABLE.
- `!g_flight_manifest_ready` before acquiring the owner mutex → HFC_RECOVERY_PENDING.
- Owner mutex is NULL or a **zero-wait** `xSemaphoreTake` fails → HFC_SNAPSHOT_BUSY.
- After acquiring it, manifest readiness is lost or count exceeds 64 → release mutex and HFC_SNAPSHOT_BUSY.
- An invalid manifest filename encountered after copying the snapshot → HFC_SNAPSHOT_BUSY.

`hfc_list_encode()` (`huginn_flight_courier.c:169`) rejects invalid pointers/capacity/count, query limit/ordinal/device identity, invalid row filename/state/integrity/transfer-state, or a formatting failure/output overflow (`add()`, lines 153–158). Query/cursor validation normally rejects earlier with HTTP 400/409, so these encoder guards are not proof of malformed owner data. Failed individual file stat/open/header checks ordinarily change row availability/trust; they are not by themselves the snapshot 503 returns above. Settings admission/UI guards are not the flight-list snapshot conditions.

The authorization helper returns **401/403**, not these 503 responses (`huginn_flight_authorization_http.c:122–137`). Detail/evidence/ACK routes have their own failures and are not the list endpoint under review. No authentication, TLS or Settings scratch change is inferred from a bare 503.

**The retained evidence does not select a 503 branch.** There is no SD/recovery/mutex/allocation/encoder branch diagnostic around this list request. In particular, the successful Settings allocation summary covers that Settings request's scoped AES path; it does not monitor the preceding flight-list snapshot/JSON allocations. It neither proves nor excludes memory pressure in the list handler. A separate 16 KiB ordinary-heap allocation is not the measured 1,600-byte DMA allocation, and no relationship is established here.

## Smallest next step

First obtain the **flight-list response's existing JSON error code**, without changing firmware. If a raw network response was already retained, use that. The currently installed app cannot provide it through another identical generic diagnostic: `pwa/source.mjs` rejects non-2xx flight responses **before reading headers/body**, reporting HTTP_503 and losing the server's error code. A zero received-byte diagnostic from that path would describe bytes the app read, not establish a zero-byte server body.

The smallest proposed implementation step, if no raw response was saved, is an **app-only read-only diagnostic correction** to boundedly read and report the allowlisted flight-list error code, preserving all connection/authentication checks and excluding arbitrary bodies/secrets. It is **not implemented or deployed in this review**. Then one list GET could distinguish SOURCE_ID_UNAVAILABLE from the grouped COURIER_BUSY paths. COURIER_BUSY still would not identify SD/mutex/allocation/encoding by itself; report that remaining ambiguity rather than choosing a cause. Do not prepare a firmware revision merely to retry the same generic 503.

Keep the working Rev. 2.7 artifact and original evidence. No Settings save or new physical operation is needed to record this successful acceptance. Further read-only file-list diagnosis is separate from Settings persistence testing or flight acceptance.

## Review checks and limits

Saved-file verification command actually run: `node protocol/review-rev27-physical.mjs` — PASS. Receipt: `C:/HuginnAPP/build/rev27-physical-acceptance/verification.json`, including original capture/build file hashes. This was hash/receipt/source review, not a new host functional suite or a device experiment. The prior historical FIRMWARE_HEAD test failure remains unchanged and is not reclassified as passed.

No firmware/app source, owner scripts, configuration, recordings or protected state changed. No build, flash, reset, deployment, COM access or Settings write occurred. Only review documentation and the saved-file verifier/receipt were added or updated.
