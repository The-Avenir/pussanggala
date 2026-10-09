/**
 * T43 — foreground GPS lifecycle stub (ugly-first, no real GPS read yet).
 *
 * Owner: Member-4 · Design: apps/mobile/spike-t43-t44-gps-persist.md §3.
 *
 * FOREGROUND ONLY. This module must never import or call:
 *   background location updates, TaskManager location tasks,
 *   geofencing, background-fetch, or any telemetry/crash-upload SDK.
 * Exactly one live subscription per active-trip session (INV-3).
 *
 * Fixes are in-memory only (Fix type below). Never written to user.sqlite,
 * logs, diagnostics, or analytics. Diagnostics keep counters/timings only.
 *
 * Suggestion rule (INV-6): a fix may SUGGEST a mapped nearby origin but
 * never auto-selects. Origin is set only via explicit confirmOrigin() call
 * from the confirmation sheet. Dismiss keeps manual input untouched.
 *
 * No expo-location read yet: real foreground wiring (requestForeground-
 * PermissionsAsync / watchPositionAsync Balanced, 2s/5m) lands with T40
 * pins + S3 device evidence. Until then every Fix flows through the
 * injected FixProvider (default stub) so logic is testable without hardware.
 */

// ---------------------------------------------------------------------------
// Thresholds (initial values from spike §3.3; confirm on reference phone S3)
// ---------------------------------------------------------------------------

/** Fix older than this never triggers a suggestion; marker renders stale. */
export const STALE_AFTER_MS = 30_000;
/** No fix within this window after start() → "Waiting for GPS" state. */
export const NO_FIX_TIMEOUT_MS = 15_000;
/** Candidate must be within this radius to be suggested. */
export const SUGGEST_RADIUS_M = 150;
/** Fresh / aging bounds for the fix-age label. */
export const FRESH_WITHIN_MS = 10_000;
export const AGING_WITHIN_MS = 30_000;
/** Accuracy bounds (metres). Null accuracy → coarse/unreliable. */
export const GOOD_ACCURACY_M = 10;
export const APPROX_ACCURACY_M = 50;

// ---------------------------------------------------------------------------
// In-memory fix types (NEVER persisted — see tripStore.ts for the ID-only
// persistence layer, which must not reference these fields).
// ---------------------------------------------------------------------------

/** Single foreground fix. Lives in module memory only. */
export interface Fix {
  readonly lat: number;
  readonly lng: number;
  readonly accuracyM: number | null;
  readonly atMs: number;
}

export interface WatchHandle {
  stop(): void;
}

export type AccuracyLabel = 'good' | 'approximate' | 'coarse';
export type FixAgeLabel = 'fresh' | 'aging' | 'stale' | 'no-fix';

/** Lifecycle states from spike §3.1 diagram. */
export type GpsState = 'Idle' | 'Requesting' | 'Watching' | 'Suggesting' | 'ManualOnly';

export type StartFailureReason = 'denied' | 'services-off' | 'no-fix' | 'error';

export type StartResult =
  | { readonly ok: true; readonly handle: WatchHandle; readonly reused: boolean }
  | { readonly ok: false; readonly reason: StartFailureReason; readonly message: string };

/**
 * A mapped-nearby-origin candidate. Supplied by Member-2 place resolution
 * (core.resolve); the location module only carries the shortlist + quality.
 * Unmapped / ambiguous / outside-NCR places must never reach this list.
 */
export interface MappedCandidate {
  readonly place_id: string;
  readonly displayName: string;
  readonly ncrAccepted: boolean;
  readonly mapped: boolean;
  readonly hasReadyAccess: boolean;
  readonly distanceM: number;
}

export interface SuggestionSheet {
  readonly candidates: readonly MappedCandidate[];
  readonly accuracyLabel: AccuracyLabel;
  readonly fixAgeMs: number;
}

/** Counters only — no coordinates (INV-3). */
export interface GpsDiagnostics {
  readonly fixesSeen: number;
  readonly staleCount: number;
  readonly deniedCount: number;
  readonly restarts: number;
  readonly watching: boolean;
}

// ---------------------------------------------------------------------------
// Provider seam (real expo-location wiring lands in S3; default is a stub)
// ---------------------------------------------------------------------------

export interface FixProvider {
  hasServicesEnabled(): Promise<boolean>;
  requestForegroundPermission(): Promise<'granted' | 'denied'>;
  getLastKnown(): Promise<Fix | null>;
  watch(onFix: (fix: Fix) => void): { remove(): void };
}

/** Default stub: services on, permission denied → forces ManualOnly path. */
export const stubDeniedProvider: FixProvider = {
  async hasServicesEnabled(): Promise<boolean> {
    return true;
  },
  async requestForegroundPermission(): Promise<'granted' | 'denied'> {
    return 'denied';
  },
  async getLastKnown(): Promise<Fix | null> {
    return null;
  },
  watch(): { remove(): void } {
    return { remove(): void {} };
  },
};

function accuracyLabelFor(fix: Fix): AccuracyLabel {
  if (fix.accuracyM == null || fix.accuracyM > APPROX_ACCURACY_M) return 'coarse';
  if (fix.accuracyM <= GOOD_ACCURACY_M) return 'good';
  return 'approximate';
}

function fixAgeLabelFor(fix: Fix | null, nowMs: number): FixAgeLabel {
  if (fix == null) return 'no-fix';
  const age = nowMs - fix.atMs;
  if (age > AGING_WITHIN_MS) return 'stale';
  if (age > FRESH_WITHIN_MS) return 'aging';
  return 'fresh';
}

function isSuggestableCandidate(c: MappedCandidate): boolean {
  return c.ncrAccepted && c.mapped && c.hasReadyAccess && c.distanceM <= SUGGEST_RADIUS_M;
}

export interface GpsController {
  readonly state: GpsState;
  start(): Promise<StartResult>;
  stop(): void;
  /** Feed a fix (from provider or tests). In-memory only. */
  onFix(fix: Fix): void;
  /** Evaluate candidates against the current fix; opens sheet or stays silent. */
  maybeSuggest(candidates: readonly MappedCandidate[], nowMs: number): SuggestionSheet | null;
  /**
   * Explicit user confirmation (INV-6). Only succeeds with a pending sheet
   * and a candidate id from that sheet. Never auto-selects.
   */
  confirmOrigin(place_id: string): { confirmed: boolean; origin_place_id: string | null };
  dismissSuggestion(): void;
  onAppBackground(): void;
  onEndTrip(): void;
  onNewTripReset(): void;
  pendingSheet(): SuggestionSheet | null;
  currentFix(): Fix | null;
  accuracyLabel(): AccuracyLabel | null;
  fixAgeLabel(nowMs: number): FixAgeLabel;
  fixAgeMs(nowMs: number): number | null;
  waitingForFix(nowMs: number, startedAtMs: number): boolean;
  diagnostics(): GpsDiagnostics;
}

/**
 * Create the single-owner GPS controller. One controller per app; start()
 * while already watching reuses the existing handle (no second subscription).
 */
export function createGps(provider: FixProvider = stubDeniedProvider): GpsController {
  let state: GpsState = 'Idle';
  let activeSub: { remove(): void } | null = null;
  let fix: Fix | null = null;
  let sheet: SuggestionSheet | null = null;
  let fixesSeen = 0;
  let staleCount = 0;
  let deniedCount = 0;
  let restarts = 0;

  function teardown(): void {
    if (activeSub != null) {
      try {
        activeSub.remove();
      } catch {
        // Idempotent cleanup: removal failure still clears the handle.
      }
      activeSub = null;
    }
    fix = null;
    sheet = null;
  }

  function toIdle(): void {
    teardown();
    state = 'Idle';
  }

  const controller: GpsController = {
    get state(): GpsState {
      return state;
    },

    async start(): Promise<StartResult> {
      // Single-subscription guard: reuse the live handle.
      if (activeSub != null && (state === 'Watching' || state === 'Suggesting')) {
        const handle: WatchHandle = { stop: () => controller.stop() };
        return { ok: true, handle, reused: true };
      }
      state = 'Requesting';
      let services = false;
      try {
        services = await provider.hasServicesEnabled();
      } catch {
        state = 'ManualOnly';
        return { ok: false, reason: 'error', message: 'Location check failed — enter origin manually.' };
      }
      if (!services) {
        state = 'ManualOnly';
        return { ok: false, reason: 'services-off', message: 'Location off — enter origin manually.' };
      }
      let permission: 'granted' | 'denied' = 'denied';
      try {
        permission = await provider.requestForegroundPermission();
      } catch {
        state = 'ManualOnly';
        return { ok: false, reason: 'error', message: 'Permission request failed — enter origin manually.' };
      }
      if (permission !== 'granted') {
        deniedCount += 1;
        state = 'ManualOnly';
        return { ok: false, reason: 'denied', message: 'Location off — enter origin manually.' };
      }
      // Instant (possibly stale) fix, then the single foreground watch.
      try {
        const last = await provider.getLastKnown();
        if (last != null) controller.onFix(last);
        activeSub = provider.watch((next: Fix) => controller.onFix(next));
      } catch {
        teardown();
        state = 'ManualOnly';
        return { ok: false, reason: 'error', message: 'Could not start location — enter origin manually.' };
      }
      restarts += 1;
      state = 'Watching';
      const handle: WatchHandle = { stop: () => controller.stop() };
      return { ok: true, handle, reused: false };
    },

    stop(): void {
      // Idempotent: safe from effect-cleanup, background, end-trip paths.
      if (activeSub == null && sheet == null && fix == null && state !== 'Suggesting') {
        if (state === 'Watching' || state === 'Requesting') state = 'Idle';
        return;
      }
      const wasActive = state === 'Watching' || state === 'Suggesting' || state === 'Requesting';
      teardown();
      if (wasActive || state !== 'ManualOnly') state = 'Idle';
    },

    onFix(next: Fix): void {
      if (activeSub == null) return; // No live subscription → ignore stray fixes.
      fixesSeen += 1;
      fix = next;
      if (state === 'Watching' || state === 'Suggesting') {
        const age = Date.now() - next.atMs;
        if (age > STALE_AFTER_MS) staleCount += 1;
      }
    },

    maybeSuggest(candidates: readonly MappedCandidate[], nowMs: number): SuggestionSheet | null {
      if (state !== 'Watching') return null; // One sheet at a time; silent otherwise.
      if (sheet != null) return null;
      if (fix == null) return null;
      const ageMs = nowMs - fix.atMs;
      if (ageMs > STALE_AFTER_MS) return null; // Stale fixes never suggest.
      if (accuracyLabelFor(fix) === 'coarse') return null;
      const eligible = candidates.filter(isSuggestableCandidate);
      if (eligible.length === 0) return null;
      sheet = {
        candidates: eligible,
        accuracyLabel: accuracyLabelFor(fix),
        fixAgeMs: ageMs,
      };
      state = 'Suggesting';
      return sheet;
    },

    confirmOrigin(place_id: string): { confirmed: boolean; origin_place_id: string | null } {
      // INV-6: no pending sheet → no confirmation; unknown id → no confirmation.
      if (state !== 'Suggesting' || sheet == null) return { confirmed: false, origin_place_id: null };
      const match = sheet.candidates.find((c) => c.place_id === place_id);
      if (match == null) return { confirmed: false, origin_place_id: null };
      sheet = null;
      state = 'Watching';
      // Caller writes origin_place_id into trip state + reruns core.resolve →
      // core.route (Member-2). GPS never writes it directly, never auto-picks.
      return { confirmed: true, origin_place_id: match.place_id };
    },

    dismissSuggestion(): void {
      if (state !== 'Suggesting') return;
      sheet = null;
      state = 'Watching'; // Manual origin kept untouched.
    },

    onAppBackground(): void {
      // Background/inactive → silent stop, sheet dismissed. Resume does NOT
      // auto-restart; user re-taps locate or continues manually.
      toIdle();
    },

    onEndTrip(): void {
      toIdle();
    },

    onNewTripReset(): void {
      toIdle();
    },

    pendingSheet(): SuggestionSheet | null {
      return sheet;
    },

    currentFix(): Fix | null {
      return fix;
    },

    accuracyLabel(): AccuracyLabel | null {
      if (fix == null) return null;
      return accuracyLabelFor(fix);
    },

    fixAgeLabel(nowMs: number): FixAgeLabel {
      return fixAgeLabelFor(fix, nowMs);
    },

    fixAgeMs(nowMs: number): number | null {
      if (fix == null) return null;
      return nowMs - fix.atMs;
    },

    waitingForFix(nowMs: number, startedAtMs: number): boolean {
      if (fix != null) return false;
      return nowMs - startedAtMs >= NO_FIX_TIMEOUT_MS;
    },

    diagnostics(): GpsDiagnostics {
      return {
        fixesSeen,
        staleCount,
        deniedCount,
        restarts,
        watching: activeSub != null,
      };
    },
  };

  return controller;
}

/** Human-readable one-liner for the fix badge (accuracy + age, no coords). */
export function describeFix(fix: Fix | null, nowMs: number): string {
  if (fix == null) return 'Waiting for GPS… keep manual input';
  const ageS = Math.max(0, Math.round((nowMs - fix.atMs) / 1000));
  const acc = accuracyLabelFor(fix);
  const age = fixAgeLabelFor(fix, nowMs);
  const accText = acc === 'good' ? 'good' : acc === 'approximate' ? 'approximate' : 'coarse';
  return `${accText} · ${ageS}s old · ${age}`;
}
