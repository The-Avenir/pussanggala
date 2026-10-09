// T12 part A — deterministic second evidence pass over T11 candidates.
//
//   node tools/corpus/evidence.mjs [--out <dir>] [--report-dir <dir>]
//
// Reads data/raw/t11/candidates-s{0..3}.jsonl + the NCR snapshot, sets
// evidence_check / review_state / review_reason on every candidate and writes:
//   <out>/reviewed-candidates.jsonl, <out>/review-queue.jsonl, <out>/review-queue.md
//   <report-dir>/t12-evidence.{md,json}   (counts only — committed, no source text)
// Never sets `accepted`; reviewer_id / reviewed_at stay null. Re-runs are byte-identical.
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
export const SNAPSHOT_SHA256 = "d3939475ebd250755fcdac776f703001480aeaa4b72d04b025fba54434c4fdf3";

// ---------- text helpers ----------
export const norm = (s) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
export const tokens = (s) => (norm(s) ? norm(s).split(" ") : []);

const HEDGES = ["ata", "yata", "siguro", "i think", "iirc", "not sure", "baka", "ewan", "probably", "di ko sure"];
const HEDGE_RE = new RegExp(` (?:${HEDGES.join("|")}) `);
export const hasHedge = (text) => HEDGE_RE.test(` ${norm(text)} `);

const USERNAME_RE = /(?:^|[^A-Za-z0-9_])\/?u\/[A-Za-z0-9_-]{2,}|reddit\.com\/(?:u|user)\//i;
export const hasUsername = (s) => USERNAME_RE.test(String(s));

/** Fraction of field tokens found in the text token set (prefix match for ≥3-char tokens). */
// Locative/filler words added by the extractor to describe a spot; not identifier content.
const FILLER = new Set(("the a an of in at on to near behind under below inside outside along across opposite front side " +
  "beside corner cor bound end route last first stop area sa may ng na ang yung tapat likod ilalim harap tabi").split(" "));
export function tokenOverlap(field, textTokSet, textToks) {
  // Parenthetical qualifiers are extractor context, not quoted identifiers.
  const stripped = String(field ?? "").replace(/\([^)]*\)/g, " ");
  let ft = tokens(stripped).filter((t) => !FILLER.has(t));
  if (ft.length === 0) ft = tokens(field);
  if (ft.length === 0) return 1;
  let hit = 0;
  for (const t of ft) {
    if (textTokSet.has(t)) { hit++; continue; }
    if (t.length >= 3 && textToks.some((x) => x.length >= 3 && (x.startsWith(t) || t.startsWith(x)))) hit++;
  }
  return hit / ft.length;
}

const numbersIn = (text) => new Set((String(text).match(/\d+(?:[.,]\d+)*/g) ?? []).map((n) => Number(n.replace(/,/g, ""))));

function hoursGrounded(p, text) {
  const t = String(text).toLowerCase();
  const nums = numbersIn(t);
  const times = [p.starts_local, p.ends_local].filter((x) => typeof x === "string" && /^\d{1,2}:\d{2}$/.test(x));
  // No clock values: require an hours/day token in the cited text (digits, am/pm, 24, or day/time-of-day words).
  if (times.length === 0)
    return /\d|\bam\b|\bpm\b|midnight|noon|morning|afternoon|evening|night|daytime|weekend|weekday|sunday|saturday|monday|tuesday|wednesday|thursday|friday|daily|hourly|every\s*h(?:ou)?r|schedule|sked|umaga|tanghali|hapon|gabi|madaling\s*araw|linggo|sabado/.test(t);
  const all24 = /\b24\s*(?:\/\s*7|hours|hrs|h\b|oras)/.test(t);
  return times.every((hm) => {
    const h = Number(hm.split(":")[0]);
    const m = Number(hm.split(":")[1]);
    if (nums.has(h) || nums.has(h % 12 || 12)) return true;
    if (m && (nums.has(h * 100 + m) || nums.has((h % 12 || 12) * 100 + m))) return true; // "430" for 4:30
    if ((h === 0 || h === 24 || hm === "23:59") && (all24 || /midnight/.test(t))) return true;
    if (h === 12 && /noon/.test(t)) return true;
    return false;
  });
}

const sixGrams = (toks) => {
  const out = new Set();
  for (let i = 0; i + 6 <= toks.length; i++) out.add(toks.slice(i, i + 6).join(" "));
  return out;
};

const allStrings = (v, acc = []) => {
  if (typeof v === "string") acc.push(v);
  else if (Array.isArray(v)) v.forEach((x) => allStrings(x, acc));
  else if (v && typeof v === "object") Object.values(v).forEach((x) => allStrings(x, acc));
  return acc;
};

// ---------- policy ----------
const PARAPHRASE_FIELDS = { walk: ["walk_text"], hours: ["hours_text"], note: ["body"] };
const IDENTIFIER_FIELDS = {
  place: ["name"],
  ride: ["signboard", "board_place", "alight_place", "direction_text"],
  walk: ["from_place", "to_place"],
};
const ROUTE_KINDS = new Set(["ride", "fare", "hours", "service_status"]);

export function decideState(kind, flags) {
  const f = new Set(flags);
  if (f.has("bad_locator") || f.has("username") || f.has("raw_wording")) return "rejected";
  if (f.has("value_not_in_source") && (kind === "fare" || kind === "hours")) return "rejected";
  if (f.has("incomplete_connection") || f.has("conflict") || f.has("inactive_service")) return "needs_review";
  if (f.has("hedged") && ROUTE_KINDS.has(kind)) return "needs_review";
  if (f.has("value_not_in_source") && (kind === "ride" || kind === "walk")) return "needs_review";
  if (f.has("question_missing") && ROUTE_KINDS.has(kind)) return "needs_review";
  return "second_passed";
}

function conflictTarget(c) {
  const p = c.candidate_payload;
  if (c.record_kind === "walk") return `walk|${norm(p.from_place)}|${norm(p.to_place)}`;
  if (["fare", "hours", "service_status"].includes(c.record_kind))
    return `${c.record_kind}|${p.applies_to_ride ?? "unscoped"}`;
  return null;
}
const differ = (a, b) => a != null && b != null && String(a) !== String(b);
function valuesConflict(kind, a, b) {
  if (kind === "fare") return differ(a.amount_min, b.amount_min) || differ(a.amount_max, b.amount_max);
  if (kind === "hours")
    return differ(a.starts_local, b.starts_local) || differ(a.ends_local, b.ends_local) || differ(norm(a.days_text) || null, norm(b.days_text) || null);
  if (kind === "service_status") return a.status !== "unknown" && b.status !== "unknown" && a.status !== b.status;
  if (kind === "walk") return differ(a.walk_m, b.walk_m) || differ(a.walk_min, b.walk_min);
  return false;
}

// ---------- core (pure) ----------
/**
 * @param posts   array of snapshot posts {id,title,question,permalink,answers:[{text}]}
 * @param cands   T11 candidate records (input order is preserved)
 * @param sha     snapshot sha256 of `posts`
 * @returns reviewed candidate records (new objects)
 */
export function evaluate(posts, cands, sha) {
  const postById = new Map(posts.map((p) => [p.id, p]));
  const postCtx = new Map();
  const ctx = (p) => {
    if (!postCtx.has(p.id)) {
      const texts = [p.title, p.question, ...(p.answers ?? []).map((a) => a?.text)].filter((s) => typeof s === "string");
      const grams = new Set();
      for (const t of texts) for (const g of sixGrams(tokens(t))) grams.add(g);
      const qText = `${p.title ?? ""}\n${p.question ?? ""}`;
      const qToks = tokens(qText);
      postCtx.set(p.id, { grams, qToks, qSet: new Set(qToks) });
    }
    return postCtx.get(p.id);
  };
  const byId = new Map(cands.map((c) => [c.candidate_id, c]));

  const results = cands.map((c) => {
    const flags = new Set();
    const checks = {};
    const p = c.candidate_payload ?? {};
    const post = postById.get(c.post_id);
    const ci = c.comment_index;
    const locOk =
      !!post && c.snapshot_sha256 === sha &&
      (ci === null || (Number.isInteger(ci) && ci >= 0 && ci < (post.answers ?? []).length));
    checks.locator = locOk;
    if (!locOk) flags.add("bad_locator");

    let cited = "";
    if (locOk) cited = ci === null ? `${post.title ?? ""}\n${post.question ?? ""}` : String(post.answers[ci]?.text ?? "");
    const citedToks = tokens(cited);
    const citedSet = new Set(citedToks);

    // grounding
    if (locOk) {
      let grounded = true;
      if (c.record_kind === "fare") {
        const nums = numbersIn(cited);
        const free = /\b(free|libre|libreng|walang bayad)\b/i.test(cited);
        for (const k of ["amount_min", "amount_max"])
          if (p[k] != null && !nums.has(Number(p[k])) && !(Number(p[k]) === 0 && free)) grounded = false;
      } else if (c.record_kind === "hours") {
        grounded = hoursGrounded(p, cited);
      } else if (c.record_kind === "ride" || c.record_kind === "walk") {
        const fields = c.record_kind === "ride" ? ["signboard", "board_place", "alight_place"] : ["from_place", "to_place"];
        const { qToks, qSet } = ctx(post);
        for (const f of fields) {
          if (p[f] == null) continue;
          // place strings may name an endpoint stated in the question; allow that context too
          const ok = tokenOverlap(p[f], citedSet, citedToks) >= 0.8 ||
            (f !== "signboard" && tokenOverlap(p[f], qSet, qToks) >= 0.8);
          if (!ok) grounded = false;
        }
      }
      checks.grounded = grounded;
      if (!grounded) flags.add("value_not_in_source");
    }

    if (c.record_kind === "ride") {
      const complete = p.board_place != null && p.alight_place != null && p.mode != null;
      checks.connection_complete = complete;
      if (!complete) flags.add("incomplete_connection");
    }
    if (c.record_kind === "fare") {
      const r = p.applies_to_ride != null ? byId.get(p.applies_to_ride) : null;
      checks.fare_scoped = !!r && r.record_kind === "ride" && r.post_id === c.post_id;
      if (!checks.fare_scoped) flags.add("fare_unscoped");
      if (p.amount_min == null || p.amount_max == null) flags.add("fare_open_range");
    }
    if (locOk && hasHedge(cited)) flags.add("hedged");
    if (c.record_kind === "service_status" && (p.status === "suspended" || p.status === "retired")) flags.add("inactive_service");
    if (post && /^\[(removed|deleted)\]$/.test(String(post.question ?? "").trim())) flags.add("question_missing");

    // INV-4
    if (post) {
      const { grams } = ctx(post);
      for (const f of PARAPHRASE_FIELDS[c.record_kind] ?? []) {
        if (p[f] == null) continue;
        for (const g of sixGrams(tokens(p[f]))) if (grams.has(g)) { flags.add("raw_wording"); break; }
      }
    }
    for (const f of IDENTIFIER_FIELDS[c.record_kind] ?? []) if (p[f] != null && tokens(p[f]).length > 6) flags.add("long_identifier");
    if (allStrings(p).some(hasUsername)) flags.add("username");

    return { c, flags, checks, conflicts: new Set() };
  });

  // conflicts within post / kind / target
  const groups = new Map();
  for (const r of results) {
    const t = conflictTarget(r.c);
    if (!t) continue;
    const key = `${r.c.post_id}|${t}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }
  for (const g of groups.values()) {
    for (let i = 0; i < g.length; i++)
      for (let j = i + 1; j < g.length; j++)
        if (valuesConflict(g[i].c.record_kind, g[i].c.candidate_payload, g[j].c.candidate_payload)) {
          g[i].conflicts.add(g[j].c.candidate_id);
          g[j].conflicts.add(g[i].c.candidate_id);
        }
  }

  return results.map(({ c, flags, checks, conflicts }) => {
    if (conflicts.size) flags.add("conflict");
    const fl = [...flags].sort();
    const evidence_check = { checks, flags: fl };
    if (conflicts.size) evidence_check.conflicts_with = [...conflicts].sort();
    const review_state = decideState(c.record_kind, fl);
    return {
      ...c,
      evidence_check,
      review_reason: fl.length ? fl.join(",") : null,
      review_state,
      reviewer_id: null,
      reviewed_at: null,
    };
  });
}

// ---------- queue ----------
const KIND_LABEL = { ride: "Ride", walk: "Walk", fare: "Fare", hours: "Hours", service_status: "Service status", place: "Place", note: "Note" };
const FLAG_ASK = {
  incomplete_connection: "a boarding point, alighting point or mode is missing — supply it from the cited comment or reject",
  conflict: "other answers in this thread report a different value — keep both as separate reports or reject the unsupported one",
  hedged: "the answer sounds unsure — confirm the fact is stated clearly enough to use",
  inactive_service: "reported as suspended/retired — confirm the status so the service stays excluded from routing",
  value_not_in_source: "a place or signboard could not be matched in the cited text — confirm it is actually stated",
  question_missing: "the question text was removed — confirm the direction/endpoints are clear from the answer alone",
  fare_unscoped: "fare is not tied to a ride — link it to the right ride or leave unscoped",
  fare_open_range: "only one end of the fare range is known",
  long_identifier: "a name field is unusually long — shorten to the place/signboard name",
};
export function summarize(r) {
  const p = r.candidate_payload;
  const head =
    r.record_kind === "ride" ? `${KIND_LABEL.ride}${p.mode ? ` (${p.mode})` : ""}` : KIND_LABEL[r.record_kind] ?? r.record_kind;
  const asks = r.evidence_check.flags.filter((f) => FLAG_ASK[f]).map((f) => FLAG_ASK[f]);
  if (r.ai_override?.new_state === "needs_review") {
    const kind = r.ai_override.audit_kind === "rule_screen" ? "rule screen" : "audit";
    asks.push(`part-B ${kind} flagged ${r.ai_override.reason_code} — review the cited evidence before deciding`);
  }
  return `${head}: ${asks.join("; ")}.`;
}

export function buildQueue(posts, reviewed) {
  const postById = new Map(posts.map((p) => [p.id, p]));
  const placeFreq = new Map();
  const postPlaces = new Map();
  for (const r of reviewed) {
    if (r.record_kind !== "place") continue;
    const n = norm(r.candidate_payload.name);
    if (!n) continue;
    placeFreq.set(n, (placeFreq.get(n) ?? 0) + 1);
    if (!postPlaces.has(r.post_id)) postPlaces.set(r.post_id, new Set());
    postPlaces.get(r.post_id).add(n);
  }
  const byPost = new Map();
  for (const r of reviewed) {
    if (r.review_state !== "needs_review") continue;
    if (!byPost.has(r.post_id)) byPost.set(r.post_id, []);
    byPost.get(r.post_id).push({
      candidate_id: r.candidate_id,
      record_kind: r.record_kind,
      review_reason: r.review_reason,
      summary: summarize(r),
      comment_index: r.comment_index,
    });
  }
  const entries = [...byPost.entries()].map(([post_id, items]) => {
    const routeCritical = items.filter((i) => i.record_kind === "ride" || i.record_kind === "walk" || i.record_kind === "service_status").length;
    const placeScore = [...(postPlaces.get(post_id) ?? [])].reduce((s, n) => s + (placeFreq.get(n) ?? 0), 0);
    return { post_id, permalink: postById.get(post_id)?.permalink ?? null, route_critical_items: routeCritical, place_frequency: placeScore, items };
  });
  entries.sort(
    (a, b) =>
      (b.route_critical_items > 0) - (a.route_critical_items > 0) ||
      b.place_frequency - a.place_frequency ||
      b.route_critical_items - a.route_critical_items ||
      (a.post_id < b.post_id ? -1 : a.post_id > b.post_id ? 1 : 0)
  );
  return entries;
}

// ---------- reports ----------
const KINDS = ["place", "ride", "walk", "fare", "hours", "service_status", "note"];
const STATES = ["second_passed", "needs_review", "rejected", "accepted"];
export const REVIEWER_INSTRUCTIONS = [
  "Open data/raw/t12/review-queue.md (top posts) or review-queue.jsonl (all), follow the permalink and read the cited comment (comment_index = 0-based answers[] position; null = title/question).",
  "Decide each item in data/raw/t12/reviewed-candidates.jsonl: set review_state to \"accepted\" or \"rejected\" (only the designated human reviewer may do this; agents never set accepted).",
  "On every decision set reviewer_id to your member ID and reviewed_at to an ISO-8601 UTC timestamp (e.g. 2026-10-12T09:30:00Z); keep evidence_check and append your reason code to review_reason if it changes.",
  "Conflicting fare/hour reports are not merged: accept each supported report separately (they stay distinct in the pack) and reject only unsupported ones.",
  "Unresolved route-critical items (ride/walk/service_status) remain quarantined from the pack; suspended/retired services never route.",
  "Never paste comment wording or usernames into payload fields — paraphrase in your own words (INV-4).",
];

export function buildReport(reviewed, queue) {
  const table = Object.fromEntries(STATES.map((s) => [s, Object.fromEntries(KINDS.map((k) => [k, 0]))]));
  const flags = {};
  const flagsByState = {};
  let pairs = 0;
  for (const r of reviewed) {
    table[r.review_state][r.record_kind] = (table[r.review_state][r.record_kind] ?? 0) + 1;
    for (const f of r.evidence_check.flags) {
      flags[f] = (flags[f] ?? 0) + 1;
      flagsByState[f] ??= {};
      flagsByState[f][r.review_state] = (flagsByState[f][r.review_state] ?? 0) + 1;
    }
    pairs += (r.evidence_check.conflicts_with ?? []).length;
  }
  const sortedFlags = Object.fromEntries(Object.entries(flags).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)));
  return {
    task: "T12",
    part: "A (deterministic pass)",
    snapshot_sha256: SNAPSHOT_SHA256,
    candidates: reviewed.length,
    review_state_by_kind: table,
    review_state_totals: Object.fromEntries(STATES.map((s) => [s, Object.values(table[s]).reduce((a, b) => a + b, 0)])),
    flag_counts: sortedFlags,
    flag_counts_by_state: Object.fromEntries(Object.keys(sortedFlags).map((f) => [f, flagsByState[f]])),
    conflict_pairs: pairs / 2,
    queue: {
      posts: queue.length,
      items: queue.reduce((s, q) => s + q.items.length, 0),
      posts_with_route_critical_items: queue.filter((q) => q.route_critical_items > 0).length,
    },
    reviewer_instructions: REVIEWER_INSTRUCTIONS,
    notes: [
      "Second pass is a text-evidence check, not field verification; no field-verified badge.",
      "Place/board/alight/from/to grounding accepts ≥0.8 token overlap with the cited text or the post title/question; signboards must match the cited text.",
    ],
  };
}

function reportMd(r) {
  const row = (...c) => `| ${c.join(" | ")} |`;
  const L = [
    "# T12 evidence pass — counts",
    "",
    `Snapshot \`${r.snapshot_sha256}\`. ${r.candidates} candidates checked deterministically (part A). Counts only; no source text.`,
    "",
    "## Review state × record kind",
    "",
    row("state", ...KINDS, "total"),
    row("---", ...KINDS.map(() => "---:"), "---:"),
    ...STATES.map((s) => row(s, ...KINDS.map((k) => r.review_state_by_kind[s][k]), r.review_state_totals[s])),
    "",
    "## Flags",
    "",
    row("flag", "candidates", "second_passed", "needs_review", "rejected"),
    row("---", "---:", "---:", "---:", "---:"),
    ...Object.entries(r.flag_counts).map(([f, n]) =>
      row(f, n, r.flag_counts_by_state[f].second_passed ?? 0, r.flag_counts_by_state[f].needs_review ?? 0, r.flag_counts_by_state[f].rejected ?? 0)
    ),
    "",
    `Conflict pairs: ${r.conflict_pairs}.`,
    "",
    "## Review queue",
    "",
    `${r.queue.posts} posts / ${r.queue.items} items (${r.queue.posts_with_route_critical_items} posts with route-critical items), in data/raw/t12/review-queue.{jsonl,md} (not committed).`,
    "",
    "## Reviewer instructions",
    "",
    ...r.reviewer_instructions.map((s, i) => `${i + 1}. ${s}`),
    "",
    "## Notes",
    "",
    ...r.notes.map((s) => `- ${s}`),
    "",
  ];
  return L.join("\n");
}

export function queueMd(queue, top = 100) {
  const L = [
    "# T12 review queue — reviewer digest",
    "",
    `${queue.length} posts, ${queue.reduce((s, q) => s + q.items.length, 0)} items. Showing the top ${Math.min(top, queue.length)} posts (route-critical first, then by how often the post's places appear across the corpus). Full list: review-queue.jsonl.`,
    "",
    "## How to review",
    "",
    ...REVIEWER_INSTRUCTIONS.map((s, i) => `${i + 1}. ${s}`),
    "",
    "## Posts",
    "",
  ];
  queue.slice(0, top).forEach((q, n) => {
    L.push(`### ${n + 1}. ${q.post_id} — ${q.items.length} item(s), place score ${q.place_frequency}`, "", q.permalink ?? "(no permalink)", "");
    for (const i of q.items)
      L.push(`- [ ] \`${i.candidate_id}\` (comment ${i.comment_index ?? "question"}; ${i.review_reason}) — ${i.summary}`);
    L.push("");
  });
  return L.join("\n");
}

// ---------- CLI ----------
export function readCandidates(dir) {
  const out = [];
  for (let s = 0; s < 4; s++) {
    const f = path.join(dir, `candidates-s${s}.jsonl`);
    for (const line of readFileSync(f, "utf8").split(/\r?\n/)) if (line.trim()) out.push(JSON.parse(line));
  }
  return out;
}

const jsonl = (rows) => rows.map((r) => JSON.stringify(r)).join("\n") + "\n";

export function run({ out = path.join(ROOT, "data/raw/t12"), reportDir = path.join(HERE, "reports") } = {}) {
  const buf = readFileSync(path.join(ROOT, "howtogetthereph_dataset/ncr_routes.json"));
  const sha = createHash("sha256").update(buf).digest("hex");
  if (sha !== SNAPSHOT_SHA256) throw new Error(`snapshot sha256 mismatch: ${sha}`);
  const posts = JSON.parse(buf.toString("utf8"));
  const cands = readCandidates(path.join(ROOT, "data/raw/t11"));
  const reviewed = evaluate(posts, cands, sha);
  const queue = buildQueue(posts, reviewed);
  const report = buildReport(reviewed, queue);
  mkdirSync(out, { recursive: true });
  mkdirSync(reportDir, { recursive: true });
  writeFileSync(path.join(out, "reviewed-candidates.jsonl"), jsonl(reviewed));
  writeFileSync(path.join(out, "review-queue.jsonl"), jsonl(queue));
  writeFileSync(path.join(out, "review-queue.md"), queueMd(queue));
  writeFileSync(path.join(reportDir, "t12-evidence.json"), JSON.stringify(report, null, 2) + "\n");
  writeFileSync(path.join(reportDir, "t12-evidence.md"), reportMd(report));
  return report;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? path.resolve(process.argv[i + 1]) : undefined; };
  const r = run({ out: arg("--out"), reportDir: arg("--report-dir") });
  console.log(`T12 evidence pass done — ${r.candidates} candidates; ` +
    Object.entries(r.review_state_totals).map(([k, v]) => `${k} ${v}`).join(", ") +
    `; conflict pairs ${r.conflict_pairs}; queue ${r.queue.posts} posts / ${r.queue.items} items`);
}
