# apps/mobile/src/conversation — conversation manager (placeholder)

**Owner:** Member 3 (local AI and conversation).

**Tasks:** T32 (current-trip conversation manager), T33 (grounded streaming,
shared with `src/ai`), T35 (conversation evaluation).

Guardrails (BUILD §5): bounded in-memory context only — no persisted raw chat
(INV-3); ambiguous places and GPS-origin suggestions require user confirmation
(INV-6); new-trip reset; unrelated requests redirected briefly; cards stay
canonical and trace to eligible pack IDs (INV-1).

**Interface note (T32 ↔ T33):** the T33 streaming guard lives in
`src/ai/streaming-guard.ts` with its contract documented in
`src/ai/STREAMING-NOTES.md`. T32 must call `explain()` fresh per
explanation (new `AbortController`, fresh guard per journey so the
step-order cursor resets), supply only canonical trip labels via
`TripContextPort`, and route `invalid_stream`/`model_error` to T34
recovery while cards remain displayed. `TripContextPort` in
`src/ai/ports.ts` is a REPLACEME placeholder for the real T32 session
type.
