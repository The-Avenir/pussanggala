import type {
  FareReportRow,
  HoursReportRow,
  LegRow,
  NoteRow,
  PackManifestRow,
  PlaceAliasRow,
  PlaceRow,
  PlaceStopRow,
  RawPackTables,
  RecordKind,
  RecordSourceRow,
  RegionRow,
  RouteRow,
  ShapeRow,
  SourceRow,
  StopRow,
  WalkLinkRow,
} from "../schema/pack";

export interface Pack {
  manifest: PackManifestRow;
  regions: ReadonlyMap<string, RegionRow>;
  places: ReadonlyMap<string, PlaceRow>;
  aliasesByNorm: ReadonlyMap<string, PlaceAliasRow>;
  ambiguitiesByNorm: ReadonlyMap<string, readonly string[]>;
  stops: ReadonlyMap<string, StopRow>;
  placeStops: ReadonlyMap<string, PlaceStopRow>;
  placeStopsByPlace: ReadonlyMap<string, readonly PlaceStopRow[]>;
  routes: ReadonlyMap<string, RouteRow>;
  legs: ReadonlyMap<string, LegRow>;
  walks: ReadonlyMap<string, WalkLinkRow>;
  faresByLeg: ReadonlyMap<string, readonly FareReportRow[]>;
  hoursByRoute: ReadonlyMap<string, readonly HoursReportRow[]>;
  shapes: ReadonlyMap<string, ShapeRow>;
  notes: ReadonlyMap<string, NoteRow>;
  noteIdsByLeg: ReadonlyMap<string, readonly string[]>;
  noteIdsByStop: ReadonlyMap<string, readonly string[]>;
  sources: ReadonlyMap<string, SourceRow>;
  sourcesByRecord: ReadonlyMap<string, readonly RecordSourceRow[]>;
}

export type PackIssueCode =
  | "schema_incompatible"
  | "row_invalid"
  | "duplicate_id"
  | "dangling_fk"
  | "missing_provenance"
  | "alias_not_normalized"
  | "alias_conflict"
  | "ambiguity_too_few"
  | "source_path_without_geometry_source"
  | "manifest_counts_mismatch";

export interface PackIssue {
  code: PackIssueCode;
  table: keyof RawPackTables;
  rowIndex?: number;
  id?: string;
  message: string;
}

export function recordKey(kind: RecordKind, id: string): string {
  return `${kind}:${id}`;
}
