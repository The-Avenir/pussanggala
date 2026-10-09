import type { HoursView, HourStatement } from "../contracts/cards";
import type { Pack } from "../pack/types";
import { sourceRefs } from "../cards/sources";

export function answerHours(routeIds: string[], pack: Pack, now: Date): HourStatement[] {
  const statements: HourStatement[] = [];
  for (const routeId of new Set(routeIds)) {
    const route = pack.routes.get(routeId);
    if (!route) continue;
    const label = route.signboard ?? route.direction_label;
    const rows = [...(pack.hoursByRoute.get(routeId) ?? [])].sort((a, b) => a.hours_id < b.hours_id ? -1 : a.hours_id > b.hours_id ? 1 : 0);
    const reports: HoursView[] = rows.map((row) => {
      const view: HoursView = { hoursId: row.hours_id, text: row.hours_text, sources: sourceRefs(pack, [{ kind: "hours_report", id: row.hours_id }], now) };
      if (row.starts_local !== null) view.startsLocal = row.starts_local;
      if (row.ends_local !== null) view.endsLocal = row.ends_local;
      if (row.days_text !== null) view.daysText = row.days_text;
      return view;
    });
    const conflict = new Set(rows.map((row) => JSON.stringify([row.hours_text, row.starts_local, row.ends_local, row.days_text]))).size > 1;
    const description = (report: HoursView) => {
      const source = report.sources[0];
      const date = source?.ageDays === undefined ? "unknown" : source.postedAt!.slice(0, 10);
      return `${report.text} (source post date ${date})`;
    };
    let text = `No reported operating hours for ${label}.`;
    if (reports.length) {
      text = conflict
        ? `Reports differ for ${label}: ${reports.map(description).join("; ")}. Commuter-reported, not a timetable.`
        : `Reported hours for ${label}: ${description(reports[0]!)}. Commuter-reported, not a timetable.`;
      if (!conflict && reports[0]!.sources[0]?.stale) text += ` This report is older than ${pack.manifest.stale_after_days} days.`;
    }
    statements.push({ routeId, status: reports.length ? "reported" : "unknown", reports, conflict, text });
  }
  return statements;
}
