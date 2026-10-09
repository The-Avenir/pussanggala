# Seed freeze and promotion helper

Worked only in `D:/cjds0/orca/workspaces/pussanggala/seed-freeze-promotion`, based on the seed handoff branch. The original checkout, T12 source files, generated seed/reference outputs and Cursor's pipeline integration were not edited. Node: `v26.11.1`, Windows.

## Commits and integration order

1. Integrate the pack helper's **original** `e703888` first. Its local cherry-pick is `562402af7e7dcaf5be3b1583984c3c3f5d3327aa`; this is an inherited dependency, not my deliverable, and must not be cherry-picked twice.
2. `b63e142f72760d298c427458a0a7b78edff1a979` — immutable freezing and isolated regression tests.
3. `26606759fed8399925e323c474924bcf5f459520` — fail-closed seed promotion and isolated regression tests.
4. Cherry-pick the subsequent report-only commit containing this file if desired.

The two source commits contain only the four owned script/test files. No push or competing PR was created.

## Findings and fixes

The old freeze script overwrote every source copy and the timestamp, copied the source README onto a path subsequently overwritten by generated documentation, and decoded binary bytes as UTF-8. Freezing now preserves an established baseline, verifies the source identity and complete file set, rejects corrupted existing copies, and recreates missing ignored bytes under `raw/`, including the original source README. New baselines use `SHA256SUMS.txt` v2 JSON-lines metadata with exact byte size/hash and a separate nullable LF text digest. Valid UTF-8 files with known text extensions receive an LF digest; binary files do not.

The committed **legacy** SHA256SUMS and README remain supported and unchanged, including the original timestamp. Read-only validation against the actual seven tracked source files passed with `sourceId=howtogetthereph_dataset` and `frozenAt=2026-10-09T19:09:34.744Z`. Six files in the child Git checkout had LF bytes while the preserved baseline recorded CRLF bytes. Recreation tests and actual read-only validation prove reconstruction of canonical LF/CRLF candidates only when their exact hash and size equal the existing baseline. LF equality alone cannot replace the baseline; corrupted existing frozen copies are rejected. Older root-level ignored copies are validated if present and left intact. The existing ignore rule already ignores the entire new `raw/` directory; source wording is never copied into committed metadata or seed assets.

The old promotion recursively copied unexpected files, retained stale destination tables/checksums, allowed missing packs/companions, looked for nonexistent `pack.sqlite.sha256`, and hardcoded the source snapshot hash. Promotion now requires exactly the allowlisted `TABLES` JSON files, run/disposition metadata, the built pack and its actual `pack.manifest.json`. It uses the pack helper's `readPack` and `checkCompanion` APIs, validates the frozen snapshot identity, and performs a deterministic temporary builder rebuild to prove pack agreement with the supplied eligible tables/run/dispositions and raw input. This also re-runs builder privacy, provenance, schema and source checks before publication. Unknown run metadata fields and companion additions are rejected to avoid copying unvalidated data into seed assets.

Publication replaces the seed directory after all validation. Stale tables, raw extra files and obsolete checksums disappear on success. Validation failures preserve all previous seed files; an injected publication-rename failure demonstrates rollback to the original seed directory. If rollback itself fails, the backup is retained and its path is reported rather than deleted. Temporary raw inputs, SQLite builds and reports are removed and never shipped.

## APIs and CLI

Both scripts are import-safe; importing them does not run their CLI or write reference/seed outputs.

- `freezeReference({ sourceDir?, destDir?, sourceId?, frozenAt? })` returns `{ sourceId, frozenAt, files, legacy, destDir, created }`. `readFrozenReference(destDir)`, `validateFrozenReference(options)`, `readSnapshotBytes(file, expected)` and `hashBytes(buffer, filename)` expose the same checks for promotion/tests. `sourceId` defaults to the portable logical identity `howtogetthereph_dataset`, rather than an absolute machine path.
- Freeze CLI: `node tools/corpus/freeze-reference.mjs [--source DIR] [--out DIR] [--source-id ID]`.
- `promoteSeed({ rootDir?, eligibleDir?, dispositionsPath?, runPath?, packPath?, companionPath?, sourceDir?, referenceDir?, sourceId?, outDir?, promotedAt?, rename? })` returns `{ outDir, handoff, companion }`. `rename` is a filesystem test seam for deterministic rollback coverage.
- Promotion CLI: `node tools/corpus/promote-seed.mjs [--eligible DIR] [--dispositions FILE] [--run FILE] [--pack FILE] [--companion FILE] [--source DIR] [--reference DIR] [--source-id ID] [--out DIR]`.
- Unknown flags or missing values fail with exit code 1. Existing no-argument command defaults remain compatible with `run-pipeline.mjs`.
- Seed now contains `pack.manifest.json`, and removes obsolete `pack.sqlite.sha256`. `pack.sha256` remains a byte-exact checksum of `pack.sqlite`. `HANDOFF.json` derives `source_snapshot_sha256` from the LF-normalized validated run hash, and records `source_snapshot_sha256_bytes` and `source_snapshot_sha256_lf` separately.

Cursor should rebuild T14/T15/T16 after integration, then invoke freeze/promotion using the existing commands. T14 `run.input_sha256` and Reddit evidence locator hashes must use the builder's logical LF input hash; the existing `ncr_routes.json` contract is unchanged. Do not delete or regenerate the preserved legacy metadata to migrate the layout: a normal freeze invocation validates it and recreates only ignored missing `raw/` copies. Commit regenerated seed metadata/tables only after integrated builder acceptance succeeds; generated reference raw copies and temporary build/report outputs stay ignored.

## Validation

All owned test filesystem writes/deletes and CLI runs target unique OS temporary directories. Commands were run in the child checkout:

| Command | Result |
| --- | --- |
| `node --check tools/corpus/freeze-reference.mjs` | Passed |
| `node --check tools/corpus/promote-seed.mjs` | Passed |
| `node --test tools/corpus/freeze-reference.test.mjs tools/corpus/promote-seed.test.mjs` | Initial fixture build exposed CRLF mismatch: 11 passed, 23 failed before assertions; normalized only temporary fixture bytes, then 34/34 passed. Added exact recreation tests: 36/36 passed before shared integration. |
| `node --test tools/corpus/freeze-reference.test.mjs tools/corpus/promote-seed.test.mjs tools/corpus/eligible.test.mjs tools/pack-builder/build.test.mjs tools/pack-builder/acceptance.test.mjs` | **94/94 passed**, exit 0, including final shared helper integration, CRLF pack identity and publication rollback; 83.39 seconds. |
| Read-only `validateFrozenReference()` via Node module stdin | Passed on all seven actual input files with preserved legacy identity/date; no reference output writes. |
| `npm test` | **578/578 passed**, exit 0: core 428, conversation 52, AI 88, conversation eval 10. Eval harness regenerated its tracked report in this child checkout; restored that test side effect after completion, and committed no regenerated artifacts. |
| `npm run typecheck` | Passed, exit 0, all four workspaces. |
| `git diff --check` | Passed before the focused source commits. |

Coverage includes repeat/timestamp preservation, source README retention, missing snapshot recreation, source drift/missing files, corruption, logical source identity mismatch, mixed unrecoverable line endings, LF/CRLF text digests, binary byte retention, stale/missing/tampered pack or companion, stale eligible/run/disposition metadata, unexpected or missing eligible tables, destination cleanup, failed first promotion, failed promotion preservation and rename rollback.

## Remaining limitations

No full pipeline or T12 resample was run here: Cursor owns those and final generated outputs. Promotion intentionally incurs one additional deterministic builder run and therefore needs the same Node/SQLite runtime as the pack build; a pack with different byte serialization must be rebuilt locally. All pack tables must be materialized, including empty arrays, as the actual T14 writer already does. New run metadata fields need an explicit allowlist review if the builder contract expands. Source identity is logical and portable; baseline files remain the authority for content. A missing mixed-ending snapshot cannot be reconstructed from an LF-only checkout unless its original exact bytes remain available. Directory replacement has rollback for ordinary filesystem failures, but does not implement a crash-recovery journal or concurrent-writer lock. If a process is killed between directory renames, the previous seed is recoverable from the sibling `.seed-promote-*` backup.
