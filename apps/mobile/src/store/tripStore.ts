/**
 * T44 — saved / history / active-trip persistence stub (ugly-first).
 *
 * Owner: Member-4 · Design: apps/mobile/spike-t43-t44-gps-persist.md §4.
 *
 * ID-ONLY RULE (INV-3): this store keeps stable record IDs + preference +
 * manual step. It never stores raw chat, transcripts, query text, GPS fixes,
 * coordinate columns, traces, Firebase UIDs, or cloud-sync state. The
 * in-memory Fix type lives in src/location/gps.ts and must never be passed
 * into this module — there is no parameter for it by design.
 *
 * No sqlite wiring yet: an in-memory Map backs each table so restore /
 * revalidate / replan / delete logic is reviewable offline. The sqlite
 * loader path (T41) swaps the backing store in S7 without changing types.
 *
 * Restore revalidates against the installed pack and returns
 * ValidTrip | NeedsReplan — pack replacement never silently keeps obsolete
 * instructions (Member-2 T25 contract; Member-4 calls it from T41 loader).
 */

// ---------------------------------------------------------------------------
// ID-only row types
// ---------------------------------------------------------------------------

/** Routing preference carried verbatim (part of the persisted key). */
export type TripPreference = 'cheapest' | 'fastest' | 'least-walk' | 'fewest-transfers' | 'balanced';

/** Ordered record IDs only — exact field list settled with Member-2 (T00). */
export interface RouteIds {
  readonly leg_ids: readonly string[];
  readonly stop_ids: readonly string[];
  readonly place_ids: readonly string[];
  readonly note_ids: readonly string[];
}

/** ACTIVE_TRIP: exactly one row (trip_id = 1). Survives process death. */
export interface ActiveTripRow {
  readonly trip_id: 1;
  readonly pack_id: string;
  readonly schema_version: number;
  readonly origin_place_id: string;
  readonly destination_place_id: string;
  readonly preference: TripPreference;
  readonly route: RouteIds;
  readonly current_step: number;
  readonly started_at: string; // device-local ISO time
}

/** SAVED_ROUTE: explicit Save action only. Label is user-typed, never query. */
export interface SavedRouteRow {
  readonly saved_id: string;
  readonly pack_id: string;
  readonly origin_place_id: string;
  readonly destination_place_id: string;
  readonly preference: TripPreference;
  readonly route: RouteIds;
  readonly label: string;
  readonly created_at: string;
}

/** TRIP_HISTORY: append-only log with explicit per-row delete + clear-all. */
export type HistoryKind = 'looked_up' | 'taken';

export interface TripHistoryRow {
  readonly history_id: string;
  readonly pack_id: string;
  readonly origin_place_id: string;
  readonly destination_place_id: string;
  readonly preference: TripPreference;
  readonly route: RouteIds;
  readonly kind: HistoryKind;
  readonly at: string; // device-local ISO time
}

// ---------------------------------------------------------------------------
// Pack-compat revalidation surface (minimal Member-2 view, T25)
// ---------------------------------------------------------------------------

/** Schema versions this build understands; anything else → NeedsReplan. */
export const KNOWN_SCHEMA_VERSIONS: readonly number[] = [1];

export type ReplanReason =
  | 'unknown_schema'
  | 'pack_changed'
  | 'record_missing'
  | 'record_retired'
  | 'connection_broken'
  | 'step_out_of_bounds';

/** Minimal installed-pack view needed for restore checks (§4.3). */
export interface PackView {
  readonly pack_id: string;
  readonly schema_version: number;
  hasRecord(id: string): boolean;
  isLegReady(legId: string): boolean;
  isConnectionContinuous(route: RouteIds): boolean;
}

export type RestoreResult =
  | { readonly status: 'valid'; readonly trip: ActiveTripRow }
  | { readonly status: 'needs-replan'; readonly reason: ReplanReason; readonly detail: string };

export interface ReplanRequest {
  readonly origin_place_id: string;
  readonly destination_place_id: string;
  readonly preference: TripPreference;
}

export interface ReplanResult {
  readonly route: RouteIds;
  readonly pack_id: string;
}

// ---------------------------------------------------------------------------
// Store (in-memory stub; sqlite backing lands in S7)
// ---------------------------------------------------------------------------

function allRouteIds(route: RouteIds): readonly string[] {
  return [...route.leg_ids, ...route.stop_ids, ...route.place_ids, ...route.note_ids];
}

function nowIso(): string {
  return new Date().toISOString();
}

let nextId = 1;
function newId(prefix: string): string {
  nextId += 1;
  return `${prefix}-${Date.now().toString(36)}-${nextId}`;
}

export function revalidateRoute(
  row: Pick<ActiveTripRow, 'pack_id' | 'schema_version' | 'route' | 'current_step'>,
  pack: PackView,
): RestoreResult & { status: 'needs-replan'; reason: ReplanReason; detail: string } | { status: 'valid'; trip: ActiveTripRow } {
  if (!KNOWN_SCHEMA_VERSIONS.includes(row.schema_version)) {
    return {
      status: 'needs-replan',
      reason: 'unknown_schema',
      detail: `schema_version ${row.schema_version} unknown`,
    };
  }
  if (row.pack_id !== pack.pack_id) {
    return { status: 'needs-replan', reason: 'pack_changed', detail: `pack ${row.pack_id} != ${pack.pack_id}` };
  }
  for (const id of allRouteIds(row.route)) {
    if (!pack.hasRecord(id)) {
      return { status: 'needs-replan', reason: 'record_missing', detail: `record ${id} missing in pack` };
    }
  }
  for (const legId of row.route.leg_ids) {
    if (!pack.isLegReady(legId)) {
      return { status: 'needs-replan', reason: 'record_retired', detail: `leg ${legId} not ready` };
    }
  }
  if (!pack.isConnectionContinuous(row.route)) {
    return { status: 'needs-replan', reason: 'connection_broken', detail: 'connection order broken' };
  }
  const stepCount = row.route.leg_ids.length;
  if (row.current_step < 0 || row.current_step >= Math.max(1, stepCount)) {
    return {
      status: 'needs-replan',
      reason: 'step_out_of_bounds',
      detail: `step ${row.current_step} outside [0, ${stepCount})`,
    };
  }
  return { status: 'valid', trip: row as ActiveTripRow };
}

export interface TripStore {
  // ACTIVE_TRIP (≤1 row)
  upsertActiveTrip(input: Omit<ActiveTripRow, 'trip_id'>): ActiveTripRow;
  loadActiveTrip(): ActiveTripRow | null;
  advanceStep(): ActiveTripRow | null;
  clearActiveTrip(): void;
  // Restore + replan
  restore(pack: PackView): RestoreResult | { readonly status: 'empty' };
  replan(request: ReplanRequest, pack: PackView, route: RouteIds): ActiveTripRow;
  // SAVED_ROUTE (explicit save/delete only, PRD F15)
  saveRoute(input: Omit<SavedRouteRow, 'saved_id' | 'created_at'> & { label: string }): SavedRouteRow;
  listSavedRoutes(): readonly SavedRouteRow[];
  renameSavedRoute(saved_id: string, label: string): boolean;
  deleteSavedRoute(saved_id: string): boolean;
  // TRIP_HISTORY (explicit per-row delete + clear-all)
  appendHistory(input: Omit<TripHistoryRow, 'history_id' | 'at'>): TripHistoryRow;
  listHistory(): readonly TripHistoryRow[];
  deleteHistoryRow(history_id: string): boolean;
  clearHistory(): void;
}

/**
 * Create an isolated store instance. Screens create one via this factory;
 * tests create a fresh one per case. sqlite backing replaces the Maps only.
 */
export function createTripStore(): TripStore {
  let active: ActiveTripRow | null = null;
  const saved = new Map<string, SavedRouteRow>();
  const history = new Map<string, TripHistoryRow>();

  return {
    upsertActiveTrip(input: Omit<ActiveTripRow, 'trip_id'>): ActiveTripRow {
      active = { ...input, trip_id: 1 };
      return active;
    },

    loadActiveTrip(): ActiveTripRow | null {
      return active;
    },

    advanceStep(): ActiveTripRow | null {
      // Atomic step bump alongside the stored route IDs (single transaction
      // once sqlite lands; single assignment while in-memory).
      if (active == null) return null;
      active = { ...active, current_step: active.current_step + 1 };
      return active;
    },

    clearActiveTrip(): void {
      // End-trip / new-trip reset path. Caller appends history kind='taken'
      // before clearing when the trip was actually taken.
      active = null;
    },

    restore(pack: PackView): RestoreResult | { readonly status: 'empty' } {
      if (active == null) return { status: 'empty' };
      const checked = revalidateRoute(active, pack);
      if (checked.status === 'valid') return { status: 'valid', trip: active };
      return { status: 'needs-replan', reason: checked.reason, detail: checked.detail };
    },

    replan(request: ReplanRequest, pack: PackView, route: RouteIds): ActiveTripRow {
      // Keeps manual endpoints, reruns core.route (Member-2) — here the new
      // ID set is supplied by the caller (stub seam). Old instructions are
      // dropped: the ACTIVE_TRIP row is overwritten, never merged.
      active = {
        trip_id: 1,
        pack_id: pack.pack_id,
        schema_version: pack.schema_version,
        origin_place_id: request.origin_place_id,
        destination_place_id: request.destination_place_id,
        preference: request.preference,
        route,
        current_step: 0,
        started_at: nowIso(),
      };
      return active;
    },

    saveRoute(input: Omit<SavedRouteRow, 'saved_id' | 'created_at'> & { label: string }): SavedRouteRow {
      // Explicit Save only — no auto-save of lookups. Label is user-authored.
      const row: SavedRouteRow = {
        ...input,
        saved_id: newId('saved'),
        created_at: nowIso(),
      };
      saved.set(row.saved_id, row);
      return row;
    },

    listSavedRoutes(): readonly SavedRouteRow[] {
      return [...saved.values()];
    },

    renameSavedRoute(saved_id: string, label: string): boolean {
      const row = saved.get(saved_id);
      if (row === undefined) return false;
      saved.set(saved_id, { ...row, label });
      return true;
    },

    deleteSavedRoute(saved_id: string): boolean {
      return saved.delete(saved_id);
    },

    appendHistory(input: Omit<TripHistoryRow, 'history_id' | 'at'>): TripHistoryRow {
      const row: TripHistoryRow = { ...input, history_id: newId('hist'), at: nowIso() };
      history.set(row.history_id, row);
      return row;
    },

    listHistory(): readonly TripHistoryRow[] {
      return [...history.values()];
    },

    deleteHistoryRow(history_id: string): boolean {
      return history.delete(history_id);
    },

    clearHistory(): void {
      history.clear();
    },
  };
}
