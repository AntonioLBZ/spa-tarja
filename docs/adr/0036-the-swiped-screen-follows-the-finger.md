---
status: Accepted
date: 2026-11-15
refines: [ADR-0035]
tags: [navigation, motion]
specs: [bottom-navigation.md]
summary: 'The new screen opens as soon as the finger goes clearly sideways and its view transition is held, the finger setting how far it has gone; let go of, it goes on (decelerating) or back, the old screen reopened from the history under the picture with no slide; no library; without view transitions or with reduced motion, the change on release of ADR-0035; refines ADR-0035.'
---

# ADR-0036: The swiped screen follows the finger

## Context

[ADR-0035](0035-a-swipe-moves-between-screens.md) made a swipe move between the screens of a phone, the slide playing once the finger lifts, and left following the finger as a step to keep only if it worked well. The owner wants it: a screen that only moves after the finger has gone feels late, and a swipe can't be taken back halfway. Tried in Chrome with touch: the slide follows, goes on, goes back, keeps the scroll of the screen it goes back to, and a second swipe during a slide starts the next one.

## Decision

Confirmed by the owner, refining ADR-0035:

- **The new screen is opened as soon as the finger is clearly going sideways** (past 10 px, twice as far across as down), with its slide, and the slide is held: the finger sets how far it has gone, a whole screen across being the whole slide. The two screens move as one strip under the finger, evenly, with the header, the bar and the pinned tabs as they are in a press.
- **Let go of**, it goes on to the end when the swipe counts (30 % of the width or a flick of 48 px the same way), decelerating over what is left of `--duration-slow`. Otherwise it goes back to where it started, and the old screen is opened again under the picture, from the history, with no slide of its own, before the picture goes away, so nothing is seen to change and its scroll is where it was. A flick back the other way never counts.
- **A touch that is taken away** (the browser starts scrolling, another finger) goes back the same way.
- **No library.** The view transition of the router is the slide: its animations are paused, made even and moved by hand. A library that animates elements would need both screens in the page at once, which the router doesn't render.
- **Where it can't follow**, as before: without view transitions, or with reduced motion, the screen changes once the finger lifts.

## Consequences

- One small driver (`followSlide`) holds the slide; the gesture (`useSwipe`) only reports how far the finger has gone and whether it goes on. The router skips the slide of the one change that takes a swipe back (`skipNextSlide`).
- Going back leaves the screen it went to in the forward history, as the back button of the browser would.
- A slide held under the finger leaves the page without pointer events until it ends, as every slide does.

## Alternatives considered

- **A gesture or animation library.** It moves elements, not the pictures of a view transition, so it would need both screens rendered side by side, a second way of drawing the slide, and a dependency.
- **Keeping the slide on release only.** Simpler and already there, but it can't be taken back halfway; it stays as the fallback.
