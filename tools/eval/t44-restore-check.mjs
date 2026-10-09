#!/usr/bin/env node
/**
 * T44 save/restore/replan check (PRD-F15/F21, INV-3).
 *
 * Revalidates the SYNTHETIC fixtures in tools/eval/t44-restore-fixtures.json
 * against the same rules as revalidateRoute() in
 * apps/mobile/src/store/tripStore.ts (Member-4 store, Member-2 T25 contract):
 *
 *   record-exists ......... missing record            -> NeedsReplan(record_missing)
 *   still-eligible ........ retired/ineligible leg    -> NeedsReplan(record_retired)
 *   connected ............. broken sequence           -> NeedsReplan(connection_broken)
 *   step-in-bounds ........ step outside [0, legs)    -> NeedsReplan(step_out_of_bounds)
 *   unknown-schema ........ schema_version not known  -> NeedsReplan(unknown_schema)
 *   changed-record/pack ... pack_id changed           -> NeedsReplan(pack_changed)
 *   delete-one/all ........ saved-route + history delete controls (TripStore Map semantics)
 *   id-only columns ....... no raw chat / query text / GPS / coordinate columns (INV-3)
 *
 * The fixtures include one designated NEGATIVE fixture
 * (T44-pack-changed-negative): an incompatible pack must surface replanning
 * and must never silently render obsolete instructions.
 *
 * Usage (from the repo root):
 *   node tools/eval/t44-restore-check.mjs
 *   node tools/eval/t44-restore-check.mjs --self-test-only   # built-in unit checks only
 *   node tools/eval/t44-restore-check.mjs --no-self-test     # skip built-in unit checks
 *   node tools/eval/t44-restore-check.mjs --root <repoRoot>  # check another checkout
 *   node tools/eval/t44-restore-check.mjs --fixtures <path>  # explicit fixtures file
 *
 * Exit codes: 0 = fixtures PASS; 1 = fixture/check failure;
 * 2 = self-test failure or usage error.
 *
 * Plain node, zero dependencies, no network: this script only reads the local
 * fixtures file. All IDs in the fixtures are fake SYNTHETIC placeholders.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/** Schema versions this build understands; anything else -> NeedsReplan. Mirrors tripStore.ts. */
export const KNOWN_SCHEMA_VERSIONS = [1];

/** Exact-match (after lowercasing + stripping _/-) forbidden persisted columns (INV-3). */
const FORBIDDEN_NORMALIZED = new Set([
  "rawchat",
  "transcript",
  "transcripts",
  "querytext",
  "query",
  "chat",
  "gps",
  "gpsfix",
  "gpsfixes",
  "fix",
  "fixes",
  "latitude",
  "longitude",
  "lat",
  "lon",
  "lng",
  "coordinates",
  "coordinate",
  "coords",
  "trace",
  "traces",
  "firebaseuid",
  "uid",
  "cloudsync",
  "syncstate",
]);

/** Route objects persist ID arrays only — exact key set from tripStore.ts RouteIds. */
export const ALLOWED_ROUTE_KEYS = ["leg_ids", "stop_ids", "place_ids", "note_ids"];

/** Persisted *_id / *_ids columns must carry fake SYNTHETIC IDs (bare "id" test labels exempt). */
const ID_KEY_RE = /_ids?$/i;

/** Every persisted ID value must be a fake SYNTHETIC placeholder. */
export const SYN_ID_RE = /^SYN/i;

/** Catches smuggled "lat,lon" coordinate-pair values (timestamps never match: no decimal pair). */
export const COORD_PAIR_RE = /-?\d{2,3}\.\d{4,}\s*,\s*-?\d{1,3}\.\d{4,}/;

export function normalizeKey(key) {
  return String(key).toLowerCase().replace(/[_-]/g, "");
}

export function allRouteIds(route) {
  return [...route.leg_ids, ...route.stop_ids, ...route.place_ids, ...route.note_ids];
}

/**
 * Mirror of revalidateRoute() in apps/mobile/src/store/tripStore.ts.
 * Rule order matters: unknown_schema, pack_changed, record_missing,
 * record_retired, connection_broken, step_out_of_bounds, else valid.
 */
export function revalidateRoute(row, pack) {
  if (!KNOWN_SCHEMA_VERSIONS.includes(row.schema_version)) {
    return {
      status: "needs-replan",
      reason: "unknown_schema",
      detail: `schema_version ${row.schema_version} unknown`,
    };
  }
  if (row.pack_id !== pack.pack_id) {
    return {
      status: "needs-replan",
      reason: "pack_changed",
      detail: `pack ${row.pack_id} != ${pack.pack_id}`,
    };
  }
  for (const id of allRouteIds(row.route)) {
    if (!pack.hasRecord(id)) {
      return { status: "needs-replan", reason: "record_missing", detail: `record ${id} missing in pack` };
    }
  }
  for (const legId of row.route.leg_ids) {
    if (!pack.isLegReady(legId)) {
      return { status: "needs-replan", reason: "record_retired", detail: `leg ${legId} not ready` };
    }
  }
  if (!pack.isConnectionContinuous(row.route)) {
    return { status: "needs-replan", reason: "connection_broken", detail: "connection order broken" };
  }
  const stepCount = row.route.leg_ids.length;
  if (row.current_step < 0 || row.current_step >= Math.max(1, stepCount)) {
    return {
      status: "needs-replan",
      reason: "step_out_of_bounds",
      detail: `step ${row.current_step} outside [0, ${stepCount})`,
    };
  }
  return { status: "valid" };
}

/** Build the minimal installed-pack view (tripStore.ts PackView) from a fixture pack descriptor. */
export function makePackView(desc) {
  const records = new Set(desc.records ?? []);
  const retired = new Set(desc.retired_leg_ids ?? []);
  return {
    pack_id: desc.pack_id,
    schema_version: desc.schema_version,
    hasRecord: (id) => records.has(id),
    isLegReady: (legId) => !retired.has(legId),
    isConnectionContinuous: () => desc.connection_continuous !== false,
  };
}

function walk(value, trail, visit) {
  if (Array.isArray(value)) {
    value.forEach((item, idx) => walk(item, `${trail}[${idx}]`, visit));
    return;
  }
  if (value !== null && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      visit(key, item, trail);
      walk(item, trail ? `${trail}.${key}` : key, visit);
    }
  }
}

/** INV-3: no raw chat / query text / GPS / coordinate / trace / sync columns persisted. */
export function scanForbiddenColumns(fixtures) {
  const violations = [];
  walk(fixtures, "", (key, item, trail) => {
    void item;
    if (FORBIDDEN_NORMALIZED.has(normalizeKey(key))) {
      violations.push(`${trail ? `${trail}.` : ""}${key}`);
    }
  });
  return violations;
}

/** Every persisted *_id/*_ids value (plus pack record lists) must be a fake SYNTHETIC ID. */
export function scanSyntheticIds(fixtures) {
  const violations = [];
  walk(fixtures, "", (key, item, trail) => {
    const where = trail ? `${trail}.${key}` : key;
    const checkValues = (values) => {
      for (const v of values) {
        if (typeof v !== "string" || !SYN_ID_RE.test(v)) {
          violations.push(`${where} has non-SYNTHETIC id: ${JSON.stringify(v)}`);
        }
      }
    };
    if (ID_KEY_RE.test(key) && Array.isArray(item)) checkValues(item);
    else if (ID_KEY_RE.test(key) && typeof item === "string" && !SYN_ID_RE.test(item)) {
      violations.push(`${where} has non-SYNTHETIC id: ${JSON.stringify(item)}`);
    } else if (key === "records" && Array.isArray(item)) checkValues(item);
  });
  return violations;
}

/** No coordinate-pair values smuggled anywhere in the fixtures. */
export function scanCoordinateValues(fixtures) {
  const violations = [];
  const visit = (value, trail) => {
    if (typeof value === "string" && COORD_PAIR_RE.test(value)) {
      violations.push(`${trail}: ${value.slice(0, 80)}`);
    } else if (Array.isArray(value)) {
      value.forEach((item, idx) => visit(item, `${trail}[${idx}]`));
    } else if (value !== null && typeof value === "object") {
      for (const [key, item] of Object.entries(value)) {
        visit(item, trail ? `${trail}.${key}` : key);
      }
    }
  };
  visit(fixtures, "");
  return violations;
}

/** Every route object must carry exactly the ID-only key set (no raw/GPS extras). */
export function scanRouteShapes(fixtures) {
  const issues = [];
  walk(fixtures, "", (key, item, trail) => {
    if (key === "route" && item !== null && typeof item === "object" && !Array.isArray(item)) {
      const where = trail ? `${trail}.${key}` : key;
      const keys = Object.keys(item).sort();
      const want = [...ALLOWED_ROUTE_KEYS].sort();
      if (JSON.stringify(keys) !== JSON.stringify(want)) {
        issues.push(`${where} keys [${keys.join(",")}] != id-only [${want.join(",")}]`);
      }
      for (const k of ALLOWED_ROUTE_KEYS) {
        if (!Array.isArray(item[k]) || !item[k].every((v) => typeof v === "string")) {
          issues.push(`${where}.${k} must be a string array of IDs`);
        }
      }
    }
  });
  return issues;
}

/** Run one restore case from the fixtures; compare against its expected outcome. */
export function runRestoreCase(fixtureCase) {
  const pack = makePackView(fixtureCase.pack);
  const actual = revalidateRoute(fixtureCase.active_trip, pack);
  const expect = fixtureCase.expect ?? {};
  const statusOk = actual.status === expect.status;
  const reasonOk = expect.status !== "needs-replan" || actual.reason === expect.reason;
  const ok = statusOk && reasonOk;
  const got =
    actual.status === "valid" ? "valid" : `needs-replan(${actual.reason})`;
  const want =
    expect.status === "valid" ? "valid" : `needs-replan(${expect.reason ?? "?"})`;
  return { id: fixtureCase.id, kind: fixtureCase.kind ?? "case", ok, got, want, detail: actual.detail ?? "" };
}

/**
 * Delete controls with TripStore Map semantics: delete-one saved route,
 * deleting an unknown id returns false and changes nothing, clear-all history.
 */
export function runDeleteChecks(fixtures) {
  const results = [];
  const dc = fixtures.delete_checks ?? {};
  const saved = new Map((fixtures.saved_routes ?? []).map((r) => [r.saved_id, r]));
  const beforeSaved = saved.size;

  const oneId = dc.delete_one_saved_id;
  const deleted = saved.delete(oneId);
  const remaining = [...saved.keys()].sort();
  const wantRemaining = [...(dc.expect_remaining_saved_ids ?? [])].sort();
  results.push({
    name: "delete-one saved route",
    ok: deleted === true && JSON.stringify(remaining) === JSON.stringify(wantRemaining),
    detail: `deleted=${deleted} remaining=[${remaining.join(",")}]`,
  });

  const unknownId = dc.delete_unknown_saved_id ?? "SYN-saved-missing";
  const sizeBefore = saved.size;
  const unknownDeleted = saved.delete(unknownId);
  results.push({
    name: "delete unknown saved id is a no-op",
    ok: unknownDeleted === false && saved.size === sizeBefore && beforeSaved === (fixtures.saved_routes ?? []).length,
    detail: `deleted=${unknownDeleted} size=${saved.size}`,
  });

  const history = new Map((fixtures.history ?? []).map((r) => [r.history_id, r]));
  if (dc.clear_all_history === true) history.clear();
  results.push({
    name: "clear-all history",
    ok: history.size === (dc.expect_history_remaining ?? 0),
    detail: `remaining=${history.size}`,
  });
  return results;
}

// ---------------------------------------------------------------------------
// Built-in unit checks: positive (replan rejected) + negative (valid passes).
// These run on every invocation so a broken rule mirror fails fast (exit 2).
// ---------------------------------------------------------------------------

function baseRow() {
  return {
    pack_id: "SYNTHETIC-pack-v1",
    schema_version: 1,
    route: {
      leg_ids: ["SYN-leg-001", "SYN-leg-002"],
      stop_ids: ["SYN-stop-001"],
      place_ids: ["SYN-place-origin-A", "SYN-place-dest-B"],
      note_ids: ["SYN-note-001"],
    },
    current_step: 0,
  };
}

function basePack() {
  return makePackView({
    pack_id: "SYNTHETIC-pack-v1",
    schema_version: 1,
    records: ["SYN-leg-001", "SYN-leg-002", "SYN-stop-001", "SYN-place-origin-A", "SYN-place-dest-B", "SYN-note-001"],
    retired_leg_ids: [],
    connection_continuous: true,
  });
}

export function runSelfTests() {
  const results = [];
  const expectReplan = (name, row, pack, reason) => {
    const actual = revalidateRoute(row, pack);
    results.push({
      name,
      kind: "positive",
      ok: actual.status === "needs-replan" && actual.reason === reason,
      detail: `${actual.status}${actual.reason ? `(${actual.reason})` : ""}`,
    });
  };
  const expectPass = (name, ok, detail) => {
    results.push({ name, kind: "negative", ok, detail });
  };

  // Positive: every replan rule must fire.
  expectReplan("unknown schema replans", { ...baseRow(), schema_version: 99 }, basePack(), "unknown_schema");
  expectReplan(
    "changed pack replans",
    baseRow(),
    makePackView({ pack_id: "SYNTHETIC-pack-v2", schema_version: 1, records: [], retired_leg_ids: [], connection_continuous: true }),
    "pack_changed",
  );
  expectReplan(
    "missing record replans",
    baseRow(),
    makePackView({ pack_id: "SYNTHETIC-pack-v1", schema_version: 1, records: ["SYN-leg-001"], retired_leg_ids: [], connection_continuous: true }),
    "record_missing",
  );
  expectReplan(
    "retired leg replans",
    baseRow(),
    makePackView({
      pack_id: "SYNTHETIC-pack-v1",
      schema_version: 1,
      records: ["SYN-leg-001", "SYN-leg-002", "SYN-stop-001", "SYN-place-origin-A", "SYN-place-dest-B", "SYN-note-001"],
      retired_leg_ids: ["SYN-leg-001"],
      connection_continuous: true,
    }),
    "record_retired",
  );
  expectReplan(
    "broken connection replans",
    baseRow(),
    makePackView({
      pack_id: "SYNTHETIC-pack-v1",
      schema_version: 1,
      records: ["SYN-leg-001", "SYN-leg-002", "SYN-stop-001", "SYN-place-origin-A", "SYN-place-dest-B", "SYN-note-001"],
      retired_leg_ids: [],
      connection_continuous: false,
    }),
    "connection_broken",
  );
  expectReplan("step past last leg replans", { ...baseRow(), current_step: 2 }, basePack(), "step_out_of_bounds");
  expectReplan("negative step replans", { ...baseRow(), current_step: -1 }, basePack(), "step_out_of_bounds");

  // Positive: column / id / shape guards must fire on dirty input.
  expectPass(
    "raw chat column rejected",
    scanForbiddenColumns({ active_trip: { query_text: "SYNTHETIC query" } }).length > 0,
    "query_text flagged",
  );
  expectPass(
    "gps column rejected",
    scanForbiddenColumns({ active_trip: { gps_fix: "SYNTHETIC fix" } }).length > 0,
    "gps_fix flagged",
  );
  expectPass(
    "non-synthetic id rejected",
    scanSyntheticIds({ pack_id: "real-pack-1" }).length > 0,
    "pack_id flagged",
  );
  expectPass(
    "non-id route key rejected",
    scanRouteShapes({ route: { leg_ids: [], stop_ids: [], place_ids: [], note_ids: [], gps_trace: [] } }).length > 0,
    "gps_trace flagged",
  );

  // Negative: clean inputs must pass.
  {
    const actual = revalidateRoute(baseRow(), basePack());
    expectPass("valid trip restores", actual.status === "valid", actual.status);
  }
  expectPass(
    "clean columns pass",
    scanForbiddenColumns({ active_trip: { pack_id: "SYN-x", current_step: 0, label: "SYNTHETIC label" } }).length === 0,
    "clean",
  );
  expectPass(
    "synthetic ids pass",
    scanSyntheticIds({ pack_id: "SYNTHETIC-pack-v1", leg_ids: ["SYN-leg-001"] }).length === 0,
    "clean",
  );
  expectPass(
    "incompatible pack never renders valid",
    revalidateRoute(baseRow(), makePackView({ pack_id: "SYNTHETIC-pack-v2", schema_version: 1, records: [], retired_leg_ids: [], connection_continuous: true })).status ===
      "needs-replan",
    "replan, not silent render",
  );
  {
    const fixtureLike = {
      saved_routes: [
        { saved_id: "SYN-saved-001" },
        { saved_id: "SYN-saved-002" },
      ],
      history: [{ history_id: "SYN-hist-001" }],
      delete_checks: {
        delete_one_saved_id: "SYN-saved-001",
        expect_remaining_saved_ids: ["SYN-saved-002"],
        delete_unknown_saved_id: "SYN-saved-999",
        clear_all_history: true,
        expect_history_remaining: 0,
      },
    };
    const dels = runDeleteChecks(fixtureLike);
    expectPass(
      "delete-one/all simulation passes",
      dels.every((d) => d.ok),
      dels.map((d) => d.name).join(","),
    );
  }

  const passed = results.filter((r) => r.ok).length;
  return { ok: passed === results.length, passed, total: results.length, results };
}

function printUsage() {
  console.log(
    "usage: node tools/eval/t44-restore-check.mjs [--root <repoRoot>] [--fixtures <path>] [--self-test-only] [--no-self-test]",
  );
}

function main() {
  const args = process.argv.slice(2);
  let root = null;
  let fixturesPath = null;
  let selfTestOnly = false;
  let noSelfTest = false;
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--root" && i + 1 < args.length) {
      root = args[(i += 1)];
    } else if (arg === "--fixtures" && i + 1 < args.length) {
      fixturesPath = args[(i += 1)];
    } else if (arg === "--self-test-only") {
      selfTestOnly = true;
    } else if (arg === "--no-self-test") {
      noSelfTest = true;
    } else if (arg === "--help" || arg === "-h") {
      printUsage();
      process.exit(0);
    } else {
      console.error(`unknown argument: ${arg}`);
      printUsage();
      process.exit(2);
    }
  }

  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = root ? path.resolve(root) : path.resolve(scriptDir, "..", "..");
  const fixturesFile = fixturesPath
    ? path.resolve(fixturesPath)
    : path.join(repoRoot, "tools", "eval", "t44-restore-fixtures.json");

  const failures = [];
  const note = (ok, label, detail) => {
    console.log(`  [${ok ? "ok" : "FAIL"}] ${label}${detail ? ` -- ${detail}` : ""}`);
    if (!ok) failures.push(label);
  };

  if (!noSelfTest) {
    const self = runSelfTests();
    const positives = self.results.filter((r) => r.kind === "positive");
    const negatives = self.results.filter((r) => r.kind === "negative");
    console.log(
      `self-test: ${self.passed}/${self.total} passed ` +
        `(${positives.filter((r) => r.ok).length}/${positives.length} positive, ` +
        `${negatives.filter((r) => r.ok).length}/${negatives.length} negative)`,
    );
    for (const r of self.results) {
      console.log(`  [${r.ok ? "ok" : "FAIL"}] (${r.kind}) ${r.name} -- ${r.detail}`);
    }
    if (!self.ok) {
      console.error("SELF-TEST FAILURE: restore-rule mirror is broken; refusing to trust the fixture run.");
      process.exit(2);
    }
    if (selfTestOnly) {
      console.log("PASS: self-tests only; fixture run skipped (--self-test-only).");
      return;
    }
  }

  let fixtures;
  try {
    fixtures = JSON.parse(fs.readFileSync(fixturesFile, "utf8"));
  } catch (err) {
    console.error(`FAIL: cannot read fixtures: ${path.relative(repoRoot, fixturesFile)} (${err.message})`);
    process.exit(1);
  }
  console.log(`fixtures: ${path.relative(repoRoot, fixturesFile)}`);

  // INV-3: id-only persisted columns.
  const forbidden = scanForbiddenColumns(fixtures);
  note(forbidden.length === 0, "no raw-chat/GPS/coordinate columns persisted (INV-3)", forbidden.length === 0 ? "id-only" : forbidden.join(" | "));
  const coordValues = scanCoordinateValues(fixtures);
  note(coordValues.length === 0, "no coordinate-pair values in fixtures", coordValues.length === 0 ? "none" : coordValues.join(" | "));
  const synIds = scanSyntheticIds(fixtures);
  note(synIds.length === 0, "persisted IDs are fake SYNTHETIC placeholders", synIds.length === 0 ? "all SYN-marked" : synIds.join(" | "));
  const shapes = scanRouteShapes(fixtures);
  note(shapes.length === 0, "route payloads are ID arrays only", shapes.length === 0 ? "leg/stop/place/note ids" : shapes.join(" | "));

  // Restore / replan cases.
  const cases = fixtures.cases ?? [];
  note(cases.length > 0, "restore cases present", `${cases.length} case(s)`);
  let validCount = 0;
  let replanCount = 0;
  for (const c of cases) {
    const r = runRestoreCase(c);
    if (r.ok && r.got === "valid") validCount += 1;
    if (r.ok && r.got.startsWith("needs-replan")) replanCount += 1;
    note(r.ok, `(${r.kind}) ${r.id}`, `got ${r.got}, want ${r.want}${r.detail && !r.ok ? ` (${r.detail})` : ""}`);
  }

  // Designated negative fixture: incompatible pack -> replanning, not silent render.
  const negatives = cases.filter((c) => String(c.kind ?? "").startsWith("negative"));
  const negativesReplan = negatives.filter((c) => runRestoreCase(c).ok && runRestoreCase(c).got.startsWith("needs-replan"));
  note(
    negatives.length >= 1 && negativesReplan.length === negatives.length,
    "negative fixture: incompatible pack replans, never silently renders",
    `${negativesReplan.length}/${negatives.length} negative case(s) replan`,
  );

  // Delete controls: delete-one saved route, unknown no-op, clear-all history.
  for (const d of runDeleteChecks(fixtures)) {
    note(d.ok, d.name, d.detail);
  }

  if (failures.length > 0) {
    console.error(`FAIL: ${failures.length} T44 check(s) failed: ${failures.join("; ")}`);
    process.exit(1);
  }
  console.log(
    `PASS: T44 save/restore/replan fixtures valid (${validCount} valid restore, ${replanCount} needs-replan incl. negative pack-change, delete-one/all ok, id-only columns).`,
  );
}

const invokedDirectly =
  typeof process.argv[1] === "string" &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (invokedDirectly) main();
