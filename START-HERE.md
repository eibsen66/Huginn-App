# START HERE — HuginnEIS → HuginnAPP → Muninn

Paused owner snapshot: **2026-11-11**. Read this file, then each root `AGENTS.md`. Do not automatically build, deploy, flash, reset, open COM ports or write settings when resuming.

Open all three projects in one VS Code window:

```powershell
code C:/HuginnAPP/Huginn.code-workspace
```

Workspace: [Huginn.code-workspace](Huginn.code-workspace). Its three absolute roots are `C:/HuginnEIS`, `C:/HuginnAPP`, `C:/Muninn`; automatic tasks are disabled. There are no workspace build/flash/serial startup tasks. The active firmware application remains `C:/HuginnEIS/Huginn/Firmware/huginn`.

| Project | GitHub / branch | Preserved source commit |
|---|---|---|
| HuginnEIS | [Huginn-Muninn](https://github.com/eibsen66/Huginn-Muninn/tree/benchmark/huginneis-rev2.11-20261111), `benchmark/huginneis-rev2.11-20261111` | [38c2962](https://github.com/eibsen66/Huginn-Muninn/commit/38c2962) |
| HuginnAPP | [Huginn-App](https://github.com/eibsen66/Huginn-App), `main` | [fc736d9](https://github.com/eibsen66/Huginn-App/commit/fc736d9) (approved runtime source; later handoff-only commits may advance main) |
| Muninn | [Muninn](https://github.com/eibsen66/Muninn), `main` | [e923a02](https://github.com/eibsen66/Muninn/commit/e923a02) |

## 1. HuginnEIS — accepted benchmark

**Rev. 2.11**, COM5: owner confirms installation/readback PASS and the changed UI works correctly. Annotated tag: [huginneis-rev2.11-benchmark-20261111](https://github.com/eibsen66/Huginn-Muninn/tree/huginneis-rev2.11-benchmark-20261111), resolving to the source commit above. Earlier Rev. 2.0 benchmark branch/tag and Rev. 2.10 rollback evidence remain intact. Default main was not repointed; resume the named benchmark branch.

- Exact application: **1963856 bytes**, SHA-256 `fd873a955be8dc645858420d5c2f57ebe24fb541cf3f444e4ee80b1a48f6c3a6`.
- Build: `C:/HuginnEIS/Huginn/Firmware/huginn/build-rev2.11-20261110-ui-review-retry1`.
- Install evidence: `C:/HuginnEIS/Evidence/REV2.11-COM5/flash-20261110T015835Z`.
- UI/build review: `C:/HuginnAPP/build/rev211-ui-review`; exact input pins: `final-build-start.json`; artifact receipt: `offline-verification.json`.
- [Benchmark/source correspondence](https://github.com/eibsen66/Huginn-Muninn/blob/benchmark/huginneis-rev2.11-20261111/Huginn/Firmware/HUGINNEIS_REV2_11_BENCHMARK_2026-11-11.md) and [owner acceptance](https://github.com/eibsen66/Huginn-Muninn/blob/benchmark/huginneis-rev2.11-20261111/REV2.11-OWNER-ACCEPTANCE.md).
- Existing ESP-IDF **5.5.2**, environment `C:/Espressif/tools/python/v5.5.2/venv`. Shared SDK remains unchanged. Only reviewed local SDK overlays are in Git; the pinned baseline reconstruction tool is `C:/HuginnEIS/Tools/restore_project_sdk_overrides.py`. No reconstruction is needed on this preserved machine. Do not rebuild just to resume.

**Not tested / not claimed:** new-card FLG recording, SESSION_COMPLETE or flight readiness. The original in-flight REC FAIL remains a separate unresolved historical investigation. No COM10 update was confirmed in this session; do not assume its installed revision. General owner UI acceptance does not establish every absent-card/error subcase physically passed.

New SanDisk MAX Endurance 32 GB HUGINNEIS FAT32: full free-space Windows write/SHA-256 read test PASS, **31902236672 data bytes**, zero free bytes after filling; 32768 bytes test-directory filesystem overhead. Only test files were removed afterward. Receipt: `C:/HuginnAPP/build/sd-card-test-20261109-full-retry/result.json`. This is not an FLG recorder test. SD/REC investigation is paused.

**Next:** agree the next bounded owner task before operating hardware. Any future provisional FLG bench test needs a valid supported LIVE CAN/RPM source; no ready project CAN sender was found. Do not start engine or inject data automatically.

## 2. HuginnAPP — accepted installed PWA

Canonical origin: **https://huginnapp-pwa-test.pages.dev/**. Approved build **6a2d2ea1505b8acf**; owner confirms this build on iPhone. Read-only public verification on 2026-11-11 matched all **32 frozen files**, source canonical build identity and all **30 public assets**, including worker, manifest and icons. No new deployment or rebuild ran.

- Frozen artifact: `C:/HuginnAPP/build/system-info-review/candidate-6a2d2ea1505b8acf`.
- [UI/update review](SYSTEM-INFO-AND-CONNECTION-UI-REVIEW.md); local public/source verification: `build/pause-handoff-20261111/app-source-and-live-verification.json`.
- Current publication record: Pages deployment `954cd6e2-d02e-480a-b98d-71f59fe6dd6f`; rollback reference `3cd057de-5428-4dc4-b8ae-a1c5f2c4bfb0` / `a2acd940a7370142`. These IDs are retained from the deployment review; this task independently checked public bytes, not a new Cloudflare API deployment listing.
- Preserve existing PWA storage, downloads, drafts, exact-byte exports, pairing protections and NO-ACK. Never clear data/reinstall to resume or replay uncertain writes. ENGINE/AIRFRAME TIME remain local protected device controls only.
- Physical Settings POST transport failures are not declared resolved by UI acceptance or isolated GET/POST successes. No setting was read/written in this preservation task; do not infer brightness/restoration from an old draft.

**Tests accurately retained:** prepared build review recorded 45 focused passes and later exact old-to-new worker upgrade tests. This preservation task did not rerun that full suite. Its extra checks found the unchanged historical `FIRMWARE_HEAD` mismatch and `UI profile/origin change invalidates old source and pairing` source-text-regex failure. They were **not fixed, weakened or called passed**. Test-only physical identifiers in three new test files were replaced with synthetic values; originals remain private locally. Runtime source/canonical build is unchanged.

**Next:** owner chooses the next bounded app task; distinguish current editor readback from diagnostics, and uncertain writes from verified saves. No deployment/device save is implied by opening the workspace.

## 3. Muninn — work preserved

[Pause status](https://github.com/eibsen66/Muninn/blob/main/PAUSE-STATUS.md): exact-byte FLG import/replay, bounded 8 MiB admission, archive/restore and GUI loading work are preserved. Review records: `C:/Muninn/tests/FLG_LARGE_FILE_V1.md`, `C:/Muninn/tests/D1C_PERSISTENT_ARCHIVE_V1A_DESIGN.md`, `C:/Muninn/TRANSFER_V1.md`. Large-file GUI owner review and documented memory/latency limitations remain pending where stated. No packaging or owner-database migration ran.

**Next, after HuginnEIS and HuginnAPP:** agree the next small Muninn owner review using copies/temporary DBs. Large local review DBs, screenshots and synthetic FLGs remain under `C:/Muninn/tests/*review*/`; they are excluded from Git and were not deleted.

## Local-only preservation

Private provisioning/certificates, flash dumps, original recordings, device IDs and large builds/evidence remain locally under the existing roots, excluded from publication. Git bundles and pre-commit dirty diffs: `C:/HuginnAPP/build/pause-handoff-20261111/`. Original-card evidence: `C:/HuginnEIS/Evidence/REC-FLIGHT-20261103/`. Do not clean/delete these folders. GitHub is a source checkpoint, not a replacement for independent backups of private evidence.

## Paste into the next Codex session

> Opnaðu og lestu C:/HuginnAPP/START-HERE.md og AGENTS.md í C:/HuginnEIS, C:/HuginnAPP og C:/Muninn. Staðfestu branches og vinnustöðu án þess að breyta neinu. Rev. 2.11 er samþykkt COM5 benchmark; HuginnAPP 6a2d2ea1505b8acf er samþykkt uppsett útgáfa. Haltu röðinni HuginnEIS → HuginnAPP → Muninn og varðveittu gögn og eldri benchmarks. Engin sjálfvirk smíð, dreifing, flash, COM-aðgerð eða tækjaskrif. Ég gef næsta afmarkaða verkefni sérstaklega.

