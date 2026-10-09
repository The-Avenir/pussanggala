import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { createExpoAssetPorts } from "../../../apps/mobile/src/adapters/assets/expo";
import type { ExpoAssetBindings } from "../../../apps/mobile/src/adapters/assets/expo";
import { assertNoOnlineResources } from "../../../apps/mobile/src/assets/setup";

describe("local map resource audit", () => {
  const style = (source: Record<string, unknown>) => JSON.stringify({ version: 8, sources: { fixture: source }, layers: [] });
  it.each(["https://tiles.invalid/tiles.json", "//tiles.invalid/a", "mapbox://tiles", "tiles.json", "data:application/json,{}", "file://host/tiles"])("rejects source URL %s", url => {
    expect(assertNoOnlineResources(style({ type: "vector", url }))[0]?.reason).toBe("network_source");
  });
  it("audits tile arrays, glyphs, sprite arrays and external GeoJSON", () => {
    expect(assertNoOnlineResources(style({ type: "raster", tiles: ["https://tiles.invalid/{z}/{x}/{y}.png"] }))).toHaveLength(1);
    expect(assertNoOnlineResources(style({ type: "geojson", data: "https://tiles.invalid/facts.json" }))).toHaveLength(1);
    expect(assertNoOnlineResources(JSON.stringify({ version: 8, sources: {}, layers: [], glyphs: "https://fonts.invalid/{fontstack}/{range}.pbf" }))).toHaveLength(1);
    expect(assertNoOnlineResources(JSON.stringify({ version: 8, sources: {}, layers: [], sprite: [{ id: "default", url: "https://tiles.invalid/sprite" }] }))).toHaveLength(1);
  });
  it("permits local resource templates and HTTP attribution text", () => {
    expect(assertNoOnlineResources(style({ type: "vector", url: "pmtiles://file:///data/private/ncr.pmtiles", attribution: "Credits: https://attribution.invalid/" }))).toEqual([]);
    expect(assertNoOnlineResources(JSON.stringify({ version: 8, sources: {}, layers: [], glyphs: "file:///data/fonts/{fontstack}/{range}.pbf", sprite: "file:///data/sprite" }))).toEqual([]);
  });
  it.each(["null", "[]", "{}", "invalid"])("rejects malformed style %s", text => { expect(assertNoOnlineResources(text)[0]?.reason).toBe("map_asset"); });
  it("rejects imported styles so they cannot bring an unaudited remote dependency", () => {
    expect(assertNoOnlineResources(JSON.stringify({ version: 8, sources: {}, layers: [], imports: [{ url: "https://styles.invalid/a" }] }))[0]?.reason).toBe("network_source");
  });
});

/** Structural test doubles for the documented APIs, not native execution evidence. */
function bindingsFixture() {
  const files = new Map<string, Buffer>();
  const events: string[] = [];
  const queries: string[] = [];
  class File {
    constructor(readonly uri: string) {}
    get exists() { return files.has(this.uri); }
    get size() { return files.get(this.uri)?.length ?? 0; }
    parentDirectory = { create: (_options: unknown) => { events.push("mkdir"); } };
    async text() { return files.get(this.uri)!.toString("utf8"); }
    copy(destination: File) { files.set(destination.uri, Buffer.from(files.get(this.uri)!)); events.push("copy"); }
    delete() { files.delete(this.uri); events.push("delete"); }
    open() {
      let offset = 0; const bytes = files.get(this.uri)!;
      return {
        readBytes(length: number) { expect(length).toBeLessThanOrEqual(64 * 1024); const part = bytes.subarray(offset, offset + length); offset += part.length; events.push(`read:${part.length}`); return part; },
        close() { events.push("file-close"); },
      };
    }
  }
  const db = { async execAsync(sql: string) { queries.push(sql); }, async getAllAsync(sql: string) { queries.push(sql); return []; }, async closeAsync() { queries.push("close"); } };
  const bindings: ExpoAssetBindings = {
    File,
    Asset: { fromModule: () => ({ localUri: null }) },
    SQLite: { async openDatabaseAsync(name, options, directory) { expect(name).toBe("pack.sqlite"); expect(options).toEqual({ useNewConnection: true, enableChangeListener: false }); expect(directory).toBe("file:///private"); return db; } },
    createSha256() { const hash = createHash("sha256"); return { update(bytes) { hash.update(bytes); }, digestHex() { return hash.digest("hex"); } }; },
    registry: { fixture: 42, explicit: "file:///bundle/fixture" },
  };
  return { files, events, queries, bindings, db, ports: createExpoAssetPorts(bindings) };
}
describe("Expo binding adapter contract", () => {
  it("hashes incrementally without reading GGUF-sized files into one JS buffer", async () => {
    const c = bindingsFixture(); const bytes = Buffer.alloc(200_000, 17); c.files.set("file:///bundle/fixture", bytes);
    expect(await c.ports.files.sha256("file:///bundle/fixture")).toBe(createHash("sha256").update(bytes).digest("hex"));
    expect(c.events.filter(e => e.startsWith("read:"))).toHaveLength(4); expect(c.events.at(-1)).toBe("file-close");
  });
  it("hash failure still closes the file handle", async () => {
    const c = bindingsFixture(); c.files.set("file:///bundle/fixture", Buffer.alloc(1));
    c.bindings.createSha256 = () => ({ update() { throw new Error("hash failed"); }, digestHex() { return ""; } });
    await expect(c.ports.files.sha256("file:///bundle/fixture")).rejects.toThrow(); expect(c.events.at(-1)).toBe("file-close");
  });
  it("resolves only explicit registry files and never calls Asset downloads", async () => {
    const c = bindingsFixture(); expect(await c.ports.bundle.resolve("absent")).toBeNull();
    expect(await c.ports.bundle.resolve("fixture")).toBeNull(); expect(await c.ports.bundle.resolve("explicit")).toBe("file:///bundle/fixture");
  });
  it("copies locally, preserves source and rejects a nonlocal file before constructing native files", async () => {
    const c = bindingsFixture(); c.files.set("file:///bundle/fixture", Buffer.from("local"));
    await c.ports.files.copy("file:///bundle/fixture", "file:///private/fixture");
    expect(c.files.get("file:///private/fixture")?.toString()).toBe("local"); expect(c.files.get("file:///bundle/fixture")?.toString()).toBe("local");
    await expect(c.ports.files.stat("https://remote.invalid/a")).rejects.toThrow();
  });
  it("uses a separate query-only connection and rejects writes and arbitrary queries", async () => {
    const c = bindingsFixture(); c.files.set("file:///private/pack.sqlite", Buffer.from("fixture"));
    const db = await c.ports.sqlite.openReadOnly("file:///private/pack.sqlite");
    expect(c.queries[0]).toBe("PRAGMA query_only = ON");
    await expect(db.all("DELETE FROM leg")).rejects.toThrow(); await expect(db.all("PRAGMA query_only = OFF")).rejects.toThrow();
    await db.all("PRAGMA user_version"); await db.close(); expect(c.queries).toEqual(["PRAGMA query_only = ON", "PRAGMA user_version", "close"]);
  });
  it("does not create a missing knowledge database", async () => {
    const c = bindingsFixture(); await expect(c.ports.sqlite.openReadOnly("file:///private/pack.sqlite")).rejects.toThrow(); expect(c.queries).toEqual([]);
  });
  it("closes the connection when query_only cannot be set", async () => {
    const c = bindingsFixture(); c.files.set("file:///private/pack.sqlite", Buffer.from("fixture"));
    c.db.execAsync = async () => { throw new Error("pragma failed"); };
    await expect(c.ports.sqlite.openReadOnly("file:///private/pack.sqlite")).rejects.toThrow(); expect(c.queries).toEqual(["close"]);
  });
});
