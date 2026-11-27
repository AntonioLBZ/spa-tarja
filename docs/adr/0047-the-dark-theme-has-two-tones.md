---
status: Proposed
date: 2026-11-27
tags: [design, settings]
specs: [settings.md]
summary: 'The dark theme is a dark gray by default; pure black is a switch.'
---

# ADR-0047: The dark theme has two tones

## Context

The dark theme has been true black since it was drawn. Black saves battery and looks deep on a screen that turns its black pixels off, but on a backlit one it is a gray glow, and white text on pure black can smear while scrolling and feels harsh for long reading. Most people expect a dark theme to be a dark gray; some want the black.

## Decision

- **Two tones of the dark theme**: standard, a dark gray (`#121212` page, `#1e1e1e` header and raised surfaces, `#363636` hairline), and black, the old true black (`#000`, `#141414`, `#2e2e2e`). Only those three surfaces change; text, accent, danger, amounts and categories keep their dark values, checked against both tones.
- **Standard is the default**, for everyone, also for whoever chose Dark before there were two: they see the gray until they turn pure black on.
- **Named for what it looks like**: "Pure black", never after a kind of screen.
- **A switch, not a fourth theme**: "Pure black" under the theme in Settings → Appearance, a preference of the device kept in `localStorage` under `tarja:dark-tone`, written on `<html>` as `data-dark-tone`. It applies to Dark and to System on a dark device; it is off and disabled with Light.
- The tokens keep `light-dark()`: the dark side of the three surface tokens reads a `--dark-*` token, which the black tone redefines. The inline script of `index.html` puts the saved tone on the page and the toolbar color before the first paint, as it does for the theme.

## Consequences

- In the standard tone the ink (`--color-border` and the text on the header) reaches 16.7:1 on `#1e1e1e` instead of the 18:1 of black; still far past AA.
- The toolbar color of the dark preference has two values; `index.html` carries the black one beside it.
- The manifest's `theme_color` (the navigation bar of an installed Android app) stays `#141414`, close to both tones.
- Turning the switch while the page is dark reveals the new tone as an ink drift, like a theme change ([ADR-0022](0022-the-theme-changes-as-an-ink-drift.md)).

## Alternatives considered

- **A fourth theme (Light, Dark, Pure black, System)**: System could then only give one of the dark tones, so whoever follows the device couldn't have black.
- **Keeping those who chose Dark on black**: no change for them, but the default would depend on history; the owner chose standard as the default for all.
