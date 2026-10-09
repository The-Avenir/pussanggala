---
document_type: CONTRACTS
project: Pusang Gala
slug: pusang-gala
doc_version: 1.0
status: Draft — awaiting T00 review
owner: Franz (Member 2)
created: 2026-10-09
updated: 2026-10-09
---

# Pusang Gala — Shared contracts v1 (T00)

**Implements:** [SDD](sdd-pusang-gala.md) §3–§4 · **Tasks:** [TODO](TODO.md) T00, T20–T26 · **Code:** `packages/core/src/`

This is the single reviewed source for cross-member interfaces. Field names in pack/user entities are snake_case and match SQLite columns; TypeScript API objects are camelCase. Any change to a section requires review by its owner(s) listed below.

## 0. Team and open assignments

| Member | Name | Area |
|--------|------|------|
| Member 1 | Justin | Corpus, evidence, pack builder (`tools/corpus/`, `tools/pack-builder/`, `data/seed/`) |
| Member 2 | Franz | Core contracts, resolution, routing, cards, RAG evidence (`packages/core/`) |
| Member 3 | CJ | Local AI, conversation, stream guard (`apps/mobile/src/ai/`, `apps/mobile/src/conversation/`) |
| Member 4 | Vincent | Expo app, assets/DB adapters, map, GPS, persistence, release (`apps/mobile/`, `tools/map-pack/`) |

Open (T00 not complete until filled): designated corpus reviewer — **TBD**; reference phone (exact model/ABI/Android/RAM) — **TBD**; fallback test phone — **TBD**.

## 1. Section ownership

| § | Contract | Owner | Required reviewers |
|---|----------|-------|--------------------|
| 2 | Stable IDs | Member 2 | Member 1, Member 4 |
| 3 | Pack tables and loader input | Member 1 (data), Member 2 (validation) | Member 4 |
| 4 | User/session persistence | Member 4 | Member 2 |
| 5 | Results and failure reasons | Member 2 | Member 3, Member 4 |
| 6 | Intent and trip state | Member 3 (intent), Member 2 (trip state) | all |
| 7 | Routing, itineraries, comparisons | Member 2 | Member 1 |
| 8 | Cards and evidence bundle | Member 2 | Member 3 |
| 9 | Explanation unit | Member 3 | Member 2 |
| 10 | Core API | Member 2 | all |

## 2. Stable IDs

- Format: `<prefix>_<slug>` matching `^[a-z]{2,3}_[a-z0-9][a-z0-9_-]{0,63}$`.
- Prefixes: `rg` region, `pl` place, `st` stop, `ac` place-stop access, `rt` route, `lg` leg, `wk` walk link, `fr` fare report, `hr` hours report, `sh` shape, `nt` note, `src` source.
- IDs are assigned by the pack builder (Member 1), are never reused for a different fact, and survive pack rebuilds when the underlying fact is unchanged. A changed fact (different endpoints, route or direction) gets a new ID; the old ID disappears, which forces replanning on restore.
- Integer PKs (`alias_id`, `ambiguity_id`, `link_id`) are pack-local and must not be persisted by the app.
- Itinerary ID (derived, not stored in the pack): `it_` + step IDs joined by `.` in order, e.g. `it_ac_x.lg_a.wk_b.lg_c.ac_y`. Card ID: `<itineraryId>#<stepIndex>`.

## 3. Pack tables (schema_version 1)

Columns are exactly SDD §3.2. Loader input is one object of raw rows (`SELECT *` per table) produced by Member 4's SQLite adapter:

```ts
interface RawPackTables {
  manifest: unknown;            // the single PACK_MANIFEST row
  regions: unknown[]; places: unknown[]; place_aliases: unknown[]; place_ambiguities: unknown[];
  stops: unknown[]; place_stops: unknown[]; routes: unknown[]; legs: unknown[]; walk_links: unknown[];
  fare_reports: unknown[]; hours_reports: unknown[]; shapes: unknown[]; notes: unknown[];
  note_links: unknown[]; sources: unknown[]; record_sources: unknown[];
}
```

Clarifications to SDD §3.2 for v1:

- Dates are ISO-8601 strings (`YYYY-MM-DD` or full timestamp). `starts_local`/`ends_local` are `HH:MM` 24-hour.
- `currency` is `PHP` in v1. `amount_min <= amount_max`, both ≥ 0.
- `RECORD_SOURCE.record_kind` ∈ `region|place|stop|place_stop|route|leg|walk_link|fare_report|hours_report|shape|note`.
- Every row of those kinds needs at least one RECORD_SOURCE, except `excluded` legs/walks/accesses (kept only so restore can detect them).
- `PLACE_ALIAS.alias_norm` must equal `normalize(alias_display)` (§10). An alias_norm present in PLACE_AMBIGUITY must not also be in PLACE_ALIAS.
- `PLACE_STOP.direction`: `to_stop` = walk from place to the stop (trip start); `from_stop` = stop to place (trip end); `both`.

Loader checks (T20) reject the pack with a list of typed issues: unsupported `schema_version`; row shape/enum violations; duplicate IDs; dangling foreign keys; unpaired coordinates (`lat`/`lng` both null or both set); negative durations/distances; `amount_min > amount_max`; shape or note-link not having exactly one owner; `source_path` shape lacking a geometry/licensed source; ambiguity alias with fewer than two candidate places; ambiguous alias also in PLACE_ALIAS; missing provenance; manifest dispositions (`included + filtered + pending + rejected`) ≠ `answered_posts`. Excluded rows load (for restore checks) but never enter the graph.

## 4. User/session persistence (owned by Member 4)

SDD §3.3 columns apply. `route_json` holds a serialized `ItineraryRef` only:

```ts
type StepRef = { kind: 'access' | 'leg' | 'walk'; id: string };
interface ItineraryRef { v: 1; steps: StepRef[] }
```

No raw query/chat text, GPS coordinates or transcript columns. User DB migrations are forward-only numbered transactions.

## 5. Results and failure reasons

```ts
type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };
type Known<T> = { known: true; value: T } | { known: false };
```

`FailureReason` (PRD-F9) — each has a distinct message and recovery in the app:

| Code | Raised by | Meaning |
|------|-----------|---------|
| `outside_ncr` | resolve | Place exists but is outside NCR |
| `ambiguous_place` | resolve | Clarification required (INV-6) |
| `unsupported_place` | resolve | No supported place matches; user picks a supported landmark |
| `no_trip_context` | resolve/parse | Follow-up refers to a trip that does not exist |
| `same_place` | route | Origin equals destination |
| `no_origin_access` / `no_destination_access` | route | No ready source-backed place-to-stop access |
| `no_route` | route | No complete eligible itinerary |
| `pack_invalid` / `schema_incompatible` | loader | Pack failed validation / unsupported version |
| `needs_replan` | restore | Saved route no longer valid |
| `asset_missing`, `inference_failed`, `location_unavailable` | app (Members 3/4) | Reserved codes for app layers |

Unknown fares/times/hours are not failures; they are `Known<…>` / warnings.

## 6. Intent and trip state

```ts
type Preference = 'balanced' | 'lowest_fare' | 'fewest_transfers' | 'shortest_reported_time';
type IntentKind = 'new_trip' | 'change_origin' | 'change_destination' | 'change_preference'
  | 'alternatives' | 'reverse' | 'ask_boarding' | 'ask_fare' | 'ask_transfer' | 'ask_hours'
  | 'clarify_answer' | 'unrelated';
type PlaceMention =
  | { kind: 'text'; text: string; span: [start: number, end: number] } // must index the user query
  | { kind: 'trip_ref'; ref: 'origin' | 'destination' }
  | { kind: 'place_id'; placeId: string };                             // manual pick / confirmed GPS
interface Intent {
  kind: IntentKind; origin?: PlaceMention; destination?: PlaceMention;
  preference?: Preference; choiceIndex?: number;  // answer to a clarification list (0-based)
  source: 'rules' | 'model';
}
interface Clarification { slot: 'origin' | 'destination'; text: string; candidates: PlaceCandidate[] }
interface TripState {
  packId: string; schemaVersion: number;
  originPlaceId?: string; destinationPlaceId?: string; preference: Preference;
  selected?: ItineraryRef; currentStep: number; pendingClarification?: Clarification;
}
```

Model-produced intents (Member 3) use the same shape; `text` mentions must carry a span that matches the query substring, and the model never supplies place IDs, fares or legs. The bounded exchange window lives in Member 3's conversation manager, not in `TripState`.

## 7. Routing, itineraries and comparisons

Rules (SDD §1.3):

- Graph nodes are stops. Edges: ready LEG (board→alight, route `service_status` ∈ `reported_active|unknown`), ready WALK_LINK (from→to). Place access: ready PLACE_STOP with `to_stop|both` at origin, `from_stop|both` at destination. Endpoint places need `ncr_status = accepted`.
- A transfer between legs at the **same `stop_id`** is supported (the canonical stop is the evidence). Different stops require a WALK_LINK. Coordinates, names and keywords never create edges.
- Two consecutive legs on the same `route_id` are rejected (no silent stitching or double boarding). Consecutive walk links are rejected. An itinerary has ≥ 1 leg, no repeated stop, and ≤ 4 legs.
- Search returns up to 5 complete itineraries (Pareto-filtered on known fare, ride count, known time), ordered by preference; options with an unknown value for the preferred criterion sort after options with known values and stay visible.

```ts
type FareTotal =
  | { status: 'known'; min: number; max: number; currency: 'PHP'; conflict: boolean; fareIds: string[] }
  | { status: 'unknown'; missingLegIds: string[] };
interface Itinerary {
  id: string; ref: ItineraryRef; originPlaceId: string; destinationPlaceId: string;
  rideCount: number; transferCount: number;
  fare: FareTotal; reportedRideMinutes: Known<number>; walkMeters: Known<number>;
  routeIds: string[]; recordIds: string[];   // every pack ID used (for grounding)
}
type ComparisonKind = 'lowest_reported_fare' | 'fewest_rides' | 'shortest_reported_time';
interface ComparisonStatement {
  kind: ComparisonKind; winnerId: string; comparedIds: string[]; excludedUnknownIds: string[];
  text: string;  // rule-generated, e.g. "Lowest reported fare among 2 options with fare information."
}
type RouteResult =
  | { status: 'ok'; itineraries: Itinerary[]; comparisons: ComparisonStatement[] }
  | { status: 'no_route'; reason: 'same_place' | 'no_origin_access' | 'no_destination_access' | 'no_route' };
```

Fare totals: if every leg has ≥ 1 fare report, `min = Σ min(amount_min)`, `max = Σ max(amount_max)`, `conflict` true when any leg has differing reports; otherwise `unknown`. Never zero-fill. Time total is known only if every leg's `ride_min` and every walk's `walk_min` are known. Comparisons are emitted only when ≥ 2 itineraries have the value known and the winner is strictly better than the rest; ties produce no claim.

## 8. Cards and evidence bundle

```ts
interface PointView { placeId?: string; stopId?: string; name: string; landmarkHint?: string; mapped: boolean }
interface SourceRef { sourceId: string; kind: string; url?: string; postedAt?: string; ageDays?: number; stale: boolean }
interface FareView { fareId: string; min: number; max: number; currency: 'PHP'; effectiveAt?: string; sources: SourceRef[] }
interface HoursView { hoursId: string; text: string; startsLocal?: string; endsLocal?: string; daysText?: string; sources: SourceRef[] }
interface NoteView { noteId: string; kind: 'tip' | 'warning' | 'conflict'; body: string; sources: SourceRef[] }
type WarningCode = 'fare_unknown' | 'fare_conflict' | 'time_unknown' | 'hours_unknown' | 'hours_conflict'
  | 'stale_source' | 'source_date_unknown' | 'service_status_unknown' | 'unmapped_point' | 'schematic_only';
interface Warning { code: WarningCode; message: string; recordIds: string[] }
type Card =
  | { cardId: string; kind: 'access'; direction: 'start' | 'end'; place: PointView; stop: PointView;
      walkText: string; walkMeters: Known<number>; walkMinutes: Known<number>; recordIds: string[];
      warnings: Warning[]; sources: SourceRef[] }
  | { cardId: string; kind: 'ride'; routeId: string; mode: string; signboard?: string; directionLabel: string;
      board: PointView; alight: PointView; rideMinutes: Known<number>; fares: FareView[]; hours: HoursView[];
      notes: NoteView[]; recordIds: string[]; warnings: Warning[]; sources: SourceRef[] }
  | { cardId: string; kind: 'walk'; from: PointView; to: PointView; walkText: string;
      walkMeters: Known<number>; walkMinutes: Known<number>; notes: NoteView[]; recordIds: string[];
      warnings: Warning[]; sources: SourceRef[] };
```

- `stale` = `postedAt` older than `manifest.stale_after_days` relative to an injected `now`. A missing `postedAt` yields `source_date_unknown`. Labels say "source post date", never "verified".
- `mapped` is true only when the place has coordinates and `mapping_status = mapped`.

```ts
interface HourStatement { routeId: string; status: 'reported' | 'unknown'; reports: HoursView[]; conflict: boolean; text: string }
interface EvidenceBundle {
  v: 1; packId: string; trip: TripState;
  cards: Card[];                      // selected (or first) itinerary, in order
  alternatives: Array<Pick<Itinerary, 'id' | 'rideCount' | 'transferCount' | 'fare' | 'reportedRideMinutes'>>;
  comparisons: ComparisonStatement[]; hourStatements: HourStatement[]; notes: NoteView[];
  allowedCardIds: string[]; allowedRecordIds: string[];
}
```

Bounds: ≤ 12 cards, ≤ 3 alternatives, ≤ 8 notes (cards' own notes first, then by note kind `warning > conflict > tip`, then ID), deterministic truncation. No raw comment text exists in the pack, so none can enter the bundle.

## 9. Explanation unit (owned by Member 3)

```ts
interface ExplanationUnit {
  kind: 'summary' | 'step' | 'comparison' | 'hours' | 'caveat' | 'clarify' | 'redirect';
  cardRef?: string;   // must be in allowedCardIds
  text: string;       // ≤ 280 chars; may not author boarding/alighting/transfer instructions
}
```

Exact GBNF/JSON grammar and output cap are settled by Member 3 in T30; this shape is the core-side validation target.

## 10. Core API (`@pusang-gala/core`)

| Function | Task | Signature (summary) |
|----------|------|---------------------|
| `normalize` | T20 | `(text) => string` — lowercase, strip diacritics (ñ→n), punctuation→space, collapse spaces, expand `sta→santa`, `sto→santo`, `brgy→barangay`, `ave→avenue` |
| `loadPack` | T20 | `(raw: RawPackTables) => Result<Pack, PackIssue[]>` |
| `parse` | T21 | `(query, trip?) => Intent` rule baseline |
| `resolve` | T21 | `(mention: PlaceMention, pack, trip?) => ResolveResult` |
| `route` | T22/T23 | `(originPlaceId, destinationPlaceId, preference, pack) => RouteResult` |
| `compose` | T24 | `(itinerary, pack, now) => Card[]` |
| `answerHours` | T25 | `(routeIds, pack, now) => HourStatement[]` |
| `buildContext` | T24 | `(input: { trip, cards, itineraries, comparisons, hourStatements, now }, pack) => EvidenceBundle` |
| `applyIntent` | T25 | `(trip, intent, resolved) => TripState` — reverse swaps endpoints and clears selection (rerouted, never reversed instructions); endpoint/preference change clears selection; `new_trip` resets |
| `validateRestoration` | T25 | `(saved, pack) => { status: 'valid'; itinerary; currentStep } \| { status: 'needs_replan'; reason }` |

```ts
type ResolveResult =
  | { status: 'resolved'; placeId: string; match: 'exact' | 'fuzzy' | 'trip_ref' | 'id' }
  | { status: 'needs_clarification'; candidates: PlaceCandidate[] }   // 2–4
  | { status: 'unsupported'; reason: 'unsupported_place' | 'no_trip_context' | 'ncr_unresolved'; suggestions: PlaceCandidate[] }
  | { status: 'outside_ncr'; placeId: string; name: string };
interface PlaceCandidate { placeId: string; name: string; area: string; kind: string }
type ReplanReason = 'schema_changed' | 'invalid_route_json' | 'record_missing' | 'record_ineligible'
  | 'service_suspended' | 'continuity_broken' | 'endpoint_mismatch' | 'step_out_of_bounds';
```

Resolution: exact alias → resolved (`outside` → `outside_ncr`; `ambiguous` NCR status → `unsupported/ncr_unresolved`); alias in PLACE_AMBIGUITY → clarification; otherwise fuzzy Damerau–Levenshtein against aliases (≤ 1 edit for length 5–8, ≤ 2 for ≥ 9; no fuzzy below 5) — exactly one candidate place resolves as `fuzzy`, several clarify (top 4), none is `unsupported_place` with up to 3 suggestions.
