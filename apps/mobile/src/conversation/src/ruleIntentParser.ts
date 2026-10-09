/**
 * T32 — Rules-only intent parser adapter. **DEV / TEST ONLY.**
 *
 * ============================================================================
 * NOT THE PRODUCTION ADAPTER. This exists so the conversation manager runs and
 * is testable standalone. It is a thin wrapper over core `parse(query, trip)`
 * — it adds no patterns of its own, so there is no second, divergent rule set
 * to keep in sync.
 *
 * The production adapter (T30) must keep the same `IntentParserPort` contract:
 * run core rules FIRST, and consult `ai.extractIntent` only for utterances the
 * rules flagged as journey-related. `unrelated` must be decided by rules alone
 * so no inference is burned on a redirect (BUILD §5). Compose it around this
 * wrapper rather than extending the wrapper itself.
 * ============================================================================
 */
import { parse } from "@pusang-gala/core";
import type { IntentParserPort } from "./ports";
import type { Intent, TripState } from "./types";

/** Rules-only parser. See the header: replace in production wiring. */
export class RuleIntentParser implements IntentParserPort {
  /**
   * Async by contract even though core rules are synchronous, so a model
   * fallback can be added without touching the manager.
   */
  parse(utterance: string, trip: TripState): Promise<Intent> {
    return Promise.resolve(parse(utterance, trip));
  }
}
