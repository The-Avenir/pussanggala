import type { Known } from "../result";
import type { TripState } from "./intent";
import type { ComparisonStatement, Itinerary } from "./routing";

export interface PointView {
  placeId?: string;
  stopId?: string;
  name: string;
  landmarkHint?: string;
  mapped: boolean;
}

export interface SourceRef {
  sourceId: string;
  kind: string;
  url?: string;
  postedAt?: string;
  ageDays?: number;
  stale: boolean;
}

export interface FareView {
  fareId: string;
  min: number;
  max: number;
  currency: "PHP";
  effectiveAt?: string;
  sources: SourceRef[];
}

export interface HoursView {
  hoursId: string;
  text: string;
  startsLocal?: string;
  endsLocal?: string;
  daysText?: string;
  sources: SourceRef[];
}

export interface NoteView {
  noteId: string;
  kind: "tip" | "warning" | "conflict";
  body: string;
  sources: SourceRef[];
}

export const WARNING_CODES = [
  "fare_unknown",
  "fare_conflict",
  "time_unknown",
  "hours_unknown",
  "hours_conflict",
  "stale_source",
  "source_date_unknown",
  "service_status_unknown",
  "unmapped_point",
  "schematic_only",
] as const;

export type WarningCode = (typeof WARNING_CODES)[number];

export interface Warning {
  code: WarningCode;
  message: string;
  recordIds: string[];
}

export type Card =
  | {
      cardId: string;
      kind: "access";
      direction: "start" | "end";
      place: PointView;
      stop: PointView;
      walkText: string;
      walkMeters: Known<number>;
      walkMinutes: Known<number>;
      recordIds: string[];
      warnings: Warning[];
      sources: SourceRef[];
    }
  | {
      cardId: string;
      kind: "ride";
      routeId: string;
      mode: string;
      signboard?: string;
      directionLabel: string;
      board: PointView;
      alight: PointView;
      rideMinutes: Known<number>;
      fares: FareView[];
      hours: HoursView[];
      notes: NoteView[];
      recordIds: string[];
      warnings: Warning[];
      sources: SourceRef[];
    }
  | {
      cardId: string;
      kind: "walk";
      from: PointView;
      to: PointView;
      walkText: string;
      walkMeters: Known<number>;
      walkMinutes: Known<number>;
      notes: NoteView[];
      recordIds: string[];
      warnings: Warning[];
      sources: SourceRef[];
    };

export interface HourStatement {
  routeId: string;
  status: "reported" | "unknown";
  reports: HoursView[];
  conflict: boolean;
  text: string;
}

export interface EvidenceBundle {
  v: 1;
  packId: string;
  trip: TripState;
  cards: Card[];
  alternatives: Array<
    Pick<
      Itinerary,
      "id" | "rideCount" | "transferCount" | "fare" | "reportedRideMinutes"
    >
  >;
  comparisons: ComparisonStatement[];
  hourStatements: HourStatement[];
  notes: NoteView[];
  allowedCardIds: string[];
  allowedRecordIds: string[];
}

export const EVIDENCE_BOUNDS = {
  maxCards: 12,
  maxAlternatives: 3,
  maxNotes: 8,
} as const;
