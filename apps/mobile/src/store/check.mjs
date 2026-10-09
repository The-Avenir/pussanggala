// Dedicated T44 check until T01/T45 register the mobile checks in shared CI.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const commands = [
  ['node_modules/typescript/bin/tsc', '-p', 'apps/mobile/src/store/tsconfig.json'],
  ['node_modules/vitest/vitest.mjs', 'run', 'apps/mobile/src/store/test/sqliteTripStore.test.ts'],
];
for (const args of commands) {
  console.log(`T44 check: node ${args.join(' ')}`);
  const result = spawnSync(process.execPath, args, { cwd: root, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
