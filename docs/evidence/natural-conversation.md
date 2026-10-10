# Natural Gaile conversations — 2026-10-10

The user's sample establishes the desired voice: warm, short, attentive replies
that acknowledge the place and ask only for the missing detail. This change
focuses on conversational behavior and removes technical report/source UI.

## Behavior

- Bare supported place names start a destination-first conversation. For
  `sm north edsa`, Gaile keeps the matched destination and asks for the origin.
  The next short answer, `ayala mrt`, fills the origin without losing the
  destination. Routing still requires a complete connection in the pack.
- Explicit starting points such as `I’m at Ayala MRT` work before a destination
  is given. Ambiguous names such as `Cubao` still require a choice.
- Local generation now handles greetings, thanks, and missing-endpoint questions,
  as well as route explanations. Conversational units use empty inserts without
  fabricated route records. Acknowledgments use the resolved place name, and a
  missing-endpoint response must actually ask a question before display.
- The model receives up to six recent messages, each capped at 200 characters,
  inside the sanitized data block. History informs tone and references; fresh
  canonical statements supply route facts. The prompt asks for matching
  English/Taglish, one useful question, varied wording, and no routine disclaimers.
- Fallbacks acknowledge known places, ask one missing question, and explain
  directions plainly. Fare, duration, boarding, and alighting follow-ups answer
  their own topic rather than repeating the entire route or its widgets.
- Chat no longer shows source IDs, dates, report labels, pack counts, or a
  reports-and-sources disclosure. Example directions also omit the sources button.
  Internal cards and the installed pack retain provenance.

## Fare and time placeholders

Actual available fares and minutes appear on the route cards. Missing fare,
walk-time, and ride-time values show `₱— · pending` or `— min · pending`.
They are presentation placeholders, not numeric estimates written into the pack
or used to rank routes. Fare conflicts remain visible in plain language.
Existing numeric walkthrough values are explicitly labeled example estimates.
No new fare or duration research is claimed by this change.

## Validation

- Mobile: 133 Vitest checks and 4 build-script checks passed.
- AI: 90 checks passed, including bounded history, prompt injection protection,
  and guarded model output.
- Mobile and AI TypeScript checks passed.
- Web export and chat checks passed using installed Edge: natural opening,
  progressive replies, cancellation, new conversation, hidden internal JSON,
  and no runtime errors.
- Full browser travel flows passed at 320/390/430 px, with 200% text,
  accessible touch targets and contrast, no runtime errors, and no external
  requests. Screenshots are in `.tmp/artifacts/natural-conversation-ui/`.

Tests use generated-output fixtures; they do not measure actual phone-model
fluency or latency. An updated APK has not been built or installed for this change.
