---
status: Proposed
date: 2026-11-27
tags: [settings, navigation]
refines: [ADR-0032]
specs: [settings.md]
summary: 'The language joins Appearance; the privacy notice moves to Your data; the version goes last in About.'
---

# ADR-0049: The language joins Appearance

## Context

ADR-0032 kept the language on `/settings` because it changes in a press. In practice it is chosen once, if at all: the app starts in the language of the browser. It sat above the cards as the only setting left on the page, beside the theme and the typeface in all but place. About Tarja had grown too: the version first, the status, two links out and, loose under them, the button of the privacy notice, which says what is kept about the person and how to download it or delete it, the business of the account page.

## Decision

- **The language moves to the page of Appearance**, first, above the theme. The page and its card are named **Appearance and language** ("Apariencia e idioma"), and the hint under the card says what it holds: "Language, theme, typeface and amounts" ("Idioma, tema, tipografía e importes").
- **`/settings`** holds the three cards, Notifications and About Tarja, in this order.
- **The privacy notice moves to Your data**, on the account page: its ghost button goes after the downloads and the printable view. The sign-in screen keeps its own.
- **About Tarja** is a list of four rows: Status, Source code, Design system, then Version, last.

## Consequences

- A person who ends up in a language they can't read finds it one tap deeper; the names of the languages are still written in themselves.
- About Tarja is only rows, with no loose button under them.
- The privacy notice still names where the controls are, under Account, and now sits beside them.

## Alternatives considered

- The version apart, as a quiet line at the foot of the settings: a new piece of the page with no component, and the commit of a prerelease reads oddly on its own.
- The privacy notice as a row of About Tarja: a row that opens a dialog among rows that open a new tab.
