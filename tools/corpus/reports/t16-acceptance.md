# T16 — corpus technical acceptance and handoff

**Technical verdict: ACCEPTANCE PASS (22/22 checks).** The pipeline and cleaned seed handoff completed after the effective review-state gate was integrated on `feat/t14-t16-seed-handoff`, validated parent commit `e9318bd8c55344636619b99a6753ea134e343968`.

**T16 remains open:** source-backed T26 evaluation and reviewer sign-off are pending. Technical acceptance does not complete those gates.

## Pack identity

| Field | Value |
|---|---|
| pack_id | `pack_ncr-2026-10` |
| local file | `data/raw/out/pack.sqlite` (gitignored) |
| pack_sha256 | `9203234afd1b503186b607c28b16d758ae66fa8cd96a586a30c234a973f6bb10` |
| pack_bytes | 851,968 |
| parent build runtime | Node `v24.5.0` / SQLite writer `3.50.3` |
| companions | `data/seed/pack.manifest.json` / `data/seed/pack.sha256` |
| schema_version | 1 |
| input_sha256 (LF-normalized snapshot) | `d3939475ebd250755fcdac776f703001480aeaa4b72d04b025fba54434c4fdf3` |
| cited source dates | 2026-04-09 → 2026-10-10 (not verification dates) |

The promoted seed companion and checksum describe the rebuilt local pack. SQLite bytes remain local; `data/seed/eligible/` contains the cleaned tables used to rebuild it. The date range uses cited sources' `posted_at`, falling back to `observed_at`; its upper bound includes the team-review source's 2026-10-10 observation date.

The builder normalizes schema SQL to LF. Byte-for-byte reproduction is scoped to the same source and SQLite writer runtime: different writer versions alter the SQLite header and checksum even when all table rows, manifest fields and normalized schema agree. Acceptance verifies each built pack against its own companion; this report identifies the parent artifact above.

## Effective review gate and yield

T11 produced **5,713 candidates** from **2,186 answered posts**, each with exactly one outcome.

| Review stage | second_passed | needs_review | rejected | accepted |
|---|---:|---:|---:|---:|
| T12 part A (deterministic) | 5,583 | 130 | 0 | 0 |
| Effective states after heuristic overrides | 5,562 | 151 | 0 | 0 |

Heuristic part B sampled **313** candidates and quarantined **21**. It is deterministic screening, not independent AI review or a source-supported judgment. The effective human queue contains **151 items across 106 posts**. T14 honors `ai_override`; candidates whose effective state is `needs_review` do not emit eligible records.

The final pack has **134 legs on 69 routes**, **59 stops**, **91 places**, **271 aliases**, **50 ambiguity rows**, **21 walk links**, **0 fare reports**, **0 hours reports**, **276 notes**, and **1,719 provenance links**. Of the legs, **125 are ready and 9 excluded**; of 59 access rows, **58 are ready and 1 excluded**; all 21 walk links are ready. Excluded records cannot route.

Answered-post dispositions: **405 included · 91 pending · 497 rejected · 1,193 filtered**, totaling **2,186**.

## Acceptance results (22/22)

| Category | Passed | Evidence |
|---|---:|---|
| integrity | 3/3 | SQLite integrity/foreign keys/schema version; companion metadata, bytes and checksum; raw snapshot identity, counts and evidence locators |
| invalid-record | 12/12 | Manifest/disposition reconciliation, record validation and invalid-record mutation fixtures |
| ambiguity | 4/4 | Pack ambiguity validation and mutation fixtures; ambiguous aliases cannot become unique resolutions |
| source-content | 3/3 | Pack text scan and mutation fixtures for six-word source copies and explicit handles/profile links (INV-4) |

The source-content scan checks six consecutive normalized words and explicit handles/profile links. It cannot establish the absence of shorter copied fragments or bare usernames where source author metadata is absent. No field-verification claim follows from these checks.

## Reproduction and validation

Run the pipeline from the repository root:

```sh
node tools/corpus/run-pipeline.mjs
```

It freezes/validates the pre-cleaned reference, audits and extracts, runs deterministic evidence and heuristic quarantine, resolves places, emits eligible records, builds and accepts the pack, then promotes the cleaned seed. It does not perform actual AI review or human sign-off.

To recheck the existing pack without regenerating outputs:

```sh
node tools/pack-builder/acceptance.mjs --pack data/raw/out/pack.sqlite --raw howtogetthereph_dataset/ncr_routes.json
```

Coordinator-confirmed final validation:

- Final `node tools/corpus/run-pipeline.mjs` on Node `v24.5.0` / SQLite `3.50.3`: acceptance **22/22 passed**.
- Final `node --test tools/pack-builder/*.test.mjs` on that runtime: **55/55 passed**, including the LF/CRLF schema regression and real-seed SQLite/core smoke.
- Final independent reconciliation: **13/13 assertions passed**; two seed-input rebuilds on the same writer runtime matched the parent SHA and byte size exactly. Seed tables/metadata and builder outputs agree; the explicit `promoted_at` timestamp differs between promotions.
- Before the final schema-normalization change, `node --test tools/corpus/*.test.mjs tools/pack-builder/*.test.mjs`: **155/155 passed**, with no failures or skips. The final changed pack suite above was rerun; the combined suite was not rerun after normalization.
- Before that DDL-only change, `npm test -w @pusang-gala/core`: **428/428 passed**; `npm run typecheck -w @pusang-gala/core`: **passed**. These suites were not repeated after normalization.

The explicit corpus/pack-builder glob command above works in PowerShell; the root `npm test` covers workspace suites separately.

## Remaining acceptance gates

- Actual AI review for T12 and designated human decisions on the effective queue remain pending; agents never set `accepted`.
- Source-backed T26 evaluation and reviewer sign-off remain pending, so T16 stays unchecked.
- Unsupported coordinates remain unmapped; source-post dates are not verification dates.
- Pre-cleaned reference: `data/reference/howtogetthereph_dataset-precleaned/`; cleaned handoff: `data/seed/`.
- No PR has been opened: `gh` authentication is unavailable and the browser is signed out. The branch compare link is not a PR; only Cursor integrates and pushes the parent.
