# ADR-0023: Buttons and fields draw their notch as they are used

- Status: Accepted
- Date: 2026-11-13

## Context

Every button was a box with the full notch (an ink edge on the left and at the bottom) and nothing else changed when it was hovered or pressed; the danger notch was the faint hairline, so Delete looked weaker than Cancel, and a toggle that is on looked like a primary. Several directions were compared side by side in Storybook, on a phone, in both themes. The owner chose one where the box rests as its bottom line and the left edge grows with use.

The fields had the same full notch at rest, with the label always above the box and the accent ring as the only sign of the focus, which a text field shows on a tap too. The owner asked for the fields to read as the same family as the buttons, with the label inside the box. Three directions were compared in Storybook: the label floating inside a taller box, the label waiting inside the box and rising above it, and the label always above with only the line changing. The owner chose the first.

## Decision

Confirmed by the owner, for the `Button` and `ButtonLink` boxes (the ghost is unchanged):

- **At rest** the box has only its bottom edge, in ink (`--size-1`).
- **On hover** the left edge grows from the bottom to half the height, only where the device can hover.
- **While pressed** it grows to the whole height, which draws the L the app used to show at rest. A toggle that is on keeps the whole L.
- **Danger** draws both edges and the text in `--color-danger`. A primary button darkens its fill on hover.
- **Disabled** is the hairline at the bottom with no left edge, and its text in secondary ink, whatever the variant.
- The growth is a `transform` over `--duration-base`, so reduced motion makes it instant.

And for the fields (a `Field`, so every text field, `Select` and date in the app, and the box of a field whose label is elsewhere):

- **The same line.** At rest only the bottom edge in ink, half the left edge on hover where the device can hover, and the whole L while the field has the focus or a `Select` is open. The field keeps its `--color-bg-secondary` fill.
- **The ring only from the keyboard.** The accent ring goes round the box, as before, only when the focus came from the keyboard (the last thing done was Tab, not a press). A text field claims `:focus-visible` on a tap too, so the page keeps track of how the focus last moved; a tap or a click shows the L alone.
- **The label floats inside the box.** The box is 3.5 rem tall. While the field is empty and idle, the label sits where the text goes, in secondary ink, and is the only text in the box; with the focus or a value it shrinks to the top of the box (`transform`, over `--duration-base`) and the text sits under it. A `Select` and a date always hold a value, so their label is always up. The label is still a real `<label>`, never a placeholder.
- **An icon inside.** A field can hold an icon at its start (the magnifying glass of the Search), and the label and the text start after it.
- **An error** draws the bottom edge and the L in `--color-danger`; its message is still under the field. **Disabled** is the hairline at the bottom, the label and the text in secondary ink.

This refines the notch rule of DESIGN.md for buttons and fields without superseding an ADR. Cards, rows, the checkbox, the options of a `ChoiceGroup`, the open list of a `Select` and the other boxes keep the full notch.

## Consequences

- On a touch screen, where there is no hover, a button at rest is its bottom line alone and the L shows only while it is pressed. The owner accepted it and wants to judge it on the phone.
- A raw `<button>` that is not a `Button` (the toggle of a disclosure) keeps the full notch.
- A busy state was tried (a bar sweeping along the bottom edge) but no caller needs it yet, so it is not part of this decision.
- A field is 3.5 rem tall instead of 2.75 rem, so a form is longer. A button beside a field (Save next to the income) lines its bottom edge up with the field's.
- On a sheet, which is `--color-bg-secondary` like the field, a field reads as its label and its bottom line.
- A label that does not fit the width is cut with an ellipsis; screen readers still read it whole.

## Alternatives considered

- The full L at rest with a tint on hover and the box sinking when pressed: no change of identity, but hover and press say little.
- Two tiers of fill, with an ink stamp when pressed: a clear hierarchy, rejected by the owner.
- The notch only on the primary button: the cleanest hierarchy, rejected by the owner because it breaks the notch rule too far.
- A half-height left edge at rest on touch screens, so a button reads as one: not chosen; the owner prefers the pure version and will judge it on the phone.
- For the fields, the label waiting inside a 2.75 rem box and rising above it, where it stands today: no change of height, not chosen. The label always above with only the line changing: the least change, not chosen.
- The focus of a field as an L in the accent, or the L with the ring on every focus: not chosen.
