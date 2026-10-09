import { AiRuntimeError, asCancellationToken, CancellationTokenSource, classifyNativeError, linkToken } from '@pusang-gala/ai';
import type { CancellationLike, GroundingContext, ModelRuntime, ModelSpec, RuntimeHandle } from '@pusang-gala/ai';
import type { ContextParams, CompletionParams, LlamaContext, TokenData } from 'llama.rn';
import { explanationGrammar } from '../inference/explanationGrammar';

type NativeContext = Pick<LlamaContext, 'completion' | 'stopCompletion' | 'release'>;
type Initialize = (params: ContextParams) => Promise<NativeContext>;

// Native imports are deferred so the web preview can load without the JSI module.
const initialize: Initialize = async params => (await import('llama.rn')).initLlama(params);

/** Local files only. Downloading belongs to model installation, never inference. */
export class LlamaRuntime implements ModelRuntime {
  private context: NativeContext | null = null;
  private spec: ModelSpec | null = null;
  private loading: Promise<RuntimeHandle> | null = null;
  private loadSource: CancellationTokenSource | null = null;
  private generation: { source: CancellationTokenSource; settled: Promise<void> } | null = null;
  private sequence = 0;
  private grammar: string | undefined;

  constructor(private readonly init: Initialize = initialize) {}

  configureExplanation(context: GroundingContext): void { this.grammar = explanationGrammar(context); }

  async load(spec: ModelSpec, cancellation?: CancellationLike): Promise<RuntimeHandle> {
    const token = asCancellationToken(cancellation);
    token?.throwIfCancelled();
    if (!spec.modelPath.startsWith('file://') && !spec.modelPath.startsWith('/')) {
      throw new AiRuntimeError('asset-unavailable', 'The model must be a verified local file.');
    }
    if (this.loading || this.context) throw new AiRuntimeError('busy', 'A model is already loaded or loading.');
    const source = new CancellationTokenSource();
    this.loadSource = source;
    const unlink = linkToken(source, token);
    let unsubscribe = () => {};
    const cancelled = new Promise<never>((_, reject) => {
      unsubscribe = source.token.onCancel(() => reject(new AiRuntimeError('cancelled', 'Model loading cancelled.')));
    });
    const pending = this.init({
      model: spec.modelPath, n_ctx: spec.budget.contextTokens, n_threads: spec.budget.threads,
      n_batch: 128, n_gpu_layers: 0, use_mmap: true, use_mlock: false,
    }).then(async context => {
      // initLlama cannot abort a native load. Release any result that arrives after cancellation.
      if (source.token.isCancelled) {
        await context.release();
        source.token.throwIfCancelled();
      }
      this.context = context;
      this.spec = spec;
      return { id: ++this.sequence, spec };
    }).catch(error => { throw classifyNativeError(error, 'load-failed'); }).finally(() => {
      this.loading = null;
      this.loadSource = null;
      unlink();
      unsubscribe();
    });
    this.loading = pending;
    return Promise.race([pending, cancelled]);
  }

  async *generate(prompt: string, cancellation?: CancellationLike): AsyncIterable<string> {
    const token = asCancellationToken(cancellation);
    token?.throwIfCancelled();
    const context = this.context;
    const spec = this.spec;
    if (!context || !spec) throw new AiRuntimeError('asset-unavailable', 'Load the local model first.');
    if (this.generation) throw new AiRuntimeError('busy', 'An explanation is already running.');
    const source = new CancellationTokenSource();
    const unlink = linkToken(source, token);
    const queue: string[] = [];
    let wake: (() => void) | undefined;
    let finished = false;
    let failure: unknown;
    const params: CompletionParams = {
      messages: [{ role: 'user', content: prompt }],
      n_predict: spec.budget.outputTokenCap, temperature: 0.2, top_p: 0.9,
      stop: ['<|im_end|>', '<|endoftext|>'],
      ...(this.grammar ? { grammar: this.grammar } : {}),
    };
    const settled = context.completion(params, (data: TokenData) => {
      if (!source.token.isCancelled && data.token) { queue.push(data.token); wake?.(); }
    }).then(() => {}, error => { failure = error; }).finally(() => { finished = true; wake?.(); });
    this.generation = { source, settled };
    const unsubscribe = source.token.onCancel(() => {
      void context.stopCompletion().catch(() => {});
      wake?.();
    });
    try {
      while (!finished || queue.length) {
        source.token.throwIfCancelled();
        const chunk = queue.shift();
        if (chunk !== undefined) yield chunk;
        else await new Promise<void>(resolve => { wake = resolve; });
      }
      source.token.throwIfCancelled();
      if (failure !== undefined) throw classifyNativeError(failure, 'inference-failed');
    } finally {
      source.cancel();
      await settled;
      unsubscribe();
      unlink();
      this.generation = null;
    }
  }

  cancel(): void { this.generation?.source.cancel(); }

  async dispose(): Promise<void> {
    this.loadSource?.cancel();
    this.cancel();
    await this.loading?.catch(() => {});
    await this.generation?.settled;
    const context = this.context;
    this.context = null;
    this.spec = null;
    this.grammar = undefined;
    await context?.release();
  }
}
