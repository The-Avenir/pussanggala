// Negative fixtures: named mutations applied to a deep copy of valid tables.
// Shared by build.test.mjs and acceptance.mjs (T16 invalid-record/ambiguity/source-content
// fixtures). `expect` is the issue code each mutation must trigger. `sqlOnly` mutations
// target the SQLite constraints directly and are asserted through build() in the tests.
// All wording is synthetic; source-content mutations derive their planted copy from the
// supplied raw dataset at runtime, so no source text is stored here.

import { tokenize } from "./checks.mjs";
import { TABLE_BY_NAME } from "./spec.mjs";

export const clone = (v) => structuredClone(v);

const firstReady = (rows) => rows.find((r) => r.eligibility === "ready");

// Sparse packs may legitimately have no fares, walks, notes or ambiguity rows.
// Add only missing fixture prerequisites to the in-memory copy, with valid FKs and
// provenance, so lack of optional facts does not fail corpus acceptance.
function seedMissingFixtureRows(t) {
  const unique = (name, prefix) => {
    let n = 1;
    const pk = TABLE_BY_NAME[name].pk;
    while (t[name].some((r) => r[pk] === `${prefix}_acceptance-${n}`)) n += 1;
    return `${prefix}_acceptance-${n}`;
  };
  let fixtureSource;
  const add = (name, row) => {
    t[name].push(row);
    const spec = TABLE_BY_NAME[name];
    if (spec.kind) {
      if (!fixtureSource) {
        fixtureSource = unique("source", "src");
        t.source.push({ source_id: fixtureSource, kind: "team_review", url: null, post_id: null, posted_at: null, observed_at: null, license: null });
      }
      t.record_source.push({ link_id: Math.max(0, ...t.record_source.map((r) => r.link_id)) + 1, record_kind: spec.kind, record_id: row[spec.pk], source_id: fixtureSource, snapshot_sha256: null, comment_index: null });
    }
    return row;
  };
  const get = (name, predicate, make) => t[name].find(predicate) ?? add(name, make());
  const region = get("region", () => true, () => ({ region_id: unique("region", "rg"), name: "Synthetic region", boundary_geojson: "{}", boundary_sha256: "fixture" }));
  const place = (except) => get("place", (p) => p.ncr_status === "accepted" && p.place_id !== except,
    () => ({ place_id: unique("place", "pl"), region_id: region.region_id, name: "Synthetic location", kind: "other", area: "Metro Manila", ncr_status: "accepted", lat: null, lng: null, mapping_status: "unmapped" }));
  const a = place();
  const b = place(a.place_id);
  const stop = (p) => get("stop", (s) => s.place_id === p.place_id,
    () => ({ stop_id: unique("stop", "st"), place_id: p.place_id, name: "Synthetic stop", landmark_hint: "" }));
  const from = stop(a);
  const to = stop(b);
  const route = get("route", (r) => ["unknown", "reported_active"].includes(r.service_status),
    () => ({ route_id: unique("route", "rt"), mode: "bus", signboard: null, direction_label: "Synthetic direction", service_status: "unknown" }));
  const leg = get("leg", (r) => r.eligibility === "ready",
    () => ({ leg_id: unique("leg", "lg"), route_id: route.route_id, board_stop_id: from.stop_id, alight_stop_id: to.stop_id, ride_min: null, dist_km: null, eligibility: "ready" }));
  get("walk_link", (r) => r.eligibility === "ready",
    () => ({ walk_id: unique("walk_link", "wk"), from_stop_id: from.stop_id, to_stop_id: to.stop_id, walk_m: null, walk_min: null, walk_text: "Synthetic walking link", eligibility: "ready" }));
  get("place_stop", (r) => r.eligibility === "ready",
    () => ({ access_id: unique("place_stop", "ac"), place_id: a.place_id, stop_id: from.stop_id, direction: "both", walk_m: null, walk_min: null, walk_text: "Synthetic access", eligibility: "ready" }));
  get("fare_report", () => true,
    () => ({ fare_id: unique("fare_report", "fr"), leg_id: leg.leg_id, amount_min: 1, amount_max: 1, currency: "PHP", basis: "reported_segment", effective_at: null }));
  get("note", () => true, () => ({ note_id: unique("note", "nt"), body: "Synthetic note", kind: "tip" }));
  get("place_alias", () => true, () => ({ alias_id: 1, place_id: a.place_id, alias_norm: "synthetic location", alias_display: "Synthetic location" }));
  if (!t.place_ambiguity.length) {
    let norm = "synthetic ambiguous location";
    while (t.place_alias.some((r) => r.alias_norm === norm)) norm += " fixture";
    t.place_ambiguity.push({ ambiguity_id: 1, alias_norm: norm, place_id: a.place_id }, { ambiguity_id: 2, alias_norm: norm, place_id: b.place_id });
  }
}

const DEFINITIONS = [
  {
    name: "dangling foreign key (leg -> missing stop)",
    group: "invalid-record",
    expect: "dangling_fk",
    apply(t) { t.leg[0].alight_stop_id = "st_does-not-exist"; },
  },
  {
    name: "fare amount_min > amount_max",
    group: "invalid-record",
    expect: "fare_range_inverted",
    apply(t) { Object.assign(t.fare_report[0], { amount_min: 20, amount_max: 10 }); },
  },
  {
    name: "shape with two owners",
    group: "invalid-record",
    expect: "shape_owner_count",
    apply(t) {
      // Real packs may ship zero shapes; create one so the defect is always planted.
      if (!t.shape.length) {
        t.shape.push({
          shape_id: "sh_mut0001",
          leg_id: t.leg[0]?.leg_id ?? "lg_mut",
          walk_id: null,
          geojson: '{"type":"LineString","coordinates":[[0,0],[1,1]]}',
          geometry_kind: "schematic",
        });
      }
      const s = t.shape[0];
      if (s.leg_id == null) s.leg_id = t.leg[0]?.leg_id ?? "lg_mut";
      s.walk_id = t.walk_link[0]?.walk_id ?? "wk_mut";
    },
  },
  {
    name: "note_link with no owner",
    group: "invalid-record",
    expect: "note_link_owner_count",
    apply(t) {
      if (!t.note.length) t.note.push({ note_id: "nt_mut", body: "fixture note", kind: "tip" });
      if (!t.note_link.length) {
        t.note_link.push({
          link_id: Math.max(0, ...t.note_link.map((l) => l.link_id)) + 1,
          note_id: t.note[0].note_id,
          leg_id: t.leg[0]?.leg_id ?? "lg_mut",
          stop_id: null,
        });
      }
      Object.assign(t.note_link[0], { leg_id: null, stop_id: null });
    },
  },
  {
    name: "unpaired coordinates",
    group: "invalid-record",
    expect: "coords_unpaired",
    apply(t) {
      let p = t.place[0];
      if (!p) {
        p = {
          place_id: "pl_mut", region_id: t.region[0].region_id, name: "Mut Place",
          kind: "other", area: "Metro Manila", ncr_status: "accepted",
          lat: 14.6, lng: 121.0, mapping_status: "unmapped",
        };
        t.place.push(p);
      }
      if (p.lat == null) p.lat = 14.6;
      p.lng = null;
    },
  },
  {
    name: "negative duration",
    group: "invalid-record",
    expect: "row_invalid",
    apply(t) { t.walk_link[0].walk_min = -1; },
  },
  {
    name: "record without source",
    group: "invalid-record",
    expect: "missing_provenance",
    apply(t) {
      const n = t.note[0].note_id;
      t.record_source = t.record_source.filter((r) => !(r.record_kind === "note" && r.record_id === n));
    },
  },
  {
    name: "ready leg on suspended route",
    group: "invalid-record",
    expect: "ready_on_inactive_route",
    apply(t) {
      const leg = firstReady(t.leg);
      t.route.find((r) => r.route_id === leg.route_id).service_status = "suspended";
    },
  },
  {
    name: "ready access to an outside-NCR place",
    group: "invalid-record",
    expect: "ready_outside_ncr",
    apply(t) {
      const a = firstReady(t.place_stop);
      t.place.find((p) => p.place_id === a.place_id).ncr_status = "outside";
    },
  },
  {
    name: "invalid stable ID prefix",
    group: "invalid-record",
    expect: "row_invalid",
    apply(t) {
      const old = t.note[0].note_id;
      t.note[0].note_id = "xx_bad-prefix";
      for (const l of t.note_link) if (l.note_id === old) l.note_id = "xx_bad-prefix";
    },
  },
  {
    name: "ambiguous alias in unique place_alias",
    group: "ambiguity",
    expect: "alias_conflict",
    apply(t) {
      const amb = t.place_ambiguity[0];
      const maxId = Math.max(0, ...t.place_alias.map((a) => a.alias_id));
      t.place_alias.push({ alias_id: maxId + 1, place_id: amb.place_id, alias_norm: amb.alias_norm, alias_display: amb.alias_norm });
    },
  },
  {
    name: "same alias_norm twice in place_alias",
    group: "ambiguity",
    expect: "alias_conflict",
    apply(t) {
      const a = t.place_alias[0];
      const other = t.place.find((p) => p.place_id !== a.place_id);
      const maxId = Math.max(0, ...t.place_alias.map((x) => x.alias_id));
      t.place_alias.push({ alias_id: maxId + 1, place_id: other.place_id, alias_norm: a.alias_norm, alias_display: a.alias_display });
    },
  },
  {
    name: "ambiguity with a single candidate",
    group: "ambiguity",
    expect: "ambiguity_too_few",
    apply(t) {
      const norm = t.place_ambiguity[0].alias_norm;
      let kept = false;
      t.place_ambiguity = t.place_ambiguity.filter((a) => a.alias_norm !== norm || (!kept && (kept = true)));
    },
  },
  {
    name: "planted raw Reddit URL in a source",
    group: "source-content",
    expect: "leak_url",
    apply(t) { t.source[0].url = "https://www.reddit.com/r/HowToGetTherePH/comments/fixture/synthetic_title/"; },
  },
  {
    name: "planted raw dataset import in a note",
    group: "source-content",
    expect: "leak_raw_input",
    apply(t) { t.note[0].body = 'import raw from "howtogetthereph_dataset/ncr_routes.json";'; },
  },
  {
    name: "planted u/ handle in a note",
    group: "source-content",
    expect: "leak_handle",
    apply(t) { t.note[0].body = `${t.note[0].body} Thanks u/fixture_person for this.`; },
  },
  {
    name: "planted 6-word copy of source text",
    group: "source-content",
    expect: "leak_ngram",
    needsGrams: true,
    apply(t, ctx) {
      // Take any 6-gram from the source set; the planted text is never written to disk.
      const gram = ctx.grams.values().next().value;
      if (!gram) throw new Error("raw dataset produced no 6-word sequences");
      t.walk_link[0].walk_text = `Paraphrase: ${gram}.`;
    },
  },
];

export const MUTATIONS = DEFINITIONS.map((m) => ({ ...m, apply(t, ctx) {
  seedMissingFixtureRows(t);
  m.apply(t, ctx);
} }));

/** True when `text` contains no 6-gram of `grams` (sanity helper for tests). */
export function hasNgramOverlap(text, grams) {
  const toks = tokenize(text);
  for (let i = 0; i + 6 <= toks.length; i += 1) if (grams.has(toks.slice(i, i + 6).join(" "))) return true;
  return false;
}
