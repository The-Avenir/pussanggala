import { z } from "zod";

export const ExplanationUnitSchema = z.object({
  kind: z.enum([
    "summary",
    "step",
    "comparison",
    "hours",
    "caveat",
    "clarify",
    "redirect",
  ]),
  cardRef: z.string().optional(),
  text: z.string().min(1).max(280),
});
export type ExplanationUnit = z.infer<typeof ExplanationUnitSchema>;
