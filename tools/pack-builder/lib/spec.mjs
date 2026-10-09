// Table specification shared by build.mjs, acceptance.mjs and tests.
// Mirrors SDD §3.2 and the draft T00 contracts (packages/core/src/schema/pack.ts, ids.ts).

export const SCHEMA_VERSION = 1;
export const STABLE_ID_RE = /^[a-z]{2,3}_[a-z0-9][a-z0-9_-]{0,63}$/;
export const HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
export const DATE_PREFIX_RE = /^\d{4}-\d{2}-\d{2}/;

const ELIGIBILITY = ["ready", "excluded"];

// Column descriptor: t = text|int|real|id; null = nullable; enum; prefix (id columns);
// fk = referenced table; nonneg; hhmm; date; scan = human text checked by the leak scan.
const id = (prefix, extra = {}) => ({ t: "id", prefix, ...extra });
const text = (extra = {}) => ({ t: "text", ...extra });

// Insertion order respects foreign keys. `key` is the T20 RawPackTables property name.
export const TABLES = [
  {
    name: "region", key: "regions", kind: "region", pk: "region_id",
    cols: {
      region_id: id("rg"),
      name: text({ scan: true }),
      boundary_geojson: text(),
      boundary_sha256: text(),
    },
  },
  {
    name: "place", key: "places", kind: "place", pk: "place_id",
    cols: {
      place_id: id("pl"),
      region_id: id("rg", { fk: "region" }),
      name: text({ scan: true }),
      kind: text({ scan: true }),
      area: text({ scan: true }),
      ncr_status: text({ enum: ["accepted", "ambiguous", "outside"] }),
      lat: { t: "real", null: true },
      lng: { t: "real", null: true },
      mapping_status: text({ enum: ["mapped", "unmapped", "needs_review"] }),
    },
  },
  {
    name: "place_alias", key: "place_aliases", kind: null, pk: "alias_id",
    cols: {
      alias_id: { t: "int" },
      place_id: id("pl", { fk: "place" }),
      alias_norm: text({ scan: true }),
      alias_display: text({ scan: true }),
    },
  },
  {
    name: "place_ambiguity", key: "place_ambiguities", kind: null, pk: "ambiguity_id",
    cols: {
      ambiguity_id: { t: "int" },
      alias_norm: text({ scan: true }),
      place_id: id("pl", { fk: "place" }),
    },
  },
  {
    name: "stop", key: "stops", kind: "stop", pk: "stop_id",
    cols: {
      stop_id: id("st"),
      place_id: id("pl", { fk: "place" }),
      name: text({ scan: true }),
      landmark_hint: text({ scan: true }),
    },
  },
  {
    name: "place_stop", key: "place_stops", kind: "place_stop", pk: "access_id",
    cols: {
      access_id: id("ac"),
      place_id: id("pl", { fk: "place" }),
      stop_id: id("st", { fk: "stop" }),
      direction: text({ enum: ["to_stop", "from_stop", "both"] }),
      walk_m: { t: "int", null: true, nonneg: true },
      walk_min: { t: "int", null: true, nonneg: true },
      walk_text: text({ scan: true }),
      eligibility: text({ enum: ELIGIBILITY }),
    },
  },
  {
    name: "route", key: "routes", kind: "route", pk: "route_id",
    cols: {
      route_id: id("rt"),
      mode: text({ enum: ["jeepney", "modern_jeepney", "uv_express", "bus", "tricycle", "rail"] }),
      signboard: text({ null: true, scan: true }),
      direction_label: text({ scan: true }),
      service_status: text({ enum: ["reported_active", "unknown", "suspended", "retired"] }),
    },
  },
  {
    name: "leg", key: "legs", kind: "leg", pk: "leg_id",
    cols: {
      leg_id: id("lg"),
      route_id: id("rt", { fk: "route" }),
      board_stop_id: id("st", { fk: "stop" }),
      alight_stop_id: id("st", { fk: "stop" }),
      ride_min: { t: "int", null: true, nonneg: true },
      dist_km: { t: "real", null: true, nonneg: true },
      eligibility: text({ enum: ELIGIBILITY }),
    },
  },
  {
    name: "walk_link", key: "walk_links", kind: "walk_link", pk: "walk_id",
    cols: {
      walk_id: id("wk"),
      from_stop_id: id("st", { fk: "stop" }),
      to_stop_id: id("st", { fk: "stop" }),
      walk_m: { t: "int", null: true, nonneg: true },
      walk_min: { t: "int", null: true, nonneg: true },
      walk_text: text({ scan: true }),
      eligibility: text({ enum: ELIGIBILITY }),
    },
  },
  {
    name: "fare_report", key: "fare_reports", kind: "fare_report", pk: "fare_id",
    cols: {
      fare_id: id("fr"),
      leg_id: id("lg", { fk: "leg" }),
      amount_min: { t: "real", nonneg: true },
      amount_max: { t: "real", nonneg: true },
      currency: text({ enum: ["PHP"] }),
      basis: text({ enum: ["reported_segment"] }),
      effective_at: text({ null: true, date: true }),
    },
  },
  {
    name: "hours_report", key: "hours_reports", kind: "hours_report", pk: "hours_id",
    cols: {
      hours_id: id("hr"),
      route_id: id("rt", { fk: "route" }),
      hours_text: text({ scan: true }),
      starts_local: text({ null: true, hhmm: true }),
      ends_local: text({ null: true, hhmm: true }),
      days_text: text({ null: true, scan: true }),
    },
  },
  {
    name: "shape", key: "shapes", kind: "shape", pk: "shape_id",
    cols: {
      shape_id: id("sh"),
      leg_id: id("lg", { fk: "leg", null: true }),
      walk_id: id("wk", { fk: "walk_link", null: true }),
      geojson: text(),
      geometry_kind: text({ enum: ["source_path", "schematic"] }),
    },
  },
  {
    name: "note", key: "notes", kind: "note", pk: "note_id",
    cols: {
      note_id: id("nt"),
      body: text({ scan: true }),
      kind: text({ enum: ["tip", "warning", "conflict"] }),
    },
  },
  {
    name: "note_link", key: "note_links", kind: null, pk: "link_id",
    cols: {
      link_id: { t: "int" },
      note_id: id("nt", { fk: "note" }),
      leg_id: id("lg", { fk: "leg", null: true }),
      stop_id: id("st", { fk: "stop", null: true }),
    },
  },
  {
    name: "source", key: "sources", kind: null, pk: "source_id",
    cols: {
      source_id: id("src"),
      kind: text({ enum: ["reddit_thread", "geography", "team_review", "licensed_data"] }),
      url: text({ null: true }),
      post_id: text({ null: true }),
      posted_at: text({ null: true, date: true }),
      observed_at: text({ null: true, date: true }),
      license: text({ null: true }),
    },
  },
  {
    name: "record_source", key: "record_sources", kind: null, pk: "link_id",
    cols: {
      link_id: { t: "int" },
      record_kind: text({
        enum: ["region", "place", "stop", "place_stop", "route", "leg", "walk_link",
          "fare_report", "hours_report", "shape", "note"],
      }),
      record_id: { t: "id", prefix: null },
      source_id: id("src", { fk: "source" }),
      snapshot_sha256: text({ null: true }),
      comment_index: { t: "int", null: true, nonneg: true },
    },
  },
];

export const MANIFEST_COLS = [
  "pack_id", "schema_version", "region_id", "bbox", "created_at", "source_date_min",
  "source_date_max", "stale_after_days", "input_sha256", "input_posts", "answered_posts",
  "included_posts", "filtered_posts", "pending_posts", "rejected_posts",
];

export const TABLE_BY_NAME = Object.fromEntries(TABLES.map((t) => [t.name, t]));
export const TABLE_BY_KIND = Object.fromEntries(TABLES.filter((t) => t.kind).map((t) => [t.kind, t]));

/** Mirror of packages/core/src/text/normalize.ts (T20). */
const EXPANSIONS = { sta: "santa", sto: "santo", brgy: "barangay", ave: "avenue" };
export function normalizeAlias(textValue) {
  const tokens = String(textValue)
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  if (tokens === "") return "";
  return tokens.split(" ").map((tok) => EXPANSIONS[tok] ?? tok).join(" ");
}

/** Empty table map keyed by SQL table name. */
export function emptyTables() {
  return Object.fromEntries(TABLES.map((t) => [t.name, []]));
}

/** Convert {sqlTableName: rows} plus a manifest row into the T20 RawPackTables shape. */
export function toRawPackTables(tables, manifest) {
  const out = { manifest };
  for (const t of TABLES) out[t.key] = tables[t.name] ?? [];
  return out;
}
