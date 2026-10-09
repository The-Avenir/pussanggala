import { describe, expect, it } from "vitest";

import { CancellationTokenSource, signalFromToken, tokenFromSignal } from "../cancellation";
import { AiRuntimeError } from "../errors";
import type { SafeExplanationUnit } from "../explanation-unit";
import {
  fixtureContext,
  makeCardsFixture,
  makeManager,
  makeTripFixture,
  ndjson,
  unitLine,
} from "./fixtures";
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

describe("AbortSignal <-> CancellationToken bridge", () => {
  it("maps an AbortSignal onto a token", () => {
    const controller = new AbortController();
    const token = tokenFromSignal(controller.signal);
    let fired = false;
    token.onCancel(() => {
      fired = true;
    });
    expect(token.isCancelled).toBe(false);
    controller.abort();
    expect(fired).toBe(true);
    expect(token.isCancelled).toBe(true);
    expect(() => token.throwIfCancelled()).toThrowError(AiRuntimeError);
  });

  it("fires immediately when the signal is already aborted", () => {
    const controller = new AbortController();
    controller.abort();
    let fired = false;
    tokenFromSignal(controller.signal).onCancel(() => {
      fired = true;
    });
    expect(fired).toBe(true);
  });

  it("maps a token onto an AbortSignal for adapters written to the web idiom", () => {
    const source = new CancellationTokenSource();
    const signal = signalFromToken(source.token);
    expect(signal.aborted).toBe(false);
    source.cancel();
    expect(signal.aborted).toBe(true);
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

    runtime.generateQueue.push({
      type: "wait-for-cancel",
      chunks: [ndjson(unitLine({ inserts: ["stmt:warn-1"], text: "Paalala muna." }))],
    });
    const units: SafeExplanationUnit[] = [];
    const pending = manager.explain(fixtureContext(), (unit) => units.push(unit));

    await flushMicrotasks();
    expect(manager.snapshot.phase).toBe("generating");

    manager.cancelActiveGeneration();
    manager.cancelActiveGeneration(); // idempotent second call

    await expect(pending).rejects.toMatchObject({ kind: "cancelled", retryable: false });

    expect(units.map((u) => u.text)).toEqual(["Paalala muna."]); // only units validated before cancel
    expect(runtime.cancelCalls).toBeGreaterThan(0); // cancellation reached the port
    expect(manager.snapshot.phase).toBe("ready");
    expect(manager.snapshot.cancelledGenerations).toBe(1);
    expect(cards).toEqual(cardsBefore);
    expect(trip).toEqual(tripBefore);

    // The model stays loaded and usable after cancellation.
    runtime.generateQueue.push({
      type: "success",
      chunks: [ndjson(unitLine({ inserts: ["stmt:warn-1"], text: "Subok muli." }))],
    });
    await manager.explain(fixtureContext(), () => {});
    expect(manager.snapshot.completedGenerations).toBe(1);

    await manager.dispose();
    expect(runtime.openHandles).toBe(0);
  });

  it("honours an externally owned cancellation token", async () => {
    const { runtime, manager } = makeManager({});
    await manager.initialize();

    runtime.generateQueue.push({ type: "wait-for-cancel" });
    const external = new CancellationTokenSource();
    const pending = manager.explain(fixtureContext(), () => {}, external.token);
    await flushMicrotasks();

    external.cancel();
    await expect(pending).rejects.toMatchObject({ kind: "cancelled" });
    expect(manager.snapshot.phase).toBe("ready");

    await manager.dispose();
  });

  it("honours a plain AbortSignal passed to explain", async () => {
    const { runtime, manager } = makeManager({});
    await manager.initialize();

    runtime.generateQueue.push({ type: "wait-for-cancel" });
    const controller = new AbortController();
    const pending = manager.explain(fixtureContext(), () => {}, controller.signal);
    await flushMicrotasks();

    controller.abort();
    await expect(pending).rejects.toMatchObject({ kind: "cancelled" });
    expect(manager.snapshot.phase).toBe("ready");

    await manager.dispose();
  });
});
