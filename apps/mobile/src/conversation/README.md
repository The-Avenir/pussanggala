# apps/mobile/src/conversation — conversation manager (placeholder)

**Owner:** Member 3 (local AI and conversation).

**Tasks:** T32 (current-trip conversation manager), T33 (grounded streaming,
shared with `src/ai`), T35 (conversation evaluation).

Guardrails (BUILD §5): bounded in-memory context only — no persisted raw chat
(INV-3); ambiguous places and GPS-origin suggestions require user confirmation
(INV-6); new-trip reset; unrelated requests redirected briefly; cards stay
canonical and trace to eligible pack IDs (INV-1).
