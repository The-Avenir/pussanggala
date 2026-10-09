import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import { CancellationTokenSource } from '@pusang-gala/ai';

const mock = vi.hoisted(() => ({
  files: new Map<string, Uint8Array>(), close: vi.fn(), reads: [] as number[],
  cancel: vi.fn(async () => {}), httpStatus: 200,
  selectedUri: null as string | null,
  beforeMove: vi.fn(async () => {}),
  nativeModules: {} as Record<string, unknown>,
}));
vi.mock('react-native', () => ({ Platform: { OS: 'android' }, NativeModules: mock.nativeModules }));
vi.mock('expo-file-system', () => {
  class Directory {
    uri: string;
    constructor(root: string, name: string) { this.uri = root + name + '/'; }
    create() {}
  }
  class File {
    uri: string;
    static async pickFileAsync() {
      return mock.selectedUri ? { canceled: false, result: new File(mock.selectedUri) } : { canceled: true, result: null };
    }
    constructor(root: string | Directory, name?: string) { this.uri = typeof root === 'string' ? root : root.uri + name; }
    get exists() { return mock.files.has(this.uri); }
    get size() { return mock.files.get(this.uri)?.length ?? 0; }
    delete() { mock.files.delete(this.uri); }
    async copy(target: File) {
      const bytes = mock.files.get(this.uri);
      if (!bytes) throw new Error('Missing source');
      mock.files.set(target.uri, bytes.slice());
    }
    async move(target: File) {
      await mock.beforeMove();
      const bytes = mock.files.get(this.uri);
      if (!bytes) throw new Error('Missing source');
      mock.files.set(target.uri, bytes);
      mock.files.delete(this.uri);
      this.uri = target.uri; // Expo updates the source URI after moving.
    }
    open() {
      const bytes = mock.files.get(this.uri)!;
      let position = 0;
      return { size: bytes.length, close: mock.close, readBytes(length: number) {
        mock.reads.push(length);
        const result = bytes.slice(position, position + length);
        position += result.length;
        return result;
      } };
    }
  }
  return { Directory, File, Paths: { document: 'file:///documents/' }, FileMode: { ReadOnly: 'r' } };
});
vi.mock('expo-file-system/legacy', () => ({
  getFreeDiskStorageAsync: async () => 1024 ** 3,
  createDownloadResumable: (_url: string, uri: string, _options: object,
    progress: (data: { totalBytesWritten: number }) => void) => ({
    cancelAsync: mock.cancel,
    downloadAsync: async () => {
      mock.files.set(uri, Uint8Array.of(1, 2, 3));
      progress({ totalBytesWritten: 3 });
      return { status: mock.httpStatus };
    },
  }),
}));
import { createModelFiles, pickModelFile } from './expoModelFiles';

describe('Expo model files', () => {
  beforeEach(() => { mock.files.clear(); mock.reads.length = 0; mock.close.mockClear(); mock.cancel.mockClear(); mock.httpStatus = 200; mock.selectedUri = null; mock.beforeMove.mockReset(); delete mock.nativeModules.PusangModelHash; });

  it('uses native SHA-256 for Android without copying model bytes into JS', async () => {
    const files = createModelFiles();
    const hashModel = vi.fn(async () => 'native-sha256');
    mock.nativeModules.PusangModelHash = { hashModel, cancel: vi.fn() };
    expect(await files.hash(files.modelUri, new CancellationTokenSource().token, () => {})).toBe('native-sha256');
    expect(hashModel).toHaveBeenCalledWith(files.modelUri, expect.any(String));
    expect(mock.reads).toHaveLength(0);
  });

  it('propagates a failed native promotion instead of claiming the file is ready', async () => {
    const files = createModelFiles();
    mock.files.set(files.partialUri, Uint8Array.of(1, 2, 3));
    mock.beforeMove.mockRejectedValueOnce(new Error('Native rename failed'));
    await expect(files.promote()).rejects.toThrow('Native rename failed');
    expect(await files.size(files.modelUri)).toBeNull();
    expect(await files.size(files.partialUri)).toBe(3);
  });

  it('handles picker cancellation and returns the selected document URI', async () => {
    expect(await pickModelFile()).toBeNull();
    mock.selectedUri = 'content://downloads/qwen.gguf';
    expect(await pickModelFile()).toBe(mock.selectedUri);
  });

  it('copies the selected document into private staging without moving the source', async () => {
    const files = createModelFiles();
    const uri = 'content://downloads/qwen.gguf';
    const bytes = Uint8Array.of(1, 2, 3);
    mock.files.set(uri, bytes);
    await files.copy(uri, files.partialUri);
    expect(mock.files.get(files.partialUri)).toEqual(bytes);
    expect(mock.files.get(uri)).toEqual(bytes);
  });

  it('hashes in bounded chunks and closes the file handle', async () => {
    const files = createModelFiles();
    const bytes = new Uint8Array(2 * 1024 * 1024 + 17).fill(42);
    mock.files.set(files.partialUri, bytes);
    const hash = await files.hash(files.partialUri, new CancellationTokenSource().token, () => {});
    expect(hash).toBe(bytesToHex(sha256(bytes)));
    expect(mock.reads).toEqual([1024 * 1024, 1024 * 1024, 17]);
    expect(mock.close).toHaveBeenCalledTimes(1);
  });

  it('closes the file when verification is cancelled', async () => {
    const files = createModelFiles();
    mock.files.set(files.partialUri, new Uint8Array(2 * 1024 * 1024));
    const source = new CancellationTokenSource();
    await expect(files.hash(files.partialUri, source.token, () => source.cancel())).rejects.toMatchObject({ kind: 'cancelled' });
    expect(mock.reads).toHaveLength(1);
    expect(mock.close).toHaveBeenCalledTimes(1);
  });

  it('promotes fresh partial files on repeated installs despite mutable Expo URIs', async () => {
    const files = createModelFiles();
    for (const value of [1, 2]) {
      await files.remove(files.modelUri);
      mock.files.set(files.partialUri, Uint8Array.of(value));
      await files.promote();
      expect(mock.files.get(files.modelUri)).toEqual(Uint8Array.of(value));
      expect(await files.size(files.partialUri)).toBeNull();
    }
  });

  it.each([200, 403])('handles HTTP %s and cleans up the native progress subscription', async status => {
    mock.httpStatus = status;
    const files = createModelFiles();
    const downloading = files.download('https://example.com/model', files.partialUri, new CancellationTokenSource().token, () => {});
    if (status === 200) await expect(downloading).resolves.toBeUndefined();
    else await expect(downloading).rejects.toThrow('Model download failed');
    expect(mock.cancel).toHaveBeenCalledTimes(1);
  });
});
