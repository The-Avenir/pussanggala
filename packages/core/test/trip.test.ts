import { describe, expect, it } from "vitest";
import { advanceStep, applyIntent, loadPack, newTrip, resolve, route, selectItinerary, type Intent, type IntentKind, type PlaceCandidate, type ResolveResult } from "../src/index";
import { buildRawPack } from "./fixtures/builder";

function fixture() {
  const loaded = loadPack(buildRawPack({
    places: [{ id: "pl_a", name: "Synthetic A" }, { id: "pl_b", name: "Synthetic B" }, { id: "pl_c", name: "Synthetic C" }],
    stops: [{ id: "st_a", place: "pl_a" }, { id: "st_b", place: "pl_b" }],
    access: [{ id: "ac_a", place: "pl_a", stop: "st_a", dir: "both" }, { id: "ac_b", place: "pl_b", stop: "st_b", dir: "both" }],
    routes: [{ id: "rt_a" }], legs: [{ id: "lg_a", route: "rt_a", from: "st_a", to: "st_b" }],
  }));
  if (!loaded.ok) throw new Error(JSON.stringify(loaded.error));
  const pack = loaded.value;
  const result = route("pl_a", "pl_b", "balanced", pack);
  if (result.status !== "ok") throw new Error(result.reason);
  const itinerary = result.itineraries[0]!;
  const trip = { ...selectItinerary(newTrip(pack, "lowest_fare"), itinerary), originPlaceId: "pl_a", destinationPlaceId: "pl_b", currentStep: 2 };
  return { pack, trip, itinerary };
}

const intent = (kind: IntentKind, extra: Partial<Intent> = {}): Intent => ({ kind, source: "rules", ...extra });
const candidate = (placeId: string): PlaceCandidate => ({ placeId, name: `Synthetic ${placeId}`, area: "Synthetic City", kind: "landmark" });
const resolved = (placeId: string): ResolveResult => ({ status: "resolved", placeId, match: "id" });

describe("trip state transitions", () => {
  it("creates a fresh trip with pack identity and an optional preference", () => {
    const { pack } = fixture();
    expect(newTrip(pack)).toEqual({ packId: pack.manifest.pack_id, schemaVersion: 1, preference: "balanced", currentStep: 0 });
    expect(newTrip(pack, "fewest_transfers").preference).toBe("fewest_transfers");
  });

  it("resets a new journey before applying resolved slots and a requested preference", () => {
    const { trip } = fixture();
    trip.pendingClarification = { slot: "origin", text: "Old synthetic query", candidates: [candidate("pl_c")] };
    const before = structuredClone(trip);
    const next = applyIntent(trip, intent("new_trip", { preference: "fewest_transfers" }), { origin: resolved("pl_c"), destination: resolved("pl_b") });
    expect(next).toEqual({ packId: trip.packId, schemaVersion: trip.schemaVersion, preference: "fewest_transfers", currentStep: 0, originPlaceId: "pl_c", destinationPlaceId: "pl_b" });
    expect(applyIntent(trip, intent("new_trip"), {})).toEqual({ packId: trip.packId, schemaVersion: trip.schemaVersion, preference: "balanced", currentStep: 0 });
    expect(trip).toEqual(before);
  });

  it.each(["origin", "destination"] as const)("changes only the %s slot and clears selection", (slot) => {
    const { trip, pack } = fixture();
    const result = resolve({ kind: "place_id", placeId: "pl_c" }, pack);
    const next = applyIntent(trip, intent(slot === "origin" ? "change_origin" : "change_destination"), { [slot]: result, [slot === "origin" ? "destination" : "origin"]: resolved("pl_c") });
    expect(next[slot === "origin" ? "originPlaceId" : "destinationPlaceId"]).toBe("pl_c");
    expect(next[slot === "origin" ? "destinationPlaceId" : "originPlaceId"]).toBe(slot === "origin" ? "pl_b" : "pl_a");
    expect(next).not.toHaveProperty("selected");
    expect(next.currentStep).toBe(0);
    expect(trip.selected).toBeDefined();
  });

  it("changes preference and resets selection even when no preference is supplied", () => {
    const { trip } = fixture();
    const changed = applyIntent(trip, intent("change_preference", { preference: "shortest_reported_time" }), {});
    expect(changed.preference).toBe("shortest_reported_time");
    expect(changed.currentStep).toBe(0);
    expect(changed).not.toHaveProperty("selected");
    const unspecified = applyIntent(trip, intent("change_preference"), {});
    expect(unspecified.preference).toBe(trip.preference);
    expect(unspecified).not.toHaveProperty("selected");
  });

  it("reverses endpoints, clears selection and pending clarification, and reroutes directed records", () => {
    const { trip, pack } = fixture();
    const withPending = { ...trip, pendingClarification: { slot: "origin" as const, text: "Synthetic", candidates: [candidate("pl_c")] } };
    const reversed = applyIntent(withPending, intent("reverse"), {});
    expect(reversed.originPlaceId).toBe("pl_b");
    expect(reversed.destinationPlaceId).toBe("pl_a");
    expect(reversed.currentStep).toBe(0);
    expect(reversed).not.toHaveProperty("selected");
    expect(reversed).not.toHaveProperty("pendingClarification");
    expect(route(reversed.originPlaceId!, reversed.destinationPlaceId!, reversed.preference, pack)).toEqual({ status: "no_route", reason: "no_route" });
    expect(withPending.selected?.steps).toEqual(trip.selected?.steps);
  });

  it("swaps missing endpoints without adding undefined properties", () => {
    const { pack } = fixture();
    const reversed = applyIntent({ ...newTrip(pack), originPlaceId: "pl_a" }, intent("reverse"), {});
    expect(reversed.destinationPlaceId).toBe("pl_a");
    expect(reversed).not.toHaveProperty("originPlaceId");
  });

  it.each(["origin", "destination"] as const)("sets and answers a %s clarification without changing that slot until chosen", (slot) => {
    const { trip } = fixture();
    const candidates = [candidate("pl_b"), candidate("pl_c")];
    const next = applyIntent(trip, intent(slot === "origin" ? "change_origin" : "change_destination", { [slot]: { kind: "text", text: "Synthetic ambiguous", span: [0, 19] } }), { [slot]: { status: "needs_clarification", candidates } });
    expect(next.pendingClarification).toEqual({ slot, text: "Synthetic ambiguous", candidates });
    expect(next[slot === "origin" ? "originPlaceId" : "destinationPlaceId"]).toBe(slot === "origin" ? "pl_a" : "pl_b");
    const answered = applyIntent(next, intent("clarify_answer", { choiceIndex: 1 }), {});
    expect(answered[slot === "origin" ? "originPlaceId" : "destinationPlaceId"]).toBe("pl_c");
    expect(answered).not.toHaveProperty("pendingClarification");
    expect(answered).not.toHaveProperty("selected");
    expect(answered.currentStep).toBe(0);
  });

  it("asks for the origin first when both new-trip slots are ambiguous", () => {
    const { trip } = fixture();
    const next = applyIntent(trip, intent("new_trip"), { origin: { status: "needs_clarification", candidates: [candidate("pl_a"), candidate("pl_c")] }, destination: { status: "needs_clarification", candidates: [candidate("pl_b"), candidate("pl_c")] } });
    expect(next.pendingClarification?.slot).toBe("origin");
    expect(next.pendingClarification?.text).toBe("");
    expect(next).not.toHaveProperty("originPlaceId");
    expect(next).not.toHaveProperty("destinationPlaceId");
  });

  it("still applies a resolved destination while origin clarification is pending", () => {
    const { trip } = fixture();
    const next = applyIntent(trip, intent("new_trip"), { origin: { status: "needs_clarification", candidates: [candidate("pl_a"), candidate("pl_c")] }, destination: resolved("pl_b") });
    expect(next.pendingClarification?.slot).toBe("origin");
    expect(next.destinationPlaceId).toBe("pl_b");
  });

  it("clears a pending clarification when its slot is explicitly resolved", () => {
    const { trip } = fixture();
    const pending = { ...trip, pendingClarification: { slot: "origin" as const, text: "Synthetic", candidates: [candidate("pl_c")] } };
    expect(applyIntent(pending, intent("change_origin"), { origin: resolved("pl_c") })).not.toHaveProperty("pendingClarification");
    expect(applyIntent(pending, intent("change_destination"), { destination: resolved("pl_c") }).pendingClarification).toEqual(pending.pendingClarification);
  });

  it.each([{ status: "unsupported", reason: "unsupported_place", suggestions: [] }, { status: "outside_ncr", placeId: "pl_outside", name: "Synthetic Outside" }] satisfies ResolveResult[])("does not set an unresolved endpoint: %j", (result) => {
    const { trip } = fixture();
    expect(applyIntent(trip, intent("change_origin"), { origin: result }).originPlaceId).toBe("pl_a");
    expect(applyIntent(trip, intent("new_trip"), { origin: result })).not.toHaveProperty("originPlaceId");
  });

  it.each([undefined, -1, 3])("leaves out-of-range clarification choice %s unchanged", (choiceIndex) => {
    const { trip } = fixture();
    const pending = { ...trip, pendingClarification: { slot: "destination" as const, text: "Synthetic", candidates: [candidate("pl_c")] } };
    const choice = choiceIndex === undefined ? intent("clarify_answer") : intent("clarify_answer", { choiceIndex });
    expect(applyIntent(pending, choice, {})).toEqual(pending);
    expect(applyIntent(trip, choice, {})).toEqual(trip);
  });

  it.each(["alternatives", "ask_boarding", "ask_fare", "ask_transfer", "ask_hours", "unrelated"] as const)("leaves %s state unchanged in a new object", (kind) => {
    const { trip } = fixture();
    const next = applyIntent(trip, intent(kind), { origin: resolved("pl_c") });
    expect(next).toEqual(trip);
    expect(next).not.toBe(trip);
  });

  it("selects an itinerary and manually advances with a clamp", () => {
    const { trip, itinerary, pack } = fixture();
    let selected = selectItinerary(trip, itinerary);
    expect(selected.selected).toEqual(itinerary.ref);
    expect(selected.currentStep).toBe(0);
    selected = advanceStep(selected);
    expect(selected.currentStep).toBe(1);
    for (let i = 0; i < 5; i++) selected = advanceStep(selected);
    expect(selected.currentStep).toBe(2);
    const unselected = newTrip(pack);
    expect(advanceStep(unselected)).toEqual(unselected);
    expect(trip.currentStep).toBe(2);
  });
});
