import { describe, expect, it, vi } from 'vitest';
import { CancellationTokenSource, explain } from '@pusang-gala/ai';
import type { ModelSpec } from '@pusang-gala/ai';
import type { CompletionParams, LlamaContext, TokenData } from 'llama.rn';
import { LlamaRuntime } from './llamaRuntime';
import { QWEN_MODEL } from '../inference/qwen';
import { previewAnswerContext, renderSafeExplanation } from '../inference/explanationContext';

type Context = Pick<LlamaContext, 'completion' | 'stopCompletion' | 'release'>;
const spec: ModelSpec = { modelPath: 'file:///models/qwen.gguf', sha256: QWEN_MODEL.sha256, budget: QWEN_MODEL.budget };
const result = { text: '' } as Awaited<ReturnType<Context['completion']>>;
function context(chunks: string[] = []): Context {
  return {
    completion: vi.fn(async (_params: CompletionParams, callback?: (data: TokenData) => void) => {
      for (const token of chunks) callback?.({ token });
      return result;
    }),
    stopCompletion: vi.fn(async () => {}), release: vi.fn(async () => {}),
  };
}

describe('llama.rn bridge', () => {
  it('loads a local file with bounded CPU settings and uses the model chat template', async () => {
    const native = context(['hel', 'lo']);
    const init = vi.fn(async () => native);
    const runtime = new LlamaRuntime(init);
    await runtime.load(spec);
    const chunks: string[] = [];
    for await (const chunk of runtime.generate('explain')) chunks.push(chunk);
    expect(chunks).toEqual(['hel', 'lo']);
    expect(init).toHaveBeenCalledWith(expect.objectContaining({ model: spec.modelPath, n_gpu_layers: 0, n_ctx: 2048, use_mmap: true }));
    expect(native.completion).toHaveBeenCalledWith(expect.objectContaining({ messages: [{ role: 'user', content: 'explain' }], n_predict: 384 }), expect.any(Function));
    await runtime.dispose();
    await runtime.dispose();
    expect(native.release).toHaveBeenCalledTimes(1);
  });

  it('refuses remote model paths before native initialization', async () => {
    const init = vi.fn(async () => context());
    const runtime = new LlamaRuntime(init);
    await expect(runtime.load({ ...spec, modelPath: 'https://example.com/model.gguf' })).rejects.toMatchObject({ kind: 'asset-unavailable' });
    expect(init).not.toHaveBeenCalled();
  });

  it('rejects cancelled loading promptly and releases a context that arrives late', async () => {
    const native = context();
    let resolve!: (value: Context) => void;
    const runtime = new LlamaRuntime(() => new Promise<Context>(done => { resolve = done; }));
    const source = new CancellationTokenSource();
    const loading = runtime.load(spec, source.token);
    source.cancel();
    await expect(loading).rejects.toMatchObject({ kind: 'cancelled' });
    const disposing = runtime.dispose();
    resolve(native);
    await disposing;
    expect(native.release).toHaveBeenCalledTimes(1);
  });

  it('stops sampling when the iterator is closed early and allows another generation', async () => {
    let finish!: () => void;
    const native = context();
    native.completion = vi.fn((_params, callback) => {
      callback?.({ token: 'first' });
      return new Promise<typeof result>(done => { finish = () => done(result); });
    });
    native.stopCompletion = vi.fn(async () => { finish(); });
    const runtime = new LlamaRuntime(async () => native);
    await runtime.load(spec);
    const stream = runtime.generate('explain')[Symbol.asyncIterator]();
    expect(await stream.next()).toEqual({ done: false, value: 'first' });
    await expect(runtime.generate('second')[Symbol.asyncIterator]().next()).rejects.toMatchObject({ kind: 'busy' });
    await stream.return?.();
    expect(native.stopCompletion).toHaveBeenCalledTimes(1);
    const next = runtime.generate('second')[Symbol.asyncIterator]();
    await next.next();
    await next.return?.();
    await runtime.dispose();
  });

  it('cancels a waiting stream and ignores tokens delivered after cancellation', async () => {
    let finish!: () => void;
    let callback: ((data: TokenData) => void) | undefined;
    const native = context();
    native.completion = vi.fn((_params, onToken) => {
      callback = onToken;
      return new Promise<typeof result>(done => { finish = () => done(result); });
    });
    native.stopCompletion = vi.fn(async () => { callback?.({ token: 'late' }); finish(); });
    const runtime = new LlamaRuntime(async () => native);
    await runtime.load(spec);
    const source = new CancellationTokenSource();
    const waiting = runtime.generate('explain', source.token)[Symbol.asyncIterator]().next();
    source.cancel();
    await expect(waiting).rejects.toMatchObject({ kind: 'cancelled' });
    await runtime.dispose();
    expect(native.stopCompletion).toHaveBeenCalledTimes(1);
  });

  it('passes arbitrary token chunks through the guard and never displays rejected facts', async () => {
    const good = JSON.stringify({ kind: 'summary', cardRef: 'preview-answer', inserts: ['preview-answer-0'], text: 'Here is the example.' });
    const bad = JSON.stringify({ kind: 'summary', inserts: ['invented'], text: 'Fare is ₱999.' });
    const native = context([good.slice(0, 14), good.slice(14) + '\n' + bad + '\n']);
    const runtime = new LlamaRuntime(async () => native);
    await runtime.load(spec);
    const grounding = previewAnswerContext('Route data is unavailable.');
    const displayed: string[] = [];
    const report = await explain(grounding, runtime, unit => displayed.push(renderSafeExplanation(unit, grounding)));
    expect(report.emittedUnits).toBe(1);
    expect(report.rejectedUnits).toHaveLength(1);
    expect(displayed).toEqual(['Here is the example. Route data is unavailable.']);
    await runtime.dispose();
  });
});
