/**
 * T32 — Conversation manager unit tests.
 *
 * Coverage of the task's done criteria:
 *  - new-trip reset clears context (trip, pending clarification, history)
 *  - clarification requires explicit user confirmation (INV-6, see
 *    clarification.test.ts)
 *  - endpoint/preference changes re-query evidence instead of answering from
 *    stale context (see followUps.test.ts)
 *  - unrelated input is redirected briefly without touching evidence or model
 *  - no persistence path exists (see guardrails.test.ts)
 */
import { describe, expect, it } from "vitest";
import { TripConversationManager } from "../src/conversationManager";
import {
  BUENDIA,
  CUBAO,
  FARMERS,
  ALI,
  ambiguousSlot,
  baseTrip,
  bundle,
  endpoints,
  resolvedSlot,
  selectedTrip,
  slots,
} from "./fixtures/evidence";
import {
  newTripIntent,
  scriptedEvidence,
  scriptedParser,
  unrelated,
  type ScriptedEvidence,
  type ScriptedParser,
} from "./fixtures/harness";

function makeManager(parser: ScriptedParser, evidence: ScriptedEvidence, maxExchanges?: number) {
  return new TripConversationManager({
    parser,
    evidence,
    trip: baseTrip(),
    ...(maxExchanges === undefined ? {} : { maxExchanges }),
  });
}

/** Queue one successful cubao -> buendia plan on `evidence`. */
function queuePlan(evidence: ScriptedEvidence, id: string, alternativeCount = 1): void {
  const trip = selectedTrip(baseTrip(), CUBAO, BUENDIA, id);
  evidence.resolveQueue.push(slots(resolvedSlot(CUBAO), resolvedSlot(BUENDIA)));
  evidence.planQueue.push({
    kind: "planned",
    trip,
    endpoints: endpoints(CUBAO, BUENDIA),
    evidence: bundle(id, trip, alternativeCount),
  });
}

describe("fresh trip planning", () => {
  it("plans a trip from a full utterance and becomes active", async () => {
    const evidence = scriptedEvidence();
    queuePlan(evidence, "v1");
    const manager = makeManager(scriptedParser(newTripIntent("cubao", "buendia")), evidence);

    const result = await manager.handleUserMessage("from cubao to buendia");

    expect(result.type).toBe("plan");
    const state = manager.getState();
    expect(state.phase).toBe("active");
    expect(state.endpoints?.origin).toEqual(CUBAO);
    expect(state.trip.originPlaceId).toBe(CUBAO.placeId);
    expect(state.trip.destinationPlaceId).toBe(BUENDIA.placeId);
    expect(state.trip.selected?.steps[0]?.id).toBe("lg_v1");
    expect(evidence.planCalls).toHaveLength(1);
  });

  it("asks for the missing endpoint instead of planning a half trip", async () => {
    const evidence = scriptedEvidence();
    evidence.resolveQueue.push(slots(resolvedSlot(CUBAO)));
    const manager = makeManager(scriptedParser(newTripIntent("cubao")), evidence);

    const result = await manager.handleUserMessage("galing cubao");

    expect(result.type).toBe("needsTrip");
    expect(evidence.planCalls).toHaveLength(0);
    expect(manager.getState().trip.originPlaceId).toBe(CUBAO.placeId);
  });
});

describe("new-trip reset", () => {
  it("explicit newTrip clears trip, pending clarification and history", async () => {
    const evidence = scriptedEvidence();
    queuePlan(evidence, "v1");
    const manager = makeManager(scriptedParser(newTripIntent("cubao", "buendia")), evidence);
    await manager.handleUserMessage("from cubao to buendia");
    expect(manager.getState().history.length).toBeGreaterThan(0);

    const result = manager.newTrip();

    expect(result.type).toBe("reset");
    const state = manager.getState();
    expect(state.phase).toBe("idle");
    expect(state.endpoints).toBeNull();
    expect(state.trip.originPlaceId).toBeUndefined();
    expect(state.trip.destinationPlaceId).toBeUndefined();
    expect(state.trip.selected).toBeUndefined();
    expect(state.trip.pendingClarification).toBeUndefined();
    expect(state.history).toHaveLength(0);
  });

  it("a full new trip request resets context before planning", async () => {
    const evidence = scriptedEvidence();
    queuePlan(evidence, "v1");
    queuePlan(evidence, "v2");
    const manager = makeManager(
      scriptedParser(newTripIntent("cubao", "buendia"), newTripIntent("cubao", "buendia")),
      evidence,
    );
    await manager.handleUserMessage("from cubao to buendia");
    const result = await manager.handleUserMessage("from cubao to buendia");

    expect(result.type).toBe("plan");
    const state = manager.getState();
    expect(state.trip.selected?.steps[0]?.id).toBe("lg_v2");
    // Only the second turn is retained; the first exchange is reset away.
    expect(state.history).toHaveLength(2);
    expect(state.history[0]).toEqual({ role: "user", text: "from cubao to buendia" });
  });

  it("new-trip intent clears a pending clarification", async () => {
    const evidence = scriptedEvidence();
    evidence.resolveQueue.push(slots(resolvedSlot(CUBAO), ambiguousSlot([FARMERS, ALI])));
    const parser = scriptedParser(newTripIntent("cubao", "farmers"), newTripIntent());
    const manager = makeManager(parser, evidence);
    await manager.handleUserMessage("from cubao to farmers");
    expect(manager.getState().phase).toBe("clarifying");

    const result = await manager.handleUserMessage("new trip");

    expect(result.type).toBe("reset");
    const state = manager.getState();
    expect(state.phase).toBe("idle");
    expect(state.trip.pendingClarification).toBeUndefined();
    expect(state.history).toHaveLength(0); // reset turns are not retained
  });

  it("the reset preserves the pack identity the trip was built against", async () => {
    const evidence = scriptedEvidence();
    const manager = makeManager(scriptedParser(), evidence);
    const before = manager.getState().trip;
    manager.endTrip();
    const after = manager.getState().trip;

    expect(after.packId).toBe(before.packId);
    expect(after.schemaVersion).toBe(before.schemaVersion);
    expect(after.preference).toBe("balanced");
  });
});

describe("interaction between reset and follow-ups", () => {
  it("cannot answer follow-ups from a cleared context", async () => {
    const evidence = scriptedEvidence();
    queuePlan(evidence, "v1");
    const parser = scriptedParser(newTripIntent("cubao", "buendia"), {
      kind: "ask_fare",
      source: "rules",
    });
    const manager = makeManager(parser, evidence);
    await manager.handleUserMessage("from cubao to buendia");
    manager.newTrip();

    const result = await manager.handleUserMessage("magkano pamasahe?");

    expect(result.type).toBe("needsTrip");
    expect(evidence.followUpCalls).toHaveLength(0);
  });

  it("a clarify_answer with nothing pending confirms nothing", async () => {
    const evidence = scriptedEvidence();
    const parser = scriptedParser({ kind: "clarify_answer", choiceIndex: 0, source: "rules" });
    const manager = makeManager(parser, evidence);

    const result = await manager.handleUserMessage("the first one");

    expect(result.type).toBe("needsTrip");
    expect(evidence.planCalls).toHaveLength(0);
  });
});

describe("unrelated input", () => {
  it("redirects briefly without touching the evidence port", async () => {
    const evidence = scriptedEvidence();
    const manager = makeManager(scriptedParser(unrelated()), evidence);

    const result = await manager.handleUserMessage("anong recipe ng adobo?");

    expect(result.type).toBe("redirect");
    expect(result.message.length).toBeLessThanOrEqual(140);
    expect(evidence.resolveCalls).toHaveLength(0);
    expect(evidence.planCalls).toHaveLength(0);
  });

  it("blank input is redirected without calling the parser", async () => {
    const evidence = scriptedEvidence();
    const parser = scriptedParser();
    const manager = makeManager(parser, evidence);

    const result = await manager.handleUserMessage("   ");

    expect(result.type).toBe("redirect");
    expect(parser.calls).toHaveLength(0); // no parse, no model
  });
});
