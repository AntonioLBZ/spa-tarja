---
status: Accepted
date: 2026-11-15
tags: [design]
specs: [settings.md, summary.md]
summary: 'Every `Card` is its bottom edge alone (`--size-1`, `--color-border`), no left edge, at rest and always, no L on hover, no padding at the sides; the focus ring stays; refines the notch rule of DESIGN.md as it applies to cards, beside ADR-0023.'
---

# ADR-0033: A card is its bottom edge

## Context

A `Card` was a box with the full notch: a thick ink edge on the left and at the bottom. Since the buttons, the fields and the toggle of a `Disclosure` rest as their bottom edge alone and grow the left one with use ([ADR-0023](0023-buttons-and-fields-draw-their-notch-as-used.md), [ADR-0031](0031-the-disclosure-toggle-draws-its-notch-as-used.md)), the cards were the heaviest boxes on a screen, and a stack of them (the rows of the settings, the groups, the summary) read as a column of thick Ls for what is only a row of text. A hairline under each row was tried on the settings and read too faint next to the rest of the app.

## Decision

A `Card` is its bottom edge alone: a thick ink line (`--size-1`, `--color-border`) under it, no left edge, at rest and always. It doesn't grow an L on hover or when pressed, since a card isn't a control; a card whose link covers it keeps its focus ring around the whole card. With no left edge to clear, a card has no padding at the sides: what it holds lines up with the text of the column, and only the padding above and below (`--size-2`) is left.

This refines the notch rule of the design document as it applies to `Card`, and sits beside ADR-0023: the controls draw the L as they are used, the cards never do.

## Consequences

- Every card of the app changes at once (the rows of About, the summary, the budget bars, the stat row and the split of the charts, the groups, the people of a new group, the links of the settings); none of them relied on the left edge for its layout.
- The links of the settings go back to being `Card`s, with that look.
- Boxes that are not cards keep their notch (the plot of the charts, the dialogs, the choice groups).

## Alternatives considered

- A hairline under each row: too faint next to the thick edges of the buttons and fields.
- Cards that grow the L on hover like a button: a card isn't something pressed, and most cards aren't links.
- Keeping the side padding: it would indent the text of a card from the headings above it for an edge that is no longer there.
