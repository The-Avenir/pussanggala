import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { copyFileSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { copyFile, mkdir, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { compose, route } from "@pusang-gala/core";
import { setupLocalAssets, retainValidCards, runValidationPipeline, syntheticPinnedAssets, syntheticSnapshotsPresent } from "../../../apps/mobile/src/assets/loader";
import type { AssetSpec } from "../../../apps/mobile/src/assets/loader";
import type { AssetPorts } from "../../../apps/mobile/src/assets/ports";
import { parsePackCompanion } from "../../../apps/mobile/src/assets/pack-loader";
import { isLocalFileUri } from "../../../apps/mobile/src/assets/paths";
import { isAllowlisted, findForbiddenMarker } from "../../../apps/mobile/src/assets/allowlist";
import { recordFootprint } from "../../../apps/mobile/src/assets/readiness";
import * as production from "../../../apps/mobile/src/assets/index";

let fixtureRoot: string;
let sequence = 0;
const sha = (path: string) => createHash("sha256").update(readFileSync(path)).digest("hex");
const uri = (path: string) => pathToFileURL(path).href;
beforeAll(async () => {
  fixtureRoot = mkdtempSync(join(tmpdir(), "pusang-gala-t41-"));
  // Consume the checked-in builder and synthetic inputs; no real data is accepted here.
  const { build } = await import(pathToFileURL(resolve("tools/pack-builder/build.mjs")).href);
  build({
    eligibleDir: resolve("tools/pack-builder/fixtures/eligible"),
    dispositions: resolve("tools/pack-builder/fixtures/dispositions.json"),
    run: resolve("tools/pack-builder/fixtures/run.json"),
    rawDatasetPath: resolve("tools/pack-builder/fixtures/raw-dataset.json"), outDir: join(fixtureRoot, "built"),
  });
});
afterAll(() => { if (fixtureRoot) rmSync(fixtureRoot, { recursive: true, force: true }); });

function makeCase() {
  const root = join(fixtureRoot, `case-${++sequence}`);
  const source = join(root, "source");
  // Write only under this test's newly allocated temp directory.
  const packPath = join(source, "pack.sqlite");
  const companionPath = join(source, "pack.manifest.json");
  const events: string[] = [];
  const registry = new Map<string, string>();
  const catalog: AssetSpec[] = [];
  const populate = async () => {
    await mkdir(source, { recursive: true });
    copyFileSync(join(fixtureRoot, "built/pack.sqlite"), packPath);
    copyFileSync(join(fixtureRoot, "built/pack.manifest.json"), companionPath);
    repin();
  };
  function repin() {
    const companion = JSON.parse(readFileSync(companionPath, "utf8"));
    companion.pack_sha256 = sha(packPath);
    companion.pack_bytes = statSync(packPath).size;
    companion.assets[0].sha256 = companion.pack_sha256;
    companion.assets[0].bytes = companion.pack_bytes;
    writeFileSync(companionPath, JSON.stringify(companion));
    catalog.splice(0, catalog.length,
      { assetId: "A1-pack-db", bundlePath: "assets/pack/pack.sqlite", kind: "pack", sha256: sha(packPath), bytes: statSync(packPath).size, version: companion.pack_id, license: "Fixture-only; not for redistribution." },
      { assetId: "A2-pack-manifest", bundlePath: "assets/pack/pack.manifest.json", kind: "pack", sha256: sha(companionPath), bytes: statSync(companionPath).size, version: companion.pack_id, license: "Fixture-only; not for redistribution." },
    );
    registry.set(catalog[0]!.bundlePath, uri(packPath));
    registry.set(catalog[1]!.bundlePath, uri(companionPath));
  }
  function mutateCompanion(change: (companion: Record<string, any>) => void) {
    const companion = JSON.parse(readFileSync(companionPath, "utf8"));
    change(companion); writeFileSync(companionPath, JSON.stringify(companion));
    catalog[1] = { ...catalog[1]!, sha256: sha(companionPath), bytes: statSync(companionPath).size };
  }
  function mutateDb(sql: string) {
    const db = new DatabaseSync(packPath);
    try { db.exec(sql); } finally { db.close(); }
    repin();
  }
  const ports: AssetPorts = {
    files: {
      async stat(path) { try { const s = await stat(fileURLToPath(path)); return { exists: true, bytes: s.size }; } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return { exists: false }; throw error; } },
      async sha256(path) { events.push(`hash:${path}`); return sha(fileURLToPath(path)); },
      async readText(path) { events.push(`text:${path}`); return readFile(fileURLToPath(path), "utf8"); },
      async copy(from, to) { events.push(`copy:${to}`); await mkdir(fileURLToPath(to).replace(/[\\/][^\\/]+$/, ""), { recursive: true }); await copyFile(fileURLToPath(from), fileURLToPath(to)); },
    },
    bundle: { async resolve(path) { return registry.get(path) ?? null; } },
    sqlite: {
      async openReadOnly(path) {
        events.push(`open:${path}`);
        const db = new DatabaseSync(fileURLToPath(path), { readOnly: true });
        return {
          async all(sql) { events.push(`read:${sql}`); return db.prepare(sql).all(); },
          async close() { events.push("close"); db.close(); },
        };
      },
    },
  };
  const baseDir = uri(join(root, "installed"));
  return { root, packPath, companionPath, catalog, ports, baseDir, events, registry, populate, repin, mutateDb, mutateCompanion,
    run: () => setupLocalAssets({ baseDir, catalog, ports }) };
}

describe("actual builder-produced pack through local file and SQLite ports", () => {
  it("hashes both files before open, loads core, routes and reports unprovided final assets as missing", async () => {
    const c = makeCase(); await c.populate(); const result = await c.run();
    expect(result.canRoute).toBe(true);
    expect(result.allAssetsReady).toBe(false);
    expect(result.summary.state).toBe("missing");
    expect(result.assets.find(a => a.assetId === "A3-model-weights")?.state).toBe("missing");
    const firstOpen = c.events.findIndex(e => e.startsWith("open:"));
    expect(c.events.slice(0, firstOpen).filter(e => e.startsWith("hash:"))).toHaveLength(4);
    expect(c.events.at(-1)).toBe("close");
    const trip = route("pl_sample-plaza", "pl_example-market", "balanced", result.pack!);
    expect(trip.status).toBe("ok");
    if (trip.status === "ok") expect(compose(trip.itineraries[0]!, result.pack!, new Date("2026-10-10"))).toHaveLength(3);
    expect(sha(fileURLToPath(result.assets[0]!.filePath))).toBe(c.catalog[0]!.sha256);
  });
  it("re-hashes an existing private copy without resolving or copying the bundle", async () => {
    const c = makeCase(); await c.populate(); await c.run(); c.events.length = 0;
    c.ports.bundle.resolve = async () => { throw new Error("Resolver must not be used."); };
    expect((await c.run()).canRoute).toBe(true);
    expect(c.events.filter(e => e.startsWith("copy:"))).toHaveLength(0);
    expect(c.events.filter(e => e.startsWith("hash:"))).toHaveLength(2);
  });
  it("fresh-install missing file stays missing and is never opened", async () => {
    const c = makeCase(); await c.populate(); c.registry.delete("assets/pack/pack.sqlite");
    const result = await c.run(); expect(result.canRoute).toBe(false);
    expect(result.assets[0]?.state).toBe("missing"); expect(c.events.some(e => e.startsWith("open:"))).toBe(false);
  });
  it("rejects a same-size damaged bundle against independently pinned hashes", async () => {
    const c = makeCase(); await c.populate(); const bytes = readFileSync(c.packPath); bytes[200] = bytes[200]! ^ 1; writeFileSync(c.packPath, bytes);
    const result = await c.run(); expect(result.assets[0]?.reason).toBe("checksum"); expect(result.canRoute).toBe(false);
    expect(c.events.some(e => e.startsWith("open:"))).toBe(false);
  });
  it("repairs a damaged private copy from the verified bundle", async () => {
    const c = makeCase(); await c.populate(); const first = await c.run();
    writeFileSync(fileURLToPath(first.assets[0]!.filePath), "truncated"); c.events.length = 0;
    expect((await c.run()).canRoute).toBe(true); expect(c.events.filter(e => e.startsWith("copy:"))).toHaveLength(1);
  });
  it("damaged private copy with no bundled repair is failed, rather than missing", async () => {
    const c = makeCase(); await c.populate(); const first = await c.run();
    writeFileSync(fileURLToPath(first.assets[0]!.filePath), "truncated"); c.registry.clear();
    const result = await c.run(); expect(result.assets[0]?.state).toBe("failed"); expect(result.assets[0]?.reason).toBe("checksum");
  });
  it("checks the copied bytes again and never opens a failed copy", async () => {
    const c = makeCase(); await c.populate(); const copy = c.ports.files.copy;
    c.ports.files.copy = async (from, to) => { await copy(from, to); if (to.endsWith(".sqlite")) writeFileSync(fileURLToPath(to), "damaged"); };
    const result = await c.run(); expect(result.assets[0]?.reason).toBe("checksum"); expect(c.events.some(e => e.startsWith("open:"))).toBe(false);
  });
  it.each([2, "t41.stub.v0", "1", null])("rejects unsupported companion schema %s before SQLite open", async version => {
    const c = makeCase(); await c.populate(); c.mutateCompanion(m => { m.schema_version = version; });
    const result = await c.run(); expect(result.assets[0]?.reason).toBe("schema"); expect(c.events.some(e => e.startsWith("open:"))).toBe(false);
  });
  it("checks SQLite user_version even with valid external hashes", async () => {
    const c = makeCase(); await c.populate(); c.mutateDb("PRAGMA user_version = 2");
    const result = await c.run(); expect(result.assets[0]?.reason).toBe("schema"); expect(c.events.at(-1)).toBe("close");
  });
  it("rejects non-SQLite bytes even when intentionally pinned", async () => {
    const c = makeCase(); await c.populate(); writeFileSync(c.packPath, "This is a fixture, not SQLite."); c.repin();
    expect((await c.run()).assets[0]?.reason).toBe("pack_invalid");
  });
  it("checks foreign keys before core publication", async () => {
    const c = makeCase(); await c.populate(); c.mutateDb("PRAGMA foreign_keys = OFF; UPDATE leg SET board_stop_id = 'st_missing' WHERE leg_id = 'lg_violet-1'");
    const result = await c.run(); expect(result.pack).toBeUndefined(); expect(result.assets[0]?.reason).toBe("pack_invalid");
  });
  it("uses core provenance validation rather than treating SQL integrity as sufficient", async () => {
    const c = makeCase(); await c.populate(); c.mutateDb("DELETE FROM record_source WHERE record_kind = 'leg' AND record_id = 'lg_violet-1'");
    const result = await c.run(); expect(result.pack).toBeUndefined(); expect(result.assets[0]?.reason).toBe("pack_invalid");
    expect(result.assets[0]?.detail).toContain("Core rejected");
  });
  it("rejects an internal manifest that differs from the verified companion", async () => {
    const c = makeCase(); await c.populate(); c.mutateDb("UPDATE pack_manifest SET stale_after_days = 7");
    expect((await c.run()).assets[0]?.reason).toBe("manifest");
  });
  it("rejects companion post counts and binding disagreements before open", async () => {
    const c = makeCase(); await c.populate(); c.mutateCompanion(m => { m.manifest.included_posts += 1; });
    const result = await c.run(); expect(result.assets[0]?.reason).toBe("manifest"); expect(c.events.some(e => e.startsWith("open:"))).toBe(false);
  });
  it("binds companion checksum and sizes to the independently measured pack pin", async () => {
    const c = makeCase(); await c.populate(); c.mutateCompanion(m => { m.pack_bytes += 1; m.assets[0].bytes = m.pack_bytes; });
    const result = await c.run(); expect(result.assets[0]?.reason).toBe("manifest"); expect(c.events.some(e => e.startsWith("open:"))).toBe(false);
  });
  it("read errors are typed, close the DB and do not echo exception contents", async () => {
    const c = makeCase(); await c.populate(); const open = c.ports.sqlite.openReadOnly;
    c.ports.sqlite.openReadOnly = async path => { const db = await open(path); return { ...db, async all() { throw new Error("sensitive fixture query text"); } }; };
    const result = await c.run(); expect(result.canRoute).toBe(false); expect(c.events.at(-1)).toBe("close");
    expect(JSON.stringify(result)).not.toContain("sensitive fixture");
  });
  it("cleanup failure prevents ready publication", async () => {
    const c = makeCase(); await c.populate(); const open = c.ports.sqlite.openReadOnly;
    c.ports.sqlite.openReadOnly = async path => { const db = await open(path); return { ...db, async close() { await db.close(); throw new Error("close failure"); } }; };
    const result = await c.run(); expect(result.canRoute).toBe(false); expect(result.assets[0]?.reason).toBe("io");
  });
  it("keeps valid cards usable despite missing model/map assets and rejects a different pack ID", async () => {
    const c = makeCase(); await c.populate(); const result = await c.run();
    const trip = route("pl_sample-plaza", "pl_example-market", "balanced", result.pack!);
    if (trip.status !== "ok") throw new Error("Fixture route did not load.");
    const cards = compose(trip.itineraries[0]!, result.pack!, new Date("2026-10-10"));
    const packSha256 = c.catalog[0]!.sha256;
    expect(retainValidCards(result, { packId: result.pack!.manifest.pack_id, packSha256, cards })).toBe(cards);
    expect(retainValidCards(result, { packId: "other_pack", packSha256, cards })).toEqual([]);
    expect(retainValidCards(result, { packId: result.pack!.manifest.pack_id, packSha256: "changed-hash", cards })).toEqual([]);
    c.ports.files.stat = async () => { throw new Error("disk unavailable"); };
    const failed = await c.run(); expect(failed.canRoute).toBe(false);
    expect(retainValidCards(failed, { packId: result.pack!.manifest.pack_id, packSha256, cards })).toBe(cards);
  });
  it("no final catalog produces only missing readiness, without I/O or a synthetic fallback", async () => {
    const c = makeCase(); c.catalog.length = 0;
    const result = await c.run(); expect(result.summary.state).toBe("missing"); expect(result.summary.ready).toBe(0);
    expect(result.canRoute).toBe(false); expect(c.events).toEqual([]);
    const demo = runValidationPipeline({ baseDir: "SYNTHETIC-base", files: syntheticSnapshotsPresent(), pinned: syntheticPinnedAssets() });
    expect(demo.some(asset => asset.state === "ready")).toBe(false);
  });
  it("placeholder pins are rejected even if a snapshot advertises a matching hash", async () => {
    const c = makeCase(); await c.populate(); c.catalog[0] = { ...c.catalog[0]!, sha256: "0123456789abcdef".repeat(4) };
    const result = await c.run(); expect(result.assets[0]?.reason).toBe("bad_hash_format"); expect(result.canRoute).toBe(false);
  });
  it("rejects duplicate catalog entries without opening their pack", async () => {
    const c = makeCase(); await c.populate(); c.catalog.push({ ...c.catalog[0]! });
    const result = await c.run(); expect(result.assets[0]?.reason).toBe("allowlist"); expect(result.canRoute).toBe(false);
  });
  it("never accesses a remote bundle URI", async () => {
    const c = makeCase(); await c.populate(); c.registry.set(c.catalog[0]!.bundlePath, "https://example.invalid/pack.sqlite");
    const result = await c.run(); expect(result.assets[0]?.reason).toBe("network_source");
    expect(c.events.some(e => e.includes("https:"))).toBe(false);
  });
  it("local-root validation happens before I/O", async () => {
    const c = makeCase(); await c.populate();
    const result = await setupLocalAssets({ baseDir: "https://example.invalid/", catalog: c.catalog, ports: c.ports });
    expect(result.assets[0]?.reason).toBe("network_source"); expect(c.events).toEqual([]);
  });
  it("stat errors preserve unknown byte counts and an explicit failed state", async () => {
    const c = makeCase(); await c.populate(); c.ports.files.stat = async () => { throw new Error("stat failed"); };
    const result = await c.run(); expect(result.assets[0]?.state).toBe("failed"); expect(result.assets[0]?.bytes).toBeNull(); expect(result.canRoute).toBe(false);
  });
  it("companion read failure prevents schema readiness and leaves both files failed", async () => {
    const c = makeCase(); await c.populate(); c.ports.files.readText = async () => { throw new Error("read failed"); };
    const result = await c.run(); expect(result.assets[0]?.reason).toBe("io"); expect(result.assets[1]?.reason).toBe("io");
    expect(c.events.some(e => e.startsWith("open:"))).toBe(false);
  });
  it("model/map failures preserve the separately validated pack", async () => {
    const c = makeCase(); await c.populate();
    c.catalog.push({ assetId: "A3-model-weights", bundlePath: "assets/model/qwen2.5-0.5b-instruct-q4_0.gguf", kind: "model", sha256: createHash("sha256").update("fixture model").digest("hex"), bytes: 13, version: "fixture-revision", license: "Test only" });
    c.registry.set(c.catalog[2]!.bundlePath, "https://example.invalid/model");
    const result = await c.run(); expect(result.assets[2]?.state).toBe("failed"); expect(result.canRoute).toBe(true); expect(result.summary.state).toBe("failed");
  });
});

describe("asset policy, local paths and honest measurements", () => {
  it("production entry exposes no synthetic fixtures or snapshot-only startup", () => {
    expect("syntheticPinnedAssets" in production).toBe(false); expect("runValidationPipeline" in production).toBe(false);
  });
  it.each(["assets/map/glyphs/../pack.sqlite", "assets/map/glyphs/font/candidates.json", "assets/map/glyphs/data/raw/0-255.pbf", "assets/map/glyphs/HOWTOGETTHEREPH_DATASET/0-255.pbf", "assets/map/glyphs/font/raw-dataset.pbf", "assets/pack/other.sqlite", "assets/map/glyphs/font/0-255.pbf?url=https://x", "assets/map/glyphs/%2e%2e/0-255.pbf"])("rejects unapproved/raw/traversal bundle path %s", value => {
    expect(isAllowlisted(value)).toBe(false);
  });
  it("pins glyphs by individual PBF file and recognizes raw path case/separator variants", () => {
    expect(isAllowlisted("assets/map/glyphs/Fixture Font/0-255.pbf")).toBe(true);
    expect(isAllowlisted("assets/map/glyphs/")).toBe(false);
    expect(findForbiddenMarker("ASSETS\\DATA\\RAW\\copy.bin")).toBe("data/raw");
  });
  it.each(["http://example.invalid/a", "//host/a", "file://host/a", "file:////host/share", "C:/a", "file:///a/../b", "file:///a/%2e%2e/b", "file:///a/%2F/b", "file:///a?x=y", "content://provider/a", "file:///a/%2500/b"])("rejects nonlocal/traversal file URI %s", value => {
    expect(isLocalFileUri(value)).toBe(false);
  });
  it("accepts a native local path with encoded spaces", () => { expect(isLocalFileUri("file:///data/user/0/Fixture%20App/pack.sqlite")).toBe(true); });
  it.each(["null", "[]", "{}", "invalid", '{"schema_version":1,"manifest":null}'])("fails malformed companions %s", value => {
    expect(parsePackCompanion(value).ok).toBe(false);
  });
  it("footprint leaves unmeasured fields unknown and never infers physical duplication", () => {
    const report = recordFootprint({ copied: [{ name: "actual fixture", bytes: 42 }], recordedAt: "fixture" });
    expect(report.copiedBytes).toBe(42); expect(report.totalBytes).toBeNull(); expect(report.apkBytes).toBeNull(); expect(report.duplicatedBytes).toBeNull();
    expect(recordFootprint({ apkBytes: 100, copied: [{ name: "file", bytes: 42 }], userBytes: 5 }).totalBytes).toBe(147);
  });
  it.each([-1, NaN, Infinity, 1.5])("rejects fabricated/invalid byte measurement %s", bytes => {
    expect(() => recordFootprint({ apkBytes: bytes })).toThrow();
  });
});
