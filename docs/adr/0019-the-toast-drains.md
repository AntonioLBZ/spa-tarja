# ADR-0019: The toast drains

- Status: Accepted
- Date: 2026-11-12

## Context

The toast of ADR-0016's time was a box of ink with a thin page-colored rule inside its bottom edge as the time left. The owner didn't like how it looked. Four directions were tried side by side in Storybook, on a phone and a wide screen, in both themes: a bar docked on the tab bar, a card with the notch, a strip under the header, and a box whose ink drains. The owner chose the last, with a bare mark in front of the message and as wide as its column.

## Decision

Confirmed by the owner:

- **The time left is the fill.** The toast stays filled with ink, but over the 8 s the ink drains from the right toward the left, leaving a lighter tone (a mix of the ink and the page) behind. The rule inside the bottom edge goes away. The count still holds while the pointer or the focus is on the toast.
- **Width:** the toast takes the whole width between its margins on a phone, and the whole content column (up to 40 rem) on wider screens, centered. Message at the left, actions at the right.
- **A mark in front** of the message, when the toast reports something done (a delete that can be undone, an expense added): the `check` icon, bare, in the color of the text, with no box around it and close to the message. A toast that warns (a budget crossed) or asks (a new version) has none.
- A pinned toast is all ink: it has nothing to drain.
- Everything else stays: ink fill, the ghost actions, the dismiss glyph, one of each kind at a time, the pinned one above, the 8 s timer, the placement above the tab bar. This refines the `Toast` of DESIGN.md without superseding any ADR.

## Consequences

- The fill of a timed toast is not one flat token while it drains: it is a mix of two palette tokens. Text on both tones must keep a contrast of at least 7:1 in both themes.
- With reduced motion the drain is off and the toast stays all ink until it goes.
- `Toast.show` takes an optional `icon`, so callers choose whether the mark applies.
- Errors are still `Notice`s: a toast for an error was shown in the experiment but is not part of this decision.

## Alternatives considered

- A bar docked on the tab bar: reads as chrome, but two bands of ink stack and the message must fit one line.
- A card with the notch on the page color: in the language of the app, but it loses the one filled message that is noticed when it appears.
- A strip under the header: never fights the tab bar or the keyboard, but it is far from the thumb that pressed Delete, and the header hides on scroll.
- A content-wide chip in the corner of wide screens: the owner preferred the column width, with the actions always at the same edge.
