/**
 * Deterministic clock for lifecycle tests: timeouts and back-off delays only
 * elapse when the test explicitly advances time.
 */

import type { Clock } from "../lifecycle";

export class ManualClock implements Clock {
  private t = 0;
  private pending: { at: number; resolve: () => void }[] = [];

  now(): number {
    return this.t;
  }

  sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      this.pending.push({ at: this.t + ms, resolve });
    });
  }

  get pendingCount(): number {
    return this.pending.length;
  }

  async advance(ms: number): Promise<void> {
    const target = this.t + ms;
    for (;;) {
      await flushMicrotasks();
      this.pending.sort((a, b) => a.at - b.at);
      const next = this.pending.find((p) => p.at <= target);
      if (!next) break;
      this.pending.splice(this.pending.indexOf(next), 1);
      this.t = Math.max(this.t, next.at);
      next.resolve();
    }
    this.t = target;
    await flushMicrotasks();
  }
}

export function flushMicrotasks(rounds = 10): Promise<void> {
  let chain = Promise.resolve();
  for (let i = 0; i < rounds; i += 1) {
    chain = chain.then(() => {});
  }
  return chain;
}
