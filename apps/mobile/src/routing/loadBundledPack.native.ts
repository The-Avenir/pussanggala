import { Asset } from 'expo-asset';
import { CryptoDigestAlgorithm, digest } from 'expo-crypto';
import { File, Directory, Paths } from 'expo-file-system';
import { openDatabaseAsync } from 'expo-sqlite';
import { setupLocalAssets } from '../assets/setup';
import type { AssetSpec } from '../assets/setup';
import { PACK_READ_QUERIES } from '../assets/pack-loader';
import { assertLocalAssetUri, assertLocalFileUri } from '../assets/nativePackAdapter';
import catalog from './packCatalog.json';
import companion from '../../assets/pack/pack.manifest.json';

export async function loadBundledPack() {
  const cachedManifest = new File(Paths.cache, 'bundled-pack.manifest.json');
  cachedManifest.write(JSON.stringify(companion, null, 2) + '\n');
  const modules: Record<string, number> = {
    'assets/pack/pack.sqlite': require('../../assets/pack/pack.sqlite'),
    'assets/licences/PACK-NOTICE.txt': require('../../assets/licences/PACK-NOTICE.txt'),
  };
  const result = await setupLocalAssets({ baseDir: new Directory(Paths.document, 'offline').uri,
    catalog: catalog as AssetSpec[], ports: {
      bundle: { async resolve(path) {
        if (path === 'assets/pack/pack.manifest.json') return cachedManifest.uri;
        const id = modules[path];
        if (id === undefined) return null;
        const asset = Asset.fromModule(id);
        assertLocalAssetUri(asset.uri, path);
        await asset.downloadAsync();
        if (!asset.localUri) return null;
        assertLocalFileUri(asset.localUri, path);
        return asset.localUri;
      } },
      files: {
        async stat(uri) { const file = new File(uri); return { exists: file.exists, bytes: file.size }; },
        async readText(uri) { return new File(uri).text(); },
        async sha256(uri) {
          const hash = await digest(CryptoDigestAlgorithm.SHA256, await new File(uri).bytes());
          return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
        },
        async copy(source, target) {
          const destination = new File(target);
          destination.parentDirectory.create({ intermediates: true, idempotent: true });
          await new File(source).copy(destination, { overwrite: true });
        },
      },
      sqlite: { async openReadOnly(uri) {
        const file = new File(uri);
        if (!file.exists) throw new Error('The verified database is missing.');
        const db = await openDatabaseAsync(file.name, { useNewConnection: true }, file.parentDirectory.uri);
        try { await db.execAsync('PRAGMA query_only = ON'); }
        catch (error) { await db.closeAsync(); throw error; }
        return { async all(sql) {
          if (!PACK_READ_QUERIES.includes(sql)) throw new Error('Only fixed pack read queries are permitted.');
          return db.getAllAsync(sql);
        }, async close() { await db.closeAsync(); } };
      } },
    } });
  if (!result.pack) throw new Error(result.assets.find(asset => asset.kind === 'pack' && asset.state !== 'ready')?.detail ?? 'Route pack validation failed.');
  if (result.assets.find(asset => asset.assetId === 'A10-pack-notice')?.state !== 'ready') throw new Error('Route pack attribution failed verification.');
  return result.pack;
}
