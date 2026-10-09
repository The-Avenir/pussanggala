# T44 persistence and integration port

`sqliteTripStore.ts` implements SDD §3.3 and contracts §4 using an injected,
app-private **user.sqlite** connection. It has no memory fallback or network
adapter. The existing `tripStore.ts` is a deprecated synthetic T45 demo seam;
it is not production persistence and its old ID arrays must not be migrated
into real routes. T45 owns replacing that screen integration.

## Opening the store (T40/T41/T45)

The app manifest/lockfile remain with their task owner. After that owner pins
and installs the SDK-compatible `expo-sqlite`, the documented native API fits
`UserDatabase` structurally:

```ts
import * as SQLite from 'expo-sqlite';
import { createSqliteTripStore } from './src/store/sqliteTripStore';

const db = await SQLite.openDatabaseAsync('user.sqlite');
const trips = await createSqliteTripStore(db);
```

Only use the writable user DB here; the corpus pack stays separate/read-only.
All write queries use bound parameters. Exclusive transaction queries run on
the supplied transaction connection; a per-connection queue serializes local
operations. The app should share one connection/store and preserve its lifetime.
No async API promises Android durability measurements: those remain device gates.

The [Expo SDK 57 SQLite API](https://docs.expo.dev/versions/v57.0.0/sdk/sqlite/)
documents these methods and callback transaction connection. No native package
compatibility or successful build is claimed by this task.

## Selecting, saving, restoring and replanning

Build a `RouteSelection` explicitly from a core-validated selection:

```ts
const selected = {
  originPlaceId: trip.originPlaceId!,
  destinationPlaceId: trip.destinationPlaceId!,
  preference: trip.preference,
  itinerary: trip.selected!,
};
await trips.recordHistory(selected, pack, 'looked_up'); // completed lookup only
await trips.saveRoute(selected, pack, explicitUserLabel); // explicit Save only
await trips.startTrip(selected, pack);
const restored = await trips.restoreActiveTrip(pack);
```

Never pass the whole `TripState`, conversation window, raw query, cards, fix or
model output. Strict input and nested-step schemas reject extra fields. The only
free-text exception is a separately authored route label (optional, ≤80 chars).
Do not prefill it from a query or chat. `route_json` is exactly `{v:1, steps}`.
Dates are actual injected device-clock ISO timestamps, not verification dates.

Every read/open/advance revalidates against the **currently installed** validated
`Pack` using core `validateRestoration`. A different pack ID alone does not reject
unchanged stable records. Missing/excluded/suspended/retired/disconnected records,
changed access direction/endpoints, incompatible schema and invalid step bounds
withhold the itinerary. Valid restores reconstruct current facts and return only
structured trip state; recompose cards/evidence through core and clear the chat
window through the conversation owner. Unknown/conflicting facts remain core values.

`needs_replan` includes a reason and, when stored rows validate, `replan` with
endpoint IDs and preference. T45 resolves those IDs and reruns directed core
routing; it must not reuse/reverse the old steps. Commit a successful new selection
with `startTrip`, which replaces all route IDs and resets the manual step to zero.
The store never invents a route or tries cloud recovery.

Saved/history rows have no schema-version column in the v1 shared contract. They
are interpreted as pack schema 1, and a later unsupported schema returns
`schema_changed`. Do not guess a schema or silently downgrade a newer user DB.
User migrations are numbered forward-only transactions, tracked with SQLite
`PRAGMA user_version`; failed migrations preserve both the old schema and version.
This task owns creation of the five SDD user tables. T41 must use the same migration
entry point, rather than independently creating different `INSTALLED_ASSET` tables.

## Controls and lifecycle handoff (T45)

Mount `TripPersistenceControls` inside the journey screen's scrolling container
with `store`, installed `pack`, optional current `selection`, and:

- `onResume`: adopt the returned structured trip, recompose cards/evidence from
  the installed pack, and clear the previous in-memory conversation.
- `onNeedsReplan`: show the reason; resolve `result.replan` endpoint IDs when
  present and rerun core routing, otherwise request fresh manual endpoints.
- `onTripCleared`: clear structured/conversation state and stop T43 GPS.

The controls expose explicit save/start/resume, bounded manual advance, end-trip
with `taken` history, active-trip clear, individual saved/history deletion,
and confirmed clear-all history. They show distinct replan reasons and device
timestamps. No raw chat/GPS state is restored. GPS restart belongs to T43's
foreground rules. T45 must disable interactions while replacing the pack and
remount the controls keyed by its pack ID/version; never supply a mutated pack.
Automatic startup restoration and complete app wiring remain with T45.

`endTrip(pack, true)` writes `taken` history and deletes the active row atomically.
An invalid active trip cannot become `taken` history. `clearActiveTrip()` remains
available to explicitly discard it. History/saved deletions leave pack/assets and
settings untouched. Broken route JSON with valid metadata stays visible as
`needs_replan/invalid_saved_data` and can be deleted; invalid metadata raises a
sanitized `TripPersistenceError` rather than exposing arbitrary persisted text.

## Host checks

Install root and app-local lockfile dependencies, then run from the repo root:

```sh
node apps/mobile/src/store/check.mjs
```

This typechecks the implementation, React Native controls and tests, then runs
file-backed/in-memory **real SQLite** tests through the existing root Vitest.
Tests use host `node:sqlite` (Node ≥22.13); it is test-only and never imported by
the mobile runtime. No dependency manifests, other workers' code or root CI are
changed. T01/T45 should register this command in shared CI when integrating.

Task results and unresolved Android/data gates are recorded in
[docs/evidence/t44-trip-persistence.md](../../../../docs/evidence/t44-trip-persistence.md).
