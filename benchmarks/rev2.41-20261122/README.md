# Rev. 2.41 COM5 transfer benchmark

The previous local product baseline is committed separately from the focused
2.41 BUSY correction. The prerequisite includes earlier delivered AUX/MAIN,CHT,
recorder/status and prepared-transfer work, explicitly authorized by the owner
for source-baseline publication. No new behavior in those areas was introduced
by the2.41 fix. Old benchmark tags remain unchanged.

The fault was zero-wait SD-owner contention during a late prepared live check.
2.40 invalidated a still-valid prepared cache on transient BUSY.2.41 preserves
it only while the epoch remains current; all identity/CID/block-hash guards
still run. The app recognizes only typed503 COURIER_BUSY and caps resubmissions
at one per Range and three per preparation, preserving committed offsets.
Persistent BUSY and all other errors remain terminal; HTTP timeouts are unchanged.

Real COM5 Chrome qualification: preserved3h staging resumed from30,670,848B;
independent cold3h and cold1h completed with exact size/SHA-256,IndexedDB,full
browser-process reopen and controlled interruption/resume. See benchmark.json
for exact artifacts and phase times.1h/30s was NOT achieved. Chrome qualification
is not iPhone acceptance or flight release. The public app was not deployed.

Synthetic-only regression: Tools/run_prepared_busy.py exercises the actual
production cache with no flight file or device. In HuginnAPP run the builder,
then tests/rev241-busy.test.mjs; tests/rev241-production.test.mjs exercises actual
browser/IndexedDB with generated data and late BUSY. Private17-case production
HTTP and full-device evidence remain local. No personal flight evidence is
needed or included in the public tests.
