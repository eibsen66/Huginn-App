# P2 quota, persistence and concurrent windows — local desktop only

Run:
```powershell
node scripts/pwa-build.mjs
node --test tests/pwa-storage-integrity.test.mjs
node --test --test-concurrency=1 "tests/*.test.mjs"
```

All storage is in a fresh temporary Edge profile and ephemeral 127.0.0.1 origin. New databases use huginn-p2- names. No existing profile, owner database or Cloudflare origin is used; no disk-filling or storage deletion occurs. Synthetic derived fixture identities/CRC/SHA are generated in memory and never published.

Test-only served adapter redirects its storage import to pwa-storage-faults.mjs, which extends the prior recovery subclass and real FlightStorage. The original validation/import/storage algorithms are reused. Quota faults throw DOMException(QuotaExceededError) inside a strict transaction after requests but before completion, causing rollback. Concurrency barriers pause outside active transactions before chunk commit; no production controls/flags are added.

Persistence tests execute the actual production entry.mjs with only its openPwa database name redirected to an isolated test database. Navigator persistence/service-worker capabilities are mocked in that disposable page; the production file is unchanged. Two actual Edge page targets share a disposable origin/database and have separate JS adapter owners. Original recovery tests are unchanged.

| Scenario | Observed result |
|---|---|
| Quota before first chunk commit | PASS: rollback leaves offset 0 and no chunks/imported target. |
| Quota after four committed chunks | PASS: offset 65536 and four chunks retained, no partial import. |
| Quota during publication | PASS: all 64 chunks retained, flight-row/staging-phase transaction rolls back. |
| Quota available again | PASS: reopen/retry writes 64/60/0 missing ranges respectively; exact SHA/CRC/metadata/export/re-import. |
| Control fixtures | PASS: original bytes and persisted flight records unchanged across failures. |
| Persistence granted | PASS: warning retains user-deletion/device-loss caveat; evidence intact. |
| Persistence denied | PASS: independent-copy advice, no data-loss assertion; evidence intact. |
| Persistence unavailable | FAIL after another action: initially disabled button becomes enabled after Verify local. |
| Persistence throws | PASS: Stopped: P2_PERSIST_EXCEPTION; no success claim and evidence intact. |
| Two-window same fixture | PASS for integrity and explicit retry: first succeeds, second NONCONTIGUOUS_RANGE; retry deduplicates, no duplicate publication. No automatic retry/seamless success claim. |
| Two-window different fixtures | PASS: both publish; controls/metadata unchanged. |
| Export while another window imports | PASS: committed control exports unchanged while target import is paused. |
| Reopen both windows | PASS: identical committed flight rows, unique identities, every exported hash/byte matches. |

Production defect (not fixed): pwa/entry.mjs action() re-enables every button/input based solely on app availability, overriding initialize()'s disabled persistence button for missing navigator.storage.persist. The unavailable case therefore fails acceptance after Verify local. A separate approved production correction should preserve capability-specific disabled state after actions. No storage corruption was observed. The test deliberately retains a failing final assertion so this defect cannot be reported as all-pass.

Concurrency remains per-instance busy locking. Same-fixture writes can reject with NONCONTIGUOUS_RANGE when both resume the same offset. Current behavior is fail-closed with manual same-file retry; it does not promise transparent multi-window retries or live UI refresh. Simulated quota does not establish actual browser quota/eviction behavior. No iPhone, power-loss, cloud, native ACK or multi-browser qualification is claimed.

Production build must remain 7ce3de4a1f28cc68 and gate false. The exclusion test checks compiled JS for storage injection markers and rechecks approved P1 fixture hashes. No production assets, deployment settings, qualification lists or runtime modules changed.

Detailed results: ignored build/p2/storage-results.json; full-suite log: ignored build/p2-storage-regressions.log. New files stay uncommitted for owner review. NO-ACK; FULL_ACK_GATE_PASS=false.

2026-10-10 final full run: 271 top-level tests, 270 PASS and 1 FAIL (the unavailable-persistence UI defect). All 269 previously passing tests remained passing, including P1 Edge 11/11 and prior recovery A-J plus publication abort. New production-exclusion test passed. Production build identity remained 7ce3de4a1f28cc68.

## Subsequent persistence-button correction — 2026-10-10

The failed run and defect description above are preserved as historical evidence. A minimal pwa/entry.mjs correction now retains the callable navigator.storage.persist requirement when restoring button state after actions and uses the same requirement during initialization. No storage, parser, export, Service Worker source or qualification changes were made.

The original failing acceptance assertion remains. Additional tests repeat Verify local, Prepare export and supported persistence requests three times in each granted/denied/unavailable/throwing state and check supported import remains enabled. Final full run: 271/271 PASS; unavailable persistence remains disabled after repeated actions. P2 quota/concurrency and original recovery tests pass; desktop P1 Edge checks 11/11 pass. No injection is included in production artifacts. The content-derived build identity changed to 661e500ad4349afc because the production entry file changed; the previous 7ce3de4a1f28cc68 identity and failed result above describe the earlier baseline, not this corrected build.

Log: ignored build/p2-persistence-fix-regressions.log. Correction and new storage tests remain uncommitted; no deployment or physical-phone qualification is claimed.