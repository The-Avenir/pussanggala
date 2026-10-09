// Prints Member 1 task progress from data/raw/progress/*.json (local only, gitignored).
import { readdirSync, readFileSync } from "node:fs";
const dir = new URL("../../data/raw/progress/", import.meta.url);
const rows = readdirSync(dir).filter((f) => f.endsWith(".json")).sort().map((f) => JSON.parse(readFileSync(new URL(f, dir), "utf8")));
for (const r of rows) {
  const bar = "#".repeat(Math.round(r.percent / 5)).padEnd(20, ".");
  console.log(`${r.task.padEnd(7)} [${bar}] ${String(r.percent).padStart(3)}%  ${r.status.padEnd(9)} ${r.note ?? ""}`);
}
