# Functional Settings-send correction candidate — 2026-11-05

**Physical result recorded:** [Rev. 2.7 acceptance review](REV2.7-PHYSICAL-ACCEPTANCE.md) verifies the saved capture and retained artifact, and records the matching owner-reported phone result as **one successful complete/schema-valid Settings retrieval**. Separate flight-list HTTP 503 has no demonstrated branch/cause in this evidence. No repeated reliability, persistence or flight release is claimed. The preparation findings below are retained historically; no new firmware revision is prepared.

**Owner workflow now prepared and sealed.** See [Rev. 2.7 owner handoff](REV2.7-OWNER-HANDOFF.md), also installed at `C:/HuginnEIS/REV2.7-OWNER-HANDOFF.md`. Fresh ENV/BUILD/VERIFY/COM5 app-only FLASH/CAPTURE/explicit-folder READ-DIAGNOSTIC scripts are ready. Twenty-four owner/reader host tests, script parser checks and official environment/preparation checks passed; 3,604 retained reference files remain hash-identical. Pre-compilation receipt: `C:/HuginnEIS/Evidence/REV2.7-PREPARATION/prepared.json`. The original candidate evidence below remains unchanged; the earlier statement that workflow preparation follows review is superseded by this update. No target build or physical operation has run. Acceptance explicitly requires complete schema-valid phone retrieval correlated with a capture ARMED before the phone action; no Settings save.

Prepared and applied to the **project-local source only** as **HuginnEIS Rev. 2.7**, for owner review. No target build, flash, reset, COM access, deployment or physical test occurred. This is a functional change, not another measurement-only release. The installed image is not claimed to be Rev. 2.7. All existing send/allocation/heap diagnostics remain unchanged.

## Preserved physical evidence

Exact capture: `C:/HuginnEIS/Evidence/REV2.6-COM5/console-20261105T174704Z`.

The complete 2,663-byte raw capture hashes to `38e57c046595666550988026c1d1b0002f370f2ed0f88e31da84edd206bde429`, matching the saved summary. Request 1, task 1070369752, begins with 29,502 serialized bytes; the AES output-allocation failure occurs at 51,677 microseconds and the failed send ends at 52,251 microseconds. Exactly one allocation record, none dropped. TLS accepted 8,192 plaintext bytes; HTTP result 45062 and wrapped TLS return -1, errno snapshots zero. Plaintext acceptance is not a phone acknowledgement.

The failed allocation is 1,600 bytes, caps 8 (`MALLOC_CAP_DMA`), `bounce_output`. Before and after snapshots both show free=2,051, largest=1,536, blocks=12. Input and output are the same external buffer; input_bounce=0, both DMA-capability checks true, measured cache line=64, pointer offsets=9 modulo both 64 and 16. The driver can read this input directly, but cannot DMA-write this unaligned external output directly. It therefore needs internal output scratch.

This demonstrates insufficient contiguous eligible memory for that allocation in this request and its propagation into the failed response. It does **not** identify the allocations responsible for the low headroom, prove a leak, or prove that every historical truncated response had the same cause. Heap snapshots are separately locked observations, not a reservation or an atomic description of concurrent allocation activity. No matching physical readback of the installed image is available; intended-image/build receipts remain distinct from physical image verification.

## Focused implementation

Only three firmware inputs changed:

- `components/mbedtls/port/aes/dma/esp_aes_dma_core.c`: on ESP32-S3, when output needs a bounce and input does not, cap per-operation scratch/chunks at **1,024 bytes**, instead of 1,600. Both the initial allocation and every loop iteration use the same limit.
- `CMakeLists.txt`: PROJECT_VER becomes `HuginnEIS Rev. 2.7`.
- `main/main.c`: HUGINN_BUILD_ID becomes the same visible revision. This is a byte replacement preserving the file's existing line endings; no UI logic changes.

The functional patch adds no permanent DMA reserve, global buffer, allocator fallback, transport retry, new lock or diagnostic revision. Scratch remains owned by the invocation and freed once at the existing cleanup label. Input allocation failure, output allocation failure (including the previously fixed input cleanup), and DMA failure propagate unchanged. The previous cleanup correction and diagnostic callback remain intact. Other targets and input-bounce paths retain their existing limits and error behavior.

The 1,024-byte limit is a multiple of the 16-byte AES block and the measured 64-byte cache line. Internal output allocation retains its original alignment/capability request; external input offsets and cache maintenance remain unchanged. All intermediate chunks are whole AES blocks; only the final chunk may use the existing stream-tail mechanism. Existing hardware acquisition/release and mode/counter state handling are untouched. No shared mutable scratch is introduced. The S3 inner driver needs one input plus one output descriptor for these chunk sizes: the exact compiled target headers confirm **12 bytes each**, with the existing 8-byte aligned allocation. Both old 1,600- and new 1,024-byte chunks remain below the 2,000-byte interrupt threshold.

## Memory tradeoff and alternatives

The table comes from the actual extracted bounce routine with a deliberately conservative host heap model: 12 fragments totaling 2,051 bytes, largest 1,536; 32 bytes charged per allocation and payload rounded to at least 16-byte alignment. Its fragment distribution is one reproducible model, not a reconstruction of the unrecorded device topology. Descriptor allocation is included. Values are **host results, not promised device margins**.

| Output scratch | Peak modeled allocation | Remaining free | Remaining largest | DMA operations per 4,096 bytes |
|---|---:|---:|---:|---:|
| 512 | 608 | 1,443 | 928 | 8 |
| 768 | 864 | 1,187 | 672 | 6 |
| **1,024** | **1,120** | **931** | **416** | **4** |
| 1,280 | 1,376 | 675 | 160 | 4 |
| Original 1,600 | Allocation rejected | — | — | — |

1,024 leaves more margin than 1,280 for the same four DMA operations. 512/768 leave more memory but require more hardware setup/polling. The chosen limit reduces the output payload requirement by **576 bytes** without consuming idle headroom. A 4,096-byte operation changes from three to four chunks; target timing and system load remain unmeasured.

A reusable static/internal buffer could remove this allocation but would permanently reserve at least its payload (plus alignment), reducing memory available to other tasks even when no Settings request runs. It would also require a shared-ownership/lock audit beyond the existing per-invocation allocation. A lazy retained buffer still needs an initial contiguous allocation and retains scarce memory afterward. Neither is justified over the smaller transient buffer here. Moving output scratch into PSRAM requires cache-line alignment and careful non-cache-line tails to avoid re-entering the bounce path; that is a broader change. Global allocation preferences, TLS configuration, descriptor policy and response contents are unchanged.

Concurrency can still consume memory before the allocation; a future heap with less than the required margin can still fail. Such failure remains an error. This change does not claim to cure general internal-memory starvation or input-and-output-bounce cases. No extra physical measurement is needed to choose this review candidate; physical acceptance is still required to establish device success.

## Checks actually run

`node protocol/test-aes-scratch.mjs` completed with exit code 0:

- Actual original local bounce function reproduces the 1,600-byte failure at the recorded free/largest/block-count constraints; the candidate succeeds with scratch and descriptor coexistence.
- Actual candidate bounce function, host allocator/DMA seams, GCC `-Wall -Wextra -Werror` and ASan/UBSan: AES-128/256 CBC/CTR/GCM output, decryption and GCM tags match an unsplit OpenSSL reference. Boundary/tail lengths include 1/15/16/17, immediately below/at/above 1,024 and 1,600, 4,095/4,096/4,097 and 29,502/29,504; in-place/out-of-place and all four input/output ownership combinations.
- Failure injection at every allocation and inner DMA call position: error propagation and balanced cleanup. Initial allocation failure zeroization and genuine insufficient-memory rejection remain covered. No successful partial response or automatic replay is introduced.
- 200 full 29,502-byte fixture-response sequences modeled as 4,096-byte records, plus 200 full-body calls from four serialized callers: no retained scratch or allocation drift. Fixture: existing `build/settings-send-review/settings-full-29502.json`; no owner settings used. Thread serialization models the existing hardware exclusion, not FreeRTOS scheduling.
- **Actual unmodified ESP-IDF 5.5.2 TLSF source**, compiled on the host: a 1,536-byte available pool rejects 1,600, admits 1,024 plus aligned 24-byte descriptors 10,000 times, and retains a 472-byte largest free block without allocator drift/integrity errors. This uses 64-bit host metadata and is not an ESP32 heap_caps-region test.
- Xtensa compiler **syntax-only** against retained Rev. 2.6 build includes/configuration: full candidate AES source passes; target static assertions confirm ESP32-S3, MALLOC_CAP_DMA=8, descriptor size=12 and AES block multiple. No object/link/target build was run.

The host crypto seam uses OpenSSL rather than the actual AES peripheral or mbedTLS TLS record engine. These results check chunk ordering/state/bytes/ownership under modeled constraints; they do not establish target encryption timing, an actual full HTTPS send, or iPhone receipt. Existing target validation and TLS authentication remain in place.

The first auxiliary test attempts had a C harness formatting error and then a TLSF fixture-sizing assertion. Those test-only problems were corrected with unchanged strict warning flags and an explicit 1,536-byte pool; the final complete run passed. An apply-script receipt typo occurred after the three source writes and reverse patch check; no second source application occurred. The typo was corrected and the independent verification below generated the final receipt from the applied bytes and retained originals.

## Candidate identity and preservation

Review patch including revision handling: `protocol/aes-s3-output-scratch-rev27.patch`.

SHA256: `d10bf6a85fd36ff400ce661d5cc27a5cc2c9a0c8e306a95ed30ab4116d21bcb5`.

Functional-only patch: `protocol/aes-s3-output-scratch.patch` (SHA256 `292700be982a63d1bb5b04e1f4f4efbf502533e32d93bbad14a787bb97e9b745`). Applied AES source SHA256: `0962c8a87f9863592de96bfc349312a6eba753c1d2c7ec96e5af46ef24dadc24`.

`build/aes-scratch-candidate/applied-candidate.json` pins all three before/after identities and test evidence. Original bytes are saved alongside it. Reverse patch validation passes. **3,555 other pinned Rev. 2.6 inputs/outputs/capture files remain hash-identical**; seven directly relevant shared SDK inputs remain hash-identical. The original Rev. 2.6 app still hashes to `b14c2c0b2c4f472191cb6f06eb8f1498dc972a3ce9344c89b8e925bddc529b19`; its build provenance and captured evidence were not rewritten. Prior artifacts remain untouched. The shared SDK has not been edited.

No HuginnAPP runtime code, deployed artifact, storage, pairing, firmware Settings admission, settings/protected-time controls, recording, CAN, CHT or Muninn input changed. The historical **FIRMWARE_HEAD test remains failed**, expected `2b7323b749e517fabab6134f4d4493ec22bc0b3b`, actual `74f45528a8aece434d9af1b757b18bc8caa8fe45`; its guard was not changed or rerun as a claimed pass. REC FAIL investigation remains separate and paused.

## Owner review now

1. Review the three-file patch and this report. Recheck the candidate without building:

```powershell
Set-Location C:/HuginnAPP
node protocol/verify-aes-scratch-candidate.mjs
```

2. This is a **source candidate**, not a newly compiled binary. Do not use retained Rev. 2.6 BUILD/VERIFY/FLASH scripts for it: their source pins intentionally remain unchanged and must reject changed inputs. Fresh Rev. 2.7 owner build/provenance preparation follows candidate review; no old artifact is relabeled.
3. Later physical acceptance must use the intended new image, normal boot, and capture ARMED before one read-only phone Settings action. Correlate the retained send/allocation diagnostics with complete declared/received bytes and successful validation. No Settings write is needed. A successful attempt would demonstrate that attempt's success; it would not identify all owners of the earlier low DMA headroom or prove that all historical failures are cured.

A laptop GET is not a prerequisite: the measured allocation constraint already distinguishes the functional decision, and changing clients would not resolve the unknown memory owners.
