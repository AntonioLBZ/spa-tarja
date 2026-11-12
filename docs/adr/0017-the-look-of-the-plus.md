# ADR-0017: The look of the "+"

- Status: Accepted
- Date: 2026-11-12

## Context

[ADR-0016](0016-forms-for-a-task-open-in-a-sheet.md) put a "+" that adds an expense on every screen: a block with the notch in the middle of the phone bar and a floating button from 40 rem. Both looked wrong. The notched block was a dark box wider than its column, and the notch left the glyph off-center in it. The floating button sat over the content, with a place of its own to find in the tab order and in the room the page keeps at the bottom. Several looks for the "+" were tried side by side in Storybook, on a phone bar and on a wide screen.

## Decision

Confirmed by the owner:

- **Phone bar:** five equal columns. The middle one is a small flat square in the accent color, with the "+" centered in it, over the word "Add": the same icon over a word as the tabs. It is the one box of the interface with no notch, since it stands inside the edge of the bar and a notch there would be an L inside an L.
- **From 40 rem:** no floating button. The header holds a text action, "Add expense", next to Expenses. It opens the same sheet.
- Everything else in ADR-0016 stands: the sheet, the "+" from any screen, the start inside a group, and the logo and Expenses only leading home. This refines ADR-0016 without superseding it.

## Consequences

- Each tab of the phone bar is 64 px at 320 px (five equal columns), where it was 68 px.
- The "+" has a visible word on a phone, so it reads as one more tab that does something instead of going somewhere.
- The page no longer keeps room at the bottom for a floating button, and the toast no longer rises above one.
- The header of a wide screen holds one more word on its left, still balanced with the three on its right, so the logo stays in the middle.

## Alternatives considered

- Keeping the notched block in the bar: it was the problem.
- A big thick "+" with no box, an even ink outline, or a larger square rising over the bar: the first has no edge to tell it is a control, the outline reads as a field, and the raised square covers what scrolls under the bar.
- A square with no word: the other four columns have one, so the middle one would be the exception.
- Keeping the floating button on wide screens: it covers rows and needs its own care in the tab order, for a screen where the header has room.
