import { z } from "zod";
import { ItineraryRef } from "../schema/user";

export const PreferenceSchema = z.enum([
  "balanced",
  "lowest_fare",
  "fewest_transfers",
  "shortest_reported_time",
]);
export type Preference = z.infer<typeof PreferenceSchema>;

export const IntentKindSchema = z.enum([
  "new_trip",
  "change_origin",
  "change_destination",
  "change_preference",
  "alternatives",
  "reverse",
  "ask_boarding",
  "ask_fare",
  "ask_transfer",
  "ask_hours",
  "clarify_answer",
  "unrelated",
]);
export type IntentKind = z.infer<typeof IntentKindSchema>;

const spanSchema = z
  .tuple([z.number().int().nonnegative(), z.number().int().nonnegative()])
  .refine(([start, end]) => start < end, {
    message: "span start must be before end",
  });

export const PlaceMentionSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("text"),
    text: z.string(),
    span: spanSchema,
  }),
  z.object({
    kind: z.literal("trip_ref"),
    ref: z.enum(["origin", "destination"]),
  }),
  z.object({
    kind: z.literal("place_id"),
    placeId: z.string(),
  }),
]);
export type PlaceMention = z.infer<typeof PlaceMentionSchema>;

export const PlaceCandidateSchema = z.object({
  placeId: z.string(),
  name: z.string(),
  area: z.string(),
  kind: z.string(),
});
export type PlaceCandidate = z.infer<typeof PlaceCandidateSchema>;

export const ClarificationSchema = z.object({
  slot: z.enum(["origin", "destination"]),
  text: z.string(),
  candidates: z.array(PlaceCandidateSchema),
});
export type Clarification = z.infer<typeof ClarificationSchema>;

export const IntentSchema = z.object({
  kind: IntentKindSchema,
  origin: PlaceMentionSchema.optional(),
  destination: PlaceMentionSchema.optional(),
  preference: PreferenceSchema.optional(),
  choiceIndex: z.number().int().nonnegative().optional(),
  source: z.enum(["rules", "model"]),
});
export type Intent = z.infer<typeof IntentSchema>;

export const TripStateSchema = z.object({
  packId: z.string(),
  schemaVersion: z.number().int(),
  originPlaceId: z.string().optional(),
  destinationPlaceId: z.string().optional(),
  preference: PreferenceSchema,
  selected: ItineraryRef.optional(),
  currentStep: z.number().int().nonnegative(),
  pendingClarification: ClarificationSchema.optional(),
});
export type TripState = z.infer<typeof TripStateSchema>;
