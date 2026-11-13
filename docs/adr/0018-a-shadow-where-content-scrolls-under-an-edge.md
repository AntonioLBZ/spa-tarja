# ADR-0018: A shadow where content scrolls under an edge

- Status: Accepted
- Date: 2026-11-12

## Context

The header is sticky now ([`header.md`](../specs/header.md)) and the bottom bar of a phone is fixed ([`bottom-navigation.md`](../specs/bottom-navigation.md)). Both have an ink hairline that is always there, so nothing says whether more content is under them. Four options were shown side by side in Storybook: nothing, a soft shadow, an ink rule that thickens, and a fade. The owner picked the soft shadow.

A shadow breaks the rule of `DESIGN.md` §2, "Solid colors only: no gradients, no shadows, no blur", which comes from the identity of flat surfaces separated by borders. No accepted ADR states that rule, so this refines the design rule without superseding any decision.

## Decision

- **A second use of the one exception to "no shadows, no blur"** (the first is the list that opens over the page): a soft shadow cast by an edge onto the content that is under it, and only while there is content under it. The edges are the bottom bar of a phone and the sticky header. Nothing else casts a shadow: no card, button, sheet, menu or dialog.
- **Only while something is under the edge.** The header's shadow is invisible at the top of the page and reaches full strength after a short scroll; the bar's is invisible when the page is scrolled to its end. It is driven by the scroll position (CSS scroll-driven animations, no script), by `opacity` only. Where the browser has no scroll-driven animations, there is no shadow, and the hairline stays the edge.
- **The hairline stays.** The shadow adds to the ink border and replaces nothing.
- **A semantic token, `--color-shadow`,** defined once with `light-dark()` like every color. It already exists for the soft shadow around a list that opens over the page (`--shadow-popup`, of the native `Select`): the edges reuse that token and no second color is added. Light theme: black at low opacity. Dark theme: the page is black, so a black shadow would not show; the shadow there is a faint white tint instead. The header uses `--shadow-popup` itself; the bar casts the same shadow upward.
- Reduced motion: the shadow follows the scroll and has no transition of its own, so it needs no exception; `prefers-reduced-motion` still zeroes every duration.

## Consequences

- `DESIGN.md` §2 says "no shadows, no blur" except this one; its palette table lists `--color-shadow`.
- The header and the bottom bar get a pseudo-element that holds the shadow, so a view transition of either captures it with the edge.
- The footer of a sheet, the list of a `Select`, the privacy dialog and the chart do not cast it. Each is a box that scrolls inside the page and can be added later under this same ADR.
- Browsers without scroll-driven animations show the flat edge the app had before.

## Alternatives considered

- Nothing: the current look, and the edge says nothing about the content under it.
- An ink rule that thickens while content is under the edge: flat and in the identity, but the owner preferred the shadow.
- A fade of the content into the page: breaks "Solid fills only", and over a sheet it would have to be the sheet's color.
- A shadow that is always there: it would be an elevation, which the identity avoids; the point is that it appears only when it says something.
