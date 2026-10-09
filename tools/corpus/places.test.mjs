// node --test tools/corpus/places.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { run, build, checkGazetteer, makeId, ncrStatus, collectUniverse } from "./places.mjs";
import { STABLE_ID_RE } from "../pack-builder/lib/spec.mjs";

const cand = (id, kind, payload, state = "second_passed") => ({
  candidate_id: id,
  snapshot_sha256: "00".repeat(32),
  post_id: "zz0001",
  comment_index: 0,
  record_kind: kind,
  candidate_payload: payload,
  evidence_check: { checks: {}, flags: [] },
  review_reason: null,
  review_state: state,
  reviewer_id: null,
  reviewed_at: null,
});

const GZ = {
  version: 1,
  places: [
    { key: "lantern-plaza", name: "Lantern Plaza interchange", kind: "terminal", area: "Copper district", city: "Makati", aliases: ["lantern plaza", "lantern plaza terminal"], lat: null, lng: null, mapping_source: null },
    { key: "copper-hill", name: "Copper Hill gate", kind: "landmark", area: "North Ridge", city: "Baguio", aliases: ["copper hill"], lat: null, lng: null, mapping_source: null },
    { key: "silent-chapel", name: "Silent Chapel", kind: "landmark", area: "Old town", city: null, aliases: ["silent chapel"], lat: null, lng: null, mapping_source: null },
  ],
  ambiguous_aliases: { "mrt terminus": ["lantern-plaza", "copper-hill"] },
};

const REVIEWED = [
  cand("c_1", "place", { name: "Lantern Plaza", kind: "terminal", area_text: null, city: null, role: "origin" }),
  cand("c_2", "place", { name: "LANTERN plaza", kind: "terminal", area_text: null, city: null, role: "origin" }), // same norm, different spelling
  cand("c_3", "ride", { mode: "jeepney", signboard: null, board_place: "Lantern Plaza", alight_place: "Copper Hill", direction_text: null, ride_min: null }),
  cand("c_4", "walk", { from_place: "Copper Hill", to_place: "Silent Chapel", walk_text: "x", walk_m: null, walk_min: null }),
  cand("c_5", "ride", { mode: "bus", signboard: null, board_place: "Nowhere Siding", alight_place: "MRT terminus", direction_text: null, ride_min: null }),
  cand("c_6", "place", { name: "Rejected Spot", kind: "other", area_text: null, city: null, role: "origin" }, "rejected"),
  cand("c_7", "place", { name: "Overridden Spot", kind: "other", area_text: null, city: null, role: "origin" }, "second_passed"),
];
REVIEWED[6].ai_override = { prior_state: "second_passed", new_state: "needs_review", reason_code: "x", note: "y", judged_at: "z" };

test("place_id is deterministic and matches STABLE_ID_RE", () => {
  for (const k of ["lantern-plaza", "copper-hill", "x".repeat(200), "Weird Key!!"]) {
    const id = makeId(k);
    assert.equal(id, makeId(k));
    assert.ok(STABLE_ID_RE.test(id), `${k} -> ${id}`);
  }
  assert.match(makeId("lantern-plaza"), /^pl_lantern-plaza-[0-9a-f]{6}$/);
});

test("ncr_status accepted / outside / ambiguous", () => {
  assert.equal(ncrStatus("Makati"), "accepted");
  assert.equal(ncrStatus("Las Piñas"), "accepted");
  assert.equal(ncrStatus("Quezon City"), "accepted");
  assert.equal(ncrStatus("Baguio"), "outside");
  assert.equal(ncrStatus(null), "ambiguous");
});

test("alias universe counts, roles, spellings and ai_override handling", () => {
  const uni = collectUniverse(REVIEWED);
  assert.equal(uni.get("lantern plaza").mentions, 3);
  assert.equal(uni.get("lantern plaza").roles.place, 2);
  assert.equal(uni.get("lantern plaza").roles.ride_board, 1);
  assert.equal(uni.get("copper hill").roles.ride_alight, 1);
  assert.equal(uni.get("copper hill").roles.walk_from, 1);
  assert.ok(!uni.has("rejected spot"), "rejected candidate must not enter the universe");
  assert.ok(!uni.has("overridden spot"), "ai_override needs_review must not enter the universe");
});

test("build: places, aliases, ambiguities, unresolved are correct and sorted", () => {
  const r = build(REVIEWED, GZ);
  assert.equal(r.places.length, 3);
  const lp = r.places.find((p) => p.place_key === "lantern-plaza");
  assert.equal(lp.ncr_status, "accepted");
  assert.equal(lp.mapping_status, "unmapped");
  assert.equal(lp.lat, null);
  assert.equal(lp.mention_count, 3);
  assert.equal(lp.alias_count, 2);
  assert.equal(r.places.find((p) => p.place_key === "copper-hill").ncr_status, "outside");
  assert.equal(r.places.find((p) => p.place_key === "silent-chapel").ncr_status, "ambiguous");
  // alias_display = most frequent spelling, tie -> lexicographic
  assert.equal(r.aliases.find((a) => a.alias_norm === "lantern plaza").alias_display, "Lantern Plaza");
  // ambiguous alias excluded from aliases.json, present in ambiguities.json
  assert.ok(!r.aliases.some((a) => a.alias_norm === "mrt terminus"));
  assert.equal(r.ambiguities.filter((a) => a.alias_norm === "mrt terminus").length, 2);
  assert.deepEqual(r.ambiguities.map((a) => a.place_key), ["copper-hill", "lantern-plaza"]);
  // unresolved
  assert.deepEqual(r.unresolved.map((u) => u.alias_norm), ["nowhere siding"]);
  assert.equal(r.unresolved[0].mention_count, 1);
  assert.equal(r.unresolved[0].post_count, 1);
  assert.ok([...new Set(r.aliases.map((a) => a.alias_norm))].length === r.aliases.length, "alias_norm unique");
  assert.equal(r.mentions["lantern plaza"].place, 2);
});

test("each rule-8 gazetteer validation fails", () => {
  const base = structuredClone(GZ);
  assert.doesNotThrow(() => checkGazetteer(base));
  const cases = {
    "duplicate place_key": (g) => { g.places.push({ ...g.places[0], aliases: [] }); },
    "duplicate alias across entries": (g) => { g.places[1].aliases.push("lantern plaza"); },
    "unnormalized alias": (g) => { g.places[0].aliases.push("Lantern  Plaza!"); },
    "ambiguous with <2 keys": (g) => { g.ambiguous_aliases["solo"] = ["lantern-plaza"]; },
    "ambiguous -> unknown key": (g) => { g.ambiguous_aliases["x y"] = ["lantern-plaza", "ghost"]; },
    "alias both resolved and ambiguous": (g) => { g.ambiguous_aliases["lantern plaza"] = ["copper-hill", "silent-chapel"]; },
    "half-set coordinates": (g) => { g.places[0].lat = 14.5; },
  };
  for (const [name, mutate] of Object.entries(cases)) {
    const g = structuredClone(GZ);
    mutate(g);
    assert.throws(() => checkGazetteer(g), name);
  }
  // mapped only when lat+lng+source all present
  const g = structuredClone(GZ);
  g.places[0].lat = 14.5;
  g.places[0].lng = 121.0;
  g.places[0].mapping_source = "fixture-source";
  const r = build(REVIEWED, g);
  assert.equal(r.places.find((p) => p.place_key === "lantern-plaza").mapping_status, "mapped");
});

test("end-to-end run into temp dirs is byte-identical", () => {
  const a = mkdtempSync(path.join(tmpdir(), "t13a-"));
  const b = mkdtempSync(path.join(tmpdir(), "t13b-"));
  const c = mkdtempSync(path.join(tmpdir(), "t13c-"));
  try {
    writeFileSync(path.join(c, "reviewed.jsonl"), REVIEWED.map((r) => JSON.stringify(r)).join("\n") + "\n");
    writeFileSync(path.join(c, "gz.json"), JSON.stringify(GZ));
    const opts = (d) => ({ out: d, reportDir: d, gazetteerPath: path.join(c, "gz.json"), reviewedFile: path.join(c, "reviewed.jsonl") });
    run(opts(a));
    run(opts(b));
    const FILES = ["places.json", "aliases.json", "ambiguities.json", "unresolved.json", "mentions.json", "t13-places.json", "t13-places.md"];
    for (const f of FILES)
      assert.ok(readFileSync(path.join(a, f)).equals(readFileSync(path.join(b, f))), `${f} differs between runs`);
    const rep = JSON.parse(readFileSync(path.join(a, "t13-places.json"), "utf8"));
    assert.equal(rep.canonical_places, 3);
    assert.equal(rep.unresolved_alias_norms, 1);
    assert.equal(rep.ambiguous_alias_norms, 1);
    assert.ok(rep.coverage_pct > 0 && rep.coverage_pct < 100);
    const md = readFileSync(path.join(a, "t13-places.md"), "utf8");
    for (const forbidden of ["Lantern Plaza", "Copper Hill", "zz0001"]) // no source wording
      assert.ok(!md.includes(forbidden), `report leaks ${forbidden}`);
  } finally {
    rmSync(a, { recursive: true, force: true });
    rmSync(b, { recursive: true, force: true });
    rmSync(c, { recursive: true, force: true });
  }
});
