// Offline check: walk spec/screens.json against the renderer's node vocabulary.
// Usage: node check-spec.mjs   (exit 1 on violations)

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const spec = JSON.parse(readFileSync(join(here, 'spec', 'screens.json'), 'utf8'));
const tokens = JSON.parse(readFileSync(join(here, 'spec', 'tokens.json'), 'utf8'));

const KNOWN_TYPES = new Set(['frame', 'text', 'instance', 'icon', 'gaile', 'pill', 'chip', 'spacer']);
const KNOWN_INSTANCES = new Set(['Pusang Gala/Button', 'Pusang Gala/Settings row']);
const POSES = new Set(['compass', 'wave', 'think', 'pointing', 'map', 'walk', 'cheer', 'binoculars', 'idle']);
const COLORS = new Set(Object.keys(tokens.colors));
const STYLES = new Set(Object.keys(tokens.textStyles));

const violations = [];
const iconNames = new Set();
const bad = (where, msg) => violations.push(`${where}: ${msg}`);

function checkColor(where, c, what) {
  if (c !== undefined && c !== 'none' && !COLORS.has(c)) bad(where, `${what} color "${c}" not in tokens`);
}

function walk(node, where) {
  if (!node || typeof node !== 'object') { bad(where, 'non-object node'); return; }
  if (!KNOWN_TYPES.has(node.type)) { bad(where, `unknown type "${node.type}"`); return; }
  switch (node.type) {
    case 'frame':
      checkColor(where, node.fill, 'fill');
      if (node.stroke) checkColor(where, node.stroke.color, 'stroke');
      for (const c of node.children || []) walk(c, where);
      break;
    case 'text':
      if (!node.chars || !node.chars.trim()) bad(where, 'empty chars');
      if (!STYLES.has(node.style)) bad(where, `unknown text style "${node.style}"`);
      checkColor(where, node.color, 'text');
      break;
    case 'instance':
      if (!KNOWN_INSTANCES.has(node.component)) bad(where, `instance of "${node.component}"`);
      break;
    case 'icon':
      if (!node.name || !/^[a-z][a-z0-9-]*$/.test(node.name)) bad(where, `bad icon name "${node.name}"`);
      iconNames.add(node.name);
      break;
    case 'gaile':
      if (!POSES.has(node.pose)) bad(where, `unknown pose "${node.pose}"`);
      break;
    case 'pill':
    case 'chip':
      if (!node.chars || !node.chars.trim()) bad(where, 'empty chars');
      checkColor(where, node.fill, 'fill');
      checkColor(where, node.color, 'text');
      checkColor(where, node.stroke, 'stroke');
      break;
    case 'spacer':
      if (typeof node.h !== 'number') bad(where, 'spacer without numeric h');
      break;
  }
}

for (const s of spec.screens) {
  if (!s.id || !s.label || !s.subtitle) bad(s.id || '?', 'missing id/label/subtitle');
  for (const n of s.content || []) walk(n, s.id);
  if (s.bottomActionNode) walk(s.bottomActionNode, `${s.id}.bottomAction`);
}

console.log(`screens: ${spec.screens.length}`);
console.log(`icon names used: ${[...iconNames].sort().join(', ')}`);

// If an inventory has been captured, cross-check icons/components/styles/vars
// against what actually exists in the file.
const invPath = join(here, 'inventory.json');
if (existsSync(invPath)) {
  const inv = JSON.parse(readFileSync(invPath, 'utf8'));
  const compNames = new Set(inv.components.map((c) => c.name));
  for (const i of iconNames) {
    if (![...compNames].some((n) => n === `Pusang Gala/Icon/${i}` || (n === 'Pusang Gala/Icon')))
      bad('inventory', `no component found for icon "${i}"`);
  }
  for (const c of KNOWN_INSTANCES) if (!compNames.has(c)) bad('inventory', `component "${c}" missing`);
  for (const v of Object.values(tokens.variableNames))
    if (!inv.variables.some((x) => x.name === v)) bad('inventory', `variable "${v}" missing`);
  for (const s of Object.values(tokens.figmaTextStyleNames))
    if (!inv.textStyles.some((x) => x.name === s)) bad('inventory', `text style "${s}" missing`);
} else {
  console.log('inventory.json not present — component/variable/style existence not yet checked');
}

if (violations.length) {
  console.log('VIOLATIONS:');
  for (const v of violations) console.log('  ' + v);
  process.exit(1);
}
console.log('no violations');
