import { describe, expect, it } from "vitest";
import { answerHours, loadPack } from "../src/index";
import { buildRawPack, type PackSpec } from "./fixtures/builder";

const now = new Date("2026-10-09T00:00:00Z");

function pack(hours: PackSpec["hours"] = [], extras: Partial<PackSpec> = {}) {
  const loaded = loadPack(buildRawPack({ places: [], stops: [], access: [], routes: [{ id: "rt_a", signboard: "SYNTHETIC A" }, { id: "rt_b", direction: "Synthetic B direction" }], legs: [], hours, ...extras }));
  if (!loaded.ok) throw new Error(JSON.stringify(loaded.error));
  return loaded.value;
}

describe("reported operating hours", () => {
  it("shows a reported value, source date and structured fields", () => {
    const result = answerHours(["rt_a"], pack([{ id: "hr_a", route: "rt_a", text: "Synthetic daytime hours", starts: "06:00", ends: "18:00", days: "Synthetic weekdays", postedAt: "2026-09-01" }]), now);
    expect(result[0]).toMatchObject({ routeId: "rt_a", status: "reported", conflict: false, text: "Reported hours for SYNTHETIC A: Synthetic daytime hours (source post date 2026-09-01). Commuter-reported, not a timetable." });
    expect(result[0]?.reports[0]).toMatchObject({ hoursId: "hr_a", text: "Synthetic daytime hours", startsLocal: "06:00", endsLocal: "18:00", daysText: "Synthetic weekdays", sources: [{ postedAt: "2026-09-01", stale: false }] });
  });

  it("keeps conflicting reports sorted by ID with their separate source dates", () => {
    const result = answerHours(["rt_a"], pack([{ id: "hr_z", route: "rt_a", text: "Synthetic evening hours", postedAt: "2026-09-01" }, { id: "hr_a", route: "rt_a", text: "Synthetic daytime hours", postedAt: "2026-08-01" }]), now);
    expect(result[0]?.reports.map((report) => report.hoursId)).toEqual(["hr_a", "hr_z"]);
    expect(result[0]).toMatchObject({ status: "reported", conflict: true, text: "Reports differ for SYNTHETIC A: Synthetic daytime hours (source post date 2026-08-01); Synthetic evening hours (source post date 2026-09-01). Commuter-reported, not a timetable." });
  });

  it.each([
    { starts: "07:00" }, { ends: "19:00" }, { days: "Synthetic weekends" }, { text: "Other synthetic hours" },
  ])("detects differing report fields: %j", (difference) => {
    const result = answerHours(["rt_a"], pack([{ id: "hr_a", route: "rt_a", text: "Synthetic daytime hours" }, { id: "hr_b", route: "rt_a", text: "Synthetic daytime hours", ...difference }]), now);
    expect(result[0]?.conflict).toBe(true);
  });

  it("retains identical reports without claiming a conflict", () => {
    const result = answerHours(["rt_a"], pack([{ id: "hr_a", route: "rt_a", text: "Synthetic daytime hours" }, { id: "hr_b", route: "rt_a", text: "Synthetic daytime hours" }]), now);
    expect(result[0]?.reports).toHaveLength(2);
    expect(result[0]?.conflict).toBe(false);
    expect(result[0]?.text).toBe("Reported hours for SYNTHETIC A: Synthetic daytime hours (source post date 2026-06-01). Commuter-reported, not a timetable.");
    expect(result[0]?.reports[0]).not.toHaveProperty("startsLocal");
  });

  it("reports unknown hours and falls back to direction label", () => {
    expect(answerHours(["rt_b"], pack(), now)).toEqual([{ routeId: "rt_b", status: "unknown", reports: [], conflict: false, text: "No reported operating hours for Synthetic B direction." }]);
  });

  it("adds a stale suffix using the injected date", () => {
    const fixture = pack([{ id: "hr_a", route: "rt_a", text: "Synthetic daytime hours", postedAt: "2025-01-01" }]);
    expect(answerHours(["rt_a"], fixture, now)[0]?.text).toBe("Reported hours for SYNTHETIC A: Synthetic daytime hours (source post date 2025-01-01). Commuter-reported, not a timetable. This report is older than 180 days.");
    expect(answerHours(["rt_a"], fixture, new Date("2025-02-01"))[0]?.text).not.toContain("older than");
  });

  it("labels missing source dates unknown", () => {
    const result = answerHours(["rt_a"], pack([{ id: "hr_a", route: "rt_a", text: "Synthetic daytime hours" }], { sources: [{ id: "src_undated", postedAt: null }], recordSources: [{ kind: "hours_report", id: "hr_a", source: "src_undated" }] }), now);
    expect(result[0]?.text).toContain("source post date unknown");
    expect(result[0]?.reports[0]?.sources[0]).not.toHaveProperty("postedAt");
  });

  it("labels an unparseable source date unknown in the generated statement", () => {
    const result = answerHours(["rt_a"], pack([{ id: "hr_a", route: "rt_a", text: "Synthetic daytime hours", postedAt: "invalid-date" }]), now);
    expect(result[0]?.text).toBe("Reported hours for SYNTHETIC A: Synthetic daytime hours (source post date unknown). Commuter-reported, not a timetable.");
    expect(result[0]?.reports[0]?.sources[0]?.postedAt).toBe("invalid-date");
  });

  it("preserves unique input order, skips unknown routes and emits no availability or timing predictions", () => {
    const fixture = pack([{ id: "hr_a", route: "rt_a", text: "Synthetic daytime hours" }]);
    const result = answerHours(["rt_b", "rt_missing", "rt_a", "rt_b"], fixture, now);
    expect(result.map((statement) => statement.routeId)).toEqual(["rt_b", "rt_a"]);
    for (const statement of result) expect(statement.text).not.toMatch(/open now|operating now|arriv|schedule|depart/i);
    expect(answerHours([], fixture, now)).toEqual([]);
  });
});
