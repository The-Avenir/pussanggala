# T16 — corpus technical acceptance and handoff

Latest pack and validation: [seven curated NCR rail additions](../curated-routes-review.md).
The artifact identity and counts below describe the preceding 134-leg pack.

**Technical verdict: ACCEPTANCE PASS (24/24 checks); shipped-tree INV-4 PASS (zero findings).** Validated after the raw-URL shipping fix on `fix-seed-inv4`, based on `44fe8657f7e9a1304cf1f58642a4d0524f2b26c3`.

**T16 remains open:** source-backed T26 evaluation and reviewer sign-off are pending. Technical acceptance does not complete those gates.

## Pack identity

| Field | Value |
|---|---|
| pack_id | `pack_ncr-2026-10` |
| local file | `data/raw/out/pack.sqlite` (gitignored) |
| pack_sha256 | `3859023cfd63573c1a25f63b567897a7b96a16f98a67b3dce9b6abf34c362e2d` |
| pack_bytes | 811,008 |
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

## Acceptance results (24/24)

| Category | Passed | Evidence |
|---|---:|---|
| integrity | 3/3 | SQLite integrity/foreign keys/schema version; companion metadata, bytes and checksum; raw snapshot identity, counts and evidence locators |
| invalid-record | 12/12 | Manifest/disposition reconciliation, record validation and invalid-record mutation fixtures |
| ambiguity | 4/4 | Pack ambiguity validation and mutation fixtures; ambiguous aliases cannot become unique resolutions |
| source-content | 5/5 | Pack text scan and mutations for raw source URLs, dataset imports, six-word source copies and handles (INV-4) |

The source-content scan rejects raw URLs, dataset imports/schema references, six consecutive normalized source words and handles/profile links. The same Member 4 shipped-tree checker also validates the staged seed before publication. It cannot establish the absence of shorter copied fragments or bare usernames where source author metadata is absent. No field-verification claim follows from these checks.

## Reproduction and validation

Run the pipeline from the repository root:

```sh
node tools/corpus/run-pipeline.mjs
```

It freezes/validates the pre-cleaned reference, audits and extracts, runs deterministic evidence and heuristic quarantine, resolves places, emits eligible records, builds and accepts the pack, then validates/promotes the cleaned seed and runs the Member 4 shipped-tree check. It does not perform actual AI review or human sign-off.

To recheck the existing pack without regenerating outputs:

```sh
node tools/pack-builder/acceptance.mjs --pack data/raw/out/pack.sqlite --raw howtogetthereph_dataset/ncr_routes.json
```

Validation after the INV-4 fix:

- Full pipeline on Node `v24.5.0` / SQLite `3.50.3`: acceptance **24/24 passed** and shipped-tree INV-4 **zero findings**.
- Latest main corpus/pack CI command on Node `v22.23.3`: **160/160 passed**, including real-seed SQLite/core smoke and publication rollback.
- Latest main workspace tests on Windows: **641/641 passed**; workspace typecheck passed.
- Node `v22.23.3` builder-compatible asset-loader checks: **81/81 passed**.
- Shipped-tree scan: **183 files / zero findings**, plus explicit inventory of **57 asset inputs**; shipping-policy fixtures **21/21 passed**.
- Rebuilding from promoted seed inputs with Node `v24.5.0` / SQLite `3.50.3` reproduced all four builder outputs byte for byte.
- Original raw input and frozen reference are unchanged; source IDs, dates, evidence locators and every non-source eligible table are unchanged.
- The prior 22-check/55-pack-test validation predates this INV-4 fix; its historical report is `tools/corpus/helper-seed-final-validation.md`.

The explicit corpus/pack-builder glob command above works in PowerShell; the root `npm test` covers workspace suites separately.

## Remaining acceptance gates

- Actual AI review for T12 and designated human decisions on the effective queue remain pending; agents never set `accepted`.
- Source-backed T26 evaluation and reviewer sign-off remain pending, so T16 stays unchecked.
- Unsupported coordinates remain unmapped; source-post dates are not verification dates.
- Pre-cleaned reference: `data/reference/howtogetthereph_dataset-precleaned/`; cleaned handoff: `data/seed/`.
- The original seed/integration handoff merged in PR #25. The INV-4 follow-up is prepared on `fix-seed-inv4`; repository-hosted checks and review follow publication.
