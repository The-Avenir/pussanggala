const { withDangerousMod } = require('expo/config-plugins');
const fs = require('node:fs/promises');
const path = require('node:path');

// Gradle 9.3.1 fails to compile RN 0.86.3's pluginManagement + plugins settings.
// The same settings compile on 9.1.0, including on both JDK 17 and 21.
module.exports = function withGradleVersion(config) {
  return withDangerousMod(config, ['android', async mod => {
    const wrapper = path.join(mod.modRequest.platformProjectRoot, 'gradle/wrapper/gradle-wrapper.properties');
    const properties = await fs.readFile(wrapper, 'utf8');
    await fs.writeFile(wrapper, properties.replace(/^distributionUrl=.*$/m,
      'distributionUrl=https\\://services.gradle.org/distributions/gradle-9.1.0-bin.zip'));
    return mod;
  }]);
};
