-- Pusang Gala runtime pack schema, version 1.
-- Mirrors SDD §3.2 and the draft T00 contracts (packages/core/src/schema/pack.ts,
-- packages/core/src/ids.ts). Stable IDs: ^[a-z]{2,3}_[a-z0-9][a-z0-9_-]{0,63}$ with a
-- per-table prefix. The builder (build.mjs) validates the exact regex; the CHECKs below
-- are defence in depth (prefix + character set + length).
-- Constraints that span rows or tables (provenance for every factual record, ambiguity
-- groups of >= 2 candidates, alias_norm not both unique and ambiguous, ready legs only on
-- non-suspended/retired routes, source_path geometry evidence) are enforced by build.mjs
-- and re-checked by acceptance.mjs and the T20 loader.

PRAGMA foreign_keys = ON;
PRAGMA user_version = 1;

CREATE TABLE region (
  region_id        TEXT PRIMARY KEY NOT NULL
                   CHECK (region_id GLOB 'rg_[a-z0-9]*' AND region_id NOT GLOB '*[^a-z0-9_-]*' AND length(region_id) <= 67),
  name             TEXT NOT NULL,
  boundary_geojson TEXT NOT NULL,
  boundary_sha256  TEXT NOT NULL
);

CREATE TABLE place (
  place_id       TEXT PRIMARY KEY NOT NULL
                 CHECK (place_id GLOB 'pl_[a-z0-9]*' AND place_id NOT GLOB '*[^a-z0-9_-]*' AND length(place_id) <= 67),
  region_id      TEXT NOT NULL REFERENCES region (region_id),
  name           TEXT NOT NULL,
  kind           TEXT NOT NULL,
  area           TEXT NOT NULL,
  ncr_status     TEXT NOT NULL CHECK (ncr_status IN ('accepted', 'ambiguous', 'outside')),
  lat            REAL CHECK (lat IS NULL OR (lat BETWEEN -90 AND 90)),
  lng            REAL CHECK (lng IS NULL OR (lng BETWEEN -180 AND 180)),
  mapping_status TEXT NOT NULL CHECK (mapping_status IN ('mapped', 'unmapped', 'needs_review')),
  CHECK ((lat IS NULL) = (lng IS NULL))
);
CREATE INDEX place_region_idx ON place (region_id);

CREATE TABLE place_alias (
  alias_id      INTEGER PRIMARY KEY NOT NULL,
  place_id      TEXT NOT NULL REFERENCES place (place_id),
  alias_norm    TEXT NOT NULL UNIQUE CHECK (length(alias_norm) > 0),
  alias_display TEXT NOT NULL
);
CREATE INDEX place_alias_place_idx ON place_alias (place_id);

CREATE TABLE place_ambiguity (
  ambiguity_id INTEGER PRIMARY KEY NOT NULL,
  alias_norm   TEXT NOT NULL CHECK (length(alias_norm) > 0),
  place_id     TEXT NOT NULL REFERENCES place (place_id),
  UNIQUE (alias_norm, place_id)
);
CREATE INDEX place_ambiguity_place_idx ON place_ambiguity (place_id);

CREATE TABLE stop (
  stop_id       TEXT PRIMARY KEY NOT NULL
                CHECK (stop_id GLOB 'st_[a-z0-9]*' AND stop_id NOT GLOB '*[^a-z0-9_-]*' AND length(stop_id) <= 67),
  place_id      TEXT NOT NULL REFERENCES place (place_id),
  name          TEXT NOT NULL,
  landmark_hint TEXT NOT NULL
);
CREATE INDEX stop_place_idx ON stop (place_id);

CREATE TABLE place_stop (
  access_id   TEXT PRIMARY KEY NOT NULL
              CHECK (access_id GLOB 'ac_[a-z0-9]*' AND access_id NOT GLOB '*[^a-z0-9_-]*' AND length(access_id) <= 67),
  place_id    TEXT NOT NULL REFERENCES place (place_id),
  stop_id     TEXT NOT NULL REFERENCES stop (stop_id),
  direction   TEXT NOT NULL CHECK (direction IN ('to_stop', 'from_stop', 'both')),
  walk_m      INTEGER CHECK (walk_m IS NULL OR (typeof(walk_m) = 'integer' AND walk_m >= 0)),
  walk_min    INTEGER CHECK (walk_min IS NULL OR (typeof(walk_min) = 'integer' AND walk_min >= 0)),
  walk_text   TEXT NOT NULL,
  eligibility TEXT NOT NULL CHECK (eligibility IN ('ready', 'excluded'))
);
CREATE INDEX place_stop_place_idx ON place_stop (place_id);
CREATE INDEX place_stop_stop_idx ON place_stop (stop_id);

CREATE TABLE route (
  route_id        TEXT PRIMARY KEY NOT NULL
                  CHECK (route_id GLOB 'rt_[a-z0-9]*' AND route_id NOT GLOB '*[^a-z0-9_-]*' AND length(route_id) <= 67),
  mode            TEXT NOT NULL CHECK (mode IN ('jeepney', 'modern_jeepney', 'uv_express', 'bus', 'tricycle', 'rail')),
  signboard       TEXT,
  direction_label TEXT NOT NULL,
  service_status  TEXT NOT NULL CHECK (service_status IN ('reported_active', 'unknown', 'suspended', 'retired'))
);

CREATE TABLE leg (
  leg_id         TEXT PRIMARY KEY NOT NULL
                 CHECK (leg_id GLOB 'lg_[a-z0-9]*' AND leg_id NOT GLOB '*[^a-z0-9_-]*' AND length(leg_id) <= 67),
  route_id       TEXT NOT NULL REFERENCES route (route_id),
  board_stop_id  TEXT NOT NULL REFERENCES stop (stop_id),
  alight_stop_id TEXT NOT NULL REFERENCES stop (stop_id),
  ride_min       INTEGER CHECK (ride_min IS NULL OR (typeof(ride_min) = 'integer' AND ride_min >= 0)),
  dist_km        REAL CHECK (dist_km IS NULL OR dist_km >= 0),
  eligibility    TEXT NOT NULL CHECK (eligibility IN ('ready', 'excluded'))
);
CREATE INDEX leg_route_idx ON leg (route_id);
CREATE INDEX leg_board_idx ON leg (board_stop_id);
CREATE INDEX leg_alight_idx ON leg (alight_stop_id);

CREATE TABLE walk_link (
  walk_id      TEXT PRIMARY KEY NOT NULL
               CHECK (walk_id GLOB 'wk_[a-z0-9]*' AND walk_id NOT GLOB '*[^a-z0-9_-]*' AND length(walk_id) <= 67),
  from_stop_id TEXT NOT NULL REFERENCES stop (stop_id),
  to_stop_id   TEXT NOT NULL REFERENCES stop (stop_id),
  walk_m       INTEGER CHECK (walk_m IS NULL OR (typeof(walk_m) = 'integer' AND walk_m >= 0)),
  walk_min     INTEGER CHECK (walk_min IS NULL OR (typeof(walk_min) = 'integer' AND walk_min >= 0)),
  walk_text    TEXT NOT NULL,
  eligibility  TEXT NOT NULL CHECK (eligibility IN ('ready', 'excluded'))
);
CREATE INDEX walk_link_from_idx ON walk_link (from_stop_id);
CREATE INDEX walk_link_to_idx ON walk_link (to_stop_id);

CREATE TABLE fare_report (
  fare_id      TEXT PRIMARY KEY NOT NULL
               CHECK (fare_id GLOB 'fr_[a-z0-9]*' AND fare_id NOT GLOB '*[^a-z0-9_-]*' AND length(fare_id) <= 67),
  leg_id       TEXT NOT NULL REFERENCES leg (leg_id),
  amount_min   REAL NOT NULL CHECK (amount_min >= 0),
  amount_max   REAL NOT NULL CHECK (amount_max >= 0),
  currency     TEXT NOT NULL CHECK (currency = 'PHP'),
  basis        TEXT NOT NULL CHECK (basis = 'reported_segment'),
  effective_at TEXT,
  CHECK (amount_min <= amount_max)
);
CREATE INDEX fare_report_leg_idx ON fare_report (leg_id);

CREATE TABLE hours_report (
  hours_id     TEXT PRIMARY KEY NOT NULL
               CHECK (hours_id GLOB 'hr_[a-z0-9]*' AND hours_id NOT GLOB '*[^a-z0-9_-]*' AND length(hours_id) <= 67),
  route_id     TEXT NOT NULL REFERENCES route (route_id),
  hours_text   TEXT NOT NULL,
  starts_local TEXT CHECK (starts_local IS NULL OR (starts_local GLOB '[0-2][0-9]:[0-5][0-9]' AND starts_local < '24:00')),
  ends_local   TEXT CHECK (ends_local IS NULL OR (ends_local GLOB '[0-2][0-9]:[0-5][0-9]' AND ends_local < '24:00')),
  days_text    TEXT
);
CREATE INDEX hours_report_route_idx ON hours_report (route_id);

CREATE TABLE shape (
  shape_id      TEXT PRIMARY KEY NOT NULL
                CHECK (shape_id GLOB 'sh_[a-z0-9]*' AND shape_id NOT GLOB '*[^a-z0-9_-]*' AND length(shape_id) <= 67),
  leg_id        TEXT REFERENCES leg (leg_id),
  walk_id       TEXT REFERENCES walk_link (walk_id),
  geojson       TEXT NOT NULL,
  geometry_kind TEXT NOT NULL CHECK (geometry_kind IN ('source_path', 'schematic')),
  CHECK ((leg_id IS NULL) <> (walk_id IS NULL))
);
-- SDD §3.1: LEG ||--o| SHAPE and WALK_LINK ||--o| SHAPE (at most one shape per owner).
CREATE UNIQUE INDEX shape_leg_uidx ON shape (leg_id) WHERE leg_id IS NOT NULL;
CREATE UNIQUE INDEX shape_walk_uidx ON shape (walk_id) WHERE walk_id IS NOT NULL;

CREATE TABLE note (
  note_id TEXT PRIMARY KEY NOT NULL
          CHECK (note_id GLOB 'nt_[a-z0-9]*' AND note_id NOT GLOB '*[^a-z0-9_-]*' AND length(note_id) <= 67),
  body    TEXT NOT NULL,
  kind    TEXT NOT NULL CHECK (kind IN ('tip', 'warning', 'conflict'))
);

CREATE TABLE note_link (
  link_id INTEGER PRIMARY KEY NOT NULL,
  note_id TEXT NOT NULL REFERENCES note (note_id),
  leg_id  TEXT REFERENCES leg (leg_id),
  stop_id TEXT REFERENCES stop (stop_id),
  CHECK ((leg_id IS NULL) <> (stop_id IS NULL))
);
CREATE INDEX note_link_note_idx ON note_link (note_id);
CREATE INDEX note_link_leg_idx ON note_link (leg_id);
CREATE INDEX note_link_stop_idx ON note_link (stop_id);

CREATE TABLE source (
  source_id   TEXT PRIMARY KEY NOT NULL
              CHECK (source_id GLOB 'src_[a-z0-9]*' AND source_id NOT GLOB '*[^a-z0-9_-]*' AND length(source_id) <= 68),
  kind        TEXT NOT NULL CHECK (kind IN ('reddit_thread', 'geography', 'team_review', 'licensed_data')),
  url         TEXT,
  post_id     TEXT,
  posted_at   TEXT,
  observed_at TEXT,
  license     TEXT
);
CREATE INDEX source_post_idx ON source (post_id);

CREATE TABLE record_source (
  link_id         INTEGER PRIMARY KEY NOT NULL,
  record_kind     TEXT NOT NULL CHECK (record_kind IN ('region', 'place', 'stop', 'place_stop', 'route', 'leg',
                                                       'walk_link', 'fare_report', 'hours_report', 'shape', 'note')),
  record_id       TEXT NOT NULL
                  CHECK ((record_id GLOB '[a-z][a-z]_[a-z0-9]*' OR record_id GLOB '[a-z][a-z][a-z]_[a-z0-9]*')
                         AND record_id NOT GLOB '*[^a-z0-9_-]*'),
  source_id       TEXT NOT NULL REFERENCES source (source_id),
  snapshot_sha256 TEXT,
  comment_index   INTEGER CHECK (comment_index IS NULL OR (typeof(comment_index) = 'integer' AND comment_index >= 0))
);
CREATE INDEX record_source_record_idx ON record_source (record_kind, record_id);
CREATE INDEX record_source_source_idx ON record_source (source_id);

CREATE TABLE pack_manifest (
  pack_id          TEXT PRIMARY KEY NOT NULL,
  schema_version   INTEGER NOT NULL CHECK (schema_version = 1),
  region_id        TEXT NOT NULL REFERENCES region (region_id),
  bbox             TEXT NOT NULL,
  created_at       TEXT NOT NULL,
  source_date_min  TEXT,
  source_date_max  TEXT,
  stale_after_days INTEGER NOT NULL CHECK (stale_after_days >= 0),
  input_sha256     TEXT NOT NULL,
  input_posts      INTEGER NOT NULL CHECK (input_posts >= 0),
  answered_posts   INTEGER NOT NULL CHECK (answered_posts >= 0 AND answered_posts <= input_posts),
  included_posts   INTEGER NOT NULL CHECK (included_posts >= 0),
  filtered_posts   INTEGER NOT NULL CHECK (filtered_posts >= 0),
  pending_posts    INTEGER NOT NULL CHECK (pending_posts >= 0),
  rejected_posts   INTEGER NOT NULL CHECK (rejected_posts >= 0),
  CHECK (included_posts + filtered_posts + pending_posts + rejected_posts = answered_posts)
);
-- Exactly one manifest row.
CREATE TRIGGER pack_manifest_single_row BEFORE INSERT ON pack_manifest
WHEN (SELECT count(*) FROM pack_manifest) >= 1
BEGIN
  SELECT RAISE(ABORT, 'pack_manifest holds exactly one row');
END;
