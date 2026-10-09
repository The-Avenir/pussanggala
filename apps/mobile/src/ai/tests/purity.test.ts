/**
 * Purity boundary for apps/mobile/src/ai production sources: no RN/Expo
 * imports, no Node builtins, no network globals. The capability/lifecycle
 * layer must stay platform-pure; Member 4 injects RN adapters through ports.
 * Mirrors the approach of packages/core/test/boundary.test.ts.
 */

import { readdirSync, readFileSync } from "node:fs";
import { builtinModules } from "node:module";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC_DIR = fileURLToPath(new URL("..", import.meta.url));
const SKIP_DIRS = new Set(["tests", "node_modules"]);

const BUILTINS = new Set(builtinModules.flatMap((name) => [name, `node:${name}`]));

const FORBIDDEN_MODULE_RES = [
  /^react(?:-native)?(?:\/|$)/,
  /^@expo(?:\/|$)/,
  /^expo(?:[/-]|$)/,
  /^axios(?:\/|$)/,
  /^undici(?:\/|$)/,
];

const FORBIDDEN_GLOBAL_RES = [/\bfetch\s*\(/, /\bXMLHttpRequest\b/, /\bWebSocket\b/];

const SPECIFIER_RE =
  /(?:\b(?:import|export)\b[^'"]*?\bfrom\s*|(?:\bimport|\brequire)\s*\(\s*|^\s*import\s*)['"]([^'"]+)['"]/gm;

function listProductionSources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      return SKIP_DIRS.has(entry.name) ? [] : listProductionSources(path);
    }
    return entry.isFile() && entry.name.endsWith(".ts") ? [path] : [];
  });
}

describe("apps/mobile/src/ai purity boundary", () => {
  const sources = listProductionSources(SRC_DIR);
  expect(sources.length).toBeGreaterThan(0);

  it("no production file imports RN/Expo/network modules or Node builtins", () => {
    const violations: string[] = [];
    for (const path of sources) {
      const source = readFileSync(path, "utf8");
      for (const match of source.matchAll(SPECIFIER_RE)) {
        const spec = match[1] ?? "";
        if (spec.startsWith(".")) continue;
        if (BUILTINS.has(spec) || BUILTINS.has(spec.split("/")[0] ?? "")) {
          violations.push(`${relative(SRC_DIR, path)}: Node builtin "${spec}"`);
        } else if (FORBIDDEN_MODULE_RES.some((re) => re.test(spec))) {
          violations.push(`${relative(SRC_DIR, path)}: forbidden module "${spec}"`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it("no production file uses network globals", () => {
    const violations: string[] = [];
    for (const path of sources) {
      const source = readFileSync(path, "utf8");
      for (const re of FORBIDDEN_GLOBAL_RES) {
        if (re.test(source)) {
          violations.push(`${relative(SRC_DIR, path)}: matches ${re.source}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it("SafeExplanationUnit is never aliased back to a bare string", () => {
    const violations: string[] = [];
    for (const path of sources) {
      const source = readFileSync(path, "utf8");
      if (/type\s+SafeExplanationUnit\s*=\s*string\b/.test(source)) {
        violations.push(relative(SRC_DIR, path));
      }
    }
    expect(violations).toEqual([]);
  });

  it("only the stream guard mints branded safe units", () => {
    const minters = sources.filter((path) => /\bbrandSafeUnit\s*\(/.test(readFileSync(path, "utf8")));
    expect(minters.map((p) => relative(SRC_DIR, p)).sort()).toEqual([
      "explanation-unit.ts", // the definition itself
      "streaming-guard.ts",
    ]);
  });
});
