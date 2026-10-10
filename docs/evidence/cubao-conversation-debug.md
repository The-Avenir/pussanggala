# Cubao conversation debugging

## Reproduction and diagnosis

The reported input was `pano pumuntang cubao`, tested in an APK installed over USB. The connected phone's original app was last updated on 2026-10-10 at 07:33:32, before the conversation changes in this session. Its visible conversation reproduced the exact `Gala lang tayo` response. The failure occurs before model inference: the rule parser classifies the question as unrelated and the conversation manager redirects it.

The first automated reproduction used the actual bundled SQLite pack:

```powershell
cd apps/mobile
npx vitest run src/routing/evidence.test.ts -t 'Cubao phrase regression'
```

Before the fix, four of five cases failed: `pano pumuntang cubao`, `pano pumunta cubao`, `paano pumuntang cubao`, and `Pano po pumuntang Cubao?`. The supported spelling `paano pumunta sa cubao` passed. Failures returned a redirect with no trip endpoints. This isolates spelling and grammar support from route coverage or model quality.

Additional probes changed only the selection input. Numbers, full candidate names and unique prefixes confirmed the place; `LRT2 Cubao` and `yung LRT2 Cubao po` repeated the choices. A separate phone trace exposed a state bug: `From Buendia to Cubao lowest fare` asked for Buendia, but confirming Buendia then asked for a destination again. The second ambiguous endpoint had been discarded. Its automated reproduction failed with `needsTrip` rather than the required destination clarification.

## Corrections

| Trigger | Cause | Result after correction |
| --- | --- | --- |
| `pano pumuntang cubao` | Parser recognized `paano` and `pumunta`, missing colloquial variants | Destination is parsed; Cubao choices appear |
| `LRT2 Cubao` during clarification | Pending selections bypassed normal place alias resolution | Unique aliases confirm only a currently displayed candidate |
| Ambiguous Buendia and Cubao together | Core supports one pending clarification; manager lost the other | Confirm origin, then confirm destination, preserving preference |
| Tapping a place button | UI submitted its ordinal as a new text question | Button confirms the candidate's stable ID and shows its name |
| Prompt after confirming destination | Missing endpoint labels in the conversational context | Prompt includes the confirmed destination and asks only for origin |

The parser retains exact original source spans; it does not rewrite the user's input. Broad aliases, invalid choice numbers, and places outside the displayed candidates still require clarification. Resetting the trip clears the deferred destination. Route facts continue to come from the bundled pack.

## Prompt and output path

1. Parse the commute request before inference. A failed parse explains the original fallback; changing the model prompt alone would not fix it.
2. Resolve `Cubao` against the pack and ask which place the user means. This is an application decision, not a model guess.
3. An explicit Cubao LRT-2 selection confirms that place. The next prompt includes `TRIP destination="Cubao LRT-2 station"`, `QUESTION text="Cubao LRT-2 station"`, the original Filipino question in recent conversation, and the trusted goal: ask only where they are coming from. No route facts are supplied until both endpoints are known.
4. Entering `Recto` produces a planned route. The next context includes both canonical endpoint names and the retrieved Recto-to-Cubao step. Generated prose is validated; directions, amounts and durations are rendered from cited canonical statements.
5. The internal NDJSON schema is a validation format. Users see conversational text, place choices and directions. If the model is unavailable or its output fails validation, the app uses a readable grounded fallback.

The tested fallback flow starts with `May ilang lugar na “cubao”. Alin dito ang tinutukoy mo?`. After selecting Cubao LRT-2, the reply acknowledges that station and asks where the traveler is coming from. Entering Recto retrieves `Take the LRT-2 from LRT-2 Recto station and get off at Cubao LRT-2 station.` in English, or `Sakay ka ng LRT-2 sa LRT-2 Recto station, tapos baba sa Cubao LRT-2 station.` for a Filipino query. These are grounded fallback examples, not claims about sampled model wording. The model can vary its conversational wording while the selected endpoints and retrieved directions remain fixed.

The original phone's separate `Cubao to makati` failure was a coverage issue: broad `makati` was not a supported place entry. It must request a nearby supported landmark rather than invent a journey.

## Validation

Regression coverage exercises colloquial phrases, original text spans, all five selection styles, explicit UI-selection handling in the manager, two ambiguous endpoints, reset, invalid selections, real pack retrieval, and the prompt immediately after selection.

Core: 456 tests passed. Conversation: 52 tests passed. Mobile: 147 Vitest tests plus four script tests passed. AI: 90 tests passed. Total: 749 tests. Core, conversation and mobile TypeScript checks passed. `git diff --check` passed, and no temporary debug instrumentation was added to application code.

The standard Windows build wrapper failed because the Gradle wrapper's absolute path contains spaces. The build was retried by invoking `gradlew.bat` directly from the Android directory, using the project-pinned JDK 17 and Android SDK 36. No native project regeneration or data clearing was needed.

The initial release build succeeded in 4m 54s. Merged-manifest permission audit passed. Initial artifact (now retained as `.tmp/artifacts/pusang-gala-cubao-debug-initial.apk`): 180,281,752 bytes, SHA-256 `fabb2efa9125daf2eb4312e1a48f2c708f08b21863c5873143ad2d50f645dcb1`. This contains arm64 and x86-64 native libraries; the earlier artifact contained arm64 only. Both use the existing local signing key, package `com.pusanggala.app`, version name `0.0.0`, version code `1`.

Initial USB replacement with `adb install -r` succeeded, preserving app data. The installed package's update time was 2026-10-10 08:36:00. The updated app launched successfully; its UI no longer displayed the technical `OFFLINE ROUTE INFORMATION` label. A sample One Ayala question reached native reply generation. At that stage, Cubao phone interaction was blocked by the device's separate USB input permission: `adb shell input tap` reported `INJECT_EVENTS` denial. Read-only UI inspection worked. No data clearing, uninstalling, permission bypass or settings mutation was performed.

## Native follow-up after USB input was enabled

The user enabled USB debugging security settings. Actual phone taps now work. Native inspection confirmed:

- `pano pumuntang cubao` displays Araneta City, Cubao LRT-2 and Cubao MRT-3 choices rather than the redirect.
- Tapping Cubao LRT-2 records its name in the conversation and asks where the traveler is coming from.
- Entering `Recto` retrieves the correct LRT-2 route and displays fare/travel-time placeholders without invented values.
- `From Buendia to Cubao lowest fare`, followed by the first Buendia choice, retains Cubao and displays its destination choices. The destination is no longer discarded.

The native test exposed two further model-output problems. A generated One Ayala reply echoed `Paano pumunta sa One Ayala?` even though the missing endpoint was the origin. Three tests replaying that and equivalent wrong-endpoint questions failed before the fix. The reply gate now requires a question about the missing endpoint and rejects questions about both endpoints. Seven English/Filipino wording cases verify that the gate accepts varied phrasing rather than requiring one fixed sentence.

The first native route explanation fell back. Temporary, tagged instrumentation isolated the sampled output:

```json
{"kind":"summary","inserts":[],"text":"Cubao LRT-2 station"}
```

The grounding guard rejected the uncited place text. The model copied the last place selection instead of explaining the confirmed trip. A failing grammar regression reproduced the ability to omit all step references. The grammar now requires the ordered step references in the first route unit when they fit the existing insert budget, leaving prose unconstrained. Later units cannot repeat those steps. Longer itineraries retain the existing coverage validation and fallback. The prompt ends with the application-selected task, clarifying that a place selection is not a question to echo and that the app supplies the actual directions.

After these additions, 161 mobile Vitest tests, four mobile script tests and 90 AI tests passed; mobile TypeScript passed. Together with the unchanged core/conversation results, this is 763 automated tests.

The revised grammar was exercised natively and forced the intended `step` unit and `f1` reference. A subsequent live trace captured:

```json
{"kind":"step","inserts":["f1"],"text":"The user is taking the LRT-2 from LRT-2 Recto station and getting off at Cubao LRT-2 station."}
```

The model restated directions in third person instead of supplying connective prose. The existing guard rejected that text, and the app displayed the correct canonical directions through its conversational fallback. Another sampled missing-origin response invented `Cebu LRT-2 station`; it was also rejected. **Native generation quality remains a limitation of the current model/prompt combination.** These checks establish correct parsing, place confirmation, trip retention and grounded recovery; they do not establish consistently natural model-generated conversation. No invented station, route, fare or duration was displayed.

Temporary `[DEBUG-gaile-native]` output/report logging was removed from source. The native runtime and assistant hook have no residual changes from instrumentation. The final release was rebuilt successfully in 1m 4s and replaced over USB with app data retained. Final artifact: `.tmp/artifacts/pusang-gala-cubao-debug-fixed.apk`, 180,284,752 bytes, SHA-256 `33f8cdda10c7388ad6b303079d0f13b1dd18c94e03b30e0ca777d7730ef05667`. Final package update time: 2026-10-10 08:59:45. The original exact-input smoke check is repeated against this final APK. Local app-only traces are retained under `.tmp/debug/`; the temporary device UI dump and live log-capture process are cleaned up.
