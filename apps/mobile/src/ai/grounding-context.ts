/**
 * Bounded grounding-context assembly (T33 local `core.buildContext` shape).
 *
 * Takes the deterministic card bundle and produces the bounded context the
 * prompt builder and the validator share. Assembly is fail-loud: anything
 * that cannot be shown canonical (duplicate IDs, untraceable statements,
 * oversize text, malformed step ordering) rejects the whole context rather
 * than silently dropping or truncating a fact. Cards are the deterministic
 * UI surface and are produced outside this module, so a rejected context
 * degrades to cards-only, never to partial invented content.
 */

import {
  DEFAULT_BUDGETS,
  type CardBundleInput,
  type ContextBudgets,
  type GroundingContext,
  type TripContextPort,
} from "./ports";
import type { ValidatorContext } from "./explanation-unit";

export type AssemblyResult =
  | { ok: true; context: GroundingContext }
  | { ok: false; reason: string };

export interface AssemblyInput extends CardBundleInput {
  trip?: TripContextPort;
}

export function buildGroundingContext(
  input: AssemblyInput,
  budgets: ContextBudgets = DEFAULT_BUDGETS,
): AssemblyResult {
  const { cards, statements } = input;
  if (statements.length > budgets.maxStatements) {
    return { ok: false, reason: `statement count ${statements.length} exceeds maxStatements ${budgets.maxStatements}` };
  }
  const cardIds = new Set<string>();
  for (const card of cards) {
    if (cardIds.has(card.cardId)) {
      return { ok: false, reason: `duplicate card ID "${card.cardId}"` };
    }
    cardIds.add(card.cardId);
    if (card.packRecordIds.length === 0) {
      return { ok: false, reason: `card "${card.cardId}" traces to no pack records (INV-1)` };
    }
  }
  const statementIds = new Set<string>();
  const stepOrders = new Set<number>();
  for (const stmt of statements) {
    if (statementIds.has(stmt.id)) {
      return { ok: false, reason: `duplicate statement ID "${stmt.id}"` };
    }
    statementIds.add(stmt.id);
    if (stmt.packRecordIds.length === 0) {
      return { ok: false, reason: `statement "${stmt.id}" traces to no pack records (INV-1)` };
    }
    if (stmt.text.length === 0) {
      return { ok: false, reason: `statement "${stmt.id}" has empty canonical text` };
    }
    if (stmt.text.length > budgets.maxStatementChars) {
      return { ok: false, reason: `statement "${stmt.id}" exceeds maxStatementChars (${stmt.text.length} > ${budgets.maxStatementChars})` };
    }
    if (stmt.role === "step") {
      if (typeof stmt.stepOrder !== "number" || !Number.isInteger(stmt.stepOrder) || stmt.stepOrder < 1) {
        return { ok: false, reason: `step statement "${stmt.id}" has no valid canonical stepOrder` };
      }
      if (stepOrders.has(stmt.stepOrder)) {
        return { ok: false, reason: `duplicate stepOrder ${stmt.stepOrder}` };
      }
      stepOrders.add(stmt.stepOrder);
    }
  }
  const context: GroundingContext = { cards, statements, budgets };
  if (input.trip !== undefined) {
    context.trip = input.trip;
  }
  return { ok: true, context };
}

/** Deterministic validator view over a grounding context. */
export function validatorContextOf(context: GroundingContext): ValidatorContext {
  return {
    cardIds: new Set(context.cards.map((c) => c.cardId)),
    statementsById: new Map(context.statements.map((s) => [s.id, s])),
    budgets: context.budgets,
  };
}
