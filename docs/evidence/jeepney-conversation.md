# Jeepney coverage and conversational route replies — 2026-10-10

Follow-up: [natural conversational behavior and traveler-facing placeholders](natural-conversation.md).

Seven additional directed jeepney segments now reach the seed and the mobile
app's bundled pack. Real route chat turns invoke the installed local model,
using the current question and retrieved cards, rather than always revealing
`routeReply`'s fixed paragraph.

## Source-backed jeepney additions

| Boarding landmark | Alighting landmark | Snapshot post | Comment index |
|---|---|---|---:|
| Guadalupe | Market! Market! | `1wy1iq1` | 0 |
| Telus McKinley Exchange | Market! Market! | `1wy1iq1` | 0 |
| SM North | UP Diliman | `1t0xe8g` | 1 |
| Philcoa | UP Diliman | `1vbhaao` | 1 |
| LRT-2 Cubao vicinity | UST | `1udf8f0` | 7 |
| Shaw Boulevard | Pasig Palengke | `1wbfnll` | 0 |
| BCDA | McKinley | `1uyat4a` | 4 |

These comments explicitly give each boarding landmark, jeepney service and
alighting landmark. Canonical aliases resolve the stated places. Precise loading
bays, road-side coordinates, fares, hours, travel times and unstated transfers
remain unknown. No reverse segment is inferred. Existing rail supplements remain.

Each supplement pins the unchanged snapshot and comment hash, enters as
`extracted`, and passes existing evidence checks and eligible-record validation.
No agent sets a human `accepted` decision or promotes an existing pending
candidate. Source dates remain post dates; independent AI review, designated
reviewer sign-off and field verification are separate project gates.

The pack now has 148 legs, 80 route records, 65 stops, 91 places and 21 walk links.
Answered-post dispositions: 412 included, 90 pending, 494 rejected, 1,190 filtered.
The reduction in pending post dispositions reflects an additional usable segment
in a previously pending post, not acceptance of its pending candidates.

The promoted and bundled pack SHA-256 is
`dd79be14ba939f769b0512383891acda5f562c1f2acbc24739f78138ee526d4e`;
851,968 bytes, built using Node `v26.0.0` / SQLite `3.51.3`.
`npm run pack:bundle --workspace @pusang-gala/mobile` updates the app's database,
companion manifest and asset catalog.

## Conversation change

The previous native grammar forced the literal sentence “Here are the reported
details.” Its route renderer discarded model prose, and the app only invoked
inference for synthetic preview itineraries. Focused tests reproduced both
formatting restrictions before the changes.

The new grammar constrains JSON structure, valid statement IDs and text length
while allowing model-authored connective prose. It uses the bounded repetitions
and escaped string syntax documented by
[llama.cpp's GBNF guide](https://github.com/ggml-org/llama.cpp/blob/master/grammars/README.md).
Internal JSON and citation IDs never appear in the chat bubble.

The prompt asks Gaile to answer the current question naturally in English/Taglish
without a repeated introduction, field labels or automatic follow-up question.
The route context supplies short spoken directions instead of `Ride:` and
`Direction:` fields. Fare, hours and boarding follow-ups receive their own
topic-filtered evidence; all canonical facts retain pack record IDs.

Model-authored route text is connective prose. Factual travel instructions,
numbers, fares and times must come from validated canonical inserts. Valid
citations do not authorize new instructions in prose. The stream guard still
rejects unknown citations, reversed steps and unsupported claims before display.
The reply helper checks that the model covered every supplied route step.

The model reply is shown first. A fixed report answer is used when the model is
unavailable, produces no usable reply, omits directions or fails; the UI explains
the fallback. Cancellation does not silently finish with a canned answer, and
late output after a new conversation or unmount is dropped.

A synthetic validated test reply now renders as:

> Sige, simulan natin dito. Sakay ng jeep mula Lantern papuntang Copper.

That wording is generated input to the test, not evidence of phone model quality.
Native inference fluency and latency still need device validation. An updated
APK has not been built or installed during this change.
Greetings and app-identity responses retain their existing local wording.

## Validation

- Complete corpus pipeline: passed; pack acceptance 24/24 and shipped-content scan passed.
- Corpus and builder suites: 165/165 passed.
- Core seed smoke: 15/15 passed, including all fourteen curated journeys and unknown fares.
- Mobile inference, adapter and routing checks: 63/63 passed.
- AI prompt, stream-guard and runtime checks: 89/89 passed.
- Mobile, AI and core TypeScript checks: passed.
- Web export: passed. Chat UI checks passed using installed Edge, covering
  progressive replies, Stop, conversation reset, hidden internal JSON and no
  browser runtime errors.
