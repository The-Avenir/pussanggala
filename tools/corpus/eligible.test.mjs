// Tests for T14 eligible.mjs — run with `node --test tools/corpus/eligible.test.mjs`.
// Synthetic fixtures only; no raw dataset text is stored here.

import { test } from "node:test";
import assert from "node:assert/strict";
import { buildEligible } from "./eligible.mjs";

const SNAP = "d3939475ebd250755fcdac776f703001480aeaa4b72d04b025fba54434c4fdf3";

const mkPost = (id, utc = 1783327710) => ({
  id,
  title: `post ${id}`,
  question: null,
  created_utc: utc,
  permalink: `https://example.invalid/${id}/`,
  answers: ["an answer"],
});
const mkCand = (id, kind, payload, state = "second_passed", post = "p1", ci = 0) => ({
  candidate_id: id, snapshot_sha256: SNAP, post_id: post, comment_index: ci,
  record_kind: kind, candidate_payload: payload, review_state: state,
});
const mkPlace = (key, ncr = "accepted") => ({
  place_key: key, place_id: `pl_${key}`, name: `${key} place`, kind: "area",
  area: "Area", city: "City", ncr_status: ncr, lat: null, lng: null,
  mapping_status: "unmapped", mention_count: 1, post_count: 1, alias_count: 1,
});
const mkAlias = (norm, key) => ({ alias_norm: norm, alias_display: norm, place_key: key, mention_count: 1 });

const base = () => ({
  places: [mkPlace("alpha"), mkPlace("beta"), mkPlace("gamma-out", "outside")],
  aliases: [mkAlias("alpha", "alpha"), mkAlias("beta", "beta"), mkAlias("gamma out", "gamma-out")],
  ambiguities: [],
  posts: [mkPost("p1"), mkPost("p2")],
  sourceGrams: new Set(),
});

const ride = (id, over = {}, post = "p1", state) =>
  mkCand(id, "ride", { mode: "jeepney", signboard: null, board_place: "Alpha", alight_place: "Beta", direction_text: null, ride_min: null, ...over }, state, post);

test("happy path: a resolved ride emits route + leg + stops with provenance", () => {
  const input = base();
  input.candidates = [ride("c_p1_0_0")];
  const r = buildEligible(input);
  assert.equal(r.tables.leg.length, 1);
  assert.equal(r.tables.route.length, 1);
  assert.equal(r.tables.stop.length, 2);
  assert.equal(r.tables.leg[0].eligibility, "ready");
  assert.ok(r.recordSources.some((rs) => rs.record_kind === "leg" && rs.record_id === r.tables.leg[0].leg_id));
  assert.equal(r.dispositions.p1, "included");
});

test("needs_review and rejected candidates never emit records", () => {
  const input = base();
  input.candidates = [
    ride("c_p1_0_0", {}, "p1", "needs_review"),
    ride("c_p2_0_0", {}, "p2", "rejected"),
  ];
  const r = buildEligible(input);
  assert.equal(r.tables.leg.length, 0);
  assert.equal(r.dispositions.p1, "pending");
  assert.equal(r.dispositions.p2, "rejected");
});

test("ambiguous aliases resolve to nothing; unresolved places drop the ride", () => {
  const input = base();
  input.ambiguities = [{ alias_norm: "beta", place_key: "beta" }, { alias_norm: "beta", place_key: "alpha" }];
  input.candidates = [
    ride("c_p1_0_0", { alight_place: "Beta" }), // ambiguous -> drop
    ride("c_p1_0_1", { alight_place: "Nowhere" }), // unresolved -> drop
  ];
  const r = buildEligible(input);
  assert.equal(r.tables.leg.length, 0);
  assert.equal(r.stats.rides.dropped.alight_ambiguous, 1);
  assert.equal(r.stats.rides.dropped.alight_unresolved, 1);
});

test("unverified suspended/retired claim suppresses the route without asserting status", () => {
  const input = base();
  input.candidates = [
    ride("c_p1_0_0"),
    mkCand("c_p1_0_1", "service_status", { applies_to_ride: "c_p1_0_0", status: "suspended" }, "needs_review"),
  ];
  const r = buildEligible(input);
  assert.equal(r.tables.leg[0].eligibility, "excluded");
  assert.equal(r.tables.route[0].service_status, "unknown"); // claim not asserted
});

test("rides to non-accepted places produce excluded legs, never ready", () => {
  const input = base();
  input.candidates = [ride("c_p1_0_0", { alight_place: "Gamma Out" })];
  const r = buildEligible(input);
  assert.equal(r.tables.leg.length, 1);
  assert.equal(r.tables.leg[0].eligibility, "excluded");
});

test("fares need both bounds and a resolvable leg; hours need a route", () => {
  const input = base();
  input.candidates = [
    ride("c_p1_0_0"),
    mkCand("c_p1_0_1", "fare", { applies_to_ride: "c_p1_0_0", amount_min: 13, amount_max: 13, currency: "PHP" }),
    mkCand("c_p1_0_2", "fare", { applies_to_ride: "c_p1_0_0", amount_min: null, amount_max: 60, currency: "PHP" }),
    mkCand("c_p1_0_3", "fare", { applies_to_ride: "c_nope", amount_min: 10, amount_max: 10, currency: "PHP" }),
    mkCand("c_p1_0_4", "hours", { applies_to_ride: "c_p1_0_0", hours_text: "Daytime service reported.", starts_local: "06:00", ends_local: "21:00", days_text: null }),
  ];
  const r = buildEligible(input);
  assert.equal(r.tables.fare_report.length, 1);
  assert.equal(r.tables.fare_report[0].effective_at, "2026-07-06");
  assert.equal(r.tables.hours_report.length, 1);
});

test("dedup: two rides on the same connection share one leg with merged sources", () => {
  const input = base();
  input.posts.push(mkPost("p2"));
  input.candidates = [ride("c_p1_0_0"), ride("c_p2_0_0", {}, "p2")];
  const r = buildEligible(input);
  assert.equal(r.tables.leg.length, 1);
  const legSources = r.recordSources.filter((rs) => rs.record_kind === "leg");
  assert.equal(legSources.length, 2);
});

test("output is deterministic across runs", () => {
  const mk = () => {
    const input = base();
    input.candidates = [
      ride("c_p1_0_0"), ride("c_p1_0_1", { signboard: "VIOLET LOOP" }),
      mkCand("c_p1_0_2", "walk", { from_place: "Alpha", to_place: "Beta", walk_text: "Short walk.", walk_m: 100, walk_min: 2 }),
      mkCand("c_p1_0_3", "note", { body: "Check signage before boarding.", kind: "tip" }),
    ];
    return JSON.stringify(buildEligible(input).tables);
  };
  assert.equal(mk(), mk());
});

test("dispositions cover every answered post exactly once (precedence-resolved)", () => {
  const input = base();
  input.posts = [mkPost("p1"), mkPost("p2"), mkPost("p3")];
  input.candidates = [
    ride("c_p1_0_0"), // included
    mkCand("c_p2_0_0", "note", { body: "x", kind: "tip" }, "needs_review", "p2"), // pending
  ]; // p3 has no candidates -> filtered
  const r = buildEligible(input);
  assert.deepEqual(Object.keys(r.dispositions).sort(), ["p1", "p2", "p3"]);
  assert.equal(r.dispositions.p3, "filtered");
});
