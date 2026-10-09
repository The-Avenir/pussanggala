/**
 * Device-capability probe.
 *
 * Determines whether the pinned sub-1B model can run on this device and at
 * which budget, per the SDD §1.5 capability table:
 *   - full: reference-class device, required AI conversation must work;
 *   - constrained: usable with reduced context/output budgets, explained;
 *   - unsupported: AI unavailable, explained; cards/trip/map unaffected.
 *
 * This module is pure: the DeviceSnapshot is supplied by a port owned by
 * Member 4 (React Native / native OS queries). No RN or network imports here.
 */

export type CapabilityLevel = "full" | "constrained" | "unsupported";

export type CapabilityReasonCode =
  /** No device ABI is in the model runtime's supported list. */
  | "abi-unsupported"
  /** OS reports low-memory device mode (e.g. Android isLowRamDevice). */
  | "os-low-memory-mode"
  /** Total RAM below the absolute minimum for the runtime. */
  | "memory-below-minimum"
  /** RAM above minimum but below the full-budget requirement. */
  | "memory-constrained"
  /** Model asset missing/corrupt per Member 4's asset readiness. */
  | "model-asset-not-ready";

export interface CapabilityReason {
  code: CapabilityReasonCode;
  detail: string;
}

/** Generation/context budget selected for the device ("full" or "constrained"). */
export interface GenerationBudget {
  contextTokens: number;
  outputTokenCap: number;
  threads: number;
  /** Expected native resident memory for model + context at this budget. */
  runtimeMemoryMb: number;
}

export interface CapabilityReport {
  level: CapabilityLevel;
  reasons: CapabilityReason[];
  /** Null only when level is "unsupported". */
  budget: GenerationBudget | null;
}

export interface ModelRequirements {
  /** ABIs the pinned native runtime supports, e.g. ["arm64-v8a"]. */
  supportedAbis: readonly string[];
  /** Absolute floor: below this, the device is unsupported. */
  minTotalMemoryMb: number;
  /** RAM reserved for the rest of the app (map/GPS/UI) plus OS headroom (see SDD M6: peak PSS <= 1 GB on the 4 GB reference phone). */
  reservedForAppMb: number;
  full: GenerationBudget;
  constrained: GenerationBudget;
}

/**
 * Hardware/OS facts about the device.
 *
 * REPLACE (T40, Member 4): supply this from React Native — DeviceInfo
 * (supported ABIs, total memory) and the Android ActivityManager low-RAM
 * flag. Keep it synchronous-cheap; the lifecycle manager calls the probe via
 * the DeviceProbe port in lifecycle.ts.
 */
export interface DeviceSnapshot {
  /** Device ABIs in preference order, e.g. ["arm64-v8a", "armeabi-v7a"]. */
  abis: readonly string[];
  totalMemoryMb: number | null;
  /** OS low-RAM device mode; null when the platform cannot report it. */
  lowMemoryMode: boolean | null;
  /** Member 4 asset-readiness result for the pinned model file. */
  modelAssetReady: boolean;
}

export function probeCapability(
  snapshot: DeviceSnapshot,
  requirements: ModelRequirements,
): CapabilityReport {
  const reasons: CapabilityReason[] = [];

  const abiOk = snapshot.abis.some((abi) => requirements.supportedAbis.includes(abi));
  if (!abiOk) {
    reasons.push({
      code: "abi-unsupported",
      detail: `device ABIs [${snapshot.abis.join(", ")}] not in supported [${requirements.supportedAbis.join(", ")}]`,
    });
  }
  if (snapshot.lowMemoryMode === true) {
    reasons.push({ code: "os-low-memory-mode", detail: "OS reports low-memory device mode" });
  }
  if (snapshot.totalMemoryMb !== null && snapshot.totalMemoryMb < requirements.minTotalMemoryMb) {
    reasons.push({
      code: "memory-below-minimum",
      detail: `${snapshot.totalMemoryMb} MB < minimum ${requirements.minTotalMemoryMb} MB`,
    });
  }
  if (!snapshot.modelAssetReady) {
    reasons.push({ code: "model-asset-not-ready", detail: "model asset missing or failed validation" });
  }

  if (reasons.length > 0) {
    return { level: "unsupported", reasons, budget: null };
  }

  const fullFits =
    snapshot.totalMemoryMb === null ||
    snapshot.totalMemoryMb >= requirements.full.runtimeMemoryMb + requirements.reservedForAppMb;

  if (!fullFits) {
    reasons.push({
      code: "memory-constrained",
      detail: `${snapshot.totalMemoryMb} MB total; using constrained generation budget`,
    });
    return { level: "constrained", reasons, budget: requirements.constrained };
  }

  return { level: "full", reasons: [], budget: requirements.full };
}

/**
 * Release gate helper (S4/BUILD §5): an explained fallback must never silently
 * become the shipped reference-phone behaviour. Call before packaging the
 * judged APK; on the named reference phone the capability MUST be "full".
 */
export interface ReferenceGateResult {
  ok: boolean;
  problems: string[];
}

export function checkReferencePhoneGate(
  report: CapabilityReport,
  options: { isReferencePhone: boolean },
): ReferenceGateResult {
  const problems: string[] = [];
  if (options.isReferencePhone && report.level !== "full") {
    problems.push(
      `reference phone probed as "${report.level}" (${
        report.reasons.map((r) => r.code).join(", ") || "no reasons"
      }): the judged release requires working on-device AI on the reference phone`,
    );
  }
  return { ok: problems.length === 0, problems };
}
