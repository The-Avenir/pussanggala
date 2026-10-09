import { describe, expect, it } from "vitest";
import { loadPack, route, validateRestoration, type Pack, type SavedTrip, type StepRef } from "../src/index";
import { buildRawPack, type PackSpec } from "./fixtures/builder";

function spec(count = 2): PackSpec {
  return {
    places: [{ id: "pl_a", name: "Synthetic Origin" }, { id: "pl_b", name: "Synthetic Destination" }, { id: "pl_m", name: "Synthetic Middle" }],
    stops: Array.from({ length: count + 1 }, (_, i) => ({ id: `st_${i}`, place: i === 0 ? "pl_a" : i === count ? "pl_b" : "pl_m" })),
    access: [{ id: "ac_a", place: "pl_a", stop: "st_0", dir: "both", walk_m: 10, walk_min: 1 }, { id: "ac_b", place: "pl_b", stop: `st_${count}`, dir: "both", walk_m: 20, walk_min: 2 }, { id: "ac_m", place: "pl_m", stop: "st_1", dir: "both" }],
    routes: Array.from({ length: count }, (_, i) => ({ id: `rt_${i}` })),
    legs: Array.from({ length: count }, (_, i) => ({ id: `lg_${i}`, route: `rt_${i}`, from: `st_${i}`, to: `st_${i + 1}`, ride_min: 10 })),
    fares: Array.from({ length: count }, (_, i) => ({ id: `fr_${i}`, leg: `lg_${i}`, min: 10 })),
  };
}

function load(spec: PackSpec): Pack {
  const result = loadPack(buildRawPack(spec));
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  return result.value;
}

function fixture() {
  const initialSpec = spec();
  const pack = load(initialSpec);
  const result = route("pl_a", "pl_b", "balanced", pack);
  if (result.status !== "ok") throw new Error(result.reason);
  const itinerary = result.itineraries[0]!;
  const saved: SavedTrip = { packId: pack.manifest.pack_id, schemaVersion: 1, originPlaceId: "pl_a", destinationPlaceId: "pl_b", preference: "balanced", routeJson: JSON.stringify(itinerary.ref), currentStep: 1 };
  return { initialSpec, pack, itinerary, saved };
}

function withMiddle(saved: SavedTrip, steps: StepRef[]): SavedTrip {
  return { ...saved, routeJson: JSON.stringify({ v: 1, steps: [{ kind: "access", id: "ac_a" }, ...steps, { kind: "access", id: "ac_b" }] }) };
}

const leg = (id: string): StepRef => ({ kind: "leg", id });
const walk = (id: string): StepRef => ({ kind: "walk", id });

describe("restored trip validation", () => {
  it("round-trips a routed itinerary through the shared builder", () => {
    const { pack, itinerary, saved } = fixture();
    expect(validateRestoration(saved, pack)).toEqual({ status: "valid", itinerary, currentStep: 1 });
  });

  it("revalidates stable records across a changed pack ID and does not validate preference", () => {
    const { pack, saved, itinerary } = fixture();
    pack.manifest.pack_id = "pack_replacement";
    saved.preference = "legacy-synthetic-preference";
    expect(validateRestoration(saved, pack)).toEqual({ status: "valid", itinerary, currentStep: 1 });
  });

  it("rebuilds totals from replacement reports without restoring obsolete values", () => {
    const { initialSpec, saved } = fixture();
    initialSpec.fares![0]!.min = 15;
    initialSpec.fares!.push({ id: "fr_conflict", leg: "lg_0", min: 20 });
    delete initialSpec.legs[1]!.ride_min;
    const result = validateRestoration(saved, load(initialSpec));
    expect(result.status).toBe("valid");
    if (result.status !== "valid") throw new Error(result.reason);
    expect(result.itinerary.fare).toMatchObject({ status: "known", min: 25, max: 30, conflict: true, fareIds: ["fr_0", "fr_1", "fr_conflict"] });
    expect(result.itinerary.reportedRideMinutes).toEqual({ known: false });
  });

  it("returns schema_changed before parsing invalid JSON", () => {
    const { pack, saved } = fixture();
    pack.manifest.schema_version = 2;
    saved.routeJson = "invalid-json";
    expect(validateRestoration(saved, pack)).toEqual({ status: "needs_replan", reason: "schema_changed" });
  });

  it.each(["{", '{"v":2,"steps":[]}', '{"v":1,"steps":[{"kind":"leg","id":"wk_wrong-prefix"}]}'])("rejects invalid route JSON: %s", (routeJson) => {
    const { pack, saved } = fixture();
    expect(validateRestoration({ ...saved, routeJson, originPlaceId: "pl_missing" }, pack)).toEqual({ status: "needs_replan", reason: "invalid_route_json" });
  });

  it("returns record_missing when a stored leg disappears", () => {
    const { initialSpec, saved } = fixture();
    initialSpec.legs.pop();
    initialSpec.fares!.pop();
    expect(validateRestoration(saved, load(initialSpec))).toEqual({ status: "needs_replan", reason: "record_missing" });
  });

  it.each(["access", "walk"] as const)("rejects a missing %s step before endpoint or continuity checks", (kind) => {
    const { pack, saved } = fixture();
    const ref = JSON.parse(saved.routeJson) as { v: 1; steps: StepRef[] };
    if (kind === "access") ref.steps[0] = { kind: "access", id: "ac_missing" };
    else ref.steps.splice(2, 0, { kind: "walk", id: "wk_missing" });
    expect(validateRestoration({ ...saved, routeJson: JSON.stringify(ref) }, pack)).toEqual({ status: "needs_replan", reason: "record_missing" });
  });

  it.each(["originPlaceId", "destinationPlaceId"] as const)("rejects a missing %s", (slot) => {
    const { pack, saved } = fixture();
    expect(validateRestoration({ ...saved, [slot]: "pl_missing" }, pack)).toEqual({ status: "needs_replan", reason: "record_missing" });
  });

  it.each(["leg", "access"] as const)("rejects an excluded %s before suspended services", (kind) => {
    const { initialSpec, saved } = fixture();
    if (kind === "leg") initialSpec.legs[0]!.excluded = true;
    else initialSpec.access[0]!.excluded = true;
    initialSpec.routes[0]!.status = "suspended";
    expect(validateRestoration(saved, load(initialSpec))).toEqual({ status: "needs_replan", reason: "record_ineligible" });
  });

  it.each(["outside", "ambiguous"] as const)("rejects %s endpoint membership", (ncr) => {
    const { initialSpec, saved } = fixture();
    initialSpec.places[1]!.ncr = ncr;
    expect(validateRestoration(saved, load(initialSpec))).toEqual({ status: "needs_replan", reason: "record_ineligible" });
  });

  it.each(["suspended", "retired"] as const)("rejects %s service before endpoint checks", (status) => {
    const { initialSpec, saved } = fixture();
    initialSpec.routes[0]!.status = status;
    expect(validateRestoration({ ...saved, originPlaceId: "pl_m" }, load(initialSpec))).toEqual({ status: "needs_replan", reason: "service_suspended" });
  });

  it("rejects an endpoint mismatch before broken continuity", () => {
    const { initialSpec, saved } = fixture();
    initialSpec.legs[1]!.from = "st_0";
    expect(validateRestoration({ ...saved, destinationPlaceId: "pl_m" }, load(initialSpec))).toEqual({ status: "needs_replan", reason: "endpoint_mismatch" });
  });

  it.each(["origin", "destination"] as const)("rejects a wrongly directed %s access", (slot) => {
    const { initialSpec, saved } = fixture();
    initialSpec.access[slot === "origin" ? 0 : 1]!.dir = slot === "origin" ? "from_stop" : "to_stop";
    expect(validateRestoration(saved, load(initialSpec))).toEqual({ status: "needs_replan", reason: "endpoint_mismatch" });
  });

  it("requires access steps at both endpoints", () => {
    const { pack, saved } = fixture();
    const steps = [leg("lg_0"), leg("lg_1")];
    expect(validateRestoration({ ...saved, routeJson: JSON.stringify({ v: 1, steps }) }, pack)).toEqual({ status: "needs_replan", reason: "endpoint_mismatch" });
  });

  it("rejects a disconnected leg before step bounds", () => {
    const { initialSpec, saved } = fixture();
    initialSpec.legs[1]!.from = "st_0";
    expect(validateRestoration({ ...saved, currentStep: -1 }, load(initialSpec))).toEqual({ status: "needs_replan", reason: "continuity_broken" });
  });

  it("rejects consecutive legs on the same route", () => {
    const { initialSpec, saved } = fixture();
    initialSpec.legs[1]!.route = "rt_0";
    expect(validateRestoration(saved, load(initialSpec))).toEqual({ status: "needs_replan", reason: "continuity_broken" });
  });

  it("rejects access steps in the middle", () => {
    const { pack, saved } = fixture();
    expect(validateRestoration(withMiddle(saved, [leg("lg_0"), { kind: "access", id: "ac_m" }, leg("lg_1")]), pack)).toEqual({ status: "needs_replan", reason: "continuity_broken" });
  });

  it("rejects repeated stops", () => {
    const { initialSpec, saved } = fixture();
    initialSpec.routes.push({ id: "rt_cycle" });
    initialSpec.legs.push({ id: "lg_cycle", route: "rt_cycle", from: "st_1", to: "st_0" });
    expect(validateRestoration(withMiddle(saved, [leg("lg_0"), leg("lg_cycle"), leg("lg_0"), leg("lg_1")]), load(initialSpec))).toEqual({ status: "needs_replan", reason: "continuity_broken" });
  });

  it("requires at least one leg and arrival at the destination access stop", () => {
    const { initialSpec, saved } = fixture();
    initialSpec.walks = [{ id: "wk_direct", from: "st_0", to: "st_2" }];
    const pack = load(initialSpec);
    expect(validateRestoration(withMiddle(saved, [walk("wk_direct")]), pack)).toEqual({ status: "needs_replan", reason: "continuity_broken" });
    expect(validateRestoration(withMiddle(saved, [leg("lg_0")]), pack)).toEqual({ status: "needs_replan", reason: "continuity_broken" });
  });

  it("enforces the same four-leg maximum as search", () => {
    const { saved } = fixture();
    expect(validateRestoration(withMiddle(saved, Array.from({ length: 5 }, (_, i) => leg(`lg_${i}`))), load(spec(5)))).toEqual({ status: "needs_replan", reason: "continuity_broken" });
  });

  it("restores supported walk transfers and keeps excluded walks ineligible", () => {
    const { initialSpec, saved } = fixture();
    initialSpec.stops.push({ id: "st_transfer", place: "pl_m" });
    initialSpec.legs[1]!.from = "st_transfer";
    initialSpec.legs[1]!.route = "rt_0";
    initialSpec.walks = [{ id: "wk_transfer", from: "st_1", to: "st_transfer", walk_m: 50, walk_min: 5 }];
    const savedWalk = withMiddle(saved, [leg("lg_0"), walk("wk_transfer"), leg("lg_1")]);
    const pack = load(initialSpec);
    const restored = validateRestoration(savedWalk, pack);
    const routed = route("pl_a", "pl_b", "balanced", pack);
    if (routed.status !== "ok") throw new Error(routed.reason);
    expect(restored).toEqual({ status: "valid", itinerary: routed.itineraries[0], currentStep: 1 });
    initialSpec.walks[0]!.excluded = true;
    expect(validateRestoration(savedWalk, load(initialSpec))).toEqual({ status: "needs_replan", reason: "record_ineligible" });
  });

  it("rejects consecutive walks and wrongly directed walk links", () => {
    const { initialSpec, saved } = fixture();
    initialSpec.stops.push({ id: "st_x", place: "pl_m" }, { id: "st_y", place: "pl_m" });
    initialSpec.legs[1]!.from = "st_y";
    initialSpec.walks = [{ id: "wk_x", from: "st_1", to: "st_x" }, { id: "wk_y", from: "st_x", to: "st_y" }];
    expect(validateRestoration(withMiddle(saved, [leg("lg_0"), walk("wk_x"), walk("wk_y"), leg("lg_1")]), load(initialSpec))).toEqual({ status: "needs_replan", reason: "continuity_broken" });
    initialSpec.walks[0]!.from = "st_y";
    expect(validateRestoration(withMiddle(saved, [leg("lg_0"), walk("wk_x"), leg("lg_1")]), load(initialSpec))).toEqual({ status: "needs_replan", reason: "continuity_broken" });
  });

  it.each([-1, 4, 0.5, NaN, Infinity])("rejects invalid manual step %s", (currentStep) => {
    const { pack, saved } = fixture();
    expect(validateRestoration({ ...saved, currentStep }, pack)).toEqual({ status: "needs_replan", reason: "step_out_of_bounds" });
  });

  it.each([0, 3])("accepts boundary manual step %s", (currentStep) => {
    const { pack, saved, itinerary } = fixture();
    expect(validateRestoration({ ...saved, currentStep }, pack)).toEqual({ status: "valid", itinerary, currentStep });
  });
});
