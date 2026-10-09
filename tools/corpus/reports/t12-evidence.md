# T12 evidence pass — counts

Snapshot `d3939475ebd250755fcdac776f703001480aeaa4b72d04b025fba54434c4fdf3`. 5713 candidates checked deterministically (part A). Counts only; no source text.

## Review state × record kind

| state | place | ride | walk | fare | hours | service_status | note | total |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| second_passed | 4088 | 961 | 205 | 29 | 24 | 0 | 276 | 5583 |
| needs_review | 0 | 91 | 0 | 31 | 4 | 4 | 0 | 130 |
| rejected | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| accepted | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

## Flags

| flag | candidates | second_passed | needs_review | rejected |
| --- | ---: | ---: | ---: | ---: |
| question_missing | 299 | 241 | 58 | 0 |
| hedged | 264 | 209 | 55 | 0 |
| fare_unscoped | 51 | 21 | 30 | 0 |
| conflict | 25 | 0 | 25 | 0 |
| inactive_service | 4 | 0 | 4 | 0 |

Conflict pairs: 14.

## Review queue

85 posts / 130 items (70 posts with route-critical items), in data/raw/t12/review-queue.{jsonl,md} (not committed).

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

Independent audit of 313 sampled candidates (seed 20261009): 292 supported, 21 flagged to needs_review. Counts only; no source text.

| record_kind | sampled | supported | flagged | defect_rate |
| --- | ---: | ---: | ---: | ---: |
| ride | 200 | 200 | 0 | 0% |
| walk | 60 | 60 | 0 | 0% |
| fare | 29 | 8 | 21 | 72.4% |
| hours | 24 | 24 | 0 | 0% |
| service_status | 0 | 0 | 0 | 0% |

Flagged by reason_code:

| reason_code | count |
| --- | ---: |
| fare_unscoped | 21 |

Effective review-state totals after overrides: second_passed 5562, needs_review 151.

- This pass only quarantines: it never set accepted or rejected, so the designated human reviewer still owns every queued item.
- The deterministic part-A pass held up well for ride and walk records but was systematically weak on fare and hours value semantics, where almost all defects concentrate.
- The dominant failure modes are open-ended or approximate amounts recorded as exact, fares carrying no ride scope, and clock values hardened out of hedged or asker-supplied statements.
