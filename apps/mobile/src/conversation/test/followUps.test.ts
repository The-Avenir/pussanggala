/**
 * T32 — Follow-up and fresh-evidence tests.
 *
 * Done criterion: endpoint/preference changes and journey follow-ups ALWAYS
 * re-query the evidence port; nothing is answered from the stale exchange
 * window (SDD §1.4, PRD-F19). Unrelated input redirects briefly.
 *
 * These drive the manager through core `parse` (via `RuleIntentParser`) so the
 * intent kinds and preference values exercised here are the real core ones.
 */
import { describe, expect, it } from "vitest";
import { TripConversationManager } from "../src/conversationManager";
import {
  BUENDIA,
  CUBAO,
  ORTIGAS,
  baseTrip,
  bundle,
  endpoints,
  resolvedSlot,
  rideCard,
  selectedTrip,
  slots,
} from "./fixtures/evidence";
import { rulesParser, scriptedEvidence, unrelated } from "./fixtures/harness";
import type { PlaceCandidate } from "../src/types";

async function setup() {
  const evidence = scriptedEvidence();
  const parser = rulesParser();
  const manager = new TripConversationManager({ parser, evidence, trip: baseTrip() });
  const trip = selectedTrip(baseTrip(), CUBAO, BUENDIA, "a");
  evidence.resolveQueue.push(slots(resolvedSlot(CUBAO), resolvedSlot(BUENDIA)));
  evidence.planQueue.push({
    kind: "planned",
    trip,
    endpoints: endpoints(CUBAO, BUENDIA),
    evidence: bundle("a", trip),
  });
  const first = await manager.handleUserMessage("from cubao to buendia");
  if (first.type !== "plan") throw new Error(`setup failed: ${first.type} ${first.message}`);
  return { evidence, parser, manager };
}

function queueReplan(
  evidence: ReturnType<typeof scriptedEvidence>,
  origin: PlaceCandidate,
  destination: PlaceCandidate,
  id: string,
  preference: "balanced" | "lowest_fare" | "fewest_transfers" | "shortest_reported_time" = "balanced",
) {
  const trip = selectedTrip(baseTrip(preference), origin, destination, id);
  evidence.planQueue.push({
    kind: "planned",
    trip,
    endpoints: endpoints(origin, destination),
    evidence: bundle(id, trip),
  });
}

describe("endpoint changes retrieve current evidence", () => {
  it("destination change reroutes with fresh evidence, keeping the known origin", async () => {
    const { evidence, manager } = await setup();
    evidence.resolveQueue.push(slots(undefined, resolvedSlot(ORTIGAS)));
    queueReplan(evidence, CUBAO, ORTIGAS, "b");

    const result = await manager.handleUserMessage("sa Ortigas na lang");

    expect(result.type).toBe("plan");
    expect(evidence.resolveCalls).toHaveLength(2);
    expect(evidence.resolveCalls[1]?.intent.kind).toBe("change_destination");
    expect(evidence.planCalls).toHaveLength(2);
    // The unchanged origin rides along on the trip state, not re-resolved.
    expect(evidence.planCalls[1]?.originPlaceId).toBe(CUBAO.placeId);
    expect(evidence.planCalls[1]?.destinationPlaceId).toBe(ORTIGAS.placeId);
    expect(manager.getState().endpoints?.destination).toEqual(ORTIGAS);
    expect(manager.getState().trip.selected?.steps[0]?.id).toBe("lg_b");
  });

  it("origin change keeps the known destination", async () => {
    const { evidence, manager } = await setup();
    evidence.resolveQueue.push(slots(resolvedSlot(ORTIGAS)));
    queueReplan(evidence, ORTIGAS, BUENDIA, "b");

    const result = await manager.handleUserMessage("galing Ortigas na lang");

    expect(result.type).toBe("plan");
    expect(evidence.resolveCalls[1]?.intent.kind).toBe("change_origin");
    expect(evidence.planCalls[1]?.destinationPlaceId).toBe(BUENDIA.placeId);
    expect(manager.getState().endpoints?.origin).toEqual(ORTIGAS);
  });

  it("a failed change keeps the current trip instead of corrupting it", async () => {
    const { evidence, manager } = await setup();
    evidence.resolveQueue.push(slots(undefined, resolvedSlot(ORTIGAS)));
    evidence.planQueue.push({ kind: "failed", reason: "no_route" });

    const result = await manager.handleUserMessage("sa Ortigas na lang");

    expect(result.type).toBe("failure");
    expect(result.type === "failure" && result.reason).toBe("no_route");
    const state = manager.getState();
    expect(state.phase).toBe("active");
    expect(state.endpoints?.destination).toEqual(BUENDIA);
    expect(state.trip.selected?.steps[0]?.id).toBe("lg_a");
  });

  it("an out-of-NCR endpoint fails without routing", async () => {
    const { evidence, manager } = await setup();
    evidence.resolveQueue.push(
      slots(undefined, { status: "outside_ncr", placeId: "plc_lag_calamba", name: "Calamba" }),
    );

    const result = await manager.handleUserMessage("sa Calamba na lang");

    expect(result.type).toBe("failure");
    expect(result.type === "failure" && result.reason).toBe("outside_ncr");
    expect(result.message).toContain("Calamba");
    expect(evidence.planCalls).toHaveLength(1); // only the setup plan
    expect(manager.getState().endpoints?.destination).toEqual(BUENDIA);
  });

  it("an unsupported endpoint names the place the user said", async () => {
    const { evidence, manager } = await setup();
    evidence.resolveQueue.push(
      slots(undefined, { status: "unsupported", reason: "unsupported_place", suggestions: [] }),
    );

    const result = await manager.handleUserMessage("sa Baclaran na lang");

    expect(result.type).toBe("failure");
    expect(result.type === "failure" && result.reason).toBe("unsupported_place");
    expect(result.message).toContain("Baclaran");
  });
});

describe("preference changes retrieve current evidence", () => {
  it("preference change reroutes the same endpoints with the core preference", async () => {
    const { evidence, manager } = await setup();
    queueReplan(evidence, CUBAO, BUENDIA, "cheap", "lowest_fare");

    const result = await manager.handleUserMessage("pinakamura naman");

    expect(result.type).toBe("plan");
    expect(evidence.planCalls).toHaveLength(2);
    expect(evidence.planCalls[1]?.preference).toBe("lowest_fare");
    expect(evidence.planCalls[1]?.originPlaceId).toBe(CUBAO.placeId);
    expect(evidence.planCalls[1]?.destinationPlaceId).toBe(BUENDIA.placeId);
    // No re-resolution: the endpoints were already confirmed.
    expect(evidence.resolveCalls).toHaveLength(1);
    expect(manager.getState().trip.preference).toBe("lowest_fare");
  });

  it("supports every core preference label in its message", async () => {
    const { evidence, manager } = await setup();
    queueReplan(evidence, CUBAO, BUENDIA, "few", "fewest_transfers");

    const result = await manager.handleUserMessage("walang lipat please");

    expect(result.type).toBe("plan");
    expect(result.message).toContain("fewest transfers");
  });
});

describe("journey-specific follow-ups", () => {
  it("topic follow-ups relay fresh cards every time, never cached text", async () => {
    const { evidence, manager } = await setup();
    evidence.followUpQueue.push(
      { kind: "answer", topic: "ask_fare", cards: [rideCard("fare_old")], hourStatements: [] },
      { kind: "answer", topic: "ask_fare", cards: [rideCard("fare_new")], hourStatements: [] },
    );

    const first = await manager.handleUserMessage("magkano pamasahe?");
    const second = await manager.handleUserMessage("magkano pamasahe ulit?");

    if (first.type !== "followUp" || second.type !== "followUp") {
      throw new Error("expected followUp results");
    }
    expect(first.cards.map((c) => c.cardId)).toEqual(["card_fare_old"]);
    expect(second.cards.map((c) => c.cardId)).toEqual(["card_fare_new"]);
    expect(evidence.followUpCalls).toHaveLength(2);
    expect(evidence.followUpCalls[0]?.topic).toBe("ask_fare");
    expect(evidence.followUpCalls[0]?.trip.selected?.steps[0]?.id).toBe("lg_a");
  });

  it("reverse swaps endpoints through core applyIntent and reroutes", async () => {
    const { evidence, manager } = await setup();
    queueReplan(evidence, BUENDIA, CUBAO, "rev");

    const result = await manager.handleUserMessage("pabalik naman");

    expect(result.type).toBe("plan");
    expect(evidence.planCalls).toHaveLength(2);
    expect(evidence.planCalls[1]?.originPlaceId).toBe(BUENDIA.placeId);
    expect(evidence.planCalls[1]?.destinationPlaceId).toBe(CUBAO.placeId);
    expect(evidence.followUpCalls).toHaveLength(0); // the swap is core's job
    const state = manager.getState();
    expect(state.endpoints?.origin).toEqual(BUENDIA);
    expect(state.trip.selected?.steps[0]?.id).toBe("lg_rev");
  });

  it("reverse with no route keeps the original trip", async () => {
    const { evidence, manager } = await setup();
    evidence.planQueue.push({ kind: "failed", reason: "no_route" });

    const result = await manager.handleUserMessage("pabalik naman");

    expect(result.type).toBe("failure");
    const state = manager.getState();
    expect(state.endpoints?.destination).toEqual(BUENDIA);
    expect(state.trip.originPlaceId).toBe(CUBAO.placeId);
  });

  it("alternatives can adopt a replanned itinerary from the port", async () => {
    const { evidence, manager } = await setup();
    const trip = selectedTrip(baseTrip(), CUBAO, BUENDIA, "alt");
    evidence.followUpQueue.push({
      kind: "replanned",
      trip,
      endpoints: endpoints(CUBAO, BUENDIA),
      evidence: bundle("alt", trip, 2),
    });

    const result = await manager.handleUserMessage("may ibang ruta ba?");

    expect(result.type).toBe("plan");
    expect(result.message).toContain("2 alternative(s)");
    expect(manager.getState().trip.selected?.steps[0]?.id).toBe("lg_alt");
  });

  it("needs_replan clears the trip and requires replanning", async () => {
    const { evidence, manager } = await setup();
    evidence.followUpQueue.push({ kind: "failed", reason: "needs_replan" });

    const result = await manager.handleUserMessage("may ibang ruta ba?");

    expect(result.type).toBe("failure");
    expect(result.type === "failure" && result.reason).toBe("needs_replan");
    const state = manager.getState();
    expect(state.phase).toBe("idle");
    expect(state.endpoints).toBeNull();
    expect(state.trip.originPlaceId).toBeUndefined();
    // The window survives a pack change; only the trip is dropped.
    expect(state.history.length).toBeGreaterThan(0);
  });

  it("follow-ups without an active trip ask for a trip first", async () => {
    const { evidence, manager } = await setup();
    manager.newTrip();

    const result = await manager.handleUserMessage("anong oras sila bukas?");

    expect(result.type).toBe("needsTrip");
    expect(evidence.followUpCalls).toHaveLength(0);
  });
});

describe("unrelated input", () => {
  it("unrelated input is redirected briefly without evidence calls", async () => {
    const { evidence, manager } = await setup();

    const result = await manager.handleUserMessage("anong recipe ng adobo?");

    expect(result.type).toBe("redirect");
    expect(result.message.length).toBeLessThanOrEqual(140);
    expect(evidence.planCalls).toHaveLength(1); // only the setup plan
    expect(evidence.followUpCalls).toHaveLength(0);
    expect(manager.getState().phase).toBe("active"); // trip preserved
  });
});

describe("bounded in-memory window", () => {
  it("drops the oldest exchanges once the window is full", async () => {
    const { manager } = await setup();
    for (let i = 0; i < 12; i += 1) {
      await manager.handleUserMessage(`kumusta ka ${i}`);
    }
    const history = manager.getState().history;
    expect(history.length).toBeLessThanOrEqual(16); // 8 exchanges * 2 messages
    expect(history[0]?.text).not.toBe("kumusta ka 0");
  });

  it("respects a smaller configured window", async () => {
    const evidence = scriptedEvidence();
    const small = new TripConversationManager({
      parser: { parse: () => Promise.resolve(unrelated()) },
      evidence,
      trip: baseTrip(),
      maxExchanges: 2,
    });
    for (let i = 0; i < 5; i += 1) {
      await small.handleUserMessage(`message ${i}`);
    }
    const history = small.getState().history;
    expect(history).toHaveLength(4); // 2 exchanges * 2 messages
    expect(history[0]?.text).toBe("message 3");
  });

  it("history is user/assistant text only — never a factual source (INV-3)", async () => {
    const { manager } = await setup();
    await manager.handleUserMessage("kumusta ka");
    const history = manager.getState().history;
    expect(history.every((e) => "role" in e && "text" in e)).toBe(true);
    expect(history.some((e) => e.text.includes("card_a"))).toBe(false);
    expect(history.some((e) => e.text.includes("lg_a"))).toBe(false);
  });
});
