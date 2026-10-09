import { describe, expect, it } from "vitest";

import { AiRuntimeError } from "../errors";
import {
  CONSTRAINED_DEVICE,
  EMPTY_CONTEXT,
  makeCardsFixture,
  makeManager,
  makeTripFixture,
  REQUIREMENTS,
  UNSUPPORTED_ABI_DEVICE,
} from "./fixtures";
import { flushMicrotasks, ManualClock } from "./manual-clock";

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
    const observed: string[] = [];
    void pending.then(
      () => observed.push("resolved"),
      (error) => observed.push(`rejected:${(error as Error).message}`),
    );
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
    runtime.loadQueue.push(
      { type: "hang-until-cancelled" },
      { type: "hang-until-cancelled" },
    );

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
    runtime.loadQueue.push({ type: "fail", error: new Error("OutOfMemoryError: failed to allocate context") });

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
  it("surfaces typed inference failures, keeps cards/trip, and recovers on retry", async () => {
    const { runtime, manager } = makeManager({});
    await manager.initialize();

    const cards = makeCardsFixture();
    const trip = makeTripFixture();
    const cardsBefore = JSON.parse(JSON.stringify(cards));
    const tripBefore = JSON.parse(JSON.stringify(trip));

    runtime.generateQueue.push({ type: "fail", error: new Error("decode graph exploded") });
    await expect(manager.explain(EMPTY_CONTEXT, () => {})).rejects.toMatchObject({
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
    runtime.generateQueue.push({ type: "success", units: ["salita-1", "salita-2"] });
    const units: string[] = [];
    await manager.explain(EMPTY_CONTEXT, (unit) => units.push(unit));
    expect(units).toEqual(["salita-1", "salita-2"]);
    expect(manager.snapshot.completedGenerations).toBe(1);

    await manager.dispose();
  });

  it("unloads and downgrades after OOM during generation, without losing cards/trip", async () => {
    const { runtime, manager } = makeManager({});
    await manager.initialize();

    const cards = makeCardsFixture();
    const cardsBefore = JSON.parse(JSON.stringify(cards));

    runtime.generateQueue.push({ type: "fail", error: new Error("std::bad_alloc") });
    await expect(manager.explain(EMPTY_CONTEXT, () => {})).rejects.toMatchObject({
      kind: "out-of-memory",
    });

    expect(manager.snapshot.phase).toBe("degraded");
    expect(manager.snapshot.recovery?.kind).toBe("ai-memory-pressure");
    expect(runtime.openHandles).toBe(0);
    expect(cards).toEqual(cardsBefore);

    // Retry reloads at the constrained budget and works again.
    runtime.generateQueue.push({ type: "success", units: ["ok"] });
    await manager.explain(EMPTY_CONTEXT, () => {});
    expect(runtime.loadedSpecs.at(-1)?.budget).toBe(REQUIREMENTS.constrained);
    expect(manager.snapshot.phase).toBe("ready");
    await manager.dispose();
  });

  it("runs one generation at a time: a new explain supersedes the stale one", async () => {
    const { runtime, manager } = makeManager({});
    await manager.initialize();

    runtime.generateQueue.push({ type: "wait-for-cancel" }, { type: "success", units: ["fresh"] });
    const first = manager.explain(EMPTY_CONTEXT, () => {});
    await flushMicrotasks();
    expect(manager.snapshot.phase).toBe("generating");

    const units: string[] = [];
    await manager.explain(EMPTY_CONTEXT, (unit) => units.push(unit));

    await expect(first).rejects.toMatchObject({ kind: "cancelled" });
    expect(units).toEqual(["fresh"]);
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
    const pending = manager.explain(EMPTY_CONTEXT, () => {});
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
        runtime.generateQueue.push({ type: "success", units: [`unit-${cycle}`] });
        await manager.explain(EMPTY_CONTEXT, () => {});
      } else {
        runtime.generateQueue.push({ type: "wait-for-cancel" });
        const pending = manager.explain(EMPTY_CONTEXT, () => {});
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
    await expect(manager.explain(EMPTY_CONTEXT, () => {})).rejects.toMatchObject({ kind: "disposed" });
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

    await expect(manager.explain(EMPTY_CONTEXT, () => {})).rejects.toMatchObject({
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
