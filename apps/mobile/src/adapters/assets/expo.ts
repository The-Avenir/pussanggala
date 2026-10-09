/**
 * Bind installed Expo modules in T40/T45. No imports of uninstalled native modules.
 * API basis: Expo SDK 57 File/Directory/FileHandle, Asset.fromModule, SQLite async API.
 * SHA-256 is injected as a streaming implementation; Expo Asset.hash is MD5.
 */
import { isLocalFileUri } from "../../assets/paths";
import { PACK_READ_QUERIES } from "../../assets/pack-loader";
import type { AssetPorts } from "../../assets/ports";

interface FileHandle { readBytes(length: number): Uint8Array; close(): void }
interface ExpoFile {
  readonly exists: boolean; readonly size: number; readonly uri: string;
  readonly parentDirectory: { create(options: { intermediates: boolean; idempotent: boolean }): void };
  text(): Promise<string>; open(): FileHandle; copy(destination: ExpoFile): void; delete(): void;
}
export interface IncrementalSha256 {
  update(bytes: Uint8Array): void;
  digestHex(): string;
}
export interface ExpoAssetBindings {
  File: new (uri: string) => ExpoFile;
  Asset: { fromModule(moduleId: number): { localUri: string | null } };
  SQLite: {
    openDatabaseAsync(name: string, options: { useNewConnection: boolean; enableChangeListener: boolean }, directory: string): Promise<{
      execAsync(sql: string): Promise<void>;
      getAllAsync(sql: string): Promise<unknown[]>;
      closeAsync(): Promise<void>;
    }>;
  };
  createSha256(): IncrementalSha256;
  /** Exact static module IDs or APK-native file URIs. Never asset.uri/downloadAsync. */
  registry: Readonly<Record<string, number | string>>;
}
export function createExpoAssetPorts(bindings: ExpoAssetBindings): AssetPorts {
  const checkedFile = (uri: string): ExpoFile => {
    if (!isLocalFileUri(uri)) throw new Error("Only local file URIs are permitted.");
    return new bindings.File(uri);
  };
  return {
    files: {
      async stat(uri) {
        const file = checkedFile(uri);
        return file.exists ? { exists: true, bytes: file.size } : { exists: false };
      },
      async sha256(uri) {
        const file = checkedFile(uri);
        if (!file.exists) throw new Error("Missing file.");
        const hash = bindings.createSha256();
        const handle = file.open();
        try {
          let remaining = file.size;
          while (remaining > 0) {
            const bytes = handle.readBytes(Math.min(64 * 1024, remaining));
            if (bytes.length === 0 || bytes.length > remaining) throw new Error("Truncated file.");
            hash.update(bytes);
            remaining -= bytes.length;
          }
          return hash.digestHex();
        } finally { handle.close(); }
      },
      async readText(uri) { return checkedFile(uri).text(); },
      async copy(source, destination) {
        const from = checkedFile(source);
        const to = checkedFile(destination);
        if (from.uri === to.uri) throw new Error("Bundle and private copy must differ.");
        to.parentDirectory.create({ intermediates: true, idempotent: true });
        // Consumers must release native handles before setup/retry (see T41 evidence).
        if (to.exists) to.delete();
        from.copy(to);
      },
    },
    bundle: {
      async resolve(path) {
        const module = bindings.registry[path];
        if (module === undefined) return null;
        return typeof module === "number" ? bindings.Asset.fromModule(module).localUri : module;
      },
    },
    sqlite: {
      async openReadOnly(uri) {
        if (!checkedFile(uri).exists) throw new Error("Never create a missing knowledge DB.");
        const slash = uri.lastIndexOf("/");
        const name = decodeURIComponent(uri.slice(slash + 1));
        const directory = uri.slice(0, slash);
        const db = await bindings.SQLite.openDatabaseAsync(name, { useNewConnection: true, enableChangeListener: false }, directory);
        try { await db.execAsync("PRAGMA query_only = ON"); }
        catch (error) { await db.closeAsync(); throw error; }
        return {
          async all(sql) {
            if (!PACK_READ_QUERIES.includes(sql)) throw new Error("Only knowledge-pack read queries are permitted.");
            return db.getAllAsync(sql);
          },
          async close() { await db.closeAsync(); },
        };
      },
    },
  };
}
