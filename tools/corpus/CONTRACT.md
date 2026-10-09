# tools/corpus — Member 1 pipeline contract

Shared by T10–T16. Follows SDD §1.2 (intermediates) and §3.2 (pack entities), and the
draft T00 contracts in PR #3 (`packages/core/src/schema/pack.ts`, `ids.ts`). If PR #3
changes before merge, reconcile this file first.

## Input

- `howtogetthereph_dataset/ncr_routes.json`, snapshot sha256
  `d3939475ebd250755fcdac776f703001480aeaa4b72d04b025fba54434c4fdf3`.
- Evidence locator = `(snapshot_sha256, post_id, comment_index)`. `comment_index` is the
  0-based position in `answers[]`; it is snapshot-specific, not a Reddit comment ID.

## Where things go

| Path | Git | Contents |
|------|-----|----------|
| `data/raw/` | ignored | Shards, intermediates, review queue, raw-quoting evidence, progress |
| `data/raw/progress/<task>.json` | ignored | `{task, percent, status, note}` — read with `node tools/corpus/progress.mjs` |
| `tools/corpus/`, `tools/pack-builder/` | committed | Code and docs only |
| `data/seed/` | committed | Reviewed facts and paraphrases only — no raw wording, no usernames (INV-4) |
| `data/raw/out/` | ignored | Built `pack.sqlite`, companion manifest, reports |

## T11 candidate record (one JSON object per line, `data/raw/t11/candidates-s<N>.jsonl`)

```json
{
  "candidate_id": "c_<post_id>_<comment_index>_<n>",
  "snapshot_sha256": "d393…fdf3",
  "post_id": "1uorpcg",
  "comment_index": 0,
  "record_kind": "place|ride|walk|fare|hours|service_status|note",
  "candidate_payload": { },
  "evidence_check": null,
  "review_reason": null,
  "review_state": "extracted",
  "reviewer_id": null,
  "reviewed_at": null
}
```

`comment_index` is `null` only for facts taken from the question title/body.

Payloads (unknown stays `null`; never guess):

| record_kind | candidate_payload |
|-------------|-------------------|
| place | `{name, kind (landmark/mall/school/station/terminal/area/other), area_text\|null, city\|null, role (origin/destination/stop/landmark)}` |
| ride | `{mode (jeepney/modern_jeepney/uv_express/bus/tricycle/rail\|null), signboard\|null, board_place, alight_place, direction_text\|null, ride_min\|null}` |
| walk | `{from_place, to_place, walk_text (paraphrase), walk_m\|null, walk_min\|null}` |
| fare | `{applies_to_ride (candidate_id of ride in same post) \|null, amount_min, amount_max, currency:"PHP"}` |
| hours | `{applies_to_ride\|null, hours_text (paraphrase), starts_local "HH:MM"\|null, ends_local\|null, days_text\|null}` |
| service_status | `{applies_to_ride\|null, status (reported_active/suspended/retired/unknown)}` |
| note | `{body (paraphrase), kind (tip/warning/conflict)}` |

Text fields that end up in the pack (`walk_text`, `hours_text`, note `body`) must be
**paraphrased in our own words** — never copied phrases of 6+ words from the source,
never usernames or `u/` handles.

## T11 post outcome (one line per post, `data/raw/t11/outcomes-s<N>.jsonl`)

`{post_id, outcome, candidate_count, reason}` where outcome is one of
`route_evidence` (≥1 ride/walk candidate), `partial_evidence` (places/fares/notes only),
`no_route_evidence` (acknowledgements, follow-up questions, off-topic, commuting advice
with no extractable fact). Every answered post gets exactly one outcome line.

## Review states (SDD §1.2)

`extracted → second_passed | needs_review | rejected`; `needs_review → accepted | rejected`
by the designated human reviewer only. Agents never set `accepted`.
`second_passed` is pack-eligible only if deterministic builder checks also pass.

## Stable IDs (draft T00 `ids.ts`)

Regex `^[a-z]{2,3}_[a-z0-9][a-z0-9_-]{0,63}$`, prefixes `rg pl st ac rt lg wk fr hr sh nt src`.
Derive IDs deterministically from normalized content (slug + short hash) so rebuilds of
the same snapshot produce the same IDs.
