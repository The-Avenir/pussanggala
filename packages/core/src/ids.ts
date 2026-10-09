import { z } from "zod";
import type { StepRef } from "./schema/user";

export const ID_PREFIXES = {
  region: "rg",
  place: "pl",
  stop: "st",
  access: "ac",
  route: "rt",
  leg: "lg",
  walk: "wk",
  fare: "fr",
  hours: "hr",
  shape: "sh",
  note: "nt",
  source: "src",
} as const;

export type IdPrefix = (typeof ID_PREFIXES)[keyof typeof ID_PREFIXES];

export const STABLE_ID_RE = /^[a-z]{2,3}_[a-z0-9][a-z0-9_-]{0,63}$/;

export function stableId(prefix: IdPrefix) {
  return z
    .string()
    .regex(STABLE_ID_RE, "invalid stable ID format")
    .refine((id) => id.startsWith(`${prefix}_`), {
      message: `stable ID must start with "${prefix}_"`,
    });
}

export function itineraryId(steps: StepRef[]): string {
  return `it_${steps.map((step) => step.id).join(".")}`;
}

export function cardId(itinerary: string, index: number): string {
  return `${itinerary}#${index}`;
}
