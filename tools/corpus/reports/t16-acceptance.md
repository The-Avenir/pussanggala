# T16 — corpus acceptance and handoff

**Verdict: ACCEPTANCE PASS (22/22 checks).** Regenerated 2026-10-10 on
`feat/t14-t16-seed-handoff` after grounded `extract.mjs` + heuristic-part-B.

Reproduce:

```sh
node tools/corpus/run-pipeline.mjs
# or step-wise:
node tools/corpus/eligible.mjs
node tools/pack-builder/build.mjs \
  --eligible data/raw/t14/eligible \
  --dispositions data/raw/t14/dispositions.json \
  --run data/raw/t14/run.json \
  --raw howtogetthereph_dataset/ncr_routes.json \
  --out data/raw/out
node tools/pack-builder/acceptance.mjs \
  --pack data/raw/out/pack.sqlite \
  --raw howtogetthereph_dataset/ncr_routes.json
node tools/corpus/promote-seed.mjs
```

## Pack identity

| field | value |
|---|---|
| pack_id | `pack_ncr-2026-10` |
| file | `data/raw/out/pack.sqlite` (gitignored; ~852 KB) |
| pack_sha256 | `737f2aebcc9a725d0500aba223987ac19d9136561e49ffc5ab92c5ea61911d41` |
| companion | `data/seed/pack.manifest.json` / `data/seed/pack.sha256` |
| schema_version | 1 |
| input_sha256 | `d3939475ebd250755fcdac776f703001480aeaa4b72d04b025fba54434c4fdf3` |
| source dates | 2026-04-09 → 2026-10-10 (post dates, not verification dates) |

## What shipped (eligible / seed)

134 legs on 69 routes across 59 stops / 91 places (271 aliases, 50 ambiguity rows),
21 walk links, 0 fare reports, 0 hours reports, 276 notes, 1,719 provenance links.
Post dispositions: **405 included · 75 pending · 502 rejected · 1,204 filtered**
(sum = 2,186 answered posts).

T11 after grounded extractor: **5,713** candidates. T12 part A: 5,583 `second_passed`,
130 `needs_review`, 0 rejected, 0 accepted. T12 part B: **heuristic-part-B** (not AI
judgment) sampled 313, flagged 21 → `needs_review` only.

## Acceptance results (22/22)

- **integrity** 3/3 — SQLite integrity + FK + companion checksum + raw snapshot identity.
- **invalid-record** 12/12 — manifest reconciliation, record checks, negative fixtures.
- **ambiguity** 4/4 — no ambiguous alias in unique `place_alias`.
- **source-content** 3/3 — zero 6-word copies and zero handles in pack text (INV-4).

## Honesty

- No field-verified badge. Agents never set `accepted`.
- Human review queue remains open for `needs_review` items.
- Pre-cleaned reference: `data/reference/howtogetthereph_dataset-precleaned/`.
- Cleaned handoff: `data/seed/` (INV-4).
