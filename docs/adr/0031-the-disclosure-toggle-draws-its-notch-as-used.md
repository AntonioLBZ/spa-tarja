# ADR-0031: The disclosure toggle draws its notch as it is used

- Status: Accepted
- Date: 2026-11-15

## Context

[ADR-0023](0023-buttons-and-fields-draw-their-notch-as-used.md) made the buttons and the fields rest as their bottom edge and grow the left edge with use, and left the toggle of a `Disclosure` (a raw `<button>`) with the full L at rest. Beside a button and a field, a closed disclosure, the most quiet control of the form, was the loudest.

## Decision

Confirmed by the owner, for every `Disclosure` toggle that has the default look:

- **Closed**, the toggle is its bottom edge alone, in ink (`--size-1`).
- **On hover**, only where the device can hover, the left edge grows from the bottom to half the height while it is closed.
- **While pressed**, and **while open**, the left edge is the whole height: the L of ADR-0023, so the open toggle reads as a pressed button that stays pressed.
- The left edge is drawn by `::before` and grows with a `transform` over `--duration-base`, as in a `Button`, so reduced motion makes it instant.
- **Disabled** is the hairline at the bottom with no left edge, open or not, as a disabled button.
- The focus ring is the one of ADR-0023: the accent outline round the box, only when the focus came from the keyboard.

A toggle that has a look of its own keeps it: the rows on a `Sheet` (the expenses of a day, the ledger of a group, the balances, the people, the person's own categories), which have no notch because they sit on paper.

## Consequences

- On a touch screen, where there is no hover, a closed toggle is its bottom line alone and the L shows while it is open or pressed.
- A closed toggle moves its text `--size-1` less to the left than before: its padding makes up for the edge it no longer has, so the text stays where it was.
- The `aria-expanded` of the toggle drives the look, so no class or prop is added.

## Alternatives considered

- Keeping the full L at rest: the toggle stays louder than the buttons and fields around it.
- Half the left edge while open: reads as hover, so the open state would not be told from it.
