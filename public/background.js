importScripts('core.js');

const RULE_KEY = 'rule';
const PAUSE_KEY = 'pauseUntil';
const METRICS_KEY = 'metrics';
const FOCUS_LOCK_KEY = 'focusLock';
const SCRIPT_ID = 'reroute-source';
const ATTEMPT_TTL_MS = 10 * 60 * 1000;
let decisionQueue = Promise.resolve();
let metricQueue = Promise.resolve();

const attemptKey = (tabId) => `attempt:${tabId}`;
const allowKey = (tabId) => `allow:${tabId}`;
async function localState() {
  return chrome.storage.local.get([RULE_KEY, PAUSE_KEY, METRICS_KEY, FOCUS_LOCK_KEY]);
}

function incrementMetric(name) {
  const work = metricQueue.then(async () => {
    const { metrics = {} } = await chrome.storage.local.get(METRICS_KEY);
    await chrome.storage.local.set({ [METRICS_KEY]: { ...metrics, [name]: (metrics[name] || 0) + 1 } });
  });
  metricQueue = work.catch(() => undefined);
  return work;
}

async function unregisterScript() {
  try {
    await chrome.scripting.unregisterContentScripts({ ids: [SCRIPT_ID] });
  } catch {
    // Registration does not exist yet.
  }
}

async function registerRule(rule) {
  await unregisterScript();
  if (!rule?.enabled) return;
  await chrome.scripting.registerContentScripts([{
    id: SCRIPT_ID,
    matches: [rule.source.permission],
    js: ['content.js'],
    allFrames: false,
    runAt: 'document_start',
    persistAcrossSessions: true,
  }]);
}

function lockedDecision(rule, now) {
  const work = decisionQueue.then(async () => {
    const stored = (await chrome.storage.local.get(FOCUS_LOCK_KEY))[FOCUS_LOCK_KEY];
    if (stored?.ruleId === rule.id && stored.expiresAt > now) return stored.expiresAt;
    if (stored) await chrome.storage.local.remove(FOCUS_LOCK_KEY);

    const random = new Uint32Array(1);
    crypto.getRandomValues(random);
    const intercept = RerouteCore.decisionFromUint32(random[0], rule.probability);
    if (!intercept) return 0;

    const expiresAt = now + RerouteCore.FOCUS_LOCK_MS;
    await chrome.storage.local.set({ [FOCUS_LOCK_KEY]: { ruleId: rule.id, expiresAt } });
    return expiresAt;
  });
  decisionQueue = work.catch(() => undefined);
  return work;
}

async function candidate(message, sender) {
  const tabId = sender.tab?.id;
  if (!Number.isInteger(tabId)) return { intervene: false };

  const now = Date.now();
  const { rule, pauseUntil = 0 } = await localState();
  if (!rule?.enabled || pauseUntil > now || RerouteCore.isExpired(rule, now) || !RerouteCore.matchesSource(message.url, rule.source)) {
    return { intervene: false };
  }

  const key = allowKey(tabId);
  const allowance = (await chrome.storage.session.get(key))[key];
  if (allowance?.expiresAt > now) return { intervene: false };
  if (allowance) await chrome.storage.session.remove(key);

  const lockUntil = rule.mode === 'probabilistic' ? await lockedDecision(rule, now) : 0;
  if (rule.mode === 'probabilistic' && !lockUntil) return { intervene: false };

  await chrome.storage.session.set({
    [attemptKey(tabId)]: {
      url: message.url,
      destination: rule.destination,
      source: rule.source.display,
      lockUntil,
      expiresAt: Math.max(now + ATTEMPT_TTL_MS, lockUntil),
    },
  });
  await incrementMetric('interventions');
  return { intervene: true, url: chrome.runtime.getURL('intervention.html') };
}

async function getAttempt(tabId) {
  const key = attemptKey(tabId);
  const attempt = (await chrome.storage.session.get(key))[key];
  if (!attempt || attempt.expiresAt <= Date.now()) {
    if (attempt) await chrome.storage.session.remove(key);
    return null;
  }
  return attempt;
}

async function handleMessage(message, sender) {
  if (message.type === 'candidate') return candidate(message, sender);

  if (message.type === 'getState') {
    const state = await localState();
    const now = Date.now();
    const lockUntil = state.focusLock?.ruleId === state.rule?.id && state.focusLock.expiresAt > now ? state.focusLock.expiresAt : 0;
    return { ...state, lockUntil, paused: state.pauseUntil > now, expired: RerouteCore.isExpired(state.rule, now) };
  }

  if (message.type === 'saveRule') {
    const rule = RerouteCore.normalizeRule(message.rule);
    const previous = (await chrome.storage.local.get(RULE_KEY))[RULE_KEY];
    await registerRule(rule);
    await chrome.storage.local.set({ [RULE_KEY]: rule, [PAUSE_KEY]: 0 });
    await chrome.storage.session.clear();
    if (previous && previous.source.permission !== rule.source.permission) {
      await chrome.permissions.remove({ origins: [previous.source.permission] });
    }
    return { ok: true, rule };
  }

  if (message.type === 'setEnabled') {
    const { rule } = await chrome.storage.local.get(RULE_KEY);
    if (!rule) return { ok: false };
    rule.enabled = Boolean(message.enabled);
    await registerRule(rule);
    await chrome.storage.local.set({ [RULE_KEY]: rule, [PAUSE_KEY]: 0 });
    await chrome.storage.session.clear();
    return { ok: true };
  }

  if (message.type === 'pause') {
    const until = Date.now() + Math.max(0, Number(message.durationMs) || 0);
    await chrome.storage.local.set({ [PAUSE_KEY]: until });
    await incrementMetric('pauses');
    return { ok: true, pauseUntil: until };
  }

  if (message.type === 'resume') {
    await chrome.storage.local.set({ [PAUSE_KEY]: 0 });
    return { ok: true };
  }

  if (message.type === 'allowTab') {
    const tabId = Number(message.tabId);
    if (!Number.isInteger(tabId)) return { ok: false };
    await chrome.storage.session.set({ [allowKey(tabId)]: { expiresAt: Date.now() + RerouteCore.TAB_ALLOWANCE_MS } });
    await incrementMetric('sourceAllows');
    return { ok: true };
  }

  if (message.type === 'getIntervention') {
    const tabId = sender.tab?.id;
    return { attempt: Number.isInteger(tabId) ? await getAttempt(tabId) : null };
  }

  if (message.type === 'dismissAttempt') {
    const tabId = sender.tab?.id;
    if (Number.isInteger(tabId)) await chrome.storage.session.remove(attemptKey(tabId));
    return { ok: true };
  }

  if (message.type === 'openDestination' || message.type === 'allowAttemptedSource') {
    const tabId = sender.tab?.id;
    const attempt = Number.isInteger(tabId) ? await getAttempt(tabId) : null;
    if (!attempt) return { ok: false, error: 'expired' };
    if (message.type === 'allowAttemptedSource') {
      await chrome.storage.session.set({ [allowKey(tabId)]: { expiresAt: Date.now() + RerouteCore.TAB_ALLOWANCE_MS } });
      await incrementMetric('sourceAllows');
    } else {
      await incrementMetric('destinationOpens');
    }
    await chrome.storage.session.remove(attemptKey(tabId));
    await chrome.tabs.update(tabId, { url: message.type === 'openDestination' ? attempt.destination.url : attempt.url });
    return { ok: true };
  }

  if (message.type === 'deleteRule') {
    const { rule } = await chrome.storage.local.get(RULE_KEY);
    await unregisterScript();
    await chrome.storage.local.remove([RULE_KEY, PAUSE_KEY, FOCUS_LOCK_KEY]);
    await chrome.storage.session.clear();
    if (rule) await chrome.permissions.remove({ origins: [rule.source.permission] });
    return { ok: true, deleted: rule || null };
  }

  return { ok: false };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender).then(sendResponse).catch((error) => sendResponse({ ok: false, error: error.message }));
  return true;
});

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  if (reason === 'install') await chrome.runtime.openOptionsPage();
});

chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.session.remove([attemptKey(tabId), allowKey(tabId)]);
});

chrome.permissions.onRemoved.addListener(async ({ origins = [] }) => {
  const { rule } = await chrome.storage.local.get(RULE_KEY);
  if (rule?.enabled && origins.length && !(await chrome.permissions.contains({ origins: [rule.source.permission] }))) {
    rule.enabled = false;
    await unregisterScript();
    await chrome.storage.local.set({ [RULE_KEY]: rule });
    await chrome.storage.local.remove(FOCUS_LOCK_KEY);
    await chrome.storage.session.clear();
  }
});
