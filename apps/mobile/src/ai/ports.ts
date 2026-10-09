/**
 * Grounding-context ports for the AI layer.
 *
 * REPLACEME markers: T24 (card composer / Member 2), T30+T40 (native model
 * runtime), T32 (conversation manager) own the real contracts. The shapes
 * below mirror SDD §4 (`core.compose`, `core.buildContext`, `ai.explain`) so
 * this package compiles and is testable in isolation; once those land these
 * become thin aliases or adapters over `packages/core` / T30 / T32 exports.
 *
 * No raw Reddit text may ever appear in any of these structures (INV-4):
 * every `text` field is a canonical, pre-authored statement produced by
 * deterministic code.
 */

/** One deterministic card as composed by T24 (`core.compose`). */
export interface DeterministicCard {
  /** Stable card ID; the model may `cardRef` only these IDs. */
  cardId: string;
  /** Canonical human-readable title. Data, never instructions. */
  title: string;
  /** Pack record IDs this card's fields trace to (INV-1). */
  packRecordIds: string[];
}

export type StatementRole =
  | "step" // one canonical travel step (board/alight/walk/transfer)
  | "comparison" // rule-produced qualified comparison reason
  | "hours" // reported operating-hours statement (dated, uncertain)
  | "warning" // conflict/staleness/status warning
  | "unknown" // explicit unknown (fare/time/hours not reported)
  | "note"; // paraphrased relevant note card text

/**
 * One canonical factual statement the model may cite by ID. The text is
 * authored by the card composer / rule engine, never by the model, and every
 * statement traces to pack record IDs. This is the unit of INV-1
 * traceability for generated output.
 */
export interface CanonicalStatement {
  /** Stable ID the model cites in `inserts`, e.g. "stmt:leg-1". */
  id: string;
  role: StatementRole;
  /** Canonical text. Treated strictly as data in prompts. */
  text: string;
  /** Pack record IDs backing this statement. Must be non-empty. */
  packRecordIds: string[];
  /**
   * Canonical itinerary order, present only for role "step". The model can
   * reorder freely authored prose, but instruction checkpoints must stay
   * monotone. 1-based, unique across the bundle.
   */
  stepOrder?: number;
}

/** REPLACEME(T24): real bundle type from `core.compose`/`core.buildContext`. */
export interface CardBundleInput {
  cards: DeterministicCard[];
  statements: CanonicalStatement[];
}

/** REPLACEME(T32): trip/session state supplied by the conversation manager. */
export interface TripContextPort {
  originLabel?: string;
  destinationLabel?: string;
  preference?: string;
}

/** Bounded, model-ready evidence context (`core.buildContext` output). */
export interface GroundingContext {
  cards: DeterministicCard[];
  statements: CanonicalStatement[];
  trip?: TripContextPort;
  budgets: ContextBudgets;
}

export interface ContextBudgets {
  /** Max canonical statements carried in one context. */
  maxStatements: number;
  /** Max chars of one canonical statement text; oversize is rejected, never truncated (a truncated fact is a false fact). */
  maxStatementChars: number;
  /** Max chars of model-authored `text` per unit. Must not exceed the core ExplanationUnit cap of 280. */
  maxUnitTextChars: number;
  /** Max statement IDs cited by one unit. */
  maxInsertsPerUnit: number;
  /** Max explanation units per explanation stream. */
  maxUnits: number;
  /** Max buffered chars of one *incomplete* unit; exceeding it aborts the stream. */
  maxUnitBufferChars: number;
  /** Rejections tolerated before the stream is aborted as invalid. */
  maxRejectedUnits: number;
}

/** Hard cap from `ExplanationUnitSchema` in `@pusang-gala/core`. */
export const CORE_UNIT_TEXT_MAX = 280;

export const DEFAULT_BUDGETS: ContextBudgets = {
  maxStatements: 40,
  maxStatementChars: 240,
  maxUnitTextChars: CORE_UNIT_TEXT_MAX,
  maxInsertsPerUnit: 8,
  maxUnits: 24,
  maxUnitBufferChars: 2048,
  maxRejectedUnits: 2,
};
