import { z } from "zod";
import { ID_PREFIXES, STABLE_ID_RE, stableId } from "../ids";

export const SUPPORTED_PACK_SCHEMA_VERSION = 1;

const HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const hhmm = z.string().regex(HHMM_RE);
const int = z.number().int();
const nonnegInt = int.nonnegative();
const nonnegNum = z.number().nonnegative();
const eligibility = z.enum(["ready", "excluded"]);

export const RecordKind = z.enum([
  "region",
  "place",
  "stop",
  "place_stop",
  "route",
  "leg",
  "walk_link",
  "fare_report",
  "hours_report",
  "shape",
  "note",
]);
export type RecordKind = z.infer<typeof RecordKind>;

export const RegionRow = z.object({
  region_id: stableId(ID_PREFIXES.region),
  name: z.string(),
  boundary_geojson: z.string(),
  boundary_sha256: z.string(),
});
export type RegionRow = z.infer<typeof RegionRow>;

export const PlaceRow = z
  .object({
    place_id: stableId(ID_PREFIXES.place),
    region_id: stableId(ID_PREFIXES.region),
    name: z.string(),
    kind: z.string(),
    area: z.string(),
    ncr_status: z.enum(["accepted", "ambiguous", "outside"]),
    lat: z.number().nullable(),
    lng: z.number().nullable(),
    mapping_status: z.enum(["mapped", "unmapped", "needs_review"]),
  })
  .refine((row) => (row.lat === null) === (row.lng === null), {
    message: "lat and lng must be both set or both null",
  });
export type PlaceRow = z.infer<typeof PlaceRow>;

export const PlaceAliasRow = z.object({
  alias_id: int,
  place_id: stableId(ID_PREFIXES.place),
  alias_norm: z.string(),
  alias_display: z.string(),
});
export type PlaceAliasRow = z.infer<typeof PlaceAliasRow>;

export const PlaceAmbiguityRow = z.object({
  ambiguity_id: int,
  alias_norm: z.string(),
  place_id: stableId(ID_PREFIXES.place),
});
export type PlaceAmbiguityRow = z.infer<typeof PlaceAmbiguityRow>;

export const StopRow = z.object({
  stop_id: stableId(ID_PREFIXES.stop),
  place_id: stableId(ID_PREFIXES.place),
  name: z.string(),
  landmark_hint: z.string(),
});
export type StopRow = z.infer<typeof StopRow>;

export const PlaceStopRow = z.object({
  access_id: stableId(ID_PREFIXES.access),
  place_id: stableId(ID_PREFIXES.place),
  stop_id: stableId(ID_PREFIXES.stop),
  direction: z.enum(["to_stop", "from_stop", "both"]),
  walk_m: nonnegInt.nullable(),
  walk_min: nonnegInt.nullable(),
  walk_text: z.string(),
  eligibility,
});
export type PlaceStopRow = z.infer<typeof PlaceStopRow>;

export const RouteRow = z.object({
  route_id: stableId(ID_PREFIXES.route),
  mode: z.enum([
    "jeepney",
    "modern_jeepney",
    "uv_express",
    "bus",
    "tricycle",
    "rail",
  ]),
  signboard: z.string().nullable(),
  direction_label: z.string(),
  service_status: z.enum(["reported_active", "unknown", "suspended", "retired"]),
});
export type RouteRow = z.infer<typeof RouteRow>;

export const LegRow = z.object({
  leg_id: stableId(ID_PREFIXES.leg),
  route_id: stableId(ID_PREFIXES.route),
  board_stop_id: stableId(ID_PREFIXES.stop),
  alight_stop_id: stableId(ID_PREFIXES.stop),
  ride_min: nonnegInt.nullable(),
  dist_km: nonnegNum.nullable(),
  eligibility,
});
export type LegRow = z.infer<typeof LegRow>;

export const WalkLinkRow = z.object({
  walk_id: stableId(ID_PREFIXES.walk),
  from_stop_id: stableId(ID_PREFIXES.stop),
  to_stop_id: stableId(ID_PREFIXES.stop),
  walk_m: nonnegInt.nullable(),
  walk_min: nonnegInt.nullable(),
  walk_text: z.string(),
  eligibility,
});
export type WalkLinkRow = z.infer<typeof WalkLinkRow>;

export const FareReportRow = z
  .object({
    fare_id: stableId(ID_PREFIXES.fare),
    leg_id: stableId(ID_PREFIXES.leg),
    amount_min: nonnegNum,
    amount_max: nonnegNum,
    currency: z.literal("PHP"),
    basis: z.literal("reported_segment"),
    effective_at: z.string().nullable(),
  })
  .refine((row) => row.amount_min <= row.amount_max, {
    message: "amount_min must be <= amount_max",
  });
export type FareReportRow = z.infer<typeof FareReportRow>;

export const HoursReportRow = z.object({
  hours_id: stableId(ID_PREFIXES.hours),
  route_id: stableId(ID_PREFIXES.route),
  hours_text: z.string(),
  starts_local: hhmm.nullable(),
  ends_local: hhmm.nullable(),
  days_text: z.string().nullable(),
});
export type HoursReportRow = z.infer<typeof HoursReportRow>;

export const ShapeRow = z
  .object({
    shape_id: stableId(ID_PREFIXES.shape),
    leg_id: stableId(ID_PREFIXES.leg).nullable(),
    walk_id: stableId(ID_PREFIXES.walk).nullable(),
    geojson: z.string(),
    geometry_kind: z.enum(["source_path", "schematic"]),
  })
  .refine((row) => (row.leg_id === null) !== (row.walk_id === null), {
    message: "shape must have exactly one of leg_id or walk_id",
  });
export type ShapeRow = z.infer<typeof ShapeRow>;

export const NoteRow = z.object({
  note_id: stableId(ID_PREFIXES.note),
  body: z.string(),
  kind: z.enum(["tip", "warning", "conflict"]),
});
export type NoteRow = z.infer<typeof NoteRow>;

export const NoteLinkRow = z
  .object({
    link_id: int,
    note_id: stableId(ID_PREFIXES.note),
    leg_id: stableId(ID_PREFIXES.leg).nullable(),
    stop_id: stableId(ID_PREFIXES.stop).nullable(),
  })
  .refine((row) => (row.leg_id === null) !== (row.stop_id === null), {
    message: "note link must have exactly one of leg_id or stop_id",
  });
export type NoteLinkRow = z.infer<typeof NoteLinkRow>;

export const SourceRow = z.object({
  source_id: stableId(ID_PREFIXES.source),
  kind: z.enum([
    "reddit_thread",
    "geography",
    "team_review",
    "licensed_data",
  ]),
  url: z.string().nullable(),
  post_id: z.string().nullable(),
  posted_at: z.string().nullable(),
  observed_at: z.string().nullable(),
  license: z.string().nullable(),
});
export type SourceRow = z.infer<typeof SourceRow>;

export const RecordSourceRow = z.object({
  link_id: int,
  record_kind: RecordKind,
  record_id: z.string().regex(STABLE_ID_RE),
  source_id: stableId(ID_PREFIXES.source),
  snapshot_sha256: z.string().nullable(),
  comment_index: nonnegInt.nullable(),
});
export type RecordSourceRow = z.infer<typeof RecordSourceRow>;

export const PackManifestRow = z.object({
  pack_id: z.string(),
  schema_version: int,
  region_id: stableId(ID_PREFIXES.region),
  bbox: z.string(),
  created_at: z.string(),
  source_date_min: z.string().nullable(),
  source_date_max: z.string().nullable(),
  stale_after_days: nonnegInt,
  input_sha256: z.string(),
  input_posts: nonnegInt,
  answered_posts: nonnegInt,
  included_posts: nonnegInt,
  filtered_posts: nonnegInt,
  pending_posts: nonnegInt,
  rejected_posts: nonnegInt,
});
export type PackManifestRow = z.infer<typeof PackManifestRow>;

export interface RawPackTables {
  manifest: unknown;
  regions: unknown[];
  places: unknown[];
  place_aliases: unknown[];
  place_ambiguities: unknown[];
  stops: unknown[];
  place_stops: unknown[];
  routes: unknown[];
  legs: unknown[];
  walk_links: unknown[];
  fare_reports: unknown[];
  hours_reports: unknown[];
  shapes: unknown[];
  notes: unknown[];
  note_links: unknown[];
  sources: unknown[];
  record_sources: unknown[];
}
