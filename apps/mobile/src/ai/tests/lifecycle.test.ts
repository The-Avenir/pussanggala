import { describe, expect, it } from "vitest";

import { AiRuntimeError } from "../errors";
import { isSafeExplanationUnit, type SafeExplanationUnit } from "../explanation-unit";
import {
  CLEAN_SCRIPT,
  CONSTRAINED_DEVICE,
  chunked,
  fixtureContext,
  makeCardsFixture,
  makeManager,
  makeTripFixture,
  ndjson,
  REQUIREMENTS,
  UNSUPPORTED_ABI_DEVICE,
  unitLine,
} from "./fixtures";
import { flushMicrotasks, ManualClock } from "./manual-clock";

const CONTEXT = fixtureContext();

function okUnit(text: string): string {
  return ndjson(unitLine({ kind: "summary", inserts: ["stmt:warn-1"], text }));
}

describe("load lifecycle", () => {
  it("loads at the full budget on a capable device and reports ready", async () => {
    const { runtime, manager } = makeManager({});
    const snapshot = await manager.initialize();
    expect(snapshot.phase).toBe("ready");
    expect(snapshot.budget).toBe(REQUIREMENTS.full);
    expect(snapshot.recovery).toBeNull();
    expect(runtime.openHandles).toBe(1);

    // Idempotent while ready: a second load does not create another handle.
    await manager.load();
    expect(runtime.openHandles).toBe(1);
    expect(runtime.totalLoads).toBe(1);
    await manager.dispose();
  });

  it("retries a transient load failure with bounded back-off, then succeeds", async () => {
    const clock = new ManualClock();
    const { runtime, manager } = makeManager({ clock, loadTimeoutMs: 1_000 });
    runtime.loadQueue.push({ type: "fail", error: new Error("native mmap hiccup") });

    const pending = manager.initialize();
    pending.catch(() => {});
    await flushMicrotasks();
    expect(manager.snapshot.loadAttempts).toBe(1);

    await clock.advance(1_000); // first back-off (5 ms) is well inside this window
    await expect(pending).resolves.toMatchObject({ phase: "ready" });
    expect(manager.snapshot.loadAttempts).toBe(2);
    expect(runtime.openHandles).toBe(1);

    await manager.dispose();
    expect(runtime.openHandles).toBe(0);
    expect(runtime.totalDisposes).toBe(1);
  });

  it("does not retry a non-retryable asset failure and explains it", async () => {
    const { runtime, manager } = makeManager({});
    runtime.loadQueue.push({
      type: "fail",
      error: new AiRuntimeError("asset-unavailable", "model checksum mismatch"),
    });

    await expect(manager.initialize()).rejects.toMatchObject({ kind: "asset-unavailable" });
    expect(manager.snapshot.loadAttempts).toBe(1); // no wasteful retry
    expect(manager.snapshot.phase).toBe("degraded");
    expect(manager.snapshot.recovery?.kind).toBe("ai-asset-problem");
    expect(manager.snapshot.recovery?.actions).toContain("check-assets");
    expect(runtime.openHandles).toBe(0);
  });

  it("times out a hung load, cancels the native side, and degrades after the attempt bound", async () => {
    const clock = new ManualClock();
    const { runtime, manager } = makeManager({ clock, loadTimeoutMs: 1_000, maxLoadAttempts: 2 });
    runtime.loadQueue.push({ type: "hang-until-cancelled" }, { type: "hang-until-cancelled" });

    const pending = manager.initialize();
    pending.catch(() => {});
    await flushMicrotasks();

    await clock.advance(1_000); // first attempt times out
    expect(manager.snapshot.loadAttempts).toBe(1);
    await clock.advance(50); // back-off, then second attempt starts and hangs
    await clock.advance(1_000); // second attempt times out

    await expect(pending).rejects.toMatchObject({ kind: "load-timeout", retryable: true });
    expect(manager.snapshot.loadAttempts).toBe(2);
    expect(manager.snapshot.phase).toBe("degraded");
    expect(manager.snapshot.recovery?.kind).toBe("ai-retryable");
    expect(runtime.openHandles).toBe(0); // hung native loads left no leak
  });

  it("downgrades to the constrained budget with an explanation when full-budget load OOMs", async () => {
    const { runtime, manager } = makeManager({});
    runtime.loadQueue.push({
      type: "fail",
      error: new Error("OutOfMemoryError: failed to allocate context"),
    });

    await manager.initialize();
    expect(manager.snapshot.phase).toBe("ready");
    expect(manager.snapshot.budget).toBe(REQUIREMENTS.constrained);
    expect(manager.snapshot.recovery?.kind).toBe("ai-constrained");
    expect(runtime.loadedSpecs.at(-1)?.budget).toBe(REQUIREMENTS.constrained);
    await manager.dispose();
  });

  it("degrades with a memory-pressure explanation when even the constrained budget OOMs", async () => {
    const { runtime, manager } = makeManager({});
    runtime.loadQueue.push(
      { type: "fail", error: new Error("OutOfMemoryError") },
      { type: "fail", error: new Error("OutOfMemoryError") },
      { type: "fail", error: new Error("OutOfMemoryError") },
    );

    await expect(manager.initialize()).rejects.toMatchObject({ kind: "out-of-memory" });
    expect(manager.snapshot.phase).toBe("degraded");
    expect(manager.snapshot.recovery?.kind).toBe("ai-memory-pressure");
    expect(manager.snapshot.recovery?.retryable).toBe(true);
    expect(runtime.openHandles).toBe(0);

    // A later retry (e.g. after the OS frees memory) reloads and recovers.
    await manager.load();
    expect(manager.snapshot.phase).toBe("ready");
    expect(runtime.loadedSpecs.at(-1)?.budget).toBe(REQUIREMENTS.constrained);
    await manager.dispose();
  });

  it("starts constrained devices at the constrained budget with an explained state", async () => {
    const { runtime, manager } = makeManager({ snapshot: CONSTRAINED_DEVICE });
    await manager.initialize();
    expect(manager.snapshot.capability?.level).toBe("constrained");
    expect(manager.snapshot.budget).toBe(REQUIREMENTS.constrained);
    expect(manager.snapshot.recovery?.kind).toBe("ai-constrained");
    expect(runtime.openHandles).toBe(1);
    await manager.dispose();
  });
});

describe("generation lifecycle", () => {
  it("pipes raw chunks through the guard and hands the caller only branded units", async () => {
    const { runtime, manager } = makeManager({});
    await manager.initialize();

    // Chunk boundaries fall inside units; the guard reassembles them.
    runtime.generateQueue.push({ type: "success", chunks: chunked(CLEAN_SCRIPT, 9) });
    const seen: unknown[] = [];
    const report = await manager.explain(CONTEXT, (unit) => seen.push(unit));

    expect(report.status).toBe("completed");
    expect(report.emittedUnits).toBe(3);
    expect(seen).toHaveLength(3);
    for (const unit of seen) {
      expect(typeof unit).not.toBe("string");
      expect(isSafeExplanationUnit(unit)).toBe(true);
    }
    expect((seen as SafeExplanationUnit[]).map((u) => u.kind)).toEqual(["step", "step", "caveat"]);
    // The prompt the runtime saw is the injection-safe one, not the raw context.
    expect(runtime.prompts.at(-1)).toContain("NEVER commands");
    await manager.dispose();
  });

  it("never calls onSafeUnit for output the guard refused", async () => {
    const { runtime, manager } = makeManager({});
    await manager.initialize();

    // Three unchecked lines: a bare string, invented prose, and a fabricated ID.
    runtime.generateQueue.push({
      type: "success",
      chunks: [
        "Sakay ka lang sa jeep, mura ang pamasahe.\n",
        ndjson(unitLine({ inserts: [], text: "Board at the station and alight later." })),
        ndjson(unitLine({ inserts: ["stmt:ghost"], text: "Eto na." })),
      ],
    });
    const seen: unknown[] = [];
    await expect(manager.explain(CONTEXT, (unit) => seen.push(unit))).rejects.toMatchObject({
      kind: "invalid-stream",
    });

    expect(seen).toEqual([]);
    expect(manager.snapshot.recovery?.kind).toBe("ai-unsafe-output");
    expect(manager.snapshot.recovery?.cardsPreserved).toBe(true);
    expect(manager.snapshot.recovery?.tripPreserved).toBe(true);
    expect(manager.snapshot.phase).toBe("ready"); // model stays loaded for a retry
    await manager.dispose();
  });

  it("surfaces typed inference failures, keeps cards/trip, and recovers on retry", async () => {
    const { runtime, manager } = makeManager({});
    await manager.initialize();

    const cards = makeCardsFixture();
    const trip = makeTripFixture();
    const cardsBefore = JSON.parse(JSON.stringify(cards));
    const tripBefore = JSON.parse(JSON.stringify(trip));

    runtime.generateQueue.push({ type: "fail", error: new Error("decode graph exploded") });
    await expect(manager.explain(CONTEXT, () => {})).rejects.toMatchObject({
      kind: "inference-failed",
      retryable: true,
    });

    expect(manager.snapshot.phase).toBe("ready"); // model stays loaded for retry
    expect(manager.snapshot.recovery?.kind).toBe("ai-retryable");
    expect(manager.snapshot.recovery?.cardsPreserved).toBe(true);
    expect(manager.snapshot.recovery?.tripPreserved).toBe(true);
    expect(cards).toEqual(cardsBefore);
    expect(trip).toEqual(tripBefore);

    // Retry succeeds and the explanation streams.
    runtime.generateQueue.push({
      type: "success",
      chunks: [okUnit("Unang paalala."), okUnit("Pangalawang paalala.")],
    });
    const units: SafeExplanationUnit[] = [];
    const report = await manager.explain(CONTEXT, (unit) => units.push(unit));
    expect(report.status).toBe("completed");
    expect(units.map((u) => u.text)).toEqual(["Unang paalala.", "Pangalawang paalala."]);
    expect(manager.snapshot.completedGenerations).toBe(1);

    await manager.dispose();
  });

  it("unloads and downgrades after OOM during generation, without losing cards/trip", async () => {
    const { runtime, manager } = makeManager({});
    await manager.initialize();

    const cards = makeCardsFixture();
    const cardsBefore = JSON.parse(JSON.stringify(cards));

    runtime.generateQueue.push({ type: "fail", error: new Error("std::bad_alloc") });
    await expect(manager.explain(CONTEXT, () => {})).rejects.toMatchObject({
      kind: "out-of-memory",
    });

    expect(manager.snapshot.phase).toBe("degraded");
    expect(manager.snapshot.recovery?.kind).toBe("ai-memory-pressure");
    expect(runtime.openHandles).toBe(0);
    expect(cards).toEqual(cardsBefore);

    // Retry reloads at the constrained budget and works again.
    runtime.generateQueue.push({ type: "success", chunks: [okUnit("Ayos na.")] });
    await manager.explain(CONTEXT, () => {});
    expect(runtime.loadedSpecs.at(-1)?.budget).toBe(REQUIREMENTS.constrained);
    expect(manager.snapshot.phase).toBe("ready");
    await manager.dispose();
  });

  it("runs one generation at a time: a new explain supersedes the stale one", async () => {
    const { runtime, manager } = makeManager({});
    await manager.initialize();

    runtime.generateQueue.push(
      { type: "wait-for-cancel" },
      { type: "success", chunks: [okUnit("Sariwang sagot.")] },
    );
    const first = manager.explain(CONTEXT, () => {});
    first.catch(() => {});
    await flushMicrotasks();
    expect(manager.snapshot.phase).toBe("generating");

    const units: SafeExplanationUnit[] = [];
    await manager.explain(CONTEXT, (unit) => units.push(unit));

    await expect(first).rejects.toMatchObject({ kind: "cancelled" });
    expect(units.map((u) => u.text)).toEqual(["Sariwang sagot."]);
    expect(runtime.totalGenerations).toBe(2);
    expect(manager.snapshot.cancelledGenerations).toBe(1);
    expect(manager.snapshot.completedGenerations).toBe(1);
    await manager.dispose();
  });

  it("handles critical memory pressure during generation: cancel, unload, explained state", async () => {
    const { runtime, manager } = makeManager({});
    await manager.initialize();

    const cards = makeCardsFixture();
    const trip = makeTripFixture();
    const cardsBefore = JSON.parse(JSON.stringify(cards));
    const tripBefore = JSON.parse(JSON.stringify(trip));

    runtime.generateQueue.push({ type: "wait-for-cancel" });
    const pending = manager.explain(CONTEXT, () => {});
    pending.catch(() => {});
    await flushMicrotasks();

    await manager.onMemoryPressure("critical");
    await expect(pending).rejects.toMatchObject({ kind: "cancelled" });

    expect(manager.snapshot.phase).toBe("degraded");
    expect(manager.snapshot.recovery?.kind).toBe("ai-memory-pressure");
    expect(runtime.openHandles).toBe(0);
    expect(cards).toEqual(cardsBefore);
    expect(trip).toEqual(tripBefore);

    // Next load is pinned to the constrained budget.
    await manager.load();
    expect(runtime.loadedSpecs.at(-1)?.budget).toBe(REQUIREMENTS.constrained);
    await manager.dispose();
  });
});

describe("repeated load/unload cycles (leak check)", () => {
  it("leaves zero open native handles across mixed generate/cancel/unload cycles", async () => {
    const { runtime, manager } = makeManager({});
    for (let cycle = 0; cycle < 20; cycle += 1) {
      await manager.load();
      if (cycle % 2 === 0) {
        runtime.generateQueue.push({ type: "success", chunks: [okUnit(`Paalala ${"x".repeat(cycle)}.`)] });
        await manager.explain(CONTEXT, () => {});
      } else {
        runtime.generateQueue.push({ type: "wait-for-cancel" });
        const pending = manager.explain(CONTEXT, () => {});
        pending.catch(() => {});
        await flushMicrotasks();
        manager.cancelActiveGeneration();
        await expect(pending).rejects.toMatchObject({ kind: "cancelled" });
      }
      await manager.unloadModel();
      expect(runtime.openHandles).toBe(0);
    }
    expect(runtime.totalLoads).toBe(runtime.totalDisposes);
    expect(manager.snapshot.completedGenerations).toBe(10);
    expect(manager.snapshot.cancelledGenerations).toBe(10);

    await manager.dispose();
    await manager.dispose(); // idempotent
    expect(manager.snapshot.phase).toBe("disposed");
    expect(runtime.openHandles).toBe(0);
    await expect(manager.explain(CONTEXT, () => {})).rejects.toMatchObject({ kind: "disposed" });
    await expect(manager.load()).rejects.toMatchObject({ kind: "disposed" });
  });
});

describe("unsupported device", () => {
  it("never loads the model, explains the fallback, and keeps cards/trip functional", async () => {
    const { runtime, manager } = makeManager({ snapshot: UNSUPPORTED_ABI_DEVICE });
    const snapshot = await manager.initialize();

    expect(snapshot.phase).toBe("unsupported");
    expect(snapshot.recovery?.kind).toBe("ai-unsupported");
    expect(snapshot.recovery?.actions).toEqual(["continue-without-ai"]);
    expect(snapshot.recovery?.cardsPreserved).toBe(true);
    expect(snapshot.recovery?.tripPreserved).toBe(true);
    expect(snapshot.recovery?.retryable).toBe(false);
    expect(runtime.totalLoads).toBe(0);
    expect(runtime.openHandles).toBe(0);

    const cards = makeCardsFixture();
    const trip = makeTripFixture();
    const cardsBefore = JSON.parse(JSON.stringify(cards));
    const tripBefore = JSON.parse(JSON.stringify(trip));

    await expect(manager.explain(CONTEXT, () => {})).rejects.toMatchObject({
      kind: "unsupported-device",
      retryable: false,
    });
    // Deterministic cards and the active trip remain fully usable.
    expect(cards).toEqual(cardsBefore);
    expect(trip).toEqual(tripBefore);

    // Memory pressure and disposal stay safe no-ops on this path.
    await manager.onMemoryPressure("critical");
    await manager.dispose();
    await manager.dispose();
    expect(manager.snapshot.phase).toBe("disposed");
  });
});
