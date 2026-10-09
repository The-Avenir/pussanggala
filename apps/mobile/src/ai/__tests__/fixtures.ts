/**
 * Test fixtures for T33. Synthetic canonical statements only — REPLACEME for
 * real pack-backed fixtures once T24 lands. No raw dataset text anywhere.
 */

import { buildGroundingContext, type AssemblyInput } from "../grounding-context";
import type { GroundingContext, ModelRunnerPort } from "../ports";

export const FIXTURE_BUNDLE: AssemblyInput = {
  trip: { originLabel: "Cubao", destinationLabel: "Makati", preference: "fewer transfers" },
  cards: [
    { cardId: "card:route-1", title: "MRT-3 ride then jeepney transfer", packRecordIds: ["leg:mrt3-1", "walk:w-1"] },
  ],
  statements: [
    {
      id: "stmt:step-1",
      role: "step",
      stepOrder: 1,
      text: "Board MRT-3 at Araneta Center-Cubao station southbound.",
      packRecordIds: ["leg:mrt3-1"],
    },
    {
      id: "stmt:step-2",
      role: "step",
      stepOrder: 2,
      text: "Alight at Ayala station.",
      packRecordIds: ["leg:mrt3-1"],
    },
    {
      id: "stmt:step-3",
      role: "step",
      stepOrder: 3,
      text: "Walk to the Ayala Ave jeepney stop near the terminal entrance (reported).",
      packRecordIds: ["walk:w-1"],
    },
    {
      id: "stmt:cmp-1",
      role: "comparison",
      text: "Lowest reported fare among the options that have fare reports; options without fare reports remain shown.",
      packRecordIds: ["leg:mrt3-1", "fare:f-1"],
    },
    {
      id: "stmt:hrs-1",
      role: "hours",
      text: "MRT-3 operating hours are reported from a source dated 2024-11; they may have changed.",
      packRecordIds: ["hours:h-1"],
    },
    {
      id: "stmt:warn-1",
      role: "warning",
      text: "Two conflicting fare reports exist for the jeepney leg and are shown separately with their source dates.",
      packRecordIds: ["fare:f-2", "fare:f-3"],
    },
    {
      id: "stmt:unk-1",
      role: "unknown",
      text: "No reported travel time exists for the jeepney leg; the time for that leg is unknown.",
      packRecordIds: ["leg:jee-1"],
    },
  ],
};

export function fixtureContext(overrides?: Partial<AssemblyInput>): GroundingContext {
  const result = buildGroundingContext({ ...FIXTURE_BUNDLE, ...overrides });
  if (!result.ok) {
    throw new Error(`fixture context failed to assemble: ${result.reason}`);
  }
  return result.context;
}

/**
 * Fixture model runner used by guard tests and until T30's native adapter
 * exists — REPLACEME(T30). Chunks the scripted output so buffering/splitting
 * is exercised, and honours aborts.
 */
export class FixtureModelRunner implements ModelRunnerPort {
  constructor(
    private readonly script: string,
    private readonly chunkSize = 7,
  ) {}

  async *streamCompletion(_prompt: string, options: { signal: AbortSignal }): AsyncIterable<string> {
    let i = 0;
    while (i < this.script.length) {
      if (options.signal.aborted) {
        return;
      }
      yield this.script.slice(i, i + this.chunkSize);
      i += this.chunkSize;
      // Let a macrotask run so aborts between chunks are observable.
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }
}

/** Runner that yields one chunk per call and waits for an external continuation — used for mid-stream cancellation tests. */
export class ControllableRunner implements ModelRunnerPort {
  readonly chunks: string[] = [];
  private resolvers: (() => void)[] = [];

  push(chunk: string): void {
    this.chunks.push(chunk);
    const waiter = this.resolvers.shift();
    if (waiter) waiter();
  }

  async *streamCompletion(_prompt: string, options: { signal: AbortSignal }): AsyncIterable<string> {
    let i = 0;
    while (true) {
      while (i < this.chunks.length) {
        if (options.signal.aborted) return;
        yield this.chunks[i]!;
        i += 1;
      }
      if (options.signal.aborted) return;
      await new Promise<void>((resolve) => this.resolvers.push(resolve));
      if (options.signal.aborted) return;
    }
  }
}

export function unitLine(fields: Partial<Record<string, unknown>> = {}): string {
  return JSON.stringify({
    unit: "explanation_unit",
    kind: "summary",
    inserts: [],
    text: "Here is your route, ka-commuter.",
    ...fields,
  });
}
