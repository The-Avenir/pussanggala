import type { z } from "zod";
import { err, ok, type Result } from "../result";
import {
  FareReportRow,
  HoursReportRow,
  LegRow,
  NoteLinkRow,
  NoteRow,
  PackManifestRow,
  PlaceAliasRow,
  PlaceAmbiguityRow,
  PlaceRow,
  PlaceStopRow,
  RecordSourceRow,
  RegionRow,
  RouteRow,
  SUPPORTED_PACK_SCHEMA_VERSION,
  ShapeRow,
  SourceRow,
  StopRow,
  WalkLinkRow,
  type RawPackTables,
  type RecordKind,
} from "../schema/pack";
import { normalize } from "../text/normalize";
import {
  recordKey,
  type Pack,
  type PackIssue,
  type PackIssueCode,
} from "./types";

const TABLE_ORDER: readonly (keyof RawPackTables)[] = [
  "manifest",
  "regions",
  "places",
  "place_aliases",
  "place_ambiguities",
  "stops",
  "place_stops",
  "routes",
  "legs",
  "walk_links",
  "fare_reports",
  "hours_reports",
  "shapes",
  "notes",
  "note_links",
  "sources",
  "record_sources",
];

const GEOMETRY_SOURCE_KINDS = new Set(["geography", "licensed_data"]);

interface Collected extends PackIssue {
  order: number;
}

type Indexed<T> = { row: T; index: number };

function summarize(error: z.ZodError): string {
  return error.issues
    .slice(0, 3)
    .map((issue) => `${issue.path.join(".") || "row"}: ${issue.message}`)
    .join("; ");
}

function toIdMap<T>(entries: Indexed<T>[], key: (row: T) => string) {
  const map = new Map<string, T>();
  for (const { row } of entries) {
    const k = key(row);
    if (!map.has(k)) {
      map.set(k, row);
    }
  }
  return map;
}

function group<T, K>(
  entries: Indexed<T>[],
  key: (row: T) => K | null,
  sort: (row: T) => string,
): Map<K, readonly T[]> {
  const map = new Map<K, T[]>();
  for (const { row } of entries) {
    const k = key(row);
    if (k === null) {
      continue;
    }
    const list = map.get(k) ?? [];
    list.push(row);
    map.set(k, list);
  }
  const out = new Map<K, readonly T[]>();
  for (const [k, list] of map) {
    list.sort((a, b) => (sort(a) < sort(b) ? -1 : sort(a) > sort(b) ? 1 : 0));
    out.set(k, Object.freeze(list));
  }
  return out;
}

export function loadPack(raw: RawPackTables): Result<Pack, PackIssue[]> {
  const issues: Collected[] = [];
  let seq = 0;
  const add = (
    code: PackIssueCode,
    table: keyof RawPackTables,
    message: string,
    rowIndex?: number,
    id?: string,
  ) => {
    const issue: Collected = { code, table, message, order: seq++ };
    if (rowIndex !== undefined) {
      issue.rowIndex = rowIndex;
    }
    if (id !== undefined) {
      issue.id = id;
    }
    issues.push(issue);
  };
  const finish = (): PackIssue[] =>
    issues
      .sort(
        (a, b) =>
          TABLE_ORDER.indexOf(a.table) - TABLE_ORDER.indexOf(b.table) ||
          (a.rowIndex ?? -1) - (b.rowIndex ?? -1) ||
          a.order - b.order,
      )
      .map(({ order: _order, ...issue }) => issue);

  const parseRows = <S extends z.ZodTypeAny>(
    schema: S,
    table: keyof RawPackTables,
    rows: unknown,
  ): Indexed<z.infer<S>>[] => {
    if (!Array.isArray(rows)) {
      add("row_invalid", table, "expected an array of rows", 0);
      return [];
    }
    const out: Indexed<z.infer<S>>[] = [];
    rows.forEach((entry, index) => {
      const res = schema.safeParse(entry);
      if (res.success) {
        out.push({ row: res.data, index });
      } else {
        add("row_invalid", table, summarize(res.error), index);
      }
    });
    return out;
  };

  const dupCheck = (
    table: keyof RawPackTables,
    label: string,
    keys: { key: string | number; index: number }[],
  ) => {
    const seen = new Set<string | number>();
    for (const { key, index } of keys) {
      if (seen.has(key)) {
        add("duplicate_id", table, `duplicate ${label} "${String(key)}"`, index, String(key));
      } else {
        seen.add(key);
      }
    }
  };

  const fkEach = (
    table: keyof RawPackTables,
    refs: { value: string | null; index: number }[],
    target: ReadonlyMap<string, unknown>,
    label: string,
  ) => {
    for (const { value, index } of refs) {
      if (value !== null && !target.has(value)) {
        add("dangling_fk", table, `${label} "${value}" not found`, index, value);
      }
    }
  };

  const provEach = (
    kind: RecordKind,
    table: keyof RawPackTables,
    rows: { id: string; index: number; excluded: boolean }[],
    sourcesByRecord: ReadonlyMap<string, readonly unknown[]>,
  ) => {
    for (const { id, index, excluded } of rows) {
      if (!excluded && !sourcesByRecord.has(recordKey(kind, id))) {
        add("missing_provenance", table, `no record_source for ${kind} "${id}"`, index, id);
      }
    }
  };

  const dupKeys = <T>(entries: Indexed<T>[], key: (row: T) => string | number) =>
    entries.map(({ row, index }) => ({ key: key(row), index }));
  const fkRefs = <T>(entries: Indexed<T>[], value: (row: T) => string | null) =>
    entries.map(({ row, index }) => ({ value: value(row), index }));
  const provRows = <T extends { eligibility: string }>(
    entries: Indexed<T>[],
    id: (row: T) => string,
  ) =>
    entries.map(({ row, index }) => ({
      id: id(row),
      index,
      excluded: row.eligibility === "excluded",
    }));
  const provPlain = <T>(entries: Indexed<T>[], id: (row: T) => string) =>
    entries.map(({ row, index }) => ({ id: id(row), index, excluded: false }));

  const manifestRes = PackManifestRow.safeParse(raw.manifest);
  if (!manifestRes.success) {
    add("row_invalid", "manifest", summarize(manifestRes.error), 0);
    return err(finish());
  }
  const manifest = manifestRes.data;
  if (manifest.schema_version !== SUPPORTED_PACK_SCHEMA_VERSION) {
    add(
      "schema_incompatible",
      "manifest",
      `schema_version ${manifest.schema_version} is not ${SUPPORTED_PACK_SCHEMA_VERSION}`,
      0,
      manifest.pack_id,
    );
    return err(finish());
  }
  if (
    manifest.answered_posts > manifest.input_posts ||
    manifest.included_posts +
      manifest.filtered_posts +
      manifest.pending_posts +
      manifest.rejected_posts !==
      manifest.answered_posts
  ) {
    add(
      "manifest_counts_mismatch",
      "manifest",
      "post disposition counts do not reconcile with answered_posts/input_posts",
      0,
      manifest.pack_id,
    );
  }

  const regions = parseRows(RegionRow, "regions", raw.regions);
  const places = parseRows(PlaceRow, "places", raw.places);
  const aliases = parseRows(PlaceAliasRow, "place_aliases", raw.place_aliases);
  const ambiguities = parseRows(
    PlaceAmbiguityRow,
    "place_ambiguities",
    raw.place_ambiguities,
  );
  const stops = parseRows(StopRow, "stops", raw.stops);
  const placeStops = parseRows(PlaceStopRow, "place_stops", raw.place_stops);
  const routes = parseRows(RouteRow, "routes", raw.routes);
  const legs = parseRows(LegRow, "legs", raw.legs);
  const walks = parseRows(WalkLinkRow, "walk_links", raw.walk_links);
  const fares = parseRows(FareReportRow, "fare_reports", raw.fare_reports);
  const hours = parseRows(HoursReportRow, "hours_reports", raw.hours_reports);
  const shapes = parseRows(ShapeRow, "shapes", raw.shapes);
  const notes = parseRows(NoteRow, "notes", raw.notes);
  const noteLinks = parseRows(NoteLinkRow, "note_links", raw.note_links);
  const sources = parseRows(SourceRow, "sources", raw.sources);
  const recordSources = parseRows(
    RecordSourceRow,
    "record_sources",
    raw.record_sources,
  );

  dupCheck("regions", "region_id", dupKeys(regions, (r) => r.region_id));
  dupCheck("places", "place_id", dupKeys(places, (r) => r.place_id));
  dupCheck("place_aliases", "alias_id", dupKeys(aliases, (r) => r.alias_id));
  dupCheck("place_ambiguities", "ambiguity_id", dupKeys(ambiguities, (r) => r.ambiguity_id));
  dupCheck("stops", "stop_id", dupKeys(stops, (r) => r.stop_id));
  dupCheck("place_stops", "access_id", dupKeys(placeStops, (r) => r.access_id));
  dupCheck("routes", "route_id", dupKeys(routes, (r) => r.route_id));
  dupCheck("legs", "leg_id", dupKeys(legs, (r) => r.leg_id));
  dupCheck("walk_links", "walk_id", dupKeys(walks, (r) => r.walk_id));
  dupCheck("fare_reports", "fare_id", dupKeys(fares, (r) => r.fare_id));
  dupCheck("hours_reports", "hours_id", dupKeys(hours, (r) => r.hours_id));
  dupCheck("shapes", "shape_id", dupKeys(shapes, (r) => r.shape_id));
  dupCheck("notes", "note_id", dupKeys(notes, (r) => r.note_id));
  dupCheck("note_links", "link_id", dupKeys(noteLinks, (r) => r.link_id));
  dupCheck("sources", "source_id", dupKeys(sources, (r) => r.source_id));
  dupCheck("record_sources", "link_id", dupKeys(recordSources, (r) => r.link_id));

  const regionsById = toIdMap(regions, (r) => r.region_id);
  const placesById = toIdMap(places, (r) => r.place_id);
  const stopsById = toIdMap(stops, (r) => r.stop_id);
  const placeStopsById = toIdMap(placeStops, (r) => r.access_id);
  const routesById = toIdMap(routes, (r) => r.route_id);
  const legsById = toIdMap(legs, (r) => r.leg_id);
  const walksById = toIdMap(walks, (r) => r.walk_id);
  const faresById = toIdMap(fares, (r) => r.fare_id);
  const hoursById = toIdMap(hours, (r) => r.hours_id);
  const shapesById = toIdMap(shapes, (r) => r.shape_id);
  const notesById = toIdMap(notes, (r) => r.note_id);
  const sourcesById = toIdMap(sources, (r) => r.source_id);

  fkEach("manifest", [{ value: manifest.region_id, index: 0 }], regionsById, "region_id");
  fkEach("places", fkRefs(places, (r) => r.region_id), regionsById, "region_id");
  fkEach("place_aliases", fkRefs(aliases, (r) => r.place_id), placesById, "place_id");
  fkEach("place_ambiguities", fkRefs(ambiguities, (r) => r.place_id), placesById, "place_id");
  fkEach("stops", fkRefs(stops, (r) => r.place_id), placesById, "place_id");
  fkEach("place_stops", fkRefs(placeStops, (r) => r.place_id), placesById, "place_id");
  fkEach("place_stops", fkRefs(placeStops, (r) => r.stop_id), stopsById, "stop_id");
  fkEach("legs", fkRefs(legs, (r) => r.route_id), routesById, "route_id");
  fkEach("legs", fkRefs(legs, (r) => r.board_stop_id), stopsById, "board_stop_id");
  fkEach("legs", fkRefs(legs, (r) => r.alight_stop_id), stopsById, "alight_stop_id");
  fkEach("walk_links", fkRefs(walks, (r) => r.from_stop_id), stopsById, "from_stop_id");
  fkEach("walk_links", fkRefs(walks, (r) => r.to_stop_id), stopsById, "to_stop_id");
  fkEach("fare_reports", fkRefs(fares, (r) => r.leg_id), legsById, "leg_id");
  fkEach("hours_reports", fkRefs(hours, (r) => r.route_id), routesById, "route_id");
  fkEach("shapes", fkRefs(shapes, (r) => r.leg_id), legsById, "leg_id");
  fkEach("shapes", fkRefs(shapes, (r) => r.walk_id), walksById, "walk_id");
  fkEach("note_links", fkRefs(noteLinks, (r) => r.note_id), notesById, "note_id");
  fkEach("note_links", fkRefs(noteLinks, (r) => r.leg_id), legsById, "leg_id");
  fkEach("note_links", fkRefs(noteLinks, (r) => r.stop_id), stopsById, "stop_id");
  fkEach("record_sources", fkRefs(recordSources, (r) => r.source_id), sourcesById, "source_id");

  const recordTables: Record<RecordKind, ReadonlyMap<string, unknown>> = {
    region: regionsById,
    place: placesById,
    stop: stopsById,
    place_stop: placeStopsById,
    route: routesById,
    leg: legsById,
    walk_link: walksById,
    fare_report: faresById,
    hours_report: hoursById,
    shape: shapesById,
    note: notesById,
  };

  const sourcesByRecord = group(
    recordSources,
    (r) => recordKey(r.record_kind, r.record_id),
    (r) => String(r.link_id).padStart(12, "0"),
  );

  for (const { row, index } of recordSources) {
    if (!recordTables[row.record_kind].has(row.record_id)) {
      add(
        "dangling_fk",
        "record_sources",
        `${row.record_kind} "${row.record_id}" not found`,
        index,
        row.record_id,
      );
    }
  }

  provEach("region", "regions", provPlain(regions, (r) => r.region_id), sourcesByRecord);
  provEach("place", "places", provPlain(places, (r) => r.place_id), sourcesByRecord);
  provEach("stop", "stops", provPlain(stops, (r) => r.stop_id), sourcesByRecord);
  provEach("place_stop", "place_stops", provRows(placeStops, (r) => r.access_id), sourcesByRecord);
  provEach("route", "routes", provPlain(routes, (r) => r.route_id), sourcesByRecord);
  provEach("leg", "legs", provRows(legs, (r) => r.leg_id), sourcesByRecord);
  provEach("walk_link", "walk_links", provRows(walks, (r) => r.walk_id), sourcesByRecord);
  provEach("fare_report", "fare_reports", provPlain(fares, (r) => r.fare_id), sourcesByRecord);
  provEach("hours_report", "hours_reports", provPlain(hours, (r) => r.hours_id), sourcesByRecord);
  provEach("shape", "shapes", provPlain(shapes, (r) => r.shape_id), sourcesByRecord);
  provEach("note", "notes", provPlain(notes, (r) => r.note_id), sourcesByRecord);

  for (const { row, index } of shapes) {
    if (row.geometry_kind === "source_path") {
      const linked = sourcesByRecord.get(recordKey("shape", row.shape_id)) ?? [];
      const hasGeometrySource = linked.some((rs) => {
        const source = sourcesById.get(rs.source_id);
        return source !== undefined && GEOMETRY_SOURCE_KINDS.has(source.kind);
      });
      if (!hasGeometrySource) {
        add(
          "source_path_without_geometry_source",
          "shapes",
          `source_path shape "${row.shape_id}" lacks a geography/licensed_data source`,
          index,
          row.shape_id,
        );
      }
    }
  }

  const aliasNorms = new Set<string>();
  for (const { row, index } of aliases) {
    if (row.alias_norm !== normalize(row.alias_display)) {
      add(
        "alias_not_normalized",
        "place_aliases",
        `alias_norm "${row.alias_norm}" != normalize(alias_display)`,
        index,
        row.alias_norm,
      );
    }
    if (aliasNorms.has(row.alias_norm)) {
      add(
        "alias_conflict",
        "place_aliases",
        `alias_norm "${row.alias_norm}" appears more than once`,
        index,
        row.alias_norm,
      );
    } else {
      aliasNorms.add(row.alias_norm);
    }
  }

  const ambiguityGroups = new Map<string, { placeIds: Set<string>; firstIndex: number }>();
  for (const { row, index } of ambiguities) {
    const groupEntry = ambiguityGroups.get(row.alias_norm) ?? {
      placeIds: new Set<string>(),
      firstIndex: index,
    };
    groupEntry.placeIds.add(row.place_id);
    ambiguityGroups.set(row.alias_norm, groupEntry);
  }
  for (const [norm, groupEntry] of ambiguityGroups) {
    if (aliasNorms.has(norm)) {
      add(
        "alias_conflict",
        "place_ambiguities",
        `ambiguous alias_norm "${norm}" also appears in place_aliases`,
        groupEntry.firstIndex,
        norm,
      );
    }
    if (groupEntry.placeIds.size < 2) {
      add(
        "ambiguity_too_few",
        "place_ambiguities",
        `ambiguous alias_norm "${norm}" has fewer than two candidate places`,
        groupEntry.firstIndex,
        norm,
      );
    }
  }

  if (issues.length > 0) {
    return err(finish());
  }

  const ambiguitiesByNorm = new Map<string, readonly string[]>();
  for (const [norm, groupEntry] of ambiguityGroups) {
    ambiguitiesByNorm.set(norm, Object.freeze([...groupEntry.placeIds].sort()));
  }

  const pack: Pack = {
    manifest,
    regions: regionsById,
    places: placesById,
    aliasesByNorm: toIdMap(aliases, (r) => r.alias_norm),
    ambiguitiesByNorm,
    stops: stopsById,
    placeStops: placeStopsById,
    placeStopsByPlace: group(placeStops, (r) => r.place_id, (r) => r.access_id),
    routes: routesById,
    legs: legsById,
    walks: walksById,
    faresByLeg: group(fares, (r) => r.leg_id, (r) => r.fare_id),
    hoursByRoute: group(hours, (r) => r.route_id, (r) => r.hours_id),
    shapes: shapesById,
    notes: notesById,
    noteIdsByLeg: new Map(
      [...group(noteLinks, (r) => r.leg_id, (r) => r.note_id)].map(
        ([k, rows]) => [k, Object.freeze(rows.map((r) => r.note_id).sort())],
      ),
    ),
    noteIdsByStop: new Map(
      [...group(noteLinks, (r) => r.stop_id, (r) => r.note_id)].map(
        ([k, rows]) => [k, Object.freeze(rows.map((r) => r.note_id).sort())],
      ),
    ),
    sources: sourcesById,
    sourcesByRecord,
  };
  return ok(pack);
}
