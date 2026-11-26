---
status: Accepted
date: 2026-11-15
tags: [design, settings]
specs: [settings.md]
summary: 'The accent is gray, always; the App color choice and the other presets go, and a stored `tarja:accent` is ignored and removed.'
---

# ADR-0027: One app color, gray

## Context

The settings let a person pick the accent, the hue of what can be acted on, from six presets (gray, amber, blue, green, violet and pink). Amounts now get colors of their own ([ADR-0028](0028-amounts-show-which-way-they-go.md)): a green or a blue for what comes to the person and a red or an orange for what they owe. An accent of the same family next to them (green or blue links beside a green amount, amber beside an orange one) would read as one more meaning, and every preset would have to be checked against both palettes of the amounts, in both themes.

## Decision

The accent is gray, always: the light `#404040` and the dark `#d4d4d4` it already had by default. The "App color" choice goes from the settings, the other presets go from `tokens.css`, and nothing sets `data-accent` on the page any more, neither the app nor the script that runs before the first paint.

A choice stored before (`tarja:accent` in `localStorage`) is no longer read: the page paints gray whatever it holds, and the key is removed the next time the app starts, so nothing about it is left on the device.

## Consequences

- Color in the interface means one of three things: a category, an error or what deletes, and which way an amount goes.
- The tokens keep their names (`--color-accent`, `--color-bg-accent`, `--color-border-focus`), so no component changes.
- The privacy notice no longer lists the color among the preferences on the device, and lists how amounts are shown instead.

## Alternatives considered

- Keeping the presets and checking them against the amounts: six accents times two palettes times two themes of pairs to keep apart, for a choice few people make.
- Keeping only the presets that don't clash (gray, violet, pink): a smaller list that still has to be checked by hand each time a color changes.
