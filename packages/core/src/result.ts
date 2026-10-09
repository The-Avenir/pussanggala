export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

export type Known<T> = { known: true; value: T } | { known: false };

export function known<T>(value: T): Known<T> {
  return { known: true, value };
}

export function unknown<T = never>(): Known<T> {
  return { known: false };
}

export const FAILURE_REASONS = [
  "outside_ncr",
  "ambiguous_place",
  "unsupported_place",
  "no_trip_context",
  "same_place",
  "no_origin_access",
  "no_destination_access",
  "no_route",
  "pack_invalid",
  "schema_incompatible",
  "needs_replan",
  "asset_missing",
  "inference_failed",
  "location_unavailable",
] as const;

export type FailureReason = (typeof FAILURE_REASONS)[number];
