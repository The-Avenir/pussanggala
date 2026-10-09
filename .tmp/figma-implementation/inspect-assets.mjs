import fs from 'node:fs';
const values = new Set();
const dir = 'apps/mobile/assets/figma';
for (const file of fs.readdirSync(dir)) {
  for (const match of fs.readFileSync(`${dir}/${file}`, 'utf8').matchAll(/(?:fill|stroke)="([^"]+)"/g)) values.add(match[1]);
}
console.log([...values].filter(value => value.startsWith('var(')));
