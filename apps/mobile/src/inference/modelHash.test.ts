import { describe, expect, it, vi } from 'vitest';
import { CancellationTokenSource } from '@pusang-gala/ai';
import { hashModelNative } from './modelHash';

describe('native model hashing', () => {
  it('hashes by file URI without reading model bytes into JavaScript', async () => {
    const native = { hashModel: vi.fn(async () => 'verified-hash'), cancel: vi.fn() };
    const progress = vi.fn();
    expect(await hashModelNative(native, 'file:///models/qwen.gguf', new CancellationTokenSource().token, progress)).toBe('verified-hash');
    expect(native.hashModel).toHaveBeenCalledWith('file:///models/qwen.gguf', expect.any(String));
    expect(progress).toHaveBeenCalledWith(1);
  });
  it('cancels native work and never publishes its late result', async () => {
    let finish!: (hash: string) => void;
    const native = { hashModel: vi.fn(() => new Promise<string>(resolve => { finish = resolve; })), cancel: vi.fn() };
    const source = new CancellationTokenSource();
    const progress = vi.fn();
    const pending = hashModelNative(native, 'file:///models/qwen.gguf', source.token, progress);
    source.cancel(); finish('late-hash');
    await expect(pending).rejects.toBeDefined();
    expect(native.cancel).toHaveBeenCalledWith(expect.any(String));
    expect(progress).not.toHaveBeenCalled();
  });
});
