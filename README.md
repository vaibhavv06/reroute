# Reroute v0.1

Reroute is a local-first Chrome research alpha for one user-authored `site1 → site2` rule. It interrupts a matching visit with a calm choice screen; it never auto-forwards on a timer.

## Install locally

1. Unzip the included `reroute-extension.zip`, or build from source with `npm install` and `npm run build`.
2. Open `chrome://extensions` in Chrome.
3. Enable **Developer mode**.
4. Choose **Load unpacked** and select this project's `dist/client` folder, or the unzipped package folder.

Chrome will not receive site access during installation. Reroute asks for one exact source hostname only when you save a rule.

## Use

1. Enter one source hostname with an optional path, such as `reddit.com/r/all`.
2. Enter a full HTTPS destination.
3. Optionally add an end date.
4. Save and test the rule.

On a matching visit, choose either:

- **Open chosen destination**
- **Allow source in this tab for 10 minutes**

The popup can pause the rule for one hour, turn it off without deleting it, or open the full management page.

## Matching contract

- Hostnames are exact: `example.com`, `www.example.com`, and `sub.example.com` are different.
- A path rule matches that path and its descendants: `/learn` matches `/learn/system-design`, not `/learning`.
- Deterministic intervention is the default.
- The optional 50–90% alpha slider moves in 5-point steps; 80% is the default.
- A missed roll applies only to that visit. A detour starts a 15-minute focus lock across tabs, refresh, Back, and browser restarts. The deliberate Pause and 10-minute Allow controls remain available.
- A destination inside the source scope is rejected to prevent loops. A same-host destination outside the source scope is allowed.

## Privacy contract

- The rule, focus-lock expiry, and aggregate alpha counts stay in `chrome.storage.local` on this device.
- The exact attempted address exists only in per-tab `chrome.storage.session` until a choice, tab close, or expiry, then it is deleted.
- No telemetry, account, backend, remote font, CDN, fetch, beacon, WebSocket, or event-level browsing log is included.
- Source and destination websites still receive normal requests when visited. The content-script architecture does not promise a zero-request block.
- An alpha report leaves the device only when the user explicitly exports and shares it.

## Deliberate alpha limits

- Chrome desktop only
- One active rule
- No account, sync, mobile app, team controls, AI, or analytics dashboard
- The popup shows only aggregate local counts
- The extension is packaged for local unpacked installation, not submitted to the Chrome Web Store

## Verify

```bash
npm test
npm run build
npm run test:sites
```

The detailed browser/runtime evidence is in `test-report.md`; visual fidelity evidence is in `design-qa.md`.
