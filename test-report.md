# Reroute v0.1 — three-iteration behavior test report

**Date:** 2026-09-24  
**Product:** generic user-authored `site 1 -> site 2` Chrome research alpha  
**Final build:** `dist/client`  
**Verdict:** suitable for local unpacked installation and a small research pilot. It is not a Chrome Web Store, product-market-fit, or production-readiness claim.

## Evidence rules

- A static/unit check is not called browser proof.
- A background-service-worker result is not called end-to-end navigation proof.
- `Pass`, `Fail`, and `Not tested` are kept distinct.
- Runtime tests used Chrome for Testing `152.0.7977.140` with disposable profiles.
- The final navigation suite used a temporary copy of the production build with only required test-host access (`*://127.0.0.1/*`) added. This bypassed Chrome's non-automatable native host-permission dialog; the production JavaScript, CSS, and HTML were byte-identical to the final build.

## Iteration 1 — fail, then investigate

The first frozen build loaded in Chrome, saved normalized state in direct background tests, registered its dynamic content script, and correctly rejected `/focused` while accepting `/focus/deep`. It nevertheless **failed the real permission contract**:

> `Only permissions specified in the manifest may be requested.`

Root cause: the manifest declared separate optional `http://*/*` and `https://*/*` patterns, while a rule requested `*://host/*`. Chrome did not accept that request as a subset of either individual declaration, so the normal Save flow could not finish.

The same iteration's browser, code, and privacy audits found these additional defects:

| Severity | Finding | Root-cause fix |
|---|---|---|
| P2 | Simultaneous tabs could overwrite aggregate count increments. | Serialize the storage read/modify/write through one promise queue. |
| P2 | Shape-valid but impossible dates such as `2026-02-31` could become never-ending rules. | Strict UTC calendar round-trip validation in shared parsing. |
| P2 | An Off rule stayed invisibly Off after **Save and test**, so its new test tab could not reroute. | Make that explicit action save `enabled: true`. |
| P2 | The intervention heading focus ran before the asynchronously loaded heading existed. | Refocus in an effect that depends on resolved intervention state. |
| P2 | Leaving the intervention without choosing could retain the attempted URL in session storage. | Keep it per-tab and remove it on choice, tab close, or expiry. An interim `pagehide` cleanup was removed in Iteration 3 because it made refresh look expired. |
| P3 | An explicitly HTTP source reverted to HTTPS after an options-page round trip. | Rehydrate the editable source from its stored `testUrl`. |

Earlier UI implementation checks also caught and fixed a self-loop error-path crash, an exact-80%-boundary error, a disabled invalid-submit path that hid feedback, a retry problem after extension reload, an overbroad permission-revocation comparison, a stale-intervention action, a botanical matte seam, and a small-screen botanical/text collision.

## Iteration 2 — pass in tested scope

### Automated checks

All final checks passed:

- 7 Node core/background tests: URL normalization, exact host/path matching, loop rejection, custom 50–90% boundaries, positive-only focus locking, expiry, strict calendar dates, concurrent metrics, attempted-URL dismissal, privacy primitive scan, manifest/CSP/icon contract.
- 4 static-site packaging tests.
- Vite production build.
- JavaScript syntax checks for core, background, and content scripts.

Final production hashes:

```text
manifest.json  24edd3f0361584878c18d76b743d6703ea956194b1958b03d58aacba1f43ce2d
core.js        ed6993348e4fb9bf7424f1845f4dd62a932ead10b4abd483e999c824a0c6636f
background.js  b6621cbbcf04dab1645ddbe04d8bbf4d124be77d69b8f970db087a9c490340a8
content.js     4cad810123693e134c8f4ed0e97d8202ad85edfb5887ee0afe7a56721d84daf6
UI bundle      978f0b2f5858fd602a4ec9c71878c27e94ad6fff5778c3746886d2a2f1af09fa
UI styles      6b074fcf0adc724e012ca3a28b516a61951cd808bee3e1c6782df04f0f3d99e1
extension ZIP  8bad414bd36546a4c3427d465b71fff4089ba50dcc08f68d60b16367e8033558
```

### Actual Chrome end-to-end pass

A clean Chrome profile, real loopback HTTP fixture, automatic dynamic content-script injection, actual extension intervention page, and an HTTPS destination produced 12/12 passes:

This suite preceded the positive-only focus-lock change. Its unchanged navigation, permission, allowance, pause, and cleanup paths remain regression evidence; item 10's immediate `pagehide` cleanup was deliberately superseded in Iteration 3 so refresh can retain the intervention.

1. Saved the rule and registered exactly `*://127.0.0.1/*`.
2. Left the near-prefix `/focused/` untouched.
3. Left the source root outside `/focus` untouched.
4. Automatically intercepted `/focus/?x=1` and opened the extension intervention page.
5. Rendered the intervention and moved focus to its `h1`.
6. Opened the chosen HTTPS destination.
7. Removed the transient attempted URL after the destination choice.
8. Returned to the attempted source for the 10-minute bypass and removed its transient URL.
9. Preserved that allowance across a forced MV3 service-worker restart.
10. Removed the transient attempted URL when the intervention page was abandoned.
11. Suppressed interception while paused and restored it on resume.
12. Recovered an Off rule through **Save and test**, turned it on, and preserved its explicit HTTP test URL.

### Actual Chrome background/session pass

A separate disposable-profile pass verified:

- exact segment matching at the background boundary;
- attempt persistence across intervention refresh and forced service-worker termination;
- destination metrics and attempt cleanup;
- timestamped per-tab allowance state;
- pause/resume and off/on registration changes;
- one positive custom-percentage focus lock shared across two tabs and a worker restart;
- deletion of the rule, dynamic script registration, and session state.

### Browser-rendered UI pass

The options, popup, and intervention surfaces were exercised in the local browser at desktop, `900 x 900`, popup `360 x 430`, and mobile `390 x 844` sizes. Invalid self-loops, the 50–90% control, visible focus-lock countdown, expired intervention state, responsive overflow, initial focus, and a clean final console passed. The 1:1 visual comparison and residual P3 polish notes are in `design-qa.md`.

### Percentage and focus-lock hardening

The post-iteration behavior change was separately verified:

- native labeled range, `50–90%` in five-point steps, with a visible linked output and percentage-valued accessibility text;
- keyboard movement from 80% to the exact 50% and 90% limits, then back to 80%;
- prototype Save at 50%, change to 90%, and Cancel restoring 50%;
- no horizontal overflow at `390 x 844` (`375 px` document width; `273 px` slider width);
- unit proof that a miss stores no lock and the next visit rerolls;
- unit proof that the first hit creates a positive-only lock shared across tabs and retained after a background-worker restart;
- BFCache `pageshow` handling resets the last-candidate guard so restored pages are reconsidered;
- deterministic intervention remains the separate 100% option.

An actual Chrome MV3 pass then verified the current behavior end to end:

- a 50% value saved through the real options UI and survived page reload;
- the positive `focusLock` existed in `chrome.storage.local`, not session storage;
- one expiry was shared across two tabs and survived forced service-worker termination/restart;
- `attempt.lockUntil` reached the intervention UI and rendered a live `15:00` countdown;
- forcing probability to zero after locking did not change the result on refresh, Back/revisit, another tab, or worker restart;
- the first runtime pass found that `pagehide` cleanup made an intervention refresh look expired;
- after removing that cleanup, a focused Chrome rerun preserved the same intervention and countdown through refresh, while closing the tab still removed its transient `attempt:<tabId>` and retained the focus lock.

## Explicitly not tested

- Clicking Accept/Deny in Chrome's native optional-host permission dialog in headless mode. The corrected production manifest now reaches that prompt; the E2E copy pregranted only the exact fixture host.
- Optional-permission removal/re-grant through the native browser UI. The test copy's host grant was required and therefore intentionally non-removable.
- Full browser restart; service-worker termination/restart was tested instead.
- BFCache, a real third-party SPA `pushState` route, incognito, managed enterprise policies, other Chromium versions, Firefox/Safari, mobile, VoiceOver, and Chrome Web Store review.

No open P0 or P1 defect remains in the exercised scope. The listed gaps are pilot/manual acceptance items, not silently inferred passes.
