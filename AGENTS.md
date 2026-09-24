# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.

## Locked product direction

- Selected visual direction: option 2, the warm ivory editorial split layout with dark green typography and pale-sage botanical art.
- Product scope: one generic `site1 → site2` rule, exact host plus optional path, not a YouTube-specific redirect.
- Product goal: help users reduce compulsive, addictive site use, while preserving explicit safety overrides. Do not claim clinical treatment or guaranteed removal; a user can still disable or uninstall a browser extension.
- Preserve agency: an extension-owned choice page, a 10-minute per-tab source allowance, and deterministic behavior by default. The alpha-only custom slider runs from 50–90% in five-point steps and starts at 80%. Misses apply only to one visit; a detour creates a visible 15-minute focus lock across tabs, refresh, Back, and browser restarts.
- Privacy boundary: no telemetry; only the rule, focus-lock expiry, and aggregate research counts persist locally. An attempted URL is transient per-tab session state until a choice, tab close, or expiry and never appears in the intervention URL.
