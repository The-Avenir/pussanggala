# Seed pack builder and acceptance helper

Branch: `seed-pack-acceptance`, based on `feat/t14-t16-seed-handoff` at `a3defd5`.
Runtime: Windows PowerShell, Node `v26.11.1`. Original checkout untouched.

## Commits and integration

Cherry-pick these focused commits in order:

1. `e703888cd9398bc09eef058df24f15bb952ba05f` — companion agreement, raw snapshot/locator checks, safe integer compatibility, privacy coverage and regression tests.
2. `65710c5f9e60c51f7332d5978dd13580662925a4` — sparse acceptance fixtures, decoded JSON privacy checks, source permalink identity, unsupported companion fields and hidden SQLite tables/columns.
3. The separate report-only commit containing this file; its hash is supplied in worker completion.

Only builder source/tests/docs and this helper report changed. No fixture/raw dataset text, core source/schema, corpus pipeline/T12 source, generated seed, reference assets or generated reports are included. No push or PR was created.

## Concrete defects fixed

- Baseline `node --test tools/pack-builder/*.test.mjs` had 15 passes and 4 failures: CRLF fixture bytes disagreed with its canonical LF hash. Raw snapshot identity now normalizes CRLF to LF only, preserving every other UTF-8 byte; pack checksums remain byte-exact.
- Acceptance previously checked only companion pack ID and checksum. It now also rejects disagreements in schema/date/input metadata, every nested manifest field (including staleness/dispositions), file/bytes and asset identity, malformed JSON and unsupported fields.
- Reddit evidence previously admitted fabricated snapshot hashes or comment locators. Build and acceptance now verify the actual raw snapshot, input/answered counts, answered post membership, comment bounds and non-null permalink identity. Null comment indices remain valid for question evidence; non-Reddit sources retain nullable locators.
- Post-build manifest checks now reconcile included posts against distinct cited Reddit posts and source date range against cited sources, even when a tamperer updates the external pack checksum.
- Privacy scanning previously skipped geometry JSON, source license/locator fields and the SQLite manifest. These are scanned, JSON escapes are decoded, and bare source author identities are recognized when raw author metadata exists. Unsupported tables/columns and companion fields cannot hide extra text from the scanner.
- Acceptance negative fixtures previously assumed optional fares/walks/notes/ambiguities and ready rows existed. Missing prerequisites are now created only in the fixture's in-memory copy with synthetic provenance. The real pack is never modified or given manufactured coverage.
- Unsafe integer input accepted by the builder but rejected by the actual core Zod loader now fails before SQLite insertion.

## Actual checked-out seed

Temporary build and acceptance both pass; the permanent regression also loads its resulting SQLite tables through the actual `packages/core/src/pack/load.ts` loader and graph implementation.

- Raw snapshot, both byte hash and LF-normalized hash here: `d3939475ebd250755fcdac776f703001480aeaa4b72d04b025fba54434c4fdf3`.
- Pack checksum from the initial temporary clean round-trip: `bbfae4d59730e02b7fd1190bcb46389462042247450abcb8dd4efe78838017a2`.
- 3,480 input posts; 2,186 answered: 516 included, 114 pending, 584 rejected, 972 filtered.
- 182 legs: 167 ready / 15 excluded; 20 walks: 18 ready / 2 excluded; 67 accesses: 66 ready / 1 excluded.
- 91 places, 67 stops, 93 routes, 357 notes, 2,499 provenance links, one fare report, one hours report, no shapes or note links. All route service statuses remain `unknown`; all places remain `unmapped`. These are record counts, never physical-verification claims.

Cursor should rebuild its own outputs after integrating; the temporary pack was removed and is not delivered as a generated asset.

## Verification commands and results

- `node --test tools/pack-builder/*.test.mjs`: final full suite **54/54 passed**. Includes fixture and actual-seed SQLite/core round-trips, graph exclusion, companion disagreement matrix, input changes/CRLF equivalence, forged locators, count/date reconciliation, hidden SQLite text, escaped geometry leaks, bare author identities, unsafe integers and sparse packs.
- Final small follow-up: `node --test --test-name-pattern='acceptance rejects unscanned extra SQLite tables' tools/pack-builder/acceptance.test.mjs`: **1/1 passed**, adding the `sqliteXraw` name case after the full suite. This verifies literal `sqlite_` system-table filtering instead of SQL LIKE's wildcard underscore.
- `node --test tools/pack-builder/*.test.mjs tools/corpus/*.test.mjs`: **89/90 passed** at that checkpoint (52 builder checks + 37 corpus checks passed; evidence suite could not start because ignored T11 inputs were absent). Corpus AI apply, audit, eligible, extract and places checks passed. Audit's generated report changes were reviewed and restored.
- Prepared initially absent, ignored T11 inputs locally with `extract.run({out:'data/raw/t11',writeProgress:false})`, producing 6,640 candidates for 2,186 answered posts without editing source or committed reports. Then `node --test tools/corpus/evidence.test.mjs`: **6/7 passed**. Sole failure: committed Markdown part A has CRLF, temporary output has LF; all displayed content/counts match. This out-of-scope test/report issue is left to Cursor's T12 lane; no T12 source/report was changed. Evidence test outputs themselves were confined to temp directories.
- `npm run typecheck; npm test`: typecheck completed all four workspaces without diagnostics; root tests **578 passed** (core 428, conversation 52, AI 88, evaluation 10), exit 0. Evaluation test's generated report change was restored.
- `git diff --check`: clean before source commits. Final tracked worktree is clean after report commit.

Automatic approval review rejected deletion of the newly prepared ignored `data/raw/t11` test inputs as "blocked by policy", including a retry targeting the verified literal child-workspace path. They remain only in this child checkout, are not committed, and do not affect Cursor's original checkout.

## Producer/consumer contract

Builder outputs exactly `pack.sqlite`, `pack.manifest.json`, `yield-report.json`, and `yield-report.md`; there is no `pack.sqlite.sha256` output. The companion JSON retains its existing v1 fields: `pack_id`, `schema_version`, `created_at`, `input_sha256`, `pack_file`, `pack_sha256`, `pack_bytes`, `assets`, and `manifest`. Its single pack asset has `path`, `kind`, `sha256`, and `bytes`.

`checkCompanion(companion, manifest, packPath)` is exported by `tools/pack-builder/acceptance.mjs`: supply parsed companion JSON, the actual SQLite manifest row and the actual pack filename; it returns issues (empty means agreement) and modifies nothing. `readPack(packPath)` supplies `{tables, manifests, integrity}`. Consumers must also require the returned integrity array to be empty, and run full `runAcceptance({packPath, companionPath, rawDatasetPath})` for record/provenance/privacy acceptance. Merely passing `checkCompanion` does not establish corpus acceptance.

`sourceSnapshotSha256(path)` is exported by `lib/checks.mjs`; only CRLF is replaced by LF, with no trimming or JSON serialization. `build.mjs`'s `sha256File(path)` remains an exact-byte hash for SQLite/asset identity. The legacy no-verify option cannot bypass raw snapshot/provenance checks. Builder fixture snapshot placeholders are replaced in test memory only, leaving fixture files untouched.

Promotion should compare/rebuild using the current eligible tables, run metadata and dispositions, then regenerate its own reports/checksums. Acceptance can verify pack-level disposition counts and cited membership; it cannot reconstruct individual uncited pending/rejected/filtered decisions from SQLite alone.

## Remaining human and coverage limitations

The 114 pending post dispositions require designated human review when coverage expansion is desired. Agents never set `accepted`; sparse/null/unmapped/unknown values remain honest. Snapshot/locator agreement establishes evidence identity, not factual grounding, reviewer acceptance, licensing clearance or physical verification. T12 review and the regeneration/promotion lane remain Cursor-owned.

The deterministic source-copy guard uses six consecutive normalized words; shorter copied fragments are outside that threshold. Bare usernames can only be identified from raw author metadata when present (this NCR input lacks it); explicit handles/profile links are still rejected. Authentic Reddit permalink slugs are exempt from copied-word matching but still undergo username checks and source URL identity checks. The production pack format remains version 1; extra assets/columns/tables require an explicit future contract change.
