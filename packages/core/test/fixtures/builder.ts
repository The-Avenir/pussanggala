import { normalize, recordKey, type RawPackTables, type RecordKind, type RouteRow, type SourceRow } from "../../src/index";

export interface PackSpec {
  places: { id: string; name: string; area?: string; kind?: string; aliases?: string[]; ncr?: "accepted" | "ambiguous" | "outside"; coords?: [number, number] }[];
  ambiguities?: { alias: string; placeIds: string[] }[];
  stops: { id: string; place: string; name?: string; landmark?: string }[];
  access: { id: string; place: string; stop: string; dir: "to_stop" | "from_stop" | "both"; walk_m?: number; walk_min?: number; text?: string; excluded?: boolean }[];
  routes: { id: string; mode?: RouteRow["mode"]; signboard?: string; status?: RouteRow["service_status"]; direction?: string }[];
  legs: { id: string; route: string; from: string; to: string; ride_min?: number; excluded?: boolean }[];
  walks?: { id: string; from: string; to: string; walk_m?: number; walk_min?: number; text?: string; excluded?: boolean }[];
  fares?: { id: string; leg: string; min: number; max?: number; effective_at?: string; postedAt?: string }[];
  hours?: { id: string; route: string; text: string; starts?: string; ends?: string; days?: string; postedAt?: string }[];
  notes?: { id: string; body: string; kind?: "tip" | "warning" | "conflict"; leg?: string; stop?: string }[];
  sources?: { id: string; postedAt?: string | null; url?: string }[];
  recordSources?: { kind: RecordKind; id: string; source: string }[];
}

export function buildRawPack(spec: PackSpec): RawPackTables {
  const source = (id: string, postedAt: string | null, url: string | null): SourceRow => ({
    source_id: id, kind: "reddit_thread", url, post_id: null, posted_at: postedAt, observed_at: null, license: null,
  });
  const sources = new Map<string, SourceRow>([
    ["src_thread-1", source("src_thread-1", "2026-06-01", "https://example.invalid/synthetic-thread")],
    ["src_geo-1", { ...source("src_geo-1", null, "https://example.invalid/synthetic-geography"), kind: "geography" }],
  ]);
  for (const item of spec.sources ?? []) {
    sources.set(item.id, source(item.id, item.postedAt ?? null, item.url ?? null));
  }
  const datedSources = new Map<string, string>();
  const datedSource = (date: string): string => {
    const existing = datedSources.get(date);
    if (existing) return existing;
    let index = datedSources.size + 1;
    while (sources.has(`src_dated-${index}`)) index++;
    const id = `src_dated-${index}`;
    sources.set(id, source(id, date, "https://example.invalid/synthetic-dated-thread"));
    datedSources.set(date, id);
    return id;
  };
  const recordSources: RawPackTables["record_sources"] = [];
  const link = (kind: RecordKind, id: string, defaultSource = "src_thread-1", excluded = false) => {
    const overrides = (spec.recordSources ?? []).filter((item) => recordKey(item.kind, item.id) === recordKey(kind, id));
    if (excluded && overrides.length === 0) return;
    for (const sourceId of overrides.length ? overrides.map((item) => item.source) : [defaultSource]) {
      recordSources.push({ link_id: recordSources.length + 1, record_kind: kind, record_id: id, source_id: sourceId, snapshot_sha256: "c".repeat(64), comment_index: null });
    }
  };
  link("region", "rg_ncr", "src_geo-1");
  const places = spec.places.map((item) => {
    link("place", item.id, "src_geo-1");
    return { place_id: item.id, region_id: "rg_ncr", name: item.name, area: item.area ?? "Synthetic City", kind: item.kind ?? "landmark", ncr_status: item.ncr ?? "accepted", lat: item.coords?.[0] ?? null, lng: item.coords?.[1] ?? null, mapping_status: item.coords ? "mapped" : "unmapped" };
  });
  const ambiguityNorms = new Set((spec.ambiguities ?? []).map((item) => normalize(item.alias)));
  const aliases = new Map<string, { place_id: string; alias_norm: string; alias_display: string }>();
  for (const item of spec.places) {
    for (const display of [item.name, ...(item.aliases ?? [])]) {
      const norm = normalize(display);
      if (!ambiguityNorms.has(norm)) aliases.set(norm, { place_id: item.id, alias_norm: norm, alias_display: display });
    }
  }
  const ambiguities = (spec.ambiguities ?? []).flatMap((item) => item.placeIds.map((placeId) => ({ alias_norm: normalize(item.alias), place_id: placeId })));
  const stops = spec.stops.map((item) => {
    link("stop", item.id);
    return { stop_id: item.id, place_id: item.place, name: item.name ?? item.id, landmark_hint: item.landmark ?? "Synthetic stop landmark" };
  });
  const access = spec.access.map((item) => {
    link("place_stop", item.id, "src_thread-1", item.excluded);
    return { access_id: item.id, place_id: item.place, stop_id: item.stop, direction: item.dir, walk_m: item.walk_m ?? null, walk_min: item.walk_min ?? null, walk_text: item.text ?? "Synthetic place access", eligibility: item.excluded ? "excluded" : "ready" };
  });
  const routes = spec.routes.map((item) => {
    link("route", item.id);
    return { route_id: item.id, mode: item.mode ?? "jeepney", signboard: item.signboard ?? null, direction_label: item.direction ?? "Synthetic direction", service_status: item.status ?? "reported_active" };
  });
  const legs = spec.legs.map((item) => {
    link("leg", item.id, "src_thread-1", item.excluded);
    return { leg_id: item.id, route_id: item.route, board_stop_id: item.from, alight_stop_id: item.to, ride_min: item.ride_min ?? null, dist_km: null, eligibility: item.excluded ? "excluded" : "ready" };
  });
  const walks = (spec.walks ?? []).map((item) => {
    link("walk_link", item.id, "src_thread-1", item.excluded);
    return { walk_id: item.id, from_stop_id: item.from, to_stop_id: item.to, walk_m: item.walk_m ?? null, walk_min: item.walk_min ?? null, walk_text: item.text ?? "Synthetic transfer walk", eligibility: item.excluded ? "excluded" : "ready" };
  });
  const fares = (spec.fares ?? []).map((item) => {
    link("fare_report", item.id, item.postedAt === undefined ? "src_thread-1" : datedSource(item.postedAt));
    return { fare_id: item.id, leg_id: item.leg, amount_min: item.min, amount_max: item.max ?? item.min, currency: "PHP", basis: "reported_segment", effective_at: item.effective_at ?? null };
  });
  const hours = (spec.hours ?? []).map((item) => {
    link("hours_report", item.id, item.postedAt === undefined ? "src_thread-1" : datedSource(item.postedAt));
    return { hours_id: item.id, route_id: item.route, hours_text: item.text, starts_local: item.starts ?? null, ends_local: item.ends ?? null, days_text: item.days ?? null };
  });
  const notes = (spec.notes ?? []).map((item) => {
    link("note", item.id);
    return { note_id: item.id, body: item.body, kind: item.kind ?? "tip" };
  });
  const noteLinks = (spec.notes ?? []).filter((item) => item.leg !== undefined || item.stop !== undefined).map((item, index) => ({ link_id: index + 1, note_id: item.id, leg_id: item.leg ?? null, stop_id: item.stop ?? null }));
  const dates = [...sources.values()].flatMap((item) => item.posted_at === null ? [] : [item.posted_at]).sort();
  const postCount = [...sources.values()].filter((item) => item.kind === "reddit_thread").length;
  return {
    manifest: { pack_id: "pack_synthetic", schema_version: 1, region_id: "rg_ncr", bbox: "120.90,14.30,121.10,14.80", created_at: "2026-10-01", source_date_min: dates[0] ?? null, source_date_max: dates.at(-1) ?? null, stale_after_days: 180, input_sha256: "a".repeat(64), input_posts: postCount, answered_posts: postCount, included_posts: postCount, filtered_posts: 0, pending_posts: 0, rejected_posts: 0 },
    regions: [{ region_id: "rg_ncr", name: "Synthetic NCR", boundary_geojson: '{"type":"Polygon","coordinates":[]}', boundary_sha256: "b".repeat(64) }],
    places, place_aliases: [...aliases.values()].map((item, index) => ({ alias_id: index + 1, ...item })), place_ambiguities: ambiguities.map((item, index) => ({ ambiguity_id: index + 1, ...item })),
    stops, place_stops: access, routes, legs, walk_links: walks, fare_reports: fares, hours_reports: hours, shapes: [], notes, note_links: noteLinks, sources: [...sources.values()], record_sources: recordSources,
  };
}
