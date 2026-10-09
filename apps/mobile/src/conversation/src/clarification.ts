/**
 * T32 — Deterministic clarification helpers (INV-6).
 *
 * An ambiguous place is only accepted when the user EXPLICITLY picks a
 * candidate: an ordinal ("1", "2nd", "first") or an exact/unique-prefix name
 * match. Anything else re-presents the candidates; the manager never guesses.
 *
 * Core `parse` already recognizes ordinals while a clarification is pending
 * (`clarify_answer` + `choiceIndex`). These helpers run first so a user can
 * also answer with the candidate's pack name, and so the UI pick path shares
 * one code path with the chat path.
 */
import type { PlaceCandidate } from "./types";

export interface ClarificationPick {
  index: number;
  choice: PlaceCandidate;
}

const ORDINAL_WORDS: Readonly<Record<string, number>> = {
  first: 0,
  una: 0,
  second: 1,
  pangalawa: 1,
  third: 2,
  pangatlo: 2,
  fourth: 3,
  pangapat: 3,
};

function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

/** The strings a candidate may be addressed by: its name, and name + area. */
function labels(candidate: PlaceCandidate): string[] {
  return [normalize(candidate.name), normalize(`${candidate.name} ${candidate.area}`)];
}

/**
 * Recognize an explicit user pick from `candidates`, or return null when the
 * utterance does not clearly select one.
 */
export function matchClarificationPick(
  utterance: string,
  candidates: readonly PlaceCandidate[],
): ClarificationPick | null {
  const text = normalize(utterance);
  if (text.length === 0) return null;

  // Ordinal: "2", "2nd", "second", "una", ...
  const ordinalMatch = /^(\d{1,2})(?:st|nd|rd|th)?$/.exec(text);
  let index: number | null = null;
  if (ordinalMatch) {
    index = Number(ordinalMatch[1]) - 1;
  } else if (Object.hasOwn(ORDINAL_WORDS, text)) {
    index = ORDINAL_WORDS[text] ?? null;
  }
  if (index !== null) {
    const choice = index >= 0 && index < candidates.length ? candidates[index] : undefined;
    return choice ? { index, choice } : null;
  }

  // Exact name (optionally area-qualified) match.
  const exactIndex = candidates.findIndex((c) => labels(c).includes(text));
  if (exactIndex >= 0) {
    const choice = candidates[exactIndex];
    return choice ? { index: exactIndex, choice } : null;
  }

  // Unique prefix match ("cubao farme" vs "Cubao Farmers Plaza"), >=3 chars.
  if (text.length >= 3) {
    const matches = candidates.filter((c) => labels(c).some((label) => label.startsWith(text)));
    if (matches.length === 1) {
      const choice = matches[0];
      if (choice) return { index: candidates.indexOf(choice), choice };
    }
  }

  return null;
}

/** Numbered candidate prompt. Short and explicit that no guess is made. */
export function clarificationPrompt(
  slot: "origin" | "destination",
  candidates: readonly PlaceCandidate[],
): string {
  const slotLabel = slot === "origin" ? "starting point" : "destination";
  const options = candidates.map((c, i) => `${i + 1}. ${c.name} (${c.area})`).join("\n");
  return (
    `Which ${slotLabel} do you mean? I won't guess.\n` +
    `${options}\n` +
    `Reply with the number or full name (or say "new trip").`
  );
}
