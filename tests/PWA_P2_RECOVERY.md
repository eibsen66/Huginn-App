# P2 isolated desktop import recovery

LOCAL TEST ONLY. NO-ACK; FULL_ACK_GATE_PASS=false. No deployment or native/device qualification.

Run from C:\Huginn-App after the normal production build:
```powershell
node scripts/pwa-build.mjs
node --test tests/pwa-recovery.test.mjs
node --test --test-concurrency=1 "tests/*.test.mjs"
```

The runner binds an ephemeral 127.0.0.1-only port, serves exactly six allowlisted resources (no production UI, worker, manifest or device routes), creates a new temporary Edge profile, and verifies its origin database list is initially empty. Every opened database uses huginn-p2- names; the injecting subclass also enforces that prefix. No existing browser profile/storage is opened, cleared or deleted. Disposable profiles/databases are retained.

Fixtures are generated in memory from copies of the approved synthetic P1 assets. Each case/fixture receives a deterministic unique synthetic session/device/filename, with header CRC and canonical metadata/file SHA recomputed. Original fixtures remain unchanged. These derived fixtures are never written into production assets.

The original adapter is served with ONLY its storage import redirected to the test subclass; all import orchestration, parser validation and base storage methods otherwise remain original. Injection modules exist only under tests/, and the production build allowlist never copies them. No production URL flag, UI control or runtime injection switch is introduced.

| Test | Deterministic action and assertions |
|---|---|
| A | Stop before range zero commit; offset/chunk count remain zero. |
| B | Stop after range one commits; offset 16384, one chunk. |
| C | Stop after range eight commits; offset 131072, eight chunks. |
| D | Stop after all 64 ranges before publication; no imported ceiling row. |
| E | Explicitly abort chunk/offset transaction after its requests; both roll back. |
| F | Close/relaunch full Edge process with same isolated profile/origin; reselect same fixture and assert only missing offsets are committed. |
| G | Corrupt only a disposable staged chunk; resumed validation rejects and quarantines, no publication/export. |
| H | Verify two control fixtures' original bytes and hashes after each interruption/restart; compare persisted flight records before/after. |
| I | Every recovered valid ceiling export matches every original byte and SHA; re-import comparison succeeds. |
| J | Interrupted unpublished evidence never appears in imported flight list; publication occurs only after recovery validation. |
| Extra P | Abort final flight-row/staging-phase transaction; publication rolls back together, then resumes without range rewrites. |

Checkpoint interruption is a test-only thrown exception followed by full browser close/relaunch, not an OS crash inside a live transaction. Transaction-abort tests supply deterministic rollback evidence separately. No iPhone, abrupt battery-loss, quota, eviction or multi-window qualification is claimed. G intentionally damages only the new disposable staging, never a control or existing owner database.

2026-10-10 full combined regression run: 269/269 top-level tests passed (including the two new recovery/exclusion tests); embedded P1 Edge browser checks 11/11 passed. Final targeted run: A-E/G/P and F/H/I/J passed; production exclusion check passed. Offsets resumed with 64/63/56/0/64/0 missing writes for A/B/C/D/E/P respectively; corrupt G rejected without range writes. Production version remained 7ce3de4a1f28cc68. No data-integrity failure observed. During development, invalid disposable filename G and an overbroad publication hook caused harness failures; identifiers and injection targeting were corrected without weakening validation or changing production code.

Machine-readable current run evidence: ignored build/p2/recovery-results.json; full regression output: ignored build/p2-regressions.log. Failed development runs are not represented as PASS. Recovery harness files remain uncommitted for owner review.
