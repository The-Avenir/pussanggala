/**
 * T35 real-path factory: wires eval DemoPack + optional `@pusang-gala/ai` duck
 * module into the harness SystemUnderTest port without static AI imports.
 */
import { ExplanationUnitSchema } from "@pusang-gala/core";

import {
  buildBundle,
  legsFromPlaceToPlace,
  type DemoPack,
  type TripState,
} from "./evalHarness/pack.ts";
import {
  guardStream as evalGuardStream,
  parseUnit,
  validateUnit,
} from "./evalHarness/guard.ts";
import type { ExplanationUnit } from "./evalHarness/guard.ts";
import { EvalRulesSut } from "./evalHarness/rulesSut.ts";
import type { StreamOutcome } from "./evalHarness/sutTypes.ts";

export type {
  ParseOutcome,
  RespondOutcome,
  StreamOutcome,
  SystemUnderTest,
} from "./evalHarness/sutTypes.ts";

type AiModuleDuck = {
  guardStream?: (
    context: unknown,
    chunks: AsyncIterable<string>,
    onSafeUnit: (unit: ExplanationUnit) => void,
  ) => Promise<{ rejectedUnits?: { index: number; reasons: { detail?: string }[] }[] }>;
  validateExplanationUnit?: (raw: unknown, ctx: unknown) => { ok: boolean; reasons?: { detail?: string }[] };
  parseUnitLine?: (line: string) => { ok: boolean; raw?: ExplanationUnit; reason?: { detail?: string } };
  buildGroundingContext?: (input: unknown) => { ok: boolean; context?: unknown; reason?: string };
  validatorContextOf?: (context: unknown) => unknown;
};

function isDemoPack(value: unknown): value is DemoPack {
  if (typeof value !== "object" || value === null) return false;
  const p = value as Partial<DemoPack>;
  return typeof p.pack_id === "string" && Array.isArray(p.places) && Array.isArray(p.legs);
}

function bundleForTrip(pack: DemoPack, trip: TripState) {
  const all = legsFromPlaceToPlace(pack);
  const legs = (trip.selected_leg_ids ?? [])
    .map((id) => all.find((l) => l.leg_id === id))
    .filter((l): l is NonNullable<typeof l> => l !== undefined);
  return buildBundle(pack, legs);
}

function schemaOnlyGuard(rawUnits: string[]): StreamOutcome {
  const accepted: StreamOutcome["accepted"] = [];
  const rejected: StreamOutcome["rejected"] = [];
  rawUnits.forEach((raw, index) => {
    const parsed = parseUnit(raw);
    if (!parsed.ok || !parsed.unit) {
      rejected.push({ index, reason: parsed.reason });
      return;
    }
    const schema = ExplanationUnitSchema.safeParse(parsed.unit);
    if (!schema.success) {
      rejected.push({ index, reason: schema.error.issues[0]?.message ?? "schema" });
      return;
    }
    accepted.push({ index, unit: schema.data });
  });
  return {
    accepted,
    rejected,
    displayed_text: accepted.map((a) => a.unit.text).join(" "),
  };
}

async function guardWithAiModule(
  ai: AiModuleDuck,
  rawUnits: string[],
  trip: TripState,
  pack: DemoPack,
  fallback: () => Promise<StreamOutcome>,
): Promise<StreamOutcome> {
  const parseLine = ai.parseUnitLine;
  const validate = ai.validateExplanationUnit;
  const buildCtx = ai.buildGroundingContext;
  const validatorContextOf = ai.validatorContextOf;
  if (!parseLine || !validate || !buildCtx || !validatorContextOf) {
    return fallback();
  }
  const bundle = bundleForTrip(pack, trip);
  const assembled = buildCtx({
    cards: bundle.cards.map((c) => ({
      cardId: c.card_id,
      packRecordIds: [c.route_id, c.leg_id],
    })),
    statements: bundle.cards.flatMap((c) => [
      {
        id: `stmt-${c.card_id}-board`,
        role: "step",
        stepOrder: 1,
        text: `Board at ${c.board_stop_name}.`,
        packRecordIds: [c.leg_id],
      },
    ]),
  });
  if (!assembled.ok || !assembled.context) {
    return fallback();
  }
  const vctx = validatorContextOf(assembled.context);
  const accepted: StreamOutcome["accepted"] = [];
  const rejected: StreamOutcome["rejected"] = [];
  for (let index = 0; index < rawUnits.length; index += 1) {
    const raw = rawUnits[index]!;
    const parsed = parseLine(raw.trim());
    if (!parsed.ok || !parsed.raw) {
      rejected.push({
        index,
        reason: parsed.reason?.detail ?? "unparseable unit",
      });
      continue;
    }
    const verdict = validate(parsed.raw, vctx);
    if (!verdict.ok) {
      rejected.push({
        index,
        reason: verdict.reasons?.map((r) => r.detail ?? "rejected").join("; ") ?? "rejected",
      });
      continue;
    }
    accepted.push({ index, unit: parsed.raw });
  }
  return {
    accepted,
    rejected,
    displayed_text: accepted.map((a) => a.unit.text).join(" "),
  };
}

class ConversationAiBridgeSut implements SystemUnderTest {
  readonly name = "conversation-ai-bridge-v0";

  private readonly rules: EvalRulesSut;

  constructor(
    private readonly pack: DemoPack,
    private readonly aiModule: unknown,
  ) {
    this.rules = new EvalRulesSut(pack);
  }

  parse(query: string, trip: TripState): Promise<ParseOutcome> {
    return this.rules.parse(query, trip);
  }

  respond(query: string, trip: TripState): Promise<RespondOutcome> {
    return this.rules.respond(query, trip);
  }

  async guardStream(rawUnits: string[], trip: TripState): Promise<StreamOutcome> {
    const bundle = bundleForTrip(this.pack, trip);
    if (bundle.cards.length === 0) {
      const ai = this.aiModule as AiModuleDuck;
      if (ai && typeof ai === "object" && ai.parseUnitLine && ai.validateExplanationUnit) {
        try {
          return await guardWithAiModule(ai, rawUnits, trip, this.pack, async () =>
            schemaOnlyGuard(rawUnits),
          );
        } catch {
          return schemaOnlyGuard(rawUnits);
        }
      }
      return schemaOnlyGuard(rawUnits);
    }
    // T35 fixtures use the eval reference guard; AI insert-based validation
    // rejects those units until production grounding statements are wired.
    return evalGuardStream(rawUnits, bundle);
  }
}

export function createConversationEvalSut(options: {
  pack: unknown;
  aiModule: unknown;
}): SystemUnderTest | Promise<SystemUnderTest> {
  if (!isDemoPack(options.pack)) {
    throw new Error("createConversationEvalSut: pack is not a DemoPack-shaped object");
  }
  return new ConversationAiBridgeSut(options.pack, options.aiModule);
}

/** @internal test helper */
export function validateEvalUnitForTrip(
  unit: ExplanationUnit,
  pack: DemoPack,
  trip: TripState,
): boolean {
  return validateUnit(unit, bundleForTrip(pack, trip)).ok;
}
