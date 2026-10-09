import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { RawPackTables } from "../../src/index";

const SCHEMA_VERSION = 1;

const DISPOSITION_PRECEDENCE = [
  "included",
  "pending",
  "rejected",
  "filtered",
] as const;

/** SQL table basename -> RawPackTables property (mirrors tools/pack-builder/lib/spec.mjs). */
const ELIGIBLE_FILES: { file: string; key: keyof Omit<RawPackTables, "manifest"> }[] =
  [
    { file: "region", key: "regions" },
    { file: "place", key: "places" },
    { file: "place_alias", key: "place_aliases" },
    { file: "place_ambiguity", key: "place_ambiguities" },
    { file: "stop", key: "stops" },
    { file: "place_stop", key: "place_stops" },
    { file: "route", key: "routes" },
    { file: "leg", key: "legs" },
    { file: "walk_link", key: "walk_links" },
    { file: "fare_report", key: "fare_reports" },
    { file: "hours_report", key: "hours_reports" },
    { file: "shape", key: "shapes" },
    { file: "note", key: "notes" },
    { file: "note_link", key: "note_links" },
    { file: "source", key: "sources" },
    { file: "record_source", key: "record_sources" },
  ];

const REPO_ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "../../../..");

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8"));
}

function resolveDispositions(raw: Record<string, unknown>) {
  const final: Record<string, string> = {};
  for (const postId of Object.keys(raw).sort()) {
    const values = Array.isArray(raw[postId])
      ? (raw[postId] as string[])
      : [raw[postId] as string];
    final[postId] = DISPOSITION_PRECEDENCE.find((d) => values.includes(d))!;
  }
  return final;
}

function countDispositions(final: Record<string, string>) {
  const counts = Object.fromEntries(
    DISPOSITION_PRECEDENCE.map((d) => [d, 0]),
  ) as Record<(typeof DISPOSITION_PRECEDENCE)[number], number>;
  for (const v of Object.values(final)) {
    counts[v as (typeof DISPOSITION_PRECEDENCE)[number]] += 1;
  }
  return counts;
}

function sourceDateRange(tables: {
  source: { source_id: string; posted_at?: string | null; observed_at?: string | null }[];
  record_source: { source_id: string }[];
}) {
  const cited = new Set(tables.record_source.map((r) => r.source_id));
  const dateOf = (v: unknown) =>
    typeof v === "string" && v.length >= 10 ? v.slice(0, 10) : null;
  const dates = tables.source
    .filter((s) => cited.has(s.source_id))
    .map((s) => dateOf(s.posted_at) ?? dateOf(s.observed_at))
    .filter((d): d is string => d !== null)
    .sort();
  return { min: dates[0] ?? null, max: dates.at(-1) ?? null };
}

/** Load cleaned `data/seed/eligible/*.json` into the RawPackTables shape for loadPack. */
export function loadSeedEligibleRaw(): RawPackTables {
  const eligibleDir = join(REPO_ROOT, "data/seed/eligible");
  const run = readJson(join(REPO_ROOT, "data/seed/run.json")) as Record<
    string,
    unknown
  >;
  const dispositions = readJson(
    join(REPO_ROOT, "data/seed/dispositions.json"),
  ) as Record<string, unknown>;

  const tables: Record<string, unknown[]> = {};
  for (const { file, key } of ELIGIBLE_FILES) {
    const path = join(eligibleDir, `${file}.json`);
    tables[key] = existsSync(path) ? (readJson(path) as unknown[]) : [];
  }

  const final = resolveDispositions(dispositions);
  const counts = countDispositions(final);
  const range = sourceDateRange({
    source: tables.sources as {
      source_id: string;
      posted_at?: string | null;
      observed_at?: string | null;
    }[],
    record_source: tables.record_sources as { source_id: string }[],
  });

  return {
    manifest: {
      pack_id: run.pack_id,
      schema_version: SCHEMA_VERSION,
      region_id: run.region_id,
      bbox: run.bbox,
      created_at: run.created_at,
      source_date_min: range.min,
      source_date_max: range.max,
      stale_after_days: run.stale_after_days ?? 180,
      input_sha256: run.input_sha256,
      input_posts: run.input_posts,
      answered_posts: run.answered_posts,
      included_posts: counts.included,
      filtered_posts: counts.filtered,
      pending_posts: counts.pending,
      rejected_posts: counts.rejected,
    },
    regions: tables.regions ?? [],
    places: tables.places ?? [],
    place_aliases: tables.place_aliases ?? [],
    place_ambiguities: tables.place_ambiguities ?? [],
    stops: tables.stops ?? [],
    place_stops: tables.place_stops ?? [],
    routes: tables.routes ?? [],
    legs: tables.legs ?? [],
    walk_links: tables.walk_links ?? [],
    fare_reports: tables.fare_reports ?? [],
    hours_reports: tables.hours_reports ?? [],
    shapes: tables.shapes ?? [],
    notes: tables.notes ?? [],
    note_links: tables.note_links ?? [],
    sources: tables.sources ?? [],
    record_sources: tables.record_sources ?? [],
  };
}
