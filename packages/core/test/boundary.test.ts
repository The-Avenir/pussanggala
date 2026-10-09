import { readdirSync, readFileSync } from "node:fs";
import { builtinModules } from "node:module";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC_DIR = fileURLToPath(new URL("../src", import.meta.url));

const BUILTINS = new Set(
  builtinModules.flatMap((name) => [name, `node:${name}`]),
);

const SPECIFIER_RE =
  /(?:\b(?:import|export)\b[^'"]*?\bfrom\s*|(?:\bimport|\brequire)\s*\(\s*|^\s*import\s*)['"]([^'"]+)['"]/gm;

const FORBIDDEN_MODULE_RES = [
  /^react(?:-native)?(?:\/|$)/,
  /^@expo\//,
  /^expo(?:[/-]|$)/,
  /^axios(?:\/|$)/,
  /^undici(?:\/|$)/,
];

const FORBIDDEN_GLOBAL_RES = [
  /\bfetch\s*\(/,
  /\bXMLHttpRequest\b/,
  /\bWebSocket\b/,
];

function isForbiddenSpecifier(spec: string): boolean {
  if (BUILTINS.has(spec) || BUILTINS.has(spec.split("/")[0] ?? "")) {
    return true;
  }
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
    if (re.test(source)) {
      violations.push(`${fileName}: forbidden global matching ${re.source}`);
    }
  }
  return violations;
}

function listTsFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      return listTsFiles(path);
    }
    return entry.isFile() && entry.name.endsWith(".ts") ? [path] : [];
  });
}

describe("packages/core purity boundary", () => {
  it("no src file imports RN/native/network modules or uses network globals", () => {
    const violations = listTsFiles(SRC_DIR).flatMap((path) =>
      findViolations(readFileSync(path, "utf8"), relative(SRC_DIR, path)),
    );
    expect(violations).toEqual([]);
  });

  it("the checker itself detects an offending sample", () => {
    const sample = [
      'import fs from "node:fs";',
      'import path from "path";',
      'import { View } from "react-native";',
      'import * as ExpoLocation from "expo-location";',
      'const axios = require("axios");',
      'const mod = await import("undici");',
      'const data = await fetch("https://example.com");',
      "const ws = new WebSocket(url);",
      "const xhr = new XMLHttpRequest();",
    ].join("\n");
    expect(findViolations(sample, "sample.ts").length).toBeGreaterThanOrEqual(9);
  });
});
