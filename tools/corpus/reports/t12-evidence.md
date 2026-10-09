# T12 evidence pass — counts

Snapshot `d3939475ebd250755fcdac776f703001480aeaa4b72d04b025fba54434c4fdf3`. 19709 candidates checked deterministically (part A). Counts only; no source text.

## Review state × record kind

| state | place | ride | walk | fare | hours | service_status | note | total |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| second_passed | 11295 | 3695 | 1368 | 87 | 101 | 8 | 913 | 17467 |
| needs_review | 0 | 2097 | 64 | 54 | 15 | 11 | 0 | 2241 |
| rejected | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 1 |
| accepted | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

## Flags

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

## Review queue

1194 posts / 2241 items (1189 posts with route-critical items), in data/raw/t12/review-queue.{jsonl,md} (not committed).

## Reviewer instructions

1. Open data/raw/t12/review-queue.md (top posts) or review-queue.jsonl (all), follow the permalink and read the cited comment (comment_index = 0-based answers[] position; null = title/question).
2. Decide each item in data/raw/t12/reviewed-candidates.jsonl: set review_state to "accepted" or "rejected" (only the designated human reviewer may do this; agents never set accepted).
3. On every decision set reviewer_id to your member ID and reviewed_at to an ISO-8601 UTC timestamp (e.g. 2026-10-12T09:30:00Z); keep evidence_check and append your reason code to review_reason if it changes.
4. Conflicting fare/hour reports are not merged: accept each supported report separately (they stay distinct in the pack) and reject only unsupported ones.
5. Unresolved route-critical items (ride/walk/service_status) remain quarantined from the pack; suspended/retired services never route.
6. Never paste comment wording or usernames into payload fields — paraphrase in your own words (INV-4).

## Notes

- Second pass is a text-evidence check, not field verification; no field-verified badge.
- Place/board/alight/from/to grounding accepts ≥0.8 token overlap with the cited text or the post title/question; signboards must match the cited text.

## Part B — independent AI evidence audit

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
