import { describe, expect, it } from "vitest";
import { compose, loadPack, searchItineraries, sourceRefs, type Pack, type RawPackTables } from "../src/index";
import { buildRawPack, type PackSpec } from "./fixtures/builder";

const now = new Date("2026-10-09T00:00:00Z");

function tripSpec(): PackSpec {
  return {
    places: [{ id: "pl_a", name: "Synthetic Origin", coords: [14.6, 121] }, { id: "pl_b", name: "Synthetic Transfer", coords: [14.61, 121.01] }, { id: "pl_c", name: "Synthetic Destination", coords: [14.62, 121.02] }],
    stops: [{ id: "st_a", place: "pl_a", name: "Synthetic A", landmark: "Synthetic gate" }, { id: "st_b", place: "pl_b" }, { id: "st_x", place: "pl_b" }, { id: "st_c", place: "pl_c", landmark: "" }],
    access: [{ id: "ac_a", place: "pl_a", stop: "st_a", dir: "both", walk_m: 10, walk_min: 1 }, { id: "ac_c", place: "pl_c", stop: "st_c", dir: "both", walk_m: 20, walk_min: 2 }],
    routes: [{ id: "rt_a", mode: "bus", signboard: "SYNTHETIC A", direction: "Synthetic east" }, { id: "rt_c" }],
    legs: [{ id: "lg_a", route: "rt_a", from: "st_a", to: "st_b", ride_min: 10 }, { id: "lg_c", route: "rt_c", from: "st_x", to: "st_c", ride_min: 20 }],
    walks: [{ id: "wk_b", from: "st_b", to: "st_x", walk_m: 50, walk_min: 3 }],
    fares: [{ id: "fr_a", leg: "lg_a", min: 10, effective_at: "2026-09-01" }, { id: "fr_c", leg: "lg_c", min: 20 }],
    hours: [{ id: "hr_a", route: "rt_a", text: "Synthetic daytime hours", starts: "06:00", ends: "18:00", days: "Synthetic weekdays" }, { id: "hr_c", route: "rt_c", text: "Synthetic hours only" }],
  };
}

function fixture(spec = tripSpec(), edit?: (raw: RawPackTables) => void) {
  const raw = buildRawPack(spec);
  edit?.(raw);
  const loaded = loadPack(raw);
  if (!loaded.ok) throw new Error(JSON.stringify(loaded.error));
  const pack = loaded.value;
  const result = searchItineraries("pl_a", "pl_c", pack);
  if (result.status !== "ok") throw new Error(result.reason);
  const itinerary = result.itineraries[0]!;
  return { pack, itinerary, cards: compose(itinerary, pack, now) };
}

function recordIds(pack: Pack): Set<string> {
  return new Set([
    ...pack.places.keys(), ...pack.stops.keys(), ...pack.placeStops.keys(), ...pack.routes.keys(), ...pack.legs.keys(), ...pack.walks.keys(), ...pack.notes.keys(),
    ...[...pack.faresByLeg.values()].flatMap((fares) => fares.map((fare) => fare.fare_id)),
    ...[...pack.hoursByRoute.values()].flatMap((hours) => hours.map((report) => report.hours_id)),
  ]);
}

describe("provenance cards", () => {
  it("composes exactly one ordered card per step with canonical points and report views", () => {
    const { cards, itinerary } = fixture();
    expect(cards.map((card) => card.kind)).toEqual(["access", "ride", "walk", "ride", "access"]);
    expect(cards.map((card) => card.cardId)).toEqual(itinerary.ref.steps.map((_, i) => `${itinerary.id}#${i}`));
    expect(cards[0]).toMatchObject({ kind: "access", direction: "start", place: { placeId: "pl_a", name: "Synthetic Origin", mapped: true }, stop: { stopId: "st_a", placeId: "pl_a", name: "Synthetic A", landmarkHint: "Synthetic gate", mapped: true }, walkMeters: { known: true, value: 10 }, walkMinutes: { known: true, value: 1 } });
    expect(cards[4]).toMatchObject({ kind: "access", direction: "end" });
    const ride = cards[1]!;
    if (ride.kind !== "ride") throw new Error("Expected ride");
    expect(ride).toMatchObject({ routeId: "rt_a", mode: "bus", signboard: "SYNTHETIC A", directionLabel: "Synthetic east", rideMinutes: { known: true, value: 10 } });
    expect(ride.fares[0]).toMatchObject({ fareId: "fr_a", min: 10, max: 10, currency: "PHP", effectiveAt: "2026-09-01" });
    expect(ride.hours[0]).toMatchObject({ hoursId: "hr_a", text: "Synthetic daytime hours", startsLocal: "06:00", endsLocal: "18:00", daysText: "Synthetic weekdays" });
    expect(cards[2]).toMatchObject({ from: { stopId: "st_b" }, to: { stopId: "st_x" }, walkMeters: { known: true, value: 50 }, walkMinutes: { known: true, value: 3 } });
    const lastRide = cards[3]!;
    if (lastRide.kind !== "ride") throw new Error("Expected ride");
    expect(lastRide).not.toHaveProperty("signboard");
    expect(lastRide.alight).not.toHaveProperty("landmarkHint");
    expect(lastRide.fares[0]).not.toHaveProperty("effectiveAt");
    expect(lastRide.hours[0]).not.toHaveProperty("startsLocal");
    expect(lastRide.hours[0]).not.toHaveProperty("endsLocal");
    expect(lastRide.hours[0]).not.toHaveProperty("daysText");
  });

  it("shows missing fares as an empty report list with a warning, never a zero fare", () => {
    const spec = tripSpec();
    spec.fares = [];
    const { cards, itinerary } = fixture(spec);
    expect(itinerary.fare).toEqual({ status: "unknown", missingLegIds: ["lg_a", "lg_c"] });
    for (const card of cards.filter((card) => card.kind === "ride")) {
      expect(card.fares).toEqual([]);
      expect(card.warnings[0]).toEqual({ code: "fare_unknown", message: "No fare reported for this ride.", recordIds: card.routeId === "rt_a" ? ["lg_a"] : ["lg_c"] });
      expect(JSON.stringify(card)).not.toMatch(/"(?:min|max)":0/);
    }
  });

  it("shows conflicting reports separately with their own dates and sources", () => {
    const spec = tripSpec();
    spec.fares![0]!.postedAt = "2025-01-01";
    spec.fares!.push({ id: "fr_a-fresh", leg: "lg_a", min: 15, max: 20, postedAt: "2026-09-01" });
    const { cards } = fixture(spec);
    const ride = cards[1]!;
    if (ride.kind !== "ride") throw new Error("Expected ride");
    expect(ride.fares.map((fare) => [fare.min, fare.max])).toEqual([[10, 10], [15, 20]]);
    expect(ride.fares.map((fare) => fare.sources[0]?.postedAt)).toEqual(["2025-01-01", "2026-09-01"]);
    expect(ride.fares.map((fare) => fare.sources[0]?.stale)).toEqual([true, false]);
    expect(ride.warnings.find((warning) => warning.code === "fare_conflict")).toEqual({ code: "fare_conflict", message: "Fare reports differ; each report is shown with its source date.", recordIds: ["fr_a", "fr_a-fresh"] });
  });

  it("does not call identical reports conflicting", () => {
    const spec = tripSpec();
    spec.fares!.push({ id: "fr_duplicate", leg: "lg_a", min: 10 });
    expect(fixture(spec).cards[1]?.warnings.some((warning) => warning.code === "fare_conflict")).toBe(false);
  });

  it("orders warnings and traces each one to its triggering records", () => {
    const spec = tripSpec();
    delete spec.places[0]!.coords;
    delete spec.legs[0]!.ride_min;
    spec.routes[0]!.status = "unknown";
    spec.fares![0]!.postedAt = "2025-01-01";
    spec.fares!.push({ id: "fr_other", leg: "lg_a", min: 20 });
    spec.sources = [{ id: "src_undated", postedAt: null }];
    spec.recordSources = [{ kind: "route", id: "rt_a", source: "src_undated" }];
    const { cards } = fixture(spec);
    expect(cards[1]?.warnings.map((warning) => warning.code)).toEqual(["fare_conflict", "time_unknown", "service_status_unknown", "unmapped_point", "schematic_only", "stale_source", "source_date_unknown"]);
    expect(cards[1]?.warnings.slice(1).map((warning) => warning.recordIds)).toEqual([["lg_a"], ["rt_a"], ["st_a"], ["lg_a"], ["fr_a"], ["rt_a"]]);
    expect(cards[1]?.warnings.find((warning) => warning.code === "stale_source")?.message).toBe("Source post is older than 180 days (source post date 2025-01-01).");
    for (const card of cards) {
      for (const warning of card.warnings) expect(warning.message).not.toMatch(/verified|confirmed|current/i);
    }
  });

  it("preserves missing walk/access values as unknown", () => {
    const spec = tripSpec();
    delete spec.access[0]!.walk_min;
    delete spec.access[0]!.walk_m;
    delete spec.walks![0]!.walk_min;
    delete spec.walks![0]!.walk_m;
    const { cards } = fixture(spec);
    for (const card of [cards[0]!, cards[2]!]) {
      if (card.kind === "ride") throw new Error("Expected walking card");
      expect(card.walkMinutes).toEqual({ known: false });
      expect(card.walkMeters).toEqual({ known: false });
      expect(card.warnings.some((warning) => warning.code === "time_unknown")).toBe(true);
    }
  });

  it("uses the oldest stale timestamp even when rounded ages tie", () => {
    const spec = tripSpec();
    spec.sources = [{ id: "src_a-newer", postedAt: "2025-01-02T01:00:00Z" }, { id: "src_z-older", postedAt: "2025-01-01T23:00:00Z" }];
    spec.recordSources = [{ kind: "leg", id: "lg_a", source: "src_a-newer" }, { kind: "route", id: "rt_a", source: "src_z-older" }];
    const { pack, itinerary } = fixture(spec);
    const cards = compose(itinerary, pack, new Date("2026-10-09T12:00:00Z"));
    expect(cards[1]?.warnings.find((warning) => warning.code === "stale_source")).toEqual({ code: "stale_source", message: "Source post is older than 180 days (source post date 2025-01-01).", recordIds: ["lg_a", "rt_a"] });
  });

  it("requires mapped status as well as coordinates", () => {
    const { cards } = fixture(tripSpec(), (raw) => {
      (raw.places[0] as Record<string, unknown>).mapping_status = "needs_review";
    });
    const first = cards[0]!;
    if (first.kind !== "access") throw new Error("Expected access");
    expect(first.place.mapped).toBe(false);
    expect(first.stop.mapped).toBe(false);
    expect(first.warnings.find((warning) => warning.code === "unmapped_point")?.recordIds).toEqual(["pl_a", "st_a"]);
  });

  it("orders leg, board and alight notes by group then ID and deduplicates shared notes", () => {
    const spec = tripSpec();
    spec.notes = [{ id: "nt_z", body: "Synthetic leg Z", leg: "lg_a" }, { id: "nt_a", body: "Synthetic leg A", leg: "lg_a" }, { id: "nt_board", body: "Synthetic board", stop: "st_a" }, { id: "nt_alight", body: "Synthetic alight", stop: "st_b" }, { id: "nt_walk", body: "Synthetic walk", stop: "st_x" }];
    const { cards } = fixture(spec, (raw) => raw.note_links.push({ link_id: 6, note_id: "nt_a", leg_id: null, stop_id: "st_a" }));
    const ride = cards[1]!;
    const walk = cards[2]!;
    if (ride.kind !== "ride" || walk.kind !== "walk") throw new Error("Expected ride and walk");
    expect(ride.notes.map((note) => note.noteId)).toEqual(["nt_a", "nt_z", "nt_board", "nt_alight"]);
    expect(walk.notes.map((note) => note.noteId)).toEqual(["nt_alight", "nt_walk"]);
    expect(ride.notes.every((note) => note.sources.length > 0)).toBe(true);
  });

  it("omits the schematic warning only for an owned source path", () => {
    const { cards } = fixture(tripSpec(), (raw) => {
      raw.shapes.push({ shape_id: "sh_a", leg_id: "lg_a", walk_id: null, geojson: '{"type":"LineString","coordinates":[]}', geometry_kind: "source_path" });
      raw.record_sources.push({ link_id: raw.record_sources.length + 1, record_kind: "shape", record_id: "sh_a", source_id: "src_geo-1", snapshot_sha256: null, comment_index: null });
    });
    expect(cards[1]?.warnings.some((warning) => warning.code === "schematic_only")).toBe(false);
    expect(cards[2]?.warnings.some((warning) => warning.code === "schematic_only")).toBe(true);
    expect(cards[3]?.warnings.some((warning) => warning.code === "schematic_only")).toBe(true);
  });

  it("emits only existing sorted unique record IDs and is deterministic", () => {
    const { pack, cards, itinerary } = fixture();
    const existing = recordIds(pack);
    for (const card of cards) {
      expect(card.recordIds).toEqual([...new Set(card.recordIds)].sort());
      for (const id of card.recordIds) expect(existing.has(id)).toBe(true);
      for (const warning of card.warnings) {
        for (const id of warning.recordIds) expect(card.recordIds).toContain(id);
      }
    }
    expect(compose(itinerary, pack, now)).toEqual(cards);
  });
});

describe("sourceRefs", () => {
  it("deduplicates and sorts sources while omitting absent and unparseable optional fields", () => {
    const spec = tripSpec();
    spec.sources = [{ id: "src_z", postedAt: "invalid-date" }, { id: "src_a", postedAt: null }, { id: "src_old", postedAt: "2025-01-01", url: "https://example.invalid/synthetic-old" }];
    spec.recordSources = [{ kind: "leg", id: "lg_a", source: "src_z" }, { kind: "leg", id: "lg_a", source: "src_a" }, { kind: "leg", id: "lg_a", source: "src_old" }, { kind: "route", id: "rt_a", source: "src_old" }];
    const { pack } = fixture(spec);
    const refs = sourceRefs(pack, [{ kind: "leg", id: "lg_a" }, { kind: "route", id: "rt_a" }, { kind: "leg", id: "lg_a" }], now);
    expect(refs.map((ref) => ref.sourceId)).toEqual(["src_a", "src_old", "src_z"]);
    expect(refs[0]).toEqual({ sourceId: "src_a", kind: "reddit_thread", stale: false });
    expect(refs[1]).toEqual({ sourceId: "src_old", kind: "reddit_thread", stale: true, postedAt: "2025-01-01", url: "https://example.invalid/synthetic-old", ageDays: 646 });
    expect(refs[2]).toEqual({ sourceId: "src_z", kind: "reddit_thread", postedAt: "invalid-date", stale: false });
    expect(sourceRefs(pack, [], now)).toEqual([]);
  });

  it("uses a strict stale threshold and floors elapsed days", () => {
    const spec = tripSpec();
    spec.sources = [{ id: "src_boundary", postedAt: new Date(now.getTime() - 180 * 86_400_000 - 1000).toISOString() }];
    spec.recordSources = [{ kind: "leg", id: "lg_a", source: "src_boundary" }];
    const { pack } = fixture(spec);
    const records = [{ kind: "leg" as const, id: "lg_a" }];
    expect(sourceRefs(pack, records, now)[0]).toMatchObject({ ageDays: 180, stale: false });
    expect(sourceRefs(pack, records, new Date(now.getTime() + 86_400_000))[0]).toMatchObject({ ageDays: 181, stale: true });
  });
});
