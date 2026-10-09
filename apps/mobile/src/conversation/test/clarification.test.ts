/**
 * T32 — Clarification flow tests (INV-6): ambiguous places always require
 * explicit user confirmation; the manager never auto-picks a candidate.
 */
import { describe, expect, it } from "vitest";
import { clarificationPrompt, matchClarificationPick } from "../src/clarification";
import { TripConversationManager } from "../src/conversationManager";
import type { PlaceCandidate } from "../src/types";
import {
  ALI,
  FARMERS,
  QUIAPO,
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
} from "./fixtures/harness";

/** quiapo -> "cubao" where the destination resolves to two candidates. */
function setup() {
  const evidence = scriptedEvidence();
  evidence.resolveQueue.push(slots(resolvedSlot(QUIAPO), ambiguousSlot([FARMERS, ALI])));
  const parser = scriptedParser(newTripIntent("quiapo", "cubao"));
  const manager = new TripConversationManager({ parser, evidence, trip: baseTrip() });
  return { evidence, parser, manager };
}

/** Queue the plan that should follow a confirmed pick. */
function queueConfirmedPlan(
  evidence: ReturnType<typeof scriptedEvidence>,
  destination: PlaceCandidate,
  id: string,
) {
  const trip = selectedTrip(baseTrip(), QUIAPO, destination, id);
  evidence.planQueue.push({
    kind: "planned",
    trip,
    endpoints: endpoints(QUIAPO, destination),
    evidence: bundle(id, trip),
  });
}

describe("ambiguous places require explicit confirmation (INV-6)", () => {
  it("planning pauses with numbered candidates and no trip is created", async () => {
    const { manager, evidence } = setup();

    const result = await manager.handleUserMessage("from quiapo to cubao");

    expect(result.type).toBe("clarification");
    expect(result.message).toContain("1. Cubao Farmers Plaza");
    expect(result.message).toContain("2. Ali Mall");
    const state = manager.getState();
    expect(state.phase).toBe("clarifying");
    expect(state.endpoints).toBeNull();
    expect(state.trip.pendingClarification?.candidates).toEqual([FARMERS, ALI]);
    expect(state.trip.destinationPlaceId).toBeUndefined();
    expect(evidence.planCalls).toHaveLength(0); // ambiguity never reaches routing
  });

  it("non-pick follow-ups re-present candidates instead of auto-picking", async () => {
    const { manager, parser } = setup();
    await manager.handleUserMessage("from quiapo to cubao");
    parser.queue.push({ kind: "ask_fare", source: "rules" }, unrelated());

    const followUp = await manager.handleUserMessage("magkano pamasahe?");
    const chitChat = await manager.handleUserMessage("cute mo naman pusa");

    expect(followUp.type).toBe("clarification");
    expect(chitChat.type).toBe("clarification");
    expect(manager.getState().phase).toBe("clarifying");
    expect(manager.getState().trip.destinationPlaceId).toBeUndefined();
  });

  it("an out-of-range ordinal does not pick a candidate", async () => {
    const { manager } = setup();
    await manager.handleUserMessage("from quiapo to cubao");

    const result = await manager.handleUserMessage("9");

    expect(result.type).toBe("clarification");
    expect(manager.getState().trip.destinationPlaceId).toBeUndefined();
  });

  it("a numeric pick confirms the candidate and replans with it", async () => {
    const { evidence, manager } = setup();
    await manager.handleUserMessage("from quiapo to cubao");
    queueConfirmedPlan(evidence, ALI, "ali");

    const result = await manager.handleUserMessage("2");

    expect(result.type).toBe("plan");
    expect(evidence.planCalls).toHaveLength(1);
    expect(evidence.planCalls[0]?.destinationPlaceId).toBe(ALI.placeId);
    // The confirmed pick is applied by core, not re-resolved from text.
    expect(evidence.resolveCalls).toHaveLength(1);
    const state = manager.getState();
    expect(state.phase).toBe("active");
    expect(state.trip.pendingClarification).toBeUndefined();
    expect(state.endpoints?.destination).toEqual(ALI);
  });

  it("an exact name pick confirms the candidate", async () => {
    const { evidence, manager } = setup();
    await manager.handleUserMessage("from quiapo to cubao");
    queueConfirmedPlan(evidence, FARMERS, "farmers");

    const result = await manager.handleUserMessage("Cubao Farmers Plaza");

    expect(result.type).toBe("plan");
    expect(manager.getState().endpoints?.destination).toEqual(FARMERS);
  });

  it("an explicit UI pick confirms the candidate", async () => {
    const { evidence, manager } = setup();
    await manager.handleUserMessage("from quiapo to cubao");
    queueConfirmedPlan(evidence, ALI, "ali");

    const result = await manager.handleClarificationPick(1);

    expect(result.type).toBe("plan");
    expect(manager.getState().endpoints?.destination).toEqual(ALI);
  });

  it("an out-of-range UI pick re-presents the candidates", async () => {
    const { manager } = setup();
    await manager.handleUserMessage("from quiapo to cubao");

    const result = await manager.handleClarificationPick(7);

    expect(result.type).toBe("clarification");
    expect(manager.getState().phase).toBe("clarifying");
  });

  it("a fresh full trip request abandons the pending clarification", async () => {
    const { evidence, manager, parser } = setup();
    await manager.handleUserMessage("from quiapo to cubao");
    evidence.resolveQueue.push(slots(resolvedSlot(QUIAPO), resolvedSlot(FARMERS)));
    queueConfirmedPlan(evidence, FARMERS, "fresh");
    parser.queue.push(newTripIntent("quiapo", "farmers plaza"));

    const result = await manager.handleUserMessage("from quiapo to farmers plaza");

    expect(result.type).toBe("plan");
    expect(manager.getState().trip.pendingClarification).toBeUndefined();
  });
});

describe("matchClarificationPick", () => {
  const candidates = [FARMERS, ALI];

  it("recognizes ordinals", () => {
    expect(matchClarificationPick("1", candidates)?.choice).toEqual(FARMERS);
    expect(matchClarificationPick("2nd", candidates)?.choice).toEqual(ALI);
    expect(matchClarificationPick("second", candidates)?.choice).toEqual(ALI);
    expect(matchClarificationPick("una", candidates)?.choice).toEqual(FARMERS);
  });

  it("rejects out-of-range ordinals and non-picks", () => {
    expect(matchClarificationPick("3", candidates)).toBeNull();
    expect(matchClarificationPick("0", candidates)).toBeNull();
    expect(matchClarificationPick("hmm sige kahit ano", candidates)).toBeNull();
    expect(matchClarificationPick("", candidates)).toBeNull();
  });

  it("recognizes exact, area-qualified and unique-prefix names", () => {
    expect(matchClarificationPick("ali mall", candidates)?.choice).toEqual(ALI);
    expect(matchClarificationPick("Ali Mall Quezon City", candidates)?.choice).toEqual(ALI);
    expect(matchClarificationPick("cubao farme", candidates)?.choice).toEqual(FARMERS);
  });

  it("rejects a prefix that matches more than one candidate", () => {
    const sameArea = [FARMERS, { ...FARMERS, placeId: "plc_qc_farmers_2", name: "Cubao Farmers Market" }];
    expect(matchClarificationPick("cubao farmers", sameArea)).toBeNull();
  });
});

describe("clarificationPrompt", () => {
  it("numbers the candidates with their area and promises no guess", () => {
    const prompt = clarificationPrompt("origin", [FARMERS, ALI]);
    expect(prompt).toContain("starting point");
    expect(prompt).toContain("won't guess");
    expect(prompt).toContain("1. Cubao Farmers Plaza (Quezon City)");
    expect(prompt).toContain("2. Ali Mall (Quezon City)");
  });
});
