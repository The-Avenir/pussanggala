import { describe, expect, it } from "vitest";
import {
  loadPack,
  type Pack,
  type PackIssue,
  type RawPackTables,
} from "../src/index";
import { minimalRawPack } from "./fixtures/minimal-pack";

function mustLoad(raw: RawPackTables): Pack {
  const result = loadPack(raw);
  if (!result.ok) {
    throw new Error(`expected ok, got issues: ${JSON.stringify(result.error)}`);
  }
  return result.value;
}

function codes(raw: RawPackTables): string[] {
  const result = loadPack(raw);
  if (result.ok) {
    throw new Error("expected issues, pack loaded ok");
  }
  return result.error.map((issue) => issue.code);
}

const rows = (list: unknown[]) => list as Record<string, unknown>[];

describe("loadPack — valid pack", () => {
  const pack = mustLoad(minimalRawPack());

  it("indexes fares, provenance, ambiguities and place stops", () => {
    expect(pack.manifest.pack_id).toBe("pack_demo-001");
    expect(pack.places.size).toBe(4);
    expect(pack.faresByLeg.get("lg_demo-1")?.map((f) => f.fare_id)).toEqual([
      "fr_demo-1a",
      "fr_demo-1b",
    ]);
    expect(pack.faresByLeg.has("lg_demo-2")).toBe(false);
    expect(pack.ambiguitiesByNorm.get("demo center")).toEqual([
      "pl_demo-market",
      "pl_demo-plaza",
    ]);
    expect(pack.placeStopsByPlace.get("pl_demo-plaza")?.length).toBe(1);
    expect(pack.noteIdsByLeg.get("lg_demo-1")).toEqual(["nt_demo-1"]);
    expect(
      pack.sourcesByRecord.get("leg:lg_demo-1")?.map((r) => r.source_id),
    ).toEqual(["src_thread-1"]);
    expect(pack.aliasesByNorm.get("santa demo plaza")?.place_id).toBe(
      "pl_demo-plaza",
    );
  });

  it("keeps an excluded leg without provenance", () => {
    expect(pack.legs.get("lg_demo-x")?.eligibility).toBe("excluded");
    expect(pack.sourcesByRecord.has("leg:lg_demo-x")).toBe(false);
  });
});

describe("loadPack — issue codes", () => {
  it("schema_incompatible on wrong schema_version (returns early)", () => {
    const raw = minimalRawPack();
    raw.manifest = {
      ...(raw.manifest as Record<string, unknown>),
      schema_version: 99,
    };
    expect(codes(raw)).toEqual(["schema_incompatible"]);
  });

  it("row_invalid on a bad enum", () => {
    const raw = minimalRawPack();
    rows(raw.places)[0]!.ncr_status = "bogus";
    expect(codes(raw)).toContain("row_invalid");
  });

  it("duplicate_id on a repeated PK", () => {
    const raw = minimalRawPack();
    raw.places.push({ ...rows(raw.places)[0] });
    expect(codes(raw)).toContain("duplicate_id");
  });

  it("dangling_fk on a missing stop", () => {
    const raw = minimalRawPack();
    rows(raw.legs)[0]!.board_stop_id = "st_missing";
    expect(codes(raw)).toContain("dangling_fk");
  });

  it("missing_provenance on a ready leg without record_source", () => {
    const raw = minimalRawPack();
    raw.record_sources = rows(raw.record_sources).filter(
      (r) => !(r.record_kind === "leg" && r.record_id === "lg_demo-1"),
    );
    expect(codes(raw)).toContain("missing_provenance");
  });

  it("alias_not_normalized when alias_norm differs from normalize(display)", () => {
    const raw = minimalRawPack();
    rows(raw.place_aliases)[0]!.alias_norm = "not normalized";
    expect(codes(raw)).toContain("alias_not_normalized");
  });

  it("alias_conflict on a duplicated alias_norm", () => {
    const raw = minimalRawPack();
    raw.place_aliases.push({
      alias_id: 99,
      place_id: "pl_demo-market",
      alias_norm: "demo plaza",
      alias_display: "Demo Plaza",
    });
    expect(codes(raw)).toContain("alias_conflict");
  });

  it("ambiguity_too_few on a single-candidate ambiguity", () => {
    const raw = minimalRawPack();
    raw.place_ambiguities = rows(raw.place_ambiguities).slice(0, 1);
    expect(codes(raw)).toContain("ambiguity_too_few");
  });

  it("source_path_without_geometry_source on reddit-only evidence", () => {
    const raw = minimalRawPack();
    rows(raw.shapes)[0]!.geometry_kind = "source_path";
    expect(codes(raw)).toContain("source_path_without_geometry_source");
  });

  it("manifest_counts_mismatch on unreconciled dispositions", () => {
    const raw = minimalRawPack();
    raw.manifest = {
      ...(raw.manifest as Record<string, unknown>),
      rejected_posts: 4,
    };
    expect(codes(raw)).toContain("manifest_counts_mismatch");
  });

  it("aggregates distinct problems", () => {
    const raw = minimalRawPack();
    rows(raw.legs)[0]!.board_stop_id = "st_missing";
    raw.manifest = {
      ...(raw.manifest as Record<string, unknown>),
      rejected_posts: 4,
    };
    const found = codes(raw);
    expect(found).toContain("dangling_fk");
    expect(found).toContain("manifest_counts_mismatch");
  });

  it("issues carry table and rowIndex in deterministic order", () => {
    const raw = minimalRawPack();
    rows(raw.legs)[0]!.board_stop_id = "st_missing";
    const result = loadPack(raw);
    if (result.ok) {
      throw new Error("expected issues");
    }
    const issue: PackIssue = result.error[0]!;
    expect(issue.table).toBe("legs");
    expect(issue.rowIndex).toBe(0);
    expect(issue.id).toBe("st_missing");
  });
});
