# Reroute design QA

- Source visual truth: `/Users/vvarshney/.codex/generated_images/01a0cea8-c747-7fc3-9aea-d9ec595b59ae/exec-c6afd518-d6b0-4738-ae6a-4977251593f7.png`
- Browser-rendered implementation screenshot: `/Users/vvarshney/Documents/Codex/2026-09-23/can/outputs/reroute/design-implementation.png`
- Combined comparison evidence: `/Users/vvarshney/Documents/Codex/2026-09-23/can/outputs/reroute/design-comparison.png`
- Viewport and CSS size: `1487 × 1058`
- Source pixels: `1487 × 1058`
- Implementation pixels: `1487 × 1058`
- Combined comparison pixels: `2974 × 1058`
- Density normalization: source and implementation captured at 1 CSS pixel per output pixel; no resampling before comparison
- State: desktop options-page demo with `reddit.com/r/all → https://leetcode.com/problemset`, optional end date, and no open disclosure panels

## Findings

No actionable P0, P1, or P2 differences remain.

- Fonts and typography: the implementation uses a packaged/system high-contrast serif stack and system UI sans. The headline was optically scaled after the first comparison so its two-line footprint, baseline rhythm, and hierarchy align with the source. Body copy remains readable and does not clip at tested widths.
- Spacing and layout rhythm: the 42.5/57.5 split, divider, form start, field cadence, route summary, and action row align with the source. Desktop, 900 px, and 390 px layouts have no horizontal overflow.
- Colors and visual tokens: warm ivory, deep green, pale sage, muted gray, and orange accents map consistently to the source and retain usable contrast.
- Image quality and asset fidelity: the sage botanical is a real 520 × 380 RGBA bitmap with verified transparent corners and no matte seam. Its desktop crop and scale now track the source; its mobile treatment is intentionally quieter to protect text readability.
- Copy and content: source/destination examples remain generic. Scope and privacy copy are intentionally more explicit than the mock: exact path/host behavior, local aggregate counts, no telemetry, and normal website requests are stated rather than implied.
- Icons: visible controls use one packaged Lucide family. The native date control keeps the browser's locale formatting.
- Accessibility and states: labels, semantic buttons, visible focus for controls, initial intervention-heading focus, no timed redirect, forced-color borders, keyboard-reachable disclosure/radios, and a full-page alternative to popup controls are present.

## Focused region comparison

- Left story region: headline footprint, botanical crop, logo baseline, orange accent, handwritten note, and footer were inspected in the 1:1 combined comparison.
- Right form region: labels, input heights, native date, privacy icons/copy, route-summary alignment, and primary/secondary action placement were inspected in the same combined image.
- Extra crops were not needed because both regions remain readable at the 2974 × 1058 combined resolution.

## Comparison history

1. First combined browser comparison found two P2 differences: the headline was too wide for the selected type footprint, and the botanical asset was too broad. A separate small-screen pass also found the botanical crossing headline text at 390 px.
2. Fixes: optically narrowed the headline without changing its vertical rhythm; reduced the desktop botanical width; generated and verified real transparency to remove the matte seam; constrained and faded the botanical only at the mobile breakpoint.
3. Post-fix evidence: `design-comparison.png` at `2974 × 1058`. The earlier P2 differences are resolved. The implementation screenshot is `design-implementation.png` at the source viewport.

## Primary interactions tested

- Invalid self-loop input returns an inline error without crashing.
- A valid generic source/destination saves in the prototype state.
- The advanced disclosure exposes deterministic mode plus a 50–90% slider in five-point steps. The custom radio, native range, linked percentage output, keyboard increments, Save/Cancel restoration, and Chrome storage round trip are covered in the current verification pass.
- Popup controls render without overflow at `360 × 430`.
- Intervention primary action, expired state, and initial heading focus are reachable without an automatic forward timer.
- A probabilistic detour now shows a visible focus-lock countdown; refresh preserves the same intervention state, and the original no-auto-forward behavior remains unchanged.
- Responsive checks passed at `1487 × 1058`, `900 × 900`, and `390 × 844`.
- A fresh final browser tab reported zero console warnings or errors.

## Percentage-slider update

- The new control reuses the existing native form language, pale-sage surface, green accent, seven-pixel radius, and compact type scale; it does not alter the selected option-2 composition above the disclosure.
- At desktop size the expanded control remains aligned inside the 520 px advanced section. At `390 × 844`, the document has no horizontal overflow and the slider remains 273 px wide.
- The native range exposes a label and percentage-valued accessibility text. Arrow keys move by five points; the 50% and 90% limits remain reachable.
- The original 1:1 comparison files document the selected base screen with the disclosure closed. The post-handoff slider was visually inspected in the same live browser at default and mobile sizes rather than treated as part of the original source image.

## Follow-up polish

- [P3] The packaged sprout icon is outlined while the source mark is filled. Keep the library icon for now; commission a final brand mark only after the product direction survives alpha.
- [P3] Native date formatting follows browser locale (`31/10/2026` here) instead of the mock's US presentation. This is expected and preserves the native accessible control.

## Implementation checklist

- [x] Match selected option-2 composition and palette.
- [x] Use a real transparent botanical asset and packaged icon family.
- [x] Verify key interactions, error state, focus, and responsive breakpoints.
- [x] Recompare after every P2 fix.
- [x] Confirm a clean final browser console.

final result: passed
