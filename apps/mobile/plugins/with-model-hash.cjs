const { withDangerousMod } = require('expo/config-plugins');
const fs = require('node:fs/promises');
const path = require('node:path');

async function installModelHash(projectRoot, platformRoot) {
  const source = path.join(projectRoot, 'native');
  const target = path.join(platformRoot, 'app/src/main/java/com/pusanggala/app');
  await fs.mkdir(target, { recursive: true });
  for (const name of ['PusangModelHashModule.kt', 'PusangModelHashPackage.kt']) {
    await fs.copyFile(path.join(source, name), path.join(target, name));
  }
  const application = path.join(target, 'MainApplication.kt');
  const text = await fs.readFile(application, 'utf8');
  if (!text.includes('add(PusangModelHashPackage())')) {
    const marker = 'PackageList(this).packages.apply {';
    if (!text.includes(marker)) throw new Error('Unable to register native model hashing in MainApplication.');
    await fs.writeFile(application, text.replace(marker, marker + '\n          add(PusangModelHashPackage())'));
  }
}
module.exports = config => withDangerousMod(config, ['android', async mod => {
  await installModelHash(mod.modRequest.projectRoot, mod.modRequest.platformProjectRoot);
  return mod;
}]);
module.exports.installModelHash = installModelHash;
