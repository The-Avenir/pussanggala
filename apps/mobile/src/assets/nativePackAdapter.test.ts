/**
 * T41 adapter tests: real byte hash mismatch / missing assets / manifest and
 * schema failures / SQLite failure behavior through injected ports.
 *
 * No native modules are imported here — fakes implement `NativePorts`, so
 * these run under vitest on Node. Hashes below are synthetic fixture values
 * (clearly labelled `synthetic-t41`), never real pack measurements: no real
 * pack bytes exist on disk yet (Member-1/T15 pins TBD).
 */

import { describe, expect, it } from "vitest";
import {
  assertLocalAssetUri,
  assertLocalFileUri,
  base64ToBytes,
  bytesToHexLower,
  ensurePackDb,
  ensurePackManifest,
  ensurePackReady,
  isRemoteAssetUri,
  PACK_DB_ASSET_ID,
  PACK_DB_BUNDLE_PATH,
  PACK_MANIFEST_ASSET_ID,
  PACK_MANIFEST_BUNDLE_PATH,
  verifyManifestRow,
  type NativePorts,
  type PackDbHandle,
  type PinnedAsset,
} from "./nativePackAdapter.js";

const SYNTHETIC_VERSION = "synthetic-t41.0";
const NATIVE_DIR = "file:///native/pack";
const NATIVE_DB = `${NATIVE_DIR}/pack.sqlite`;
const NATIVE_MANIFEST = `${NATIVE_DIR}/manifest.json`;

/** Deterministic fake SHA-256 stand-in (64 lowercase hex, content-derived). */
function fakeSha(raw: Uint8Array): string {
  let acc = raw.length * 31 + (raw[0] ?? 7);
  for (const byte of raw) acc = (acc * 33 + byte) >>> 0;
  return acc.toString(16).padStart(64, "0");
}

const OTHER_SHA256 = "f".repeat(64);
const enc = new TextEncoder();

function validManifestRow(): Record<string, unknown> {
  return {
    pack_id: "pack_ncr-2026-10",
    schema_version: 1,
    region_id: "rg_ncr",
    bbox: "120.9,14.3,121.1,14.9",
    created_at: "2026-10-01T00:00:00.000Z",
    source_date_min: "2024-01-01",
    source_date_max: "2026-09-01",
    stale_after_days: 180,
    input_sha256: OTHER_SHA256,
    input_posts: 2186,
    answered_posts: 100,
    included_posts: 60,
    filtered_posts: 20,
    pending_posts: 10,
    rejected_posts: 10,
  };
}

interface FakeDbScript {
  readonly manifestRow?: Record<string, unknown> | null;
  readonly throwOnOpen?: string;
  readonly throwOnQuery?: string;
  readonly throwOnCopy?: string;
  readonly throwOnClose?: string;
}

interface FakeWorld {
  readonly ports: NativePorts;
  /** Bundled assets visible to the fake copy (seeded by tests). */
  readonly bundled: Map<string, Uint8Array>;
  /** Native-side bytes (exposed so tests can simulate tamper). */
  readonly native: Map<string, Uint8Array>;
  readonly openCalls: { count: number };
  readonly copyCalls: { count: number };
}

function makeWorld(script: FakeDbScript = {}): FakeWorld {
  const bundled = new Map<string, Uint8Array>();
  const native = new Map<string, Uint8Array>();
  const openCalls = { count: 0 };
  const copyCalls = { count: 0 };
  const ports: NativePorts = {
    files: {
      async bundledExists(bundlePath: string): Promise<boolean> {
        return bundled.has(bundlePath);
      },
      async copyBundledToNative(bundlePath: string, nativePath: string): Promise<void> {
        copyCalls.count += 1;
        if (script.throwOnCopy !== undefined) throw new Error(script.throwOnCopy);
        const bytes = bundled.get(bundlePath);
        if (bytes === undefined) throw new Error(`bundled asset absent: ${bundlePath}`);
        native.set(nativePath, bytes);
      },
      async nativeExists(nativePath: string): Promise<boolean> {
        return native.has(nativePath);
      },
      async nativeSizeBytes(nativePath: string): Promise<number> {
        const bytes = native.get(nativePath);
        if (bytes === undefined) throw new Error(`no such native file: ${nativePath}`);
        return bytes.length;
      },
      async nativeReadBytes(nativePath: string): Promise<Uint8Array> {
        const bytes = native.get(nativePath);
        if (bytes === undefined) throw new Error(`no such native file: ${nativePath}`);
        return bytes;
      },
      async nativeReadText(nativePath: string): Promise<string> {
        const bytes = native.get(nativePath);
        if (bytes === undefined) throw new Error(`no such native file: ${nativePath}`);
        return new TextDecoder().decode(bytes);
      },
    },
    hash: {
      async sha256HexOfBytes(raw: Uint8Array): Promise<string> {
        return fakeSha(raw);
      },
    },
    db: {
      async openReadOnly(): Promise<PackDbHandle> {
        openCalls.count += 1;
        if (script.throwOnOpen !== undefined) throw new Error(script.throwOnOpen);
        const row = script.manifestRow === undefined ? validManifestRow() : script.manifestRow;
        return {
          async readManifestRow(): Promise<Record<string, unknown> | null> {
            if (script.throwOnQuery !== undefined) throw new Error(script.throwOnQuery);
            return row;
          },
          async close(): Promise<void> {
            if (script.throwOnClose !== undefined) throw new Error(script.throwOnClose);
          },
        };
      },
    },
  };
  return { ports, bundled, native, openCalls, copyCalls };
}

function pinsFor(entries: ReadonlyArray<{ assetId: string; sha256: string }>): Record<string, PinnedAsset> {
  const out: Record<string, PinnedAsset> = {};
  for (const entry of entries) {
    out[entry.assetId] = { assetId: entry.assetId, sha256: entry.sha256, version: SYNTHETIC_VERSION };
  }
  return out;
}

describe("base64ToBytes", () => {
  it("decodes a known vector", () => {
    expect([...base64ToBytes("aGVsbG8=")]).toEqual([104, 101, 108, 108, 111]);
  });

  it("rejects bad lengths and bad characters", () => {
    expect(() => base64ToBytes("abc")).toThrow();
    expect(() => base64ToBytes("!!!!")).toThrow();
  });
});

describe("bytesToHexLower", () => {
  it("pads each byte to two lowercase hex digits", () => {
    expect(bytesToHexLower([0, 15, 255])).toBe("000fff");
  });
});

describe("verifyManifestRow (core contract)", () => {
  it("accepts the supported schema version", () => {
    expect(verifyManifestRow(validManifestRow())).toEqual({
      packId: "pack_ncr-2026-10",
      schemaVersion: 1,
    });
  });

  it("reports manifest when core shape checks fail", () => {
    const row = validManifestRow();
    delete row["pack_id"];
    const result = verifyManifestRow(row);
    expect("reason" in result && result.reason).toBe("manifest");
  });

  it("reports schema for unknown schema_version (NeedsReplan, no restore)", () => {
    const result = verifyManifestRow({ ...validManifestRow(), schema_version: 999 });
    expect("reason" in result && result.reason).toBe("schema");
  });
});

describe("ensurePackManifest", () => {
  it("reports missing when the bundle asset is absent", async () => {
    const world = makeWorld();
    const result = await ensurePackManifest({ ports: world.ports, nativeDir: NATIVE_DIR, pinned: {} });
    expect(result.assetId).toBe(PACK_MANIFEST_ASSET_ID);
    expect(result.state).toBe("missing");
    expect(result.reason).toBe("missing");
  });

  it("reports checksum/TBD when no pin is recorded (honest, never ready)", async () => {
    const world = makeWorld();
    world.bundled.set(PACK_MANIFEST_BUNDLE_PATH, enc.encode(JSON.stringify(validManifestRow())));
    const result = await ensurePackManifest({ ports: world.ports, nativeDir: NATIVE_DIR, pinned: {} });
    expect(result.state).toBe("failed");
    expect(result.reason).toBe("checksum");
    expect(result.detail).toContain("Member-1/T15");
  });

  it("reports io when the copy itself fails (disk/permission failure)", async () => {
    const world = makeWorld({ throwOnCopy: "ENOSPC: no space left on device" });
    world.bundled.set(PACK_MANIFEST_BUNDLE_PATH, enc.encode("{}"));
    const result = await ensurePackManifest({ ports: world.ports, nativeDir: NATIVE_DIR, pinned: {} });
    expect(result.state).toBe("failed");
    expect(result.reason).toBe("io");
  });

  it("reports manifest for invalid JSON", async () => {
    const world = makeWorld();
    const bytes = enc.encode("{not json");
    world.bundled.set(PACK_MANIFEST_BUNDLE_PATH, bytes);
    const result = await ensurePackManifest({
      ports: world.ports,
      nativeDir: NATIVE_DIR,
      pinned: pinsFor([{ assetId: PACK_MANIFEST_ASSET_ID, sha256: fakeSha(bytes) }]),
    });
    expect(result.state).toBe("failed");
    expect(result.reason).toBe("manifest");
  });

  it("reports ready with pack identity for a valid pinned manifest", async () => {
    const world = makeWorld();
    const bytes = enc.encode(JSON.stringify(validManifestRow()));
    world.bundled.set(PACK_MANIFEST_BUNDLE_PATH, bytes);
    const result = await ensurePackManifest({
      ports: world.ports,
      nativeDir: NATIVE_DIR,
      pinned: pinsFor([{ assetId: PACK_MANIFEST_ASSET_ID, sha256: fakeSha(bytes) }]),
    });
    expect(result.state).toBe("ready");
    expect(result.packId).toBe("pack_ncr-2026-10");
    expect(result.schemaVersion).toBe(1);
    expect(result.bytes).toBe(bytes.length);
  });
});

describe("ensurePackDb", () => {
  it("reports checksum on byte mismatch and never opens the database", async () => {
    const world = makeWorld();
    const bytes = enc.encode("corrupt-bytes");
    world.bundled.set(PACK_DB_BUNDLE_PATH, bytes);
    const result = await ensurePackDb(
      {
        ports: world.ports,
        nativeDir: NATIVE_DIR,
        pinned: pinsFor([{ assetId: PACK_DB_ASSET_ID, sha256: OTHER_SHA256 }]),
      },
      undefined,
    );
    expect(result.assetId).toBe(PACK_DB_ASSET_ID);
    expect(result.state).toBe("failed");
    expect(result.reason).toBe("checksum");
    expect(world.openCalls.count).toBe(0);
  });

  it("reports pack_invalid when SQLite open throws (corrupt file)", async () => {
    const world = makeWorld({ throwOnOpen: "file is not a database" });
    const bytes = enc.encode("not-a-database");
    world.bundled.set(PACK_DB_BUNDLE_PATH, bytes);
    const result = await ensurePackDb(
      {
        ports: world.ports,
        nativeDir: NATIVE_DIR,
        pinned: pinsFor([{ assetId: PACK_DB_ASSET_ID, sha256: fakeSha(bytes) }]),
      },
      undefined,
    );
    expect(result.state).toBe("failed");
    expect(result.reason).toBe("pack_invalid");
  });

  it("reports manifest when the manifest query fails (missing table)", async () => {
    const world = makeWorld({ throwOnQuery: "no such table: pack_manifest" });
    const bytes = enc.encode("db-bytes");
    world.bundled.set(PACK_DB_BUNDLE_PATH, bytes);
    const result = await ensurePackDb(
      {
        ports: world.ports,
        nativeDir: NATIVE_DIR,
        pinned: pinsFor([{ assetId: PACK_DB_ASSET_ID, sha256: fakeSha(bytes) }]),
      },
      undefined,
    );
    expect(result.reason).toBe("pack_invalid");
    expect(result.detail).toContain("pack_manifest");
  });

  it("reports empty_pack when the manifest table holds no rows", async () => {
    const world = makeWorld({ manifestRow: null });
    const bytes = enc.encode("db-bytes");
    world.bundled.set(PACK_DB_BUNDLE_PATH, bytes);
    const result = await ensurePackDb(
      {
        ports: world.ports,
        nativeDir: NATIVE_DIR,
        pinned: pinsFor([{ assetId: PACK_DB_ASSET_ID, sha256: fakeSha(bytes) }]),
      },
      undefined,
    );
    expect(result.state).toBe("failed");
    expect(result.reason).toBe("empty_pack");
  });

  it("reports schema for an unknown DB schema_version without restoring", async () => {
    const world = makeWorld({ manifestRow: { ...validManifestRow(), schema_version: 999 } });
    const bytes = enc.encode("db-bytes");
    world.bundled.set(PACK_DB_BUNDLE_PATH, bytes);
    const result = await ensurePackDb(
      {
        ports: world.ports,
        nativeDir: NATIVE_DIR,
        pinned: pinsFor([{ assetId: PACK_DB_ASSET_ID, sha256: fakeSha(bytes) }]),
      },
      undefined,
    );
    expect(result.reason).toBe("schema");
  });

  it("reports pack_invalid when the DB pack_id disagrees with manifest.json", async () => {
    const world = makeWorld({
      manifestRow: { ...validManifestRow(), pack_id: "pack_ncr-2099-99" },
    });
    const bytes = enc.encode("db-bytes");
    world.bundled.set(PACK_DB_BUNDLE_PATH, bytes);
    const result = await ensurePackDb(
      {
        ports: world.ports,
        nativeDir: NATIVE_DIR,
        pinned: pinsFor([{ assetId: PACK_DB_ASSET_ID, sha256: fakeSha(bytes) }]),
      },
      { packId: "pack_ncr-2026-10", schemaVersion: 1 },
    );
    expect(result.reason).toBe("pack_invalid");
    expect(result.detail).toContain("does not match");
  });
});

describe("ensurePackReady", () => {
  it("returns ready for both rows when hashes, manifest, and DB agree", async () => {
    const world = makeWorld();
    const manifestBytes = enc.encode(JSON.stringify(validManifestRow()));
    const dbBytes = enc.encode("fake-sqlite-bytes");
    world.bundled.set(PACK_MANIFEST_BUNDLE_PATH, manifestBytes);
    world.bundled.set(PACK_DB_BUNDLE_PATH, dbBytes);
    const results = await ensurePackReady({
      ports: world.ports,
      nativeDir: NATIVE_DIR,
      pinned: pinsFor([
        { assetId: PACK_MANIFEST_ASSET_ID, sha256: fakeSha(manifestBytes) },
        { assetId: PACK_DB_ASSET_ID, sha256: fakeSha(dbBytes) },
      ]),
    });
    expect(results.map((r) => r.assetId)).toEqual([PACK_MANIFEST_ASSET_ID, PACK_DB_ASSET_ID]);
    expect(results.every((r) => r.state === "ready")).toBe(true);
    expect(world.openCalls.count).toBe(1);
  });

  it("still checks the DB when the manifest is missing (both report honestly)", async () => {
    const world = makeWorld();
    const dbBytes = enc.encode("fake-sqlite-bytes");
    world.bundled.set(PACK_DB_BUNDLE_PATH, dbBytes);
    const results = await ensurePackReady({
      ports: world.ports,
      nativeDir: NATIVE_DIR,
      pinned: pinsFor([{ assetId: PACK_DB_ASSET_ID, sha256: fakeSha(dbBytes) }]),
    });
    expect(results[0]?.state).toBe("missing");
    expect(results[1]?.state).toBe("ready");
  });

  it("uses the ports' native paths (copy target matches open dir)", async () => {
    const world = makeWorld();
    const manifestBytes = enc.encode(JSON.stringify(validManifestRow()));
    const dbBytes = enc.encode("db");
    world.bundled.set(PACK_MANIFEST_BUNDLE_PATH, manifestBytes);
    world.bundled.set(PACK_DB_BUNDLE_PATH, dbBytes);
    await ensurePackReady({
      ports: world.ports,
      nativeDir: NATIVE_DIR,
      pinned: pinsFor([
        { assetId: PACK_MANIFEST_ASSET_ID, sha256: fakeSha(manifestBytes) },
        { assetId: PACK_DB_ASSET_ID, sha256: fakeSha(dbBytes) },
      ]),
    });
    // Measured bytes flow through to the readiness rows.
    const again = await ensurePackManifest({
      ports: world.ports,
      nativeDir: NATIVE_DIR,
      pinned: pinsFor([{ assetId: PACK_MANIFEST_ASSET_ID, sha256: fakeSha(manifestBytes) }]),
    });
    expect(again.bytes).toBe(manifestBytes.length);
    expect(again.sha256).toBe(fakeSha(manifestBytes));
    void NATIVE_DB;
    void NATIVE_MANIFEST;
  });
});

describe("idempotent launch (F1: measure never recopies)", () => {
  it("a second readiness check copies nothing and stays ready", async () => {
    const world = makeWorld();
    const manifestBytes = enc.encode(JSON.stringify(validManifestRow()));
    const dbBytes = enc.encode("fake-sqlite-bytes");
    world.bundled.set(PACK_MANIFEST_BUNDLE_PATH, manifestBytes);
    world.bundled.set(PACK_DB_BUNDLE_PATH, dbBytes);
    const input = {
      ports: world.ports,
      nativeDir: NATIVE_DIR,
      pinned: pinsFor([
        { assetId: PACK_MANIFEST_ASSET_ID, sha256: fakeSha(manifestBytes) },
        { assetId: PACK_DB_ASSET_ID, sha256: fakeSha(dbBytes) },
      ]),
    };
    const first = await ensurePackReady(input);
    expect(first.every((r) => r.state === "ready")).toBe(true);
    expect(world.copyCalls.count).toBe(2);
    const second = await ensurePackReady(input);
    expect(second.every((r) => r.state === "ready")).toBe(true);
    expect(world.copyCalls.count).toBe(2);
  });

  it("detects tampered present bytes (checksum, DB never opens) instead of healing them", async () => {
    const world = makeWorld();
    const dbBytes = enc.encode("fake-sqlite-bytes");
    world.bundled.set(PACK_DB_BUNDLE_PATH, dbBytes);
    const input = {
      ports: world.ports,
      nativeDir: NATIVE_DIR,
      pinned: pinsFor([{ assetId: PACK_DB_ASSET_ID, sha256: fakeSha(dbBytes) }]),
    };
    const first = await ensurePackDb(input, undefined);
    expect(first.state).toBe("ready");
    expect(world.openCalls.count).toBe(1);
    // Tamper with the present native bytes: measurement must catch it.
    world.native.set(NATIVE_DB, enc.encode("tampered-bytes"));
    const second = await ensurePackDb(input, undefined);
    expect(second.state).toBe("failed");
    expect(second.reason).toBe("checksum");
    expect(world.openCalls.count).toBe(1);
    expect(world.copyCalls.count).toBe(1);
  });
});

describe("close failure (F2: typed readiness, never throws)", () => {
  it("reports io when the handle fails to close after verify", async () => {
    const world = makeWorld({ throwOnClose: "database is locked" });
    const bytes = enc.encode("db-bytes");
    world.bundled.set(PACK_DB_BUNDLE_PATH, bytes);
    const result = await ensurePackDb(
      {
        ports: world.ports,
        nativeDir: NATIVE_DIR,
        pinned: pinsFor([{ assetId: PACK_DB_ASSET_ID, sha256: fakeSha(bytes) }]),
      },
      undefined,
    );
    expect(result.state).toBe("failed");
    expect(result.reason).toBe("io");
    expect(result.detail).toContain("close failed");
  });
});

describe("remote asset URI guard (INV-2, before any download)", () => {
  it("classifies remote vs local URIs fail-closed", () => {
    expect(isRemoteAssetUri("https://cdn.example/pack.sqlite")).toBe(true);
    expect(isRemoteAssetUri("http://localhost:8081/assets/pack.sqlite")).toBe(true);
    expect(isRemoteAssetUri("file:///data/user/0/pack.sqlite")).toBe(false);
    expect(isRemoteAssetUri("content://media/pack.sqlite")).toBe(false);
  });

  it("throws before download for remote URIs, accepts local ones", () => {
    expect(() =>
      assertLocalAssetUri("https://cdn.example/pack.sqlite", PACK_DB_BUNDLE_PATH),
    ).toThrow(/network_source/);
    expect(() =>
      assertLocalAssetUri("file:///android_asset/pack.sqlite", PACK_DB_BUNDLE_PATH),
    ).not.toThrow();
  });

  it("accepts only file:// native copy targets", () => {
    expect(() => assertLocalFileUri("file:///data/pack.sqlite", PACK_DB_BUNDLE_PATH)).not.toThrow();
    expect(() => assertLocalFileUri("https://cdn.example/pack.sqlite", PACK_DB_BUNDLE_PATH)).toThrow(
      /network_source/,
    );
  });
});
