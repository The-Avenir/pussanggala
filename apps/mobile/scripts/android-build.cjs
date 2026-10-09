const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');

const appRoot = path.resolve(__dirname, '..');

function sdkIssues(sdkRoot, exists = fs.existsSync, platform = process.platform) {
  if (!sdkRoot) return ['Set ANDROID_HOME to an installed Android SDK (no SDK configured).'];
  const required = ['platforms/android-36/android.jar', 'build-tools/36.0.0',
    `platform-tools/adb${platform === 'win32' ? '.exe' : ''}`];
  return required.filter((entry) => !exists(path.join(sdkRoot, entry)))
    .map((entry) => `Missing Android SDK component: ${path.join(sdkRoot, entry)}`);
}

function build(mode) {
  if (!['tooling', 'development', 'release'].includes(mode)) {
    console.error('Usage: node scripts/android-build.cjs tooling|development|release');
    return 2;
  }
  const sdkRoot = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
  const java = process.env.JAVA_HOME
    ? path.join(process.env.JAVA_HOME, 'bin', process.platform === 'win32' ? 'java.exe' : 'java')
    : 'java';
  const javaResult = spawnSync(java, ['-version'], { encoding: 'utf8' });
  const javaOutput = `${javaResult.stdout || ''}${javaResult.stderr || ''}`.trim();
  console.log(`Node: ${process.version}\nJava: ${javaOutput || javaResult.error?.message}\nAndroid SDK: ${sdkRoot || 'not configured'}`);
  const issues = sdkIssues(sdkRoot);
  if (javaResult.status !== 0 || !/version "17[.\"]/.test(javaOutput)) {
    issues.push('Set JAVA_HOME to JDK 17 for this pinned Android build.');
  }
  const androidRoot = path.join(appRoot, 'android');
  const wrapper = path.join(androidRoot, process.platform === 'win32' ? 'gradlew.bat' : 'gradlew');
  if (mode !== 'tooling' && !fs.existsSync(wrapper)) issues.push('Run npm run android:prebuild at the repository root first.');
  if (issues.length) {
    issues.forEach((issue) => console.error(issue));
    console.error('No compilation or APK evidence produced.');
    return 1;
  }
  if (mode === 'tooling') return 0;
  const verified = spawnSync(process.execPath, [path.join(__dirname, 'verify-native.cjs')], { stdio: 'inherit' });
  if (verified.status !== 0) return verified.status || 1;
  const task = mode === 'development' ? ':app:assembleDebug' : ':app:assembleRelease';
  console.log(`Gradle task: ${task}`);
  const result = spawnSync(wrapper, [task, '--no-daemon', '--console=plain'], {
    cwd: androidRoot, stdio: 'inherit', shell: process.platform === 'win32',
    env: { ...process.env, EXPO_NO_TELEMETRY: '1', CI: '1' },
  });
  if (result.error) console.error(result.error.message);
  if (result.status !== 0) return result.status || 1;
  if (mode === 'release') {
    const manifestCandidates = [
      'app/build/intermediates/merged_manifests/release/processReleaseManifest/AndroidManifest.xml',
      'app/build/intermediates/merged_manifest/release/processReleaseMainManifest/AndroidManifest.xml',
    ].map((entry) => path.join(androidRoot, entry));
    const mergedManifest = manifestCandidates.find((file) => fs.existsSync(file));
    if (!mergedManifest) throw new Error('Release compiled but merged-manifest permission evidence could not be located.');
    const xml = fs.readFileSync(mergedManifest, 'utf8');
    for (const permission of ['INTERNET', 'ACCESS_NETWORK_STATE', 'ACCESS_BACKGROUND_LOCATION', 'RECORD_AUDIO']) {
      if (xml.includes(`android.permission.${permission}`)) {
        throw new Error(`Release permission audit failed: ${permission}`);
      }
    }
    console.log(`Release merged manifest permission audit passed: ${mergedManifest}`);
  }
  const variant = mode === 'development' ? 'debug' : 'release';
  const apkRoot = path.join(androidRoot, 'app/build/outputs/apk', variant);
  const apks = fs.readdirSync(apkRoot).filter((name) => name.endsWith('.apk'));
  if (!apks.length) throw new Error(`Gradle succeeded but no APK found in ${apkRoot}`);
  for (const name of apks) {
    const file = path.join(apkRoot, name);
    console.log(JSON.stringify({ apk: file, bytes: fs.statSync(file).size,
      sha256: createHash('sha256').update(fs.readFileSync(file)).digest('hex') }));
  }
  console.log('Compilation is not phone/offline/performance evidence. Release uses the generated local debug signing key; replace for distribution in T47.');
  return 0;
}

module.exports = { sdkIssues };
if (require.main === module) process.exitCode = build(process.argv[2]);
