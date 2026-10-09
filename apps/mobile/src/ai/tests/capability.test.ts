import { describe, expect, it } from "vitest";

import { checkReferencePhoneGate, probeCapability, type DeviceSnapshot } from "../capability";
import { CONSTRAINED_DEVICE, FULL_DEVICE, REQUIREMENTS, UNSUPPORTED_ABI_DEVICE } from "./fixtures";

describe("probeCapability", () => {
  it("returns full with the full budget and no reasons on a reference-class device", () => {
    const report = probeCapability(FULL_DEVICE, REQUIREMENTS);
    expect(report.level).toBe("full");
    expect(report.reasons).toEqual([]);
    expect(report.budget).toBe(REQUIREMENTS.full);
  });

  it("returns constrained with an explained memory reason when RAM is above the floor but tight", () => {
    const report = probeCapability(CONSTRAINED_DEVICE, REQUIREMENTS);
    expect(report.level).toBe("constrained");
    expect(report.budget).toBe(REQUIREMENTS.constrained);
    expect(report.reasons.map((r) => r.code)).toEqual(["memory-constrained"]);
  });

  it("returns unsupported when no ABI matches", () => {
    const report = probeCapability(UNSUPPORTED_ABI_DEVICE, REQUIREMENTS);
    expect(report.level).toBe("unsupported");
    expect(report.budget).toBeNull();
    expect(report.reasons.map((r) => r.code)).toContain("abi-unsupported");
  });

  it("returns unsupported below the RAM floor", () => {
    const snapshot: DeviceSnapshot = { ...FULL_DEVICE, totalMemoryMb: 1024 };
    const report = probeCapability(snapshot, REQUIREMENTS);
    expect(report.level).toBe("unsupported");
    expect(report.reasons.map((r) => r.code)).toContain("memory-below-minimum");
  });

  it("returns unsupported in OS low-memory mode and when the model asset is not ready", () => {
    for (const patch of [{ lowMemoryMode: true }, { modelAssetReady: false }] satisfies Partial<DeviceSnapshot>[]) {
      const report = probeCapability({ ...FULL_DEVICE, ...patch }, REQUIREMENTS);
      expect(report.level).toBe("unsupported");
    }
  });

  it("treats unknown RAM optimistically at the full budget (asset/ABI gates still apply)", () => {
    const report = probeCapability({ ...FULL_DEVICE, totalMemoryMb: null }, REQUIREMENTS);
    expect(report.level).toBe("full");
  });
});

describe("checkReferencePhoneGate (S4 guardrail)", () => {
  it("fails the release gate when the reference phone probes below full", () => {
    for (const device of [CONSTRAINED_DEVICE, UNSUPPORTED_ABI_DEVICE]) {
      const report = probeCapability(device, REQUIREMENTS);
      const gate = checkReferencePhoneGate(report, { isReferencePhone: true });
      expect(gate.ok).toBe(false);
      expect(gate.problems.length).toBeGreaterThan(0);
    }
  });

  it("passes the release gate on a full reference phone and tolerates degraded non-reference phones", () => {
    expect(
      checkReferencePhoneGate(probeCapability(FULL_DEVICE, REQUIREMENTS), { isReferencePhone: true }).ok,
    ).toBe(true);
    expect(
      checkReferencePhoneGate(probeCapability(CONSTRAINED_DEVICE, REQUIREMENTS), {
        isReferencePhone: false,
      }).ok,
    ).toBe(true);
  });
});
