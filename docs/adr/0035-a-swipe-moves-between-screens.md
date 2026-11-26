---
status: Accepted
date: 2026-11-15
tags: [navigation, motion]
specs: [bottom-navigation.md]
summary: 'Below 40 rem a sideways swipe moves between the screens of a section: Expenses, its tabs, Groups, Summary, Settings.'
---

# ADR-0035: A swipe moves between screens

## Context

On a phone the destinations are a bar at the bottom ([bottom navigation](../specs/bottom-navigation.md)) and, on Expenses, the tabs of the pinned groups in its title ([ADR-0021](0021-pinned-groups.md)). Going between them already slides the screens as one strip, in the order they are drawn. The owner wants to move along that strip with a swipe of the finger, as the slide suggests.

## Decision

Confirmed by the owner:

- **Below 40 rem, a swipe across the screen of a section goes to its neighbour**, along one strip: Expenses, its pinned tabs in the order of its title, then Groups, Summary and Settings in the order of the bar. A swipe to the left goes right along the strip (the `next` slide), to the right the other way (`previous`). The ends stop: nothing before Expenses, nothing after Settings.
- **Coming back to Expenses** from Groups lands on the tab shown last, as the bar's Expenses does, not on the last pinned tab.
- **Only from the screen of a section** (`/`, `/groups`, `/summary`, `/settings`). A deeper screen (a group, the charts, a page of the settings) and the page of an invitation take no swipe: they have the way back.
- **It counts once the finger lifts**, and then the screen slides as a press on the tab would: a swipe that crossed 30 % of the width, or a flick of 48 px or more, and mostly sideways (at least twice as far across as down).
- **It never takes a drag that belongs to something else**: not from the outer 24 px of each side, left to the back gesture of the system; not from a field, a dialog, a box that scrolls sideways or what asks for none (`data-no-swipe`); not with a mouse or a pen. A swipe on the main area only, never on the header or the bar. The page keeps scrolling and zooming: the main area leaves a sideways drag to the swipe (`touch-action: pan-y pinch-zoom`).
- **A swipe during a slide** starts the next one. A finger that moved is not a tap, so it doesn't end the running slide and repeat a tap under it.
- From 40 rem nothing changes: the header holds every destination in sight.

## Consequences

- The strip is worked out in one place (`swipeTarget`), from the path, the tab shown, the pinned groups and the tab shown last; the gesture (`useSwipe`) only says left or right.
- The screen does not follow the finger yet: it moves only once the swipe counts. Following it is a separate step, kept only if it works well where view transitions run.
- Nothing on a screen of a section may use a sideways drag of its own unless it scrolls sideways or is marked `data-no-swipe`.

## Alternatives considered

- **Only along the pinned tabs of Expenses.** Narrower, but the bar already reads as the same strip, and stopping at the last tab would surprise.
- **Every screen, deeper ones included.** A deeper screen has no neighbour on the strip, and a swipe from the left edge there is the system's back.
- **The screen following the finger from the first version.** Driving a view transition by hand is more fragile; the slide on release comes first and stays as the fallback.
