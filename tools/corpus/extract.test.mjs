// node --test tools/corpus/extract.test.mjs
//
// Fixtures are invented: no post, question or answer wording here comes from the NCR
// snapshot, and the place names do not exist. The snapshot is only touched by the
// whole-run determinism test, which asserts on counts, never on content.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { evaluate } from "./evidence.mjs";
import { extractAll, extractPost, cleanPlace, detectMode, fares, clocks, shardOf, run, norm, SNAPSHOT_SHA256, SHARDS } from "./extract.mjs";

const post = (id, over = {}) => ({
  id,
  title: "Lumina Park to Copper Hill",
  question: "Pano commute from Lumina Park to Copper Hill?",
  permalink: `https://example.invalid/${id}`,
  origin: "Lumina Park",
  destination: "Copper Hill",
  answers: [],
  ...over,
});

const POSTS = [
  post("zz0001", {
    answers: [
      { score: 3, text: "Sakay ka ng jeep sa Lumina Park, baba ka sa Copper Hill. Pamasahe 15 pesos. Mahabang pila dun." },
      { score: 2, text: "From Verdant LRT to Orchid Terminal, mga 20 pesos lang." },
      { score: 1, text: "Salamat po!" },
      { score: 1, text: "Maglakad ka from Copper Hill to Juniper College, 300 meters lang." },
      { score: 1, text: "Ang bus sa Starlight Mall papuntang Copper Hill ay 5am to 9pm ang biyahe." },
      { score: 1, text: "Hindi na bumibiyahe ang jeep papuntang Orchid Terminal." },
      { score: 1, text: "Tanong mo kay u/riderguide, sakay siya ng jeep sa Lumina Park, baba sa Juniper College." },
    ],
  }),
  post("zz0002", {
    title: "Harbor Gate to Summit Heights",
    question: "Harbor Gate to Summit Heights po?",
    origin: "Harbor Gate",
    destination: "Summit Heights",
    answers: [{ score: 1, text: "Thanks po!" }, { score: 1, text: "Up!" }],
  }),
  post("zz0003", {
    title: "Pine Row, Marikina to Juniper College",
    question: "[removed]",
    origin: "Pine Row, Marikina",
    destination: "Juniper College",
    answers: [{ score: 1, text: "Ang UV Express dito sa Pine Row ay 24/7 ang biyahe, 45 pesos." }],
  }),
  post("zz0004", { answers: [] }), // unanswered: no candidates, no outcome
];

const RESULT = extractAll(POSTS, SNAPSHOT_SHA256);
const byPost = (id) => RESULT.candidates.filter((c) => c.post_id === id);
const kind = (id, k) => byPost(id).filter((c) => c.record_kind === k);
const outcomeOf = (id) => RESULT.outcomes.find((o) => o.post_id === id);

test("every candidate carries the contract envelope", () => {
  assert.ok(RESULT.candidates.length > 0);
  const ids = new Set();
  for (const c of RESULT.candidates) {
    assert.equal(c.review_state, "extracted");
    assert.equal(c.evidence_check, null);
    assert.equal(c.review_reason, null);
    assert.equal(c.reviewer_id, null);
    assert.equal(c.reviewed_at, null);
    assert.equal(c.snapshot_sha256, SNAPSHOT_SHA256);
    assert.match(c.candidate_id, /^c_[a-z0-9]+_(?:\d+|q)_\d+$/);
    assert.ok(!ids.has(c.candidate_id), `duplicate ${c.candidate_id}`);
    ids.add(c.candidate_id);
    assert.ok(["place", "ride", "walk", "fare", "hours", "service_status", "note"].includes(c.record_kind));
    const post = POSTS.find((p) => p.id === c.post_id);
    if (c.comment_index === null) continue;
    assert.ok(Number.isInteger(c.comment_index) && c.comment_index < post.answers.length);
  }
});

test("question endpoints become place candidates with comment_index null", () => {
  const places = kind("zz0001", "place");
  assert.deepEqual(places.map((p) => p.candidate_payload.name), ["Lumina Park", "Copper Hill"]);
  assert.deepEqual(places.map((p) => p.candidate_payload.role), ["origin", "destination"]);
  assert.deepEqual(places.map((p) => p.comment_index), [null, null]);
  const marikina = kind("zz0003", "place")[0].candidate_payload;
  assert.equal(marikina.name, "Pine Row");
  assert.equal(marikina.city, "Marikina");
  assert.equal(kind("zz0001", "place")[1].candidate_payload.kind, "landmark");
  assert.equal(extractPost(post("zz9", { origin: "Verdant LRT", answers: [{ text: "ok" }] }), SNAPSHOT_SHA256)
    .candidates[0].candidate_payload.kind, "station");
});

test("rides need a mode and both endpoints", () => {
  const rides = kind("zz0001", "ride").map((r) => r.candidate_payload);
  assert.deepEqual(rides.map((r) => [r.mode, r.board_place, r.alight_place]), [
    ["jeepney", "Lumina Park", "Copper Hill"],   // sakay sa … / baba sa …
    ["rail", "Verdant LRT", "Orchid Terminal"],  // from … to …
    ["bus", "Starlight Mall", "Copper Hill"],    // … papuntang …
    ["jeepney", "Lumina Park", "Juniper College"],
  ]);
  // Only a destination is named, so no ride is invented for comment 5.
  assert.equal(kind("zz0001", "ride").filter((r) => r.comment_index === 5).length, 0);
  assert.equal(detectMode("sakay ng modern jeep"), "modern_jeepney");
  assert.equal(detectMode("walang sasakyan dito"), null);
});

test("fares are scoped to a ride and approximations are dropped", () => {
  const f = kind("zz0001", "fare");
  assert.equal(f.length, 1, "only the stated 15 is a fare; 'mga 20 pesos' is approximate");
  assert.deepEqual(f[0].candidate_payload, {
    applies_to_ride: kind("zz0001", "ride")[0].candidate_id,
    amount_min: 15,
    amount_max: 15,
    currency: "PHP",
  });
  assert.deepEqual(fares("40 to 60 pesos").map((x) => [x.amount_min, x.amount_max]), [[40, 60]]);
  assert.deepEqual(fares("around 90 pesos"), []);
  assert.deepEqual(fares("ride the P2P bus"), []);
  assert.deepEqual(fares("15 minutes lang"), []);
});

test("hours only come from clock values that are not a guess", () => {
  const h = kind("zz0001", "hours")[0].candidate_payload;
  assert.equal(h.starts_local, "05:00");
  assert.equal(h.ends_local, "21:00");
  assert.equal(h.hours_text, "Reported window noted in source.");
  const allDay = kind("zz0003", "hours")[0].candidate_payload;
  assert.deepEqual([allDay.starts_local, allDay.ends_local, allDay.days_text], ["00:00", "23:59", "daily"]);
  assert.deepEqual(clocks("4:00 ka umalis").map((c) => c.hhmm), [], "a bare 4:00 is ambiguous");
  assert.deepEqual(clocks("16:30 ang huling biyahe").map((c) => c.hhmm), ["16:30"]);
});

test("walks, service status and notes", () => {
  const w = kind("zz0001", "walk")[0].candidate_payload;
  assert.deepEqual(w, { from_place: "Copper Hill", to_place: "Juniper College", walk_text: "Walking connection noted.", walk_m: 300, walk_min: null });
  assert.equal(kind("zz0001", "service_status")[0].candidate_payload.status, "suspended");
  assert.deepEqual(kind("zz0001", "note")[0].candidate_payload, { body: "Queue delay noted.", kind: "warning" });
  assert.ok(kind("zz0001", "note").every((n) => n.candidate_payload.body.split(" ").length <= 5));
});

test("one outcome per answered post, graded by what was found", () => {
  assert.deepEqual(RESULT.outcomes.map((o) => o.post_id), ["zz0001", "zz0002", "zz0003"]);
  assert.equal(outcomeOf("zz0001").outcome, "route_evidence");
  assert.equal(outcomeOf("zz0002").outcome, "no_route_evidence");
  assert.equal(outcomeOf("zz0003").outcome, "partial_evidence");
  for (const o of RESULT.outcomes) {
    assert.equal(o.candidate_count, byPost(o.post_id).length);
    assert.ok(typeof o.reason === "string" && o.reason.length > 0);
  }
  assert.equal(extractPost(post("zz0004"), SNAPSHOT_SHA256), null);
});

test("INV-4: no six-word run of source wording and no usernames in payloads", () => {
  const grams = new Set();
  for (const p of POSTS)
    for (const s of [p.title, p.question, ...p.answers.map((a) => a.text)]) {
      const t = norm(s).split(" ");
      for (let i = 0; i + 6 <= t.length; i++) grams.add(t.slice(i, i + 6).join(" "));
    }
  const strings = (v, acc = []) => {
    if (typeof v === "string") acc.push(v);
    else if (v && typeof v === "object") Object.values(v).forEach((x) => strings(x, acc));
    return acc;
  };
  for (const c of RESULT.candidates)
    for (const s of strings(c.candidate_payload)) {
      assert.doesNotMatch(s, /\bu\/[A-Za-z0-9_-]{2,}/, `${c.candidate_id} leaks a handle`);
      const t = norm(s).split(" ");
      for (let i = 0; i + 6 <= t.length; i++)
        assert.ok(!grams.has(t.slice(i, i + 6).join(" ")), `${c.candidate_id} copies source wording`);
    }
});

test("the T12 pass accepts the output: no rejects, no ungrounded values", () => {
  const reviewed = evaluate(POSTS, RESULT.candidates, SNAPSHOT_SHA256);
  assert.equal(reviewed.length, RESULT.candidates.length);
  for (const r of reviewed) {
    for (const f of ["bad_locator", "raw_wording", "username", "value_not_in_source", "incomplete_connection", "long_identifier"])
      assert.ok(!r.evidence_check.flags.includes(f), `${r.candidate_id}: ${r.evidence_check.flags.join(",")}`);
    assert.notEqual(r.review_state, "rejected");
  }
});

test("place slicing keeps names and drops prose", () => {
  assert.equal(cleanPlace("Copper Hill"), "Copper Hill");
  assert.equal(cleanPlace("sa Copper Hill"), "Copper Hill");
  assert.equal(cleanPlace("go to the terminal"), null);
  assert.equal(cleanPlace("any jeep"), null);
  assert.equal(cleanPlace("5am"), null);
  assert.equal(cleanPlace("terminal"), null);
});

test("sharding is stable and keeps a post whole", () => {
  for (const p of POSTS) {
    const s = shardOf(p.id);
    assert.ok(Number.isInteger(s) && s >= 0 && s < SHARDS);
    assert.equal(s, shardOf(p.id));
  }
});

test("extraction is deterministic", () => {
  assert.deepEqual(extractAll(POSTS, SNAPSHOT_SHA256), RESULT);
});

test("a full run over the snapshot writes byte-identical shards", () => {
  const a = mkdtempSync(path.join(tmpdir(), "t11a-"));
  const b = mkdtempSync(path.join(tmpdir(), "t11b-"));
  try {
    const ra = run({ out: a, writeProgress: false });
    run({ out: b, writeProgress: false });
    assert.equal(ra.snapshot_sha256, SNAPSHOT_SHA256);
    assert.equal(ra.answered_posts, 2186);
    assert.ok(ra.candidates > 0);
    let lines = 0;
    for (let s = 0; s < SHARDS; s++)
      for (const f of [`candidates-s${s}.jsonl`, `outcomes-s${s}.jsonl`]) {
        const fa = readFileSync(path.join(a, f));
        assert.ok(fa.equals(readFileSync(path.join(b, f))), `${f} differs between runs`);
        lines += fa.toString("utf8").trim().split("\n").length;
      }
    assert.equal(lines, ra.candidates + ra.answered_posts);
  } finally {
    rmSync(a, { recursive: true, force: true });
    rmSync(b, { recursive: true, force: true });
  }
});
