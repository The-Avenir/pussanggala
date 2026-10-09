import { z } from "zod";

export const ExplanationUnitKindSchema = z.enum([
  "summary",
  "step",
  "comparison",
  "hours",
  "caveat",
  "clarify",
  "redirect",
]);
export type ExplanationUnitKind = z.infer<typeof ExplanationUnitKindSchema>;

/** Core-side explanation unit. Optional `inserts` cite canonical statement IDs (INV-1). */
export const ExplanationUnitSchema = z.object({
  kind: ExplanationUnitKindSchema,
  cardRef: z.string().optional(),
  inserts: z.array(z.string().min(1)).optional(),
  text: z.string().min(1).max(280),
});
export type ExplanationUnit = z.infer<typeof ExplanationUnitSchema>;
