import { describe, expect, it, vi } from 'vitest';
import { ResponseStream } from './responseStream';

describe('visible safe reply streaming', () => {
  it('publishes successive text updates and finishes only after queued words are visible', () => {
    vi.useFakeTimers();
    try {
      const update = vi.fn();
      const stream = new ResponseStream(update);
      stream.start(1); stream.append(1, 'Hi! I am Gaile, your NCR commute companion.'); stream.finish(1);
      expect(update.mock.calls.at(-1)?.[2]).toBe(true);
      vi.runAllTimers();
      expect(update.mock.calls.length).toBeGreaterThan(3);
      expect(update.mock.calls.at(-1)).toEqual([1, 'Hi! I am Gaile, your NCR commute companion.', false]);
    } finally { vi.useRealTimers(); }
  });
  it('drops queued output on cancellation and never mixes old text into a new conversation', () => {
    vi.useFakeTimers();
    try {
      const update = vi.fn(); const stream = new ResponseStream(update);
      stream.start(1); stream.append(1, 'Old trip has many more words that should never appear.');
      stream.cancel(); stream.start(2); stream.append(2, 'New reply.'); stream.append(1, 'Late old reply.'); stream.finish(1); stream.finish(2); vi.runAllTimers();
      expect(update.mock.calls.filter(call => call[0] === 2).every(call => !String(call[1]).includes('Old'))).toBe(true);
      expect(update.mock.calls.at(-1)).toEqual([2, 'New reply.', false]);
    } finally { vi.useRealTimers(); }
  });
});
