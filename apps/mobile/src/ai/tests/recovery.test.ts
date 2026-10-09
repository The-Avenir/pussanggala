import { describe, expect, it } from "vitest";

import { probeCapability } from "../capability";
import { AiRuntimeError, type AiErrorKind } from "../errors";
import { recoveryForCapability, recoveryForError, type RecoveryKind } from "../recovery";
import { CONSTRAINED_DEVICE, FULL_DEVICE, REQUIREMENTS, UNSUPPORTED_ABI_DEVICE } from "./fixtures";

const EXPECTED_MAPPING: Record<AiErrorKind, RecoveryKind> = {
  "unsupported-device": "ai-unsupported",
  "asset-unavailable": "ai-asset-problem",
  "load-timeout": "ai-retryable",
  "load-failed": "ai-retryable",
  "inference-failed": "ai-retryable",
  "out-of-memory": "ai-memory-pressure",
  cancelled: "ai-cancelled",
  disposed: "ai-unsupported",
  busy: "ai-retryable",
};

describe("recoveryForError", () => {
  it("maps every taxonomy kind to a distinct explained PRD-F9 state", () => {
    for (const [kind, expected] of Object.entries(EXPECTED_MAPPING) as [AiErrorKind, RecoveryKind][]) {
      expect(recoveryForError(new AiRuntimeError(kind, "x")).kind).toBe(expected);
    }
  });

  it("every state preserves cards and trip and has a distinct copy key", () => {
    const byKind = new Map(
      (Object.keys(EXPECTED_MAPPING) as AiErrorKind[]).map((kind) => {
        const state = recoveryForError(new AiRuntimeError(kind, "x"));
        return [state.kind, state];
      }),
    );
    const states = [...byKind.values()];
    for (const state of states) {
      expect(state.cardsPreserved).toBe(true);
      expect(state.tripPreserved).toBe(true);
      expect(state.actions.length).toBeGreaterThan(0);
    }
    // Distinct message + recovery action per PRD-F9 state.
    expect(new Set(states.map((s) => s.titleKey)).size).toBe(states.length);
    expect(new Set(states.map((s) => s.bodyKey)).size).toBe(states.length);
  });

  it("marks retryability consistently with the error kind", () => {
    expect(recoveryForError(new AiRuntimeError("load-timeout", "x")).retryable).toBe(true);
    expect(recoveryForError(new AiRuntimeError("unsupported-device", "x")).retryable).toBe(false);
  });

  it("never suggests or implies a cloud/network fallback", () => {
    for (const kind of Object.keys(EXPECTED_MAPPING) as AiErrorKind[]) {
      const state = recoveryForError(new AiRuntimeError(kind, "x"));
      const serialized = `${state.actions.join(" ")} ${state.titleKey} ${state.bodyKey}`.toLowerCase();
      expect(serialized).not.toMatch(/cloud|online|network|upload/);
    }
  });
});

describe("recoveryForCapability", () => {
  it("is silent on a full device", () => {
    expect(recoveryForCapability(probeCapability(FULL_DEVICE, REQUIREMENTS))).toBeNull();
  });

  it("explains constrained and unsupported devices", () => {
    expect(recoveryForCapability(probeCapability(CONSTRAINED_DEVICE, REQUIREMENTS))?.kind).toBe(
      "ai-constrained",
    );
    expect(recoveryForCapability(probeCapability(UNSUPPORTED_ABI_DEVICE, REQUIREMENTS))?.kind).toBe(
      "ai-unsupported",
    );
  });
});

describe("error classification", () => {
  it("keeps typed errors as-is and detects OOM phrasing", async () => {
    const { classifyNativeError } = await import("../errors");
    for (const message of [
      "OutOfMemoryError: failed to allocate",
      "std::bad_alloc",
      "llama OOM in ctx",
    ]) {
      expect(classifyNativeError(new Error(message), "load-failed").kind).toBe("out-of-memory");
    }
    expect(classifyNativeError(new Error("weird decode fault"), "inference-failed").kind).toBe(
      "inference-failed",
    );
    const typed = new AiRuntimeError("asset-unavailable", "bad hash");
    expect(classifyNativeError(typed, "load-failed")).toBe(typed);
  });
});
