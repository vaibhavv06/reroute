import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  CircleCheck,
  Download,
  ExternalLink,
  LockKeyhole,
  Pause,
  Play,
  Power,
  Settings2,
  ShieldCheck,
  Sprout,
  TimerReset,
  Trash2,
} from 'lucide-react';

const core = globalThis.RerouteCore;
const view = document.body.dataset.view || 'options';
const demo = document.body.dataset.demo === 'true';
const extension = Boolean(globalThis.chrome?.runtime?.id);

const DEMO_FORM = {
  source: 'reddit.com/r/all',
  destination: 'https://leetcode.com/problemset',
  endDate: '2026-10-31',
  mode: 'deterministic',
  probability: 80,
  enabled: true,
};

async function call(message) {
  if (!extension) return { ok: true };
  const response = await chrome.runtime.sendMessage(message);
  if (response?.error && response.ok === false) throw new Error(response.error);
  return response;
}

function formFromRule(rule) {
  if (!rule) return { source: '', destination: '', endDate: '', mode: 'deterministic', probability: 80, enabled: true };
  return {
    source: rule.source.testUrl || rule.source.display,
    destination: rule.destination.url,
    endDate: rule.endDate || '',
    mode: rule.mode || 'deterministic',
    probability: Math.min(90, Math.max(50, Math.round((rule.probability ?? 0.8) * 100))),
    enabled: rule.enabled !== false,
  };
}

function formatRemaining(expiresAt, now = Date.now()) {
  const seconds = Math.max(0, Math.ceil((expiresAt - now) / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function Brand({ compact = false }) {
  return (
    <div className={`brand${compact ? ' brand--compact' : ''}`} aria-label="Reroute">
      <Sprout aria-hidden="true" />
      <span>Reroute</span>
    </div>
  );
}

function OptionsPage() {
  const [form, setForm] = useState(demo ? DEMO_FORM : formFromRule());
  const [savedRule, setSavedRule] = useState(null);
  const [deletedRule, setDeletedRule] = useState(null);
  const [metrics, setMetrics] = useState({});
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!extension) return;
    call({ type: 'getState' }).then((state) => {
      setSavedRule(state.rule || null);
      setMetrics(state.metrics || {});
      setForm(formFromRule(state.rule));
    }).catch((reason) => setError(reason.message));
  }, []);

  const preview = useMemo(() => {
    try {
      return core.normalizeRule(form);
    } catch {
      return null;
    }
  }, [form]);

  const set = (key) => (event) => {
    setForm((current) => ({ ...current, [key]: event.target.value }));
    setError('');
    setStatus('');
  };

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setStatus('');
    try {
      const nextForm = { ...form, enabled: true };
      const rule = core.normalizeRule(nextForm);
      if (extension) {
        const granted = await chrome.permissions.request({ origins: [rule.source.permission] });
        if (!granted) throw new Error(`Reroute needs access to ${rule.source.hostname} to run this rule.`);
        await call({ type: 'saveRule', rule: nextForm });
        await chrome.tabs.create({ url: rule.source.testUrl });
      }
      setForm(nextForm);
      setSavedRule(rule);
      setDeletedRule(null);
      setStatus('Rule saved. The test opens in a new tab.');
    } catch (reason) {
      setError(reason.message);
    } finally {
      setBusy(false);
    }
  }

  function testDestination() {
    try {
      const destination = core.parseDestination(form.destination);
      window.open(destination.url, '_blank', 'noopener,noreferrer');
    } catch (reason) {
      setError(reason.message);
    }
  }

  function reset() {
    setForm(formFromRule(savedRule));
    setError('');
    setStatus('Changes discarded.');
  }

  async function removeRule() {
    if (!savedRule || !window.confirm('Delete this rule and remove its site access?')) return;
    try {
      await call({ type: 'deleteRule' });
      setDeletedRule(savedRule);
      setSavedRule(null);
      setForm(formFromRule());
      setStatus('Rule deleted. Site access was removed.');
    } catch (reason) {
      setError(reason.message);
    }
  }

  async function undoDelete() {
    if (!deletedRule) return;
    try {
      const restored = formFromRule(deletedRule);
      if (extension) {
        const granted = await chrome.permissions.request({ origins: [deletedRule.source.permission] });
        if (!granted) throw new Error(`Reroute needs access to ${deletedRule.source.hostname} to restore this rule.`);
        await call({ type: 'saveRule', rule: restored });
      }
      setSavedRule(deletedRule);
      setForm(restored);
      setDeletedRule(null);
      setStatus('Rule restored.');
    } catch (reason) {
      setError(reason.message);
    }
  }

  function exportReport() {
    const report = {
      schema: 1,
      exportedAt: new Date().toISOString(),
      mode: preview?.mode || form.mode,
      probabilityPercent: (preview?.mode || form.mode) === 'deterministic' ? 100 : Math.round((preview?.probability ?? 0.8) * 100),
      counts: metrics,
    };
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }));
    link.download = 'reroute-alpha-report.json';
    link.click();
    URL.revokeObjectURL(link.href);
  }

  const sourceHost = preview?.source.hostname || 'the source site';

  return (
    <main className="options-shell">
      <section className="story-panel" aria-labelledby="story-heading">
        <Brand />
        <div className="story-copy">
          <h1 id="story-heading">Make one<br />helpful detour</h1>
          <p>Set a route now. Future you stays in control.</p>
          <span className="orange-rule" aria-hidden="true" />
          <p className="handwritten">A calmer internet<br />can lead to a brighter you.</p>
        </div>
        <img className="botanical" src="/botanical.png" alt="" />
        <p className="story-footnote">Same internet.<br />A more intentional you.</p>
      </section>

      <section className="form-panel" aria-label="Create a reroute rule">
        <form onSubmit={save} noValidate>
          <div className="field-group">
            <label htmlFor="source">Site to reroute</label>
            <input
              id="source"
              name="source"
              value={form.source}
              onChange={set('source')}
              placeholder="reddit.com/r/all"
              autoCapitalize="none"
              spellCheck="false"
              required
            />
            <p className="helper">
              {!preview
                ? 'Enter one exact site, with an optional path'
                : preview.source.pathPrefix !== '/'
                  ? `Matches this path and anything below it on ${preview.source.hostname}`
                  : `Matches only ${sourceHost}; www and subdomains stay separate`}
            </p>
          </div>

          <div className="field-group destination-group">
            <label htmlFor="destination">Chosen destination</label>
            <input
              id="destination"
              name="destination"
              type="url"
              value={form.destination}
              onChange={set('destination')}
              placeholder="https://leetcode.com/problemset"
              autoCapitalize="none"
              spellCheck="false"
              required
            />
            <button className="outline-button test-button" type="button" onClick={testDestination}>
              Open destination to test <ExternalLink size={17} aria-hidden="true" />
            </button>
          </div>

          <div className="field-group date-group">
            <label htmlFor="end-date">Keep active until <span>(optional)</span></label>
            <input id="end-date" name="endDate" type="date" value={form.endDate} onChange={set('endDate')} />
          </div>

          <div className="trust-notes" aria-label="Privacy and access notes">
            <p><ShieldCheck aria-hidden="true" /> Access is requested only for {sourceHost}.</p>
            <p><LockKeyhole aria-hidden="true" /> Your rule, focus-lock expiry, and aggregate research counts stay on this device. Reroute sends no telemetry. Websites still receive normal requests when you visit them.</p>
          </div>

          <div className={`route-summary${preview ? '' : ' route-summary--empty'}`} aria-live="polite">
            <CircleCheck aria-hidden="true" />
            <strong>{preview ? preview.source.display : 'Add a valid source'}</strong>
            <ArrowRight aria-hidden="true" />
            <strong>{preview ? preview.destination.display : 'and destination'}</strong>
          </div>

          {error && <p className="message message--error" role="alert">{error}</p>}
          {status && (
            <div className="message message--success" role="status">
              {status}
              {deletedRule && <button className="undo-button" type="button" onClick={undoDelete}>Undo deletion</button>}
            </div>
          )}

          <div className="form-actions">
            <button className="primary-button" type="submit" disabled={busy}>
              {busy ? 'Saving…' : 'Save and test rule'}
            </button>
            <button className="text-button" type="button" onClick={reset}>Cancel</button>
          </div>

          <details className="advanced">
            <summary>Advanced alpha controls</summary>
            <div className="advanced-content">
              <fieldset>
                <legend>Intervention frequency</legend>
                <label><input type="radio" name="mode" value="deterministic" checked={form.mode === 'deterministic'} onChange={set('mode')} /> Every matching visit</label>
                <label><input type="radio" name="mode" value="probabilistic" checked={form.mode === 'probabilistic'} onChange={set('mode')} /> Custom percentage</label>
                {form.mode === 'probabilistic' && (
                  <div className="frequency-slider">
                    <label className="frequency-slider__heading" htmlFor="probability">
                      <span>Chance of a detour</span>
                      <output htmlFor="probability">{form.probability}%</output>
                    </label>
                    <input
                      id="probability"
                      name="probability"
                      type="range"
                      min="50"
                      max="90"
                      step="5"
                      value={form.probability}
                      onChange={set('probability')}
                      aria-describedby="probability-help"
                      aria-valuetext={`${form.probability}% chance`}
                    />
                    <div className="frequency-slider__ends" aria-hidden="true"><span>50%</span><span>90%</span></div>
                    <p id="probability-help">Each new visit gets this chance to detour. After a detour, the source stays locked for 15 minutes across tabs, refresh, Back, and browser restarts.</p>
                  </div>
                )}
              </fieldset>
              <button className="utility-button" type="button" onClick={exportReport}><Download size={16} aria-hidden="true" /> Export local alpha counts</button>
              {savedRule && <button className="danger-button" type="button" onClick={removeRule}><Trash2 size={16} aria-hidden="true" /> Delete rule and site access</button>}
            </div>
          </details>
        </form>
      </section>
    </main>
  );
}

function PopupPage() {
  const [state, setState] = useState({ loading: true });

  async function refresh() {
    const next = extension ? await call({ type: 'getState' }) : { rule: core.normalizeRule(DEMO_FORM), metrics: { interventions: 4, destinationOpens: 3 } };
    setState({ ...next, loading: false });
  }

  useEffect(() => { refresh().catch(() => setState({ loading: false })); }, []);

  async function act(message) {
    await call(message);
    await refresh();
  }

  async function allowCurrentTab() {
    if (extension) {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) await call({ type: 'allowTab', tabId: tab.id });
    }
    window.close();
  }

  function manage() {
    if (extension) chrome.runtime.openOptionsPage();
    else window.location.href = '/';
  }

  const rule = state.rule;
  const stateLabel = !rule ? 'No rule' : !rule.enabled ? 'Off' : state.paused ? 'Paused' : state.expired ? 'Ended' : state.lockUntil > Date.now() ? 'Locked' : 'On';

  return (
    <main className="popup-shell">
      <header><Brand compact /><span className={`status-pill status-pill--${stateLabel.toLowerCase().replace(' ', '-')}`}>{stateLabel}</span></header>
      {state.loading ? <p className="popup-empty">Loading…</p> : rule ? (
        <>
          <div className="popup-route">
            <span>{rule.source.display}</span><ArrowRight size={16} aria-hidden="true" /><strong>{rule.destination.display}</strong>
          </div>
          {state.lockUntil > Date.now() && <p className="popup-lock"><LockKeyhole size={16} aria-hidden="true" /> Focus lock · {formatRemaining(state.lockUntil)} left</p>}
          <button className="popup-primary" type="button" onClick={allowCurrentTab}><TimerReset size={18} aria-hidden="true" /> Allow source in this tab for 10 min</button>
          <div className="popup-grid">
            {state.paused
              ? <button type="button" onClick={() => act({ type: 'resume' })}><Play size={17} aria-hidden="true" /> Resume</button>
              : <button type="button" onClick={() => act({ type: 'pause', durationMs: 60 * 60 * 1000 })}><Pause size={17} aria-hidden="true" /> Pause 1 hour</button>}
            <button type="button" onClick={() => act({ type: 'setEnabled', enabled: !rule.enabled })}><Power size={17} aria-hidden="true" /> {rule.enabled ? 'Turn off' : 'Turn on'}</button>
          </div>
          <p className="popup-counts">Local alpha counts: {state.metrics?.interventions || 0} detours · {state.metrics?.destinationOpens || 0} destinations opened</p>
        </>
      ) : (
        <p className="popup-empty">Choose one source and one helpful destination to begin.</p>
      )}
      <button className="manage-button" type="button" onClick={manage}><Settings2 size={17} aria-hidden="true" /> {rule ? 'Manage rule' : 'Create rule'}</button>
    </main>
  );
}

function InterventionPage() {
  const heading = useRef(null);
  const [now, setNow] = useState(Date.now());
  const [attempt, setAttempt] = useState(extension ? undefined : {
    source: 'reddit.com/r/all',
    url: 'https://reddit.com/r/all',
    destination: { url: 'https://leetcode.com/problemset', display: 'leetcode.com/problemset' },
    lockUntil: Date.now() + 15 * 60 * 1000,
  });

  useEffect(() => {
    if (extension) call({ type: 'getIntervention' }).then((response) => setAttempt(response.attempt || null)).catch(() => setAttempt(null));
  }, []);

  useEffect(() => {
    if (attempt !== undefined) heading.current?.focus();
  }, [attempt]);

  useEffect(() => {
    if (!attempt?.lockUntil || attempt.lockUntil <= Date.now()) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [attempt?.lockUntil]);

  useEffect(() => {
    if (!extension || !attempt?.expiresAt) return undefined;
    const dismiss = () => { chrome.runtime.sendMessage({ type: 'dismissAttempt' }).catch(() => undefined); };
    const timeout = window.setTimeout(() => {
      dismiss();
      setAttempt(null);
    }, Math.max(0, attempt.expiresAt - Date.now()));
    return () => clearTimeout(timeout);
  }, [attempt]);

  async function choose(type) {
    if (!extension) {
      setAttempt(null);
      return;
    }
    try {
      await call({ type });
    } catch {
      setAttempt(null);
    }
  }

  if (attempt === undefined) return <main className="intervention-shell"><p>Loading your detour…</p></main>;
  if (!attempt) {
    return (
      <main className="intervention-shell">
        <section className="intervention-card">
          <Brand />
          <h1 tabIndex="-1" ref={heading}>This detour expired</h1>
          <p>The attempted page is no longer stored. You can close this tab or manage your rule.</p>
          <button className="primary-button" type="button" onClick={() => extension ? chrome.runtime.openOptionsPage() : (window.location.href = '/')}>Manage rule</button>
        </section>
      </main>
    );
  }

  return (
    <main className="intervention-shell">
      <section className="intervention-card">
        <Brand />
        <p className="eyebrow">A helpful detour</p>
        <h1 tabIndex="-1" ref={heading}>You chose another route.</h1>
        {attempt.lockUntil > now && <p className="focus-lock"><LockKeyhole size={17} aria-hidden="true" /> Focus lock active · {formatRemaining(attempt.lockUntil, now)} left</p>}
        <p className="intervention-lead">You were opening <strong>{attempt.source}</strong>. Your chosen destination is ready. Back, refresh, and another tab cannot reroll an active focus lock.</p>
        <div className="intervention-destination"><Sprout aria-hidden="true" /><span>Open</span><strong>{attempt.destination.display}</strong></div>
        <button className="primary-button" type="button" onClick={() => choose('openDestination')}>Open chosen destination <ArrowRight size={19} aria-hidden="true" /></button>
        <button className="outline-button full-width" type="button" onClick={() => choose('allowAttemptedSource')}>Allow source in this tab for 10 minutes</button>
        <button className="text-button back-button" type="button" onClick={() => history.back()}>Go back</button>
        <p className="intervention-note"><LockKeyhole size={16} aria-hidden="true" /> The attempted address is held only for this choice and then removed.</p>
      </section>
    </main>
  );
}

export function App() {
  if (view === 'popup') return <PopupPage />;
  if (view === 'intervention') return <InterventionPage />;
  return <OptionsPage />;
}
