/** Local-only setup: verified APK files -> private files -> validated in-memory core pack. */
import type { Card, Pack } from "@pusang-gala/core";
import { ALLOWLIST, entryForBundlePath, findForbiddenMarker } from "./allowlist";
import type { AssetKind } from "./allowlist";
import type { AssetPorts, LocalFilePort } from "./ports";
import { isLocalFileUri, joinAssetPath } from "./paths";
import { isMeasuredSha256, parsePackCompanion, readValidatedPack, SHA256_HEX_RE } from "./pack-loader";
import type { LoaderIssue } from "./pack-loader";
import { summarizeReadiness } from "./readiness";
import type { FailureReason, LocatedAsset, ReadinessSummary } from "./readiness";

export { SHA256_HEX_RE, joinAssetPath };
export type { LoaderIssue };
export interface AssetSpec {
  readonly assetId: string;
  readonly bundlePath: string;
  readonly kind: AssetKind;
  readonly sha256: string;
  readonly bytes: number;
  readonly version: string;
  readonly license: string;
}
export interface AssetSetupResult {
  readonly assets: readonly LocatedAsset[];
  readonly summary: ReadinessSummary;
  /** Present only after complete SQLite/core validation; no partial graph. */
  readonly pack?: Pack;
  readonly canRoute: boolean;
  /** Asset readiness only; phone/model/map execution gates are separate. */
  readonly allAssetsReady: boolean;
}

function failure(asset: LocatedAsset, reason: FailureReason, detail: string): LocatedAsset {
  return { ...asset, state: "failed", reason, detail };
}
function initial(spec: AssetSpec, baseDir: string): LocatedAsset {
  return {
    assetId: spec.assetId, kind: spec.kind, bundleUri: spec.bundlePath,
    filePath: joinAssetPath(baseDir, spec.bundlePath),
    version: spec.version, sha256: "", bytes: null, state: "verifying", license: spec.license,
  };
}
function specIssue(spec: AssetSpec): LoaderIssue | undefined {
  if (findForbiddenMarker(spec.bundlePath)) return { reason: "raw_dataset_path", detail: "Curation/training input is forbidden as an asset." };
  const entry = entryForBundlePath(spec.bundlePath);
  if (!entry || entry.kind !== spec.kind || (entry.kind !== "glyphs" && entry.assetId !== spec.assetId)
    || (entry.kind === "glyphs" && !spec.assetId.startsWith(`${entry.assetId}:`))) {
    return { reason: "allowlist", detail: "Asset path, kind or ID is outside the explicit shipping policy." };
  }
  if (!isMeasuredSha256(spec.sha256)) return { reason: "bad_hash_format", detail: "A measured SHA-256 is required; placeholder pins are rejected." };
  if (!Number.isSafeInteger(spec.bytes) || spec.bytes <= 0 || !spec.version.trim() || /synthetic|stub|tbd|unknown/i.test(spec.version)) {
    return { reason: "manifest", detail: "Pin a positive byte count and an actual asset revision." };
  }
  if (!spec.license.trim()) return { reason: "licence", detail: "Record a redistribution/attribution reference before setup." };
  return undefined;
}
async function verifyFile(files: LocalFilePort, uri: string, spec: AssetSpec): Promise<LocatedAsset["state"] | "checksum"> {
  const stat = await files.stat(uri);
  if (!stat.exists) return "missing";
  if (stat.bytes !== spec.bytes) return "checksum";
  const sha = await files.sha256(uri);
  return isMeasuredSha256(sha) && sha === spec.sha256 ? "ready" : "checksum";
}
async function installOne(spec: AssetSpec, baseDir: string, ports: AssetPorts): Promise<LocatedAsset> {
  let asset = initial(spec, baseDir);
  try {
    const measured = await ports.files.stat(asset.filePath);
    asset = { ...asset, bytes: measured.exists ? measured.bytes ?? null : 0 };
    const present = await verifyFile(ports.files, asset.filePath, spec);
    if (present !== "ready") {
      const source = await ports.bundle.resolve(spec.bundlePath);
      if (source === null) return {
        ...asset, state: present === "checksum" ? "failed" : "missing",
        reason: present === "checksum" ? "checksum" : "missing",
        detail: present === "checksum" ? "Installed copy is damaged and the bundled repair file is absent." : "Required file is not embedded in this APK.",
      };
      if (!isLocalFileUri(source)) return failure(asset, "network_source", "Bundle resolver returned a non-local path; no download is permitted.");
      const bundled = await verifyFile(ports.files, source, spec);
      if (bundled !== "ready") return {
        ...asset, state: bundled === "missing" ? "missing" : "failed",
        reason: bundled === "missing" ? "missing" : "checksum", detail: "APK file is absent or does not match the pinned bytes and SHA-256.",
      };
      await ports.files.copy(source, asset.filePath);
      if (await verifyFile(ports.files, asset.filePath, spec) !== "ready") {
        return failure(asset, "checksum", "Copied file failed verification; it will not be opened.");
      }
    }
    asset = { ...asset, state: "ready", sha256: spec.sha256, bytes: spec.bytes };
    return asset;
  } catch { return failure(asset, "io", "Local asset I/O failed; retry from the bundled file or replace the app."); }
}
const MAX_TEXT_BYTES = 1024 * 1024;

/** Audit resource-bearing style fields, allowing HTTP attribution links as text. */
export function assertNoOnlineResources(text: string, _where = "style"): LoaderIssue[] {
  const fail = (reason: FailureReason, detail: string) => [{ reason, detail }];
  let style: Record<string, unknown>;
  try {
    const value: unknown = JSON.parse(text);
    if (!value || typeof value !== "object" || Array.isArray(value)) return fail("map_asset", "Map style must be an object.");
    style = value as Record<string, unknown>;
  } catch { return fail("map_asset", "Map style is not valid JSON."); }
  const local = (value: unknown): boolean => typeof value === "string" && (
    isLocalFileUri(value.replaceAll("{fontstack}", "font").replaceAll("{range}", "0-255").replaceAll("{z}", "0").replaceAll("{x}", "0").replaceAll("{y}", "0"))
    || (value.startsWith("pmtiles://") && isLocalFileUri(value.slice(10)))
  );
  if (style.version !== 8 || !style.sources || typeof style.sources !== "object" || Array.isArray(style.sources) || !Array.isArray(style.layers)) {
    return fail("map_asset", "Map style version, sources or layers are invalid.");
  }
  const resources: unknown[] = [];
  if (style.glyphs !== undefined) resources.push(style.glyphs);
  if (style.sprite !== undefined) {
    if (Array.isArray(style.sprite)) resources.push(...style.sprite.map(s => (s as { url?: unknown } | null)?.url));
    else resources.push(style.sprite);
  }
  // Imported styles/config fragments could introduce unaudited dependencies.
  if (style.imports !== undefined) return fail("network_source", "Imported map styles are not supported by the local asset policy.");
  for (const source of Object.values(style.sources)) {
    if (!source || typeof source !== "object" || Array.isArray(source)) return fail("map_asset", "Invalid map source.");
    const s = source as Record<string, unknown>;
    if (s.url !== undefined) resources.push(s.url);
    if (s.tiles !== undefined) {
      if (!Array.isArray(s.tiles) || s.tiles.length === 0) return fail("map_asset", "Invalid tiles list.");
      resources.push(...s.tiles);
    }
    if (s.type === "geojson" && typeof s.data === "string") resources.push(s.data);
    if (s.type === "image") resources.push(s.url);
    if (s.type === "video") return fail("network_source", "Video map sources are not supported.");
  }
  return resources.every(local) ? [] : fail("network_source", "Every map resource must use a local file; remote and relative resources are rejected.");
}

/** Setup is serialized per call; the app must await it before native consumers start. */
export async function setupLocalAssets(input: {
  baseDir: string; catalog: readonly AssetSpec[]; ports: AssetPorts;
}): Promise<AssetSetupResult> {
  const assets: LocatedAsset[] = [];
  const ids = new Set<string>();
  const paths = new Set<string>();
  const invalid = new Map<AssetSpec, LoaderIssue>();
  for (const spec of input.catalog) {
    const issue = specIssue(spec);
    if (issue) invalid.set(spec, issue);
    if (ids.has(spec.assetId) || paths.has(spec.bundlePath)) {
      invalid.set(spec, { reason: "allowlist", detail: "Duplicate catalog ID or path." });
      for (const prior of input.catalog) if (prior.assetId === spec.assetId || prior.bundlePath === spec.bundlePath) {
        invalid.set(prior, { reason: "allowlist", detail: "Duplicate catalog ID or path." });
      }
    }
    ids.add(spec.assetId); paths.add(spec.bundlePath);
  }
  const localRoot = isLocalFileUri(input.baseDir);
  for (const spec of input.catalog) {
    const issue = invalid.get(spec);
    if (!localRoot || issue) assets.push(failure(initial(spec, input.baseDir), issue?.reason ?? "network_source", issue?.detail ?? "Install root must be a local file URI."));
    else assets.push(await installOne(spec, input.baseDir, input.ports));
  }
  // Missing final pins are explicit, even when a catalog contains only a test pack.
  for (const entry of ALLOWLIST) {
    if (input.catalog.some(spec => entryForBundlePath(spec.bundlePath)?.assetId === entry.assetId)) continue;
    assets.push({
      assetId: entry.assetId, kind: entry.kind, bundleUri: entry.bundlePath, filePath: "",
      version: "unknown", sha256: "", bytes: 0, license: entry.licenceRef, state: "missing",
      reason: "missing", detail: "Final asset and measured pins have not been supplied.",
    });
  }
  const overlay = (id: string, issue: LoaderIssue) => {
    const index = assets.findIndex(asset => asset.assetId === id);
    const asset = assets[index];
    if (asset) assets[index] = failure(asset, issue.reason, issue.detail);
  };
  const packAsset = assets.find(asset => asset.assetId === "A1-pack-db");
  const companionAsset = assets.find(asset => asset.assetId === "A2-pack-manifest");
  let pack: Pack | undefined;
  if (packAsset?.state === "ready" && companionAsset?.state === "ready") {
    try {
      if (companionAsset.bytes === null || companionAsset.bytes > MAX_TEXT_BYTES) throw new Error("oversized companion");
      const companion = parsePackCompanion(await input.ports.files.readText(companionAsset.filePath));
      if (!companion.ok) {
        overlay("A2-pack-manifest", companion.error); overlay("A1-pack-db", companion.error);
      } else if (companion.value.pack_sha256 !== packAsset.sha256 || companion.value.pack_bytes !== packAsset.bytes
        || companion.value.pack_id !== packAsset.version || companionAsset.version !== packAsset.version) {
        const issue: LoaderIssue = { reason: "manifest", detail: "External companion disagrees with pinned pack identity, bytes or hash." };
        overlay("A1-pack-db", issue); overlay("A2-pack-manifest", issue);
      } else {
        const loaded = await readValidatedPack(packAsset.filePath, companion.value, input.ports.sqlite);
        if (loaded.ok) pack = loaded.value;
        else overlay("A1-pack-db", loaded.error);
      }
    } catch {
      const issue: LoaderIssue = { reason: "io", detail: "Verified companion could not be read within the text budget." };
      overlay("A1-pack-db", issue); overlay("A2-pack-manifest", issue);
    }
  } else if (packAsset?.state === "ready") {
    overlay("A1-pack-db", { reason: "manifest", detail: "Pack cannot open without a verified external companion." });
  }
  const style = assets.find(asset => asset.assetId === "A6-map-style");
  if (style?.state === "ready") {
    try {
      if (style.bytes === null || style.bytes > MAX_TEXT_BYTES) throw new Error("oversized style");
      const issue = assertNoOnlineResources(await input.ports.files.readText(style.filePath))[0];
      if (issue) overlay(style.assetId, issue);
    } catch { overlay(style.assetId, { reason: "map_asset", detail: "Verified style could not be read within the text budget." }); }
  }
  const summary = summarizeReadiness(assets);
  return { assets, summary, ...(pack ? { pack } : {}), canRoute: pack !== undefined, allAssetsReady: summary.state === "ready" && pack !== undefined };
}

/** Retain already validated in-memory cards on setup failure; never use them to create a new route. */
export function retainValidCards(result: AssetSetupResult, current: { packId: string; packSha256: string; cards: readonly Card[] }): readonly Card[] {
  if (!isMeasuredSha256(current.packSha256)) return [];
  if (!result.pack) return current.cards;
  const packFile = result.assets.find(asset => asset.assetId === "A1-pack-db");
  return result.pack?.manifest.pack_id === current.packId && packFile?.state === "ready"
    && packFile.sha256 === current.packSha256 ? current.cards : [];
}
