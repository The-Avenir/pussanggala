# Independent final seed validation

Status: **PASS** for the requested independent automated validation. The final child pipeline and two documented seed rebuilds reproduce Cursor's actual parent pack byte for byte on the same Node/SQLite writer runtime. Human review, independent AI source reading, T26 and PR authorization/authentication gates remain open.

Worked only in the isolated `seed-final-validation` child. Ownership is this metadata-only report; imported source, generated seed/reports/verdicts, raw intermediates and frozen copies remain local and uncommitted. The original checkout was read only. No push or PR was performed.

## Source and runtime

- Child base: `a849108505ee915cd1012e86fda56ab3189ccd61`.
- Coordinator-supplied review source: `2b71b7189ee27a30025fbcf7764109706d530d75`, applied with `git cherry-pick --no-commit`; exactly five source/test files match the supplied commit after LF normalization.
- Initial parent integrated review revision: `37fa3cdbdbfcb5d226765c83f6802ff28a4e1d9d`.
- Coordinator-supplied final builder normalization source: `5c71f97e9ba669a3efb163f529353b5c7592bdff`, applied with `git cherry-pick --no-commit`. Its two source/test files and all five review files match the supplied commits and current parent after LF normalization.
- Final read-only parent comparison revision: `e9318bd8c55344636619b99a6753ea134e343968`; generated parent outputs at this revision were compared directly.
- Final matching runtime: `C:/Users/cjds0/AppData/Local/cursor-agent/versions/2026.10.01-e373342/node.exe`, Node `v24.5.0`, SQLite `3.50.3`, Windows x64.
- Initial child runtime: `D:/cjds0/3 DEPENDENCIES/node.exe`, Node `v26.11.1`, SQLite `3.53.4`.
- Dependencies were initially absent in the child. An ignored `node_modules` junction uses the existing parent dependencies without altering them.

## Final normalized-source validation

| Check after importing `5c71f97` | Result |
| --- | --- |
| Full independent pipeline using the exact Cursor runtime | PASS; exit 0; acceptance 22/22 |
| Independent outcome/state/queue/provenance/privacy/promotion assertions | PASS, 13/13 |
| Final `--test 'tools/pack-builder/*.test.mjs'` under Node 24.5.0 | PASS, 55/55; 0 failures/skips; 24.93 seconds |
| New `schema.sql CRLF vs LF normalizes to identical empty-pack bytes` regression | PASS; included in 55/55 |
| Existing actual-seed SQLite/core loader/graph smoke | PASS; included in 55/55 |
| Two documented eligible-seed CLI rebuilds and builder reports | PASS; all four outputs match each other, final pipeline and parent byte for byte |
| All 16 eligible seed files plus run/dispositions/companion/checksum/README | PASS; exact-byte match to parent |
| HANDOFF and manifest agreement | PASS; parent HANDOFF differs only in explicit `promoted_at` |
| Final actual core loader and graph over rebuilt SQLite | PASS; 125 ready leg edges, 21 ready walk edges, 116 access entries, 0 excluded entries |
| Final parent pack read-only acceptance | PASS, 22/22; actual bytes/companion/HANDOFF/checksum agree |
| Original raw input and frozen metadata preservation | PASS; all initial exact hashes preserved |

Final pack size is **851,968 bytes**. Exact output SHA-256 values shared by both final rebuilds, the final child pipeline and the parent:

| File | SHA-256 |
| --- | --- |
| pack.sqlite | `9203234afd1b503186b607c28b16d758ae66fa8cd96a586a30c234a973f6bb10` |
| pack.manifest.json | `5fe259d1c7119c4a26cd949cf3892b685f964fb58aca84498564bc64fe1a8d4e` |
| yield-report.json | `639b5cb0d513b8903885c20943a5c9086dc89d3ea0b1419e1f6a7ba2506ccac2` |
| yield-report.md | `835da8715324fc81f4535ce84892a1a0f3da1a25e9241646f0ac68060528c7c5` |

Exact final commands, run in this child:

```powershell
$seedValidationNode = 'C:/Users/cjds0/AppData/Local/cursor-agent/versions/2026.10.01-e373342/node.exe'
& $seedValidationNode tools/corpus/run-pipeline.mjs
& $seedValidationNode --test 'tools/pack-builder/*.test.mjs'
& $seedValidationNode data/raw/validate-final-normalized.mjs . data/raw/validation-baseline.json 5c71f97e9ba669a3efb163f529353b5c7592bdff .
& $seedValidationNode tools/pack-builder/build.mjs --eligible data/seed/eligible --dispositions data/seed/dispositions.json --run data/seed/run.json --raw howtogetthereph_dataset/ncr_routes.json --out data/raw/validation-final-rebuild-cli-a
& $seedValidationNode tools/pack-builder/build.mjs --eligible data/seed/eligible --dispositions data/seed/dispositions.json --run data/seed/run.json --raw howtogetthereph_dataset/ncr_routes.json --out data/raw/validation-final-rebuild-cli-b
```

The final metadata comparison used the same executable with module stdin to compare all output bytes, seed files, source revisions and original frozen/raw hashes, and load the rebuilt SQLite through actual `packages/core` loader/graph code. The earlier 155 corpus/pack and 428 core results below are retained with their exact pre-normalization context; final DDL-only changes required the updated 55 pack tests and final real-pack loader check, rather than unrelated suite repeats.

## Completed independent checks before final builder normalization

| Check | Result |
| --- | --- |
| Full `node tools/corpus/run-pipeline.mjs` after reviewed quarantine fix | PASS; exit 0 |
| Actual T16 SQLite acceptance | PASS, 22/22: integrity 3, invalid-record 12, ambiguity 4, source-content 3 |
| Independent metadata/review/outcome/promotion assertions | PASS, 13/13 |
| `node --test 'tools/corpus/*.test.mjs' 'tools/pack-builder/**/*.test.mjs'` | PASS, 155/155; 0 failures/skips; 37.46 seconds |
| Required direct command `node --test 'tools/corpus/*.test.mjs' 'tools/pack-builder/*.test.mjs'` | PASS, 155/155; 0 failures/skips; 37.41 seconds |
| `npm test -w @pusang-gala/core` | PASS, 428/428 across 19 files, including eligible-seed smoke |
| `npm run typecheck -w @pusang-gala/core` | PASS; exit 0 |
| Two builds from documented seed inputs | PASS, identical SQLite/companion/yield JSON/yield Markdown hashes within the same runtime and schema |
| Actual core loader/graph applied to independently rebuilt SQLite | PASS; 125 ready leg edges, 21 ready walk edges, 116 origin/destination access entries; no excluded edge/access entries |

The combined pack suite includes the existing `checked-out seed builds, accepts and loads with its actual raw snapshot` test, which builds SQLite from the promoted seed, reads it back, uses the actual core `loadPack` and `getGraph`, and checks the real pack's ready leg count. Synthetic fixture exclusion checks and the new quarantine/malformed-override/heuristic-provenance regressions also pass. These checks establish loader/graph compatibility, not route-search success on production journeys.

The exact documented rebuild command was run twice, changing only the output directory:

```powershell
node tools/pack-builder/build.mjs --eligible data/seed/eligible --dispositions data/seed/dispositions.json --run data/seed/run.json --raw howtogetthereph_dataset/ncr_routes.json --out data/raw/validation-rebuild-cli-a
node tools/pack-builder/build.mjs --eligible data/seed/eligible --dispositions data/seed/dispositions.json --run data/seed/run.json --raw howtogetthereph_dataset/ncr_routes.json --out data/raw/validation-rebuild-cli-b
```

## Reconciled corpus facts

- 3,480 input posts; 2,186 answered posts; 5,713 candidates; exactly 2,186 distinct post outcomes. Outcome candidate counts sum to 5,713: 855 route-evidence posts, 151 partial-evidence posts, 1,180 no-route-evidence posts.
- Part-A/base states: 5,583 `second_passed`, 130 `needs_review`, 0 `accepted`, 0 `rejected`. Effective states: 5,562 `second_passed`, 151 `needs_review`, 0 `accepted`, 0 `rejected`.
- The effective human queue has 106 posts / 151 items, exactly covering every effective `needs_review` candidate, including all 21 fare overrides. Removing those 21 override candidates in memory leaves every emitted eligible table and provenance link unchanged; none contributes an eligible fact.
- The heuristic sample has 313 candidates, 292 unflagged and 21 flagged. Verdict/report provenance identifies `heuristic-part-B` and a rule screen; unflagged records are not independently source-read AI judgments. No agent supplied human acceptance, reviewer identity or review timestamp.
- Final post dispositions at this source: 405 included, 91 pending, 497 rejected, 1,193 filtered; sum 2,186. The disposition keys exactly match answered post IDs. A rejected post disposition can reflect an unresolvable otherwise-passed candidate; it is separate from the candidate review-state count.

| Table | Rows |
| --- | ---: |
| region | 1 |
| place | 91 |
| place_alias | 271 |
| place_ambiguity | 50 |
| stop | 59 |
| place_stop | 59 (58 ready, 1 excluded) |
| route | 69 |
| leg | 134 (125 ready, 9 excluded) |
| walk_link | 21 (21 ready) |
| fare_report / hours_report / shape / note_link | 0 each |
| note | 276 |
| source | 406 |
| record_source | 1,719 |

Pack identity is `pack_ncr-2026-10`, schema 1, region `rg_ncr`, bbox `120.90,14.35,121.15,14.80`, created-at `2026-10-10T00:00:00Z`, staleness 180 days. Cited source-post dates span `2026-04-09` through `2026-10-10`; these are not field-verification dates. Missing fares/hours/shapes remain missing, route service status remains unknown, and places remain unmapped.

## Frozen input and promotion agreement

The raw NCR snapshot has byte and LF SHA-256 `d3939475ebd250755fcdac776f703001480aeaa4b72d04b025fba54434c4fdf3`, 2,695,540 bytes. Frozen logical identity remains `howtogetthereph_dataset`, original freeze timestamp `2026-10-09T19:09:34.744Z`, and all seven file entries remain intact. Each recreated ignored reference copy matches the preserved baseline's exact bytes/size and separate LF digest. Raw/reference copies are retained in the child.

Read-only original checks confirm all seven working raw files and both frozen metadata files preserve their initial exact byte hashes. Child frozen metadata hashes remain:

- README: `6b3b26d0faeec119b86fc4e0daa2f18a941c42ff8f9fa815a8e9fc72b1b22d0e`.
- SHA256SUMS: `b0648abc1de54e6b7d597a45a73d587f6683cf8e41e07a844cdf30701ab0fc39`.

Working snapshot identity normalizes CRLF to LF only; SQLite and asset hashes cover exact bytes. SQLite integrity/foreign keys/schema, all 16 input/read-back tables, every manifest field, companion assets/size/checksum, `pack.sha256`, `HANDOFF.json`, logical input hash and distinct frozen byte/LF hashes agree within each independently built pack. Acceptance passes real provenance/locator/count checks and privacy scanning, including sparse negative fixtures.

`run.created_at` is an explicit fixed builder input. Heuristic `judged_at` and promotion `promoted_at` are explicit per-run metadata and may differ between independent pipeline runs; whole-pipeline byte identity is not claimed for those timestamp-bearing files.

## Found reproducibility defect and precise scope

The initial child build used CRLF schema DDL and produced `b14eaecb67d3cf12dc166e2a37216f39c800a2ba1954a2eaf967d5dbce7991bc`, 856,064 bytes. The initial parent used LF DDL and a different SQLite writer version and produced `9203234afd1b503186b607c28b16d758ae66fa8cd96a586a30c234a973f6bb10`, 851,968 bytes. All 16 tables, manifests, seed run metadata and dispositions are exactly equal semantically.

Independent diagnosis found child schema bytes 10,761 versus parent 10,545, with identical LF SHA-256 `8c2385c28ec8e1284c71739d36353ef4730f69ba3ef228969e7ab5bf9c8430f3`. Stored table/trigger SQL differs only by CRLF/LF, producing 209 versus 208 pages. This was immediately escalated to the coordinator; Cursor owns the builder fix.

An ignored, isolated copied-builder experiment normalized only its copied DDL to LF. With identical child seed/raw inputs it produced `e9f5ec225230649488276455f055fff3d82809c2a8e83d983705a3fe49a7ea8e`, 851,968 bytes, and passed acceptance 22/22. It matches every parent byte except offsets 98 and 99: the SQLite writer-version header records child `3.53.4` versus parent `3.50.3`. In-memory comparison of the writer header established that these are the only remaining differences; no actual pack header was changed. Reading `sqlite_version()` through a current library does not identify the original writer.

**Resolved:** Cursor's `5c71f97` normalizes schema line endings before executing DDL and adds the regression. The final full child pipeline and both documented CLI rebuilds on Node 24.5.0 / SQLite 3.50.3 reproduce the parent's `9203234a...6bb10` pack and all builder report/companion bytes exactly despite the child's CRLF schema checkout. No helper source fix or actual pack-header edit was made. Cross-SQLite-version byte identity is not claimed; reproducibility uses the same source, normalized schema and writer runtime.

## Remaining real gates

- Designated human reviewer decisions for the 151 effective queued candidates remain open; agents never set `accepted`.
- T12 independent AI/source-reading review remains open. The deterministic heuristic rule screen does not fulfill it.
- T26 still requires at least 30 source-backed real-pack route/place/retrieval cases and the required ambiguity, outside-NCR, disconnected/missing-access, inactive-service and conflict/unknown cases. Core smoke and synthetic evaluations do not complete this gate.
- Corpus recipient/team handoff review, source/physical verification where required, and authenticated/authorized PR creation, review and merge remain separate. Cursor owns integration/rebuild/push; this helper performs no external publication.

Local ignored evidence: `data/raw/validation-baseline.json`, initial/final pipeline and suite/core logs, `independent-validation-summary.json`, `independent-final-validation-summary.json`, `validation-core-graph-summary.json`, `validation-final-parent-core-summary.json`, `validation-parent-comparison.json`, reviewed-source identity hashes, and the DDL-EOL/header comparison. These contain metadata or local test output; no raw Reddit wording is included in this report or printed during validation. The report is the only committed deliverable; all imported source, generated assets and local evidence are preserved uncommitted in the isolated child.
