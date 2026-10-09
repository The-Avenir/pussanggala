export const QWEN_MODEL = {
  filename: 'qwen2.5-0.5b-instruct-q4_k_m.gguf',
  url: 'https://modelscope.cn/api/v1/models/Qwen/Qwen2.5-0.5B-Instruct-GGUF/repo?Revision=2e50b77b0eee3083842019e257b74854323d880a&FilePath=qwen2.5-0.5b-instruct-q4_k_m.gguf',
  bytes: 491400032,
  sha256: '74a4da8c9fdbcd15bd1f6d01d621410d31c6fc00986f5eb687824e7b93d7a9db',
  budget: { contextTokens: 2048, outputTokenCap: 384, threads: 2, runtimeMemoryMb: 700 },
} as const;

export type ModelPhase = 'checking' | 'missing' | 'selecting' | 'importing' | 'downloading' | 'verifying' | 'installed' | 'error' | 'unsupported';
export interface ModelStatus { phase: ModelPhase; progress: number; error: string | null; }
