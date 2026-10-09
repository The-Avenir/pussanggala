import { describe, expect, it, vi } from 'vitest';
import { CancellationTokenSource } from '@pusang-gala/ai';
import { ModelInstaller } from './modelInstaller';
import type { ModelFiles } from './modelInstaller';
import { QWEN_MODEL } from './qwen';
import type { ModelStatus } from './qwen';

function files(): ModelFiles {
  return {
    modelUri: 'file:///models/model.gguf', partialUri: 'file:///models/model.gguf.part',
    prepare: vi.fn(async () => {}), size: vi.fn(async uri => uri.endsWith('.part') ? QWEN_MODEL.bytes : null),
    freeBytes: vi.fn(async () => 1024 ** 3), hash: vi.fn(async () => QWEN_MODEL.sha256),
    copy: vi.fn(async () => {}), download: vi.fn(async () => {}), promote: vi.fn(async () => {}), remove: vi.fn(async () => {}),
  };
}

describe('Qwen model installation', () => {
  it('imports a selected local file without network access and preserves the source', async () => {
    const port = files();
    const uri = 'content://downloads/qwen.gguf';
    port.size = vi.fn(async path => path === port.modelUri ? null : QWEN_MODEL.bytes);
    const statuses: ModelStatus[] = [];
    expect(await new ModelInstaller(port).run(true, new CancellationTokenSource().token, status => statuses.push(status), uri)).toBe(true);
    expect(port.copy).toHaveBeenCalledWith(uri, port.partialUri);
    expect(port.download).not.toHaveBeenCalled();
    expect(port.hash).toHaveBeenCalledWith(port.partialUri, expect.anything(), expect.any(Function));
    expect(port.promote).toHaveBeenCalledTimes(1);
    expect(port.remove).not.toHaveBeenCalledWith(uri);
    expect(statuses.some(status => status.phase === 'importing')).toBe(true);
    expect(statuses.at(-1)?.phase).toBe('installed');
  });

  it.each(['wrong size', 'wrong checksum', 'copy failure', 'cancelled copy', 'remote source'])('rejects local import with %s', async reason => {
    const port = files();
    const source = new CancellationTokenSource();
    const uri = reason === 'remote source' ? 'https://example.com/model.gguf' : 'content://downloads/qwen.gguf';
    port.size = vi.fn(async path => path === port.modelUri ? null : reason === 'wrong size' ? 12 : QWEN_MODEL.bytes);
    if (reason === 'wrong checksum') port.hash = vi.fn(async () => 'bad');
    if (reason === 'copy failure') port.copy = vi.fn(async () => { throw new Error('Cannot read selected file'); });
    if (reason === 'cancelled copy') port.copy = vi.fn(async () => { source.cancel(); });
    expect(await new ModelInstaller(port).run(true, source.token, () => {}, uri)).toBe(false);
    expect(port.download).not.toHaveBeenCalled();
    expect(port.promote).not.toHaveBeenCalled();
    expect(port.remove).toHaveBeenCalledWith(port.partialUri);
    expect(port.remove).not.toHaveBeenCalledWith(uri);
  });

  it('checks existing storage without downloading on startup', async () => {
    const port = files();
    const statuses: ModelStatus[] = [];
    expect(await new ModelInstaller(port).run(false, new CancellationTokenSource().token, status => statuses.push(status))).toBe(false);
    expect(statuses.at(-1)?.phase).toBe('missing');
    expect(port.download).not.toHaveBeenCalled();
    expect(port.promote).not.toHaveBeenCalled();
  });

  it('downloads to a partial file and publishes only after exact size and hash verification', async () => {
    const port = files();
    const statuses: ModelStatus[] = [];
    expect(await new ModelInstaller(port).run(true, new CancellationTokenSource().token, status => statuses.push(status))).toBe(true);
    expect(port.download).toHaveBeenCalledWith(QWEN_MODEL.url, port.partialUri, expect.anything(), expect.any(Function));
    expect(port.hash).toHaveBeenCalledWith(port.partialUri, expect.anything(), expect.any(Function));
    expect(port.promote).toHaveBeenCalledTimes(1);
    expect(statuses.at(-1)?.phase).toBe('installed');
  });

  it('reuses a verified installation offline without redownloading', async () => {
    const port = files();
    port.size = vi.fn(async () => QWEN_MODEL.bytes);
    expect(await new ModelInstaller(port).run(true, new CancellationTokenSource().token, () => {})).toBe(true);
    expect(port.download).not.toHaveBeenCalled();
  });

  it.each(['truncated', 'wrong checksum', 'HTTP failure', 'storage full'])('rejects %s without publishing readiness', async reason => {
    const port = files();
    if (reason === 'truncated') port.size = vi.fn(async uri => uri.endsWith('.part') ? 12 : null);
    if (reason === 'wrong checksum') port.hash = vi.fn(async () => 'bad');
    if (reason === 'HTTP failure') port.download = vi.fn(async () => { throw new Error('HTTP 403'); });
    if (reason === 'storage full') port.freeBytes = vi.fn(async () => 0);
    const statuses: ModelStatus[] = [];
    expect(await new ModelInstaller(port).run(true, new CancellationTokenSource().token, status => statuses.push(status))).toBe(false);
    expect(statuses.at(-1)?.phase).toBe('error');
    expect(port.promote).not.toHaveBeenCalled();
    expect(port.remove).toHaveBeenCalledWith(port.partialUri);
  });

  it('cancels verification, cleans partial bytes, and permits a retry', async () => {
    const port = files();
    const source = new CancellationTokenSource();
    port.hash = vi.fn(async () => { source.cancel(); return QWEN_MODEL.sha256; });
    const installer = new ModelInstaller(port);
    expect(await installer.run(true, source.token, () => {})).toBe(false);
    expect(port.promote).not.toHaveBeenCalled();
    expect(port.remove).toHaveBeenCalledWith(port.partialUri);
    port.hash = vi.fn(async () => QWEN_MODEL.sha256);
    expect(await installer.run(true, new CancellationTokenSource().token, () => {})).toBe(true);
  });

  it('removes a corrupt installed model and replaces it only through verified download', async () => {
    const port = files();
    port.size = vi.fn(async () => QWEN_MODEL.bytes);
    port.hash = vi.fn(async uri => uri === port.modelUri ? 'bad' : QWEN_MODEL.sha256);
    expect(await new ModelInstaller(port).run(true, new CancellationTokenSource().token, () => {})).toBe(true);
    expect(port.remove).toHaveBeenCalledWith(port.modelUri);
    expect(port.promote).toHaveBeenCalledTimes(1);
  });
});
