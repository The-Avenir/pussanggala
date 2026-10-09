import type { EvidenceBundle } from "./pack";
import type { ExplanationUnit } from "./guard";
import type { TripState } from "./pack";

export interface ParseOutcome {
  intent: string;
  behaviour: string;
  slots: Record<string, string>;
}

export interface RespondOutcome {
  behaviour: string;
  cards: EvidenceBundle["cards"];
  units: ExplanationUnit[];
  displayed_text: string;
}

export interface StreamOutcome {
  accepted: { index: number; unit: ExplanationUnit }[];
  rejected: { index: number; reason: string }[];
  displayed_text: string;
}

export interface SystemUnderTest {
  readonly name: string;
  parse(query: string, trip: TripState): Promise<ParseOutcome>;
  respond(query: string, trip: TripState): Promise<RespondOutcome>;
  guardStream(rawUnits: string[], trip: TripState): Promise<StreamOutcome>;
}
