/**
 * T32 — Guardrail checks (INV-3, INV-6).
 *
 * Done criterion "no persistence path exists": production sources in `src/`
 * must not import storage/network/native modules, must not use network
 * globals, and the manager must not expose a persistence/serialization API.
 * The exchange window is memory-only by construction; Member 4's T44
 * persistence stores stable IDs only and is built separately.
 */
import { readdirSync, readFileSync } from "node:fs";
import { builtinModules } from "node:module";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { TripConversationManager } from "../src/conversationManager";

const SRC = fileURLToPath(new URL("../src/", import.meta.url));

const BUILTINS = new Set(builtinModules.flatMap((name) => [name, `node:${name}`]));

const SPECIFIER_RE =
  /(?:\b(?:import|export)\b[^'"]*?\bfrom\s*|(?:\bimport|\brequire)\s*\(\s*|^\s*import\s*)['"]([^'"]+)['"]/gm;

const FORBIDDEN_MODULE_RES = [
  /^react(?:-native)?(?:\/|$)/,
  /^@expo\//,
  /^expo(?:[/-]|$)/,
  /^axios(?:\/|$)/,
  /^undici(?:\/|$)/,
  /^@react-native-async-storage\//,
  /^expo-sqlite(?:\/|$)/,
];

const FORBIDDEN_GLOBAL_RES = [
  /\bfetch\s*\(/,
  /\bXMLHttpRequest\b/,
  /\bWebSocket\b/,
  /\bAsyncStorage\b/,
  /\blocalStorage\b/,
  /\bwriteFile\b/,
  /\bopenDatabase\b/,
];

function isForbiddenSpecifier(spec: string): boolean {
  if (BUILTINS.has(spec) || BUILTINS.has(spec.split("/")[0] ?? "")) return true;
  return FORBIDDEN_MODULE_RES.some((re) => re.test(spec));
}

function findViolations(source: string, fileName: string): string[] {
  const violations: string[] = [];
  for (const match of source.matchAll(SPECIFIER_RE)) {
    const spec = match[1] ?? "";
    if (isForbiddenSpecifier(spec)) {
      violations.push(`${fileName}: forbidden module specifier "${spec}"`);
    }
  }
  for (const re of FORBIDDEN_GLOBAL_RES) {
    if (re.test(source)) violations.push(`${fileName}: forbidden global matching ${re.source}`);
  }
  return violations;
}

function listProductionSources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return listProductionSources(path);
    const isTs = entry.isFile() && entry.name.endsWith(".ts");
    const isTest = entry.name.endsWith(".test.ts");
    return isTs && !isTest ? [path] : [];
  });
}

describe("conversation purity boundary", () => {
  it("no production source imports storage/native/network modules or uses their globals", () => {
    const sources = listProductionSources(SRC);
    expect(sources.length).toBeGreaterThan(0);
    const violations = sources.flatMap((path) =>
      findViolations(readFileSync(path, "utf8"), relative(SRC, path)),
    );
    expect(violations).toEqual([]);
  });

  it("the checker itself detects an offending sample", () => {
    const sample = [
      'import { readFileSync } from "node:fs";',
      'import AsyncStorage from "@react-native-async-storage/async-storage";',
      'import * as SQLite from "expo-sqlite";',
      'const data = await fetch("https://example.com");',
      "const ws = new WebSocket(url);",
    ].join("\n");
    expect(findViolations(sample, "sample.ts").length).toBeGreaterThanOrEqual(5);
  });

  it("production sources only depend on core", () => {
    const specifiers = new Set<string>();
    for (const path of listProductionSources(SRC)) {
      for (const match of readFileSync(path, "utf8").matchAll(SPECIFIER_RE)) {
        const spec = match[1] ?? "";
        if (!spec.startsWith(".")) specifiers.add(spec);
      }
    }
    expect([...specifiers]).toEqual(["@pusang-gala/core"]);
  });

  it("the manager exposes no persistence/serialization API", () => {
    const names = Object.getOwnPropertyNames(TripConversationManager.prototype);
    const persistenceLike = names.filter((name) =>
      /persist|save|serialize|hydrate|restore|load|store|write|dump/i.test(name),
    );
    expect(persistenceLike).toEqual([]);
  });
});
