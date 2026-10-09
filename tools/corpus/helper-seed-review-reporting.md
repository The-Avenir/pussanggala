# Seed review reporting helper

Completed in the Orca child `seed-review-reporting` from parent integration baseline `2e2cf33`, for task `task_ded3e3dd0add` / dispatch `ctx_2ea3081c7213` in `run_297428727054`.

Source commit: `2b71b7189ee27a30025fbcf7764109706d530d75` (`fix(corpus): honor quarantine overrides and report heuristic provenance`). This report is committed separately.

## Changes

- `ai-apply.mjs` distinguishes `heuristic-part-B` rule screens from reader source audits. Heuristic sample lines and counts use `unflagged` and `flag_rate_pct`; unflagged means no rule fired. Reader audits retain `supported`, `defect_rate_pct`, the independent-audit heading, and reader-supplied notes. Heuristic reports use factual rule-screen notes instead of inherited reader conclusions.
- Sample lines, overrides, and Part B reports carry the judge and `audit_kind`; reports and overrides also retain the audit timestamp. Old independent-audit headings are replaced when switching to heuristic reporting, and either heading remains single on repeated runs.
- `eligible.mjs` applies restrictive overrides inside `buildEligible`, so both CLI and pure callers quarantine overridden candidates. Base accepted, rejected, and pending states cannot be promoted. Unexpected promotion override values on a second-passed candidate fail closed into pending. Pending inactive-service claims retain the existing route-suppression behavior.
- `ai-apply.mjs` preserves base states for deterministic sampling and rebuilds both effective queue artifacts using the existing evidence queue builder. Override reason codes appear in item reasons and summaries. The effective Markdown digest includes every queued post, including overrides below the former top-100 cutoff.
- Part B records effective queue counts and queued override reasons, alongside explicitly separate Part A state and queue counts. Part A report fields and Markdown remain intact. `evidence.mjs` only exports the existing Markdown queue renderer and adds override prompts to summaries; ordinary Part A behavior is unchanged.

No AI verdict, raw snapshot, tracked generated report, seed artifact, PR, parent checkout, or other owned source file was changed. No record was accepted and no human decision field was populated.

## Validation

Node: `v26.11.1`, Windows PowerShell.

| Check | Exact result |
|---|---|
| `node --test tools/corpus/ai-apply.test.mjs tools/corpus/eligible.test.mjs` | Exit 0; 23 tests passed, 0 failed, 0 skipped |
| `node --test --test-skip-pattern='audit script exits 0 and regenerates reports' tools/corpus/*.test.mjs` | Exit 0; 100 tests passed, 0 failed; the pattern excludes the one test that overwrites tracked T10 reports before registration |
| Isolated T10 audit tests | Exit 0; all 3 tests passed, including the excluded report-regeneration test |
| Snapshot T12–T14 smoke run with frozen verdicts | Exit 0; all 21 override IDs queued; T14 effective state counts agree; all six T12 output/report files byte-identical on repeat |
| `git diff --check` | Exit 0 |

The corpus run uses ignored T11 inputs regenerated only in this child, with extraction progress writes disabled: 5,713 candidates across 2,186 answered posts. No prior T11 data existed and none was deleted. Existing evidence tests confirm fresh Part A output still matches the committed Part A report and contains no source wording. All new regressions use synthetic candidate/post metadata and payloads.

The report-writing T10 test was isolated because its default CLI modifies tracked reports. Unmodified `audit.mjs` and `audit.test.mjs` were copied into `data/raw/helper-audit-test-dmTPTX/tools/corpus`, with a read-only-use dataset junction pointing to this child's existing snapshot; all outputs remained under that ignored test root. Its three test cases plus the 100-case corpus run exercise all 101 distinct corpus tests, with the two audit read checks run twice.

The snapshot smoke used `data/raw/helper-review-smoke-lRmvZq`, ran evidence and application with explicit ignored output/report directories, then T13 and the T14 CLI with explicit ignored paths. It did not build or promote a seed. The repeated files were `reviewed-candidates.jsonl`, `ai-sample.jsonl`, `review-queue.jsonl`, `review-queue.md`, `t12-evidence.json`, and `t12-evidence.md`.

## Snapshot results

| Metric | Part A | Effective after Part B |
|---|---:|---:|
| second_passed candidates | 5,583 | 5,562 |
| needs_review candidates | 130 | 151 |
| queued posts | 85 | 106 |
| queued items | 130 | 151 |
| queued posts with route-critical items | 70 | 70 |

The frozen sample contains 313 candidates: 292 unflagged and 21 flagged by the `fare_unscoped` rule. All 21 overrides appear in the full JSONL queue and Markdown queue, with their reason codes. These are rule-screen counts, with no source-confirmation claim.

T14 reads 5,562 effective second-passed candidates and 151 pending candidates. Resolved post dispositions are 405 included, 91 pending, 497 rejected, and 1,193 filtered. Emission totals are 134 legs, 69 routes, 59 stops, 21 walk links, 0 fares, 0 hours, and 276 notes. Synthetic regressions additionally prove that an otherwise emittable resolved ride and scoped fare produce no graph/fare when overridden into pending, and that a quarantined fare alone cannot attach to an eligible ride.

## Integration remaining

Cursor owns cherry-picking the focused source commit and this separate report commit, regenerating the parent's T12 effective queues and generated reports, and reviewing any downstream disposition or handoff updates. The source commit was sent to the coordinator immediately after validation; this child leaves tracked generated reports and seed files unchanged. No push or PR action was taken.
