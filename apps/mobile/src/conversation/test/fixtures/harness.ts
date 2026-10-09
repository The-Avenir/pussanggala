/**
 * Scripted port doubles. Each queue entry is consumed by exactly one call, so
 * an unexpected port call fails loudly — that is how the tests prove the
 * manager does (or does not) go back for fresh evidence.
 */
import type { Intent, PlaceMention, ResolvedSlots, TripState } from "@pusang-gala/core";
import type {
  FollowUpOutcome,
  FollowUpRequest,
  IntentParserPort,
  PlanOutcome,
  ResolveSlotsRequest,
  TripEvidencePort,
} from "../../src/ports";
import { RuleIntentParser } from "../../src/ruleIntentParser";

export interface ScriptedParser extends IntentParserPort {
  queue: Intent[];
  calls: string[];
}

/** Returns queued intents; falls back to `unrelated` once the queue is empty. */
export function scriptedParser(...queue: Intent[]): ScriptedParser {
  const parser: ScriptedParser = {
    queue,
    calls: [],
    parse: (utterance) => {
      parser.calls.push(utterance);
      return Promise.resolve(parser.queue.shift() ?? unrelated());
    },
  };
  return parser;
}

/** Core-rules parser with call counting. */
export function rulesParser(): ScriptedParser {
  const rules = new RuleIntentParser();
  const parser: ScriptedParser = {
    queue: [],
    calls: [],
    parse: (utterance, trip) => {
      parser.calls.push(utterance);
      return rules.parse(utterance, trip);
    },
  };
  return parser;
}

export interface ScriptedEvidence extends TripEvidencePort {
  resolveCalls: ResolveSlotsRequest[];
  planCalls: TripState[];
  followUpCalls: FollowUpRequest[];
  resolveQueue: ResolvedSlots[];
  planQueue: PlanOutcome[];
  followUpQueue: FollowUpOutcome[];
}

export function scriptedEvidence(): ScriptedEvidence {
  const evidence: ScriptedEvidence = {
    resolveCalls: [],
    planCalls: [],
    followUpCalls: [],
    resolveQueue: [],
    planQueue: [],
    followUpQueue: [],
    resolveSlots: (request) => {
      evidence.resolveCalls.push(request);
      return Promise.resolve(take(evidence.resolveQueue, "resolveSlots"));
    },
    plan: (trip) => {
      evidence.planCalls.push(trip);
      return Promise.resolve(take(evidence.planQueue, "plan"));
    },
    followUp: (request) => {
      evidence.followUpCalls.push(request);
      return Promise.resolve(take(evidence.followUpQueue, "followUp"));
    },
  };
  return evidence;
}

function take<T>(queue: T[], label: string): T {
  const next = queue.shift();
  if (next === undefined) throw new Error(`unexpected ${label} call`);
  return next;
}

export function textMention(text: string): PlaceMention {
  return { kind: "text", text, span: [0, text.length] };
}

export function newTripIntent(originText?: string, destinationText?: string): Intent {
  return {
    kind: "new_trip",
    source: "rules",
    ...(originText ? { origin: textMention(originText) } : {}),
    ...(destinationText ? { destination: textMention(destinationText) } : {}),
  };
}

export function unrelated(): Intent {
  return { kind: "unrelated", source: "rules" };
}
