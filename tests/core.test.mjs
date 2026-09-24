import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const project = resolve(import.meta.dirname, '..');
const source = await readFile(resolve(project, 'public/core.js'), 'utf8');
const context = vm.createContext({ URL });
vm.runInContext(source, context);
const core = context.RerouteCore;

test('normalizes one exact source and rejects unsafe inputs', () => {
  assert.deepEqual(
    JSON.parse(JSON.stringify(core.parseSource('HTTPS://Example.COM/learn/?'))),
    { hostname: 'example.com', pathPrefix: '/learn', display: 'example.com/learn', permission: '*://example.com/*', testUrl: 'https://example.com/learn' },
  );
  assert.throws(() => core.parseSource('example.com/learn?q=1'), /query or fragment/);
  assert.throws(() => core.parseSource('https://user:pass@example.com'), /username or password/);
  assert.equal(core.parseSource('http://source.test/learn').testUrl, 'http://source.test/learn');
  assert.equal(core.parseSource('https://BÜCHER.example./learn').hostname, 'xn--bcher-kva.example');
  assert.throws(() => core.parseSource(`https://example.com/${'a'.repeat(core.MAX_URL_LENGTH)}`), /too long/);
  assert.throws(() => core.parseDestination('http://target.test'), /full HTTPS/);
  assert.throws(() => core.parseDestination('javascript:alert(1)'), /HTTP or HTTPS/);
  assert.throws(() => core.parseDestination('https://user:pass@target.test'), /username or password/);
});

test('matches exact host and path segment without broadening scope', () => {
  const sourceRule = core.parseSource('source.test/learn');
  for (const url of ['https://source.test/learn', 'http://source.test/learn/', 'https://source.test/learn/system-design?q=1']) {
    assert.equal(core.matchesSource(url, sourceRule), true, url);
  }
  for (const url of ['https://source.test/', 'https://source.test/learning', 'https://www.source.test/learn', 'https://sub.source.test/learn', 'https://source.test.evil.test/learn']) {
    assert.equal(core.matchesSource(url, sourceRule), false, url);
  }
});

test('prevents loops and makes custom percentage boundaries deterministic', () => {
  assert.throws(() => core.normalizeRule({ source: 'source.test/learn', destination: 'https://source.test/learn/deeper' }), /loop/);
  assert.doesNotThrow(() => core.normalizeRule({ source: 'source.test/learn', destination: 'https://source.test/focus' }));
  const rule = (probability) => core.normalizeRule({ source: 'source.test', destination: 'https://target.test', mode: 'probabilistic', probability });
  assert.equal(rule(undefined).probability, 0.8);
  assert.equal(rule(50).probability, 0.5);
  assert.equal(rule(70).probability, 0.7);
  assert.equal(rule(90).probability, 0.9);
  assert.throws(() => rule(45), /50 to 90/);
  assert.throws(() => rule(95), /50 to 90/);
  assert.throws(() => rule('not-a-number'), /50 to 90/);
  const threshold = Math.floor(0.7 * 0x100000000);
  assert.equal(core.decisionFromUint32(threshold - 1, 0.7), true);
  assert.equal(core.decisionFromUint32(threshold, 0.7), false);
  assert.equal(core.decisionFromUint32(0, 0), false);
  assert.equal(core.decisionFromUint32(0xffffffff, 1), true);
  assert.equal(core.isExpired({ endDate: '2026-09-23' }, new Date('2026-09-23T23:59:59.999').getTime()), false);
  assert.equal(core.isExpired({ endDate: '2026-09-23' }, new Date('2026-09-24T00:00:00.000').getTime()), true);
});

test('accepts only real calendar end dates', () => {
  const rule = (endDate) => ({ source: 'source.test', destination: 'https://target.test', endDate });
  assert.doesNotThrow(() => core.normalizeRule(rule('2024-02-29')));
  for (const endDate of ['2025-02-29', '2026-02-31', '2026-00-10', '9999-99-99', '0000-01-01']) {
    assert.throws(() => core.normalizeRule(rule(endDate)), /valid end date/, endDate);
  }
});

test('extension ships packaged code with no telemetry primitives', async () => {
  const files = await Promise.all(['public/background.js', 'public/content.js', 'src/App.jsx'].map((file) => readFile(resolve(project, file), 'utf8')));
  const code = files.join('\n');
  assert.doesNotMatch(code, /\b(fetch|XMLHttpRequest|sendBeacon|WebSocket|eval|innerHTML)\b/);
  const manifest = JSON.parse(await readFile(resolve(project, 'public/manifest.json'), 'utf8'));
  const packageJson = JSON.parse(await readFile(resolve(project, 'package.json'), 'utf8'));
  assert.equal(manifest.version, packageJson.version);
  assert.deepEqual(manifest.permissions, ['storage', 'scripting']);
  assert.deepEqual(manifest.optional_host_permissions, ['*://*/*']);
  assert.equal(manifest.content_security_policy.extension_pages, "script-src 'self'; object-src 'self'");
  await Promise.all(Object.values(manifest.icons).map((icon) => readFile(resolve(project, 'public', icon))));
});
