(() => {
  const MAX_URL_LENGTH = 2048;
  const FOCUS_LOCK_MS = 15 * 60 * 1000;
  const TAB_ALLOWANCE_MS = 10 * 60 * 1000;

  function asUrl(raw, label, defaultProtocol = true) {
    const value = String(raw || "").trim();
    if (!value) throw new Error(`${label} is required.`);
    if (value.length > MAX_URL_LENGTH) throw new Error(`${label} is too long.`);

    let url;
    try {
      url = new URL(defaultProtocol && !/^[a-z][a-z\d+.-]*:/i.test(value) ? `https://${value}` : value);
    } catch {
      throw new Error(`Enter a valid ${label.toLowerCase()}.`);
    }

    if (!['http:', 'https:'].includes(url.protocol)) throw new Error(`${label} must use HTTP or HTTPS.`);
    if (url.username || url.password) throw new Error(`${label} cannot include a username or password.`);
    return url;
  }

  function normalizeHostname(hostname) {
    return hostname.toLowerCase().replace(/\.+$/, '');
  }

  function normalizePath(pathname) {
    if (!pathname || pathname === '/') return '/';
    return pathname.replace(/\/+$/, '') || '/';
  }

  function parseSource(raw) {
    const url = asUrl(raw, 'Site to reroute');
    if (url.search || url.hash) throw new Error('The source can use a host and path, but not a query or fragment.');
    if (url.port) throw new Error('Custom ports are not supported in this alpha.');

    const hostname = normalizeHostname(url.hostname);
    if (!hostname || hostname.includes('*')) throw new Error('Enter one exact hostname without wildcards.');
    const pathPrefix = normalizePath(url.pathname);
    return {
      hostname,
      pathPrefix,
      display: `${hostname}${pathPrefix === '/' ? '' : pathPrefix}`,
      permission: `*://${hostname}/*`,
      testUrl: `${url.protocol}//${hostname}${pathPrefix}`,
    };
  }

  function parseDestination(raw) {
    const url = asUrl(raw, 'Chosen destination', false);
    if (url.protocol !== 'https:') throw new Error('The destination must be a full HTTPS URL.');
    url.hostname = normalizeHostname(url.hostname);
    return { url: url.href, display: `${url.hostname}${url.pathname === '/' ? '' : url.pathname}` };
  }

  function pathMatches(pathname, prefix) {
    if (prefix === '/') return true;
    return pathname === prefix || pathname.startsWith(`${prefix}/`);
  }

  function matchesSource(raw, source) {
    try {
      const url = new URL(raw);
      return ['http:', 'https:'].includes(url.protocol)
        && normalizeHostname(url.hostname) === source.hostname
        && pathMatches(url.pathname, source.pathPrefix);
    } catch {
      return false;
    }
  }

  function validEndDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000-')) return false;
    const date = new Date(`${value}T00:00:00.000Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }

  function normalizeRule(input) {
    const source = parseSource(input.source);
    const destination = parseDestination(input.destination);
    const probabilityPercent = input.probability == null || input.probability === '' ? 80 : Number(input.probability);
    if (matchesSource(destination.url, source)) {
      throw new Error('The destination is inside the rerouted scope and would create a loop.');
    }
    if (input.endDate && !validEndDate(input.endDate)) throw new Error('Choose a valid end date.');
    if (!Number.isFinite(probabilityPercent) || probabilityPercent < 50 || probabilityPercent > 90) {
      throw new Error('Choose a reroute percentage from 50 to 90.');
    }

    return {
      id: 'primary',
      enabled: input.enabled !== false,
      source,
      destination,
      endDate: input.endDate || '',
      mode: input.mode === 'probabilistic' ? 'probabilistic' : 'deterministic',
      probability: probabilityPercent / 100,
    };
  }

  function isExpired(rule, now = Date.now()) {
    return Boolean(rule?.endDate) && now > new Date(`${rule.endDate}T23:59:59.999`).getTime();
  }

  function decisionFromUint32(value, probability = 0.8) {
    return value < Math.floor(probability * 0x100000000);
  }

  globalThis.RerouteCore = {
    MAX_URL_LENGTH,
    FOCUS_LOCK_MS,
    TAB_ALLOWANCE_MS,
    decisionFromUint32,
    isExpired,
    matchesSource,
    normalizeRule,
    parseDestination,
    parseSource,
    pathMatches,
  };
})();
