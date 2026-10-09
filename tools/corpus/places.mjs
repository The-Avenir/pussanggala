// T13 — canonical NCR places, alias resolution and mapping evidence.
//
//   node tools/corpus/places.mjs [--out <dir>] [--report-dir <dir>]
//
// Reads data/raw/t12/reviewed-candidates.jsonl + tools/corpus/gazetteer.json and
// writes:
//   <out>/places.json       canonical places (gazetteer-declared only)
//   <out>/aliases.json      alias_norm -> place_key
//   <out>/ambiguities.json  alias_norm -> >=2 place_keys (never in aliases.json)
//   <out>/unresolved.json   alias_norms with no gazetteer coverage (not endpoints)
//   <out>/mentions.json     per-alias role counts {place,ride_board,ride_alight,walk_from,walk_to}
//   <report-dir>/t13-places.{md,json}   (counts only — committed, no source text)
// This repo holds no geodata/coordinate source: lat/lng pass through the
// gazetteer and stay null otherwise; nothing here invents coordinates.
// Re-runs are byte-identical.
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { normalizeAlias, STABLE_ID_RE } from "../pack-builder/lib/spec.mjs";
import { SNAPSHOT_SHA256 } from "./evidence.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const GAZETTEER = path.join(HERE, "gazetteer.json");

const ELIGIBLE_STATES = new Set(["second_passed", "accepted"]);
const MENTION_FIELDS = ["place", "ride_board", "ride_alight", "walk_from", "walk_to"];
const NCR_LGUS = new Set(
  ["Caloocan", "Las Pinas", "Makati", "Malabon", "Mandaluyong", "Manila", "Marikina",
    "Muntinlupa", "Navotas", "Paranaque", "Pasay", "Pasig", "Pateros", "Quezon City",
    "San Juan", "Taguig", "Valenzuela"].map(normalizeAlias)
);

const effectiveState = (r) => (r.ai_override ? r.ai_override.new_state : r.review_state);

// ---------- alias universe ----------
function* placeStrings(r) {
  const p = r.candidate_payload ?? {};
  if (r.record_kind === "place") yield ["place", p.name];
  else if (r.record_kind === "ride") {
    yield ["ride_board", p.board_place];
    yield ["ride_alight", p.alight_place];
  } else if (r.record_kind === "walk") {
    yield ["walk_from", p.from_place];
    yield ["walk_to", p.to_place];
  }
}

/** alias_norm -> {mentions, roles{...}, posts:Set, spellings:Map(raw->n)} */
export function collectUniverse(reviewed) {
  const uni = new Map();
  for (const r of reviewed) {
    if (!ELIGIBLE_STATES.has(effectiveState(r))) continue;
    for (const [role, raw] of placeStrings(r)) {
      if (raw == null) continue;
      const alias_norm = normalizeAlias(raw);
      if (alias_norm === "") continue;
      if (!uni.has(alias_norm))
        uni.set(alias_norm, { mentions: 0, roles: Object.fromEntries(MENTION_FIELDS.map((f) => [f, 0])), posts: new Set(), spellings: new Map() });
      const u = uni.get(alias_norm);
      u.mentions++;
      u.roles[role]++;
      u.posts.add(r.post_id);
      const s = String(raw);
      u.spellings.set(s, (u.spellings.get(s) ?? 0) + 1);
    }
  }
  return uni;
}

/** Most frequent raw spelling; ties broken lexicographically. */
function displayOf(u, fallback) {
  let best = null;
  for (const [s, n] of u?.spellings ?? [])
    if (best === null || n > best.n || (n === best.n && s < best.s)) best = { s, n };
  return best ? best.s : fallback;
}

// ---------- gazetteer ----------
/** place_id = "pl_" + slug + "-" + first 6 hex of sha256(place_key); matches STABLE_ID_RE. */
export function makeId(place_key) {
  let slug = String(place_key).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-{2,}/g, "-").replace(/^-+|-+$/g, "");
  const hash = createHash("sha256").update(place_key).digest("hex").slice(0, 6);
  slug = slug.slice(0, 57).replace(/-+$/g, "") || "x"; // "pl_" + slug + "-" + hash <= 67 chars
  return `pl_${slug}-${hash}`;
}

export function ncrStatus(city) {
  if (city == null || String(city).trim() === "") return "ambiguous";
  return NCR_LGUS.has(normalizeAlias(city)) ? "accepted" : "outside";
}

/** Rule-8 gazetteer validation; throws listing offending keys/aliases only. */
export function checkGazetteer(gz) {
  const bad = [];
  const keys = new Set();
  const aliasOwner = new Map();
  const ambiguous = gz.ambiguous_aliases ?? {};
  for (const e of gz.places ?? []) {
    if (keys.has(e.key)) bad.push(`duplicate place_key ${e.key}`);
    keys.add(e.key);
    for (const a of e.aliases ?? []) {
      if (a !== normalizeAlias(a)) bad.push(`unnormalized alias ${a} (place ${e.key})`);
      if (aliasOwner.has(a)) bad.push(`alias ${a} in both ${aliasOwner.get(a)} and ${e.key}`);
      aliasOwner.set(a, e.key);
    }
    if ((e.lat != null) !== (e.lng != null)) bad.push(`half-set coordinates on ${e.key}`);
  }
  for (const [a, ks] of Object.entries(ambiguous)) {
    if (a !== normalizeAlias(a)) bad.push(`unnormalized ambiguous alias ${a}`);
    if (!Array.isArray(ks) || ks.length < 2) bad.push(`ambiguous alias ${a} lists <2 place_keys`);
    else for (const k of ks) if (!keys.has(k)) bad.push(`ambiguous alias ${a} -> unknown place_key ${k}`);
    if (aliasOwner.has(a)) bad.push(`alias ${a} in both ${aliasOwner.get(a)}.aliases and ambiguous_aliases`);
  }
  const ids = new Map();
  for (const e of gz.places ?? []) {
    const id = makeId(e.key);
    if (!STABLE_ID_RE.test(id)) bad.push(`place_id ${id} for ${e.key} fails STABLE_ID_RE`);
    if (ids.has(id)) bad.push(`place_id collision ${id}: ${ids.get(id)} + ${e.key}`);
    ids.set(id, e.key);
  }
  if (bad.length) throw new Error(`gazetteer validation failed:\n  ${bad.join("\n  ")}`);
  return { keys, aliasOwner, ambiguous };
}

const mappingStatus = (e) =>
  typeof e.lat === "number" && typeof e.lng === "number" && typeof e.mapping_source === "string" && e.mapping_source !== ""
    ? "mapped"
    : "unmapped";

// ---------- build ----------
export function build(reviewed, gz) {
  const { aliasOwner, ambiguous } = checkGazetteer(gz);
  const uni = collectUniverse(reviewed);

  const places = (gz.places ?? []).map((e) => {
    const aliases = e.aliases ?? [];
    let mention_count = 0;
    const posts = new Set();
    for (const a of aliases) {
      const u = uni.get(a);
      if (!u) continue;
      mention_count += u.mentions;
      for (const p of u.posts) posts.add(p);
    }
    return {
      place_key: e.key,
      place_id: makeId(e.key),
      name: e.name,
      kind: e.kind,
      area: e.area,
      city: e.city ?? null,
      ncr_status: ncrStatus(e.city),
      lat: e.lat ?? null,
      lng: e.lng ?? null,
      mapping_status: mappingStatus(e),
      mention_count,
      post_count: posts.size,
      alias_count: aliases.length,
    };
  });
  places.sort((a, b) => (a.place_id < b.place_id ? -1 : a.place_id > b.place_id ? 1 : 0));

  const aliases = [];
  for (const e of gz.places ?? [])
    for (const a of e.aliases ?? []) {
      const u = uni.get(a);
      aliases.push({ alias_norm: a, alias_display: displayOf(u, a), place_key: e.key, mention_count: u?.mentions ?? 0 });
    }
  aliases.sort((a, b) => (a.alias_norm < b.alias_norm ? -1 : a.alias_norm > b.alias_norm ? 1 : 0));

  const ambiguities = [];
  for (const [a, ks] of Object.entries(ambiguous)) {
    const u = uni.get(a);
    for (const k of [...ks].sort())
      ambiguities.push({ alias_norm: a, place_key: k, mention_count: u?.mentions ?? 0 });
  }
  ambiguities.sort((a, b) => (a.alias_norm < b.alias_norm ? -1 : a.alias_norm > b.alias_norm ? 1 : a.place_key < b.place_key ? -1 : 1));

  const unresolved = [];
  for (const [a, u] of uni) {
    if (aliasOwner.has(a) || ambiguous[a]) continue;
    unresolved.push({ alias_norm: a, alias_display: displayOf(u, a), mention_count: u.mentions, post_count: u.posts.size });
  }
  unresolved.sort((a, b) => b.mention_count - a.mention_count || (a.alias_norm < b.alias_norm ? -1 : 1));

  const mentions = Object.fromEntries([...uni.keys()].sort().map((a) => [a, uni.get(a).roles]));
  return { places, aliases, ambiguities, unresolved, mentions, uni };
}

// ---------- report ----------
export function buildReport({ places, aliases, ambiguities, unresolved, uni }) {
  const totalMentions = [...uni.values()].reduce((s, u) => s + u.mentions, 0);
  const resolvedMentions = aliases.reduce((s, a) => s + a.mention_count, 0);
  const ambiguousMentions = ambiguities.reduce((s, a) => s + a.mention_count, 0);
  const byNcr = Object.fromEntries(["accepted", "outside", "ambiguous"].map((s) => [s, places.filter((p) => p.ncr_status === s).length]));
  const byMap = Object.fromEntries(["mapped", "unmapped", "needs_review"].map((s) => [s, places.filter((p) => p.mapping_status === s).length]));
  return {
    task: "T13",
    snapshot_sha256: SNAPSHOT_SHA256,
    alias_mentions_total: totalMentions,
    distinct_alias_norms: uni.size,
    canonical_places: places.length,
    aliases_resolved: aliases.length,
    aliases_resolved_with_mentions: aliases.filter((a) => a.mention_count > 0).length,
    ambiguous_alias_norms: new Set(ambiguities.map((a) => a.alias_norm)).size,
    ambiguous_place_refs: ambiguities.length,
    ambiguous_mentions: ambiguousMentions,
    unresolved_alias_norms: unresolved.length,
    unresolved_mentions: unresolved.reduce((s, a) => s + a.mention_count, 0),
    coverage_pct: totalMentions ? +(100 * (resolvedMentions / totalMentions)).toFixed(2) : 0,
    places_by_ncr_status: byNcr,
    places_by_mapping_status: byMap,
    notes: [
      "This repository contains no geodata or licensed coordinate source; lat/lng pass through the gazetteer verbatim and no coordinate is invented.",
      "Unresolved aliases are not pack-eligible endpoints; T14 cannot route to or from them.",
      "The dataset's own NCR label or bounding box is never used for ncr_status; membership is the curated city field only.",
    ],
  };
}

function reportMd(r) {
  const row = (...c) => `| ${c.join(" | ")} |`;
  const L = [
    "# T13 places engine — counts",
    "",
    `Snapshot \`${r.snapshot_sha256}\`. ${r.alias_mentions_total} place-name mentions across ${r.distinct_alias_norms} distinct normalized aliases. Counts only; no source text.`,
    "",
    "## Resolution",
    "",
    row("bucket", "count"),
    row("---", "---:"),
    row("canonical places", r.canonical_places),
    row("aliases resolved", `${r.aliases_resolved} (${r.aliases_resolved_with_mentions} observed)`),
    row("ambiguous aliases", `${r.ambiguous_alias_norms} (${r.ambiguous_place_refs} place refs)`),
    row("unresolved alias_norms", `${r.unresolved_alias_norms} (${r.unresolved_mentions} mentions)`),
    row("coverage (resolved mentions / total)", `${r.coverage_pct}%`),
    "",
    "## Places by ncr_status",
    "",
    row("ncr_status", "places"),
    row("---", "---:"),
    ...Object.entries(r.places_by_ncr_status).map(([k, v]) => row(k, v)),
    "",
    "## Places by mapping_status",
    "",
    row("mapping_status", "places"),
    row("---", "---:"),
    ...Object.entries(r.places_by_mapping_status).map(([k, v]) => row(k, v)),
    "",
    "## Mapping evidence",
    "",
    "This repository contains no geodata, gazetteer feed or licensed coordinate source. Coordinates are therefore unmapped by default and no place carries a coordinate claim; any `lat`/`lng` present comes verbatim from the curated gazetteer together with its `mapping_source`. Mapping is deferred to a licensed/geography source.",
    "",
    "## Limitations",
    "",
    "- Unresolved aliases cannot serve as endpoints in T14; they are listed in data/raw/t13/unresolved.json (not committed) for gazetteer curation.",
    "",
    "## Notes",
    "",
    ...r.notes.map((s) => `- ${s}`),
    "",
  ];
  return L.join("\n");
}

// ---------- CLI ----------
export function run({
  out = path.join(ROOT, "data/raw/t13"),
  reportDir = path.join(HERE, "reports"),
  gazetteerPath = GAZETTEER,
  reviewedFile = path.join(ROOT, "data/raw/t12/reviewed-candidates.jsonl"),
} = {}) {
  const reviewed = readFileSync(reviewedFile, "utf8").split(/\r?\n/).filter((l) => l.trim()).map(JSON.parse);
  const gz = JSON.parse(readFileSync(gazetteerPath, "utf8"));
  const res = build(reviewed, gz);
  const report = buildReport(res);
  mkdirSync(out, { recursive: true });
  mkdirSync(reportDir, { recursive: true });
  const w = (f, v) => writeFileSync(path.join(out, f), JSON.stringify(v, null, 2) + "\n");
  w("places.json", res.places);
  w("aliases.json", res.aliases);
  w("ambiguities.json", res.ambiguities);
  w("unresolved.json", res.unresolved);
  w("mentions.json", res.mentions);
  writeFileSync(path.join(reportDir, "t13-places.json"), JSON.stringify(report, null, 2) + "\n");
  writeFileSync(path.join(reportDir, "t13-places.md"), reportMd(report));
  return report;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? path.resolve(process.argv[i + 1]) : undefined; };
  try {
    const r = run({ out: arg("--out"), reportDir: arg("--report-dir") });
    console.log(`T13 places done — ${r.canonical_places} places, ${r.aliases_resolved} aliases, ` +
      `${r.ambiguous_alias_norms} ambiguous, ${r.unresolved_alias_norms} unresolved; coverage ${r.coverage_pct}%`);
  } catch (e) {
    console.error(String(e.message ?? e));
    process.exit(1);
  }
}
