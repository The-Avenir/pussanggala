import { describe, expect, it } from "vitest";
import { loadPack, paretoFilter, route, searchItineraries, type Preference } from "../src/index";
import { buildRawPack, type PackSpec } from "./fixtures/builder";

interface Option {
  id: string;
  rides?: number;
  min?: number;
  max?: number;
  time?: number;
}

function alternatives(options: Option[]) {
  const spec: PackSpec = {
    places: [{ id: "pl_a", name: "Synthetic Origin" }, { id: "pl_b", name: "Synthetic Destination" }],
    stops: [{ id: "st_a", place: "pl_a" }, { id: "st_b", place: "pl_b" }],
    access: [{ id: "ac_a", place: "pl_a", stop: "st_a", dir: "both", walk_m: 0, walk_min: 0 }, { id: "ac_b", place: "pl_b", stop: "st_b", dir: "both", walk_m: 0, walk_min: 0 }],
    routes: [], legs: [], fares: [],
  };
  for (const option of options) {
    const rides = option.rides ?? 1;
    for (let i = 0; i < rides; i++) {
      const from = i === 0 ? "st_a" : `st_${option.id}-${i}`;
      const to = i === rides - 1 ? "st_b" : `st_${option.id}-${i + 1}`;
      if (to !== "st_b") spec.stops.push({ id: to, place: "pl_a" });
      const routeId = `rt_${option.id}-${i}`;
      const legId = `lg_${option.id}-${i}`;
      spec.routes.push({ id: routeId });
      const leg: PackSpec["legs"][number] = { id: legId, route: routeId, from, to };
      if (option.time !== undefined) leg.ride_min = i === 0 ? option.time : 0;
      spec.legs.push(leg);
      if (option.min !== undefined) spec.fares!.push({ id: `fr_${option.id}-${i}`, leg: legId, min: i === 0 ? option.min : 0, max: i === 0 ? option.max ?? option.min : 0 });
    }
  }
  const loaded = loadPack(buildRawPack(spec));
  if (!loaded.ok) throw new Error(JSON.stringify(loaded.error));
  return loaded.value;
}

function routed(options: Option[], preference: Preference = "balanced") {
  const result = route("pl_a", "pl_b", preference, alternatives(options));
  if (result.status !== "ok") throw new Error(result.reason);
  return result;
}

function ids(options: Option[], preference: Preference) {
  return routed(options, preference).itineraries.map((item) => item.routeIds[0]);
}

describe("ranked alternatives and qualified comparisons", () => {
  it("retains unknown-fare options after known fares and names the excluded comparison set", () => {
    const result = routed([{ id: "unknown", time: 5 }, { id: "cheap", min: 10, time: 40 }, { id: "costly", min: 20, time: 20 }], "lowest_fare");
    const [cheap, costly, unknown] = result.itineraries;
    expect(result.itineraries.map((item) => item.routeIds[0])).toEqual(["rt_cheap-0", "rt_costly-0", "rt_unknown-0"]);
    expect(unknown?.fare).toEqual({ status: "unknown", missingLegIds: ["lg_unknown-0"] });
    expect(result.comparisons.find((item) => item.kind === "lowest_reported_fare")).toEqual({
      kind: "lowest_reported_fare", winnerId: cheap!.id, comparedIds: [cheap!.id, costly!.id], excludedUnknownIds: [unknown!.id],
      text: "Lowest reported fare among 2 options with fare information. 1 option(s) have no fare information.",
    });
  });

  it.each([{ min: 12, max: 18 }, { min: 20, max: 20 }, { min: 10, max: 20 }])("makes no fare claim for overlapping or touching ranges: %j", (fare) => {
    const result = routed([{ id: "a", min: 10, max: 20, time: 30 }, { id: "b", ...fare, time: 20 }]);
    expect(result.comparisons.some((item) => item.kind === "lowest_reported_fare")).toBe(false);
  });

  it("makes no ride claim when rides tie", () => {
    expect(routed([{ id: "a" }, { id: "b" }]).comparisons).toEqual([]);
  });

  it("compares rides across all final options", () => {
    const result = routed([{ id: "direct" }, { id: "transfer", rides: 2 }, { id: "long", rides: 3 }]);
    expect(result.comparisons).toEqual([{
      kind: "fewest_rides", winnerId: result.itineraries[0]!.id, comparedIds: result.itineraries.map((item) => item.id), excludedUnknownIds: [],
      text: "Fewest rides among 3 options.",
    }]);
  });

  it("qualifies the shortest reported time and excludes unknown durations", () => {
    const result = routed([{ id: "fast", min: 20, time: 10 }, { id: "slow", min: 10, time: 20 }, { id: "unknown", min: 5 }], "shortest_reported_time");
    expect(result.comparisons.find((item) => item.kind === "shortest_reported_time")).toEqual({
      kind: "shortest_reported_time", winnerId: result.itineraries[0]!.id, comparedIds: result.itineraries.slice(0, 2).map((item) => item.id), excludedUnknownIds: [result.itineraries[2]!.id],
      text: "Shortest reported travel time among 2 options with time information (reported, not guaranteed). 1 option(s) have no time information.",
    });
  });

  it("does not claim fastest when reported times tie", () => {
    const result = routed([{ id: "a", min: 10, max: 20, time: 10 }, { id: "b", min: 15, max: 25, time: 10 }]);
    expect(result.comparisons).toEqual([]);
  });

  it("emits no comparison with fewer than two applicable values", () => {
    expect(routed([{ id: "single", min: 10, time: 10 }]).comparisons).toEqual([]);
    expect(routed([{ id: "known", min: 10, time: 10 }, { id: "unknown" }]).comparisons).toEqual([]);
  });

  const options: Option[] = [
    { id: "a", min: 20, time: 40 }, { id: "b", rides: 2, min: 10, time: 20 },
    { id: "c", min: 15, time: 50 }, { id: "u", time: 10 }, { id: "d", min: 20 },
  ];
  it.each([
    ["lowest_fare", ["b", "c", "a", "d", "u"]],
    ["fewest_transfers", ["c", "a", "d", "u", "b"]],
    ["shortest_reported_time", ["u", "b", "a", "c", "d"]],
    ["balanced", ["u", "a", "c", "d", "b"]],
  ] as const)("orders alternatives by %s", (preference, expected) => {
    expect(ids(options, preference)).toEqual(expected.map((id) => `rt_${id}-0`));
  });

  it("orders lowest fare by min then max before ride count", () => {
    expect(ids([{ id: "wide", min: 10, max: 30 }, { id: "narrow", rides: 2, min: 10, max: 15 }], "lowest_fare")).toEqual(["rt_narrow-0", "rt_wide-0"]);
  });

  it.each(["balanced", "lowest_fare", "fewest_transfers", "shortest_reported_time"] as const)("breaks %s ties by itinerary ID regardless of insertion order", (preference) => {
    expect(ids([{ id: "z" }, { id: "a" }], preference)).toEqual(["rt_a-0", "rt_z-0"]);
  });

  it("removes a fully comparable dominated option while keeping unknown options", () => {
    const result = routed([
      { id: "best", min: 10, time: 10 }, { id: "dominated", rides: 2, min: 20, time: 20 },
      { id: "fare_unknown", rides: 3, time: 30 }, { id: "time_unknown", rides: 3, min: 30 },
    ]);
    expect(result.itineraries.map((item) => item.routeIds[0])).toEqual(["rt_best-0", "rt_fare_unknown-0", "rt_time_unknown-0"]);
  });

  it.each([
    { id: "other", min: 10, max: 15, time: 5 },
    { id: "other", min: 20, time: 5 },
    { id: "other", min: 5, time: 20 },
    { id: "other", min: 10, time: 10 },
  ])("preserves incomparable, overlapping or tied alternatives: %j", (other) => {
    const pack = alternatives([{ id: "base", min: 10, max: 15, time: 10 }, other]);
    const searched = searchItineraries("pl_a", "pl_b", pack);
    if (searched.status !== "ok") throw new Error(searched.reason);
    expect(paretoFilter(searched.itineraries)).toHaveLength(2);
  });

  it("requires known values on the potential dominator too", () => {
    const result = routed([{ id: "cheap_unknown_time", min: 1 }, { id: "fast_unknown_fare", time: 1 }, { id: "known", rides: 2, min: 20, time: 20 }]);
    expect(result.itineraries).toHaveLength(3);
  });

  it("keeps five options and compares only that final list", () => {
    const result = routed(Array.from({ length: 7 }, (_, i) => ({ id: `option-${i}`, min: i + 10 })));
    expect(result.itineraries).toHaveLength(5);
    expect(result.comparisons).toEqual([{
      kind: "lowest_reported_fare", winnerId: result.itineraries[0]!.id, comparedIds: result.itineraries.map((item) => item.id), excludedUnknownIds: [],
      text: "Lowest reported fare among 5 options with fare information.",
    }]);
  });

  it("passes through every no-route reason", () => {
    const pack = alternatives([]);
    expect(route("pl_a", "pl_a", "balanced", pack)).toEqual({ status: "no_route", reason: "same_place" });
    expect(route("pl_missing", "pl_b", "balanced", pack)).toEqual({ status: "no_route", reason: "no_origin_access" });
    expect(route("pl_a", "pl_missing", "balanced", pack)).toEqual({ status: "no_route", reason: "no_destination_access" });
    expect(route("pl_a", "pl_b", "balanced", pack)).toEqual({ status: "no_route", reason: "no_route" });
  });
});
