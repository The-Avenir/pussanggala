// T11 — deterministic candidate extraction from the NCR snapshot.
//
//   node tools/corpus/extract.mjs [--out <dir>] [--raw <ncr_routes.json>]
//
// Reads howtogetthereph_dataset/ncr_routes.json and writes, for every post that has
// stored answers, T11 candidate + outcome shards per tools/corpus/CONTRACT.md:
//   <out>/candidates-s{0..3}.jsonl, <out>/outcomes-s{0..3}.jsonl
//   data/raw/progress/T11.json
// Posts are assigned to a shard by a hash of the post id, so re-runs are byte-identical.
//
// Everything leaves here as review_state "extracted"; evidence.mjs (T12) decides the rest.
// Place strings are always sliced out of the post's own text — nothing is named that the
// source does not name. The three fields that reach the pack as prose (walk_text,
// hours_text, note body) are fixed templates of at most five words, so no six-word run of
// source wording can survive extraction (INV-4).
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
export const SNAPSHOT_SHA256 = "d3939475ebd250755fcdac776f703001480aeaa4b72d04b025fba54434c4fdf3";
export const SHARDS = 4;

// ---------- text helpers ----------
export const norm = (s) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Sentence-ish units. Multi-leg answers chain legs with tapos/then, so those split too. */
export function segments(text) {
  return String(text ?? "")
    .split(/[.!?;\n\r•]+|\s+(?:tapos|then|after\s+that|pagkatapos|afterwards)\s+/i)
    .map((s) => s.trim())
    .filter((s) => s.length > 1);
}

// Paraphrase templates. Each is ≤5 normalized tokens, so a 6-gram match is impossible.
const WALK_TEXT = "Walking connection noted.";
const HOURS_TEXT = "Reported window noted in source.";

// ---------- place strings ----------
const W = String.raw`[A-Za-zÀ-ÖØ-öø-ÿ0-9][A-Za-zÀ-ÖØ-öø-ÿ0-9.'’&/-]*`;
const P = String.raw`(?<![\w'’-])(${W}(?:[ \t]+${W}){0,3})`;

// Grammar, not identity: dropped from the edges of a sliced phrase.
const EDGE = new Set(
  ("a an the ng nang sa si ni na po ba ka mo ko kayo niyo nyo yung yun ung ang mga may meron " +
   "at and or kung if pag pero but kasi para so lang din rin nalang nlng daw raw pa naman " +
   "ito yan iyon dito doon dun jan diyan from to going papunta papuntang pauwi hanggang until " +
   "via thru through sakay sumakay sasakay sakayan bumaba baba bababa pababa ibaba lakad " +
   "maglakad lakarin walk walking ride riding take mag nag mas lalo pwede puwede kaya just " +
   "is are be you your my our their i we they then next").split(" ")
);
// A phrase holding any of these is prose the slicer over-reached into, not a place name.
const STOP = new Set(
  ("a an the of in on for with by from to into than that this these those it its you your yours " +
   "my me we our us they them their he she his her i u sa ng nang na ang mga ay si ni kay para " +
   "pero kasi kung pag kapag pagka tapos then and or but if po opo ba ka mo ko kayo niyo nyo " +
   "namin natin nila niya akin iyo yung yun ung dito doon dun jan diyan rito roon nalang nlng " +
   "lang din rin daw raw pa naman man nga eh oo hindi di wala walang may meron mayroon marami " +
   "konti kaunti kaunting lahat iba ibang same usual usually pwede puwede kaya dapat need " +
   "kailangan gusto ayaw alam sure baka siguro ata yata iirc parang mukhang sana nga " +
   "sakay sumakay sasakay magsakay sumasakay sakayan baba bumaba bababa pababa ibaba bumababa " +
   "lakad maglakad naglakad lakarin maglalakad walk walking walked ride rides riding take takes " +
   "taking go going goes went get gets getting got pumunta punta papunta papuntang pupunta " +
   "dumaan daan dadaan tawid tumawid hintay maghintay antay galing manggaling umalis alis " +
   "dating dumating balik bumalik pabalik sundan hanap hanapin try trying use using make ask " +
   "tanong sabi sabihin parada pumara pasok labas sakto puwedeng pwedeng " +
   "time times oras minute minutes mins min hour hours hrs araw day days gabi umaga hapon " +
   "tanghali traffic trapik matrapik pila queue mahal mura fare pamasahe bayad presyo price " +
   "option options way ways ruta sasakyan dami ingat safe delikado problem help thanks salamat " +
   "sorry mas more less better best faster mabilis matagal malapit malayo near far direct " +
   "diretso left right kanan kaliwa harap likod tabi gilid ilalim taas front back inside outside " +
   "around about mismo mismong talaga lalo medyo sobrang grabe via mag nag ulit kabila " +
   "tapat katapat harapan banda bandang dulo itaas labasan pasukan " +
   "destination destinations origin any is are am be can cant will wont would should could " +
   "there here other others another either neither both each every all some most next last " +
   "first final which what where when who why how short long connected alternative alternate " +
   "nearest nearby closest actual exact exactly straight").split(" ")
);
// Category words that name no particular place on their own.
const GENERIC = new Set(
  ("terminal terminals station stations stop stops pila sakayan jeep jeepney jeeps jeepneys dyip " +
   "bus buses uv uvs fx mrt lrt pnr train tren trains tricycle tricycles trike trikes tric toda " +
   "padyak carousel kanto corner bayan city mall malls highway road roads street streets st ave " +
   "avenue rd blvd boulevard area place lugar side gate exit entrance route trip biyahe " +
   "byahe vehicle van p2p ejeep beep modern overpass footbridge simbahan church palengke").split(" ")
);

/** Trim a sliced phrase down to a usable place string, or null if nothing identifying is left. */
export function cleanPlace(raw) {
  let s = String(raw ?? "")
    .replace(/[“”"']/g, " ")
    .replace(/\([^)]*\)/g, " ")
    .trim();
  let toks = s.split(/\s+/).filter(Boolean).map((t) => t.replace(/^[^A-Za-zÀ-ÖØ-öø-ÿ0-9]+|[^A-Za-zÀ-ÖØ-öø-ÿ0-9.'’&/-]+$/g, ""));
  const drop = (t) => { const b = norm(t); return !b || EDGE.has(b) || STOP.has(b); };
  while (toks.length && drop(toks[0])) toks.shift();
  while (toks.length && drop(toks.at(-1))) toks.pop();
  if (toks.length === 0 || toks.length > 4) return null;
  const name = toks.join(" ").replace(/[.,]+$/, "").trim();
  const n = norm(name);
  if (!n || n.length < 3) return null;
  if (n.split(" ").length > 6) return null; // keeps identifiers short (T12 long_identifier)
  const parts = n.split(" ");
  if (parts.some((t) => STOP.has(t))) return null;
  if (parts.some((t) => /^\d+(?:am|pm|nn|k|php|mins?|minutes?|hrs?|hours?|km|m)$/.test(t))) return null; // a clock or a quantity, not a place
  if (parts.every((t) => GENERIC.has(t) || EDGE.has(t) || /^\d+$/.test(t))) return null;
  if (!/[a-z]{2}/.test(n)) return null;
  return name;
}

const CITY_RE = /\b(manila|makati|pasig|taguig|pasay|caloocan|mandaluyong|marikina|muntinlupa|valenzuela|navotas|malabon|pateros|paranaque|quezon city|san juan|las pinas)\b/;

export function placeKind(name) {
  const n = norm(name);
  if (/\b(mrt|lrt|pnr|station|stn)\b/.test(n)) return "station";
  if (/\b(terminal|sakayan|pitx|garahe|depot)\b/.test(n)) return "terminal";
  if (/\b(university|univ|college|colleges|school|academy|campus|institute|pup|ust|ateneo|dlsu|feu|tup|pnu)\b/.test(n)) return "school";
  if (/\b(mall|sm|robinsons|robinson|megamall|glorietta|greenbelt|trinoma|gateway|starmall|festival|market market|landmark)\b/.test(n)) return "mall";
  if (CITY_RE.test(n) || /\b(barangay|brgy|village|subdivision|subd|ave|avenue|street|road|highway|blvd|boulevard|ext|district|area)\b/.test(n)) return "area";
  return "landmark";
}

/** Endpoint field -> {name, area_text, city}: drops lead-ins, keeps the first option only. */
export function endpointParts(raw) {
  let s = String(raw ?? "").replace(/[“”"]/g, " ").trim();
  s = s.replace(/^\s*(?:from|going\s+to|papuntang|papunta\s+sa|alt(?:ernate|ernative)?\s+route(?:\s+from)?|commute(?:\s+help)?\s*:?)\s+/i, "");
  const lastFrom = s.toLowerCase().lastIndexOf(" from ");
  if (lastFrom > 0) s = s.slice(lastFrom + 6);
  s = s.split(/\s+(?:or|\/)\s+/i)[0];
  s = s.replace(/\([^)]*\)/g, " ").trim();
  const chunks = s.split(",").map((c) => c.trim()).filter(Boolean);
  if (chunks.length === 0) return null;
  const name = cleanPlace(chunks[0]);
  if (!name) return null;
  const rest = chunks.slice(1);
  const cityChunk = [...chunks].reverse().find((c) => CITY_RE.test(norm(c)));
  return {
    name,
    area_text: rest.length ? rest.join(", ").slice(0, 60) : null,
    city: cityChunk && norm(cityChunk) !== norm(name) ? cityChunk : null,
  };
}

// ---------- modes ----------
const MODE_RULES = [
  ["modern_jeepney", /\b(?:modern(?:ized)?\s+jeep(?:ney)?s?|e-?jeep(?:ney)?s?|beeps?)\b/i],
  ["uv_express", /\b(?:uv\s*express|uvs?|fx)\b/i],
  ["rail", /\b(?:mrt-?\d?|lrt-?\d?|pnr|train|tren)\b/i],
  ["bus", /\b(?:bus(?:es)?|p2p|carousel)\b/i],
  ["tricycle", /\b(?:tricycles?|trikes?|tric|toda|padyak)\b/i],
  ["jeepney", /\b(?:jeep(?:ney)?s?|dyip|jip)\b/i],
];

/** Earliest mode keyword wins; the specific rules are listed first so "modern jeep" beats "jeep". */
export function detectMode(text) {
  let best = null;
  for (const [mode, re] of MODE_RULES) {
    const m = re.exec(text);
    if (m && (!best || m.index < best.index)) best = { mode, index: m.index };
  }
  return best?.mode ?? null;
}

// ---------- connection patterns ----------
const TO = String.raw`(?:to|going\s+to|papunta(?:ng|\s+sa)?|punta(?:ng|\s+sa)?|papasok\s+sa|hanggang(?:\s+sa)?)`;
const FROM_TO = new RegExp(String.raw`\bfrom\s+${P}\s+${TO}\s+${P}`, "gi");
const ARROW = new RegExp(String.raw`${P}\s*(?:>|->|→|=>)\s*${P}`, "gi");
const X_TO_Y = new RegExp(String.raw`${P}\s+${TO}\s+${P}`, "gi");
const BOARD_RE = new RegExp(String.raw`\b(?:sakay|sumakay|sasakay|magsakay|sumasakay|board|ride)\b[^,.;]{0,30}?\bsa\s+${P}`, "i");
const BOARD_REV_RE = new RegExp(String.raw`\bsa\s+${P}\b[^,.;]{0,24}?\b(?:sakay|sumakay|sasakay|magsakay|ride|board)\b`, "i");
const BOARD_FROM_RE = new RegExp(String.raw`\b(?:galing|manggaling|mula|coming\s+from)(?:\s+sa)?\s+${P}`, "i");
const BOARD_LEAD_RE = new RegExp(String.raw`^\s*(?:dun|doon|duon)?\s*sa\s+${P}\s*,`, "i");
const ALIGHT_RE = new RegExp(String.raw`\b(?:baba|bumaba|bababa|pababa|ibaba|magpababa|get\s+off|alight)\b[^,.;]{0,30}?\b(?:sa|ng|at|in)\s+(?:the\s+)?${P}`, "i");
const DEST_RE = new RegExp(String.raw`\b${TO}\s+${P}`, "i");
const WALK_KW = /\b(?:lakad|lakarin|maglakad|naglakad|maglalakad|naglalakad|walk(?:ing)?)\b/i;
// Either "may <X> signboard" or "signage na <X>" — the bare word must not be captured.
const SIGN_PRE_RE = new RegExp(String.raw`\b(?:may|yung|ung|na|ng)\s+${P}\s+(?:na\s+)?(?:signboard|signage|sign)\b`, "i");
const SIGN_POST_RE = new RegExp(String.raw`\b(?:signboard|signage)\b\s*(?:na|:|=)\s*["'“]?${P}`, "i");
const DIRECTION_RE = /\b(north|south|east|west)\s*bound\b/i;

/**
 * cleanPlace, retried on a shorter slice when the capture ran into surrounding prose.
 * `keep` is the side the connector sits on, so the words nearest it survive.
 */
function narrow(raw, keep) {
  const toks = String(raw ?? "").trim().split(/\s+/).filter(Boolean);
  while (toks.length) {
    const v = cleanPlace(toks.join(" "));
    if (v) return v;
    if (keep === "right") toks.shift();
    else toks.pop();
  }
  return null;
}

/** Endpoints stated as one phrase. Either side may stay null when only one is named. */
function connection(seg) {
  for (const re of [FROM_TO, ARROW, X_TO_Y]) {
    for (const m of seg.matchAll(re)) {
      const from = narrow(m[1], "right");
      const to = narrow(m[2], "left");
      if (!from && !to) continue;
      if (from && to && norm(from) === norm(to)) continue;
      return { from, to };
    }
  }
  return null;
}
const single = (re, seg) => {
  const m = re.exec(seg);
  return m ? narrow(m[1], "left") : null;
};
const firstOf = (res, seg) => { for (const re of res) { const v = single(re, seg); if (v) return v; } return null; };

/** "pa-X" is "to X" written short; rewritten in place so the connector patterns see it. */
const prep = (seg) => String(seg).replace(/\bpa-(?=[A-Za-zÀ-ÖØ-öø-ÿ])/gi, "to ");

// ---------- numbers ----------
const APPROX_RE = /(?:~|±|approx\w*|around|about|mga|roughly|more\s+or\s+less|ish|sakto\s+ba)\s*$/i;
const OPEN_BEFORE_RE = /(?:at\s+least|mahigit|lampas|up\s+to|less\s+than|under|starting\s+at)\s*$/i;
const NOT_MONEY_AFTER = /^\s*(?:%|:|\d|am\b|pm\b|mins?\b|minutes?\b|minuto|oras|hours?\b|hrs?\b|km\b|kms\b|meters?\b|metro|kph|taon|years?\b|pcs\b|pax\b|am\/pm)/i;
const money = (s) => Number(String(s).replace(/,/g, ""));
const FARE_PREFIX = /(?:₱|\bphp|\bp(?=\s?\d))\s*(\d{1,3}(?:,\d{3})*|\d{1,4})(?:\s*(?:-|–|to|hanggang)\s*(?:₱|php|p)?\s*(\d{1,3}(?:,\d{3})*|\d{1,4}))?/gi;
const FARE_SUFFIX = /\b(\d{1,3}(?:,\d{3})*|\d{1,4})(?:\s*(?:-|–|to|hanggang)\s*(\d{1,3}(?:,\d{3})*|\d{1,4}))?\s*(?:pesos?|pisos?|php)\b/gi;
const FARE_KW = /\b(?:pamasahe|fare|bayad|singil|presyo)\b[^.,;]{0,14}?\b(\d{1,3}(?:,\d{3})*|\d{1,4})(?:\s*(?:-|–|to|hanggang)\s*(\d{1,3}(?:,\d{3})*|\d{1,4}))?/gi;
const APPROX_INSIDE_RE = /~|approx\w*|around|about|\bmga\b|roughly|more\s+or\s+less|\bish\b/i;

/**
 * Peso amounts that are stated outright. Approximations ("around 50", "40+") are dropped
 * rather than hardened into an exact value — the T12 part B audit found that to be the
 * single biggest defect source in fare records.
 */
export function fares(seg) {
  const out = [];
  for (const re of [FARE_PREFIX, FARE_SUFFIX, FARE_KW]) {
    for (const m of seg.matchAll(re)) {
      const before = seg.slice(Math.max(0, m.index - 16), m.index);
      const after = seg.slice(m.index + m[0].length);
      if (/p2p/i.test(m[0]) || APPROX_INSIDE_RE.test(m[0]) || APPROX_RE.test(before) || OPEN_BEFORE_RE.test(before)) continue;
      if (after.startsWith("+") || /^[A-Za-z]/.test(after) || NOT_MONEY_AFTER.test(after)) continue;
      const lo = money(m[1]);
      const hi = m[2] == null ? lo : money(m[2]);
      if (!Number.isFinite(lo) || !Number.isFinite(hi) || lo < 1 || hi > 5000 || lo > hi) continue;
      out.push({ amount_min: lo, amount_max: hi, index: m.index });
    }
  }
  return out.sort((a, b) => a.index - b.index);
}

const CLOCK = /\b(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?|nn)\b|\b(\d{1,2}):(\d{2})\b/gi;

/** Clock values we can read without guessing: a meridiem, or an unambiguous 24h value. */
export function clocks(seg) {
  const out = [];
  for (const m of seg.matchAll(CLOCK)) {
    let hhmm = null;
    if (m[3]) {
      const h = Number(m[1]);
      const mi = Number(m[2] ?? 0);
      if (h > 12 || mi > 59) continue;
      const mer = m[3].replace(/\./g, "").toLowerCase();
      const h24 = mer === "nn" ? 12 : mer === "pm" ? (h % 12) + 12 : h % 12;
      hhmm = `${String(h24).padStart(2, "0")}:${String(mi).padStart(2, "0")}`;
    } else {
      const h = Number(m[4]);
      const mi = Number(m[5]);
      if (mi > 59 || h > 23) continue;
      if (h < 13) continue; // "4:00" without am/pm is a guess, not a fact
      hhmm = `${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}`;
    }
    out.push({ hhmm, index: m.index, end: m.index + m[0].length });
  }
  return out;
}

const SERVICE_HOURS_RE = /\b(?:biyahe|byahe|bumibiyahe|bumabiyahe|operat\w*|bukas|sarado|closed|last\s+trip|first\s+trip|huling\s+(?:biyahe|byahe|trip)|unang\s+(?:biyahe|byahe|trip)|schedule|sked|umaalis|departs?|departure|service|serbisyo)\b/i;
const ALL_DAY_RE = /\b24\s*(?:\/\s*7|hours|hrs|oras)\b/i;
const RANGE_JOIN_RE = /^\s*(?:-|–|—|to|until|till|hanggang|hggang|up\s+to)\s*$/i;
const ENDS_BEFORE_RE = /(?:until|till|hanggang|last\s+trip|huling\s+(?:biyahe|byahe|trip)|hanggang\s+sa|latest)\s*$/i;
const STARTS_BEFORE_RE = /(?:from|mula|simula|starts?(?:\s+at)?|first\s+trip|unang\s+(?:biyahe|byahe|trip)|as\s+early\s+as|umpisa)\s*$/i;
const DAYS_RULES = [
  [/\b(?:araw-?araw|everyday|every\s+day|daily)\b/i, "daily"],
  [/\b(?:weekdays?|weekday|lunes\s+hanggang\s+biyernes|mon(?:day)?\s*-\s*fri(?:day)?)\b/i, "weekdays"],
  [/\b(?:weekends?|sabado\s+at\s+linggo)\b/i, "weekends"],
  [/\b(?:sundays?|linggo)\b/i, "Sundays"],
  [/\b(?:saturdays?|sabado)\b/i, "Saturdays"],
];

export function hoursIn(seg) {
  if (!SERVICE_HOURS_RE.test(seg) && !ALL_DAY_RE.test(seg)) return null;
  const days = DAYS_RULES.find(([re]) => re.test(seg))?.[1] ?? null;
  const cs = clocks(seg);
  if (cs.length >= 2 && RANGE_JOIN_RE.test(seg.slice(cs[0].end, cs[1].index)))
    return { starts_local: cs[0].hhmm, ends_local: cs[1].hhmm, days_text: days };
  if (cs.length >= 1) {
    const before = seg.slice(Math.max(0, cs[0].index - 24), cs[0].index);
    if (ENDS_BEFORE_RE.test(before)) return { starts_local: null, ends_local: cs[0].hhmm, days_text: days };
    if (STARTS_BEFORE_RE.test(before)) return { starts_local: cs[0].hhmm, ends_local: null, days_text: days };
  }
  if (ALL_DAY_RE.test(seg)) return { starts_local: "00:00", ends_local: "23:59", days_text: days ?? "daily" };
  return null;
}

const MINUTES_RE = /\b(\d{1,3})\s*(?:-|–|to)\s*\d{1,3}\s*(?:mins?|minutes?|minuto)\b|\b(\d{1,3})\s*(?:mins?|minutes?|minuto)\b/i;
function minutesIn(seg) {
  const m = MINUTES_RE.exec(seg);
  if (!m || m[1] != null) return null; // ranges stay unrecorded; the payload holds one value
  const n = Number(m[2]);
  return n >= 1 && n <= 300 ? n : null;
}
const METERS_RE = /\b(\d{2,4})\s*(?:meters?|metro)\b/i;
function metersIn(seg) {
  const m = METERS_RE.exec(seg);
  const n = m ? Number(m[1]) : NaN;
  return Number.isFinite(n) && n >= 10 && n <= 5000 ? n : null;
}

// ---------- status and notes ----------
const STATUS_RULES = [
  ["retired", /\b(?:retired|phased?\s*out|discontinued|decommissioned|tinanggal\s+na|inalis\s+na)\b/i],
  ["suspended", /\b(?:suspend(?:ed|ido)?|(?:hindi|di)\s+na\s+(?:bumibiyahe|bumabiyahe|biyahe|byahe|umaandar|tumatakbo|dumadaan|dumaraan)|wala\s+nang?\s+(?:jeep|bus|uv|biyahe|byahe)|walang\s+(?:biyahe|byahe)|no\s+longer\s+(?:operating|running|in\s+service)|not\s+operating|stopped\s+operating)\b/i],
  ["reported_active", /\b(?:still\s+(?:operating|running|active)|may\s+biyahe\s+pa|bumibiyahe\s+pa|operational\s+pa)\b/i],
];
// Fixed bodies, ≤4 words each: a note never carries source wording (INV-4).
const NOTE_RULES = [
  [/\b(?:delikado|mag-?ingat|be\s+careful|watch\s+out|holdap|snatcher|hindi\s+ligtas|unsafe)\b/i, "Safety caution noted.", "warning"],
  [/\b(?:mahabang\s+pila|pila|pipila|queue|long\s+line)\b/i, "Queue delay noted.", "warning"],
  [/\b(?:traffic|trapik|matrapik|rush\s+hour)\b/i, "Traffic delay noted.", "warning"],
  [/\b(?:lipat|maglipat|transfer|magpalit|connecting)\b/i, "Transfer caution noted.", "tip"],
  [/\b(?:baha|flood|binabaha)\b/i, "Flooding caution noted.", "warning"],
];

// ---------- record assembly ----------
const record = (post, sha, comment_index, n, record_kind, candidate_payload) => ({
  candidate_id: `c_${post.id}_${comment_index === null ? "q" : comment_index}_${n}`,
  snapshot_sha256: sha,
  post_id: post.id,
  comment_index,
  record_kind,
  candidate_payload,
  evidence_check: null,
  review_reason: null,
  review_state: "extracted",
  reviewer_id: null,
  reviewed_at: null,
});

function questionPlaces(post, sha) {
  const out = [];
  const seen = new Set();
  const add = (raw, role) => {
    const parts = endpointParts(raw);
    if (!parts) return;
    const key = `${norm(parts.name)}|${role}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(record(post, sha, null, out.length + 1, "place", {
      name: parts.name,
      kind: placeKind(parts.name),
      area_text: parts.area_text,
      city: parts.city,
      role,
    }));
  };
  add(post.origin, "origin");
  add(post.destination, "destination");
  // Title endpoints only matter when they name something the origin/destination fields miss.
  const t = String(post.title ?? "").split(/\s+(?:to|going\s+to|papunta(?:ng|\s+sa)?)\s+/i);
  if (t.length === 2) {
    add(t[0], "origin");
    add(t[1], "destination");
  }
  return out;
}

function extractComment(post, sha, ci, text) {
  const out = [];
  let n = 0;
  const push = (kind, payload) => {
    const r = record(post, sha, ci, ++n, kind, payload);
    out.push(r);
    return r;
  };
  const segs = segments(text);

  // Pass A — connections. A fare/hours/status record later scopes to the ride nearest above it.
  const rideBySeg = new Array(segs.length).fill(null);
  const rides = [];
  const seenRide = new Set();
  const seenWalk = new Set();
  segs.forEach((raw, i) => {
    const seg = prep(raw);
    const mode = detectMode(seg);
    const conn = connection(seg);
    let ride = null;
    if (mode) {
      const board = conn?.from ?? firstOf([BOARD_RE, BOARD_REV_RE, BOARD_FROM_RE, BOARD_LEAD_RE], seg);
      const alight = conn?.to ?? single(ALIGHT_RE, seg);
      const key = `${mode}|${norm(board)}|${norm(alight)}`;
      if (board && alight && norm(board) !== norm(alight) && !seenRide.has(key)) {
        seenRide.add(key);
        const sign = narrow(SIGN_PRE_RE.exec(seg)?.[1], "right") ?? single(SIGN_POST_RE, seg);
        ride = push("ride", {
          mode,
          signboard: sign && norm(sign) !== norm(board) && norm(sign) !== norm(alight) ? sign : null,
          board_place: board,
          alight_place: alight,
          direction_text: DIRECTION_RE.exec(seg)?.[0] ?? null,
          ride_min: WALK_KW.test(seg) ? null : minutesIn(seg),
        });
        rideBySeg[i] = ride;
        rides.push(ride);
      }
    }
    if (!WALK_KW.test(seg)) return;
    const walkConn = mode && ride ? null : conn;
    let from = walkConn?.from ?? null;
    let to = walkConn?.to ?? single(DEST_RE, seg);
    if (!from && to) from = rides.at(-1)?.candidate_payload.alight_place ?? null; // walk continues the last leg
    if (!from || !to || norm(from) === norm(to)) return;
    const key = `${norm(from)}|${norm(to)}`;
    if (seenWalk.has(key)) return;
    seenWalk.add(key);
    push("walk", { from_place: from, to_place: to, walk_text: WALK_TEXT, walk_m: metersIn(seg), walk_min: minutesIn(seg) });
  });

  // Pass B — values, scoped to a ride when one is unambiguous.
  const scope = (i) => {
    for (let j = i; j >= 0; j--) if (rideBySeg[j]) return rideBySeg[j].candidate_id;
    for (let j = i + 1; j < rideBySeg.length; j++) if (rideBySeg[j]) return rideBySeg[j].candidate_id;
    return null;
  };
  const seenFare = new Set();
  const seenHours = new Set();
  const seenStatus = new Set();
  segs.forEach((seg, i) => {
    for (const f of fares(seg)) {
      const key = `${f.amount_min}|${f.amount_max}`;
      if (seenFare.has(key)) continue;
      seenFare.add(key);
      push("fare", { applies_to_ride: scope(i), amount_min: f.amount_min, amount_max: f.amount_max, currency: "PHP" });
    }
    const h = hoursIn(seg);
    if (h) {
      const key = `${h.starts_local}|${h.ends_local}|${h.days_text}`;
      if (!seenHours.has(key)) {
        seenHours.add(key);
        push("hours", { applies_to_ride: scope(i), hours_text: HOURS_TEXT, ...h });
      }
    }
    const status = STATUS_RULES.find(([, re]) => re.test(seg))?.[0];
    if (status && !seenStatus.has(status)) {
      seenStatus.add(status);
      push("service_status", { applies_to_ride: scope(i), status });
    }
  });

  // Pass C — at most one note per comment, from the first trigger that fires.
  const note = NOTE_RULES.find(([re]) => re.test(text));
  if (note) push("note", { body: note[1], kind: note[2] });
  return out;
}

/**
 * All candidates and the single outcome line for one answered post.
 * @returns {{candidates: object[], outcome: object}|null} null when the post has no answers.
 */
export function extractPost(post, sha = SNAPSHOT_SHA256) {
  const answers = Array.isArray(post?.answers) ? post.answers : [];
  if (answers.length === 0) return null;
  const candidates = questionPlaces(post, sha);
  let fromAnswers = 0;
  let routeFacts = 0;
  answers.forEach((a, ci) => {
    const rows = extractComment(post, sha, ci, a?.text ?? "");
    fromAnswers += rows.length;
    routeFacts += rows.filter((r) => r.record_kind === "ride" || r.record_kind === "walk").length;
    candidates.push(...rows);
  });
  const outcome = routeFacts > 0 ? "route_evidence" : fromAnswers > 0 ? "partial_evidence" : "no_route_evidence";
  return {
    candidates,
    outcome: {
      post_id: post.id,
      outcome,
      candidate_count: candidates.length,
      reason:
        outcome === "route_evidence"
          ? `${routeFacts} ride/walk candidate(s) from answers`
          : outcome === "partial_evidence"
            ? "answers yielded non-route facts only"
            : "no extractable fact in answers",
    },
  };
}

export function extractAll(posts, sha = SNAPSHOT_SHA256) {
  const candidates = [];
  const outcomes = [];
  for (const post of posts ?? []) {
    const r = extractPost(post, sha);
    if (!r) continue;
    candidates.push(...r.candidates);
    outcomes.push(r.outcome);
  }
  return { candidates, outcomes };
}

/** Stable shard for a post id — all of a post's lines land in the same shard. */
export const shardOf = (postId, shards = SHARDS) =>
  parseInt(createHash("sha256").update(String(postId)).digest("hex").slice(0, 8), 16) % shards;

// ---------- CLI ----------
const jsonl = (rows) => rows.map((r) => JSON.stringify(r)).join("\n") + "\n";

function progress(percent, status, note) {
  try {
    const f = path.join(ROOT, "data/raw/progress/T11.json");
    mkdirSync(path.dirname(f), { recursive: true });
    writeFileSync(f, JSON.stringify({ task: "T11", percent, status, note }) + "\n");
  } catch { /* progress is best-effort */ }
}

/**
 * Contract sha256 of the snapshot. A checkout with `core.autocrlf` on holds the same JSON
 * with CRLF endings, so the LF form is hashed as a fallback before giving up.
 */
export function snapshotSha(buf) {
  const sha = createHash("sha256").update(buf).digest("hex");
  if (sha === SNAPSHOT_SHA256) return { sha, eol_normalized: false };
  const lf = createHash("sha256").update(Buffer.from(buf.toString("utf8").replace(/\r\n/g, "\n"), "utf8")).digest("hex");
  if (lf === SNAPSHOT_SHA256) return { sha: lf, eol_normalized: true };
  throw new Error(`snapshot sha256 mismatch: ${sha}`);
}

export function run({ out = path.join(ROOT, "data/raw/t11"), raw = path.join(ROOT, "howtogetthereph_dataset/ncr_routes.json"), writeProgress = true } = {}) {
  if (writeProgress) progress(20, "running", "hashing snapshot");
  const buf = readFileSync(raw);
  const { sha, eol_normalized } = snapshotSha(buf);
  const posts = JSON.parse(buf.toString("utf8"));

  if (writeProgress) progress(55, "running", "extracting candidates");
  const { candidates, outcomes } = extractAll(posts, sha);

  mkdirSync(out, { recursive: true });
  const files = [];
  for (let s = 0; s < SHARDS; s++) {
    const c = candidates.filter((r) => shardOf(r.post_id) === s);
    const o = outcomes.filter((r) => shardOf(r.post_id) === s);
    const cf = path.join(out, `candidates-s${s}.jsonl`);
    const of = path.join(out, `outcomes-s${s}.jsonl`);
    writeFileSync(cf, jsonl(c));
    writeFileSync(of, jsonl(o));
    files.push({ shard: s, candidates: cf, candidate_count: c.length, outcomes: of, outcome_count: o.length });
  }

  const byKind = {};
  for (const c of candidates) byKind[c.record_kind] = (byKind[c.record_kind] ?? 0) + 1;
  const byOutcome = {};
  for (const o of outcomes) byOutcome[o.outcome] = (byOutcome[o.outcome] ?? 0) + 1;
  const summary = {
    task: "T11",
    snapshot_sha256: sha,
    eol_normalized,
    posts: posts.length,
    answered_posts: outcomes.length,
    candidates: candidates.length,
    by_kind: byKind,
    by_outcome: byOutcome,
    files,
  };
  if (writeProgress) progress(100, "done", `${candidates.length} candidates / ${outcomes.length} answered posts`);
  return summary;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? path.resolve(process.argv[i + 1]) : undefined; };
  const r = run({ out: arg("--out"), raw: arg("--raw") });
  console.log(
    `T11 extraction done — ${r.candidates} candidates across ${r.answered_posts} answered posts; ` +
    Object.entries(r.by_kind).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(", ")
  );
  console.log(Object.entries(r.by_outcome).map(([k, v]) => `${k} ${v}`).join(", "));
  console.log(`Wrote ${r.files.length * 2} shard files under ${path.relative(ROOT, path.dirname(r.files[0].candidates))}`);
}
