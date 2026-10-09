import { describe, expect, it } from "vitest";

import type { ValidatedExplanationUnit } from "../explanation-unit";
import { guardStream } from "../streaming-guard";
import { ControllableRunner, FixtureModelRunner, fixtureContext, unitLine } from "./fixtures";

function collector() {
  const units: ValidatedExplanationUnit[] = [];
  return { units, onSafeUnit: (u: ValidatedExplanationUnit) => units.push(u) };
}

async function* tokensOf(chunks: string[]): AsyncIterable<string> {
  for (const c of chunks) {
    yield c;
  }
}

const STEPS = [
  unitLine({ kind: "steps", inserts: ["stmt:step-1", "stmt:step-2"], text: "Una, sakay, tapos baba." }),
  unitLine({ kind: "steps", inserts: ["stmt:step-3"], text: "Pagkatapos, lakad papunta sa terminal." }),
  unitLine({ kind: "warning", inserts: ["stmt:warn-1"], text: "Maghintay ng konting pasensya sa fare details." }),
].join("\n") + "\n";

describe("guardStream", () => {
  it("emits every valid unit in order when the stream is clean (token chunks split mid-unit)", async () => {
    const context = fixtureContext();
    const { units, onSafeUnit } = collector();
    const report = await guardStream(context, new FixtureModelRunner(STEPS, 5).streamCompletion("", { signal: new AbortController().signal }), onSafeUnit);
    expect(report.status).toBe("completed");
    expect(report.emittedUnits).toBe(3);
    expect(report.rejectedUnits).toHaveLength(0);
    expect(units.map((u) => u.kind)).toEqual(["steps", "steps", "warning"]);
  });

  it("rejects a unit citing an invented fact ID and never emits it", async () => {
    const context = fixtureContext();
    const { units, onSafeUnit } = collector();
    const bad = unitLine({ inserts: ["stmt:fake-news"], text: "Walang ganyan sa cards." });
    const report = await guardStream(context, tokensOf([bad + "\n" + STEPS]), onSafeUnit);
    expect(report.status).toBe("completed");
    expect(report.emittedUnits).toBe(3);
    expect(report.rejectedUnits).toHaveLength(1);
    expect(report.rejectedUnits[0]!.reasons[0]!.code).toBe("invented_fact");
    expect(units.every((u) => !u.inserts.includes("stmt:fake-news"))).toBe(true);
  });

  it("rejects a unit with reversed steps even though all IDs are real", async () => {
    const context = fixtureContext();
    const { units, onSafeUnit } = collector();
    const reversed = unitLine({ kind: "steps", inserts: ["stmt:step-3", "stmt:step-1"], text: "Lakad muna bago sakay." });
    const report = await guardStream(context, tokensOf([reversed + "\n"]), onSafeUnit);
    expect(report.status).toBe("completed");
    expect(report.emittedUnits).toBe(0);
    expect(units).toHaveLength(0);
    expect(report.rejectedUnits[0]!.reasons[0]!.code).toBe("reversed_instructions");
  });

  it("rejects a partial/malformed JSON tail at end of stream and emits nothing partial", async () => {
    const context = fixtureContext();
    const { units, onSafeUnit } = collector();
    const partial = '{"unit":"explanation_unit","kind":"steps","ins'; // cut mid-line
    const report = await guardStream(context, tokensOf([STEPS + partial]), onSafeUnit);
    expect(report.status).toBe("completed");
    expect(report.emittedUnits).toBe(3);
    expect(report.rejectedUnits).toHaveLength(1);
    expect(report.rejectedUnits[0]!.reasons[0]!.code).toBe("malformed_json");
  });

  it("rejects a malformed line mid-stream but keeps validating later units", async () => {
    const context = fixtureContext();
    const { units, onSafeUnit } = collector();
    const report = await guardStream(context, tokensOf([unitLine() + "\n{not json}\n" + STEPS]), onSafeUnit);
    expect(report.status).toBe("completed");
    expect(report.rejectedUnits).toHaveLength(1);
    expect(report.emittedUnits).toBe(4);
  });

  it("accepts a final complete unit without a trailing newline", async () => {
    const context = fixtureContext();
    const { units, onSafeUnit } = collector();
    const report = await guardStream(context, tokensOf([unitLine()]), onSafeUnit);
    expect(report.status).toBe("completed");
    expect(report.emittedUnits).toBe(1);
  });

  it("cancellation mid-stream emits nothing partial and stops promptly", async () => {
    const context = fixtureContext();
    const { units, onSafeUnit } = collector();
    const controller = new AbortController();
    const runner = new ControllableRunner();
    const streamPromise = guardStream(context, runner.streamCompletion("", { signal: controller.signal }), onSafeUnit, { signal: controller.signal });
    const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
    runner.push(unitLine() + "\n");
    await flush(); // guard consumes and validates the complete unit
    runner.push('{"unit":"explanation_unit","kind":"steps","inserts":["stmt:step-1"]'); // incomplete unit lands in buffer
    await flush(); // partial chunk is buffered, nothing emitted
    controller.abort();
    runner.push(""); // wake the runner so it can observe the abort
    const report = await streamPromise;
    expect(report.status).toBe("cancelled");
    expect(report.emittedUnits).toBe(1); // only the fully validated unit
    expect(units).toHaveLength(1);
  });

  it("cancelled results contain only units validated before the abort, even if a full line arrives later", async () => {
    const context = fixtureContext();
    const { units, onSafeUnit } = collector();
    const controller = new AbortController();
    async function* lateChunks(): AsyncIterable<string> {
      yield unitLine({ kind: "steps", inserts: ["stmt:step-1"], text: "Sakay muna." }) + "\n";
      controller.abort();
      yield unitLine({ inserts: ["stmt:warn-1"] }) + "\n"; // must never be checked/emitted
    }
    const report = await guardStream(context, lateChunks(), onSafeUnit, { signal: controller.signal });
    expect(report.status).toBe("cancelled");
    expect(units).toHaveLength(1);
    expect(units[0]!.inserts).toEqual(["stmt:step-1"]);
  });

  it("cross-unit reversal is rejected: a later unit cannot restart the step sequence", async () => {
    const context = fixtureContext();
    const { units, onSafeUnit } = collector();
    const first = unitLine({ kind: "steps", inserts: ["stmt:step-1", "stmt:step-2"], text: "Sakay tapos baba." });
    const restart = unitLine({ kind: "steps", inserts: ["stmt:step-1"], text: "Balik tayo sa simula." });
    const report = await guardStream(context, tokensOf([first + "\n" + restart + "\n"]), onSafeUnit);
    expect(report.emittedUnits).toBe(1);
    expect(report.rejectedUnits[0]!.reasons[0]!.code).toBe("reversed_instructions");
  });

  it("aborts as invalid_stream after the rejection budget is exceeded", async () => {
    const context = fixtureContext();
    const { units, onSafeUnit } = collector();
    const bad = unitLine({ inserts: ["stmt:nope"] });
    const script = `${bad}\n${bad}\n${bad}\n${STEPS}`;
    const report = await guardStream(context, tokensOf([script]), onSafeUnit);
    expect(report.status).toBe("invalid_stream");
    expect(report.rejectedUnits).toHaveLength(3);
    // The clean tail was never reached, so nothing from it is on screen.
    expect(report.emittedUnits).toBe(0);
  });

  it("aborts on a runaway buffer with no newline (oversize single unit)", async () => {
    const context = fixtureContext();
    const { units, onSafeUnit } = collector();
    const report = await guardStream(context, tokensOf(["{".repeat(3000)]), onSafeUnit);
    expect(report.status).toBe("invalid_stream");
    expect(units).toHaveLength(0);
  });

  it("reports model errors without emitting anything further", async () => {
    const context = fixtureContext();
    const { units, onSafeUnit } = collector();
    async function* exploding(): AsyncIterable<string> {
      yield unitLine() + "\n";
      throw new Error("native OOM");
    }
    const report = await guardStream(context, exploding(), onSafeUnit);
    expect(report.status).toBe("model_error");
    expect(report.emittedUnits).toBe(1);
  });
});
