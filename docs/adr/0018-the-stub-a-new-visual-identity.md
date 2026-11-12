# ADR-0018: The stub, a new visual identity

- Status: Proposed
- Date: 2026-11-12

## Context

The look the app shipped with (black and white, one gray accent, only IBM Plex Mono, thick ink "notches" on every box, no radius, ticket-like lists, a Dot Matrix logo) was chosen for being minimal and distinctive. In daily use it turned out heavy and cold: every box shouts the same, nothing is bigger than anything else, the home opens on a search box and a filter box instead of on the answer to "how am I doing this month", and the add form puts seven fields in front of the one that matters. Motion was fades and short shifts, which explain nothing and reward nothing. The owner asked for a full rethink, free of [`DESIGN.md`](../../design-system/DESIGN.md) as it stood: unique but friendly, easy to understand, mobile-first and dynamic, with the animation toolkit of their portfolio.

## Decision

Proposed by a proof of concept on the branch `redesign-poc`; the owner decides whether it replaces the old look.

- **One idea, "the stub".** _Tarja_ means tally and tag. A screen is a ticket: a flat colored **field** that holds the answer, a **perforated edge** (half circles bitten out of the sheet), and a paper **sheet** that holds the details and slides over the field as the page scrolls. The perforation is the only edge between the two, on every screen; from 40 rem the sheet is a centered column on a quiet desk, under a header band in the field's color.
- **One bold thing: the hero of the home.** This month's spending as the biggest number of the app, counting up, over a **tally comb**: one tick per day of the month, as tall as what was spent that day, grouped by calendar week, today marked, the days to come as dots. A finger or pointer moving along it reads the days off; a tap takes the list to that day. Everything else is calm.
- **Color.** The app color (the former "accent") is now the field and what is tapped to act. The default is tangerine, with cobalt, pine, grape, rose and ink as presets, each with a light and a dark tone, a "spark" for the "+", a "now" mark and a link tone, every pair checked against WCAG AA in both themes. Surfaces are tints of the field mixed into the paper, never gray. Category colors keep their keys and tones.
- **Type.** One family, Gabarito (variable, 400 to 900, self-hosted), figures tabular. The Dot Matrix logo and IBM Plex Mono go; the logo is the word in the heaviest weight.
- **Shape.** Rounded with a hierarchy (a small, a medium and a large radius, and a pill for what is pressed). No shadows and no gradients as color: separation is whitespace, tint and hairlines.
- **Icons.** Material Symbols, Rounded, weight 500 (they were Sharp, weight 400).
- **UX.** The home opens on the hero, with the search as a pill, the filters behind a button and the categories as chips; days read "Today" and "Yesterday" with their total on the line of their heading, which stays at the top while its rows scroll. The add form opens with a giant amount on a field-colored panel and puts the day and the way of paying under "More options"; a shared expense keeps its tail in view. Rows show a category sticker, the name with its details under it, and the amount. Groups and Summary open on their answer as their hero.
- **Motion.** GSAP (`gsap`, `@gsap/react`, and ScrollTrigger from the same package), the stack of the owner's portfolio, replaces hand-written transitions where something has to move in a way CSS can't say: the count of numbers, the comb, the sheet that slides over the field, the pill of the tab bar that glides and stretches, the sheet of a form that blooms out of the control that opened it. Everything that moves sits inside `prefers-reduced-motion: no-preference` and has its final state in the page when it doesn't run. Route changes keep View Transitions. No smooth-scroll library: native touch scrolling stays.

## Consequences

- The visual rules of `DESIGN.md` are rewritten, and the specs that describe the header, the bottom bar, the list, the add form and the accent are updated, in the same branch. If accepted, this ADR supersedes the look in [ADR-0017](0017-the-look-of-the-plus.md) (the flat accent square is now a raised spark squircle) and the "no rounded corners, flat gray" rules; the behavior those ADRs and [ADR-0016](0016-forms-for-a-task-open-in-a-sheet.md) fix, a "+" from any screen opening a sheet, is unchanged.
- The stored accent values change (`tangerine`, `cobalt`, `pine`, `grape`, `rose`, `ink`); a person whose device holds an old one gets the default.
- Three dependencies are added (`gsap`, `@gsap/react`, the Gabarito font package) and one is dropped (IBM Plex Mono). GSAP is free to use.
- The tests that pinned the old structure (header order, a visible "Total" under each day, the health notice shown when all is well) change with it.

## Alternatives considered

- A blue field over a white sheet: it tested as a stock banking look and was dropped for tangerine.
- Keeping the notch and changing only color and type: the weight of the edges was the main complaint.
- Cream paper with a serif and a clay accent, or a black screen with one acid color: common defaults, not choices for this app.
- Lenis for smooth scrolling: it fights native touch scrolling and the sheets that scroll inside themselves.
- A WebGL background like the portfolio's: battery cost on a phone for no information.
