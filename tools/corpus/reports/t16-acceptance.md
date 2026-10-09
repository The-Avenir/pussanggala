# T16 — corpus acceptance and handoff

**Verdict: ACCEPTANCE PASS (21/21 checks).** Reproduce:

```sh
node tools/corpus/eligible.mjs                       # T14 -> data/raw/t14/
node tools/pack-builder/build.mjs \                  # T15 -> data/raw/out/
  --eligible data/raw/t14/eligible \
  --dispositions data/raw/t14/dispositions.json \
  --run data/raw/t14/run.json \
  --raw howtogetthereph_dataset/ncr_routes.json \
  --out data/raw/out
node tools/pack-builder/acceptance.mjs \             # T16
  --pack data/raw/out/pack.sqlite \
  --raw howtogetthereph_dataset/ncr_routes.json
```

## Pack identity

| field | value |
|---|---|
| pack_id | `pack_ncr-2026-10` |
| file | `data/raw/out/pack.sqlite` (2,473,984 bytes, gitignored) |
| pack_sha256 | `e43a45985ed0f826187ef5ee2b8201ccaa4652647ad3f8544cff27d81b4b7df0` |
| schema_version | 1 |
| input_sha256 | `d393…fdf3` (ncr_routes.json) |
| source dates | 2026-04-09 → 2026-10-10 (post dates, not verification dates) |

## What shipped

598 legs on 324 routes across 88 stops / 91 places (271 aliases, 50 ambiguity rows),
42 walk links, 5 fare reports, 14 hours reports, 911 notes, 6,364 provenance links.
Graph eligibility: **559 ready legs / 39 excluded**; 40 ready walk links / 2 excluded;
86 ready place_stops / 2 excluded. Post dispositions: 1,186 included · 552 pending ·
383 rejected · 65 filtered (sum = 2,186 answered posts).

## Acceptance results (21/21)

- **integrity** 2/2 — SQLite integrity + FK check, external `pack_sha256` in companion.
- **invalid-record** 12/12 — manifest reconciliation, record checks, and all negative
  fixtures rejected (dangling FK, inverted fare range, two-owner shape, owner-less
  note_link, unpaired coords, negative duration, missing provenance, ready leg on
  suspended route, ready access to outside-NCR place, bad ID prefix).
- **ambiguity** 4/4 — no ambiguous alias leaks into `place_alias`; ambiguity rows hold
  ≥2 distinct places.
- **source-content** 3/3 — zero 6-word copies and zero handles in pack text (INV-4).

`tools/pack-builder/lib/mutations.mjs` was patched so negative fixtures synthesize
their own target rows when the pack legitimately lacks one (real pack has no shapes,
no note_links, no mapped places) — previously three fixtures crashed as "not
applicable". All 19 pack-builder tests still pass; `tools/corpus` suite green
(9 new eligible tests included).

## Handoff notes for Member 2 (T26 evaluation)

- **Loader input:** `pack.sqlite` + `pack.manifest.json` under `data/raw/out/`
  (gitignored — rebuild with the commands above; output is deterministic).
- **Every `route.service_status` is `unknown`.** No service-status claim survived
  grounding; treat all routes as unverified. Nothing in the pack asserts a route is
  currently running.
- **No geometry anywhere.** All 91 places are `mapping_status = unmapped`,
  `lat`/`lng` null; `shape` is empty. The region boundary is the declared bbox
  envelope (`120.90,14.35,121.15,14.80`), not a licensed administrative boundary.
- **`fare_report.effective_at` is the post date** — a historical report, never a
  current fare (INV). `hours_report` likewise describes reported hours.
- **Excluded rows are load-bearing.** 39 excluded legs mostly touch the two
  non-accepted places (cross-LGU EDSA corridor, Welcome Rotonda) — the evaluator
  must honor `eligibility = 'excluded'`, not just read the tables flat.
- **Review debt carried forward:** 2,241 candidates remain `needs_review` and are
  absent from this pack (their posts are `pending`/`rejected` in dispositions).
  A deeper gazetteer pass is the lever for T14 v2 — 73% of ride drops were
  unresolved or ambiguous place names.
- **Ambiguity is queryable:** `place_ambiguity` (50 rows / 23 alias norms) is the
  disambiguation contract for T21-style "which Cubao?" prompts.
