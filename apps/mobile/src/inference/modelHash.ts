import type { CancellationToken } from '@pusang-gala/ai';

export interface NativeModelHasher {
  hashModel(uri: string, jobId: string): Promise<string>;
  cancel(jobId: string): void;
}
let sequence = 0;
export async function hashModelNative(hasher: NativeModelHasher, uri: string,
  token: CancellationToken, progress: (fraction: number) => void): Promise<string> {
  token.throwIfCancelled();
  const jobId = `model-hash-${++sequence}`;
  const pending = hasher.hashModel(uri, jobId);
  const unsubscribe = token.onCancel(() => hasher.cancel(jobId));
  try {
    const hash = await pending;
    token.throwIfCancelled();
    progress(1);
    return hash;
  } finally { unsubscribe(); }
}
