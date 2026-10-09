/**
 * T41 real Expo ports for `./nativePackAdapter.js` (device/runtime only).
 *
 * This is the ONLY module under `src/assets/` that imports native code:
 * - `expo-file-system` v57 `File`/`Directory`/`Paths` (copy-on-first-launch,
 *   exists/size/read — signatures verified against the installed typings),
 * - `expo-crypto` v57 `digest(SHA-256, bytes)` for real SHA-256 measurement,
 * - `expo-sqlite` v57 `openDatabaseSync(name, options?, directory)` for the
 *   read-only pack open (SELECT-only handle; expo-sqlite exposes no
 *   server-side read-only flag, so read-only holds by construction — this
 *   module never calls exec/run/write),
 * - `expo-asset` v57 `Asset.fromModule(...).downloadAsync()` to resolve a
 *   Metro-bundled asset to a readable `localUri` before copying.
 *
 * No network use: `File.downloadFileAsync`/upload tasks are never touched,
 * and `expo-asset` only resolves already-bundled files — the pre-download
 * URI guard (`assertLocalAssetUri`, INV-2) refuses any remote `asset.uri`
 * before `downloadAsync()` could fetch it. No persistence of
 * chat/GPS here — only pack bytes the APK already ships (INV-3 unaffected).
 *
 * Not imported by tests: vitest/Node cannot load native modules, so tests
 * inject fakes for the ports instead (see `nativePackAdapter.test.ts`).
 */

import { Asset } from "expo-asset";
import { digest, CryptoDigestAlgorithm } from "expo-crypto";
import { File } from "expo-file-system";
import { openDatabaseSync, type SQLiteDatabase } from "expo-sqlite";
import {
  assertLocalAssetUri,
  assertLocalFileUri,
  bytesToHexLower,
  PACK_DB_FILE_NAME,
  type NativeFilePort,
  type NativeHashPort,
  type NativePorts,
  type PackDbHandle,
  type PackDbPort,
} from "./nativePackAdapter.js";

/** Metro module IDs for the bundled pack assets (wired by the app entry). */
export interface BundledPackModules {
  /** `require("./assets/pack/pack.sqlite")` module ID for `Asset.fromModule`. */
  readonly packDb: number;
  /** `require("./assets/pack/manifest.json")` module ID for `Asset.fromModule`. */
  readonly packManifest: number;
}

/** Map an allowlist bundle path to its Metro module ID. */
function moduleIdFor(modules: BundledPackModules, bundlePath: string): number {
  if (bundlePath === "assets/pack/pack.sqlite") return modules.packDb;
  if (bundlePath === "assets/pack/manifest.json") return modules.packManifest;
  throw new Error(`expoNativePorts: no bundled module registered for "${bundlePath}"`);
}

class ExpoFilePort implements NativeFilePort {
  constructor(private readonly modules: BundledPackModules) {}

  async bundledExists(bundlePath: string): Promise<boolean> {
    // Registered Metro modules are compiled into the build; an unregistered
    // path is a packaging bug, surfaced here (not guessed at).
    try {
      moduleIdFor(this.modules, bundlePath);
      return true;
    } catch {
      return false;
    }
  }

  async copyBundledToNative(bundlePath: string, nativePath: string): Promise<void> {
    const asset = Asset.fromModule(moduleIdFor(this.modules, bundlePath));
    // INV-2: refuse a remote source BEFORE any fetch — `downloadAsync()`
    // pulls `asset.uri` over the network whenever bytes are not local.
    assertLocalAssetUri(asset.uri, bundlePath);
    await asset.downloadAsync();
    if (asset.localUri === null || asset.localUri === undefined) {
      throw new Error(`expoNativePorts: bundled asset has no localUri: ${bundlePath}`);
    }
    assertLocalFileUri(asset.localUri, bundlePath);
    const source = new File(asset.localUri);
    const target = new File(nativePath);
    // Explicit overwrite: the adapter calls this only when native bytes are
    // absent, but `RelocationOptions.overwrite` defaults to false, so a
    // concurrent first-copy race would otherwise throw DestinationExists.
    await source.copy(target, { overwrite: true });
  }

  async nativeExists(nativePath: string): Promise<boolean> {
    return new File(nativePath).exists;
  }

  async nativeSizeBytes(nativePath: string): Promise<number> {
    return new File(nativePath).size;
  }

  async nativeReadBytes(nativePath: string): Promise<Uint8Array> {
    // Direct byte read: avoids holding the whole file twice (base64 string +
    // decoded bytes) for pack-sized files.
    return new File(nativePath).bytes();
  }

  async nativeReadText(nativePath: string): Promise<string> {
    return new File(nativePath).text();
  }
}

class ExpoHashPort implements NativeHashPort {
  async sha256HexOfBytes(raw: Uint8Array): Promise<string> {
    // Copy into a fresh ArrayBuffer-backed view: TS 5.7+ types BufferSource
    // over ArrayBuffer only, and digest must not retain the caller's buffer.
    const bytes = new Uint8Array(raw);
    const buffer = await digest(CryptoDigestAlgorithm.SHA256, bytes);
    return bytesToHexLower(new Uint8Array(buffer));
  }
}

class ExpoPackDbHandle implements PackDbHandle {
  constructor(private readonly db: SQLiteDatabase) {}

  async readManifestRow(): Promise<Record<string, unknown> | null> {
    const row = await this.db.getFirstAsync<Record<string, unknown>>(
      "SELECT * FROM pack_manifest LIMIT 1",
    );
    return row;
  }

  async close(): Promise<void> {
    await this.db.closeAsync();
  }
}

class ExpoPackDbPort implements PackDbPort {
  async openReadOnly(nativeDir: string, fileName: string): Promise<PackDbHandle> {
    if (fileName !== PACK_DB_FILE_NAME) {
      throw new Error(`expoNativePorts: refusing to open non-pack DB "${fileName}"`);
    }
    const db = openDatabaseSync(fileName, undefined, nativeDir);
    return new ExpoPackDbHandle(db);
  }
}

/**
 * Build the production ports. `nativeDir` is a document-directory child URI
 * (e.g. from `new Directory(Paths.document, "pack")` at the call site — the
 * caller creates it). `modules` wires the two Metro-bundled pack assets.
 */
export function createExpoPorts(modules: BundledPackModules): NativePorts {
  return {
    files: new ExpoFilePort(modules),
    hash: new ExpoHashPort(),
    db: new ExpoPackDbPort(),
  };
}
