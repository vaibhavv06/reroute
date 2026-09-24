let lastCandidate = '';

async function considerCurrentUrl() {
  const url = location.href;
  if (url === lastCandidate) return;
  lastCandidate = url;
  try {
    const response = await chrome.runtime.sendMessage({ type: 'candidate', url });
    if (response?.intervene && response.url) location.replace(response.url);
  } catch {
    // The extension may have been reloaded while this page was open.
    lastCandidate = '';
  }
}

considerCurrentUrl();
addEventListener('popstate', considerCurrentUrl);
addEventListener('hashchange', considerCurrentUrl);
addEventListener('pageshow', (event) => {
  if (!event.persisted) return;
  lastCandidate = '';
  considerCurrentUrl();
});
// ponytail: source-scoped polling covers SPA pushState without page-world injection; use webNavigation if profiling shows a real cost.
setInterval(considerCurrentUrl, 750);
