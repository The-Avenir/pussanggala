const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const appRoot = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(appRoot, 'android', file), 'utf8');
const main = read('app/src/main/AndroidManifest.xml');
const release = read('app/src/release/AndroidManifest.xml');
const properties = read('gradle.properties');
const wrapperProperties = read('gradle/wrapper/gradle-wrapper.properties');
assert.match(wrapperProperties, /gradle-9\.1\.0-bin\.zip/);
assert.match(main, /android:allowBackup="false"/);
assert.match(main, /android:usesCleartextTraffic="false"/);
assert.doesNotMatch(main, /libOpenCL\.so|libcdsprpc\.so/);
assert.match(release, /android.permission.INTERNET" \/>/);
assert.doesNotMatch(release, /android.permission.INTERNET" tools:node="remove"/);
assert.match(release, /android.permission.ACCESS_NETWORK_STATE" tools:node="remove"/);
for (const permission of ['ACCESS_BACKGROUND_LOCATION', 'RECORD_AUDIO']) {
  assert.match(main, new RegExp(`android.permission.${permission}" tools:node="remove"`));
}
assert.match(properties, /newArchEnabled=true/);
assert.match(properties, /reactNativeArchitectures=arm64-v8a,x86_64/);
console.log('Generated Android project: model-download permission, private storage, foreground-only permissions, New Architecture and ABIs verified.');
console.log(wrapperProperties.trim());
