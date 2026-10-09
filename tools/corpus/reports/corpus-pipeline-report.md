# Member 1 — corpus and evidence pipeline report (T10–T16)

**Snapshot** `d3939475ebd250755fcdac776f703001480aeaa4b72d04b025fba54434c4fdf3` (`howtogetthereph_dataset/ncr_routes.json`)
**Scope** T10–T16 (audit → extract → evidence → places → eligible → pack → acceptance → seed)
**Status** Pipeline and technical acceptance completed on `feat/t14-t16-seed-handoff` via `node tools/corpus/run-pipeline.mjs`; INV-4 raw-URL shipping fix validated on base `44fe8657f7e9a1304cf1f58642a4d0524f2b26c3`.

T11's grounded extractor produced **5,713 candidates** across 2,186 answered posts, each with one outcome.
T12 part A (deterministic): **5,583 `second_passed` / 130 `needs_review` / 0 rejected / 0 accepted**.
Heuristic part B sampled **313** and quarantined **21**; this is deterministic screening, not independent AI review or a source-supported judgment.
Effective states after overrides: **5,562 `second_passed` / 151 `needs_review` / 0 rejected / 0 accepted**; human queue **151 items across 106 posts**.
T14 uses the effective review state including `ai_override`, so quarantined candidates cannot enter eligible tables.

Final pack: **134 legs / 69 routes / 59 stops / 91 places / 21 walk links / 0 fare reports / 0 hours reports / 276 notes / 1,719 provenance links**.
Answered-post dispositions: **405 included / 91 pending / 497 rejected / 1,193 filtered = 2,186**.
Pack SHA-256: `3859023cfd63573c1a25f63b567897a7b96a16f98a67b3dce9b6abf34c362e2d`; size **811,008 bytes**.
Parent runtime: Node `v24.5.0` / SQLite writer `3.50.3`. Schema SQL is normalized to LF; byte reproducibility requires the same source and SQLite writer runtime.
Acceptance: **24/24 PASS** (integrity 3/3, invalid-record 12/12, ambiguity 4/4, source-content 5/5).
Final reproduction and validation evidence: [T16 acceptance](t16-acceptance.md).

Cleaned handoff: `data/seed/`. Pre-clean reference: `data/reference/howtogetthereph_dataset-precleaned/`.
T12 actual AI review and designated human decisions remain pending; T16 source-backed T26 evaluation and reviewer sign-off remain pending.
Agents never set `accepted`; no field-verified badge is claimed. The narrative below is an earlier snapshot, not current validation evidence.

---

## Historical T10–T13 narrative (below)

The sections below retain the earlier combined narrative for the first pipeline pass.
Live counts for the current extractor are in `t10-audit.*`, `t12-evidence.*`, `t13-places.*`,
`t14-eligible.md`, and `t16-acceptance.md`.

**Snapshot** `d3939475ebd250755fcdac776f703001480aeaa4b72d04b025fba54434c4fdf3` (`howtogetthereph_dataset/ncr_routes.json`)
**Scope** T10 input audit · T11 extraction · T12 evidence pass · T13 canonical places
**Status** T10 done · T11 done · T12 done · T13 engine done, curation partial

This file concatenates the per-task reports that the pipeline generates. Each section below is
reproduced verbatim from its source report; regenerate them with the commands in §Reproducing.
Counts only — no source wording, post titles or usernames appear anywhere in this document (INV-4).

## Executive summary

| Task | Result |
|------|--------|
| **T10** input audit | 3,480 NCR posts / 2,186 answered / 1,294 unanswered / 3,988 stored answers; snapshot hashed; assertions **PASS**. Two README totals do not match the stored data (they count `answer_count`, not stored answers). |
| **T11** extraction | 19,709 candidate records across all 2,186 answered posts; every answered post has exactly one outcome. |
| **T12** evidence pass | Part A (deterministic): 17,467 `second_passed`, 2,241 `needs_review`, 1 `rejected`, 12 conflict pairs. Part B (independent AI audit of a 415-candidate stratified sample): **366 supported, 49 quarantined**. |
| **T13** canonical places | 91 canonical places, 271 aliases, 23 ambiguous aliases, 4,833 unresolved alias forms; **37.3%** of place mentions resolved. All places `unmapped` — this repo has no geodata source. |

### What the T12 part B audit found

The deterministic pass is reliable for route **structure** but systematically weak on **value
semantics**. Defects concentrate almost entirely in fare and hours records:

| record kind | sampled | supported | flagged | defect rate |
|---|---:|---:|---:|---:|
| ride | 200 | 192 | 8 | 4.0% |
| walk | 60 | 59 | 1 | 1.7% |
| **fare** | 87 | 58 | **29** | **33.3%** |
| **hours** | 60 | 49 | **11** | **18.3%** |
| service_status | 8 | 8 | 0 | 0% |
| **total** | **415** | **366** | **49** | **11.8%** |

Three dominant failure modes, all of which would have produced confident-looking but wrong
numbers in the shipped pack:

1. **Open-ended or approximate amounts recorded as exact.** Sources reading "40+", "~50",
   "150 ish" or "around 90" became hard single values.
2. **Fares carrying no ride scope** (11 cases). Includes one multi-leg route *total* recorded as a
   segment fare, which contradicts `basis = reported_segment` in the pack schema.
3. **Clock values hardened out of hedged or asker-supplied statements.** Includes a source that
   said *12pm* being silently resolved to midnight, and one hours record attached to the wrong ride.

### Review gate — unchanged

Part B only ever moved records `second_passed → needs_review`. It never set `accepted` or
`rejected`, so the contract rule that **only the designated human reviewer may accept** still
holds. The consequence is that the human review queue **grew from 2,241 to 2,290 items** and
remains entirely outstanding. No record in this pipeline has been signed off by an agent.

### Known limitations

- **No coordinates anywhere.** There is no geodata, gazetteer feed or licensed coordinate source in
  this repository, so all 91 places are `mapping_status = unmapped`. No coordinate was estimated
  or recalled from memory; mapping waits on a licensed/geography source.
- **Place coverage is 37.3%**, not the review queue, is currently the binding constraint on how much
  of the graph T14 can build. The uncurated long tail is 4,833 alias forms, led by generic words
  ("landmark", "post office") and real places deliberately left unresolved rather than guessed.
- **Ambiguous names are split, never guessed.** "cubao" resolves to three distinct real places
  (MRT-3 station, LRT-2 station, Araneta City) and "buendia" to three (LRT-1 Gil Puyat in Pasay,
  MRT-3 Buendia in Makati, the avenue). These go to `place_ambiguity` so routing must ask the user.
- T12 part A's own counts are a text-evidence check, not field verification. Nothing here is a
  physical-verification claim and no record carries a verified badge.

## Reproducing

```sh
node tools/corpus/audit.mjs                  # T10 -> reports/t10-audit.{json,md}
node tools/corpus/evidence.mjs               # T12 part A -> reports/t12-evidence.{json,md}
node tools/corpus/ai-sample.mjs --summary    # T12 part B sample composition
node tools/corpus/ai-apply.mjs               # T12 part B -> appends to t12-evidence.{json,md}
node tools/corpus/places.mjs                 # T13 -> reports/t13-places.{json,md}
node --test "tools/corpus/*.test.mjs"        # 22 tests
```

All generators are deterministic: a re-run over the same snapshot is byte-identical.
Part B verdicts are the committed data file `tools/corpus/ai-verdicts.json`; `ai-apply.mjs`
validates every entry against the live redrawn sample and refuses to run if they disagree.

---

## T10 — NCR input audit (metadata only)

Generated by `node tools/corpus/audit.mjs`. Counts only; no source wording, titles or usernames. Per-post ID lists are in `data/raw/t10/` (gitignored).

Assertions: **PASS**

### Input hashes

| File | Bytes | sha256 |
| --- | ---: | --- |
| `ncr_routes.json` | 2695540 | `d3939475ebd250755fcdac776f703001480aeaa4b72d04b025fba54434c4fdf3` |
| `routes.json` | 10904223 | `3df4b15c7fca9d896c0e7d15f8b380988795a7286cee001af2db50e6ca20c4a1` |
| `ncr_routes.csv` | 1017945 | `6efa7285b853de3f7c4403181cc21575a7e7d93c5cc81af354efb657ed2a02f3` |
| `routes.csv` | 2951163 | `2f5dc8aee3c822ef1a97351a26796222a6478f2409fb6b7df76b637aaac567d6` |
| `README.md` | 1109 | `1cc55c8aa666cc22115d1e6980d24d36ecc7bee7b3b926e32841729f92777e3e` |

### Counts

| Input | Posts | With stored answers | Without | Stored answer texts |
| --- | ---: | ---: | ---: | ---: |
| ncr_routes.json | 3480 | 2186 | 1294 | 3988 |
| routes.json | 16387 | 8556 | 7831 | 15350 |

CSV rows: ncr_routes.csv 3480, routes.csv 8556. NCR post IDs also in routes.json: 3480/3480.

### README discrepancies

- NCR answers total: README 3989, actual 3988 (sum of `answer_count` field = 3989). README total equals the sum of the answer_count field; one or more posts have answer_count greater than stored answers[] length (answers capped at 12).
- All-posts answers total: README 15395, actual 15350 (sum of `answer_count` field = 15395).

### Fields

Post keys: `answer_count`, `answers`, `created_utc`, `destination`, `id`, `num_comments`, `origin`, `permalink`, `question`, `score`, `title`.
Answer keys: `score`, `text`.

| Post field | present | missing | null | empty |
| --- | ---: | ---: | ---: | ---: |
| `answer_count` | 3480 | 0 | 0 | 0 |
| `answers` | 2186 | 0 | 0 | 1294 |
| `created_utc` | 3480 | 0 | 0 | 0 |
| `destination` | 3480 | 0 | 0 | 0 |
| `id` | 3480 | 0 | 0 | 0 |
| `num_comments` | 3480 | 0 | 0 | 0 |
| `origin` | 3480 | 0 | 0 | 0 |
| `permalink` | 3480 | 0 | 0 | 0 |
| `question` | 3480 | 0 | 0 | 0 |
| `score` | 3480 | 0 | 0 | 0 |
| `title` | 3480 | 0 | 0 | 0 |
| answer `score` | 3988 | 0 | 0 | 0 |
| answer `text` | 3988 | 0 | 0 | 0 |

Confirmed absent (no such field): comment_ids=absent, comment_dates=absent, reply_parent=absent, comment_author=absent, coordinates=absent, structured_stops=absent, fares=absent, post_author=absent.

### Missing question text

null 0, empty 0, `[deleted]` 2, `[removed]` 615 — total 617; of these 121 still have stored answers. Missing titles 0; missing answer texts 0; missing origin 0, destination 0.

### Truncation heuristics

| Text | n | min | p50 | p90 | p99 | max | at max | ends …/... | no terminal punct | dangling connector |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| answers | 3988 | 1 | 124 | 333 | 738 | 2098 | 1 | 2 | 1643 | 14 |
| questions | 2863 | 1 | 115 | 261 | 602 | 1251 | 1 | 3 | 770 | 3 |

Answer length histogram: 0-14: 131, 15-49: 544, 50-99: 925, 100-199: 1320, 200-499: 951, 500-999: 104, 1000-1999: 12, 2000-inf: 1.

CSV `top_answer` vs JSON (ncr_routes.csv, 3480 rows): empty top_answer 1294; equals JSON first answer 2165; equals highest-score answer 2165; equals some answer 2165; truncated prefix of an answer 21; matches no answer 0; non-empty top but JSON unanswered 0. CSV IDs missing from JSON 0; JSON IDs missing from CSV 0. CSV `answers` column equals JSON `answer_count` for 3480 rows and `answers.length` for 3479. CSV top_answer length max 800 with 16 rows exactly at max (apparent CSV length cap; JSON answers have no such cap).

### Outside-NCR labels (heuristic inventory)

Posts flagged: 8 (origin 0, destination 8, title 8; origin-or-destination 8; both endpoints 0; flagged with stored answers 6). Keyword list (117 terms) is `OUTSIDE_NCR_KEYWORDS` in `audit.mjs`. Not a membership decision — T13 decides via geography evidence.

Top keywords: la union 3, cainta 1, san pablo 1, san mateo 1, tanza 1, kawit 1.

### Dates, comment counts, duplicates

created_utc range: 2026-04-09T00:28:19.000Z → 2026-10-09T08:07:56.000Z.

Sum of `answers.length` 3988; sum of `answer_count` 3989; sum of `num_comments` 8215. `answer_count` ≠ `answers.length`: 1 (greater 1, less 0). `num_comments` < `answers.length`: 68; `num_comments` = 0 with answers: 0. Posts at the 12-answer cap: 2.

Duplicate post IDs: 0; duplicate permalinks: 0.

### Short / acknowledgement answers

< 15 chars: 131; thanks/salamat-style pattern: 8; either: 131. Answered posts whose answers are all short/ack: 26.

<sub>Source: `tools/corpus/reports/t10-audit.md`</sub>

## T12 evidence pass — counts

Snapshot `d3939475ebd250755fcdac776f703001480aeaa4b72d04b025fba54434c4fdf3`. 19709 candidates checked deterministically (part A). Counts only; no source text.

### Review state × record kind

| state | place | ride | walk | fare | hours | service_status | note | total |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| second_passed | 11295 | 3695 | 1368 | 87 | 101 | 8 | 913 | 17467 |
| needs_review | 0 | 2097 | 64 | 54 | 15 | 11 | 0 | 2241 |
| rejected | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 1 |
| accepted | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

### Flags

| flag | candidates | second_passed | needs_review | rejected |
| --- | ---: | ---: | ---: | ---: |
| incomplete_connection | 1383 | 0 | 1383 | 0 |
| hedged | 1123 | 727 | 396 | 0 |
| question_missing | 968 | 667 | 301 | 0 |
| long_identifier | 689 | 475 | 214 | 0 |
| value_not_in_source | 438 | 0 | 438 | 0 |
| fare_unscoped | 23 | 12 | 11 | 0 |
| conflict | 18 | 0 | 18 | 0 |
| inactive_service | 11 | 0 | 11 | 0 |
| fare_open_range | 1 | 1 | 0 | 0 |
| raw_wording | 1 | 0 | 0 | 1 |

Conflict pairs: 12.

### Review queue

1194 posts / 2241 items (1189 posts with route-critical items), in data/raw/t12/review-queue.{jsonl,md} (not committed).

### Reviewer instructions

1. Open data/raw/t12/review-queue.md (top posts) or review-queue.jsonl (all), follow the permalink and read the cited comment (comment_index = 0-based answers[] position; null = title/question).
2. Decide each item in data/raw/t12/reviewed-candidates.jsonl: set review_state to "accepted" or "rejected" (only the designated human reviewer may do this; agents never set accepted).
3. On every decision set reviewer_id to your member ID and reviewed_at to an ISO-8601 UTC timestamp (e.g. 2026-10-12T09:30:00Z); keep evidence_check and append your reason code to review_reason if it changes.
4. Conflicting fare/hour reports are not merged: accept each supported report separately (they stay distinct in the pack) and reject only unsupported ones.
5. Unresolved route-critical items (ride/walk/service_status) remain quarantined from the pack; suspended/retired services never route.
6. Never paste comment wording or usernames into payload fields — paraphrase in your own words (INV-4).

### Notes

- Second pass is a text-evidence check, not field verification; no field-verified badge.
- Place/board/alight/from/to grounding accepts ≥0.8 token overlap with the cited text or the post title/question; signboards must match the cited text.

### Part B — independent AI evidence audit

Independent audit of 415 sampled candidates (seed 20261009): 366 supported, 49 flagged to needs_review. Counts only; no source text.

| record_kind | sampled | supported | flagged | defect_rate |
| --- | ---: | ---: | ---: | ---: |
| ride | 200 | 192 | 8 | 4% |
| walk | 60 | 59 | 1 | 1.7% |
| fare | 87 | 58 | 29 | 33.3% |
| hours | 60 | 49 | 11 | 18.3% |
| service_status | 8 | 8 | 0 | 0% |

Flagged by reason_code:

| reason_code | count |
| --- | ---: |
| fare_unscoped | 11 |
| fare_approximate_as_exact | 4 |
| fare_open_range_as_exact | 4 |
| fare_cross_comment_scope_unclear | 3 |
| fare_hedged | 3 |
| question_premise_as_hours_fact | 3 |
| fare_conditional_compressed | 2 |
| question_premise_unconfirmed | 2 |
| alight_inferred | 1 |
| alight_not_stated | 1 |
| board_place_not_a_place | 1 |
| direction_text_mismatch | 1 |
| fare_discount_scope_lost | 1 |
| fare_is_route_total | 1 |
| hours_ambiguous_clock_resolved | 1 |
| hours_guess_hardened | 1 |
| hours_hearsay_in_question | 1 |
| hours_hedged_mode_mismatch | 1 |
| hours_linked_to_wrong_ride | 1 |
| hours_scope_upstream_terminal | 1 |
| hours_text_adds_unsourced_detail | 1 |
| hours_two_values_in_days_text | 1 |
| incomplete_connection | 1 |
| ride_fields_from_question_only | 1 |
| walk_text_adds_unsourced_duration | 1 |

Effective review-state totals after overrides: second_passed 17418, needs_review 2290, rejected 1.

- This pass only quarantines: it never set accepted or rejected, so the designated human reviewer still owns every queued item.
- The deterministic part-A pass held up well for ride and walk records but was systematically weak on fare and hours value semantics, where almost all defects concentrate.
- The dominant failure modes are open-ended or approximate amounts recorded as exact, fares carrying no ride scope, and clock values hardened out of hedged or asker-supplied statements.

<sub>Source: `tools/corpus/reports/t12-evidence.md`</sub>

## T13 places engine — counts

Snapshot `d3939475ebd250755fcdac776f703001480aeaa4b72d04b025fba54434c4fdf3`. 21326 place-name mentions across 5125 distinct normalized aliases. Counts only; no source text.

### Resolution

| bucket | count |
| --- | ---: |
| canonical places | 91 |
| aliases resolved | 271 (269 observed) |
| ambiguous aliases | 23 (50 place refs) |
| unresolved alias_norms | 4833 (11959 mentions) |
| coverage (resolved mentions / total) | 37.29% |

### Places by ncr_status

| ncr_status | places |
| --- | ---: |
| accepted | 89 |
| outside | 0 |
| ambiguous | 2 |

### Places by mapping_status

| mapping_status | places |
| --- | ---: |
| mapped | 0 |
| unmapped | 91 |
| needs_review | 0 |

### Mapping evidence

This repository contains no geodata, gazetteer feed or licensed coordinate source. Coordinates are therefore unmapped by default and no place carries a coordinate claim; any `lat`/`lng` present comes verbatim from the curated gazetteer together with its `mapping_source`. Mapping is deferred to a licensed/geography source.

### Limitations

- Unresolved aliases cannot serve as endpoints in T14; they are listed in data/raw/t13/unresolved.json (not committed) for gazetteer curation.

### Notes

- This repository contains no geodata or licensed coordinate source; lat/lng pass through the gazetteer verbatim and no coordinate is invented.
- Unresolved aliases are not pack-eligible endpoints; T14 cannot route to or from them.
- The dataset's own NCR label or bounding box is never used for ncr_status; membership is the curated city field only.

<sub>Source: `tools/corpus/reports/t13-places.md`</sub>
