# @pusang-gala/conversation — current-trip conversation manager

**Owner:** Member 3 (local AI and conversation). **Task:** T32.

Pure TypeScript. No React Native, native, network or storage imports — it
drops into the Expo app later. Its only dependency is `@pusang-gala/core`.

Guardrails (BUILD §5): bounded in-memory context only, no persisted raw chat
(INV-3); ambiguous places require user confirmation (INV-6); new-trip reset;
unrelated requests redirected briefly; cards stay canonical and trace to
eligible pack IDs (INV-1).

## Status

Implemented: `TripConversationManager` with bounded history, new-trip reset,
clarification flow, journey follow-ups and redirection, behind two ports
(`IntentParserPort`, `TripEvidencePort`). All structured trip state lives in
core `TripState` and every transition goes through core `applyIntent`. See
[NOTES.md](NOTES.md) for the public API, port contracts and open integration
questions.

Verify (from the repo root):

```sh
npm run typecheck -w @pusang-gala/conversation
npm test -w @pusang-gala/conversation
```
