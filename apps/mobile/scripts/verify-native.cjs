const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const appRoot = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(appRoot, 'android', file), 'utf8');
const main = read('app/src/main/AndroidManifest.xml');
const release = read('app/src/release/AndroidManifest.xml');
const properties = read('gradle.properties');
assert.match(main, /android:allowBackup="false"/);
assert.match(main, /android:usesCleartextTraffic="false"/);
assert.doesNotMatch(main, /libOpenCL\.so|libcdsprpc\.so/);
for (const permission of ['INTERNET', 'ACCESS_NETWORK_STATE']) {
  assert.match(release, new RegExp(`android.permission.${permission}" tools:node="remove"`));
}
for (const permission of ['ACCESS_BACKGROUND_LOCATION', 'RECORD_AUDIO']) {
  assert.match(main, new RegExp(`android.permission.${permission}" tools:node="remove"`));
}
assert.match(properties, /newArchEnabled=true/);
assert.match(properties, /reactNativeArchitectures=arm64-v8a,x86_64/);
console.log('Generated Android project: offline release overlay, private storage, foreground-only permissions, New Architecture and ABIs verified.');
console.log(read('gradle/wrapper/gradle-wrapper.properties').trim());
