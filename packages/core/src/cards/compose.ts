import type { Card, FareView, HoursView, PointView, Warning, WarningCode } from "../contracts/cards";
import type { Itinerary } from "../contracts/routing";
import { cardId } from "../ids";
import { recordKey, type Pack } from "../pack/types";
import { known, unknown } from "../result";
import { noteView, sourceRefs, type RecordRef } from "./sources";

function placePoint(pack: Pack, placeId: string): PointView {
  const place = pack.places.get(placeId)!;
  return { placeId, name: place.name, mapped: place.lat !== null && place.lng !== null && place.mapping_status === "mapped" };
}

function stopPoint(pack: Pack, stopId: string): PointView {
  const stop = pack.stops.get(stopId)!;
  const point: PointView = { stopId, placeId: stop.place_id, name: stop.name, mapped: placePoint(pack, stop.place_id).mapped };
  if (stop.landmark_hint) point.landmarkHint = stop.landmark_hint;
  return point;
}

function orderedNoteIds(groups: readonly (readonly string[])[]): string[] {
  return [...new Set(groups.flatMap((ids) => [...ids].sort()))];
}

function cardWarnings(card: Card, records: RecordRef[], pack: Pack, stepId: string): Warning[] {
  const warnings: Warning[] = [];
  const add = (code: WarningCode, message: string, ids: string[]) => {
    warnings.push({ code, message, recordIds: [...new Set(ids)].sort() });
  };
  if (card.kind === "ride") {
    if (!card.fares.length) add("fare_unknown", "No fare reported for this ride.", [stepId]);
    if (new Set(card.fares.map((fare) => `${fare.min}:${fare.max}`)).size > 1) {
      add("fare_conflict", "Fare reports differ; each report is shown with its source date.", card.fares.map((fare) => fare.fareId));
    }
  }
  const time = card.kind === "ride" ? card.rideMinutes : card.walkMinutes;
  if (!time.known) add("time_unknown", "Travel time not reported.", [stepId]);
  if (card.kind === "ride" && pack.routes.get(card.routeId)!.service_status === "unknown") {
    add("service_status_unknown", "Service status not reported in recent sources.", [card.routeId]);
  }
  const points = card.kind === "access" ? [card.place, card.stop] : card.kind === "ride" ? [card.board, card.alight] : [card.from, card.to];
  const unmapped = points.filter((point) => !point.mapped).map((point) => point.stopId ?? point.placeId!);
  if (unmapped.length) add("unmapped_point", "Location not mapped; shown in the schematic only.", unmapped);
  if (card.kind !== "access") {
    const hasPath = [...pack.shapes.values()].some((shape) => shape.geometry_kind === "source_path" && (card.kind === "ride" ? shape.leg_id === stepId : shape.walk_id === stepId));
    if (!hasPath) add("schematic_only", "Map connector is schematic, not the actual vehicle path.", [stepId]);
  }
  const sourceRecords = (ids: Set<string>) => records.filter((record) =>
    (pack.sourcesByRecord.get(recordKey(record.kind, record.id)) ?? []).some((link) => ids.has(link.source_id)),
  ).map((record) => record.id);
  const stale = card.sources.filter((source) => source.stale).sort((a, b) => Date.parse(a.postedAt!) - Date.parse(b.postedAt!) || (a.sourceId < b.sourceId ? -1 : a.sourceId > b.sourceId ? 1 : 0));
  if (stale.length) {
    add("stale_source", `Source post is older than ${pack.manifest.stale_after_days} days (source post date ${stale[0]!.postedAt!.slice(0, 10)}).`, sourceRecords(new Set(stale.map((source) => source.sourceId))));
  }
  const undated = card.sources.filter((source) => source.postedAt === undefined);
  if (undated.length) add("source_date_unknown", "Source post date unknown.", sourceRecords(new Set(undated.map((source) => source.sourceId))));
  return warnings;
}

export function compose(itinerary: Itinerary, pack: Pack, now: Date): Card[] {
  return itinerary.ref.steps.map((step, index) => {
    const base = { cardId: cardId(itinerary.id, index), recordIds: [] as string[], sources: [], warnings: [] };
    const records: RecordRef[] = [];
    let card: Card;
    if (step.kind === "access") {
      const access = pack.placeStops.get(step.id)!;
      records.push({ kind: "place_stop", id: step.id }, { kind: "place", id: access.place_id }, { kind: "stop", id: access.stop_id });
      card = {
        ...base, kind: "access", direction: index === 0 ? "start" : "end", place: placePoint(pack, access.place_id), stop: stopPoint(pack, access.stop_id),
        walkText: access.walk_text, walkMeters: access.walk_m === null ? unknown() : known(access.walk_m), walkMinutes: access.walk_min === null ? unknown() : known(access.walk_min),
      };
    } else if (step.kind === "leg") {
      const leg = pack.legs.get(step.id)!;
      const route = pack.routes.get(leg.route_id)!;
      const fares: FareView[] = (pack.faresByLeg.get(step.id) ?? []).map((fare) => {
        records.push({ kind: "fare_report", id: fare.fare_id });
        const view: FareView = { fareId: fare.fare_id, min: fare.amount_min, max: fare.amount_max, currency: fare.currency, sources: sourceRefs(pack, [{ kind: "fare_report", id: fare.fare_id }], now) };
        if (fare.effective_at !== null) view.effectiveAt = fare.effective_at;
        return view;
      });
      const hours: HoursView[] = (pack.hoursByRoute.get(route.route_id) ?? []).map((report) => {
        records.push({ kind: "hours_report", id: report.hours_id });
        const view: HoursView = { hoursId: report.hours_id, text: report.hours_text, sources: sourceRefs(pack, [{ kind: "hours_report", id: report.hours_id }], now) };
        if (report.starts_local !== null) view.startsLocal = report.starts_local;
        if (report.ends_local !== null) view.endsLocal = report.ends_local;
        if (report.days_text !== null) view.daysText = report.days_text;
        return view;
      });
      const noteIds = orderedNoteIds([pack.noteIdsByLeg.get(step.id) ?? [], pack.noteIdsByStop.get(leg.board_stop_id) ?? [], pack.noteIdsByStop.get(leg.alight_stop_id) ?? []]);
      records.push({ kind: "leg", id: step.id }, { kind: "route", id: route.route_id }, { kind: "stop", id: leg.board_stop_id }, { kind: "stop", id: leg.alight_stop_id }, ...noteIds.map((id): RecordRef => ({ kind: "note", id })));
      card = {
        ...base, kind: "ride", routeId: route.route_id, mode: route.mode, directionLabel: route.direction_label,
        board: stopPoint(pack, leg.board_stop_id), alight: stopPoint(pack, leg.alight_stop_id), rideMinutes: leg.ride_min === null ? unknown() : known(leg.ride_min), fares, hours,
        notes: noteIds.map((id) => noteView(pack, id, now)),
      };
      if (route.signboard !== null) card.signboard = route.signboard;
    } else {
      const walk = pack.walks.get(step.id)!;
      const noteIds = orderedNoteIds([pack.noteIdsByStop.get(walk.from_stop_id) ?? [], pack.noteIdsByStop.get(walk.to_stop_id) ?? []]);
      records.push({ kind: "walk_link", id: step.id }, { kind: "stop", id: walk.from_stop_id }, { kind: "stop", id: walk.to_stop_id }, ...noteIds.map((id): RecordRef => ({ kind: "note", id })));
      card = {
        ...base, kind: "walk", from: stopPoint(pack, walk.from_stop_id), to: stopPoint(pack, walk.to_stop_id), walkText: walk.walk_text,
        walkMeters: walk.walk_m === null ? unknown() : known(walk.walk_m), walkMinutes: walk.walk_min === null ? unknown() : known(walk.walk_min),
        notes: noteIds.map((id) => noteView(pack, id, now)),
      };
    }
    card.recordIds = [...new Set(records.map((record) => record.id))].sort();
    card.sources = sourceRefs(pack, records, now);
    card.warnings = cardWarnings(card, records, pack, step.id);
    return card;
  });
}
