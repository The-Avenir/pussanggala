const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { installModelHash } = require('../plugins/with-model-hash.cjs');

test('native hashing survives prebuild and registers exactly once', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'pusang-model-hash-'));
  try {
    const target = path.join(root, 'app/src/main/java/com/pusanggala/app');
    await fs.mkdir(target, { recursive: true });
    const application = path.join(target, 'MainApplication.kt');
    await fs.writeFile(application, 'PackageList(this).packages.apply {\n}');
    for (let pass = 0; pass < 2; pass++) await installModelHash(path.resolve(__dirname, '..'), root);
    const text = await fs.readFile(application, 'utf8');
    assert.equal(text.match(/add\(PusangModelHashPackage\(\)\)/g).length, 1);
    const module = await fs.readFile(path.join(target, 'PusangModelHashModule.kt'), 'utf8');
    assert.match(module, /MessageDigest.getInstance\("SHA-256"\)/);
  } finally {
    assert.equal(path.dirname(root), os.tmpdir());
    await fs.rm(root, { recursive: true, force: true });
  }
});
