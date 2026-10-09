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
  assert.deepEqual(clocks("0pm 9nn 13pm").map((c) => c.hhmm), [], "invalid meridiem values cannot become clocks");
  assert.deepEqual(clocks("12nn").map((c) => c.hhmm), ["12:00"]);
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

const authored = (text, overrides = {}) => extractPost(post("zzsafe", {
  answers: [{ text }], ...overrides,
})).candidates.filter((c) => c.comment_index !== null);
const ofKind = (rows, kind) => rows.filter((c) => c.record_kind === kind);

test("questions, negated advice and explicit speculation do not establish route facts", () => {
  for (const text of [
    "Can I take the bus from Lumina Park to Copper Hill?",
    "Bus from Lumina Park to Copper Hill then jeep from Copper Hill to Orchid Terminal?",
    "Maybe take the bus from Lumina Park to Copper Hill then jeep from Copper Hill to Orchid Terminal.",
    "Do not take the bus from Lumina Park to Copper Hill.",
    "Huwag sumakay ng jeep from Lumina Park to Copper Hill.",
    "Baka bus from Lumina Park to Copper Hill.",
    "Walk from Lumina Park to Copper Hill?",
    "Bus from Lumina Park to Copper Hill ba",
  ]) assert.deepEqual(authored(text), [], text);
  const rows = authored("Bus from Lumina Park to Copper Hill. Fare 15 pesos? Last trip 9pm? Bus still operating? Signboard: Silver Gate?");
  assert.deepEqual(rows.map((c) => c.record_kind), ["ride"]);
  assert.equal(rows[0].candidate_payload.signboard, null);
  for (const text of ["Fare is not 15 pesos.", "Maybe last trip 9pm.", "Bus is not suspended.", "Bus is not still operating."])
    assert.deepEqual(authored(text), [], text);
});

test("preference-conditional advice and explicit single-ride facts remain supported", () => {
  const rows = authored("If you prefer fewer rides, take the bus from Lumina Park to Copper Hill, 25 minutes. Fare 15 pesos. Last trip 9pm. Bus still operating.");
  assert.deepEqual(rows.map((c) => c.record_kind), ["ride", "fare", "hours", "service_status"]);
  assert.equal(rows[0].candidate_payload.ride_min, 25);
  for (const c of rows.slice(1)) assert.equal(c.candidate_payload.applies_to_ride, rows[0].candidate_id);
  assert.equal(rows[1].candidate_payload.amount_min, 15);
  assert.equal(rows[2].candidate_payload.ends_local, "21:00");
  assert.equal(rows[3].candidate_payload.status, "reported_active");
  assert.equal(authored("Kung mas mura, jeep from Lumina Park to Copper Hill.")[0].candidate_payload.mode, "jeepney");
});

test("global and unlabeled multi-ride values stay unscoped", () => {
  const rows = authored("Bus from Lumina Park to Copper Hill then jeep from Copper Hill to Orchid Terminal. Total fare 50 pesos. Last trip 9pm. Still operating.");
  assert.equal(ofKind(rows, "ride").length, 2);
  for (const kind of ["fare", "hours", "service_status"]) {
    assert.equal(ofKind(rows, kind).length, 1);
    assert.equal(ofKind(rows, kind)[0].candidate_payload.applies_to_ride, null, kind);
  }
  const ride = authored("Bus from Lumina Park to Copper Hill. Total fare for both rides 50 pesos.");
  assert.equal(ofKind(ride, "fare")[0].candidate_payload.applies_to_ride, null);
});

test("named fare, hours and status bind to the stated service instead of the preceding ride", () => {
  const rows = authored("Bus from Lumina Park to Copper Hill then jeep from Copper Hill to Orchid Terminal. Bus fare 15 pesos. Bus last trip 9pm. Bus still operating. Jeep fare 20 pesos. Jeep last trip 8pm. Jeep suspended.");
  const rides = ofKind(rows, "ride");
  for (const kind of ["fare", "hours", "service_status"])
    assert.deepEqual(ofKind(rows, kind).map((c) => c.candidate_payload.applies_to_ride), rides.map((r) => r.candidate_id), kind);
  const ambiguous = authored("Bus from Lumina Park to Copper Hill then bus from Copper Hill to Orchid Terminal. Bus fare 15 pesos. Bus last trip 9pm. Bus still operating.");
  for (const kind of ["fare", "hours", "service_status"])
    assert.equal(ofKind(ambiguous, kind)[0].candidate_payload.applies_to_ride, null, kind);
  const otherEndpoint = authored("Bus from Lumina Park to Copper Hill. Bus to Juniper College fare 25 pesos.");
  assert.equal(ofKind(otherEndpoint, "fare")[0].candidate_payload.applies_to_ride, null);
});

test("equal values on different legs are preserved, and repeated connections retain their scope", () => {
  const rows = authored("Bus from Lumina Park to Copper Hill, fare 15 pesos, last trip 9pm, still operating then jeep from Copper Hill to Orchid Terminal, fare 15 pesos, last trip 9pm, still operating.");
  const rides = ofKind(rows, "ride");
  assert.equal(rides.length, 2);
  for (const kind of ["fare", "hours", "service_status"])
    assert.deepEqual(ofKind(rows, kind).map((c) => c.candidate_payload.applies_to_ride), rides.map((r) => r.candidate_id), kind);
  const repeated = authored("Bus from Lumina Park to Copper Hill. Bus from Lumina Park to Copper Hill, fare 15 pesos.");
  assert.equal(ofKind(repeated, "ride").length, 1);
  assert.equal(ofKind(repeated, "fare")[0].candidate_payload.applies_to_ride, repeated[0].candidate_id);
});

test("walking past a station does not imply rail and explicit vehicle mode wins over endpoint names", () => {
  const walk = authored("Walk from Verdant LRT to Copper Hill, 300 meters, 5 minutes.");
  assert.deepEqual(walk.map((c) => c.record_kind), ["walk"]);
  assert.equal(walk[0].candidate_payload.walk_m, 300);
  assert.equal(walk[0].candidate_payload.walk_min, 5);
  const bus = authored("Take bus from Verdant LRT to Orchid Terminal.");
  assert.equal(bus[0].candidate_payload.mode, "bus");
  for (const text of [
    "Bus from Lumina Park to Copper Hill and jeep from Copper Hill to Orchid Terminal.",
    "Bus from Lumina Park to Copper Hill, Orchid Terminal -> Juniper College.",
    "Bus or jeep from Lumina Park to Copper Hill.",
    "Take bus from Lumina Park to Copper Hill and walk to Juniper College.",
    "Take jeep from left corner to right gate.",
  ]) assert.equal(ofKind(authored(text), "ride").length, 0, text);
});

test("waits, appointments, approximate durations and non-route quantities do not become ride facts", () => {
  for (const extra of ["wait 20 minutes", "class 45 minutes", "around 30 minutes", "10 to 20 minutes", "5.5 minutes", "10 minutes and 20 minutes"])
    assert.equal(authored(`Bus from Lumina Park to Copper Hill, ${extra}.`)[0].candidate_payload.ride_min, null, extra);
  for (const text of ["Fare 15 minutes.", "Fare 50 percent.", "Bus P2P.", "Lunch costs 50 pesos.", "Fare PHP 15.50."])
    assert.equal(ofKind(authored(text), "fare").length, 0, text);
  const unrelated = authored("Bus from Lumina Park to Copper Hill. Mall opens from 5am to 9pm. Last trip 10pm.");
  assert.equal(ofKind(unrelated, "hours").length, 1);
  assert.equal(ofKind(unrelated, "hours")[0].candidate_payload.applies_to_ride, null);
  const unrelatedStatus = authored("Bus from Lumina Park to Copper Hill. Mall still operating.");
  assert.equal(ofKind(unrelatedStatus, "service_status")[0].candidate_payload.applies_to_ride, null);
  for (const extra of ["around 300 meters", "300-500 meters", "300+ meters"])
    assert.equal(authored(`Walk from Lumina Park to Copper Hill, ${extra}.`)[0].candidate_payload.walk_m, null, extra);
});

test("walking continuation uses an explicit adjacent chain in the same comment", () => {
  const rows = authored("Bus from Lumina Park to Copper Hill then walk to Orchid Terminal, 5 minutes.");
  const walk = ofKind(rows, "walk")[0].candidate_payload;
  assert.deepEqual([walk.from_place, walk.to_place], ["Copper Hill", "Orchid Terminal"]);
  assert.equal(ofKind(authored("Bus from Lumina Park to Copper Hill. Walk to Orchid Terminal."), "walk").length, 0);
});

test("question-only facts and another answer never supply endpoints, numeric values or service attributes", () => {
  const rows = authored("Take bus.", {
    question: "From Lumina Park to Copper Hill, signboard Silver Gate, 20 minutes, northbound, last trip 9pm?",
    answers: [{ text: "Take bus." }, { text: "Fare 15 pesos. Last trip 9pm. Still operating. Walk to Orchid Terminal." }],
  });
  assert.equal(ofKind(rows, "ride").length, 0);
  assert.equal(ofKind(rows, "walk").length, 0);
  for (const c of rows) assert.equal(c.candidate_payload.applies_to_ride, null);
  const samePost = authored("", { answers: [{ text: "Bus from Lumina Park to Copper Hill, signboard: Silver Gate, northbound, 20 minutes." }, { text: "Bus fare 15 pesos. Bus last trip 9pm. Bus still operating." }] });
  const ride = samePost[0];
  assert.deepEqual([ride.candidate_payload.signboard, ride.candidate_payload.direction_text, ride.candidate_payload.ride_min], ["Silver Gate", "northbound", 20]);
  for (const c of samePost.slice(1)) {
    assert.equal(c.comment_index, 1);
    assert.equal(c.candidate_payload.applies_to_ride, null);
  }
});

test("inactive operating reports stay scoped without turning negated status into suspension", () => {
  const rows = authored("Bus from Lumina Park to Copper Hill is no longer operating.");
  assert.deepEqual(rows.map((c) => c.record_kind), ["ride", "service_status"]);
  assert.equal(rows[1].candidate_payload.status, "suspended");
  assert.equal(rows[1].candidate_payload.applies_to_ride, rows[0].candidate_id);
  assert.equal(ofKind(authored("Bus from Lumina Park to Copper Hill. Bus is not suspended."), "service_status").length, 0);
});

test("unaffected comment IDs, same-comment locators and extracted review state remain stable", () => {
  const text = "Bus from Lumina Park to Copper Hill, fare 15 pesos, last trip 9pm, still operating.";
  const rows = authored(text);
  assert.deepEqual(rows.map((c) => c.candidate_id), ["c_zzsafe_0_1", "c_zzsafe_0_2", "c_zzsafe_0_3", "c_zzsafe_0_4"]);
  assert.deepEqual(authored(text), rows);
  const extended = authored(text, { answers: [{ text }, { text: "Maybe jeep from Orchid Terminal to Juniper College?" }] });
  assert.deepEqual(extended, rows);
  for (const c of rows) {
    assert.equal(c.comment_index, 0);
    assert.equal(c.snapshot_sha256, SNAPSHOT_SHA256);
    assert.equal(c.review_state, "extracted");
    assert.equal(c.reviewer_id, null);
    assert.equal(c.reviewed_at, null);
  }
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
