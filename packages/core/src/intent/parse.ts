import type { Intent, IntentKind, PlaceMention, Preference, TripState } from "../contracts/intent";

export const INTENT_KEYWORDS = [
  ["new_trip", "new trip|bagong (?:biyahe|byahe|trip)|start over|ibang biyahe"],
  ["reverse", "reverse|pabalik|pauwi|balik|way back|return trip|going back"],
  ["alternatives", "other route|other option|alternative|ibang ruta|ibang daan|iba pa"],
  ["ask_fare", "magkano|how much|fare|pamasahe|bayad"],
  ["ask_boarding", "saan (?:ako )?sasakay|where (?:do i |to )?(?:board|ride|get on)|sakayan"],
  ["ask_transfer", "transfer|lipat|where (?:do i |to )?get off|saan (?:ako )?(?:bababa|baba)|bababa"],
  ["ask_hours", "anong oras|what time|hours|until when|hanggang anong oras|first trip|last trip|bukas pa|open"],
] as const;

export const PREFERENCE_KEYWORDS = [
  ["lowest_fare", "cheapest|pinakamura|mura|lowest fare|tipid"],
  ["fewest_transfers", "least transfers?|fewest transfers?|konting lipat|walang lipat|isang sakay|direct"],
  ["shortest_reported_time", "fastest|quickest|pinakamabilis|mabilis"],
] as const;

export const CHOICE_KEYWORDS = [
  "first|una|yung una|unang",
  "second|pangalawa|ikalawa",
  "third|pangatlo|ikatlo",
  "fourth|pang-apat|pangapat",
] as const;

export const MENTION_STOP_KEYWORDS = ["na", "po", "lang", "please", "pls", "using", "via", "instead"] as const;

const preferenceSource = PREFERENCE_KEYWORDS.map(([, source]) => source).join("|");
const mentionEnd = new RegExp(`[?.!,;]|\\b(?:${MENTION_STOP_KEYWORDS.join("|")}|${preferenceSource})\\b`, "d");
// Match colloquial spellings without rewriting input, so mention spans stay exact.
const tagalogQuestion = "(?:paano|pa['’]?no)(?:\\s+po)?\\s+(?:pumunta(?:ng)?|pupunta(?:ng)?|makarating|mag-?commute)(?:\\s+po)?(?:\\s+(?:sa|papunta(?:ng)?(?:\\s+sa)?))?";
const originFirst = /\b(?:from|galing(?:\s+(?:sa|ng))?|mula(?:\s+sa)?)\s+(.+?)\s+(?:to|papunta(?:ng)?(?:\s+sa)?|hanggang(?:\s+sa)?|pa)\s+(.+)/d;
const destinationFirst = new RegExp(`\\b(?:how (?:do i |can i |to )?(?:get|go|commute) to|${tagalogQuestion}|papunta(?:ng)?\\s+sa)\\s+(.+?)\\s+(?:from|galing(?:\\s+sa)?|mula(?:\\s+sa)?)\\s+(.+)`, "d");
const originOnly = /\b(?:galing|mula|from)\s+(?:sa\s+)?(.+)/d;
const destinationInstead = /\b(?:papunta(?:ng)?|pupunta|going to|to|sa)\s+(.+?)\s+(?:na lang|instead)\b/d;
const destinationOnly = new RegExp(`\\b(?:how (?:do i |can i |to )?(?:get|go|commute) to|${tagalogQuestion}|papunta(?:ng)?|pumunta(?:ng)?|pupunta(?:ng)?|going to|go to|get to)\\s+(?:sa\\s+)?(.+)`, "d");
const barePair = /^\s*(.+?)\s+to\s+(.+)/d;
const questionPair = new RegExp(`^\\s*(?:${tagalogQuestion}|how (?:do i |can i |to )?(?:get|go|commute))\\s+(.+?)\\s+to\\s+(.+)`, "d");

export function parse(query: string, trip?: TripState): Intent {
  const q = query.toLowerCase();
  const indexMap: number[] = [];
  let originalIndex = 0;
  for (const char of query) {
    for (let i = 0; i < char.toLowerCase().length; i++) indexMap.push(originalIndex);
    originalIndex += char.length;
  }
  indexMap.push(query.length);
  let preference: Preference | undefined;
  for (const [value, source] of PREFERENCE_KEYWORDS) {
    if (new RegExp(`\\b(?:${source})\\b`, "d").test(q)) {
      preference = value;
      break;
    }
  }
  function intent(kind: IntentKind, slots: Partial<Intent> = {}): Intent {
    return { kind, source: "rules", ...slots, ...(preference === undefined ? {} : { preference }) };
  }
  function mention(bounds: [number, number] | undefined): PlaceMention | undefined {
    if (!bounds) return undefined;
    let [start, end] = bounds;
    const stop = mentionEnd.exec(q.slice(start, end));
    if (stop) end = start + stop.index;
    start += q.slice(start, end).length - q.slice(start, end).trimStart().length;
    end -= q.slice(start, end).length - q.slice(start, end).trimEnd().length;
    const leading = /^(?:sa|ng|the)\s+/d.exec(q.slice(start, end));
    if (leading) start += leading[0].length;
    if (start >= end) return undefined;
    const span: [number, number] = [indexMap[start]!, indexMap[end]!];
    return { kind: "text", text: query.slice(...span), span };
  }
  if (trip?.pendingClarification) {
    const choice = q.trim().replace(/[?.!,;]+$/, "").trimEnd();
    if (/^[1-9]$/d.test(choice)) return intent("clarify_answer", { choiceIndex: Number(choice) - 1 });
    const choiceIndex = CHOICE_KEYWORDS.findIndex((source) => new RegExp(`^(?:${source})$`, "d").test(choice));
    if (choiceIndex >= 0) return intent("clarify_answer", { choiceIndex });
  }
  function pair(match: RegExpExecArray | null, reversed = false): Intent | undefined {
    const origin = mention(match?.indices?.[reversed ? 2 : 1]);
    const destination = mention(match?.indices?.[reversed ? 1 : 2]);
    return origin && destination ? intent("new_trip", { origin, destination }) : undefined;
  }
  const explicitPair = pair(originFirst.exec(q)) ?? pair(destinationFirst.exec(q), true) ?? pair(questionPair.exec(q));
  if (explicitPair) return explicitPair;
  const singleOrigin = mention(originOnly.exec(q)?.indices?.[1]);
  const singleDestination = mention((destinationInstead.exec(q) ?? destinationOnly.exec(q))?.indices?.[1]);
  if (!/^\s*(?:how|where|paano|pa['’]?no|going to|go to|get to|papunta(?:ng)?|pumunta(?:ng)?|pupunta(?:ng)?|galing|mula|from|sa)\b/d.test(q)) {
    const bare = pair(barePair.exec(q));
    if (bare) return bare;
  }
  const withoutPreferences = q.replace(new RegExp(`\\b(?:${preferenceSource})\\b`, "dg"), " ");
  for (const [kind, source] of INTENT_KEYWORDS) {
    if (new RegExp(`\\b(?:${source})\\b`, "d").test(withoutPreferences)) {
      return intent(kind);
    }
  }
  if (singleOrigin) return intent(trip ? "change_origin" : "new_trip", { origin: singleOrigin });
  if (singleDestination) return intent(trip ? "change_destination" : "new_trip", { destination: singleDestination });
  if (preference !== undefined) return intent(trip ? "change_preference" : "unrelated");
  return intent("unrelated");
}
