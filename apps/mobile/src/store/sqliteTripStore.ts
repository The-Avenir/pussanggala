import { validateRestoration, SUPPORTED_PACK_SCHEMA_VERSION, type Pack, type TripState } from '../core';
import { migrateUserDatabase } from './migrations';
import { serialize, transaction, type SqlExecutor, type UserDatabase } from './sqlitePort';
import {
  activeSchema, savedSchema, historySchema, selectionSchema, opaqueId, timestamp, labelSchema,
  type HistoryKind, type RouteSelection,
} from './persistenceSchema';

export type { RouteSelection, HistoryKind } from './persistenceSchema';
export type { UserDatabase, SqlExecutor } from './sqlitePort';

type CoreRestore = ReturnType<typeof validateRestoration>;
type RestoredItinerary = Extract<CoreRestore, { status: 'valid' }>['itinerary'];
export type ReplanRequest = Pick<RouteSelection, 'originPlaceId' | 'destinationPlaceId' | 'preference'>;
export type RestoreResult =
  | { status: 'valid'; trip: TripState; itinerary: RestoredItinerary }
  | { status: 'needs_replan'; reason: Extract<CoreRestore, { status: 'needs_replan' }>['reason'] | 'invalid_saved_data'; replan?: ReplanRequest }
  | { status: 'empty' };

export class TripPersistenceError extends Error {
  constructor(readonly reason: 'invalid_input' | 'invalid_saved_data' | 'needs_replan') {
    // Never include the rejected object or DB bindings in an error/log.
    super(`Trip persistence: ${reason}`);
  }
}

interface CommonRow {
  pack_id: string; origin_place_id: string; destination_place_id: string;
  preference: TripState['preference']; route_json: string;
}

function restoreRow(row: CommonRow, pack: Pack, schemaVersion: number, currentStep = 0): RestoreResult {
  const replan: ReplanRequest = { originPlaceId: row.origin_place_id, destinationPlaceId: row.destination_place_id, preference: row.preference };
  if (schemaVersion !== SUPPORTED_PACK_SCHEMA_VERSION || pack.manifest.schema_version !== SUPPORTED_PACK_SCHEMA_VERSION) {
    return { status: 'needs_replan', reason: 'schema_changed', replan };
  }
  const result = validateRestoration({
    packId: row.pack_id, schemaVersion, originPlaceId: row.origin_place_id,
    destinationPlaceId: row.destination_place_id, preference: row.preference,
    routeJson: row.route_json, currentStep,
  }, pack);
  if (result.status !== 'valid') return { ...result, replan };
  return {
    status: 'valid', itinerary: result.itinerary,
    trip: {
      packId: pack.manifest.pack_id, schemaVersion: pack.manifest.schema_version,
      originPlaceId: row.origin_place_id, destinationPlaceId: row.destination_place_id,
      preference: row.preference, selected: result.itinerary.ref, currentStep: result.currentStep,
    },
  };
}

function parseInput<T>(parsed: { success: true; data: T } | { success: false }): T {
  if (!parsed.success) throw new TripPersistenceError('invalid_input');
  return parsed.data;
}

function selectedRow(selection: RouteSelection, pack: Pack): CommonRow {
  const input = parseInput(selectionSchema.safeParse(selection));
  const row: CommonRow = {
    pack_id: parseInput(opaqueId.safeParse(pack.manifest.pack_id)),
    origin_place_id: input.originPlaceId, destination_place_id: input.destinationPlaceId,
    preference: input.preference, route_json: JSON.stringify(input.itinerary),
  };
  if (restoreRow(row, pack, pack.manifest.schema_version).status !== 'valid') {
    throw new TripPersistenceError('needs_replan');
  }
  return row;
}

const commonValues = (row: CommonRow) => [row.pack_id, row.origin_place_id, row.destination_place_id, row.preference, row.route_json];

async function newId(tx: SqlExecutor, prefix: string): Promise<string> {
  const row = await tx.getFirstAsync<{ id: string }>('SELECT lower(hex(randomblob(16))) AS id');
  if (!row || !/^[a-f0-9]{32}$/.test(row.id)) throw new TripPersistenceError('invalid_saved_data');
  return `${prefix}_${row.id}`;
}

export interface SavedEntry {
  savedId: string; label: string | null; createdAt: string; restoration: RestoreResult;
}
export interface HistoryEntry {
  historyId: string; kind: HistoryKind; at: string; restoration: RestoreResult;
}

/**
 * All writes commit before resolving. Supply one app-private user.sqlite
 * connection; do not pass the read-only corpus pack DB. No memory fallback.
 */
export async function createSqliteTripStore(db: UserDatabase, now: () => Date = () => new Date()) {
  await migrateUserDatabase(db);
  const date = () => parseInput(timestamp.safeParse(now().toISOString()));
  const write = <T>(task: (tx: SqlExecutor) => Promise<T>) => serialize(db, () => transaction(db, task));

  const restoreActive = async (tx: SqlExecutor, pack: Pack): Promise<RestoreResult> => {
    const raw = await tx.getFirstAsync<unknown>('SELECT * FROM ACTIVE_TRIP WHERE trip_id = 1');
    if (raw === null) return { status: 'empty' };
    const parsed = activeSchema.safeParse(raw);
    if (!parsed.success) return { status: 'needs_replan', reason: 'invalid_saved_data' };
    return restoreRow(parsed.data, pack, parsed.data.schema_version, parsed.data.current_step);
  };

  return {
    async startTrip(selection: RouteSelection, pack: Pack): Promise<RestoreResult> {
      const row = selectedRow(selection, pack);
      const startedAt = date();
      return write(async (tx) => {
        await tx.runAsync(`INSERT INTO ACTIVE_TRIP
          (trip_id, pack_id, schema_version, origin_place_id, destination_place_id, preference, route_json, current_step, started_at)
          VALUES (1, ?, ?, ?, ?, ?, ?, 0, ?)
          ON CONFLICT(trip_id) DO UPDATE SET pack_id=excluded.pack_id, schema_version=excluded.schema_version,
          origin_place_id=excluded.origin_place_id, destination_place_id=excluded.destination_place_id,
          preference=excluded.preference, route_json=excluded.route_json, current_step=0, started_at=excluded.started_at`,
          row.pack_id, pack.manifest.schema_version, row.origin_place_id, row.destination_place_id,
          row.preference, row.route_json, startedAt);
        return restoreRow(row, pack, pack.manifest.schema_version);
      });
    },

    restoreActiveTrip(pack: Pack): Promise<RestoreResult> {
      return serialize(db, () => restoreActive(db, pack));
    },

    advanceStep(pack: Pack): Promise<RestoreResult> {
      return write(async (tx) => {
        const restored = await restoreActive(tx, pack);
        if (restored.status !== 'valid') return restored;
        const next = Math.min(restored.trip.currentStep + 1, restored.itinerary.ref.steps.length - 1);
        await tx.runAsync('UPDATE ACTIVE_TRIP SET current_step = ?, pack_id = ? WHERE trip_id = 1', next, pack.manifest.pack_id);
        return { ...restored, trip: { ...restored.trip, currentStep: next } };
      });
    },

    /** New-trip/reset. The conversation/GPS owners separately clear memory. */
    clearActiveTrip(): Promise<void> {
      return write(async (tx) => { await tx.runAsync('DELETE FROM ACTIVE_TRIP'); });
    },

    /** Explicit end-trip: optionally record taken history and clear atomically. */
    endTrip(pack: Pack, recordTaken = false): Promise<RestoreResult> {
      const at = date();
      return write(async (tx) => {
        const restored = await restoreActive(tx, pack);
        if (recordTaken) {
          if (restored.status !== 'valid') return restored;
          const trip = restored.trip;
          await tx.runAsync(`INSERT INTO TRIP_HISTORY
            (history_id, pack_id, origin_place_id, destination_place_id, preference, route_json, kind, at)
            VALUES (?, ?, ?, ?, ?, ?, 'taken', ?)`,
            await newId(tx, 'hist'), trip.packId, trip.originPlaceId!, trip.destinationPlaceId!, trip.preference,
            JSON.stringify(restored.itinerary.ref), at);
        }
        await tx.runAsync('DELETE FROM ACTIVE_TRIP');
        return restored;
      });
    },

    async saveRoute(selection: RouteSelection, pack: Pack, explicitLabel: string | null = null): Promise<string> {
      const row = selectedRow(selection, pack);
      const label = parseInput(labelSchema.safeParse(explicitLabel));
      const createdAt = date();
      return write(async (tx) => {
        const id = await newId(tx, 'saved');
        await tx.runAsync(`INSERT INTO SAVED_ROUTE
          (saved_id, pack_id, origin_place_id, destination_place_id, preference, route_json, label, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, id, ...commonValues(row), label, createdAt);
        return id;
      });
    },

    listSavedRoutes(pack: Pack): Promise<SavedEntry[]> {
      return serialize(db, async () => {
        const rows = await db.getAllAsync<unknown>('SELECT * FROM SAVED_ROUTE ORDER BY created_at DESC, saved_id');
        return rows.map((raw) => {
          const parsed = savedSchema.safeParse(raw);
          if (!parsed.success) {
            const meta = savedSchema.pick({ saved_id: true, label: true, created_at: true }).strip().safeParse(raw);
            if (!meta.success) throw new TripPersistenceError('invalid_saved_data');
            return { savedId: meta.data.saved_id, label: meta.data.label, createdAt: meta.data.created_at,
              restoration: { status: 'needs_replan' as const, reason: 'invalid_saved_data' as const } };
          }
          const row = parsed.data;
          // v1 saved/history rows omit a schema column in the shared contract.
          return { savedId: row.saved_id, label: row.label, createdAt: row.created_at,
            restoration: restoreRow(row, pack, SUPPORTED_PACK_SCHEMA_VERSION) };
        });
      });
    },

    deleteSavedRoute(id: string): Promise<boolean> {
      const checked = parseInput(opaqueId.safeParse(id));
      return write(async (tx) => (await tx.runAsync('DELETE FROM SAVED_ROUTE WHERE saved_id = ?', checked)).changes > 0);
    },

    async recordHistory(selection: RouteSelection, pack: Pack, kind: HistoryKind = 'looked_up'): Promise<string> {
      const row = selectedRow(selection, pack);
      if (kind !== 'looked_up' && kind !== 'taken') throw new TripPersistenceError('invalid_input');
      const at = date();
      return write(async (tx) => {
        const id = await newId(tx, 'hist');
        await tx.runAsync(`INSERT INTO TRIP_HISTORY
          (history_id, pack_id, origin_place_id, destination_place_id, preference, route_json, kind, at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, id, ...commonValues(row), kind, at);
        return id;
      });
    },

    listHistory(pack: Pack): Promise<HistoryEntry[]> {
      return serialize(db, async () => {
        const rows = await db.getAllAsync<unknown>('SELECT * FROM TRIP_HISTORY ORDER BY at DESC, history_id');
        return rows.map((raw) => {
          const parsed = historySchema.safeParse(raw);
          if (!parsed.success) {
            const meta = historySchema.pick({ history_id: true, kind: true, at: true }).strip().safeParse(raw);
            if (!meta.success) throw new TripPersistenceError('invalid_saved_data');
            return { historyId: meta.data.history_id, kind: meta.data.kind, at: meta.data.at,
              restoration: { status: 'needs_replan' as const, reason: 'invalid_saved_data' as const } };
          }
          const row = parsed.data;
          return { historyId: row.history_id, kind: row.kind, at: row.at,
            restoration: restoreRow(row, pack, SUPPORTED_PACK_SCHEMA_VERSION) };
        });
      });
    },

    deleteHistoryRow(id: string): Promise<boolean> {
      const checked = parseInput(opaqueId.safeParse(id));
      return write(async (tx) => (await tx.runAsync('DELETE FROM TRIP_HISTORY WHERE history_id = ?', checked)).changes > 0);
    },

    clearHistory(): Promise<void> {
      return write(async (tx) => { await tx.runAsync('DELETE FROM TRIP_HISTORY'); });
    },
  };
}

export type SqliteTripStore = Awaited<ReturnType<typeof createSqliteTripStore>>;
