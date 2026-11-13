# ADR-0022: The theme changes as an ink drift

- Status: Proposed
- Date: 2026-11-12

## Context

A theme change fades the colors over `--duration-slow` (360 ms, `withColorTransition`). It is correct and nobody notices it. Three ways to reveal the other theme were tried side by side in Storybook, each on the whole page: ink drifting in from a corner, a veil of ribbons in the accent color, and a plain circle growing from the button. The owner picked the ink.

DESIGN.md said to never use a View Transition for the theme, because the page goes inert while it runs and a click in the middle of the fade lands on `<html>`. The app already runs a view transition on every screen change, so that cost is already paid; what is new is that this one lasts about a second.

## Decision

- Changing the theme (Light, Dark, System) reveals the new theme as ink drifting in from where the person pressed (the top right corner when the change comes from the keyboard): the browser keeps a picture of the old page and of the new one, and the new one is shown through a mask of soft blobs that grow from that one point, drifting apart a little to make the edge lumpy, and cover the screen. The mask is animated by script from a registered custom property; nothing is drawn per frame.
- It is flat: the ink has no color of its own, it is the new theme itself. The veil in the accent color was left out because it needs translucent strokes, which break "Solid fills only".
- It takes `--duration-reveal`, a new token of 1080 ms, with `--ease-standard`. Reduced motion zeroes it with the other durations, and then, like where the browser has no view transitions, the theme changes with the old fade of the colors.
- While it runs, the header, the page, the bottom bar and the underline give up their own `view-transition-name`, so that the mask covers them as part of the page instead of each crossfading apart.
- This refines the rule of DESIGN.md "Themes" against a View Transition for the theme, and keeps the fade as the fallback.

## Consequences

- The browser gives the live page no pointer events while a view transition runs, whatever `pointer-events` says. So a tap during the ink ends it at once and is repeated on what is under it, and a theme chosen before the last ink has had its `--duration-reveal` ends that one and changes with the plain fade of the colors. Each ink takes two pictures of the whole screen, so they are never started back to back.
- Frames cost a repaint of a mask over two full-screen pictures: cheap on a recent phone, to be checked on a low-end one.
- There is one more motion token, outside the 120, 200 and 360 ms scale.

## Alternatives considered

- The veil in the accent: it breaks "Solid fills only" and, with the default gray accent, shows as gray smoke.
- A circle from the pressed button: simple and cheap, but plain.
- A WebGL shader: needs a screenshot of the page in a canvas, which has no clean way to be made, and costs a context on a phone.
- Keeping the fade: it works, but it is not seen.
