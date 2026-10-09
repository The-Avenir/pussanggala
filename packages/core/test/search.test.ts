import { describe, expect, it } from "vitest";
import { loadPack, searchItineraries, type Itinerary, type Pack, type SearchOptions } from "../src/index";
import { buildRawPack, type PackSpec } from "./fixtures/builder";

function chain(count = 1): PackSpec {
  return {
    places: [{ id: "pl_a", name: "Synthetic Origin" }, { id: "pl_b", name: "Synthetic Destination" }],
    stops: Array.from({ length: count + 1 }, (_, i) => ({ id: `st_${i}`, place: i === 0 ? "pl_a" : "pl_b" })),
    access: [{ id: "ac_a", place: "pl_a", stop: "st_0", dir: "both", walk_m: 10, walk_min: 1 }, { id: "ac_b", place: "pl_b", stop: `st_${count}`, dir: "both", walk_m: 20, walk_min: 2 }],
    routes: Array.from({ length: count }, (_, i) => ({ id: `rt_${i}` })),
    legs: Array.from({ length: count }, (_, i) => ({ id: `lg_${i}`, route: `rt_${i}`, from: `st_${i}`, to: `st_${i + 1}`, ride_min: 10 })),
    fares: Array.from({ length: count }, (_, i) => ({ id: `fr_${i}`, leg: `lg_${i}`, min: 10 })),
  };
}

function pack(spec: PackSpec): Pack {
  const loaded = loadPack(buildRawPack(spec));
  if (!loaded.ok) throw new Error(JSON.stringify(loaded.error));
  return loaded.value;
}

function search(spec: PackSpec, opts?: SearchOptions) {
  return searchItineraries("pl_a", "pl_b", pack(spec), opts);
}

function found(spec: PackSpec, opts?: SearchOptions): Itinerary[] {
  const result = search(spec, opts);
  if (result.status !== "ok") throw new Error(result.reason);
  return result.itineraries;
}

describe("source-supported itinerary search", () => {
  it("builds a direct trip with complete totals and sorted grounding IDs", () => {
    expect(found(chain())).toEqual([{
      id: "it_ac_a.lg_0.ac_b", ref: { v: 1, steps: [{ kind: "access", id: "ac_a" }, { kind: "leg", id: "lg_0" }, { kind: "access", id: "ac_b" }] },
      originPlaceId: "pl_a", destinationPlaceId: "pl_b", rideCount: 1, transferCount: 0,
      fare: { status: "known", min: 10, max: 10, currency: "PHP", conflict: false, fareIds: ["fr_0"] },
      reportedRideMinutes: { known: true, value: 13 }, walkMeters: { known: true, value: 30 }, routeIds: ["rt_0"],
      recordIds: ["ac_a", "ac_b", "fr_0", "lg_0", "pl_a", "pl_b", "rt_0", "st_0", "st_1"],
    }]);
  });

  it("allows a same-stop transfer across different routes", () => {
    const trip = found(chain(2))[0]!;
    expect(trip.rideCount).toBe(2);
    expect(trip.transferCount).toBe(1);
    expect(trip.routeIds).toEqual(["rt_0", "rt_1"]);
    expect(trip.fare).toMatchObject({ status: "known", min: 20, max: 20 });
  });

  it("allows a directed walk-link transfer and includes its totals and records", () => {
    const spec = chain(2);
    spec.stops.push({ id: "st_transfer", place: "pl_b" });
    spec.legs[1]!.from = "st_transfer";
    spec.walks = [{ id: "wk_transfer", from: "st_1", to: "st_transfer", walk_m: 100, walk_min: 5 }];
    const trip = found(spec)[0]!;
    expect(trip.ref.steps.map((step) => step.id)).toEqual(["ac_a", "lg_0", "wk_transfer", "lg_1", "ac_b"]);
    expect(trip.reportedRideMinutes).toEqual({ known: true, value: 28 });
    expect(trip.walkMeters).toEqual({ known: true, value: 130 });
    expect(trip.recordIds).toContain("wk_transfer");
    expect(trip.recordIds).toContain("st_transfer");
  });

  it("never connects close, identically named stops without a walk link", () => {
    const spec = chain(2);
    spec.places[1]!.coords = [14.600001, 121];
    spec.stops[1]!.name = "Synthetic Shared Name";
    spec.stops.push({ id: "st_transfer", place: "pl_b", name: "Synthetic Shared Name" });
    spec.legs[1]!.from = "st_transfer";
    expect(search(spec)).toEqual({ status: "no_route", reason: "no_route" });
    spec.walks = [{ id: "wk_reverse", from: "st_transfer", to: "st_1" }];
    expect(search(spec).status).toBe("no_route");
  });

  it.each(["suspended", "retired"] as const)("excludes %s routes", (status) => {
    const spec = chain();
    spec.routes[0]!.status = status;
    expect(search(spec)).toEqual({ status: "no_route", reason: "no_route" });
  });

  it("excludes ineligible legs and walks", () => {
    const spec = chain();
    spec.legs[0]!.excluded = true;
    spec.walks = [{ id: "wk_only", from: "st_0", to: "st_1" }];
    expect(search(spec).status).toBe("no_route");
    const transfer = chain(2);
    transfer.stops.push({ id: "st_transfer", place: "pl_b" });
    transfer.legs[1]!.from = "st_transfer";
    transfer.walks = [{ id: "wk_x", from: "st_1", to: "st_transfer", excluded: true }];
    expect(search(transfer).status).toBe("no_route");
  });

  it("returns access-specific failures for excluded or wrongly directed accesses", () => {
    const spec = chain();
    spec.access[0]!.excluded = true;
    expect(search(spec)).toEqual({ status: "no_route", reason: "no_origin_access" });
    spec.access[0]!.excluded = false;
    spec.access[0]!.dir = "from_stop";
    expect(search(spec)).toEqual({ status: "no_route", reason: "no_origin_access" });
    spec.access[0]!.dir = "to_stop";
    spec.access[1]!.dir = "to_stop";
    expect(search(spec)).toEqual({ status: "no_route", reason: "no_destination_access" });
  });

  it("requires a reverse leg for reverse travel", () => {
    const spec = chain();
    expect(searchItineraries("pl_b", "pl_a", pack(spec))).toEqual({ status: "no_route", reason: "no_route" });
    spec.legs.push({ id: "lg_reverse", route: "rt_0", from: "st_1", to: "st_0" });
    expect(searchItineraries("pl_b", "pl_a", pack(spec)).status).toBe("ok");
  });

  it("rejects consecutive legs on one route", () => {
    const spec = chain(2);
    spec.legs[1]!.route = "rt_0";
    expect(search(spec).status).toBe("no_route");
  });

  it("rejects consecutive walk links", () => {
    const spec = chain(2);
    spec.stops.push({ id: "st_x", place: "pl_b" }, { id: "st_y", place: "pl_b" });
    spec.legs[1]!.from = "st_y";
    spec.walks = [{ id: "wk_x", from: "st_1", to: "st_x" }, { id: "wk_y", from: "st_x", to: "st_y" }];
    expect(search(spec).status).toBe("no_route");
  });

  it("avoids repeated stops while retaining a complete acyclic path", () => {
    const spec = chain(2);
    spec.legs.push({ id: "lg_cycle", route: "rt_1", from: "st_1", to: "st_0" });
    expect(found(spec).map((trip) => trip.id)).toEqual(["it_ac_a.lg_0.lg_1.ac_b"]);
  });

  it("caps trips at four legs by default and honors a smaller search limit", () => {
    expect(search(chain(5)).status).toBe("no_route");
    expect(search(chain(5), { maxLegs: 5 }).status).toBe("no_route");
    expect(found(chain(4))[0]?.rideCount).toBe(4);
    expect(search(chain(2), { maxLegs: 1 }).status).toBe("no_route");
  });

  it("keeps missing fares unknown while retaining the evidence for priced legs", () => {
    const spec = chain(2);
    spec.fares = spec.fares!.slice(0, 1);
    const trip = found(spec)[0]!;
    expect(trip.fare).toEqual({ status: "unknown", missingLegIds: ["lg_1"] });
    expect(trip.recordIds).toContain("fr_0");
  });

  it("aggregates conflicting fare reports as ranges without treating duplicate reports as conflicts", () => {
    const spec = chain(2);
    spec.fares!.push({ id: "fr_duplicate", leg: "lg_0", min: 10 });
    expect(found(spec)[0]?.fare).toMatchObject({ conflict: false });
    spec.fares!.push({ id: "fr_conflict", leg: "lg_0", min: 12, max: 15 });
    expect(found(spec)[0]?.fare).toEqual({ status: "known", min: 20, max: 25, currency: "PHP", conflict: true, fareIds: ["fr_0", "fr_1", "fr_conflict", "fr_duplicate"] });
  });

  it.each(["ride", "origin", "destination", "walk"])("keeps time unknown when %s time is missing", (component) => {
    const spec = chain();
    if (component === "ride") delete spec.legs[0]!.ride_min;
    if (component === "origin") delete spec.access[0]!.walk_min;
    if (component === "destination") delete spec.access[1]!.walk_min;
    if (component === "walk") {
      spec.stops.push({ id: "st_x", place: "pl_b" });
      spec.access[1]!.stop = "st_x";
      spec.walks = [{ id: "wk_end", from: "st_1", to: "st_x", walk_m: 10 }];
    }
    expect(found(spec)[0]?.reportedRideMinutes).toEqual({ known: false });
  });

  it("keeps missing walk distances unknown and preserves reported zero values", () => {
    const spec = chain();
    delete spec.access[0]!.walk_m;
    expect(found(spec)[0]?.walkMeters).toEqual({ known: false });
    spec.access.forEach((access) => { access.walk_m = 0; access.walk_min = 0; });
    spec.legs[0]!.ride_min = 0;
    expect(found(spec)[0]?.walkMeters).toEqual({ known: true, value: 0 });
    expect(found(spec)[0]?.reportedRideMinutes).toEqual({ known: true, value: 0 });
  });

  it("returns same_place before other endpoint checks", () => {
    expect(searchItineraries("pl_a", "pl_a", pack(chain()))).toEqual({ status: "no_route", reason: "same_place" });
  });

  it.each(["outside", "ambiguous"] as const)("rejects %s endpoint membership", (ncr) => {
    const spec = chain();
    spec.places[0]!.ncr = ncr;
    expect(search(spec)).toEqual({ status: "no_route", reason: "no_origin_access" });
    spec.places[0]!.ncr = "accepted";
    spec.places[1]!.ncr = ncr;
    expect(search(spec)).toEqual({ status: "no_route", reason: "no_destination_access" });
  });

  it("rejects missing places with the appropriate endpoint reason", () => {
    const loaded = pack(chain());
    expect(searchItineraries("pl_missing", "pl_b", loaded)).toEqual({ status: "no_route", reason: "no_origin_access" });
    expect(searchItineraries("pl_a", "pl_missing", loaded)).toEqual({ status: "no_route", reason: "no_destination_access" });
  });

  it("continues after completion and deterministically bounds expansions", () => {
    const spec = chain(2);
    spec.access.push({ id: "ac_early", place: "pl_b", stop: "st_1", dir: "from_stop", walk_m: 0, walk_min: 0 });
    expect(found(spec).map((trip) => trip.id)).toEqual(["it_ac_a.lg_0.ac_early", "it_ac_a.lg_0.lg_1.ac_b"]);
    expect(found(spec, { maxExpansions: 2 }).map((trip) => trip.id)).toEqual(["it_ac_a.lg_0.ac_early"]);
    expect(search(spec, { maxExpansions: 0 }).status).toBe("no_route");
    spec.legs.reverse();
    expect(found(spec).map((trip) => trip.id)).toEqual(["it_ac_a.lg_0.ac_early", "it_ac_a.lg_0.lg_1.ac_b"]);
  });
});
