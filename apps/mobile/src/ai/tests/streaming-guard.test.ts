import { describe, expect, it } from "vitest";

import { isSafeExplanationUnit, type SafeExplanationUnit } from "../explanation-unit";
import { guardStream } from "../streaming-guard";
import {
  CLEAN_SCRIPT,
  ControllableRunner,
  chunked,
  fixtureContext,
  ndjson,
  tokensOf,
  unitLine,
} from "./fixtures";

function collector() {
  const units: SafeExplanationUnit[] = [];
  return { units, onSafeUnit: (u: SafeExplanationUnit) => units.push(u) };
}

describe("guardStream", () => {
  it("emits every valid unit in order when the stream is clean (chunks split mid-unit)", async () => {
    const context = fixtureContext();
    const { units, onSafeUnit } = collector();
    const report = await guardStream(context, tokensOf(chunked(CLEAN_SCRIPT, 5)), onSafeUnit);
    expect(report.status).toBe("completed");
    expect(report.emittedUnits).toBe(3);
    expect(report.rejectedUnits).toHaveLength(0);
    expect(units.map((u) => u.kind)).toEqual(["step", "step", "caveat"]);
  });

  it("emits branded units, never raw strings", async () => {
    const context = fixtureContext();
    const seen: unknown[] = [];
    await guardStream(context, tokensOf([CLEAN_SCRIPT]), (u) => seen.push(u));
    expect(seen).toHaveLength(3);
    for (const unit of seen) {
      expect(typeof unit).not.toBe("string");
      expect(isSafeExplanationUnit(unit)).toBe(true);
    }
    // A hand-rolled look-alike is not branded, so it could never have come
    // from the guard.
    expect(
      isSafeExplanationUnit({ kind: "summary", text: "x", inserts: [], resolvedPackRecordIds: [] }),
    ).toBe(false);
    expect(isSafeExplanationUnit("some raw model text")).toBe(false);
  });

  it("accepts several complete units arriving inside one chunk", async () => {
    // Regression: the buffer-size check used to run before the newline drain,
    // so a single chunk carrying many units tripped the per-unit cap.
    const context = fixtureContext();
    const many = ndjson(
      ...Array.from({ length: 12 }, (_v, i) =>
        unitLine({
          kind: "summary",
          inserts: ["stmt:warn-1"],
          text: `Paalala blg ${"abcde".repeat(40)} ${"x".repeat(i)}`,
        }),
      ),
    );
    expect(many.length).toBeGreaterThan(context.budgets.maxUnitBufferChars);
    const { units, onSafeUnit } = collector();
    const report = await guardStream(context, tokensOf([many]), onSafeUnit);
    expect(report.status).toBe("completed");
    expect(report.emittedUnits).toBe(12);
    expect(units).toHaveLength(12);
  });

  it("still aborts when a single incomplete unit overruns the buffer", async () => {
    const context = fixtureContext();
    const { units, onSafeUnit } = collector();
    const report = await guardStream(context, tokensOf(["{".repeat(3000)]), onSafeUnit);
    expect(report.status).toBe("invalid_stream");
    expect(units).toHaveLength(0);
    expect(report.rejectedUnits[0]!.reasons[0]!.code).toBe("oversize");
  });

  it("measures only the undrained tail against the buffer cap", async () => {
    const context = fixtureContext();
    const { units, onSafeUnit } = collector();
    const valid = unitLine({ kind: "summary", inserts: ["stmt:warn-1"], text: "Paalala." });
    // Complete units plus an oversize partial tail in one chunk: the units
    // still display, and only the tail triggers the abort.
    const report = await guardStream(
      context,
      tokensOf([ndjson(valid, valid) + "{".repeat(3000)]),
      onSafeUnit,
    );
    expect(report.status).toBe("invalid_stream");
    expect(units).toHaveLength(2);
  });

  it("rejects a unit citing an invented fact ID and never emits it", async () => {
    const context = fixtureContext();
    const { units, onSafeUnit } = collector();
    const bad = unitLine({ inserts: ["stmt:fake-news"], text: "Walang ganyan sa cards." });
    const report = await guardStream(context, tokensOf([ndjson(bad) + CLEAN_SCRIPT]), onSafeUnit);
    expect(report.status).toBe("completed");
    expect(report.emittedUnits).toBe(3);
    expect(report.rejectedUnits).toHaveLength(1);
    expect(report.rejectedUnits[0]!.reasons[0]!.code).toBe("invented_fact");
    expect(units.every((u) => !(u.inserts ?? []).includes("stmt:fake-news"))).toBe(true);
  });

  it("rejects invented factual prose that cites nothing", async () => {
    const context = fixtureContext();
    const { units, onSafeUnit } = collector();
    const invented = unitLine({
      kind: "summary",
      inserts: [],
      text: "Sakay ka sa jeepney sa terminal, mura lang ang pamasahe.",
    });
    const report = await guardStream(context, tokensOf([ndjson(invented)]), onSafeUnit);
    expect(report.status).toBe("completed");
    expect(report.emittedUnits).toBe(0);
    expect(units).toHaveLength(0);
    expect(report.rejectedUnits[0]!.reasons.map((r) => r.code)).toContain("invented_fact");
  });

  it("rejects a unit with reversed steps even though all IDs are real", async () => {
    const context = fixtureContext();
    const { units, onSafeUnit } = collector();
    const reversed = unitLine({
      kind: "step",
      inserts: ["stmt:step-3", "stmt:step-1"],
      text: "Lakad muna bago sakay.",
    });
    const report = await guardStream(context, tokensOf([ndjson(reversed)]), onSafeUnit);
    expect(report.status).toBe("completed");
    expect(report.emittedUnits).toBe(0);
    expect(units).toHaveLength(0);
    expect(report.rejectedUnits[0]!.reasons[0]!.code).toBe("reversed_instructions");
  });

  it("rejects a partial/malformed JSON tail at end of stream and emits nothing partial", async () => {
    const context = fixtureContext();
    const { onSafeUnit } = collector();
    const partial = '{"kind":"step","ins'; // cut mid-line
    const report = await guardStream(context, tokensOf([CLEAN_SCRIPT + partial]), onSafeUnit);
    expect(report.status).toBe("completed");
    expect(report.emittedUnits).toBe(3);
    expect(report.rejectedUnits).toHaveLength(1);
    expect(report.rejectedUnits[0]!.reasons[0]!.code).toBe("malformed_json");
  });

  it("rejects a malformed line mid-stream but keeps validating later units", async () => {
    const context = fixtureContext();
    const { onSafeUnit } = collector();
    const report = await guardStream(
      context,
      tokensOf([ndjson(unitLine(), "{not json}") + CLEAN_SCRIPT]),
      onSafeUnit,
    );
    expect(report.status).toBe("completed");
    expect(report.rejectedUnits).toHaveLength(1);
    expect(report.emittedUnits).toBe(4);
  });

  it("accepts a final complete unit without a trailing newline", async () => {
    const context = fixtureContext();
    const { onSafeUnit } = collector();
    const report = await guardStream(context, tokensOf([unitLine()]), onSafeUnit);
    expect(report.status).toBe("completed");
    expect(report.emittedUnits).toBe(1);
  });

  it("cancellation mid-stream emits nothing partial and stops promptly", async () => {
    const context = fixtureContext();
    const { units, onSafeUnit } = collector();
    const controller = new AbortController();
    const runner = new ControllableRunner();
    const streamPromise = guardStream(context, runner.stream(controller.signal), onSafeUnit, {
      signal: controller.signal,
    });
    const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
    runner.push(ndjson(unitLine()));
    await flush(); // guard consumes and validates the complete unit
    runner.push('{"kind":"step","inserts":["stmt:step-1"]'); // incomplete unit lands in buffer
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
      yield ndjson(unitLine({ kind: "step", inserts: ["stmt:step-1"], text: "Sakay muna." }));
      controller.abort();
      yield ndjson(unitLine({ inserts: ["stmt:warn-1"] })); // must never be checked/emitted
    }
    const report = await guardStream(context, lateChunks(), onSafeUnit, { signal: controller.signal });
    expect(report.status).toBe("cancelled");
    expect(units).toHaveLength(1);
    expect(units[0]!.inserts).toEqual(["stmt:step-1"]);
  });

  it("cross-unit reversal is rejected: a later unit cannot restart the step sequence", async () => {
    const context = fixtureContext();
    const { onSafeUnit } = collector();
    const first = unitLine({
      kind: "step",
      inserts: ["stmt:step-1", "stmt:step-2"],
      text: "Sakay tapos baba.",
    });
    const restart = unitLine({
      kind: "step",
      inserts: ["stmt:step-1"],
      text: "Balik tayo sa simula.",
    });
    const report = await guardStream(context, tokensOf([ndjson(first, restart)]), onSafeUnit);
    expect(report.emittedUnits).toBe(1);
    expect(report.rejectedUnits[0]!.reasons[0]!.code).toBe("reversed_instructions");
  });

  it("aborts as invalid_stream after the rejection budget is exceeded", async () => {
    const context = fixtureContext();
    const { onSafeUnit } = collector();
    const bad = unitLine({ inserts: ["stmt:nope"] });
    const report = await guardStream(
      context,
      tokensOf([ndjson(bad, bad, bad) + CLEAN_SCRIPT]),
      onSafeUnit,
    );
    expect(report.status).toBe("invalid_stream");
    expect(report.rejectedUnits).toHaveLength(3);
    // The clean tail was never reached, so nothing from it is on screen.
    expect(report.emittedUnits).toBe(0);
  });

  it("reports model errors without emitting anything further, carrying the cause", async () => {
    const context = fixtureContext();
    const { onSafeUnit } = collector();
    async function* exploding(): AsyncIterable<string> {
      yield ndjson(unitLine());
      throw new Error("native OOM");
    }
    const report = await guardStream(context, exploding(), onSafeUnit);
    expect(report.status).toBe("model_error");
    expect(report.emittedUnits).toBe(1);
    expect((report.error as Error).message).toBe("native OOM");
  });
});
