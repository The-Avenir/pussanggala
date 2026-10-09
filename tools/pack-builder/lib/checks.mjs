// Deterministic record checks shared by build.mjs (pre-insert) and acceptance.mjs (post-build).
// Issues carry codes, table names, record IDs and column names only; they never echo
// record text, so they are safe to print or write into reports (INV-4).

import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  DATE_PREFIX_RE, HHMM_RE, MANIFEST_COLS, SCHEMA_VERSION, STABLE_ID_RE, TABLES,
  TABLE_BY_KIND, TABLE_BY_NAME, normalizeAlias,
} from "./spec.mjs";

export const INACTIVE_ROUTE_STATUSES = new Set(["suspended", "retired"]);
export const GEOMETRY_SOURCE_KINDS = new Set(["geography", "licensed_data"]);

/** Groups used by the acceptance summary. */
export const ISSUE_GROUP = {
  table_missing: "invalid-record",
  row_invalid: "invalid-record",
  duplicate_id: "invalid-record",
  dangling_fk: "invalid-record",
  coords_unpaired: "invalid-record",
  fare_range_inverted: "invalid-record",
  shape_owner_count: "invalid-record",
  shape_owner_duplicate: "invalid-record",
  note_link_owner_count: "invalid-record",
  missing_provenance: "invalid-record",
  record_kind_prefix_mismatch: "invalid-record",
  source_path_without_geometry_source: "invalid-record",
  ready_on_inactive_route: "invalid-record",
  ready_outside_ncr: "invalid-record",
  manifest_invalid: "invalid-record",
  manifest_counts_mismatch: "invalid-record",
  alias_not_normalized: "ambiguity",
  alias_conflict: "ambiguity",
  ambiguity_too_few: "ambiguity",
  source_post_not_included: "source-content",
  leak_ngram: "source-content",
  leak_handle: "source-content",
  sqlite_integrity: "integrity",
  sqlite_foreign_key: "integrity",
  schema_version: "integrity",
};

const issue = (code, table, id, detail) => ({ code, table, id: id == null ? null : String(id), detail });

function checkValue(col, spec, value) {
  if (value === null || value === undefined) {
    return spec.null ? null : `${col} is required`;
  }
  switch (spec.t) {
    case "id":
      if (typeof value !== "string" || !STABLE_ID_RE.test(value)) return `${col} is not a stable ID`;
      if (spec.prefix && !value.startsWith(`${spec.prefix}_`)) return `${col} must start with ${spec.prefix}_`;
      return null;
    case "int":
      if (!Number.isSafeInteger(value)) return `${col} must be a safe integer`;
      if (spec.nonneg && value < 0) return `${col} must be >= 0`;
      return null;
    case "real":
      if (typeof value !== "number" || !Number.isFinite(value)) return `${col} must be a number`;
      if (spec.nonneg && value < 0) return `${col} must be >= 0`;
      return null;
    case "text":
      if (typeof value !== "string") return `${col} must be text`;
      if (spec.enum && !spec.enum.includes(value)) return `${col} has an unsupported value`;
      if (spec.hhmm && !HHMM_RE.test(value)) return `${col} must be HH:MM`;
      if (spec.date && !DATE_PREFIX_RE.test(value)) return `${col} must start with YYYY-MM-DD`;
      return null;
    default:
      return `${col} has unknown spec`;
  }
}

/**
 * Validate the record tables ({sqlTableName: rows[]}).
 * @returns {Array<{code:string, table:string, id:string|null, detail:string}>}
 */
export function checkRecords(tables) {
  const issues = [];
  const byId = {};

  // Row shape, types, enums, ID format, duplicates.
  for (const t of TABLES) {
    const rows = tables[t.name];
    byId[t.name] = new Map();
    if (!Array.isArray(rows)) {
      issues.push(issue("table_missing", t.name, null, "expected an array of rows"));
      continue;
    }
    rows.forEach((row, index) => {
      const rid = row && typeof row === "object" ? row[t.pk] ?? `#${index}` : `#${index}`;
      if (!row || typeof row !== "object" || Array.isArray(row)) {
        issues.push(issue("row_invalid", t.name, `#${index}`, "row is not an object"));
        return;
      }
      for (const key of Object.keys(row)) {
        if (!(key in t.cols)) issues.push(issue("row_invalid", t.name, rid, `unknown column ${key}`));
      }
      for (const [col, spec] of Object.entries(t.cols)) {
        if (!(col in row)) {
          issues.push(issue("row_invalid", t.name, rid, `missing column ${col}`));
          continue;
        }
        const problem = checkValue(col, spec, row[col]);
        if (problem) issues.push(issue("row_invalid", t.name, rid, problem));
      }
      const key = row[t.pk];
      if (byId[t.name].has(key)) {
        issues.push(issue("duplicate_id", t.name, key, `duplicate ${t.pk}`));
      } else {
        byId[t.name].set(key, row);
      }
    });
  }
  const rowsOf = (name) => (Array.isArray(tables[name]) ? tables[name].filter((r) => r && typeof r === "object") : []);

  // Foreign keys.
  for (const t of TABLES) {
    for (const row of rowsOf(t.name)) {
      for (const [col, spec] of Object.entries(t.cols)) {
        if (spec.fk && row[col] != null && !byId[spec.fk].has(row[col])) {
          issues.push(issue("dangling_fk", t.name, row[t.pk], `${col} -> ${spec.fk} not found`));
        }
      }
    }
  }

  // Row-level invariants.
  for (const p of rowsOf("place")) {
    if ((p.lat == null) !== (p.lng == null)) issues.push(issue("coords_unpaired", "place", p.place_id, "lat/lng must both be set or both null"));
  }
  for (const f of rowsOf("fare_report")) {
    if (typeof f.amount_min === "number" && typeof f.amount_max === "number" && f.amount_min > f.amount_max) {
      issues.push(issue("fare_range_inverted", "fare_report", f.fare_id, "amount_min > amount_max"));
    }
  }
  const shapeOwners = new Map();
  for (const s of rowsOf("shape")) {
    if ((s.leg_id == null) === (s.walk_id == null)) {
      issues.push(issue("shape_owner_count", "shape", s.shape_id, "shape needs exactly one of leg_id/walk_id"));
      continue;
    }
    const owner = s.leg_id != null ? `leg:${s.leg_id}` : `walk:${s.walk_id}`;
    if (shapeOwners.has(owner)) issues.push(issue("shape_owner_duplicate", "shape", s.shape_id, `owner already has shape ${shapeOwners.get(owner)}`));
    else shapeOwners.set(owner, s.shape_id);
  }
  for (const l of rowsOf("note_link")) {
    if ((l.leg_id == null) === (l.stop_id == null)) {
      issues.push(issue("note_link_owner_count", "note_link", l.link_id, "note_link needs exactly one of leg_id/stop_id"));
    }
  }

  // Provenance: every factual record has >= 1 record_source; record_source targets exist.
  const sourced = new Set();
  for (const rs of rowsOf("record_source")) {
    const target = TABLE_BY_KIND[rs.record_kind];
    if (!target) continue; // enum failure already reported
    if (typeof rs.record_id === "string" && !rs.record_id.startsWith(`${target.cols[target.pk].prefix}_`)) {
      issues.push(issue("record_kind_prefix_mismatch", "record_source", rs.link_id, `record_id prefix does not match ${rs.record_kind}`));
    }
    if (!byId[target.name].has(rs.record_id)) {
      issues.push(issue("dangling_fk", "record_source", rs.link_id, `${rs.record_kind} ${rs.record_id} not found`));
    }
    sourced.add(`${rs.record_kind}:${rs.record_id}`);
  }
  for (const t of TABLES) {
    if (!t.kind) continue;
    for (const row of rowsOf(t.name)) {
      if (!sourced.has(`${t.kind}:${row[t.pk]}`)) {
        issues.push(issue("missing_provenance", t.name, row[t.pk], "no record_source row"));
      }
    }
  }

  // source_path geometry requires geography/licensed_data evidence.
  const sourceKindsByRecord = new Map();
  for (const rs of rowsOf("record_source")) {
    const src = byId.source.get(rs.source_id);
    const k = `${rs.record_kind}:${rs.record_id}`;
    if (!sourceKindsByRecord.has(k)) sourceKindsByRecord.set(k, new Set());
    if (src) sourceKindsByRecord.get(k).add(src.kind);
  }
  for (const s of rowsOf("shape")) {
    if (s.geometry_kind !== "source_path") continue;
    const kinds = sourceKindsByRecord.get(`shape:${s.shape_id}`) ?? new Set();
    if (![...kinds].some((k) => GEOMETRY_SOURCE_KINDS.has(k))) {
      issues.push(issue("source_path_without_geometry_source", "shape", s.shape_id, "source_path shape lacks geography/licensed_data source"));
    }
  }

  // Readiness: ready legs only on routes not suspended/retired; ready records only touch
  // accepted-NCR places (SDD §3.4).
  const placeOfStop = (stopId) => byId.place.get(byId.stop.get(stopId)?.place_id);
  const outside = (place) => place && place.ncr_status !== "accepted";
  for (const l of rowsOf("leg")) {
    if (l.eligibility !== "ready") continue;
    const route = byId.route.get(l.route_id);
    if (route && INACTIVE_ROUTE_STATUSES.has(route.service_status)) {
      issues.push(issue("ready_on_inactive_route", "leg", l.leg_id, `route ${l.route_id} is ${route.service_status}`));
    }
    if (outside(placeOfStop(l.board_stop_id)) || outside(placeOfStop(l.alight_stop_id))) {
      issues.push(issue("ready_outside_ncr", "leg", l.leg_id, "endpoint stop is not at an accepted NCR place"));
    }
  }
  for (const w of rowsOf("walk_link")) {
    if (w.eligibility === "ready" && (outside(placeOfStop(w.from_stop_id)) || outside(placeOfStop(w.to_stop_id)))) {
      issues.push(issue("ready_outside_ncr", "walk_link", w.walk_id, "endpoint stop is not at an accepted NCR place"));
    }
  }
  for (const a of rowsOf("place_stop")) {
    if (a.eligibility === "ready" && (outside(byId.place.get(a.place_id)) || outside(placeOfStop(a.stop_id)))) {
      issues.push(issue("ready_outside_ncr", "place_stop", a.access_id, "place or stop is not an accepted NCR place"));
    }
  }

  // Aliases: alias_norm normalized + unique; ambiguous aliases only in place_ambiguity with >= 2 places.
  const aliasNorms = new Set();
  for (const a of rowsOf("place_alias")) {
    if (typeof a.alias_display === "string" && a.alias_norm !== normalizeAlias(a.alias_display)) {
      issues.push(issue("alias_not_normalized", "place_alias", a.alias_id, "alias_norm != normalize(alias_display)"));
    }
    if (aliasNorms.has(a.alias_norm)) {
      issues.push(issue("alias_conflict", "place_alias", a.alias_id, "alias_norm maps to more than one row; move it to place_ambiguity"));
    } else {
      aliasNorms.add(a.alias_norm);
    }
  }
  const groups = new Map();
  for (const a of rowsOf("place_ambiguity")) {
    if (typeof a.alias_norm === "string" && a.alias_norm !== normalizeAlias(a.alias_norm)) {
      issues.push(issue("alias_not_normalized", "place_ambiguity", a.ambiguity_id, "alias_norm is not normalized"));
    }
    if (!groups.has(a.alias_norm)) groups.set(a.alias_norm, { places: new Set(), first: a.ambiguity_id });
    groups.get(a.alias_norm).places.add(a.place_id);
  }
  for (const [norm, g] of groups) {
    if (aliasNorms.has(norm)) issues.push(issue("alias_conflict", "place_ambiguity", g.first, "ambiguous alias_norm also present in place_alias"));
    if (g.places.size < 2) issues.push(issue("ambiguity_too_few", "place_ambiguity", g.first, "ambiguous alias_norm has fewer than two candidate places"));
  }

  return issues;
}

/** Validate a pack_manifest row (same rules as the T20 loader plus schema_version). */
export function checkManifest(m, tables) {
  const issues = [];
  if (!m || typeof m !== "object") return [issue("manifest_invalid", "pack_manifest", null, "manifest missing")];
  for (const col of MANIFEST_COLS) {
    if (!(col in m)) issues.push(issue("manifest_invalid", "pack_manifest", m.pack_id, `missing ${col}`));
  }
  for (const k of Object.keys(m)) {
    if (!MANIFEST_COLS.includes(k)) issues.push(issue("manifest_invalid", "pack_manifest", m.pack_id, `unknown column ${k}`));
  }
  const ints = ["schema_version", "stale_after_days", "input_posts", "answered_posts", "included_posts",
    "filtered_posts", "pending_posts", "rejected_posts"];
  for (const k of ints) {
    if (!Number.isSafeInteger(m[k]) || m[k] < 0) issues.push(issue("manifest_invalid", "pack_manifest", m.pack_id, `${k} must be a nonnegative safe integer`));
  }
  for (const k of ["pack_id", "bbox", "created_at", "input_sha256"]) {
    if (typeof m[k] !== "string" || m[k] === "") issues.push(issue("manifest_invalid", "pack_manifest", m.pack_id, `${k} must be text`));
  }
  for (const k of ["source_date_min", "source_date_max"]) {
    if (m[k] !== null && typeof m[k] !== "string") issues.push(issue("manifest_invalid", "pack_manifest", m.pack_id, `${k} must be text or null`));
  }
  if (typeof m.region_id !== "string" || !STABLE_ID_RE.test(m.region_id) || !m.region_id.startsWith("rg_")) {
    issues.push(issue("manifest_invalid", "pack_manifest", m.pack_id, "region_id is not an rg_ stable ID"));
  } else if (tables && !(tables.region ?? []).some((r) => r.region_id === m.region_id)) {
    issues.push(issue("dangling_fk", "pack_manifest", m.pack_id, "region_id -> region not found"));
  }
  if (m.schema_version !== SCHEMA_VERSION) issues.push(issue("schema_version", "pack_manifest", m.pack_id, `schema_version must be ${SCHEMA_VERSION}`));
  if (m.answered_posts > m.input_posts
    || m.included_posts + m.filtered_posts + m.pending_posts + m.rejected_posts !== m.answered_posts) {
    issues.push(issue("manifest_counts_mismatch", "pack_manifest", m.pack_id, "post dispositions do not sum to answered_posts (or answered > input)"));
  }
  return issues;
}

/** Snapshot identity is UTF-8 with CRLF replaced by LF only (no JSON reserialization). */
export function sourceSnapshotSha256(path) {
  return createHash("sha256").update(readFileSync(path, "utf8").replace(/\r\n/g, "\n")).digest("hex");
}

/** Verify every Reddit evidence locator against the supplied snapshot, including excluded rows. */
export function checkSourceSnapshot(tables, manifest, rawDatasetPath) {
  const posts = JSON.parse(readFileSync(rawDatasetPath, "utf8"));
  const issues = [];
  if (!Array.isArray(posts)) return [issue("raw_invalid", null, null, "raw dataset must be an array")];
  const sha = sourceSnapshotSha256(rawDatasetPath);
  const postById = new Map(posts.map((p) => [String(p.id), p]));
  const answered = posts.filter((p) => Array.isArray(p.answers) && p.answers.length > 0).length;
  if (manifest.input_sha256 !== sha) issues.push(issue("input_mismatch", "pack_manifest", manifest.pack_id, "input_sha256 differs from the LF-normalized raw snapshot"));
  if (manifest.input_posts !== posts.length || manifest.answered_posts !== answered) issues.push(issue("input_mismatch", "pack_manifest", manifest.pack_id, "input/answered counts differ from the raw snapshot"));
  if (postById.size !== posts.length) issues.push(issue("raw_invalid", null, null, "raw dataset has duplicate post IDs"));
  const sources = new Map((tables.source ?? []).map((s) => [s.source_id, s]));
  const citedPosts = new Set();
  for (const rs of tables.record_source ?? []) {
    const s = sources.get(rs.source_id);
    if (s?.kind !== "reddit_thread") continue;
    const post = postById.get(s.post_id);
    if (rs.snapshot_sha256 !== sha) issues.push(issue("snapshot_mismatch", "record_source", rs.link_id, "snapshot_sha256 differs from the raw snapshot"));
    if (!post || !Array.isArray(post.answers) || post.answers.length === 0
      || (s.url !== null && s.url !== post.permalink)
      || (rs.comment_index !== null && (!Number.isSafeInteger(rs.comment_index) || rs.comment_index < 0 || rs.comment_index >= post.answers.length))) {
      issues.push(issue("source_locator_invalid", "record_source", rs.link_id, "post/comment locator is not in an answered raw post"));
    }
    if (post) citedPosts.add(s.post_id);
  }
  if (manifest.included_posts !== citedPosts.size) issues.push(issue("manifest_counts_mismatch", "pack_manifest", manifest.pack_id, "included_posts differs from distinct cited Reddit posts"));
  return issues;
}

/**
 * Records may only cite reddit posts whose final disposition is "included", and every
 * "included" post must be cited by at least one record (so included_posts reconciles).
 */
export function checkSourcePosts(tables, finalDispositions) {
  const issues = [];
  const cited = new Set((tables.record_source ?? []).map((r) => r.source_id));
  const citedPosts = new Set();
  for (const s of tables.source ?? []) {
    if (s.kind !== "reddit_thread" || !cited.has(s.source_id)) continue;
    if (s.post_id != null) citedPosts.add(s.post_id);
    if (s.post_id == null || finalDispositions[s.post_id] !== "included") {
      issues.push(issue("source_post_not_included", "source", s.source_id, "cited post is not an included post"));
    }
  }
  for (const [postId, d] of Object.entries(finalDispositions)) {
    if (d === "included" && !citedPosts.has(postId)) {
      issues.push(issue("source_post_not_included", "dispositions", postId, "included post is not cited by any pack record"));
    }
  }
  return issues;
}

// ---------------------------------------------------------------------------
// Leak scan (INV-4).

export const LEAK_NGRAM = 6;
const HANDLE_RES = [
  /(?:^|[^a-z0-9_])\/?u\/[a-z0-9_-]{2,}/i, // u/name, /u/name
  /(?:^|[^a-z0-9_.])@[a-z0-9_][a-z0-9_.-]{2,}/i, // @handles
];
// Profile links are checked in every text column, including URLs.
const PROFILE_RE = /reddit\.com\/(?:u|user)\/[a-z0-9_-]+/i;

/** Lowercase, strip diacritics, split on anything that is not a letter/digit. */
export function tokenize(value) {
  return String(value)
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

function* ngrams(tokens, n = LEAK_NGRAM) {
  for (let i = 0; i + n <= tokens.length; i += 1) yield tokens.slice(i, i + n).join(" ");
}

/** Build the 6-gram set of every title/question/answer text in a raw dataset file. */
export function loadSourceNgrams(rawDatasetPath) {
  const posts = JSON.parse(readFileSync(rawDatasetPath, "utf8"));
  if (!Array.isArray(posts)) throw new Error("raw dataset must be a JSON array of posts");
  const grams = new Set();
  // Keep the public Set API; author identities are additional privacy evidence.
  grams.usernames = new Set();
  const add = (v) => {
    if (typeof v !== "string" || v === "") return;
    for (const g of ngrams(tokenize(v))) grams.add(g);
  };
  for (const p of posts) {
    add(p.title);
    add(p.question);
    for (const a of p.answers ?? []) add(typeof a === "string" ? a : a?.text);
    for (const record of [p, ...(p.answers ?? []).filter((a) => a && typeof a === "object")]) {
      for (const field of ["author", "username", "user"]) {
        const value = record[field];
        if (typeof value === "string" && value && !["[deleted]", "[removed]"].includes(value)) grams.usernames.add(value.toLowerCase());
      }
    }
  }
  return grams;
}

/**
 * Scan every text column of the pack tables for copied 6-word sequences and handles.
 * @param tables {sqlTableName: rows[]}
 * @param rawDatasetPathOrGrams path to the raw dataset JSON, or a prebuilt Set of 6-grams
 * @returns issues listing table / record ID / column only
 */
export function leakScan(tables, rawDatasetPathOrGrams, manifest) {
  const grams = rawDatasetPathOrGrams instanceof Set ? rawDatasetPathOrGrams : loadSourceNgrams(rawDatasetPathOrGrams);
  const issues = [];
  const scan = (table, rid, col, v, permalink = false) => {
    if (typeof v !== "string") return;
    const usernames = grams.usernames ?? new Set();
    const lower = v.toLowerCase();
    const hasAuthor = [...usernames].some((name) => {
      let start = lower.indexOf(name);
      while (start !== -1) {
        const before = lower[start - 1] ?? "";
        const after = lower[start + name.length] ?? "";
        if (!/[a-z0-9_-]/i.test(before) && !/[a-z0-9_-]/i.test(after)) return true;
        start = lower.indexOf(name, start + 1);
      }
      return false;
    });
    if (HANDLE_RES.some((re) => re.test(v)) || PROFILE_RE.test(v) || hasAuthor) issues.push(issue("leak_handle", table, rid, `${col} contains a username/handle`));
    // A Reddit thread's actual permalink slug is metadata; other text/JSON/URLs are scanned.
    if (!permalink) {
      for (const g of ngrams(tokenize(v))) {
        if (grams.has(g)) {
          issues.push(issue("leak_ngram", table, rid, `${col} shares a ${LEAK_NGRAM}-word sequence with source text`));
          break;
        }
      }
    }
  };
  for (const t of TABLES) {
    for (const row of tables[t.name] ?? []) {
      for (const [col, spec] of Object.entries(t.cols)) {
        const v = row?.[col];
        if (!["text", "id"].includes(spec.t) || typeof v !== "string") continue;
        const rid = row[t.pk];
        scan(t.name, rid, col, v, t.name === "source" && col === "url" && row.kind === "reddit_thread" && /^https?:\/\/(?:www\.)?reddit\.com\/r\/[^/]+\/comments\/[^/]+(?:\/|$)/i.test(v));
        if (col === "geojson" || col === "boundary_geojson") {
          // JSON escapes must not hide copied words or handles in feature properties.
          const scanJson = (value) => {
            if (typeof value === "string") scan(t.name, rid, col, value);
            else if (Array.isArray(value)) value.forEach(scanJson);
            else if (value && typeof value === "object") for (const [key, item] of Object.entries(value)) { scanJson(key); scanJson(item); }
          };
          try { scanJson(JSON.parse(v)); } catch { /* Raw string was scanned above. */ }
        }
      }
    }
  }
  if (manifest) for (const [col, value] of Object.entries(manifest)) scan("pack_manifest", manifest.pack_id, col, value);
  return issues;
}

export function tableNames() {
  return Object.keys(TABLE_BY_NAME);
}
