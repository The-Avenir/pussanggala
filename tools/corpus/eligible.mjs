#!/usr/bin/env node
// T14 — turn T12 second_passed candidates + T13 canonical places into the
// eligible-record directory consumed by tools/pack-builder/build.mjs.
//
//   node tools/corpus/eligible.mjs \
//     [--candidates data/raw/t12/reviewed-candidates.jsonl] \
//     [--t13 data/raw/t13] [--raw howtogetthereph_dataset/ncr_routes.json] \
//     [--out data/raw/t14] [--report-md tools/corpus/reports/t14-eligible.md]
//
// Emits <out>/eligible/<table>.json (all 16 pack tables), <out>/dispositions.json,
// <out>/run.json and a t14-eligible report (json + md).
//
// Contract notes (tools/corpus/CONTRACT.md, tools/pack-builder/README.md):
// - Only review_state "second_passed" enters the pack; needs_review/rejected
//   candidates never produce records.
// - A needs_review service_status claim of suspended/retired still *suppresses*
//   its route (legs emitted as "excluded") without asserting the status (INV-5).
// - board/alight/from/to text resolves only by exact normalized alias; ambiguous
//   alias norms never resolve; unresolved places drop the record (no FK target).
// - No invented values: rides with mode null, fares missing a bound or a leg
//   target, hours without a route are dropped and counted, never guessed.
// - IDs are deterministic (slug + short sha256) so rebuilds are stable.

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { normalizeAlias, TABLES } from "../pack-builder/lib/spec.mjs";
import { loadSourceNgrams, tokenize, LEAK_NGRAM } from "../pack-builder/lib/checks.mjs";

const REGION_ID = "rg_ncr";
const GAZETTEER_SOURCE_ID = "src_gazetteer";
const NCR_BBOX = "120.90,14.35,121.15,14.80"; // standard published NCR extent envelope
const CREATED_AT = "2026-10-10T00:00:00Z"; // snapshot-complete date; fixed for determinism
const sha = (s) => createHash("sha256").update(s).digest("hex");

const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : dflt;
};

const CANDIDATES = opt("candidates", "data/raw/t12/reviewed-candidates.jsonl");
const T13 = opt("t13", "data/raw/t13");
const RAW = opt("raw", "howtogetthereph_dataset/ncr_routes.json");
const OUT = opt("out", "data/raw/t14");
const REPORT_MD = opt("report-md", "tools/corpus/reports/t14-eligible.md");

const slug = (s) =>
  String(s)
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 44) || "x";
const mkid = (prefix, ...parts) => `${prefix}_${slug(parts.join("-"))}-${sha(parts.join("|")).slice(0, 6)}`;

const isoDate = (utcSeconds) => new Date(Number(utcSeconds) * 1000).toISOString().slice(0, 10);

const hasLeak = (grams, value) => {
  if (typeof value !== "string") return false;
  const toks = tokenize(value);
  for (let i = 0; i + LEAK_NGRAM <= toks.length; i += 1) {
    if (grams.has(toks.slice(i, i + LEAK_NGRAM).join(" "))) return true;
  }
  return false;
};

/** Human text safe for scan columns: verbatim strings allowed only under the 6-word threshold. */
const safeVerbatim = (grams, v) => {
  if (v == null) return null;
  const toks = tokenize(v);
  return toks.length < LEAK_NGRAM && !hasLeak(grams, v) ? v : null;
};

export function buildEligible({ candidates, places, aliases, ambiguities, posts, sourceGrams }) {
  const stats = {
    candidates_in: { second_passed: 0, needs_review: 0, rejected: 0 },
    rides: { total: 0, leg_ready: 0, leg_excluded_suppressed: 0, dropped: {} },
    walks: { total: 0, emitted: 0, dropped: {} },
    fares: { total: 0, emitted: 0, dropped: {} },
    hours: { total: 0, emitted: 0, dropped: {} },
    notes: { total: 0, emitted: 0 },
    service_status: { verified: 0, suppressed_routes: 0, dropped: 0 },
    leak_scan: { dropped_rows: 0, regenerated_labels: 0, nulled_signboards: 0, renamed: 0 },
  };
  const drop = (bucket, why) => {
    stats[bucket].dropped[why] = (stats[bucket].dropped[why] || 0) + 1;
  };

  const postById = new Map(posts.map((p) => [p.id, p]));
  const answered = posts.filter((p) => Array.isArray(p.answers) && p.answers.length > 0);

  // --- T13 maps ---------------------------------------------------------
  const placeByKey = new Map(places.map((p) => [p.place_key, p]));
  const ambiguousNorms = new Set(ambiguities.map((a) => a.alias_norm));
  const placeByAlias = new Map(); // alias_norm -> place (never ambiguous)
  for (const a of aliases) {
    if (ambiguousNorms.has(a.alias_norm)) continue;
    const pl = placeByKey.get(a.place_key);
    if (pl) placeByAlias.set(a.alias_norm, pl);
  }
  /** text -> {place} | {problem: 'ambiguous'|'unresolved'|'empty'} */
  const resolvePlace = (text) => {
    if (text == null || String(text).trim() === "") return { problem: "empty" };
    const norm = normalizeAlias(text);
    if (norm === "") return { problem: "empty" };
    if (ambiguousNorms.has(norm)) return { problem: "ambiguous" };
    const pl = placeByAlias.get(norm);
    return pl ? { place: pl } : { problem: "unresolved" };
  };

  // --- candidate partition ----------------------------------------------
  const passed = [];
  const pendingByPost = new Map(); // post_id -> count of needs_review
  const rejectedByPost = new Map();
  const suppressionByRide = new Map(); // ride candidate_id -> claimed inactive status
  for (const c of candidates) {
    stats.candidates_in[c.review_state] = (stats.candidates_in[c.review_state] || 0) + 1;
    if (c.review_state === "second_passed") {
      passed.push(c);
    } else if (c.review_state === "needs_review") {
      pendingByPost.set(c.post_id, (pendingByPost.get(c.post_id) || 0) + 1);
      if (c.record_kind === "service_status" && c.candidate_payload?.applies_to_ride &&
        (c.candidate_payload.status === "suspended" || c.candidate_payload.status === "retired")) {
        suppressionByRide.set(c.candidate_payload.applies_to_ride, c.candidate_payload.status);
      }
    } else if (c.review_state === "rejected") {
      rejectedByPost.set(c.post_id, (rejectedByPost.get(c.post_id) || 0) + 1);
    }
  }

  // --- emission accumulators --------------------------------------------
  const tables = Object.fromEntries(TABLES.map((t) => [t.name, []]));
  const sources = new Map(); // post_id -> source row
  const recordSources = [];
  let linkId = 0;
  const cite = (record_kind, record_id, cand) => {
    const post = postById.get(cand.post_id);
    if (!post) return; // defensive: candidates always come from known posts
    if (!sources.has(cand.post_id)) {
      sources.set(cand.post_id, {
        source_id: mkid("src", "post", cand.post_id),
        kind: "reddit_thread",
        url: post.permalink ?? null,
        post_id: cand.post_id,
        posted_at: post.created_utc != null ? isoDate(post.created_utc) : null,
        observed_at: null,
        license: null,
      });
    }
    recordSources.push({
      link_id: ++linkId,
      record_kind,
      record_id,
      source_id: sources.get(cand.post_id).source_id,
      snapshot_sha256: cand.snapshot_sha256 ?? null,
      comment_index: cand.comment_index ?? null,
    });
  };
  const citeGazetteer = (record_kind, record_id) => {
    recordSources.push({
      link_id: ++linkId,
      record_kind,
      record_id,
      source_id: GAZETTEER_SOURCE_ID,
      snapshot_sha256: null,
      comment_index: null,
    });
  };

  // --- region + places (T13 output, gazetteer-sourced) --------------------
  const [minLng, minLat, maxLng, maxLat] = NCR_BBOX.split(",").map(Number);
  const boundaryGeojson = JSON.stringify({
    type: "Polygon",
    coordinates: [[[minLng, minLat], [maxLng, minLat], [maxLng, maxLat], [minLng, maxLat], [minLng, minLat]]],
  });
  tables.region.push({
    region_id: REGION_ID,
    name: "National Capital Region",
    boundary_geojson: boundaryGeojson,
    boundary_sha256: sha(boundaryGeojson),
  });
  citeGazetteer("region", REGION_ID);
  tables.source.push({
    source_id: GAZETTEER_SOURCE_ID,
    kind: "team_review",
    url: null,
    post_id: null,
    posted_at: null,
    observed_at: CREATED_AT.slice(0, 10),
    license: null,
  });

  for (const p of [...places].sort((a, b) => a.place_id.localeCompare(b.place_id))) {
    tables.place.push({
      place_id: p.place_id,
      region_id: REGION_ID,
      name: p.name,
      kind: p.kind,
      area: p.city ?? p.area ?? null,
      ncr_status: p.ncr_status,
      lat: p.lat ?? null,
      lng: p.lng ?? null,
      mapping_status: p.mapping_status,
    });
    citeGazetteer("place", p.place_id);
  }
  let aliasId = 0;
  for (const a of [...aliases].sort((x, y) => x.alias_norm.localeCompare(y.alias_norm))) {
    const pl = placeByKey.get(a.place_key);
    if (!pl || ambiguousNorms.has(a.alias_norm)) continue;
    tables.place_alias.push({
      alias_id: ++aliasId,
      place_id: pl.place_id,
      alias_norm: a.alias_norm,
      alias_display: a.alias_display,
    });
  }
  let ambiguityId = 0;
  for (const a of [...ambiguities].sort((x, y) => x.alias_norm.localeCompare(y.alias_norm) || x.place_key.localeCompare(y.place_key))) {
    const pl = placeByKey.get(a.place_key);
    if (!pl) continue;
    tables.place_ambiguity.push({ ambiguity_id: ++ambiguityId, alias_norm: a.alias_norm, place_id: pl.place_id });
  }

  // --- stops + place_stops for places that participate in the graph -------
  const LANDMARK_HINT = {
    station: "station boarding area", terminal: "terminal loading area",
    mall: "mall pickup area", school: "campus entrance area",
    landmark: "landmark vicinity", area: "main boarding point", other: "main boarding point",
  };
  const stopByPlace = new Map(); // place_id -> stop row
  const ensureStop = (pl) => {
    let st = stopByPlace.get(pl.place_id);
    if (!st) {
      st = {
        stop_id: mkid("st", pl.place_key),
        place_id: pl.place_id,
        name: pl.name,
        landmark_hint: LANDMARK_HINT[pl.kind] ?? "main boarding point",
      };
      stopByPlace.set(pl.place_id, st);
      tables.stop.push(st);
      citeGazetteer("stop", st.stop_id);
      const accessId = mkid("ac", pl.place_key);
      tables.place_stop.push({
        access_id: accessId,
        place_id: pl.place_id,
        stop_id: st.stop_id,
        direction: "both",
        walk_m: null,
        walk_min: null,
        walk_text: "Boarding point for this place.",
        eligibility: pl.ncr_status === "accepted" ? "ready" : "excluded",
      });
      citeGazetteer("place_stop", accessId);
    }
    return st;
  };

  // --- routes + legs from ride candidates ---------------------------------
  const routeByKey = new Map(); // key -> {route, rides:Set, suppressed}
  const legByKey = new Map(); // "route|board|alight" -> {leg, rides:[], mins:Set}
  const rideToLeg = new Map(); // ride candidate_id -> leg key (emitted) or null

  const rides = passed.filter((c) => c.record_kind === "ride");
  stats.rides.total = rides.length;
  for (const c of rides) {
    const p = c.candidate_payload ?? {};
    rideToLeg.set(c.candidate_id, null);
    if (p.mode == null) {
      drop("rides", "no_mode");
      continue;
    }
    const board = resolvePlace(p.board_place);
    const alight = resolvePlace(p.alight_place);
    for (const [which, res] of [["board", board], ["alight", alight]]) {
      if (res.problem) {
        drop("rides", `${which}_${res.problem}`);
      }
    }
    if (board.problem || alight.problem) continue;
    if (board.place.place_id === alight.place.place_id) {
      drop("rides", "same_place");
      continue;
    }
    const boardStop = ensureStop(board.place);
    const alightStop = ensureStop(alight.place);
    const dirNorm = (v) => (v == null ? "" : normalizeAlias(v));
    const routeKey = p.signboard || p.direction_text
      ? `${p.mode}|${dirNorm(p.signboard)}|${dirNorm(p.direction_text)}`
      : `${p.mode}|board:${dirNorm(p.board_place)}`;
    let rt = routeByKey.get(routeKey);
    if (!rt) {
      const signboard = safeVerbatim(sourceGrams, p.signboard);
      const directionLabel =
        signboard ??
        safeVerbatim(sourceGrams, p.direction_text) ??
        `${board.place.name} to ${alight.place.name}`;
      rt = {
        route: {
          route_id: mkid("rt", routeKey),
          mode: p.mode,
          signboard,
          direction_label: directionLabel,
          service_status: "unknown",
        },
        postIds: new Set(),
        suppressed: false,
      };
      routeByKey.set(routeKey, rt);
      tables.route.push(rt.route);
    }
    rt.postIds.add(c.post_id);
    const legKey = `${rt.route.route_id}|${boardStop.stop_id}|${alightStop.stop_id}`;
    let lg = legByKey.get(legKey);
    if (!lg) {
      lg = {
        leg: {
          leg_id: mkid("lg", legKey),
          route_id: rt.route.route_id,
          board_stop_id: boardStop.stop_id,
          alight_stop_id: alightStop.stop_id,
          ride_min: null,
          dist_km: null,
          eligibility: "ready",
        },
        rides: [],
        mins: new Set(),
        acceptedEnds: board.place.ncr_status === "accepted" && alight.place.ncr_status === "accepted",
      };
      legByKey.set(legKey, lg);
      tables.leg.push(lg.leg);
    }
    lg.rides.push(c);
    if (p.ride_min != null) lg.mins.add(p.ride_min);
    rideToLeg.set(c.candidate_id, legKey);
    cite("leg", lg.leg.leg_id, c);
    cite("route", rt.route.route_id, c);
    cite("stop", boardStop.stop_id, c);
    cite("stop", alightStop.stop_id, c);
    cite("place_stop", mkid("ac", board.place.place_key), c);
    cite("place_stop", mkid("ac", alight.place.place_key), c);
  }

  // --- service_status: verified claims set status; unverified inactive claims suppress
  for (const c of passed.filter((x) => x.record_kind === "service_status")) {
    const p = c.candidate_payload ?? {};
    const legKey = p.applies_to_ride ? rideToLeg.get(p.applies_to_ride) : undefined;
    if (legKey == null) {
      stats.service_status.dropped++;
      continue;
    }
    const rt = [...routeByKey.values()].find((r) => r.route.route_id === legByKey.get(legKey).leg.route_id);
    rt.route.service_status = p.status === "reported_active" ? "reported_active" : "unknown";
    stats.service_status.verified++;
    cite("route", rt.route.route_id, c);
  }
  for (const [rideId] of suppressionByRide) {
    const legKey = rideToLeg.get(rideId);
    if (legKey == null) continue; // ride never emitted; nothing to suppress
    const leg = legByKey.get(legKey).leg;
    const rt = [...routeByKey.values()].find((r) => r.route.route_id === leg.route_id);
    rt.suppressed = true;
  }
  for (const rt of routeByKey.values()) {
    if (rt.route.service_status === "suspended" || rt.route.service_status === "retired") rt.suppressed = true;
  }
  for (const lg of legByKey.values()) {
    const rt = [...routeByKey.values()].find((r) => r.route.route_id === lg.leg.route_id);
    if (rt.suppressed || !lg.acceptedEnds) {
      lg.leg.eligibility = "excluded";
      stats.rides.leg_excluded_suppressed += lg.rides.length;
    } else {
      stats.rides.leg_ready += lg.rides.length;
    }
    if (lg.mins.size === 1) lg.leg.ride_min = [...lg.mins][0]; // unanimous ride_min only
  }
  stats.service_status.suppressed_routes = [...routeByKey.values()].filter((r) => r.suppressed).length;

  // --- walk candidates -> walk_link ---------------------------------------
  const walks = passed.filter((c) => c.record_kind === "walk");
  stats.walks.total = walks.length;
  const walkByEdge = new Map();
  for (const c of walks) {
    const p = c.candidate_payload ?? {};
    const from = resolvePlace(p.from_place);
    const to = resolvePlace(p.to_place);
    if (from.problem || to.problem) {
      if (from.problem) drop("walks", `from_${from.problem}`);
      if (to.problem) drop("walks", `to_${to.problem}`);
      continue;
    }
    if (from.place.place_id === to.place.place_id) {
      drop("walks", "same_place");
      continue;
    }
    const fs = ensureStop(from.place);
    const ts = ensureStop(to.place);
    const edge = `${fs.stop_id}|${ts.stop_id}`;
    let w = walkByEdge.get(edge);
    if (!w) {
      w = {
        walk_id: mkid("wk", edge),
        from_stop_id: fs.stop_id,
        to_stop_id: ts.stop_id,
        walk_m: p.walk_m ?? null,
        walk_min: p.walk_min ?? null,
        walk_text: p.walk_text,
        eligibility:
          from.place.ncr_status === "accepted" && to.place.ncr_status === "accepted" ? "ready" : "excluded",
      };
      walkByEdge.set(edge, w);
      tables.walk_link.push(w);
      stats.walks.emitted++;
    }
    cite("walk_link", w.walk_id, c);
    cite("stop", fs.stop_id, c);
    cite("stop", ts.stop_id, c);
  }

  // --- fares -> fare_report -------------------------------------------------
  const fares = passed.filter((c) => c.record_kind === "fare");
  stats.fares.total = fares.length;
  for (const c of fares) {
    const p = c.candidate_payload ?? {};
    if (p.amount_min == null || p.amount_max == null) {
      drop("fares", "missing_bound");
      continue;
    }
    const legKey = p.applies_to_ride ? rideToLeg.get(p.applies_to_ride) : undefined;
    if (legKey == null) {
      drop("fares", "no_leg");
      continue;
    }
    const post = postById.get(c.post_id);
    const row = {
      fare_id: mkid("fr", c.candidate_id),
      leg_id: legByKey.get(legKey).leg.leg_id,
      amount_min: p.amount_min,
      amount_max: p.amount_max,
      currency: "PHP",
      basis: "reported_segment",
      effective_at: post?.created_utc != null ? isoDate(post.created_utc) : null,
    };
    tables.fare_report.push(row);
    stats.fares.emitted++;
    cite("fare_report", row.fare_id, c);
  }

  // --- hours -> hours_report ------------------------------------------------
  const hours = passed.filter((c) => c.record_kind === "hours");
  stats.hours.total = hours.length;
  for (const c of hours) {
    const p = c.candidate_payload ?? {};
    const legKey = p.applies_to_ride ? rideToLeg.get(p.applies_to_ride) : undefined;
    if (legKey == null) {
      drop("hours", "no_route");
      continue;
    }
    const row = {
      hours_id: mkid("hr", c.candidate_id),
      route_id: legByKey.get(legKey).leg.route_id,
      hours_text: p.hours_text,
      starts_local: p.starts_local ?? null,
      ends_local: p.ends_local ?? null,
      days_text: p.days_text ?? null,
    };
    tables.hours_report.push(row);
    stats.hours.emitted++;
    cite("hours_report", row.hours_id, c);
  }

  // --- notes ------------------------------------------------------------------
  const notes = passed.filter((c) => c.record_kind === "note");
  stats.notes.total = notes.length;
  const seenNotes = new Set();
  for (const c of notes) {
    const p = c.candidate_payload ?? {};
    if (p.body == null || !["tip", "warning", "conflict"].includes(p.kind)) continue;
    const noteId = mkid("nt", p.body, c.post_id, String(c.comment_index ?? "q"));
    if (seenNotes.has(noteId)) continue;
    seenNotes.add(noteId);
    tables.note.push({ note_id: noteId, body: p.body, kind: p.kind });
    stats.notes.emitted++;
    cite("note", noteId, c);
  }

  // --- INV-4 self-scan: mirror of the builder's leak scan so nothing leaked ships.
  // Droppable rows (leaf tables) are removed; structural text is regenerated to a
  // deterministic safe fallback rather than copied verbatim.
  const LEAF_TABLES = new Set(["note", "walk_link", "fare_report", "hours_report", "note_link", "place_alias", "shape"]);
  for (const t of TABLES) {
    const kept = [];
    for (const row of tables[t.name] ?? []) {
      let badCol = null;
      for (const [col, spec] of Object.entries(t.cols)) {
        if (spec.t === "text" && spec.scan && hasLeak(sourceGrams, row[col])) {
          badCol = col;
          break;
        }
      }
      if (badCol == null) {
        kept.push(row);
        continue;
      }
      if (t.name === "route" && badCol === "signboard") {
        row.signboard = null;
        stats.leak_scan.nulled_signboards++;
        kept.push(row);
      } else if (t.name === "route" && badCol === "direction_label") {
        row.direction_label = `${row.mode} service`;
        stats.leak_scan.regenerated_labels++;
        kept.push(row);
      } else if (t.name === "place" && badCol === "name") {
        row.name = tokenize(row.name).slice(0, LEAK_NGRAM - 1).join(" ");
        stats.leak_scan.renamed++;
        kept.push(row);
      } else if (t.name === "place" && badCol === "area") {
        row.area = "Metro Manila";
        stats.leak_scan.renamed++;
        kept.push(row);
      } else if (t.name === "stop") {
        row.name = "Boarding point";
        row.landmark_hint = "main boarding point";
        stats.leak_scan.renamed++;
        kept.push(row);
      } else if (t.name === "place_stop") {
        row.walk_text = "Boarding point for this place.";
        stats.leak_scan.regenerated_labels++;
        kept.push(row);
      } else if (t.name === "region") {
        row.name = "National Capital Region";
        stats.leak_scan.renamed++;
        kept.push(row);
      } else if (LEAF_TABLES.has(t.name)) {
        stats.leak_scan.dropped_rows++;
      } else {
        kept.push(row);
      }
    }
    tables[t.name] = kept;
  }
  // keep provenance links only for surviving records
  const live = new Set();
  for (const t of TABLES) {
    if (t.kind) for (const r of tables[t.name]) live.add(`${t.kind}|${r[t.pk]}`);
  }
  const keptLinks = recordSources.filter((rs) => live.has(`${rs.record_kind}|${rs.record_id}`));
  recordSources.length = 0;
  recordSources.push(...keptLinks.map((rs, i) => ({ ...rs, link_id: i + 1 })));

  // --- sources table: only sources still cited --------------------------------
  const usedSourceIds = new Set(recordSources.map((r) => r.source_id));
  const srcById = new Map([...sources.values()].map((s) => [s.source_id, s]));
  for (const sid of [...usedSourceIds].sort()) {
    if (sid === GAZETTEER_SOURCE_ID) continue; // already emitted
    tables.source.push(srcById.get(sid));
  }
  const citedPosts = new Set(
    [...usedSourceIds].map((sid) => srcById.get(sid)?.post_id).filter(Boolean),
  );

  // --- dispositions --------------------------------------------------------------
  const candidatesByPost = new Map();
  for (const c of candidates) {
    if (!candidatesByPost.has(c.post_id)) candidatesByPost.set(c.post_id, []);
    candidatesByPost.get(c.post_id).push(c);
  }
  const dispositions = {};
  const dispCounts = {};
  for (const post of answered) {
    const flags = new Set();
    if (citedPosts.has(post.id)) flags.add("included");
    if ((pendingByPost.get(post.id) || 0) > 0) flags.add("pending");
    if ((rejectedByPost.get(post.id) || 0) > 0) flags.add("rejected");
    const cands = candidatesByPost.get(post.id) || [];
    const routeEvidence = cands.some((c) => c.record_kind === "ride" || c.record_kind === "walk");
    if (cands.length > 0 && !flags.has("included") && !flags.has("pending") && !flags.has("rejected")) {
      flags.add(routeEvidence ? "rejected" : "filtered"); // everything passed but grounded to nothing
    }
    if (flags.size === 0) flags.add("filtered"); // no candidates at all
    const arr = [...flags].sort((a, b) =>
      ["included", "pending", "rejected", "filtered"].indexOf(a) - ["included", "pending", "rejected", "filtered"].indexOf(b));
    dispositions[post.id] = arr.length === 1 ? arr[0] : arr;
    const resolved = arr[0]; // precedence order
    dispCounts[resolved] = (dispCounts[resolved] || 0) + 1;
  }

  const run = {
    pack_id: "pack_ncr-2026-10",
    region_id: REGION_ID,
    bbox: NCR_BBOX,
    created_at: CREATED_AT,
    stale_after_days: 180,
    input_sha256: sha(readFileSync(RAW)),
    input_posts: posts.length,
    answered_posts: answered.length,
  };

  return { tables, dispositions, dispCounts, run, stats, recordSources };
}

export function writeOutputs(result, outDir) {
  mkdirSync(join(outDir, "eligible"), { recursive: true });
  const tables = { ...result.tables, record_source: result.recordSources };
  for (const t of TABLES) {
    writeFileSync(join(outDir, "eligible", `${t.name}.json`), JSON.stringify(tables[t.name] ?? [], null, 2) + "\n");
  }
  writeFileSync(join(outDir, "dispositions.json"), JSON.stringify(result.dispositions, null, 2) + "\n");
  writeFileSync(join(outDir, "run.json"), JSON.stringify(result.run, null, 2) + "\n");
  writeFileSync(join(outDir, "t14-eligible.json"), JSON.stringify({ stats: result.stats, dispositions: result.dispCounts }, null, 2) + "\n");
}

function fmtDropped(d) {
  return Object.entries(d).map(([k, v]) => `${k}=${v}`).join(", ") || "none";
}

export function reportMd(result) {
  const s = result.stats;
  return `# T14 — eligible records

Generated by \`tools/corpus/eligible.mjs\`. Input: T12 \`second_passed\` candidates only
(needs_review/rejected never emit records), T13 canonical places, raw snapshot.

## Candidates in

| state | count |
|---|---:|
| second_passed | ${s.candidates_in.second_passed ?? 0} |
| needs_review (queued, not eligible) | ${s.candidates_in.needs_review ?? 0} |
| rejected | ${s.candidates_in.rejected ?? 0} |

## Emission

| kind | in | emitted | dropped |
|---|---:|---:|---|
| rides → legs | ${s.rides.total} | ${s.rides.leg_ready} ready ride refs / ${s.rides.leg_excluded_suppressed} excluded | ${fmtDropped(s.rides.dropped)} |
| walks → walk_link | ${s.walks.total} | ${s.walks.emitted} | ${fmtDropped(s.walks.dropped)} |
| fares → fare_report | ${s.fares.total} | ${s.fares.emitted} | ${fmtDropped(s.fares.dropped)} |
| hours → hours_report | ${s.hours.total} | ${s.hours.emitted} | ${fmtDropped(s.hours.dropped)} |
| notes | ${s.notes.total} | ${s.notes.emitted} | — |
| service_status | — | ${s.service_status.verified} verified; ${s.service_status.suppressed_routes} routes suppressed by unverified inactive claims | ${s.service_status.dropped} |

INV-4 self-scan inside T14: ${s.leak_scan.dropped_rows} rows dropped, ${s.leak_scan.regenerated_labels} labels regenerated,
${s.leak_scan.nulled_signboards} over-long signboards nulled, ${s.leak_scan.renamed} names/areas replaced with safe fallbacks.

## Post dispositions (resolved)

| disposition | posts |
|---|---:|
${Object.entries(result.dispCounts).map(([k, v]) => `| ${k} | ${v} |`).join("\n")}

## Table row counts

| table | rows |
|---|---:|
${TABLES.map((t) => `| ${t.name} | ${t.name === "record_source" ? result.recordSources.length : result.tables[t.name]?.length ?? 0} |`).join("\n")}

## Notes on interpretation

- Rides whose board/alight text is an **ambiguous** alias or **unresolved** place emit no leg
  (no FK target) and are counted as dropped — never guessed.
- Routes under an unverified suspended/retired claim keep \`service_status\` from verified
  claims but their legs are \`excluded\` (INV-5: possibly-inactive services never route).
- \`fare_report.effective_at\` is the post date (report date), never a current-fare claim.
- Region boundary is the declared bbox envelope cited to a team_review source; the dataset
  ships no licensed boundary.
`;
}

if (process.argv[1] && process.argv[1].endsWith("eligible.mjs")) {
  const candidates = readFileSync(CANDIDATES, "utf8").trim().split("\n").map(JSON.parse);
  const places = JSON.parse(readFileSync(join(T13, "places.json"), "utf8"));
  const aliases = JSON.parse(readFileSync(join(T13, "aliases.json"), "utf8"));
  const ambiguities = JSON.parse(readFileSync(join(T13, "ambiguities.json"), "utf8"));
  const posts = JSON.parse(readFileSync(RAW, "utf8"));
  const sourceGrams = loadSourceNgrams(RAW);
  const result = buildEligible({ candidates, places, aliases, ambiguities, posts, sourceGrams });
  writeOutputs(result, OUT);
  const md = reportMd(result);
  mkdirSync(join(REPORT_MD, ".."), { recursive: true });
  writeFileSync(REPORT_MD, md);
  console.log(`T14: ${result.dispCounts.included ?? 0} included / ${result.dispCounts.pending ?? 0} pending / ${result.dispCounts.rejected ?? 0} rejected / ${result.dispCounts.filtered ?? 0} filtered posts`);
  console.log(`legs=${result.tables.leg.length} routes=${result.tables.route.length} stops=${result.tables.stop.length} walks=${result.tables.walk_link.length} fares=${result.tables.fare_report.length} hours=${result.tables.hours_report.length} notes=${result.tables.note.length}`);
  console.log(`report: ${REPORT_MD}`);
}
