# apps/mobile/src/ai — local model runtime (placeholder)

**Owner:** Member 3 (local AI and conversation).

**Tasks:** T30 (native model compatibility/safe-output spike), T31 (model
bake-off/footprint), T33 (grounded generation and validated streaming), T34
(capability, cancellation, inference recovery), T35 (conversation/grounding
evaluation).

Guardrails (BUILD §5): a strictly sub-1B local model; never stream unchecked
model tokens — validate complete explanation units before display; no invented
facts or reversed instructions; no cloud-AI/network fallback; required
reference-phone AI is not replaced by rules-only templates.
