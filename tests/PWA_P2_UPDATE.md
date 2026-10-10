# P2 real Service Worker update and recovery — isolated desktop

Run node scripts/pwa-build.mjs then node --test tests/pwa-update-recovery.test.mjs, or the full node --test --test-concurrency=1 "tests/*.test.mjs" suite.

Baseline: main 22ca2043c64c5766ba84857183dd3e166d1b1900; local production build 661e500ad4349afc. Last owner-tested iPhone build remains 7ce3de4a1f28cc68; no phone update/qualification performed.

Isolation: fresh temporary Edge profile, initially empty origin database list, ephemeral loopback-only server, explicit resource allowlist, separate huginn-p2-update database. Test assets are in memory and profile/cache/database in disposable browser storage. Only ignored local result reports are written to build/p2. No existing user profile, Cloudflare origin, hardware, source database reset, external upload or production file is accessed for mutation.

Two controlled same-origin/same-scope shell variants A/B are generated from the current local production artifact: body data-test-version marker, isolated database-name substitution in entry, and distinct cache names in the original worker. These are deliberately harmless test updates, not a claim of upgrading the physical old iPhone release or changing storage algorithms. C/D are separate failure candidates. No migration: A/B adapter and flight-storage bytes are identical, both open schema version 1 with downloads/chunks/flights/clients; original parsing/CRC/SHA/metadata/publication/export are unchanged. No database reset is used to make updates succeed.

Existing behavior: content-derived production cache version; full candidate cache.addAll during install; failed candidate cache deleted; worker waits for explicit idle activation with exactly one window; activate removes previous matching app-shell caches and claims clients. UI reloads on requested controller change. Evidence remains in IndexedDB, not CacheStorage. No supported rollback from an already activated incompatible release is established.

| Test | Observed result |
|---|---|
| A | PASS: real A installation/worker control; three synthetic fixture imports. |
| B | PASS: full parser/metadata/SHA/reopen/export validation; exact original bytes. |
| C | PASS: real same-origin B worker installed and waiting online while A remained active. |
| D | PASS: explicit update activates B and reloads B shell marker. |
| E | PASS: persisted flight rows and metadata identical to baseline. |
| F | PASS: all three exported byte arrays equal original fixtures; byte-identical re-import. |
| G | PASS: full browser-process close/relaunch; server rejects every network request and page network emulation disabled; B launches cached. |
| H | PASS: all three rows VERIFIED LOCAL after offline restart, with exact exports. |
| I | PASS: candidate C asset request held deterministically then connection destroyed; failed worker redundant, candidate cache gone, B remains usable. |
| J | PASS: candidate D entry asset returns 404; worker redundant, no waiting success/activation, B cache and evidence intact. |
| K | PASS: existing window navigated again while B waiting; A loads and update remains offered. |
| L | PASS: two real windows prevent activation; blocked message appears; A/B caches retained until second window closes, then activation succeeds. |
| M | PASS: cleanup leaves only B cache and every expected ASSETS URL; flight records/exports unchanged. |
| N/O | PASS: NO-ACK visible offline after update; adapter gate false and original data unchanged throughout inspected stages. |

Data: F000001.FLG 1088 COMPLETE; F000002.FLG 768 INCOMPLETE; F000003.FLG 1048576 INCOMPLETE. Full bytes/hashes match approved original fixture files, including torn ceiling tail. Three rows remain, no duplicates. Baseline exports are retained independently in the Node controller and compared with subsequent exports. This is synthetic exact-byte backup usability, not Files-provider retention qualification.

Failed candidates preserve the already active B cache; this is failure before activation, not a claim of general rollback. Candidate interruption is network-request gating, not a timing-dependent manual app close. Test polling can reconnect after the application's expected update reload without repeating update actions. Developing the harness exposed MIME escaping, a browser-evaluation expression, expected reload-context loss and an assumed asset count; only harness code was corrected, and cache assertions now compare exact URLs from the original worker's ASSETS list. No original assertions/production checks were weakened.

No production update/data-integrity defect observed in these scenarios. No production changes required by these results. Gaps: busy-operation activation path lacks a new real-browser import pause test (existing source/desktop admission checks remain); races involving windows opening after the worker's count, browser crash/OS termination during activation, actual iPhone updates, full-origin loss, real eviction, storage migrations and activated-version rollback remain unqualified. Any schema-changing release requires separate migration/recovery approval and tests.

Production exclusion scans shipped modules for test database/injection/variant markers and rechecks approved P1 hashes. Local production artifact remains 661e500ad4349afc, gate false. NO-ACK, synthetic only, no pairing/network-device/cloud route. New test files remain uncommitted; no push/deployment.

2026-10-10 final full run: 275/275 automated top-level tests PASS; all 273 prior tests remain passing. P1 embedded Edge checks 11/11 PASS and offline reopen PASS. Prior P2 recovery, quota/concurrency and pressure/restoration PASS. New update A-O and all production exclusion checks PASS. Reports: ignored build/p2/update-results.json and build/p2-update-regressions.log.
