# ADR-0023: Buttons draw their notch as they are used

- Status: Proposed
- Date: 2026-11-13

## Context

Every button was a box with the full notch (an ink edge on the left and at the bottom) and nothing else changed when it was hovered or pressed; the danger notch was the faint hairline, so Delete looked weaker than Cancel, and a toggle that is on looked like a primary. Several directions were compared side by side in Storybook, on a phone, in both themes. The owner chose one where the box rests as its bottom line and the left edge grows with use.

## Decision

Confirmed by the owner, for the `Button` and `ButtonLink` boxes (the ghost is unchanged):

- **At rest** the box has only its bottom edge, in ink (`--size-1`).
- **On hover** the left edge grows from the bottom to half the height, only where the device can hover.
- **While pressed** it grows to the whole height, which draws the L the app used to show at rest. A toggle that is on keeps the whole L.
- **Danger** draws both edges and the text in `--color-danger`. A primary button darkens its fill on hover.
- **Disabled** is the hairline at the bottom with no left edge, and its text in secondary ink, whatever the variant.
- The growth is a `transform` over `--duration-base`, so reduced motion makes it instant.

This refines the notch rule of DESIGN.md for buttons without superseding an ADR. Inputs, selects, cards, rows and the other boxes keep the full notch.

## Consequences

- On a touch screen, where there is no hover, a button at rest is its bottom line alone and the L shows only while it is pressed. The owner accepted it and wants to judge it on the phone.
- A raw `<button>` that is not a `Button` (the toggle of a disclosure) keeps the full notch.
- A busy state was tried (a bar sweeping along the bottom edge) but no caller needs it yet, so it is not part of this decision.

## Alternatives considered

- The full L at rest with a tint on hover and the box sinking when pressed: no change of identity, but hover and press say little.
- Two tiers of fill, with an ink stamp when pressed: a clear hierarchy, rejected by the owner.
- The notch only on the primary button: the cleanest hierarchy, rejected by the owner because it breaks the notch rule too far.
- A half-height left edge at rest on touch screens, so a button reads as one: not chosen; the owner prefers the pure version and will judge it on the phone.
