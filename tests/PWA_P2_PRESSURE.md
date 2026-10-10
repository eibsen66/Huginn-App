# P2 storage pressure and backup restoration — desktop synthetic tests

Run node scripts/pwa-build.mjs, then node --test tests/pwa-storage-pressure.test.mjs or the full node --test --test-concurrency=1 "tests/*.test.mjs" suite.

Isolation: new temporary Edge profile, verified initially empty origin databases, ephemeral 127.0.0.1-only server, explicit test resource allowlist and huginn-p2-* database names. Real production parser/storage/adapter/entry are reused with test-server-only storage import and database-name substitutions. Existing P2 tests are unchanged. No production UI controls/flags, disk filling, cloud requests or deployment.

Five bounded navigator.storage.estimate mocks: low (quota 2097152, usage 2097151); near limit (4194304/4190208); unavailable; invalid (string quota/negative usage); throwing. Observed estimate call count is zero in every case: P1 import does not use estimates. These tests verify noninterference and recovery, NOT estimate-warning/error handling or actual browser pressure. Generic archival disclaimer remains visible; no estimate-based retention promise is made.

Each case seeds two verified controls, then injects QuotaExceededError after four committed ceiling ranges via the existing test-only subclass. Actual entry import handler reports Stopped: P2 simulated quota exhaustion. Previous records/metadata/bytes are unchanged and no ceiling row appears. Removing the injected failure and reselecting the file resumes from 65536 bytes, writes only 60 missing ranges and publishes after validation. All exports match raw original bytes, CRC/metadata/full SHA and re-import. Low/near/unavailable/invalid/throwing estimate configurations each PASS this integrity/recovery test; estimate preflight itself is NOT IMPLEMENTED. Prior suite separately covers first-chunk and publication quota failure.

Loss case: import/verify all three approved fixtures in huginn-p2-loss-backup, export exact byte copies into the independent Node controller, close connections and unload the page. Before deletion, require the exact disposable database name, expected loopback origin, and absence of any non-P2 database in the fresh profile. Delete only that disposable database, never the origin/profile or any owner database. Reopen: zero flights, zero VERIFIED LOCAL rows, No imported synthetic evidence, old verification key fails FLIGHT_NOT_IMPORTED. Restore each independent backup through the actual UI file import handler. Exact original sizes/hashes/classifications and byte-identical export/re-import PASS:
- F000001.FLG: 1088, COMPLETE, 93e7956bc91945a4edae075b01f2fa3fa97f36cb1531d752c706b6f7dde93d5d
- F000002.FLG: 768, INCOMPLETE, 1258a8be2cb0201dbb8aa6bed4e2d78e31c574682f8172584177e5950b87646a
- F000003.FLG: 1048576, INCOMPLETE (torn tail preserved), a665ab60cb630c78316cf0023f4165e2244ae06094f94ad65e6ba9118053fca9

Original identities are retained because the new disposable databases have no conflicting imports. Independent backup arrays live outside IndexedDB before deletion. This proves synthetic restoration after SIMULATED DATABASE DELETION, not actual browser-managed eviction, whole-origin loss (including worker cache), a durable Files backup or reboot of the external backup holder.

User safety review (no text changes):
- Browser eviction: explicit Browser data can be cleared or evicted and Keep an independent copy — adequate.
- Persistence is not permanent: default archival disclaimer, grant warns user deletion/device loss — adequate.
- Export dispatch is not saved backup: save completion/cloud retention unconfirmed; re-import saved file instruction — adequate.
- Independent FLG retention: independent copy advice exists, but a more explicit locally verified FLG backup/long-term retention procedure could help.
- NO-ACK: prominent NO-ACK/FULL_ACK_GATE_PASS=false and no pairing/device/cloud statement exist; installed UI does not explicitly explain source-deletion authorization. Recommend stating no transfer acknowledgement and no permission to delete source evidence in a separately approved text change.
- No storage estimate preflight/warning or distinct lost-storage diagnosis exists. Do not imply these are implemented. Actual write errors still fail closed; fresh-empty UI does not reconstruct lost history.

No production data-integrity defect observed. Optional future runtime/text review: bounded advisory estimate reporting (never retention authority), concrete backup instructions and explicit NO-ACK deletion boundary. No changes authorized/implemented here. Actual browser eviction/low disk/quota, iPhone recovery under storage pressure, Files-provider durable backup and cross-browser/whole-origin recovery remain unqualified.

Results: ignored build/p2/pressure-results.json and build/p2-pressure-regressions.log. Production build stays 661e500ad4349afc, NO-ACK and gate false. New tests/documentation remain uncommitted for review.

2026-10-10 full run: 273/273 top-level tests PASS, including all 271 previous tests; P1 embedded desktop Edge checks 11/11 PASS, offline startup/reopen PASS, prior P2 recovery/quota/concurrency PASS and production injection exclusion PASS. Simulated loss/restoration PASS; actual browser-managed eviction NOT TESTED.
