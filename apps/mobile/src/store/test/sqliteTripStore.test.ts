import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';
import { loadPack, type Pack } from '../../core';
import { minimalRawPack } from '../../../../../packages/core/test/fixtures/minimal-pack';
import { migrateUserDatabase, UserSchemaError } from '../migrations';
import { createSqliteTripStore, TripPersistenceError, type RouteSelection } from '../sqliteTripStore';
import type { SqlExecutor, SqlValue, UserDatabase } from '../sqlitePort';

// Real host SQLite, not a Map/query mock. Native Expo execution remains a gate.
class HostDatabase implements UserDatabase {
  readonly sqlite: DatabaseSync;
  failRun: RegExp | undefined;
  failExecAfter: RegExp | undefined;
  constructor(file = ':memory:') { this.sqlite = new DatabaseSync(file); }
  async execAsync(sql: string): Promise<void> {
    this.sqlite.exec(sql);
    if (this.failExecAfter?.test(sql)) throw new Error('Synthetic disk failure');
  }
  async runAsync(sql: string, ...params: SqlValue[]) {
    if (this.failRun?.test(sql)) throw new Error('Synthetic write failure');
    const result = this.sqlite.prepare(sql).run(...params);
    return { changes: Number(result.changes) };
  }
  async getFirstAsync<T>(sql: string, ...params: SqlValue[]): Promise<T | null> {
    return (this.sqlite.prepare(sql).get(...params) as T | undefined) ?? null;
  }
  async getAllAsync<T>(sql: string, ...params: SqlValue[]): Promise<T[]> {
    return this.sqlite.prepare(sql).all(...params) as T[];
  }
  async withExclusiveTransactionAsync(task: (tx: SqlExecutor) => Promise<void>): Promise<void> {
    this.sqlite.exec('BEGIN IMMEDIATE');
    try { await task(this); this.sqlite.exec('COMMIT'); }
    catch (error) { this.sqlite.exec('ROLLBACK'); throw error; }
  }
}

const openDbs: HostDatabase[] = [];
const directories: string[] = [];
function open(file?: string) {
  const db = new HostDatabase(file); openDbs.push(db); return db;
}
function close(db: HostDatabase) { db.sqlite.close(); openDbs.splice(openDbs.indexOf(db), 1); }
afterEach(() => {
  for (const db of openDbs.splice(0)) db.sqlite.close();
  for (const dir of directories.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function fixture() {
  const loaded = loadPack(minimalRawPack());
  if (!loaded.ok) throw new Error('Invalid synthetic pack fixture');
  const selection: RouteSelection = {
    originPlaceId: 'pl_demo-plaza', destinationPlaceId: 'pl_demo-terminal', preference: 'balanced',
    itinerary: { v: 1, steps: [
      { kind: 'access', id: 'ac_demo-in' }, { kind: 'leg', id: 'lg_demo-1' },
      { kind: 'walk', id: 'wk_demo-1' }, { kind: 'leg', id: 'lg_demo-2' },
      { kind: 'access', id: 'ac_demo-out' },
    ] },
  };
  return { pack: loaded.value, selection };
}
const now = () => new Date('2026-10-10T03:00:00.000Z');
async function setup() {
  const db = open();
  const store = await createSqliteTripStore(db, now);
  return { db, store, ...fixture() };
}

describe('user database migrations', () => {
  it('creates only the five contracted tables and migrates idempotently', async () => {
    const db = open();
    await migrateUserDatabase(db);
    await migrateUserDatabase(db);
    expect(await db.getFirstAsync('PRAGMA user_version')).toEqual({ user_version: 1 });
    const tables = await db.getAllAsync<{ name: string }>("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
    expect(tables.map((r) => r.name)).toEqual(['ACTIVE_TRIP', 'INSTALLED_ASSET', 'SAVED_ROUTE', 'TRIP_HISTORY', 'USER_SETTING']);
    for (const table of tables) {
      const columns = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table.name})`);
      expect(columns.every((r) => !/chat|query|transcript|latitude|longitude|trace|uid|sync|^lat$|^lng$/i.test(r.name))).toBe(true);
    }
  });

  it('rolls back both DDL and version after a migration failure and can retry', async () => {
    const db = open(); db.failExecAfter = /CREATE TABLE/;
    await expect(migrateUserDatabase(db)).rejects.toThrow('Synthetic disk failure');
    expect(await db.getFirstAsync('PRAGMA user_version')).toEqual({ user_version: 0 });
    expect(await db.getAllAsync("SELECT name FROM sqlite_master WHERE type='table'")).toEqual([]);
    db.failExecAfter = undefined;
    await migrateUserDatabase(db);
    expect(await db.getFirstAsync('PRAGMA user_version')).toEqual({ user_version: 1 });
  });

  it('rejects a newer user schema without downgrading or deleting data', async () => {
    const db = open(); await migrateUserDatabase(db);
    await db.runAsync('INSERT INTO USER_SETTING VALUES (?, ?)', 'existing', 'preserve');
    await db.execAsync('PRAGMA user_version=2');
    await expect(createSqliteTripStore(db)).rejects.toBeInstanceOf(UserSchemaError);
    expect(await db.getFirstAsync('PRAGMA user_version')).toEqual({ user_version: 2 });
    expect(await db.getFirstAsync('SELECT value FROM USER_SETTING')).toEqual({ value: 'preserve' });
  });
});

describe('committed ID-only trips', () => {
  it('preserves committed state and rolls back an interrupted write after a host writer is killed', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'pusang-t44-kill-')); directories.push(dir);
    const file = join(dir, 'user.sqlite'); const db = open(file);
    const { pack, selection } = fixture(); const store = await createSqliteTripStore(db, now);
    await store.startTrip(selection, pack); await store.advanceStep(pack);
    close(db);
    const killed = spawnSync(process.execPath, ['--input-type=module', '-e',
      'import { DatabaseSync } from "node:sqlite"; const db=new DatabaseSync(process.argv[1]); db.exec("BEGIN IMMEDIATE; UPDATE ACTIVE_TRIP SET current_step=4"); console.log("write started"); process.kill(process.pid, "SIGKILL");', file], { encoding: 'utf8' });
    expect(killed.stdout.trim()).toBe('write started');
    expect(killed.status).not.toBe(0);
    const reopened = await createSqliteTripStore(open(file), now);
    expect(await reopened.restoreActiveTrip(pack)).toMatchObject({ status: 'valid', trip: { currentStep: 1 } });
  });

  it('starts empty and restores file-backed active, saved and history data after reopen', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'pusang-t44-')); directories.push(dir);
    const file = join(dir, 'user.sqlite'); const db = open(file);
    const { pack, selection } = fixture(); let store = await createSqliteTripStore(db, now);
    expect(await store.restoreActiveTrip(pack)).toEqual({ status: 'empty' });
    await store.startTrip(selection, pack); await store.advanceStep(pack); await store.advanceStep(pack);
    const savedId = await store.saveRoute(selection, pack, 'My route');
    const historyId = await store.recordHistory(selection, pack);
    close(db);
    // A separate process can read the committed file without any JS state.
    const probe = spawnSync(process.execPath, ['--input-type=module', '-e',
      'import { DatabaseSync } from "node:sqlite"; const db=new DatabaseSync(process.argv[1]); console.log(db.prepare("SELECT current_step FROM ACTIVE_TRIP").get().current_step); db.close();', file], { encoding: 'utf8' });
    expect(probe.status).toBe(0); expect(probe.stdout.trim()).toBe('2');
    store = await createSqliteTripStore(open(file), now);
    expect(await store.restoreActiveTrip(pack)).toMatchObject({ status: 'valid', trip: { currentStep: 2, selected: selection.itinerary } });
    expect(await store.listSavedRoutes(pack)).toMatchObject([{ savedId, label: 'My route', restoration: { status: 'valid' } }]);
    expect(await store.listHistory(pack)).toMatchObject([{ historyId, kind: 'looked_up', restoration: { status: 'valid' } }]);
  });

  it('keeps exactly one active row and resets route selection/manual step on replan', async () => {
    const { db, store, pack, selection } = await setup();
    await store.startTrip(selection, pack); await store.advanceStep(pack);
    await store.startTrip({ ...selection, preference: 'lowest_fare' }, pack);
    expect(await db.getFirstAsync('SELECT count(*) AS n FROM ACTIVE_TRIP')).toEqual({ n: 1 });
    expect(await store.restoreActiveTrip(pack)).toMatchObject({ status: 'valid', trip: { currentStep: 0, preference: 'lowest_fare' } });
    await expect(db.runAsync('INSERT INTO ACTIVE_TRIP SELECT 2, pack_id, schema_version, origin_place_id, destination_place_id, preference, route_json, current_step, started_at FROM ACTIVE_TRIP')).rejects.toThrow();
  });

  it('serializes simultaneous manual advances across store instances and clamps the final step', async () => {
    const { db, store, pack, selection } = await setup();
    const second = await createSqliteTripStore(db, now);
    await store.startTrip(selection, pack);
    await Promise.all([store.advanceStep(pack), second.advanceStep(pack), store.advanceStep(pack)]);
    expect(await store.restoreActiveTrip(pack)).toMatchObject({ status: 'valid', trip: { currentStep: 3 } });
    await Promise.all(Array.from({ length: 10 }, () => store.advanceStep(pack)));
    expect(await store.restoreActiveTrip(pack)).toMatchObject({ status: 'valid', trip: { currentStep: 4 } });
  });

  it.each(['balanced', 'lowest_fare', 'fewest_transfers', 'shortest_reported_time'] as const)('persists the shared %s preference', async (preference) => {
    const { store, pack, selection } = await setup();
    await store.startTrip({ ...selection, preference }, pack);
    expect(await store.restoreActiveTrip(pack)).toMatchObject({ status: 'valid', trip: { preference } });
  });

  it('saves only explicit IDs/preferences/timestamps and never accepts raw extras', async () => {
    const { db, store, pack, selection } = await setup();
    const privateExtra = { ...selection, rawQuery: 'Synthetic private text', latitude: 0, pendingClarification: { text: 'Synthetic text' } };
    await expect(store.startTrip(privateExtra, pack)).rejects.toMatchObject({ reason: 'invalid_input' });
    await expect(store.saveRoute(privateExtra, pack)).rejects.toMatchObject({ reason: 'invalid_input' });
    await expect(store.recordHistory(privateExtra, pack)).rejects.toMatchObject({ reason: 'invalid_input' });
    expect(await db.getAllAsync('SELECT * FROM ACTIVE_TRIP')).toEqual([]);
    await store.startTrip(selection, pack);
    const raw = await db.getFirstAsync<{ route_json: string; started_at: string }>('SELECT * FROM ACTIVE_TRIP');
    expect(JSON.parse(raw!.route_json)).toEqual(selection.itinerary);
    expect(raw!.started_at).toBe(now().toISOString());
    expect(Object.keys(raw!)).toEqual(['trip_id', 'pack_id', 'schema_version', 'origin_place_id', 'destination_place_id', 'preference', 'route_json', 'current_step', 'started_at']);
  });

  it('rejects private fields hidden in the itinerary or its steps', async () => {
    const { store, pack, selection } = await setup();
    const nested = { ...selection, itinerary: { ...selection.itinerary, chat: 'Synthetic private text' } };
    await expect(store.startTrip(nested, pack)).rejects.toMatchObject({ reason: 'invalid_input' });
    const steps = selection.itinerary.steps.map((s) => ({ ...s, gps: [0, 0] }));
    await expect(store.saveRoute({ ...selection, itinerary: { v: 1, steps } }, pack)).rejects.toMatchObject({ reason: 'invalid_input' });
  });

  it('rejects legacy preferences, invalid place IDs, wrong step prefixes and invented selections', async () => {
    const { store, pack, selection } = await setup();
    await expect(store.startTrip({ ...selection, preference: 'least-walk' } as unknown as RouteSelection, pack)).rejects.toMatchObject({ reason: 'invalid_input' });
    await expect(store.startTrip({ ...selection, originPlaceId: 'private text' }, pack)).rejects.toMatchObject({ reason: 'invalid_input' });
    await expect(store.startTrip({ ...selection, itinerary: { v: 1, steps: [{ kind: 'leg', id: 'wk_wrong' }] } }, pack)).rejects.toMatchObject({ reason: 'invalid_input' });
    await expect(store.startTrip({ ...selection, originPlaceId: 'pl_missing' }, pack)).rejects.toMatchObject({ reason: 'needs_replan' });
  });

  it('binds labels as data, defaults to null, and rejects overlong labels', async () => {
    const { store, pack, selection } = await setup();
    const label = "My route'); DELETE FROM ACTIVE_TRIP; --";
    await store.startTrip(selection, pack);
    await store.saveRoute(selection, pack, label); await store.saveRoute(selection, pack);
    expect((await store.listSavedRoutes(pack)).map((r) => r.label)).toContain(label);
    expect((await store.listSavedRoutes(pack)).map((r) => r.label)).toContain(null);
    expect((await store.restoreActiveTrip(pack)).status).toBe('valid');
    await expect(store.saveRoute(selection, pack, 'x'.repeat(81))).rejects.toMatchObject({ reason: 'invalid_input' });
  });

  it('deletes individual saved/history entries, clears all history and preserves unrelated settings', async () => {
    const { db, store, pack, selection } = await setup();
    await db.runAsync('INSERT INTO USER_SETTING VALUES (?, ?)', 'synthetic', 'preserve');
    const a = await store.saveRoute(selection, pack); const b = await store.saveRoute(selection, pack);
    expect(a).not.toBe(b);
    const h = await store.recordHistory(selection, pack); await store.recordHistory(selection, pack);
    expect(await store.deleteSavedRoute(a)).toBe(true); expect(await store.deleteSavedRoute(a)).toBe(false);
    expect((await store.listSavedRoutes(pack)).map((r) => r.savedId)).toEqual([b]);
    expect(await store.deleteHistoryRow(h)).toBe(true); expect(await store.deleteHistoryRow(h)).toBe(false);
    await store.clearHistory(); expect(await store.listHistory(pack)).toEqual([]);
    expect(await db.getFirstAsync('SELECT value FROM USER_SETTING')).toEqual({ value: 'preserve' });
  });

  it('ends a trip and records taken history atomically; reset never adds history', async () => {
    const { store, pack, selection } = await setup();
    await store.startTrip(selection, pack); await store.endTrip(pack, true);
    expect(await store.restoreActiveTrip(pack)).toEqual({ status: 'empty' });
    expect(await store.listHistory(pack)).toMatchObject([{ kind: 'taken' }]);
    await store.startTrip(selection, pack); await store.clearActiveTrip();
    expect(await store.restoreActiveTrip(pack)).toEqual({ status: 'empty' });
    expect(await store.listHistory(pack)).toHaveLength(1);
  });

  it('keeps active state if the atomic end-trip history write fails, then retries', async () => {
    const { db, store, pack, selection } = await setup();
    await store.startTrip(selection, pack);
    db.failRun = /INSERT INTO TRIP_HISTORY/;
    await expect(store.endTrip(pack, true)).rejects.toThrow('Synthetic write failure');
    expect((await store.restoreActiveTrip(pack)).status).toBe('valid');
    expect(await store.listHistory(pack)).toEqual([]);
    db.failRun = undefined; await store.endTrip(pack, true);
    expect(await store.restoreActiveTrip(pack)).toEqual({ status: 'empty' });
  });
});

describe('compatibility-aware restoration against the installed pack', () => {
  it('rebuilds changed facts, conflicts and unknowns from a replacement pack; only structured state returns', async () => {
    const { store, pack, selection } = await setup(); await store.startTrip(selection, pack);
    const replacement = fixture().pack; replacement.manifest.pack_id = 'pack_replacement';
    replacement.faresByLeg.get('lg_demo-1')![0]!.amount_min = 30;
    replacement.faresByLeg.get('lg_demo-1')![0]!.amount_max = 35;
    const result = await store.restoreActiveTrip(replacement);
    expect(result).toMatchObject({ status: 'valid', trip: { packId: 'pack_replacement' }, itinerary: { fare: { status: 'unknown' }, reportedRideMinutes: { known: false } } });
    if (result.status !== 'valid') throw new Error('Expected valid synthetic restore');
    expect(result.itinerary.recordIds).toContain('fr_demo-1a');
    expect(Object.keys(result.trip)).toEqual(['packId', 'schemaVersion', 'originPlaceId', 'destinationPlaceId', 'preference', 'selected', 'currentStep']);
  });

  const invalidPacks: [string, (pack: Pack) => void][] = [
    ['record_missing', (p) => { const legs = new Map(p.legs); legs.delete('lg_demo-1'); p.legs = legs; }],
    ['record_ineligible', (p) => { p.walks.get('wk_demo-1')!.eligibility = 'excluded'; }],
    ['service_suspended', (p) => { p.routes.get('rt_demo-jeep')!.service_status = 'suspended'; }],
    ['service_suspended', (p) => { p.routes.get('rt_demo-jeep')!.service_status = 'retired'; }],
    ['continuity_broken', (p) => { p.walks.get('wk_demo-1')!.from_stop_id = 'st_demo-d'; }],
    ['endpoint_mismatch', (p) => { p.placeStops.get('ac_demo-in')!.direction = 'from_stop'; }],
    ['schema_changed', (p) => { p.manifest.schema_version = 2; }],
    ['record_ineligible', (p) => { p.places.get('pl_demo-plaza')!.ncr_status = 'outside'; }],
  ];
  it.each(invalidPacks)('withholds active, saved and history instructions for %s', async (reason, change) => {
    const { store, pack, selection } = await setup();
    await store.startTrip(selection, pack); await store.saveRoute(selection, pack); await store.recordHistory(selection, pack);
    const replacement = fixture().pack; change(replacement);
    const expected = { status: 'needs_replan', reason };
    expect(await store.restoreActiveTrip(replacement)).toMatchObject(expected);
    expect((await store.listSavedRoutes(replacement))[0]!.restoration).toMatchObject(expected);
    expect((await store.listHistory(replacement))[0]!.restoration).toMatchObject(expected);
    expect(await store.advanceStep(replacement)).toMatchObject(expected);
    expect(await store.endTrip(replacement, true)).toMatchObject(expected);
    expect(await store.restoreActiveTrip(replacement)).toHaveProperty('replan', {
      originPlaceId: selection.originPlaceId, destinationPlaceId: selection.destinationPlaceId, preference: selection.preference,
    });
    await expect(store.startTrip(selection, replacement)).rejects.toBeInstanceOf(TripPersistenceError);
  });

  it.each([
    "UPDATE ACTIVE_TRIP SET route_json = '{'",
    'UPDATE ACTIVE_TRIP SET preference = \'legacy\'',
    'UPDATE ACTIVE_TRIP SET current_step = 99',
    'UPDATE ACTIVE_TRIP SET schema_version = 2',
  ])('returns an honest replan state for corrupt/incompatible stored state: %s', async (sql) => {
    const { db, store, pack, selection } = await setup(); await store.startTrip(selection, pack);
    await db.execAsync(sql);
    const restored = await store.restoreActiveTrip(pack);
    expect(restored.status).toBe('needs_replan');
    expect(restored).not.toHaveProperty('itinerary'); expect(restored).not.toHaveProperty('trip');
  });

  it('withholds malformed saved route content but keeps the entry deletable', async () => {
    const { db, store, pack, selection } = await setup(); const id = await store.saveRoute(selection, pack);
    await db.runAsync('UPDATE SAVED_ROUTE SET route_json = ?', '{"private":"Synthetic private text"}');
    expect(await store.listSavedRoutes(pack)).toEqual([{ savedId: id, label: null, createdAt: now().toISOString(), restoration: { status: 'needs_replan', reason: 'invalid_saved_data' } }]);
    expect(await store.deleteSavedRoute(id)).toBe(true);
  });

  it('withholds malformed history content but keeps the entry deletable', async () => {
    const { db, store, pack, selection } = await setup(); const id = await store.recordHistory(selection, pack);
    await db.runAsync('UPDATE TRIP_HISTORY SET route_json = ?', 'invalid');
    expect(await store.listHistory(pack)).toEqual([{ historyId: id, kind: 'looked_up', at: now().toISOString(), restoration: { status: 'needs_replan', reason: 'invalid_saved_data' } }]);
    expect(await store.deleteHistoryRow(id)).toBe(true);
  });

  it('rejects corrupt library metadata explicitly rather than exposing arbitrary strings', async () => {
    const { db, store, pack, selection } = await setup(); await store.saveRoute(selection, pack);
    await db.runAsync('UPDATE SAVED_ROUTE SET saved_id = ?', 'Synthetic arbitrary text');
    await expect(store.listSavedRoutes(pack)).rejects.toMatchObject({ reason: 'invalid_saved_data' });
  });
});
