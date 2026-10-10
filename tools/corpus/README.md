# tools/corpus — Member 1 dataset audit, extraction and eligible handoff

**Owner:** Member 1 (corpus and evidence).

**Tasks:** T10–T16 (audit → extract → evidence → places → eligible → pack → acceptance → seed).

Guardrails (BUILD §5): no raw source URLs, Reddit wording, usernames or dataset imports in shipped outputs (INV-4);
no guessing missing walks, fares, hours or reply relationships; unknown values
stay unknown, source-post dates labelled accurately, suspended/retired services
excluded (INV-5); raw content never copied into app fixtures.

## One-shot pipeline

```sh
node tools/corpus/run-pipeline.mjs
```

Steps: freeze pre-cleaned reference → T10 audit → T11 extract → T12 evidence →
T13 places → T14 eligible → T15 pack build → T16 acceptance → promote `data/seed/`.

The pipeline regenerates heuristic T12 part-B verdicts for the current T11 IDs
and applies quarantines. This deterministic screen is not independent AI evidence
review; designated human decisions remain pending.

`curated-routes.json` supplements T11 with seven explicit NCR rail directions
and seven jeepney directions
missed by the automatic extractor. Each entry pins the snapshot, post, comment
index and comment hash; only endpoint aliases and mode are supplied. These enter
as `extracted` candidates and pass through the same T12 review, quarantine,
place resolution and pack validation as automatic candidates. They supply no
fare, schedule, travel time, walking connection or coordinates. See
[curated-routes-review.md](curated-routes-review.md) for evidence and limitations.
The latest jeepney additions, bundled pack and conversational AI validation are
recorded in [the implementation report](../../docs/evidence/jeepney-conversation.md).

## Individual commands

```sh
node tools/corpus/freeze-reference.mjs   # data/reference/howtogetthereph_dataset-precleaned/
node tools/corpus/audit.mjs              # T10
node tools/corpus/extract.mjs            # T11 → data/raw/t11/
node tools/corpus/evidence.mjs           # T12 part A → data/raw/t12/ + reports
node tools/corpus/places.mjs             # T13
node tools/corpus/eligible.mjs           # T14 → data/raw/t14/
node tools/pack-builder/build.mjs ...    # T15 → data/raw/out/pack.sqlite (gitignored)
node tools/pack-builder/acceptance.mjs ...  # T16
node tools/corpus/promote-seed.mjs       # cleaned tables → data/seed/
node tools/corpus/progress.mjs           # local progress bars
```

## Layout

| Path | Git | Role |
|------|-----|------|
| `howtogetthereph_dataset/` | tracked | Working raw input |
| `data/reference/howtogetthereph_dataset-precleaned/` | README+checksums | Frozen pre-clean copy (large files local) |
| `data/raw/` | ignored | Intermediates + pack.sqlite |
| `data/seed/` | tracked | Cleaned eligible pack inputs (no raw URLs, wording, usernames or imports) |

Reddit `source.url` is null in eligible records and the built pack. Source IDs,
post IDs, dates, snapshot hashes and comment indices retain offline provenance;
raw permalinks remain in the build-input snapshot. The builder rejects leaks,
promotion runs INV-4 on staged files before replacing the seed, and the pipeline
finishes with the same shipped-tree check used by Member 4 CI.

## Tests

```sh
node --test "tools/corpus/*.test.mjs"
node --test "tools/pack-builder/**/*.test.mjs"
```
