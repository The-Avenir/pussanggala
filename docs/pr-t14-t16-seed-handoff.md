# PR draft: `feat/t14-t16-seed-handoff` → `main`

Copy the **Title** and **Body** below when opening the pull request. No PR has been opened: `gh` authentication is unavailable and the browser is signed out. Only Cursor integrates and pushes the parent branch.

**Compare link (not a PR):** https://github.com/The-Avenir/pussanggala/compare/main...feat/t14-t16-seed-handoff?expand=1

## Title

```text
feat(corpus): quarantine review overrides and validate cleaned seed handoff
```

## Body

```markdown
## Summary

T14 previously read the deterministic `review_state` without applying `ai_override`, so a candidate quarantined by the heuristic pass could still enter eligible records. The gate now uses the effective state, the human queue includes those quarantines, and the rebuilt pack and cleaned seed agree with the final dispositions.

The grounded extractor processes every answered post without guessing missing connections or values. The pipeline preserves the pre-cleaned reference, validates provenance, schema, checksums and source-content constraints, and promotes only the allowlisted cleaned tables and metadata into `data/seed/`.

The pack builder normalizes schema SQL to LF, removing checkout line-ending differences from serialized DDL. Byte reproducibility requires the same source and SQLite writer runtime; different writer versions can change the checksum even when tables and manifest match.

## Rebuilt pack and evidence

- Validated parent commit: `e9318bd8c55344636619b99a6753ea134e343968`.
- Pack: `pack_ncr-2026-10`, schema 1; SHA-256 `9203234afd1b503186b607c28b16d758ae66fa8cd96a586a30c234a973f6bb10`; 851,968 bytes.
- Parent build runtime: Node `v24.5.0`, SQLite writer `3.50.3`.
- T11: 5,713 candidates across 2,186 answered posts, each with an outcome.
- T12 part A (deterministic): 5,583 `second_passed`, 130 `needs_review`, 0 rejected, 0 accepted.
- Heuristic part B: 313 sampled, 21 quarantined. This deterministic screen is not independent AI review or a source-supported judgment.
- Effective T12 states after overrides: 5,562 `second_passed`, 151 `needs_review`, 0 rejected, 0 accepted; queue 151 items across 106 posts.
- Eligible pack: 134 legs, 69 routes, 59 stops, 91 places, 271 aliases, 50 ambiguity rows, 21 walk links, 0 fare reports, 0 hours reports, 276 notes and 1,719 provenance links.
- Answered-post dispositions: 405 included, 91 pending, 497 rejected, 1,193 filtered; total 2,186.
- T16 technical acceptance: 22/22 passed — integrity 3/3, invalid-record 12/12, ambiguity 4/4, source-content 3/3.

## Validation

- Final `node tools/corpus/run-pipeline.mjs` on Node `v24.5.0` / SQLite `3.50.3`: acceptance **22/22 passed**.
- Final `node --test tools/pack-builder/*.test.mjs` on that runtime: **55/55 passed**, including the LF/CRLF schema regression and real-seed SQLite/core smoke.
- Final independent reconciliation: **13/13 assertions passed**; two seed-input rebuilds on the same writer runtime matched the parent SHA and byte size exactly. Seed tables/metadata and builder outputs agree; the explicit `promoted_at` timestamp differs between promotions.
- Before the final schema-normalization change, `node --test tools/corpus/*.test.mjs tools/pack-builder/*.test.mjs`: **155/155 passed**, with no failures or skips. The final changed pack suite above was rerun; the combined suite was not rerun after normalization.
- Before that DDL-only change, `npm test -w @pusang-gala/core`: **428/428 passed**; `npm run typecheck -w @pusang-gala/core`: **passed**. These suites were not repeated after normalization.

The root `npm test` runs workspace suites; corpus and pack-builder tests use the explicit command above. Acceptance evidence and reproduction commands are in `tools/corpus/reports/t16-acceptance.md`.

## Handoff and remaining gates

`data/reference/howtogetthereph_dataset-precleaned/` retains the pre-cleaned baseline; `data/raw/` holds ignored intermediates and the local SQLite pack; `data/seed/` contains the cleaned handoff.

Agents never set `accepted`; no field-verified badge is claimed, and unsupported coordinates remain unmapped. T12 remains open for actual AI review and designated human decisions. T16's pipeline and technical acceptance are complete, but source-backed T26 evaluation and reviewer sign-off remain pending.
```
