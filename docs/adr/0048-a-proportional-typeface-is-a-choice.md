---
status: Accepted
date: 2026-11-27
tags: [design, settings]
specs: [settings.md, repository-structure.md]
summary: 'Everything stays in IBM Plex Mono by default; IBM Plex Sans is a choice of the device.'
---

# ADR-0048: A proportional typeface is a choice

## Context

Everything is set in IBM Plex Mono: monospace lines the digits up and fits the ledger feeling, and it is Tarja's look. Some people find long lines of monospace slower to read and prefer a face drawn for running text. A trial on the prerelease offered three: IBM Plex Sans, Atkinson Hyperlegible Next and the face of the device.

## Decision

- **Monospace stays the default** for everyone, and the look of the app is drawn for it.
- **IBM Plex Sans is the only alternative**: the proportional sister of Plex Mono, from the same family, so the app keeps its character and only reads looser. SIL OFL 1.1, from `@fontsource/ibm-plex-sans`, the latin subset in 400 and 700, about 23 KB each, served and precached by the app like Plex Mono and downloaded only when it is used; it is not preloaded.
- **A choice of the device**: a `ChoiceGroup` "Typeface" (Monospace, Proportional) on Settings → Appearance, after the theme, kept in `localStorage` under `tarja:typeface` and written on `<html>` as `data-typeface="sans"`; monospace leaves the root bare. The inline script of `index.html` puts it on the page before the first paint, as it does for the theme.
- **Named for what it is**, Monospace and Proportional, never after the font.
- With the proportional face the digits are tabular (`--font-numeric`), so amounts still line up in columns and totals. What is measured in characters, the widest word of a `ChoiceGroup`, gets no more room: measured on the font, the words of its options take 77 to 95 % of as many zeros in IBM Plex Sans ("Monoespaciada" 113 px against 125 px in Plex Mono), so a group breaks into rows the same way in either face and doesn't jump when the typeface is switched.

## Consequences

- The logo keeps Dot Matrix whatever the choice.
- The dot leaders still work, since the box cuts them; their dots sit closer or further apart with the proportional face.
- Storybook has a Typeface toolbar, beside the Theme one, so every story can be checked in either face.
- The privacy notice lists the typeface among the preferences kept on the device.
- A label of a few short words with capitals ("Gym") can run past its zeros in the proportional face, but a group sizes its columns by its widest word, which is always long.
- The look is checked in monospace first; the proportional face is checked for what breaks (a word cut in a `ChoiceGroup`, a column measured in characters), not drawn for.

## Alternatives considered

- **Atkinson Hyperlegible Next**: drawn for legibility, but further from the ledger look; the owner preferred Plex Sans.
- **The face of the device** (`system-ui`): no bytes, but a different face on each system, so the app would never look the same.
- **More than one alternative**: each face is more to check and to keep; one is enough for whoever doesn't want monospace.
