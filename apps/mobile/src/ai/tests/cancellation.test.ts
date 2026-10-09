import { describe, expect, it } from "vitest";

import { CancellationTokenSource } from "../cancellation";
import { AiRuntimeError } from "../errors";
import { EMPTY_CONTEXT, makeCardsFixture, makeManager, makeTripFixture } from "./fixtures";
import { flushMicrotasks } from "./manual-clock";

describe("cancellation tokens", () => {
  it("cancel is prompt, idempotent, and throwIfCancelled raises the typed kind", () => {
    const source = new CancellationTokenSource();
    const token = source.token;
    expect(token.isCancelled).toBe(false);

    let calls = 0;
    token.onCancel(() => {
      calls += 1;
    });
    source.cancel();
    source.cancel();
    expect(token.isCancelled).toBe(true);
    expect(calls).toBe(1);
    expect(() => token.throwIfCancelled()).toThrowError(AiRuntimeError);
    try {
      token.throwIfCancelled();
    } catch (error) {
      expect((error as AiRuntimeError).kind).toBe("cancelled");
    }
  });

  it("listeners that throw cannot block other listeners", () => {
    const source = new CancellationTokenSource();
    let second = false;
    source.token.onCancel(() => {
      throw new Error("bad listener");
    });
    source.token.onCancel(() => {
      second = true;
    });
    source.cancel();
    expect(second).toBe(true);
  });
});

describe("cancel during generate", () => {
  it("rejects promptly with the typed cancelled kind and preserves cards and trip", async () => {
    const { runtime, manager } = makeManager({});
    await manager.initialize();

    const cards = makeCardsFixture();
    const trip = makeTripFixture();
    const cardsBefore = JSON.parse(JSON.stringify(cards));
    const tripBefore = JSON.parse(JSON.stringify(trip));

    runtime.generateQueue.push({ type: "wait-for-cancel", units: ["unit-a"] });
    const units: string[] = [];
    const pending = manager.explain(EMPTY_CONTEXT, (unit) => units.push(unit));

    await flushMicrotasks();
    expect(manager.snapshot.phase).toBe("generating");

    manager.cancelActiveGeneration();
    manager.cancelActiveGeneration(); // idempotent second call

    await expect(pending).rejects.toMatchObject({ kind: "cancelled", retryable: false });

    expect(units).toEqual(["unit-a"]); // only units emitted before cancel
    expect(manager.snapshot.phase).toBe("ready");
    expect(manager.snapshot.cancelledGenerations).toBe(1);
    expect(cards).toEqual(cardsBefore);
    expect(trip).toEqual(tripBefore);

    // The model stays loaded and usable after cancellation.
    runtime.generateQueue.push({ type: "success", units: ["retry-a"] });
    await manager.explain(EMPTY_CONTEXT, () => {});
    expect(manager.snapshot.completedGenerations).toBe(1);

    await manager.dispose();
    expect(runtime.openHandles).toBe(0);
  });

  it("honours an externally owned cancellation token", async () => {
    const { runtime, manager } = makeManager({});
    await manager.initialize();

    runtime.generateQueue.push({ type: "wait-for-cancel" });
    const external = new CancellationTokenSource();
    const pending = manager.explain(EMPTY_CONTEXT, () => {}, external.token);
    await flushMicrotasks();

    external.cancel();
    await expect(pending).rejects.toMatchObject({ kind: "cancelled" });
    expect(manager.snapshot.phase).toBe("ready");

    await manager.dispose();
  });
});
