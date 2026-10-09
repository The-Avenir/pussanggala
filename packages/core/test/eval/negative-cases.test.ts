import { describe, expect, it } from "vitest";
import {
  answerHours, applyIntent, buildContext, compose, loadPack, newTrip, parse, resolve, route, selectItinerary, validateRestoration,
  type IntentKind, type Pack, type Preference, type ResolvedSlots, type SavedTrip, type TripState,
} from "../../src/index";
import { buildRawPack } from "../fixtures/builder";
import { evalNetworkSpec, loadEvalNetwork, NETWORK_DIAGRAM } from "../fixtures/eval-network";

const now = new Date("2026-10-09T00:00:00Z");
const pack = loadEvalNetwork();
const accepted = [...pack.places.values()].filter((place) => place.ncr_status === "accepted").map((place) => place.place_id).sort();
const allPairs = accepted.flatMap((from) => accepted.map((to) => ({ from, to, result: route(from, to, "balanced", pack) })));
const allItineraries = allPairs.flatMap(({ result }) => result.status === "ok" ? result.itineraries : []);
const allCards = allItineraries.flatMap((itinerary) => compose(itinerary, pack, now));
const allRecordIds = new Set([
  ...pack.regions.keys(), ...pack.places.keys(), ...pack.stops.keys(), ...pack.placeStops.keys(), ...pack.routes.keys(), ...pack.legs.keys(), ...pack.walks.keys(), ...pack.shapes.keys(), ...pack.notes.keys(), ...pack.sources.keys(),
  ...[...pack.faresByLeg.values()].flatMap((fares) => fares.map((fare) => fare.fare_id)),
  ...[...pack.hoursByRoute.values()].flatMap((hours) => hours.map((report) => report.hours_id)),
]);

function routed(from: string, to: string, preference: Preference = "balanced") {
  const result = route(from, to, preference, pack);
  if (result.status !== "ok") throw new Error(`${from}->${to}: ${result.reason}`);
  return result;
}

function resolveText(text: string) {
  return resolve({ kind: "text", text, span: [0, text.length] }, pack);
}

function execute(query: string, trip?: TripState) {
  const intent = parse(query, trip);
  const slots: ResolvedSlots = {};
  if (intent.origin) slots.origin = resolve(intent.origin, pack, trip);
  if (intent.destination) slots.destination = resolve(intent.destination, pack, trip);
  const state = applyIntent(trip ?? newTrip(pack), intent, slots);
  if (!state.originPlaceId || !state.destinationPlaceId) throw new Error(`Missing endpoints for synthetic query: ${query}`);
  const result = routed(state.originPlaceId, state.destinationPlaceId, state.preference);
  const itinerary = result.itineraries[0]!;
  const selected = selectItinerary(state, itinerary);
  const cards = compose(itinerary, pack, now);
  const hours = intent.kind === "ask_hours" ? answerHours(itinerary.routeIds, pack, now) : [];
  const bundle = buildContext({ trip: selected, cards, itineraries: result.itineraries, comparisons: result.comparisons, hourStatements: hours, now }, pack);
  return { intent, state, selected, result, itinerary, cards, bundle };
}

describe("synthetic negative and edge evaluation", () => {
  it("has the documented fictional network size, provenance and diversity", () => {
    expect(accepted).toHaveLength(20);
    expect(pack.places.size).toBe(22);
    expect(pack.stops.size).toBe(26);
    expect(pack.routes.size).toBe(12);
    expect(new Set([...pack.routes.values()].map((row) => row.mode))).toEqual(new Set(["jeepney", "modern_jeepney", "uv_express", "bus", "tricycle", "rail"]));
    expect(new Set([...pack.placeStops.values()].map((row) => row.direction))).toEqual(new Set(["both", "to_stop", "from_stop"]));
    expect([...pack.places.values()].filter((row) => row.ncr_status === "accepted" && row.lat === null)).toHaveLength(2);
    expect(NETWORK_DIAGRAM).toContain("Synthetic network");
    expect(allPairs).toHaveLength(400);
    expect(allItineraries.length).toBeGreaterThan(0);
  });

  it.each(["Central Hub", "CENTRAL HUB", "Central-Hub"])("clarifies the ambiguous alias %s with named areas", (alias) => {
    const result = resolveText(alias);
    expect(result.status).toBe("needs_clarification");
    if (result.status !== "needs_clarification") throw new Error(`Expected clarification for ${alias}`);
    expect(result.candidates.map((candidate) => candidate.placeId)).toEqual(["pl_b", "pl_c"]);
    expect(result.candidates).toHaveLength(2);
    for (const candidate of result.candidates) expect(candidate.area).toMatch(/^Synthetic District /);
  });

  it("rejects the outside place", () => {
    expect(resolveText("Umber Village")).toEqual({ status: "outside_ncr", placeId: "pl_u", name: "Umber Village" });
  });

  it("does not resolve ambiguous NCR membership", () => {
    expect(resolveText("Vista Point")).toEqual({ status: "unsupported", reason: "ncr_unresolved", suggestions: [] });
  });

  it.each([
    ["Alhpa Hub", "pl_a"], ["Bayani Bazarr", "pl_b"], ["Cedar Clinc", "pl_c"], ["Dalisay Rali", "pl_d"], ["Emerald Campuz", "pl_e"],
  ])("puts the intended place in the first three for one-edit alias %s", (text, placeId) => {
    const result = resolveText(text!);
    expect(["resolved", "needs_clarification"]).toContain(result.status);
    const ids = result.status === "resolved" ? [result.placeId] : result.status === "needs_clarification" ? result.candidates.slice(0, 3).map((candidate) => candidate.placeId) : [];
    expect(ids).toContain(placeId);
  });

  it("does not auto-pick an unsupported arbitrary address", () => {
    expect(resolveText("999 Imaginary Avenue Unit 77")).toEqual({ status: "unsupported", reason: "unsupported_place", suggestions: [] });
  });

  it("requires trip context for a trip endpoint reference", () => {
    expect(resolve({ kind: "trip_ref", ref: "origin" }, pack)).toEqual({ status: "unsupported", reason: "no_trip_context", suggestions: [] });
  });

  it.each([
    ["disconnected corridors", "pl_a", "pl_h", "no_route"],
    ["origin-only access cannot be destination", "pl_l", "pl_t", "no_destination_access"],
    ["excluded origin access", "pl_q", "pl_a", "no_origin_access"],
    ["excluded destination access", "pl_a", "pl_q", "no_destination_access"],
    ["destination-only access cannot be origin", "pl_o", "pl_t", "no_origin_access"],
    ["similar nearby stops have no forward connection", "pl_r", "pl_s", "no_route"],
    ["similar nearby stops have no reverse connection", "pl_s", "pl_r", "no_route"],
    ["one-way modern service has no reverse", "pl_d", "pl_c", "no_route"],
    ["suspended-only connection", "pl_p", "pl_o", "no_route"],
    ["retired and excluded-walk connection", "pl_p", "pl_h", "no_route"],
    ["excluded-leg connection", "pl_p", "pl_g", "no_route"],
    ["five rides do not form an allowed trip", "pl_a", "pl_g", "no_route"],
    ["same place", "pl_a", "pl_a", "same_place"],
    ["outside origin", "pl_u", "pl_b", "no_origin_access"],
    ["ambiguous NCR destination", "pl_a", "pl_v", "no_destination_access"],
  ])("withholds %s", (_name, from, to, reason) => {
    expect(route(from!, to!, "balanced", pack)).toEqual({ status: "no_route", reason });
  });

  it.each(["rt_suspended", "rt_retired"])("never uses %s across all accepted place pairs", (routeId) => {
    for (const itinerary of allItineraries) expect(itinerary.routeIds).not.toContain(routeId);
  });

  it.each(["lg_excluded-pg", "wk_excluded-ph"])("never uses excluded step %s across all accepted place pairs", (id) => {
    for (const itinerary of allItineraries) expect(itinerary.ref.steps.map((step) => step.id)).not.toContain(id);
  });

  it("never returns more than four rides or revisits a stop across all accepted place pairs", () => {
    expect(allItineraries.some((itinerary) => itinerary.rideCount === 4)).toBe(true);
    for (const itinerary of allItineraries) {
      expect(itinerary.rideCount).toBeLessThanOrEqual(4);
      const steps = itinerary.ref.steps;
      const stops = [pack.placeStops.get(steps[0]!.id)!.stop_id];
      for (const step of steps.slice(1, -1)) {
        if (step.kind === "leg") stops.push(pack.legs.get(step.id)!.alight_stop_id);
        else if (step.kind === "walk") stops.push(pack.walks.get(step.id)!.to_stop_id);
        else throw new Error("Unexpected middle access");
      }
      expect(new Set(stops).size).toBe(stops.length);
    }
  });

  it("keeps the fare-less direct option visible after four known-fare options", () => {
    const result = routed("pl_a", "pl_c", "lowest_fare");
    expect(result.itineraries).toHaveLength(5);
    expect(result.itineraries.slice(0, 4).every((itinerary) => itinerary.fare.status === "known")).toBe(true);
    expect(result.itineraries[4]?.ref.steps.map((step) => step.id)).toEqual(["ac_a", "lg_unknown-ac", "ac_c"]);
    expect(result.itineraries[4]?.fare).toEqual({ status: "unknown", missingLegIds: ["lg_unknown-ac"] });
    expect(result.itineraries[4]?.reportedRideMinutes).toEqual({ known: false });
  });

  it("does not zero-fill a missing fare in a multi-ride total", () => {
    const itinerary = routed("pl_h", "pl_j").itineraries[0]!;
    expect(itinerary.fare).toEqual({ status: "unknown", missingLegIds: ["lg_unknown-ij"] });
    expect(itinerary.reportedRideMinutes).toEqual({ known: true, value: 24 });
  });

  it("retains conflicting fares as the independently reported range", () => {
    const itinerary = routed("pl_d", "pl_e").itineraries[0]!;
    expect(itinerary.fare).toEqual({ status: "known", min: 20, max: 25, currency: "PHP", conflict: true, fareIds: ["fr_bus-de", "fr_bus-de-old"] });
    expect(itinerary.reportedRideMinutes).toEqual({ known: true, value: 22 });
  });

  it("never displays an invented zero fare on any card", () => {
    const rides = allCards.filter((card) => card.kind === "ride");
    expect(rides.some((card) => card.fares.length > 0)).toBe(true);
    for (const card of rides) {
      for (const fare of card.fares) {
        expect(fare.min).toBeGreaterThan(0);
        expect(fare.max).toBeGreaterThan(0);
      }
    }
  });

  it("never names an unknown-value option as a comparison winner", () => {
    for (const { result } of allPairs) {
      if (result.status !== "ok") continue;
      for (const comparison of result.comparisons) {
        const winner = result.itineraries.find((itinerary) => itinerary.id === comparison.winnerId)!;
        if (comparison.kind === "lowest_reported_fare") expect(winner.fare.status).toBe("known");
        if (comparison.kind === "shortest_reported_time") expect(winner.reportedRideMinutes.known).toBe(true);
        for (const id of comparison.excludedUnknownIds) expect(comparison.comparedIds).not.toContain(id);
      }
    }
  });

  it("warns for the 2024 report sources", () => {
    const cards = compose(routed("pl_d", "pl_e").itineraries[0]!, pack, now);
    const ride = cards.find((card) => card.kind === "ride")!;
    expect(ride.sources.some((source) => source.postedAt === "2024-01-01" && source.stale)).toBe(true);
    expect(ride.warnings.find((warning) => warning.code === "stale_source")?.message).toBe("Source post is older than 180 days (source post date 2024-01-01).");
  });

  it("does not mark 2026-09 sources stale and omits stale warnings for fresh cards", () => {
    for (const card of allCards) {
      for (const source of card.sources.filter((source) => source.postedAt?.startsWith("2026-09"))) expect(source.stale).toBe(false);
      if (card.sources.every((source) => !source.stale)) expect(card.warnings.some((warning) => warning.code === "stale_source")).toBe(false);
    }
    const ride = compose(routed("pl_a", "pl_b").itineraries[0]!, pack, now)[1]!;
    expect(ride.warnings.some((warning) => warning.code === "stale_source")).toBe(false);
  });

  it("warns when a source post date is null", () => {
    const result = routed("pl_a", "pl_c", "lowest_fare");
    const unknown = result.itineraries.find((itinerary) => itinerary.ref.steps.some((step) => step.id === "lg_unknown-ac"))!;
    const ride = compose(unknown, pack, now)[1]!;
    expect(ride.sources.some((source) => source.sourceId === "src_null" && source.postedAt === undefined)).toBe(true);
    expect(ride.warnings.find((warning) => warning.code === "source_date_unknown")?.message).toBe("Source post date unknown.");
  });

  it("keeps unmapped routes textual with an unmapped-point warning", () => {
    const cards = compose(routed("pl_n", "pl_m").itineraries[0]!, pack, now);
    expect(cards[0]?.warnings.some((warning) => warning.code === "unmapped_point")).toBe(true);
    const ride = cards[1]!;
    if (ride.kind !== "ride") throw new Error("Expected ride");
    expect(ride.board.mapped).toBe(false);
  });

  it("grounds every card record ID in an existing pack record", () => {
    for (const card of allCards) {
      for (const id of card.recordIds) expect(allRecordIds.has(id)).toBe(true);
      for (const warning of card.warnings) expect(warning.message).not.toMatch(/verified|confirmed|current/i);
    }
  });

  it("keeps every evidence bundle bounded and its allowlist grounded", () => {
    for (const { result } of allPairs) {
      if (result.status !== "ok") continue;
      const itinerary = result.itineraries[0]!;
      const trip = { ...selectItinerary(newTrip(pack), itinerary), originPlaceId: itinerary.originPlaceId, destinationPlaceId: itinerary.destinationPlaceId };
      const cards = compose(itinerary, pack, now);
      const bundle = buildContext({ trip, cards, itineraries: result.itineraries, comparisons: result.comparisons, hourStatements: answerHours(itinerary.routeIds, pack, now), now }, pack);
      expect(bundle.cards.length).toBeLessThanOrEqual(12);
      expect(bundle.alternatives.length).toBeLessThanOrEqual(3);
      expect(bundle.notes.length).toBeLessThanOrEqual(8);
      for (const id of bundle.allowedRecordIds) expect(allRecordIds.has(id)).toBe(true);
      for (const card of bundle.cards) {
        expect(bundle.allowedCardIds).toContain(card.cardId);
        for (const id of card.recordIds) expect(bundle.allowedRecordIds).toContain(id);
      }
    }
  });

  it.each([
    ["rt_jeep", "reported", false, 1], ["rt_bus", "reported", true, 2], ["rt_uv", "unknown", false, 0],
  ] as const)("answers %s hours with the reported uncertainty", (routeId, status, conflict, count) => {
    const statement = answerHours([routeId], pack, now)[0]!;
    expect(statement).toMatchObject({ routeId, status, conflict });
    expect(statement.reports).toHaveLength(count);
    expect(statement.text).not.toMatch(/open now|operating now|arriv|schedule|depart/i);
  });

  const conversations: { query: string; base?: string; kind: IntentKind; from: string; to: string; preference: Preference; steps: string[] }[] = [
    { query: "galing Alpha Terminal papunta sa Cedar Hospital", kind: "new_trip", from: "pl_a", to: "pl_c", preference: "balanced", steps: ["ac_a", "lg_express-ac", "ac_c"] },
    { query: "paano pumunta sa Cedar Hospital galing Bayani Market?", kind: "new_trip", from: "pl_b", to: "pl_c", preference: "balanced", steps: ["ac_b", "lg_uv-bc", "ac_c"] },
    { query: "Alpha Terminal to Cedar Hospital pinakamura", kind: "new_trip", from: "pl_a", to: "pl_c", preference: "lowest_fare", steps: ["ac_a", "lg_bargain-am", "lg_jeep-mc", "ac_c"] },
    { query: "galing Dalisay Station papunta sa Fern Mall", kind: "new_trip", from: "pl_d", to: "pl_f", preference: "balanced", steps: ["ac_d", "wk_d-out", "lg_bus-de", "lg_trike-ef", "ac_f"] },
    { query: "Harbor Wharf to Juniper Park", kind: "new_trip", from: "pl_h", to: "pl_j", preference: "balanced", steps: ["ac_h", "lg_bus-hi", "lg_unknown-ij", "ac_j"] },
    { query: "galing Narra Clinic papunta sa Maple Depot", kind: "new_trip", from: "pl_n", to: "pl_m", preference: "balanced", steps: ["ac_n", "lg_trike-nm", "ac_m"] },
    { query: "pabalik", base: "Alpha Terminal to Cedar Hospital", kind: "reverse", from: "pl_c", to: "pl_a", preference: "balanced", steps: ["ac_c", "lg_uv-cb", "lg_jeep-ba", "ac_a"] },
    { query: "sa Emerald College na lang", base: "Alpha Terminal to Cedar Hospital", kind: "change_destination", from: "pl_a", to: "pl_e", preference: "balanced", steps: ["ac_a", "lg_express-ac", "lg_modern-cd", "wk_d-out", "lg_bus-de", "ac_e"] },
    { query: "pinakamura", base: "Alpha Terminal to Cedar Hospital", kind: "change_preference", from: "pl_a", to: "pl_c", preference: "lowest_fare", steps: ["ac_a", "lg_bargain-am", "lg_jeep-mc", "ac_c"] },
    { query: "anong oras last trip", base: "Alpha Terminal to Bayani Market", kind: "ask_hours", from: "pl_a", to: "pl_b", preference: "balanced", steps: ["ac_a", "lg_jeep-ab", "ac_b"] },
  ];
  it.each(conversations)("runs the complete Taglish flow for $query", (testCase) => {
    const previous = testCase.base === undefined ? undefined : execute(testCase.base).selected;
    const result = execute(testCase.query, previous);
    expect(result.intent.kind).toBe(testCase.kind);
    expect(result.selected.originPlaceId).toBe(testCase.from);
    expect(result.selected.destinationPlaceId).toBe(testCase.to);
    expect(result.selected.preference).toBe(testCase.preference);
    expect(result.itinerary.ref.steps.map((step) => step.id)).toEqual(testCase.steps);
    expect(result.cards.map((card) => card.cardId)).toEqual(result.bundle.allowedCardIds);
    for (const mention of [result.intent.origin, result.intent.destination]) {
      if (mention?.kind === "text") expect(testCase.query.slice(...mention.span)).toBe(mention.text);
    }
    if (testCase.kind === "reverse") expect(result.state).not.toHaveProperty("selected");
    if (testCase.kind === "ask_hours") expect(result.bundle.hourStatements[0]).toMatchObject({ routeId: "rt_jeep", status: "reported", conflict: false });
  });

  it.each(["record_missing", "service_suspended"] as const)("requires replanning after pack replacement: %s", (reason) => {
    const itinerary = routed("pl_a", "pl_b").itineraries[0]!;
    const saved: SavedTrip = { packId: pack.manifest.pack_id, schemaVersion: 1, originPlaceId: "pl_a", destinationPlaceId: "pl_b", preference: "balanced", routeJson: JSON.stringify(itinerary.ref), currentStep: 0 };
    const replacementSpec = evalNetworkSpec();
    if (reason === "record_missing") {
      replacementSpec.legs = replacementSpec.legs.filter((leg) => leg.id !== "lg_jeep-ab");
      replacementSpec.fares = replacementSpec.fares!.filter((fare) => fare.leg !== "lg_jeep-ab");
      replacementSpec.notes = replacementSpec.notes!.filter((note) => note.leg !== "lg_jeep-ab");
    } else replacementSpec.routes.find((route) => route.id === "rt_jeep")!.status = "suspended";
    const loaded = loadPack(buildRawPack(replacementSpec));
    if (!loaded.ok) throw new Error(JSON.stringify(loaded.error));
    const replacement: Pack = loaded.value;
    replacement.manifest.pack_id = "pack_synthetic-replacement";
    expect(validateRestoration(saved, replacement)).toEqual({ status: "needs_replan", reason });
  });
});
