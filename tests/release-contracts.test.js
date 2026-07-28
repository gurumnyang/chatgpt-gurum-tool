/* eslint-env node */

const assert = require('node:assert/strict');
const test = require('node:test');

const { readJson, readProjectFile } = require('./helpers/source');

const CHAT_MATCHES = ['https://chat.openai.com/*', 'https://chatgpt.com/*'];
const WEB_RESOURCES = [
  'conversation-snapshot.js',
  'dist/tiktoken.bundle.js',
  'fetch-hook.js',
  'timestamp-injector.js',
  'token-calculator.js',
].sort();
const PERMISSIONS = ['alarms', 'downloads', 'notifications', 'storage', 'webRequest'];

for (const manifestName of ['manifest.json', 'manifest.firefox.json']) {
  test(`${manifestName} keeps the HTTPS, permissions, and WAR contract`, () => {
    const manifest = readJson(manifestName);

    assert.equal(manifest.manifest_version, 3);
    assert.deepEqual(manifest.content_scripts[0].matches, CHAT_MATCHES);
    assert.deepEqual(manifest.web_accessible_resources[0].matches, CHAT_MATCHES);
    assert.deepEqual([...manifest.web_accessible_resources[0].resources].sort(), WEB_RESOURCES);
    assert.deepEqual([...manifest.permissions].sort(), PERMISSIONS);
    assert.deepEqual(manifest.host_permissions, [
      ...CHAT_MATCHES,
      'https://raw.githubusercontent.com/*',
    ]);

    const externallyMatchedUrls = [
      ...manifest.content_scripts.flatMap((entry) => entry.matches),
      ...manifest.web_accessible_resources.flatMap((entry) => entry.matches),
      ...manifest.host_permissions,
    ];
    assert.ok(externallyMatchedUrls.every((pattern) => pattern.startsWith('https://')));
    assert.ok(!externallyMatchedUrls.includes('<all_urls>'));
  });
}

test('browser-specific background entries stay distinct', () => {
  const chromeManifest = readJson('manifest.json');
  const firefoxManifest = readJson('manifest.firefox.json');

  assert.equal(chromeManifest.background.service_worker, 'background.js');
  assert.deepEqual(firefoxManifest.background.scripts, ['background.js']);
  assert.equal(firefoxManifest.browser_specific_settings.gecko.strict_min_version, '128.0');
});

test('package scripts preserve build and release entry points', () => {
  const scripts = readJson('package.json').scripts;

  assert.equal(scripts.test, 'node --test');
  assert.equal(scripts.build, 'webpack --config webpack.config.js');
  assert.equal(scripts['build:release'], 'npm run build && webpack --config webpack.release.js');
  assert.equal(
    scripts['build:firefox'],
    'npm run build && webpack --config webpack.release.firefox.js',
  );
  assert.equal(scripts.release, 'npm run build:release');
  assert.equal(scripts['release:firefox'], 'npm run build:firefox');
  assert.equal(scripts['release:all'], 'npm run release && npm run release:firefox');
});

test('both release packagers include background modules and packaged limits', () => {
  for (const configName of ['webpack.release.js', 'webpack.release.firefox.js']) {
    const source = readProjectFile(configName);
    assert.match(source, /\{\s*from:\s*['"]background['"],\s*to:\s*['"]background['"]\s*\}/);
    assert.match(
      source,
      /\{\s*from:\s*['"]config\/plan-limits\.json['"],\s*to:\s*['"]config\/plan-limits\.json['"]\s*\}/,
    );
    assert.match(
      source,
      /\{\s*from:\s*['"]thirdParty\/turndown\.js['"],\s*to:\s*['"]thirdParty\/turndown\.js['"]\s*\}/,
    );
    assert.doesNotMatch(source, /\{\s*from:\s*['"]thirdParty['"],\s*to:\s*['"]thirdParty['"]\s*\}/);
    assert.match(source, /exclude:\s*\[\/\\\.zip\$\/\]/);
  }
});
