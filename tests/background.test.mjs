import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const project = resolve(import.meta.dirname, '..');
const source = await readFile(resolve(project, 'public/background.js'), 'utf8');

function area(initial = {}) {
  const values = { ...initial };
  return {
    values,
    async get(keys) {
      const names = typeof keys === 'string' ? [keys] : keys;
      return Object.fromEntries(names.filter((key) => key in values).map((key) => [key, values[key]]));
    },
    async set(next) { Object.assign(values, next); },
    async remove(keys) { for (const key of typeof keys === 'string' ? [keys] : keys) delete values[key]; },
    async clear() { for (const key of Object.keys(values)) delete values[key]; },
  };
}

function background({ draws = [0], initialLocal = {}, initialSession = {} } = {}) {
  const local = area(initialLocal);
  const session = area(initialSession);
  let drawIndex = 0;
  let onMessage;
  const event = { addListener() {} };
  const chrome = {
    storage: { local, session },
    scripting: { unregisterContentScripts: async () => {}, registerContentScripts: async () => {} },
    permissions: { remove: async () => true, contains: async () => true, onRemoved: event },
    runtime: {
      getURL: (path) => `chrome-extension://test/${path}`,
      openOptionsPage: async () => {},
      onInstalled: event,
      onMessage: { addListener(listener) { onMessage = listener; } },
    },
    tabs: { update: async () => {}, onRemoved: event },
  };
  const testCrypto = {
    getRandomValues(values) {
      values[0] = draws[drawIndex++] ?? 0;
      return values;
    },
  };
  const context = vm.createContext({ chrome, crypto: testCrypto, setTimeout, clearTimeout });
  context.importScripts = () => {
    context.RerouteCore = {
      FOCUS_LOCK_MS: 15 * 60 * 1000,
      decisionFromUint32: (value, probability) => value < Math.floor(probability * 0x100000000),
      isExpired: () => false,
      matchesSource: () => true,
      normalizeRule: (rule) => rule,
    };
  };
  vm.runInContext(source, context);
  const send = (message, tabId = 1) => new Promise((resolveResponse) => onMessage(message, { tab: { id: tabId } }, resolveResponse));
  return { drawCount: () => drawIndex, local, send, session };
}

test('serializes concurrent metric increments and dismisses attempted URLs', async () => {
  const runtime = background();
  await Promise.all([
    runtime.send({ type: 'pause', durationMs: 1000 }),
    runtime.send({ type: 'pause', durationMs: 1000 }),
  ]);
  assert.equal(runtime.local.values.metrics.pauses, 2);

  runtime.session.values['attempt:7'] = { url: 'https://source.test/private?q=1' };
  assert.equal((await runtime.send({ type: 'dismissAttempt' }, 7)).ok, true);
  assert.equal(runtime.session.values['attempt:7'], undefined);
});

test('rerolls misses, then persists only a positive focus lock across tabs and worker restarts', async () => {
  const rule = {
    id: 'primary',
    enabled: true,
    mode: 'probabilistic',
    probability: 0.8,
    source: { display: 'source.test' },
    destination: { url: 'https://target.test', display: 'target.test' },
  };
  const runtime = background({ draws: [0xffffffff, 0] });
  runtime.local.values.rule = rule;

  assert.equal((await runtime.send({ type: 'candidate', url: 'https://source.test' }, 1)).intervene, false);
  assert.equal(runtime.local.values.focusLock, undefined);
  assert.equal((await runtime.send({ type: 'candidate', url: 'https://source.test' }, 2)).intervene, true);
  assert.ok(runtime.local.values.focusLock.expiresAt > Date.now());
  assert.equal((await runtime.send({ type: 'candidate', url: 'https://source.test' }, 3)).intervene, true);
  assert.equal(runtime.drawCount(), 2);

  const restarted = background({ draws: [0xffffffff], initialLocal: runtime.local.values });
  assert.equal((await restarted.send({ type: 'candidate', url: 'https://source.test' }, 4)).intervene, true);
  assert.equal(restarted.drawCount(), 0);
});
