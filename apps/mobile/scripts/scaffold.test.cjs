const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { sdkIssues } = require('./android-build.cjs');
const { releaseManifest } = require('../plugins/with-offline-release.cjs');

test('build preflight rejects partial SDKs and accepts required Windows components', () => {
  assert.equal(sdkIssues(undefined).length, 1);
  assert.equal(sdkIssues('sdk', () => false).length, 3);
  const files = new Set(['platforms/android-36/android.jar', 'build-tools/36.0.0', 'platform-tools/adb.exe']
    .map((entry) => path.join('sdk', entry)));
  assert.deepEqual(sdkIssues('sdk', (file) => files.has(file), 'win32'), []);
  files.delete(path.join('sdk', 'platforms/android-36/android.jar'));
  assert.match(sdkIssues('sdk', (file) => files.has(file), 'win32')[0], /android-36/);
});

test('release overlay permits model downloads and retains private storage and disabled updates', () => {
  assert.match(releaseManifest, /android.permission.INTERNET" \/>/);
  assert.doesNotMatch(releaseManifest, /android.permission.INTERNET" tools:node="remove"/);
  assert.match(releaseManifest, /android.permission.ACCESS_NETWORK_STATE" tools:node="remove"/);
  const config = require('../app.json').expo;
  assert.equal(config.android.allowBackup, false);
  assert.equal(config.updates.enabled, false);
});

test('workspace links resolve to the existing core, AI and conversation implementations', () => {
  const appRoot = path.resolve(__dirname, '..');
  const root = path.resolve(appRoot, '../..');
  for (const [name, relative] of [['core', 'packages/core'], ['ai', 'apps/mobile/src/ai'],
    ['conversation', 'apps/mobile/src/conversation']]) {
    const resolved = require.resolve(`@pusang-gala/${name}`, { paths: [appRoot] });
    assert.ok(fs.realpathSync(resolved).startsWith(fs.realpathSync(path.join(root, relative)) + path.sep));
  }
});
