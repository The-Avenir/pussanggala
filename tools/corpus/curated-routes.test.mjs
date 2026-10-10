import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { addCuratedRoutes } from "./curated-routes.mjs";
import { evaluate } from "./evidence.mjs";

const sha = "a".repeat(64);
const posts = [{ id: "zz0001", title: "Station trip", question: "Travel advice",
  answers: [{ text: "MRT Lantern > Copper." }] }];
const base = { candidates: [], outcomes: [{ post_id: "zz0001", outcome: "no_route_evidence", candidate_count: 0, reason: "none" }] };
const curated = { snapshot_sha256: sha, rides: [{ post_id: "zz0001", comment_index: 0,
  comment_sha256: createHash("sha256").update(posts[0].answers[0].text).digest("hex"),
  board_place: "MRT Lantern", alight_place: "MRT Copper", mode: "rail" }] };

test("curated directions enter evidence review with unknown times and no human decision", () => {
  const result = addCuratedRoutes(base, posts, curated, sha);
  assert.equal(result.candidates[0].review_state, "extracted");
  assert.equal(result.candidates[0].reviewer_id, null);
  assert.equal(result.candidates[0].candidate_payload.ride_min, null);
  assert.equal(result.outcomes[0].outcome, "route_evidence");
  assert.equal(result.outcomes[0].candidate_count, 1);
  assert.equal(base.candidates.length, 0);
  assert.equal(evaluate(posts, result.candidates, sha)[0].review_state, "second_passed");
});

test("changed snapshots, comments and invalid locators fail before adding a direction", () => {
  assert.throws(() => addCuratedRoutes(base, posts, curated, "b".repeat(64)), /snapshot mismatch/);
  assert.throws(() => addCuratedRoutes(base, [{ ...posts[0], answers: [{ text: "Changed" }] }], curated, sha), /comment mismatch/);
  for (const comment_index of [-1, 1, null]) {
    assert.throws(() => addCuratedRoutes(base, posts, { ...curated, rides: [{ ...curated.rides[0], comment_index }] }, sha), /locator invalid/);
  }
});

test("curation cannot promote ungrounded endpoints past evidence review", () => {
  const ungrounded = { ...curated, rides: [{ ...curated.rides[0], alight_place: "MRT Juniper" }] };
  const result = addCuratedRoutes(base, posts, ungrounded, sha);
  assert.equal(evaluate(posts, result.candidates, sha)[0].review_state, "needs_review");
});

test("jeepney supplements preserve mode and pass the same evidence review", () => {
  const jeepPosts = [{ ...posts[0], answers: [{ text: "Jeep from Lantern to Copper." }] }];
  const jeepCurated = { ...curated, rides: [{ ...curated.rides[0], mode: "jeepney", board_place: "Lantern", alight_place: "Copper",
    comment_sha256: createHash("sha256").update(jeepPosts[0].answers[0].text).digest("hex") }] };
  const result = addCuratedRoutes(base, jeepPosts, jeepCurated, sha);
  assert.equal(result.candidates[0].candidate_payload.mode, "jeepney");
  assert.equal(evaluate(jeepPosts, result.candidates, sha)[0].review_state, "second_passed");
  assert.throws(() => addCuratedRoutes(base, jeepPosts, { ...jeepCurated, rides: [{ ...jeepCurated.rides[0], mode: "spaceship" }] }, sha), /endpoints required/);
});

test("duplicate curated directions fail and IDs remain stable when the list grows", () => {
  assert.throws(() => addCuratedRoutes(base, posts, { ...curated, rides: [curated.rides[0], curated.rides[0]] }, sha), /ID collision/);
  const first = addCuratedRoutes(base, posts, curated, sha).candidates[0].candidate_id;
  const extra = { ...curated.rides[0], board_place: "MRT Copper", alight_place: "MRT Lantern" };
  const expanded = addCuratedRoutes(base, posts, { ...curated, rides: [extra, curated.rides[0]] }, sha);
  assert.equal(expanded.candidates[1].candidate_id, first);
});
