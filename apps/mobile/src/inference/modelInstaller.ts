import { AiRuntimeError } from '@pusang-gala/ai';
import { QWEN_MODEL } from './qwen';
import type { CancellationToken } from '@pusang-gala/ai';
import type { ModelStatus } from './qwen';

export interface ModelFiles {
  readonly modelUri: string;
  readonly partialUri: string;
  prepare(): Promise<void>;
  size(uri: string): Promise<number | null>;
  freeBytes(): Promise<number>;
  hash(uri: string, token: CancellationToken, progress: (fraction: number) => void): Promise<string>;
  copy(sourceUri: string, destinationUri: string): Promise<void>;
  download(url: string, uri: string, token: CancellationToken, progress: (fraction: number) => void): Promise<void>;
  promote(): Promise<void>;
  remove(uri: string): Promise<void>;
}

/** Publish only a complete, checksum-verified model; .part files are never loaded. */
export class ModelInstaller {
  private operation = false;
  constructor(readonly files: ModelFiles) {}

  async run(download: boolean, token: CancellationToken, update: (status: ModelStatus) => void, importUri?: string): Promise<boolean> {
    if (this.operation) throw new AiRuntimeError('busy', 'Model installation is already running.');
    this.operation = true;
    const status = (phase: ModelStatus['phase'], progress = 0, error: string | null = null) => update({ phase, progress, error });
    try {
      status('checking');
      await this.files.prepare();
      token.throwIfCancelled();
      const size = await this.files.size(this.files.modelUri);
      if (size === QWEN_MODEL.bytes) {
        status('verifying');
        const hash = await this.files.hash(this.files.modelUri, token, fraction => status('verifying', fraction));
        token.throwIfCancelled();
        if (hash === QWEN_MODEL.sha256) { status('installed', 1); return true; }
      }
      if (size !== null) await this.files.remove(this.files.modelUri);
      if (!download) { status('missing'); return false; }
      await this.files.remove(this.files.partialUri);
      if (importUri && (!/^(file|content):\/\//.test(importUri) || await this.files.size(importUri) !== QWEN_MODEL.bytes)) {
        throw new Error(`Select ${QWEN_MODEL.filename} (491 MB).`);
      }
      if (await this.files.freeBytes() < QWEN_MODEL.bytes + 64 * 1024 * 1024) {
        throw new Error('Free at least 560 MB of storage, then retry the download.');
      }
      token.throwIfCancelled();
      if (importUri) {
        status('importing');
        await this.files.copy(importUri, this.files.partialUri);
      } else {
        status('downloading');
        await this.files.download(QWEN_MODEL.url, this.files.partialUri, token, fraction => status('downloading', fraction));
      }
      token.throwIfCancelled();
      status('verifying');
      if (await this.files.size(this.files.partialUri) !== QWEN_MODEL.bytes ||
          await this.files.hash(this.files.partialUri, token, fraction => status('verifying', fraction)) !== QWEN_MODEL.sha256) {
        throw new Error('The model file is incomplete or failed verification. Please retry.');
      }
      token.throwIfCancelled();
      await this.files.promote();
      status('installed', 1);
      return true;
    } catch (error) {
      status(token.isCancelled ? 'missing' : 'error', 0,
        token.isCancelled ? null : error instanceof Error ? error.message : 'Model installation failed.');
      return false;
    } finally {
      try { await this.files.remove(this.files.partialUri); } finally { this.operation = false; }
    }
  }
}
