const { withDangerousMod } = require('expo/config-plugins');
const fs = require('node:fs/promises');
const path = require('node:path');

// Higher-priority release overlay also removes permissions contributed by libraries.
// Debug keeps local Metro access; it is not the judged offline artifact.
const releaseManifest = `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
          xmlns:tools="http://schemas.android.com/tools">
  <uses-permission android:name="android.permission.INTERNET" tools:node="remove" />
  <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" tools:node="remove" />
  <application android:usesCleartextTraffic="false" tools:replace="android:usesCleartextTraffic" />
</manifest>
`;

module.exports = function withOfflineRelease(config) {
  return withDangerousMod(config, ['android', async (mod) => {
    const target = path.join(mod.modRequest.platformProjectRoot, 'app/src/release');
    await fs.mkdir(target, { recursive: true });
    await fs.writeFile(path.join(target, 'AndroidManifest.xml'), releaseManifest);
    return mod;
  }]);
};
module.exports.releaseManifest = releaseManifest;
