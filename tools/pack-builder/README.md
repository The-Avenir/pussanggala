# tools/pack-builder — pack build, manifest, yield report and acceptance

**Owner:** Member 1 (corpus and evidence).

**Tasks:** T15 (build pack, manifest and yield report), T16 (corpus acceptance
and handoff).

Guardrails (BUILD §5): SQLite indexes/foreign keys, external checksum, dated
source data and mutually exclusive post dispositions; scan paraphrases and the
pack for leaked raw wording/usernames (INV-4); loader-compatible pack consumed
by `packages/core` (T20 contracts); never hardcode a current fare from a
historical doc. Source dates are post dates, not verification dates; nothing
here is a physical-verification claim.

Plain Node ESM, no npm dependencies. Needs Node >= 22.5 for `node:sqlite`
(the ExperimentalWarning is suppressed in `lib/sqlite.mjs`).

## Files

| Path | Purpose |
|------|---------|
| `schema.sql` | Pack DDL, `PRAGMA user_version = 1`; PK/FK/CHECK/UNIQUE + indexes |
| `build.mjs` | T15 builder; exports `build`, `leakScan`, `DISPOSITION_PRECEDENCE` |
| `acceptance.mjs` | T16 acceptance run over a built pack (pass/fail summary) |
| `lib/spec.mjs` | Table/column spec mirroring draft T00 `schema/pack.ts`, `ids.ts` |
| `lib/checks.mjs` | Record, manifest, provenance, ambiguity and leak checks (shared) |
| `lib/mutations.mjs` | Invalid-record / ambiguity / source-content negative fixtures |
| `fixtures/` | Synthetic eligible records, dispositions, run metadata, tiny raw dataset |

## Commands

```sh
# build (writes data/raw/out/, which is gitignored)
node tools/pack-builder/build.mjs \
  --eligible data/raw/t14/eligible \
  --dispositions data/raw/t14/dispositions.json \
  --run data/raw/t14/run.json \
  --raw howtogetthereph_dataset/ncr_routes.json \
  --out data/raw/out

# T16 acceptance
node tools/pack-builder/acceptance.mjs --pack data/raw/out/pack.sqlite \
  --raw howtogetthereph_dataset/ncr_routes.json

# tests (Node 24 treats --test arguments as globs; a bare directory does not match)
node --test "tools/pack-builder/**/*.test.mjs"
```

Exit code 0 = success, 1 = build/acceptance failed (issues listed by code, table,
record ID and column only — record text is never echoed), 2 = usage error.

## Input format

### 1. Eligible records directory (`--eligible <dir>`)

One file per pack table, named `<table>.json`, each a JSON **array of row objects**.
A missing file means an empty table. Tables:

`region place place_alias place_ambiguity stop place_stop route leg walk_link
fare_report hours_report shape note note_link source record_source`

(`pack_manifest` is generated, not supplied.) Each row has **exactly** the columns of
SDD §3.2 / draft T00 `schema/pack.ts` — unknown or missing columns fail. Nullable
columns must be present with `null`. Rules:

- Stable IDs match `^[a-z]{2,3}_[a-z0-9][a-z0-9_-]{0,63}$` with prefixes
  `rg pl st ac rt lg wk fr hr sh nt src` (region, place, stop, place_stop, route, leg,
  walk_link, fare_report, hours_report, shape, note, source). `alias_id`,
  `ambiguity_id`, `note_link.link_id`, `record_source.link_id` are integers.
- Enums: `ncr_status` accepted/ambiguous/outside; `mapping_status`
  mapped/unmapped/needs_review; `direction` to_stop/from_stop/both; `eligibility`
  ready/excluded; `mode` jeepney/modern_jeepney/uv_express/bus/tricycle/rail;
  `service_status` reported_active/unknown/suspended/retired; `currency` PHP;
  `basis` reported_segment; `geometry_kind` source_path/schematic; note `kind`
  tip/warning/conflict; source `kind` reddit_thread/geography/team_review/licensed_data;
  `record_kind` region/place/stop/place_stop/route/leg/walk_link/fare_report/hours_report/shape/note.
- `lat`/`lng` both set or both null. `walk_m`, `walk_min`, `ride_min`, `comment_index`
  nonnegative integers or null; `dist_km`, amounts nonnegative; `amount_min <= amount_max`.
  `starts_local`/`ends_local` `HH:MM` or null. Date columns (`posted_at`, `observed_at`,
  `effective_at`) start with `YYYY-MM-DD` or are null.
- `shape`: exactly one of `leg_id`/`walk_id`, at most one shape per owner;
  `source_path` needs a `geography`/`licensed_data` source. `note_link`: exactly one of
  `leg_id`/`stop_id`.
- `place_alias.alias_norm` is unique and equals the T20 `normalize(alias_display)`.
  Ambiguous aliases go **only** in `place_ambiguity`, with >= 2 distinct places, and never
  also in `place_alias`.
- Every factual record (region, place, stop, place_stop, route, leg, walk_link,
  fare_report, hours_report, shape, note) has >= 1 `record_source` row whose
  `record_kind`/`record_id` point at it.
- `eligibility = 'ready'` legs must not use a `suspended`/`retired` route; ready legs,
  walk links and place_stops only touch places with `ncr_status = 'accepted'`.
  Excluded records may be present (counted in the report) but stay out of the graph.
- Human text (`name`, `area`, `kind`, `landmark_hint`, `walk_text`, `hours_text`,
  `days_text`, `signboard`, `direction_label`, aliases, note `body`, ...) must be our own
  paraphrase: no 6-consecutive-word sequence shared with any source title, question or
  answer (case/punctuation/whitespace-insensitive), no `u/name`, `@name` or reddit
  profile links.

### 2. Dispositions (`--dispositions <file>`)

`{"<post_id>": "included" | "filtered" | "pending" | "rejected" | [several of those]}` —
one key per **answered** post of the raw dataset. An array means the post's candidates
ended in several outcomes; the builder keeps one using the declared precedence:

**included > pending > rejected > filtered**

(`included`: >= 1 pack record cites the post; `pending`: review still open; `rejected`:
candidates failed review/checks; `filtered`: no route evidence.) The resolved counts
must sum to `answered_posts`, every key must be an answered post in the raw dataset,
every cited `reddit_thread` source must belong to an `included` post and every
`included` post must be cited — otherwise the build fails.

### 3. Run metadata (`--run <file>`)

```json
{
  "pack_id": "pack_ncr-2026-10",
  "region_id": "rg_ncr",
  "bbox": "minLng,minLat,maxLng,maxLat",
  "created_at": "2026-10-01T00:00:00Z",
  "stale_after_days": 180,
  "input_sha256": "<sha256 of the raw dataset file>",
  "input_posts": 3480,
  "answered_posts": 2186
}
```

`created_at` is taken from here (never the clock) so identical input produces an
identical `pack.sqlite` and `pack_sha256`. `input_sha256`, `input_posts` and
`answered_posts` are re-derived from `--raw` and must match (`--no-verify-input`
skips this; tests do not use it).

## Outputs (`--out <dir>`)

- `pack.sqlite` — built in one transaction with `foreign_keys = ON`, rows inserted in
  primary-key order; `PRAGMA integrity_check` and `PRAGMA foreign_key_check` must be
  clean or the build fails and no pack is left behind. One `pack_manifest` row with
  post-disposition counts and `source_date_min/max` (over cited sources' `posted_at`,
  falling back to `observed_at`).
- `pack.manifest.json` — companion: `pack_sha256` (computed over the finished file,
  never stored inside it), `pack_bytes`, `schema_version`, asset list and a copy of the
  manifest row.
- `yield-report.json` / `yield-report.md` — dispositions, records per table, ready vs
  excluded, coverage counts (places/stops/routes, ready coverage, fares/hours, aliases,
  source kinds), source date range, leak-scan result. These are record counts, not
  itinerary/route-count claims.

## Loader compatibility

`lib/spec.mjs` `toRawPackTables()` converts the pack tables to the T20
`RawPackTables` shape (`regions`, `places`, `place_aliases`, ... , `manifest`), and
`acceptance.mjs` `readPack()` reads a built pack back into that form.
