/**
 * T41 native pack adapter: copy-on-first-launch + measure + hash-before-open +
 * read-only SQLite manifest verification for the two pack rows this adapter
 * owns (A1 pack.sqlite, A2 pack-manifest).
 *
 * Pure TypeScript — no `expo-*`, storage, or network imports. Every native
 * effect arrives through the injected ports below, so this module (and the
 * whole readiness decision) is unit-testable with fakes and runs identically
 * on device with the real Expo ports in `./expoNativePorts.js`.
 *
 * Verification order (never violated):
 *   1. copy bundle asset to the native-readable path, only when no native
 *      bytes are present (V0 locate; exactly one copy site in `checkPin`),
 *   2. measure bytes + SHA-256 of the bytes as found and compare against the
 *      pinned value (V1) — measurement never recopies, so tampered bytes are
 *      detected, never healed,
 *   3. only then read/parse the manifest and open SQLite (V2–V4).
 * A hash mismatch quarantines the file (`failed/checksum`) and the database
 * is never opened. Manifest shape and `schema_version` are checked with the
 * Member-2-owned core contracts (`PackManifestRow`,
 * `SUPPORTED_PACK_SCHEMA_VERSION`) — this module invents no manifest fields.
 *
 * Honest states: with no measured pack bytes on disk and no Member-1/T15
 * pinned hashes, every pack row reports `missing` (nothing copied) or
 * `failed/checksum` ("no pinned SHA-256 recorded") — never `ready`.
 * Pack-update invalidation (stale native copy after an app update) is an
 * explicit pending gate for T44/startup wiring — this adapter never refreshes
 * present bytes on its own.
 * INV-2: no network fallback anywhere. INV-4: raw-dataset paths are rejected
 * by `loader.ts`, never opened here.
 */

import { PackManifestRow, SUPPORTED_PACK_SCHEMA_VERSION } from "@pusang-gala/core";
import { isPlausibleSha256, type PinnedAsset } from "./loader.js";
import type { FailureReason } from "./readiness.js";

export type { PinnedAsset };

/** Allowlist rows owned by this adapter (see `./allowlist.js` A1–A2). */
export const PACK_DB_ASSET_ID = "A1-pack-db";
export const PACK_MANIFEST_ASSET_ID = "A2-pack-manifest";

/** Bundle paths owned by this adapter (mirrors the allowlist rows). */
export const PACK_DB_BUNDLE_PATH = "assets/pack/pack.sqlite";
export const PACK_MANIFEST_BUNDLE_PATH = "assets/pack/manifest.json";

/** File-name portion used when opening the copied DB inside its directory. */
export const PACK_DB_FILE_NAME = "pack.sqlite";

/** Native filesystem effects, injected (Expo `File` in `./expoNativePorts.js`). */
export interface NativeFilePort {
  /** True when the bundle path is registered in this build (wired Metro asset). */
  bundledExists(bundlePath: string): Promise<boolean>;
  /**
   * Copy a bundled asset to its native-readable path. Called only when no
   * native bytes are present (see `checkPin`); measurement never recopies.
   * Implementations must be safe to retry (explicit overwrite) for the
   * first-copy race where two launches copy concurrently.
   */
  copyBundledToNative(bundlePath: string, nativePath: string): Promise<void>;
  /** True when a readable file exists at the native path. */
  nativeExists(nativePath: string): Promise<boolean>;
  /** Measured bytes of the file at the native path (0 when missing/unreadable). */
  nativeSizeBytes(nativePath: string): Promise<number>;
  /** Raw bytes of the file at the native path (throws on IO failure). */
  nativeReadBytes(nativePath: string): Promise<Uint8Array>;
  /** UTF-8 text of the file at the native path (throws on IO failure). */
  nativeReadText(nativePath: string): Promise<string>;
}

/** SHA-256 measurement, injected (expo-crypto in `./expoNativePorts.js`). */
export interface NativeHashPort {
  /** Lowercase-hex SHA-256 of the supplied bytes. */
  sha256HexOfBytes(raw: Uint8Array): Promise<string>;
}

/**
 * Read-only pack-database handle, injected (expo-sqlite in
 * `./expoNativePorts.js`). Read-only by construction: the surface exposes
 * only a single manifest SELECT plus close — no exec/run/write path exists.
 */
export interface PackDbHandle {
  /** The single `pack_manifest` row, or null when the table holds no rows. */
  readManifestRow(): Promise<Record<string, unknown> | null>;
  close(): Promise<void>;
}

/** Opens the copied pack DB. Throws when the file is not a readable SQLite DB. */
export interface PackDbPort {
  openReadOnly(nativeDir: string, fileName: string): Promise<PackDbHandle>;
}

export interface NativePorts {
  readonly files: NativeFilePort;
  readonly hash: NativeHashPort;
  readonly db: PackDbPort;
}

export type PackReadyState = "ready" | "missing" | "failed";

export interface PackReadiness {
  readonly assetId: string;
  readonly state: PackReadyState;
  readonly reason?: FailureReason;
  readonly detail?: string;
  /** Measured bytes of the copied file (0 when missing/unmeasured). */
  readonly bytes: number;
  /** Measured SHA-256 ("" until measured). */
  readonly sha256: string;
  /** Manifest `pack_id` once verified (pack rows only). */
  readonly packId?: string;
  /** Manifest `schema_version` once verified (pack rows only). */
  readonly schemaVersion?: number;
}

export interface EnsurePackInput {
  readonly ports: NativePorts;
  /** Native-readable directory the pack files are copied into. */
  readonly nativeDir: string;
  /** Pinned expectations (real Member-1/T15 pins; synthetic stays labelled). */
  readonly pinned: Readonly<Record<string, PinnedAsset>>;
}

const BASE64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/**
 * INV-2 boundary predicate shared with `./expoNativePorts.js`: true when an
 * asset URI requires a network fetch (`expo-asset` `downloadAsync()` pulls
 * `asset.uri` whenever the bytes are not already local — verified against
 * the installed `expo-asset/build/Asset.js`, where `downloadAsync()` calls
 * the native fetch unconditionally). Fail-closed: dev-server `http://`
 * Metro URLs count as remote too. Pure so fakes/tests can enforce it.
 */
export function isRemoteAssetUri(uri: string): boolean {
  return /^https?:\/\//i.test(uri);
}

/**
 * Throw before any `downloadAsync()` when the bundled asset points at a
 * remote URI (INV-2: no runtime network). Takes the pre-download `uri`, not
 * the eventual `localUri`, so a remote source can never trigger a fetch.
 */
export function assertLocalAssetUri(uri: string, bundlePath: string): void {
  if (isRemoteAssetUri(uri)) {
    throw new Error(
      `expoNativePorts: refusing remote asset URI for "${bundlePath}" (network_source, INV-2 offline): ${uri}`,
    );
  }
}

/**
 * Throw when a resolved native file URI is not a local `file://` path.
 * Defence after `downloadAsync()`: the copy source must be on-device bytes.
 */
export function assertLocalFileUri(localUri: string, bundlePath: string): void {
  if (!localUri.startsWith("file://")) {
    throw new Error(
      `expoNativePorts: refusing non-local file URI for "${bundlePath}" (network_source, INV-2 offline): ${localUri}`,
    );
  }
}

/** Decode standard base64 to bytes (pure TS; no atob/Buffer — RN-safe). */
export function base64ToBytes(base64: string): Uint8Array {
  const clean = base64.replace(/\s+/g, "");
  if (clean.length % 4 !== 0) throw new Error("base64ToBytes: length must be a multiple of 4");
  const padding = clean.endsWith("==") ? 2 : clean.endsWith("=") ? 1 : 0;
  const out = new Uint8Array(((clean.length / 4) | 0) * 3 - padding);
  let o = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const a = BASE64_CHARS.indexOf(clean.charAt(i));
    const b = BASE64_CHARS.indexOf(clean.charAt(i + 1));
    const c = clean.charAt(i + 2) === "=" ? 0 : BASE64_CHARS.indexOf(clean.charAt(i + 2));
    const d = clean.charAt(i + 3) === "=" ? 0 : BASE64_CHARS.indexOf(clean.charAt(i + 3));
    if (a < 0 || b < 0 || c < 0 || d < 0) throw new Error("base64ToBytes: invalid character");
    const triple = (a << 18) | (b << 12) | (c << 6) | d;
    out[o++] = (triple >> 16) & 0xff;
    if (o < out.length) out[o++] = (triple >> 8) & 0xff;
    if (o < out.length) out[o++] = triple & 0xff;
  }
  return out;
}

/** Lowercase-hex encode (for expo-crypto digest ArrayBuffers). */
export function bytesToHexLower(raw: ArrayLike<number>): string {
  let out = "";
  for (let i = 0; i < raw.length; i += 1) {
    const byte = raw[i] ?? 0;
    out += byte.toString(16).padStart(2, "0");
  }
  return out;
}

function joinNativePath(nativeDir: string, fileName: string): string {
  const base = nativeDir.endsWith("/") ? nativeDir.slice(0, -1) : nativeDir;
  return `${base}/${fileName}`;
}

interface Measured {
  readonly bytes: number;
  readonly sha256: string;
}

/**
 * Measure the bytes already present at the native path. Never copies:
 * copying happens exactly once in `checkPin` when native bytes are absent,
 * so re-verification cannot heal (or mask) on-disk tampering and a second
 * launch never recopies onto an existing target.
 */
async function measurePresent(
  ports: NativePorts,
  nativePath: string,
): Promise<Measured> {
  const bytes = await ports.files.nativeSizeBytes(nativePath);
  const raw = await ports.files.nativeReadBytes(nativePath);
  const sha256 = await ports.hash.sha256HexOfBytes(raw);
  return { bytes, sha256 };
}

function missing(assetId: string, detail: string): PackReadiness {
  return { assetId, state: "missing", reason: "missing", detail, bytes: 0, sha256: "" };
}

function failed(
  assetId: string,
  reason: FailureReason,
  detail: string,
  measured?: Measured,
): PackReadiness {
  return {
    assetId,
    state: "failed",
    reason,
    detail,
    bytes: measured?.bytes ?? 0,
    sha256: measured?.sha256 ?? "",
  };
}

/**
 * Check one copied file against its pin. Returns the measurement on match,
 * or a terminal readiness (missing/failed) — including "no pinned SHA-256
 * recorded" while Member-1/T15 pins are TBD (honest, never ready).
 */
async function checkPin(
  ports: NativePorts,
  assetId: string,
  bundlePath: string,
  nativePath: string,
  pinned: Readonly<Record<string, PinnedAsset>>,
): Promise<{ measured: Measured } | { readiness: PackReadiness }> {
  let copied = false;
  try {
    copied = await ports.files.nativeExists(nativePath);
    if (!copied) {
      if (!(await ports.files.bundledExists(bundlePath))) {
        return { readiness: missing(assetId, `${bundlePath}: not bundled yet`) };
      }
      await ports.files.copyBundledToNative(bundlePath, nativePath);
      copied = await ports.files.nativeExists(nativePath);
    }
  } catch (error) {
    return {
      readiness: failed(assetId, "io", `${bundlePath}: copy/locate failed: ${asMessage(error)}`),
    };
  }
  if (!copied) return { readiness: missing(assetId, `${bundlePath}: not copied yet`) };
  let measured: Measured;
  try {
    measured = await measurePresent(ports, nativePath);
  } catch (error) {
    return {
      readiness: failed(assetId, "io", `${bundlePath}: measure failed: ${asMessage(error)}`),
    };
  }
  const pin = pinned[assetId];
  if (pin === undefined) {
    return {
      readiness: failed(
        assetId,
        "checksum",
        `${assetId}: no pinned SHA-256 recorded (real pack hashes TBD — Member-1/T15)`,
        measured,
      ),
    };
  }
  if (!isPlausibleSha256(pin.sha256)) {
    return {
      readiness: failed(
        assetId,
        "bad_hash_format",
        `${assetId}: pinned hash is malformed (must be 64 lowercase hex)`,
        measured,
      ),
    };
  }
  if (measured.sha256 !== pin.sha256) {
    return {
      readiness: failed(
        assetId,
        "checksum",
        `${bundlePath}: SHA-256 mismatch — quarantine, do not open (V1 hash-before-open)`,
        measured,
      ),
    };
  }
  return { measured };
}

/** Validate an unknown manifest row with the core contract (no invented fields). */
export function verifyManifestRow(
  row: unknown,
): { packId: string; schemaVersion: number } | { reason: FailureReason; detail: string } {
  const parsed = PackManifestRow.safeParse(row);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const where = first ? [...first.path].map(String).join(".") || "row" : "row";
    return {
      reason: "manifest",
      detail: `pack manifest failed core validation at "${where}": ${first?.message ?? "invalid"}`,
    };
  }
  if (parsed.data.schema_version !== SUPPORTED_PACK_SCHEMA_VERSION) {
    return {
      reason: "schema",
      detail:
        `unknown schema_version ${parsed.data.schema_version} ` +
        `(supported: ${SUPPORTED_PACK_SCHEMA_VERSION}) — NeedsReplan path, do not restore`,
    };
  }
  return { packId: parsed.data.pack_id, schemaVersion: parsed.data.schema_version };
}

function asMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Ensure the A2 companion manifest: copy → measure → hash → core parse.
 * Returns pack identity on success for the A1 cross-check.
 */
export async function ensurePackManifest(
  input: EnsurePackInput,
): Promise<PackReadiness & { packId?: string; schemaVersion?: number }> {
  const nativePath = joinNativePath(input.nativeDir, "manifest.json");
  const checked = await checkPin(
    input.ports,
    PACK_MANIFEST_ASSET_ID,
    PACK_MANIFEST_BUNDLE_PATH,
    nativePath,
    input.pinned,
  );
  if ("readiness" in checked) return checked.readiness;
  const { measured } = checked;
  let text: string;
  try {
    text = await input.ports.files.nativeReadText(nativePath);
  } catch (error) {
    return failed(
      PACK_MANIFEST_ASSET_ID,
      "io",
      `${PACK_MANIFEST_BUNDLE_PATH}: read failed: ${asMessage(error)}`,
      measured,
    );
  }
  let json: unknown;
  try {
    json = JSON.parse(text) as unknown;
  } catch {
    return failed(
      PACK_MANIFEST_ASSET_ID,
      "manifest",
      "pack manifest is not valid JSON (V2)",
      measured,
    );
  }
  const verified = verifyManifestRow(json);
  if ("reason" in verified) {
    return failed(
      PACK_MANIFEST_ASSET_ID,
      verified.reason,
      verified.detail,
      measured,
    );
  }
  return {
    assetId: PACK_MANIFEST_ASSET_ID,
    state: "ready",
    bytes: measured.bytes,
    sha256: measured.sha256,
    packId: verified.packId,
    schemaVersion: verified.schemaVersion,
  };
}

/**
 * Ensure the A1 pack DB: copy → measure → hash → read-only open →
 * `pack_manifest` row read → core parse → pack_id cross-check with A2.
 * The DB is never opened before its hash matches (V1 hash-before-open).
 */
export async function ensurePackDb(
  input: EnsurePackInput,
  manifest: { packId: string; schemaVersion: number } | undefined,
): Promise<PackReadiness> {
  const nativePath = joinNativePath(input.nativeDir, PACK_DB_FILE_NAME);
  const checked = await checkPin(
    input.ports,
    PACK_DB_ASSET_ID,
    PACK_DB_BUNDLE_PATH,
    nativePath,
    input.pinned,
  );
  if ("readiness" in checked) return checked.readiness;
  const { measured } = checked;
  let handle: PackDbHandle;
  try {
    handle = await input.ports.db.openReadOnly(input.nativeDir, PACK_DB_FILE_NAME);
  } catch (error) {
    return failed(
      PACK_DB_ASSET_ID,
      "pack_invalid",
      `${PACK_DB_BUNDLE_PATH}: SQLite open failed (not a readable pack DB?): ${asMessage(error)}`,
      measured,
    );
  }
  // Close exactly once per path via `closeGuarded`, which converts a close
  // failure into a typed readiness instead of throwing out of this API.
  let row: Record<string, unknown> | null;
  try {
    row = await handle.readManifestRow();
  } catch (error) {
    return closeGuarded(
      failed(
        PACK_DB_ASSET_ID,
        "pack_invalid",
        `${PACK_DB_BUNDLE_PATH}: manifest query failed (missing pack_manifest table?): ${asMessage(error)}`,
        measured,
      ),
    );
  }
  if (row === null) {
    return closeGuarded({
      assetId: PACK_DB_ASSET_ID,
      state: "failed",
      reason: "empty_pack",
      detail: `${PACK_DB_BUNDLE_PATH}: pack_manifest holds no rows — refusing empty pack`,
      bytes: measured.bytes,
      sha256: measured.sha256,
    });
  }
  const verified = verifyManifestRow(row);
  if ("reason" in verified) {
    return closeGuarded(failed(PACK_DB_ASSET_ID, verified.reason, verified.detail, measured));
  }
  if (manifest !== undefined && verified.packId !== manifest.packId) {
    return closeGuarded(
      failed(
        PACK_DB_ASSET_ID,
        "pack_invalid",
        `${PACK_DB_BUNDLE_PATH}: pack_id "${verified.packId}" does not match manifest.json "${manifest.packId}"`,
        measured,
      ),
    );
  }
  return closeGuarded({
    assetId: PACK_DB_ASSET_ID,
    state: "ready",
    bytes: measured.bytes,
    sha256: measured.sha256,
    packId: verified.packId,
    schemaVersion: verified.schemaVersion,
  });

  async function closeGuarded(outcome: PackReadiness): Promise<PackReadiness> {
    try {
      await handle.close();
    } catch (error) {
      // Never throw out of the readiness API: a verified DB whose handle
      // fails to close is reported, not returned as ready.
      if (outcome.state === "ready") {
        return failed(
          PACK_DB_ASSET_ID,
          "io",
          `${PACK_DB_BUNDLE_PATH}: verified but close failed: ${asMessage(error)}`,
          measured,
        );
      }
    }
    return outcome;
  }
}

/**
 * Full adapter pipeline for the owned pack rows: A2 manifest first (its
 * identity cross-checks A1), then A1. Either row may honestly report
 * missing/failed — readiness aggregates downstream in `readiness.ts`.
 */
export async function ensurePackReady(input: EnsurePackInput): Promise<readonly PackReadiness[]> {
  const manifest = await ensurePackManifest(input);
  const db =
    manifest.packId !== undefined && manifest.schemaVersion !== undefined
      ? await ensurePackDb(input, { packId: manifest.packId, schemaVersion: manifest.schemaVersion })
      : await ensurePackDb(input, undefined);
  return [manifest, db];
}
