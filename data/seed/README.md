# data/seed — cleaned eligible pack inputs

**Owner:** Member 1. Promoted from T14 by `tools/corpus/promote-seed.mjs`.

## Contents

| Path | Purpose |
|------|---------|
| `eligible/*.json` | Pack tables (places, routes, legs, …) — paraphrases only |
| `dispositions.json` | Per-post disposition |
| `run.json` | Build run metadata |
| `pack.sha256` | Checksum of last built `data/raw/out/pack.sqlite` (file itself gitignored) |
| `HANDOFF.json` | Machine-readable handoff note |

## Guardrails

- No raw Reddit wording/usernames (INV-4).
- Unknown fares/times stay unknown; conflicts preserved (INV-5).
- Human `needs_review` queue is **not** auto-accepted.
- Pre-cleaned raw snapshot reference: `data/reference/howtogetthereph_dataset-precleaned/` (see freeze script).

## Rebuild

```sh
node tools/corpus/run-pipeline.mjs
# or promote only after T14/T15:
node tools/corpus/promote-seed.mjs
```
