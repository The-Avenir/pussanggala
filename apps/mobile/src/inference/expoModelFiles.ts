import { Directory, File, FileMode, Paths } from 'expo-file-system';
import { createDownloadResumable, getFreeDiskStorageAsync } from 'expo-file-system/legacy';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import { QWEN_MODEL } from './qwen';
import type { ModelFiles } from './modelInstaller';

export async function pickModelFile(): Promise<string | null> {
  const picked = await File.pickFileAsync({ mimeTypes: '*/*' });
  return picked.canceled ? null : picked.result.uri;
}

export function createModelFiles(): ModelFiles {
  const directory = new Directory(Paths.document, 'models');
  const model = new File(directory, QWEN_MODEL.filename);
  const partial = new File(directory, QWEN_MODEL.filename + '.part');
  return {
    modelUri: model.uri,
    partialUri: partial.uri,
    prepare: async () => { directory.create({ intermediates: true, idempotent: true }); },
    size: async uri => { const file = new File(uri); return file.exists ? file.size : null; },
    freeBytes: getFreeDiskStorageAsync,
    copy: async (sourceUri, destinationUri) => { await new File(sourceUri).copy(new File(destinationUri)); },
    remove: async uri => { const file = new File(uri); if (file.exists) file.delete(); },
    // File.move changes the source object's URI; use a fresh object on every install.
    promote: async () => { await new File(directory, QWEN_MODEL.filename + '.part').move(model); },
    hash: async (uri, token, progress) => {
      const handle = new File(uri).open(FileMode.ReadOnly);
      const hash = sha256.create();
      try {
        const size = handle.size ?? 0;
        let read = 0;
        while (read < size) {
          token.throwIfCancelled();
          const chunk = handle.readBytes(Math.min(1024 * 1024, size - read));
          if (!chunk.length) throw new Error('Could not read the downloaded model.');
          hash.update(chunk);
          read += chunk.length;
          progress(read / size);
          // Bound JS memory and let the UI process progress/cancellation between chunks.
          await new Promise<void>(resolve => setTimeout(resolve, 0));
        }
        return bytesToHex(hash.digest());
      } finally { hash.destroy(); handle.close(); }
    },
    download: async (url, uri, token, progress) => {
      token.throwIfCancelled();
      const task = createDownloadResumable(url, uri, {}, event => {
        progress(Math.min(1, event.totalBytesWritten / QWEN_MODEL.bytes));
      });
      const unsubscribe = token.onCancel(() => { void task.cancelAsync().catch(() => {}); });
      try {
        const result = await task.downloadAsync();
        token.throwIfCancelled();
        if (!result || result.status !== 200) throw new Error('Model download failed. Check your connection and retry.');
      } finally {
        unsubscribe();
        // The legacy task owns a progress subscription; cancel also removes it after success.
        await task.cancelAsync().catch(() => {});
      }
    },
  };
}
