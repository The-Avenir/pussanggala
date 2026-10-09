# T12 evidence pass — counts

Snapshot `d3939475ebd250755fcdac776f703001480aeaa4b72d04b025fba54434c4fdf3`. 6640 candidates checked deterministically (part A). Counts only; no source text.

## Review state × record kind

| state | place | ride | walk | fare | hours | service_status | note | total |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| second_passed | 4090 | 1524 | 358 | 35 | 32 | 0 | 357 | 6396 |
| needs_review | 0 | 178 | 0 | 56 | 6 | 4 | 0 | 244 |
| rejected | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| accepted | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

## Flags

| flag | candidates | second_passed | needs_review | rejected |
| --- | ---: | ---: | ---: | ---: |
| hedged | 375 | 240 | 135 | 0 |
| question_missing | 337 | 251 | 86 | 0 |
| fare_unscoped | 46 | 20 | 26 | 0 |
| conflict | 44 | 0 | 44 | 0 |
| inactive_service | 4 | 0 | 4 | 0 |

Conflict pairs: 35.

## Review queue

144 posts / 244 items (119 posts with route-critical items), in data/raw/t12/review-queue.{jsonl,md} (not committed).

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
