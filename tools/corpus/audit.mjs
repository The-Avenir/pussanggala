#!/usr/bin/env node
// T10 — Metadata-only audit of the supplied r/HowToGetTherePH snapshot.
//
// Usage: node tools/corpus/audit.mjs
//
// Writes (committed, counts only — no titles, questions, answers or usernames):
//   tools/corpus/reports/t10-audit.json
//   tools/corpus/reports/t10-audit.md
// Writes (gitignored, post-ID lists with flags; still no raw wording):
//   data/raw/t10/*.json
//
// Exits non-zero if the snapshot hash or recomputed NCR counts differ from SDD §1.2.
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const DATASET = path.join(ROOT, "howtogetthereph_dataset");
const REPORT_DIR = path.join(ROOT, "tools/corpus/reports");
const RAW_DIR = path.join(ROOT, "data/raw/t10");
const PROGRESS = path.join(ROOT, "data/raw/progress/T10.json");

export const EXPECTED_NCR_SHA256 = "d3939475ebd250755fcdac776f703001480aeaa4b72d04b025fba54434c4fdf3";
export const EXPECTED = {
  ncr: { posts: 3480, with_answers: 2186, without_answers: 1294, answer_texts: 3988 },
  all: { posts: 16387, with_answers: 8556, without_answers: 7831, answer_texts: 15350 },
};
// Figures as printed in howtogetthereph_dataset/README.md, for discrepancy reporting.
const README_CLAIMS = {
  ncr: { posts: 3480, with_answers: 2186, answer_texts: 3989 },
  all: { posts: 16387, with_answers: 8556, answer_texts: 15395 },
  ncr_csv_rows: 3480,
  all_csv_rows: 8556,
  max_answers_per_post: 12,
};

const SHORT_ANSWER_CHARS = 15;
const ACK_RE = /^\s*(thanks?( you)?|thank u|thx|ty|tysm|salamat( po)?|maraming salamat|noted|okay|ok|sige|got it|\+1|same)\b[\s!.,po]*$/i;
const MISSING_TEXT = new Set(["", "[deleted]", "[removed]"]);

// Outside-NCR keyword inventory (heuristic, case-insensitive, word-boundary match).
// Provinces/regions plus well-known non-NCR cities/towns that commonly appear as endpoints.
// This is an inventory flag only, NOT an NCR membership decision (that is T13's job).
export const OUTSIDE_NCR_KEYWORDS = [
  // Provinces / regions
  "cavite", "laguna", "batangas", "rizal", "quezon province", "bulacan", "pampanga", "tarlac",
  "nueva ecija", "zambales", "bataan", "aurora", "pangasinan", "la union", "ilocos", "isabela",
  "cagayan", "nueva vizcaya", "benguet", "mindoro", "marinduque", "romblon", "palawan",
  "camarines", "albay", "sorsogon", "bicol", "calabarzon", "central luzon", "visayas", "mindanao",
  "cebu", "iloilo", "bacolod", "davao", "cagayan de oro",
  // Rizal towns
  "antipolo", "cainta", "taytay", "angono", "binangonan", "san mateo", "rodriguez", "montalban",
  "tanay", "teresa", "morong", "baras", "cardona", "pililla", "jalajala",
  // Cavite towns/cities
  "bacoor", "imus", "dasmarinas", "dasmariñas", "general trias", "gentri", "kawit", "noveleta",
  "tanza", "trece martires", "silang", "tagaytay", "carmona", "gma cavite", "naic",
  "indang", "alfonso", "amadeo", "ternate", "maragondon",
  // Laguna towns/cities
  "san pedro laguna", "binan", "biñan", "santa rosa", "sta rosa", "sta. rosa", "cabuyao", "calamba",
  "los banos", "los baños", "san pablo", "sta cruz laguna", "nuvali",
  // Bulacan towns/cities
  "meycauayan", "marilao", "bocaue", "balagtas", "malolos", "san jose del monte", "sjdm",
  "norzagaray", "sta maria bulacan", "santa maria bulacan", "plaridel", "baliuag", "baliwag",
  "guiguinto", "obando", "pulilan",
  // Pampanga / further north
  "angeles", "clark", "san fernando pampanga", "mabalacat", "subic", "olongapo", "baguio",
  "dagupan", "cabanatuan", "vigan", "laoag",
  // Batangas / Quezon / south
  "lipa", "batangas city", "tanauan", "nasugbu", "lucena", "tayabas",
];
// Bus-operator names that contain a place keyword but denote an NCR terminal; stripped before matching.
export const OUTSIDE_NCR_EXCLUSIONS = [/baliwag transit/gi, /baliuag transit/gi];
const stripExclusions = (s) => OUTSIDE_NCR_EXCLUSIONS.reduce((t, re) => t.replace(re, " "), s);
const OUTSIDE_RE = new RegExp(
  "\\b(" + OUTSIDE_NCR_KEYWORDS.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") + ")\\b",
  "i",
);

function progress(percent, status, note) {
  try {
    mkdirSync(path.dirname(PROGRESS), { recursive: true });
    writeFileSync(PROGRESS, JSON.stringify({ task: "T10", percent, status, note }) + "\n");
  } catch { /* progress is best-effort */ }
}

const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

// RFC 4180 CSV parser (quoted fields, doubled quotes, embedded newlines).
export function parseCsv(text) {
  const rows = [];
  let row = [], field = "", i = 0, q = false;
  if (text.charCodeAt(0) === 0xfeff) i = 1;
  for (; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else q = false;
      } else field += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  const [header, ...body] = rows;
  return { header, records: body.filter((r) => r.length > 1 || r[0] !== "").map((r) => Object.fromEntries(header.map((h, j) => [h, r[j]]))) };
}

const isMissingText = (v) => v === null || v === undefined || (typeof v === "string" && MISSING_TEXT.has(v.trim()));
const valueState = (v) =>
  v === undefined ? "missing" : v === null ? "null" : (typeof v === "string" && v.trim() === "") || (Array.isArray(v) && v.length === 0) ? "empty" : "present";

function fieldInventory(items) {
  const keys = new Set();
  for (const it of items) for (const k of Object.keys(it)) keys.add(k);
  const out = {};
  for (const k of [...keys].sort()) {
    const s = { present: 0, missing: 0, null: 0, empty: 0, types: {} };
    for (const it of items) {
      s[valueState(it[k])]++;
      const t = it[k] === null ? "null" : Array.isArray(it[k]) ? "array" : typeof it[k];
      s.types[t] = (s.types[t] ?? 0) + 1;
    }
    out[k] = s;
  }
  return out;
}

function basicCounts(posts) {
  const withA = posts.filter((p) => Array.isArray(p.answers) && p.answers.length > 0).length;
  return {
    posts: posts.length,
    with_answers: withA,
    without_answers: posts.length - withA,
    answer_texts: posts.reduce((s, p) => s + (Array.isArray(p.answers) ? p.answers.length : 0), 0),
  };
}

function lengthStats(lengths) {
  const a = [...lengths].sort((x, y) => x - y);
  if (!a.length) return null;
  const pct = (p) => a[Math.min(a.length - 1, Math.floor((p / 100) * a.length))];
  const max = a[a.length - 1];
  const hist = {};
  const buckets = [0, 15, 50, 100, 200, 500, 1000, 2000, Infinity];
  for (let b = 0; b < buckets.length - 1; b++) {
    const lo = buckets[b], hi = buckets[b + 1];
    hist[`${lo}-${hi === Infinity ? "inf" : hi - 1}`] = a.filter((n) => n >= lo && n < hi).length;
  }
  return {
    count: a.length, min: a[0], p50: pct(50), p90: pct(90), p99: pct(99), max,
    at_max: a.filter((n) => n === max).length,
    top5: a.slice(-5).reverse(),
    histogram: hist,
  };
}

// Truncation heuristics on a single text.
function truncationFlags(t) {
  const s = t.replace(/\s+$/, "");
  return {
    ellipsis: /(…|\.\.\.)$/.test(s),
    // Ends with a letter/digit and no terminal punctuation/emoji/closing bracket — weak "mid-sentence" signal.
    no_terminal_punct: /[\p{L}\p{N}]$/u.test(s),
    // Ends with a dangling connector word — stronger mid-thought signal.
    dangling_connector: /\b(and|or|the|to|from|sa|ng|at|tapos|then|pero|kasi|na|papunta|going)$/i.test(s),
  };
}

const iso = (sec) => new Date(sec * 1000).toISOString();

export function runAudit({ write = true } = {}) {
  progress(30, "running", "hashing inputs");
  const files = ["ncr_routes.json", "routes.json", "ncr_routes.csv", "routes.csv", "README.md"];
  const buf = Object.fromEntries(files.map((f) => [f, readFileSync(path.join(DATASET, f))]));
  const hashes = Object.fromEntries(files.map((f) => [f, { sha256: sha256(buf[f]), bytes: buf[f].length }]));

  const ncr = JSON.parse(buf["ncr_routes.json"].toString("utf8"));
  const all = JSON.parse(buf["routes.json"].toString("utf8"));
  const ncrCsv = parseCsv(buf["ncr_routes.csv"].toString("utf8"));
  const allCsv = parseCsv(buf["routes.csv"].toString("utf8"));

  progress(45, "running", "counts and field inventory");
  const counts = { ncr: basicCounts(ncr), all: basicCounts(all) };
  const answersNcr = ncr.flatMap((p) => p.answers);

  // Expected-absent metadata.
  const postKeys = new Set(ncr.flatMap((p) => Object.keys(p)));
  const ansKeys = new Set(answersNcr.flatMap((a) => Object.keys(a)));
  const lookFor = {
    comment_ids: ["id", "comment_id", "name"],
    comment_dates: ["created_utc", "created", "date", "timestamp"],
    reply_parent: ["parent_id", "parent", "reply_to", "depth", "replies"],
    comment_author: ["author", "username", "user"],
  };
  const absentOnAnswers = Object.fromEntries(Object.entries(lookFor).map(([k, ks]) => [k, !ks.some((x) => ansKeys.has(x))]));
  const postLook = {
    coordinates: ["lat", "lng", "lon", "latitude", "longitude", "coordinates", "geometry"],
    structured_stops: ["stops", "legs", "segments", "path", "route"],
    fares: ["fare", "fares", "price", "cost"],
    post_author: ["author", "username", "user"],
  };
  const absentOnPosts = Object.fromEntries(Object.entries(postLook).map(([k, ks]) => [k, !ks.some((x) => postKeys.has(x))]));

  progress(55, "running", "missing question text");
  const missingQ = { null: 0, empty: 0, deleted: 0, removed: 0 };
  const missingQIds = [];
  let missingQWithAnswers = 0;
  for (const p of ncr) {
    const q = p.question;
    let k = null;
    if (q === null || q === undefined) k = "null";
    else if (q.trim() === "") k = "empty";
    else if (q.trim() === "[deleted]") k = "deleted";
    else if (q.trim() === "[removed]") k = "removed";
    if (k) {
      missingQ[k]++;
      missingQIds.push({ post_id: p.id, kind: k, stored_answers: p.answers.length });
      if (p.answers.length) missingQWithAnswers++;
    }
  }
  const missingTitles = ncr.filter((p) => isMissingText(p.title)).length;
  const missingAnswerTexts = answersNcr.filter((a) => isMissingText(a.text)).length;

  progress(65, "running", "truncation heuristics");
  const ansLen = lengthStats(answersNcr.map((a) => a.text.length));
  const qLen = lengthStats(ncr.filter((p) => !isMissingText(p.question)).map((p) => p.question.length));
  const tFlags = (texts) => {
    const r = { ellipsis: 0, no_terminal_punct: 0, dangling_connector: 0 };
    for (const t of texts) for (const [k, v] of Object.entries(truncationFlags(t))) if (v) r[k]++;
    return r;
  };
  const ansTrunc = tFlags(answersNcr.map((a) => a.text));
  const qTrunc = tFlags(ncr.filter((p) => !isMissingText(p.question)).map((p) => p.question));

  // CSV vs JSON comparison.
  const byId = new Map(ncr.map((p) => [p.id, p]));
  const csvCmp = {
    csv_rows: ncrCsv.records.length, csv_header: ncrCsv.header,
    ids_not_in_json: 0, json_ids_not_in_csv: 0,
    csv_rows_with_empty_top_answer: 0,
    csv_top_answer_nonempty_but_json_unanswered: 0,
    top_equals_json_first_answer: 0,
    top_equals_json_highest_score_answer: 0,
    top_equals_some_json_answer: 0,
    top_is_prefix_of_json_answer: 0,
    top_matches_no_json_answer: 0,
    csv_answers_col_equals_json_answer_count: 0,
    csv_answers_col_equals_json_answers_length: 0,
    csv_top_answer_lengths: null,
  };
  const csvMismatchIds = [];
  const csvIds = new Set();
  const norm = (s) => s.replace(/\r\n/g, "\n").trim();
  const topLens = [];
  for (const r of ncrCsv.records) {
    csvIds.add(r.id);
    const p = byId.get(r.id);
    if (!p) { csvCmp.ids_not_in_json++; continue; }
    const top = norm(r.top_answer ?? "");
    if (!top) { csvCmp.csv_rows_with_empty_top_answer++; }
    else {
      topLens.push(top.length);
      if (!p.answers.length) csvCmp.csv_top_answer_nonempty_but_json_unanswered++;
      const texts = p.answers.map((a) => norm(a.text));
      const best = p.answers.length ? norm([...p.answers].sort((a, b) => b.score - a.score)[0].text) : null;
      if (texts[0] === top) csvCmp.top_equals_json_first_answer++;
      if (best === top) csvCmp.top_equals_json_highest_score_answer++;
      if (texts.includes(top)) csvCmp.top_equals_some_json_answer++;
      else if (texts.some((t) => t.startsWith(top))) { csvCmp.top_is_prefix_of_json_answer++; csvMismatchIds.push({ post_id: r.id, flag: "csv_top_is_truncated_prefix" }); }
      else { csvCmp.top_matches_no_json_answer++; csvMismatchIds.push({ post_id: r.id, flag: "csv_top_matches_no_json_answer" }); }
    }
    if (Number(r.answers) === p.answer_count) csvCmp.csv_answers_col_equals_json_answer_count++;
    if (Number(r.answers) === p.answers.length) csvCmp.csv_answers_col_equals_json_answers_length++;
  }
  for (const p of ncr) if (!csvIds.has(p.id)) csvCmp.json_ids_not_in_csv++;
  csvCmp.csv_top_answer_lengths = lengthStats(topLens);

  progress(75, "running", "outside-NCR labels");
  const outside = { origin: 0, destination: 0, title: 0, any: 0, origin_or_destination: 0, both_endpoints: 0 };
  const outsideIds = [];
  const kwHits = {};
  const missingEndpoints = { origin: 0, destination: 0 };
  for (const p of ncr) {
    if (isMissingText(p.origin)) missingEndpoints.origin++;
    if (isMissingText(p.destination)) missingEndpoints.destination++;
    const f = {};
    for (const k of ["origin", "destination", "title"]) {
      const m = typeof p[k] === "string" ? stripExclusions(p[k]).match(OUTSIDE_RE) : null;
      f[k] = m ? m[1].toLowerCase() : null;
      if (m) outside[k]++;
    }
    const any = f.origin || f.destination || f.title;
    if (any) {
      outside.any++;
      for (const kw of new Set(Object.values(f).filter(Boolean))) kwHits[kw] = (kwHits[kw] ?? 0) + 1;
      outsideIds.push({ post_id: p.id, origin_kw: f.origin, destination_kw: f.destination, title_kw: f.title, stored_answers: p.answers.length });
    }
    if (f.origin || f.destination) outside.origin_or_destination++;
    if (f.origin && f.destination) outside.both_endpoints++;
  }
  outside.flagged_with_answers = outsideIds.filter((x) => x.stored_answers > 0).length;
  outside.keyword_hits = Object.fromEntries(Object.entries(kwHits).sort((a, b) => b[1] - a[1]));

  progress(85, "running", "dates, comment-count and duplicates");
  const ts = ncr.map((p) => p.created_utc).filter((n) => typeof n === "number");
  const cc = { answer_count_ne_answers_length: 0, answer_count_gt_answers_length: 0, answer_count_lt_answers_length: 0,
    num_comments_lt_answers_length: 0, num_comments_lt_answer_count: 0, num_comments_zero_with_answers: 0,
    sum_answer_count: 0, sum_num_comments: 0, sum_answers_length: counts.ncr.answer_texts,
    answers_length_at_cap_12: 0, answers_length_distribution: {} };
  const ccIds = [];
  for (const p of ncr) {
    const n = p.answers.length;
    cc.sum_answer_count += p.answer_count;
    cc.sum_num_comments += p.num_comments;
    cc.answers_length_distribution[n] = (cc.answers_length_distribution[n] ?? 0) + 1;
    if (n === 12) cc.answers_length_at_cap_12++;
    const flags = [];
    if (p.answer_count !== n) { cc.answer_count_ne_answers_length++; flags.push("answer_count_ne_answers_length"); }
    if (p.answer_count > n) cc.answer_count_gt_answers_length++;
    if (p.answer_count < n) cc.answer_count_lt_answers_length++;
    if (p.num_comments < n) { cc.num_comments_lt_answers_length++; flags.push("num_comments_lt_answers_length"); }
    if (p.num_comments < p.answer_count) cc.num_comments_lt_answer_count++;
    if (p.num_comments === 0 && n > 0) cc.num_comments_zero_with_answers++;
    if (flags.length) ccIds.push({ post_id: p.id, flags, answer_count: p.answer_count, answers_length: n, num_comments: p.num_comments });
  }
  const dupes = (arr) => { const seen = new Map(); for (const v of arr) seen.set(v, (seen.get(v) ?? 0) + 1); return [...seen].filter(([, c]) => c > 1); };
  const dupIds = dupes(ncr.map((p) => p.id));
  const dupLinks = dupes(ncr.map((p) => p.permalink));
  const ncrIdsInAll = (() => { const s = new Set(all.map((p) => p.id)); return ncr.filter((p) => s.has(p.id)).length; })();

  progress(90, "running", "short/acknowledgement answers");
  let short = 0, ack = 0, shortOrAck = 0;
  const shortIds = [];
  ncr.forEach((p) => p.answers.forEach((a, i) => {
    const isShort = a.text.trim().length < SHORT_ANSWER_CHARS, isAck = ACK_RE.test(a.text);
    if (isShort) short++;
    if (isAck) ack++;
    if (isShort || isAck) { shortOrAck++; shortIds.push({ post_id: p.id, comment_index: i, short: isShort, ack: isAck }); }
  }));
  const postsOnlyShortOrAck = ncr.filter((p) => p.answers.length && p.answers.every((a) => a.text.trim().length < SHORT_ANSWER_CHARS || ACK_RE.test(a.text))).length;

  // Assertions.
  const failures = [];
  // The snapshot contract hashes text with CRLF normalized to LF. Keep the
  // exact on-disk hashes/byte counts above for the audit inventory.
  const ncrSnapshotSha = sha256(Buffer.from(buf["ncr_routes.json"].toString("utf8").replace(/\r\n/g, "\n")));
  if (ncrSnapshotSha !== EXPECTED_NCR_SHA256)
    failures.push(`ncr_routes.json LF-normalized sha256 ${ncrSnapshotSha} != expected ${EXPECTED_NCR_SHA256}`);
  for (const scope of ["ncr", "all"])
    for (const [k, v] of Object.entries(EXPECTED[scope]))
      if (counts[scope][k] !== v) failures.push(`${scope}.${k}: recomputed ${counts[scope][k]} != expected ${v}`);

  const discrepancies = [];
  if (README_CLAIMS.ncr.answer_texts !== counts.ncr.answer_texts)
    discrepancies.push({ item: "NCR answers total", readme: README_CLAIMS.ncr.answer_texts, stored_answers_arrays: counts.ncr.answer_texts,
      sum_of_answer_count_field: cc.sum_answer_count,
      explanation: "README total equals the sum of the answer_count field; one or more posts have answer_count greater than stored answers[] length (answers capped at 12)." });
  if (README_CLAIMS.all.answer_texts !== counts.all.answer_texts)
    discrepancies.push({ item: "All-posts answers total", readme: README_CLAIMS.all.answer_texts, stored_answers_arrays: counts.all.answer_texts,
      sum_of_answer_count_field: all.reduce((s, p) => s + (p.answer_count ?? 0), 0) });
  if (README_CLAIMS.ncr_csv_rows !== ncrCsv.records.length)
    discrepancies.push({ item: "ncr_routes.csv rows", readme: README_CLAIMS.ncr_csv_rows, actual: ncrCsv.records.length });
  if (README_CLAIMS.all_csv_rows !== allCsv.records.length)
    discrepancies.push({ item: "routes.csv rows", readme: README_CLAIMS.all_csv_rows, actual: allCsv.records.length });

  const report = {
    task: "T10",
    generator: "tools/corpus/audit.mjs",
    content_policy: "Metadata and counts only. No titles, questions, answers, endpoints text or usernames. Post-ID lists live in data/raw/t10/ (gitignored).",
    snapshot: { dataset_dir: "howtogetthereph_dataset", source_commit: "3732824", ncr_routes_json_sha256: ncrSnapshotSha },
    input_files: hashes,
    counts: { ncr_routes_json: counts.ncr, routes_json: counts.all, ncr_routes_csv_rows: ncrCsv.records.length, routes_csv_rows: allCsv.records.length,
      ncr_post_ids_present_in_routes_json: ncrIdsInAll },
    expected: EXPECTED,
    readme_discrepancies: discrepancies,
    field_inventory: { posts: fieldInventory(ncr), answers: fieldInventory(answersNcr), routes_json_post_keys: [...new Set(all.flatMap((p) => Object.keys(p)))].sort() },
    absent_metadata: { on_answers: absentOnAnswers, on_posts: absentOnPosts,
      note: "true = no such field exists. Answers carry only score and text; no comment IDs, comment dates, authors or reply-parent links." },
    missing_text: { question: missingQ, question_missing_total: missingQIds.length, question_missing_but_has_answers: missingQWithAnswers,
      title_missing: missingTitles, answer_text_missing: missingAnswerTexts, endpoint_missing: missingEndpoints },
    truncation: {
      answers: { length: ansLen, flags: ansTrunc },
      questions_present: { length: qLen, flags: qTrunc },
      note: "Heuristic. No hard length cap observed if at_max is 1 and max is an outlier. no_terminal_punct is a weak signal (informal writing often omits punctuation).",
      csv_vs_json: csvCmp,
    },
    outside_ncr_labels: { ...outside, keyword_list_size: OUTSIDE_NCR_KEYWORDS.length,
      note: "Keyword heuristic over origin/destination/title. Inventory only; not an NCR membership decision. Keyword list is OUTSIDE_NCR_KEYWORDS in audit.mjs; operator names in OUTSIDE_NCR_EXCLUSIONS (e.g. Baliwag Transit terminals) are stripped first. NCR posts naming a non-NCR endpoint without a listed keyword are not caught." },
    created_utc: { min: ts.length ? iso(Math.min(...ts)) : null, max: ts.length ? iso(Math.max(...ts)) : null, non_numeric: ncr.length - ts.length },
    comment_counts: cc,
    duplicates: { duplicate_post_ids: dupIds.length, duplicate_permalinks: dupLinks.length },
    short_or_ack_answers: { threshold_chars: SHORT_ANSWER_CHARS, short: short, ack_pattern: ack, short_or_ack: shortOrAck,
      posts_whose_answers_are_all_short_or_ack: postsOnlyShortOrAck },
    assertions: { passed: failures.length === 0, failures },
  };

  if (write) {
    mkdirSync(REPORT_DIR, { recursive: true });
    mkdirSync(RAW_DIR, { recursive: true });
    writeFileSync(path.join(REPORT_DIR, "t10-audit.json"), JSON.stringify(report, null, 2) + "\n");
    writeFileSync(path.join(REPORT_DIR, "t10-audit.md"), renderMd(report));
    const dump = (n, v) => writeFileSync(path.join(RAW_DIR, n), JSON.stringify(v, null, 2) + "\n");
    dump("missing-question.json", missingQIds);
    dump("outside-ncr-flags.json", outsideIds);
    dump("comment-count-mismatch.json", ccIds);
    dump("csv-top-answer-mismatch.json", csvMismatchIds);
    dump("short-or-ack-answers.json", shortIds);
    dump("duplicates.json", { post_ids: dupIds, permalinks: dupLinks.length });
  }
  return report;
}

function renderMd(r) {
  const c = r.counts, n = c.ncr_routes_json, a = c.routes_json, t = r.truncation, o = r.outside_ncr_labels, cc = r.comment_counts;
  const row = (...x) => `| ${x.join(" | ")} |`;
  return [
    "# T10 — NCR input audit (metadata only)",
    "",
    "Generated by `node tools/corpus/audit.mjs`. Counts only; no source wording, titles or usernames. Per-post ID lists are in `data/raw/t10/` (gitignored).",
    "",
    `Assertions: **${r.assertions.passed ? "PASS" : "FAIL"}**${r.assertions.failures.length ? " — " + r.assertions.failures.join("; ") : ""}`,
    "",
    "## Input hashes",
    "",
    row("File", "Bytes", "sha256"), row("---", "---:", "---"),
    ...Object.entries(r.input_files).map(([f, h]) => row(`\`${f}\``, h.bytes, `\`${h.sha256}\``)),
    "",
    "## Counts",
    "",
    row("Input", "Posts", "With stored answers", "Without", "Stored answer texts"), row("---", "---:", "---:", "---:", "---:"),
    row("ncr_routes.json", n.posts, n.with_answers, n.without_answers, n.answer_texts),
    row("routes.json", a.posts, a.with_answers, a.without_answers, a.answer_texts),
    "",
    `CSV rows: ncr_routes.csv ${c.ncr_routes_csv_rows}, routes.csv ${c.routes_csv_rows}. NCR post IDs also in routes.json: ${c.ncr_post_ids_present_in_routes_json}/${n.posts}.`,
    "",
    "## README discrepancies",
    "",
    ...(r.readme_discrepancies.length ? r.readme_discrepancies.map((d) => `- ${d.item}: README ${d.readme}, actual ${d.stored_answers_arrays ?? d.actual}${d.sum_of_answer_count_field !== undefined ? ` (sum of \`answer_count\` field = ${d.sum_of_answer_count_field})` : ""}.${d.explanation ? " " + d.explanation : ""}`) : ["- None."]),
    "",
    "## Fields",
    "",
    `Post keys: ${Object.keys(r.field_inventory.posts).map((k) => `\`${k}\``).join(", ")}.`,
    `Answer keys: ${Object.keys(r.field_inventory.answers).map((k) => `\`${k}\``).join(", ")}.`,
    "",
    row("Post field", "present", "missing", "null", "empty"), row("---", "---:", "---:", "---:", "---:"),
    ...Object.entries(r.field_inventory.posts).map(([k, s]) => row(`\`${k}\``, s.present, s.missing, s.null, s.empty)),
    ...Object.entries(r.field_inventory.answers).map(([k, s]) => row(`answer \`${k}\``, s.present, s.missing, s.null, s.empty)),
    "",
    "Confirmed absent (no such field): " + [...Object.entries(r.absent_metadata.on_answers), ...Object.entries(r.absent_metadata.on_posts)].map(([k, v]) => `${k}=${v ? "absent" : "PRESENT"}`).join(", ") + ".",
    "",
    "## Missing question text",
    "",
    `null ${r.missing_text.question.null}, empty ${r.missing_text.question.empty}, \`[deleted]\` ${r.missing_text.question.deleted}, \`[removed]\` ${r.missing_text.question.removed} — total ${r.missing_text.question_missing_total}; of these ${r.missing_text.question_missing_but_has_answers} still have stored answers. Missing titles ${r.missing_text.title_missing}; missing answer texts ${r.missing_text.answer_text_missing}; missing origin ${r.missing_text.endpoint_missing.origin}, destination ${r.missing_text.endpoint_missing.destination}.`,
    "",
    "## Truncation heuristics",
    "",
    row("Text", "n", "min", "p50", "p90", "p99", "max", "at max", "ends …/...", "no terminal punct", "dangling connector"),
    row("---", "---:", "---:", "---:", "---:", "---:", "---:", "---:", "---:", "---:", "---:"),
    row("answers", t.answers.length.count, t.answers.length.min, t.answers.length.p50, t.answers.length.p90, t.answers.length.p99, t.answers.length.max, t.answers.length.at_max, t.answers.flags.ellipsis, t.answers.flags.no_terminal_punct, t.answers.flags.dangling_connector),
    row("questions", t.questions_present.length.count, t.questions_present.length.min, t.questions_present.length.p50, t.questions_present.length.p90, t.questions_present.length.p99, t.questions_present.length.max, t.questions_present.length.at_max, t.questions_present.flags.ellipsis, t.questions_present.flags.no_terminal_punct, t.questions_present.flags.dangling_connector),
    "",
    `Answer length histogram: ${Object.entries(t.answers.length.histogram).map(([k, v]) => `${k}: ${v}`).join(", ")}.`,
    "",
    `CSV \`top_answer\` vs JSON (ncr_routes.csv, ${t.csv_vs_json.csv_rows} rows): empty top_answer ${t.csv_vs_json.csv_rows_with_empty_top_answer}; equals JSON first answer ${t.csv_vs_json.top_equals_json_first_answer}; equals highest-score answer ${t.csv_vs_json.top_equals_json_highest_score_answer}; equals some answer ${t.csv_vs_json.top_equals_some_json_answer}; truncated prefix of an answer ${t.csv_vs_json.top_is_prefix_of_json_answer}; matches no answer ${t.csv_vs_json.top_matches_no_json_answer}; non-empty top but JSON unanswered ${t.csv_vs_json.csv_top_answer_nonempty_but_json_unanswered}. CSV IDs missing from JSON ${t.csv_vs_json.ids_not_in_json}; JSON IDs missing from CSV ${t.csv_vs_json.json_ids_not_in_csv}. CSV \`answers\` column equals JSON \`answer_count\` for ${t.csv_vs_json.csv_answers_col_equals_json_answer_count} rows and \`answers.length\` for ${t.csv_vs_json.csv_answers_col_equals_json_answers_length}. CSV top_answer length max ${t.csv_vs_json.csv_top_answer_lengths.max} with ${t.csv_vs_json.csv_top_answer_lengths.at_max} rows exactly at max (apparent CSV length cap; JSON answers have no such cap).`,
    "",
    "## Outside-NCR labels (heuristic inventory)",
    "",
    `Posts flagged: ${o.any} (origin ${o.origin}, destination ${o.destination}, title ${o.title}; origin-or-destination ${o.origin_or_destination}; both endpoints ${o.both_endpoints}; flagged with stored answers ${o.flagged_with_answers}). Keyword list (${o.keyword_list_size} terms) is \`OUTSIDE_NCR_KEYWORDS\` in \`audit.mjs\`. Not a membership decision — T13 decides via geography evidence.`,
    "",
    `Top keywords: ${Object.entries(o.keyword_hits).slice(0, 15).map(([k, v]) => `${k} ${v}`).join(", ")}.`,
    "",
    "## Dates, comment counts, duplicates",
    "",
    `created_utc range: ${r.created_utc.min} → ${r.created_utc.max}.`,
    "",
    `Sum of \`answers.length\` ${cc.sum_answers_length}; sum of \`answer_count\` ${cc.sum_answer_count}; sum of \`num_comments\` ${cc.sum_num_comments}. \`answer_count\` ≠ \`answers.length\`: ${cc.answer_count_ne_answers_length} (greater ${cc.answer_count_gt_answers_length}, less ${cc.answer_count_lt_answers_length}). \`num_comments\` < \`answers.length\`: ${cc.num_comments_lt_answers_length}; \`num_comments\` = 0 with answers: ${cc.num_comments_zero_with_answers}. Posts at the 12-answer cap: ${cc.answers_length_at_cap_12}.`,
    "",
    `Duplicate post IDs: ${r.duplicates.duplicate_post_ids}; duplicate permalinks: ${r.duplicates.duplicate_permalinks}.`,
    "",
    "## Short / acknowledgement answers",
    "",
    `< ${r.short_or_ack_answers.threshold_chars} chars: ${r.short_or_ack_answers.short}; thanks/salamat-style pattern: ${r.short_or_ack_answers.ack_pattern}; either: ${r.short_or_ack_answers.short_or_ack}. Answered posts whose answers are all short/ack: ${r.short_or_ack_answers.posts_whose_answers_are_all_short_or_ack}.`,
    "",
  ].join("\n");
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const r = runAudit();
  if (!r.assertions.passed) {
    console.error("T10 audit FAILED:\n  " + r.assertions.failures.join("\n  "));
    progress(100, "blocked", "assertions failed: " + r.assertions.failures.join("; "));
    process.exit(1);
  }
  const n = r.counts.ncr_routes_json;
  console.log(`T10 audit PASS — sha256 ok; NCR ${n.posts} posts / ${n.with_answers} answered / ${n.without_answers} unanswered / ${n.answer_texts} answers`);
  console.log("Wrote tools/corpus/reports/t10-audit.{json,md} and data/raw/t10/*.json");
  progress(100, "done", "audit + assertions pass");
}
