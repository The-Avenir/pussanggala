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

test("eligible sources keep offline evidence locators while raw permalinks stay in input", () => {
  const input = base();
  const permalink = "https://www.reddit.com/r/HowToGetTherePH/comments/p1/synthetic_title/";
  input.posts[0].permalink = permalink;
  input.candidates = [ride("c_p1_0_0")];
  const result = buildEligible(input);
  const source = result.tables.source.find((s) => s.post_id === "p1");
  assert.equal(source.url, null);
  assert.equal(source.kind, "reddit_thread");
  assert.ok(source.posted_at);
  const citation = result.recordSources.find((r) => r.source_id === source.source_id);
  assert.equal(citation.snapshot_sha256, SNAP);
  assert.equal(citation.comment_index, 0);
  assert.equal(input.posts[0].permalink, permalink, "the audit input is not altered");
  assert.ok(!JSON.stringify(result.tables).includes(permalink));
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

test("restrictive overrides quarantine otherwise valid ride/fare records at the pure boundary", () => {
  const input = base();
  input.candidates = [
    ride("c_p1_0_0"),
    mkCand("c_p1_0_1", "fare", { applies_to_ride: "c_p1_0_0", amount_min: 17, amount_max: 17 }),
  ];
  const before = buildEligible(input);
  assert.equal(before.tables.leg.length, 1);
  assert.equal(before.tables.fare_report.length, 1);
  input.candidates = input.candidates.map((c) => ({ ...c, ai_override: {
    prior_state: "second_passed", new_state: "needs_review", reason_code: "fixture_quarantine",
  } }));
  const snapshot = JSON.stringify(input.candidates);
  const result = buildEligible(input);
  for (const name of ["route", "leg", "stop", "place_stop", "fare_report"]) {
    assert.equal(result.tables[name].length, 0, name);
  }
  assert.deepEqual(result.stats.candidates_in, { second_passed: 0, needs_review: 2, rejected: 0 });
  assert.equal(result.dispositions.p1, "pending");
  assert.ok(result.recordSources.every((s) => s.source_id === "src_gazetteer"));
  assert.equal(JSON.stringify(input.candidates), snapshot, "base states and provenance stay untouched");
  assert.deepEqual(buildEligible(input), result, "reruns remain deterministic");
});

test("a quarantined fare cannot emit against an otherwise eligible ride", () => {
  const input = base();
  input.candidates = [ride("c_p1_0_0"), {
    ...mkCand("c_p1_0_1", "fare", { applies_to_ride: "c_p1_0_0", amount_min: 17, amount_max: 17 }),
    ai_override: { new_state: "needs_review", reason_code: "fixture_quarantine" },
  }];
  const result = buildEligible(input);
  assert.equal(result.tables.leg.length, 1);
  assert.equal(result.tables.fare_report.length, 0);
  assert.deepEqual(result.dispositions.p1, ["included", "pending"]);
});

test("overridden inactive status still suppresses a ride without asserting the claim", () => {
  const input = base();
  input.candidates = [ride("c_p1_0_0"), {
    ...mkCand("c_p1_0_1", "service_status", { applies_to_ride: "c_p1_0_0", status: "retired" }),
    ai_override: { new_state: "needs_review", reason_code: "fixture_quarantine" },
  }];
  const result = buildEligible(input);
  assert.equal(result.tables.leg[0].eligibility, "excluded");
  assert.equal(result.tables.route[0].service_status, "unknown");
  assert.equal(result.stats.service_status.verified, 0);
  assert.equal(result.stats.service_status.suppressed_routes, 1);
});

test("promotion and malformed overrides fail closed, including base human decisions", () => {
  for (const baseState of ["accepted", "rejected", "needs_review", "second_passed"]) {
    for (const new_state of ["accepted", "second_passed", "unknown", null]) {
      const input = base();
      input.candidates = [{ ...ride("c_p1_0_0", {}, "p1", baseState), ai_override: { new_state } }];
      const result = buildEligible(input);
      assert.equal(result.tables.leg.length, 0, `${baseState}/${new_state}`);
      assert.equal(result.stats.candidates_in.second_passed, 0);
      assert.equal(input.candidates[0].review_state, baseState);
      if (baseState === "rejected") assert.equal(result.dispositions.p1, "rejected");
      if (baseState === "needs_review" || baseState === "second_passed") assert.equal(result.dispositions.p1, "pending");
    }
  }
  const input = base();
  input.candidates = [{ ...ride("c_p1_0_0"), ai_override: { new_state: "rejected" } }];
  const result = buildEligible(input);
  assert.equal(result.tables.leg.length, 0);
  assert.equal(result.dispositions.p1, "rejected");
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
