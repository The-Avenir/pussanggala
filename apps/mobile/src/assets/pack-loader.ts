import { loadPack, PackManifestRow, SUPPORTED_PACK_SCHEMA_VERSION } from "@pusang-gala/core";
import type { Pack, PackManifestRow as Manifest, RawPackTables } from "@pusang-gala/core";
import type { PackSqlitePort } from "./ports";
import { isLocalFileUri } from "./paths";
import type { FailureReason } from "./readiness";

export const SHA256_HEX_RE = /^[0-9a-f]{64}$/;
export function isMeasuredSha256(value: string): boolean {
  return SHA256_HEX_RE.test(value) && !/^(.)\1{63}$/.test(value)
    && value !== "0123456789abcdef".repeat(4);
}
export interface PackCompanion {
  pack_id: string; schema_version: number; created_at: string; input_sha256: string;
  pack_file: "pack.sqlite"; pack_sha256: string; pack_bytes: number;
  assets: Array<{ path: "pack.sqlite"; kind: "pack"; sha256: string; bytes: number }>;
  manifest: Manifest;
}
export interface LoaderIssue { reason: FailureReason; detail: string }
export type CompanionResult = { ok: true; value: PackCompanion } | { ok: false; error: LoaderIssue };
export function parsePackCompanion(text: string): CompanionResult {
  const fail = (reason: FailureReason, detail: string): CompanionResult => ({ ok: false, error: { reason, detail } });
  let obj: Record<string, unknown>;
  try {
    const value: unknown = JSON.parse(text);
    if (!value || typeof value !== "object" || Array.isArray(value)) return fail("manifest", "Expected companion object.");
    obj = value as Record<string, unknown>;
  } catch { return fail("manifest", "Companion JSON is unreadable."); }
  if (obj.schema_version !== SUPPORTED_PACK_SCHEMA_VERSION) return fail("schema", "Unsupported pack schema; use a compatible app and revalidate saved IDs.");
  const manifest = PackManifestRow.safeParse(obj.manifest);
  if (!manifest.success) return fail("manifest", "Companion manifest fields are invalid.");
  const m = manifest.data;
  if (m.schema_version !== SUPPORTED_PACK_SCHEMA_VERSION) return fail("schema", "Embedded manifest schema is unsupported.");
  if (obj.pack_id !== m.pack_id || obj.created_at !== m.created_at || obj.input_sha256 !== m.input_sha256
    || !SHA256_HEX_RE.test(m.input_sha256) || obj.pack_file !== "pack.sqlite"
    || typeof obj.pack_sha256 !== "string" || !isMeasuredSha256(obj.pack_sha256)
    || !Number.isSafeInteger(obj.pack_bytes) || (obj.pack_bytes as number) <= 0
    || m.included_posts + m.filtered_posts + m.pending_posts + m.rejected_posts !== m.answered_posts
    || m.answered_posts > m.input_posts) return fail("manifest", "Companion identity, checksum, size or dispositions are invalid.");
  if (!Array.isArray(obj.assets) || obj.assets.length !== 1) return fail("manifest", "Expected exactly one pack asset.");
  const a = obj.assets[0] as Record<string, unknown> | null;
  if (!a || a.path !== obj.pack_file || a.kind !== "pack" || a.sha256 !== obj.pack_sha256 || a.bytes !== obj.pack_bytes) {
    return fail("manifest", "Companion asset row disagrees with the pack checksum or size.");
  }
  return { ok: true, value: obj as unknown as PackCompanion };
}

export const PACK_TABLES = {
  regions: "region", places: "place", place_aliases: "place_alias", place_ambiguities: "place_ambiguity",
  stops: "stop", place_stops: "place_stop", routes: "route", legs: "leg", walk_links: "walk_link",
  fare_reports: "fare_report", hours_reports: "hours_report", shapes: "shape", notes: "note",
  note_links: "note_link", sources: "source", record_sources: "record_source",
} as const;
export const PACK_READ_QUERIES = Object.freeze([
  "PRAGMA user_version", "PRAGMA integrity_check", "PRAGMA foreign_key_check", "SELECT * FROM pack_manifest",
  ...Object.values(PACK_TABLES).map(table => `SELECT * FROM ${table}`),
]);
export type LoadedPack = { ok: true; value: Pack } | { ok: false; error: LoaderIssue };
/** Caller must verify BOTH file hashes and the companion binding before opening. */
export async function readValidatedPack(uri: string, companion: PackCompanion, sqlite: PackSqlitePort): Promise<LoadedPack> {
  const fail = (reason: FailureReason, detail: string): LoadedPack => ({ ok: false, error: { reason, detail } });
  if (!isLocalFileUri(uri)) return fail("network_source", "Pack path must be a local file URI.");
  let result: LoadedPack;
  let db;
  try {
    db = await sqlite.openReadOnly(uri);
    const versions = await db.all("PRAGMA user_version") as Array<{ user_version?: unknown }>;
    if (versions.length !== 1 || versions[0]?.user_version !== SUPPORTED_PACK_SCHEMA_VERSION) {
      result = fail("schema", "SQLite user_version is unsupported.");
    } else {
      const integrity = await db.all("PRAGMA integrity_check") as Array<{ integrity_check?: unknown }>;
      const fks = await db.all("PRAGMA foreign_key_check");
      if (integrity.length !== 1 || integrity[0]?.integrity_check !== "ok" || fks.length !== 0) {
        result = fail("pack_invalid", "SQLite integrity or foreign-key check failed.");
      } else {
        const manifests = await db.all("SELECT * FROM pack_manifest");
        const parsed = PackManifestRow.safeParse(manifests[0]);
        if (manifests.length !== 1 || !parsed.success || Object.keys(companion.manifest).some(
          key => parsed.data[key as keyof Manifest] !== companion.manifest[key as keyof Manifest],
        )) {
          result = fail("manifest", "SQLite manifest disagrees with the external companion.");
        } else {
          const raw = { manifest: manifests[0] } as RawPackTables;
          for (const [key, table] of Object.entries(PACK_TABLES)) {
            raw[key as keyof typeof PACK_TABLES] = await db.all(`SELECT * FROM ${table}`);
          }
          const loaded = loadPack(raw);
          result = loaded.ok ? { ok: true, value: loaded.value } : fail(
            loaded.error.some(issue => issue.code === "schema_incompatible") ? "schema" : "pack_invalid",
            `Core rejected pack (${loaded.error.length} issue(s)); no partial graph published.`,
          );
        }
      }
    }
  } catch { result = fail("pack_invalid", "Pack could not be opened or read; no partial graph published."); }
  if (db) {
    try { await db.close(); } catch { return fail("io", "Pack connection cleanup failed."); }
  }
  return result;
}
