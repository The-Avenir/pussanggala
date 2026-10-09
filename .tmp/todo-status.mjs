import fs from "node:fs";
const p = "docs/TODO.md";
let s = fs.readFileSync(p, "utf8");
const url = (n) => `[#${n}](https://github.com/The-Avenir/pussanggala/pull/${n})`;
const lineRe = (t) => new RegExp(String.raw`- \[ \] (\*\*${t} — [^\n]*?)(\r?\n)`);
const done = { T20: 4, T21: 5, T22: 6, T23: 7, T24: 8, T25: 12 };
for (const [t, n] of Object.entries(done)) {
  if (!lineRe(t).test(s)) throw new Error(t);
  s = s.replace(lineRe(t), (_, body, nl) => `- [x] ${body} **Status:** merged in ${url(n)}.${nl}`);
}
const notes = {
  T00: ` **Status:** in progress — names and contracts v1 merged in ${url(3)}; corpus reviewer and reference/fallback phones TBD.`,
  T26: ` **Status:** in progress — synthetic evaluation suite (52 route + 59 negative cases) merged in ${url(13)}; ≥30 source-backed cases on the real pack pending T16.`,
};
for (const [t, note] of Object.entries(notes)) {
  if (!lineRe(t).test(s)) throw new Error(t);
  s = s.replace(lineRe(t), (_, body, nl) => `- [ ] ${body}${note}${nl}`);
}
fs.writeFileSync(p, s);
