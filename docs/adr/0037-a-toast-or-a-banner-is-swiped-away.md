# ADR-0037: A toast or a banner is swiped away

- Status: Accepted
- Date: 2026-11-17

## Context

On a phone the toast could only be cleared with its dismiss button, and the banner of ADR-0025 with its button or a swipe to the side. The owner wants both to go the way a notification of the phone goes: dragged off with the finger, and toward the edge they came from too, since that is where a finger pushes them back. The owner also asked whether the toast should move to the top like the banner, and kept it at the bottom: the toast answers what the person just did, so its Undo stays near the thumb that pressed Delete, while the banner tells what somebody else did and comes from the top.

## Decision

Confirmed by the owner:

- **The toast that goes away by itself is swiped away to the left, to the right or down**, the edge it came in from. **A pinned toast too, when it names what a swipe answers**: the offer of a new version does, and its swipe is Later. A swipe on a pinned toast is one more way to answer it, so the toast never goes while what it asks stays open; one that names no such answer stays until it is answered.
- **The banner is swiped away to the left, to the right or up.** A swipe down does nothing.
- **One gesture, the same for both.** After a move of 8 px the drag keeps the axis it went along first. The box follows the finger along that axis; toward a side it can't go to, it moves a quarter of the finger's way and comes back. Let go past a third of its width (to a side) or half its height (up or down), it goes at once where it was let go, with no fade, since the finger already took it out; short of that, it comes back. A drag holds the count of the time left, and the drain of the toast with it, and a tap that became a drag runs nothing.
- **Mouse and touch alike.** The box takes the whole gesture (`touch-action: none`), so a vertical drag on it never scrolls the page. The swipe between screens of ADR-0035 never starts on it, since it is outside the main area.
- The dismiss button, Escape and the 8 s stay: the swipe is one more way, never the only one.

## Consequences

- One hook (`useSwipeAway`) drives both boxes; each says which sides it can go to. A pinned toast takes the answer of a swipe with its options; without it, it is not swiped.
- A pinned toast still has no dismiss button, no count and no Escape.
- With reduced motion the box still follows the finger: the person moves it.
- Without a pointer that drags (a keyboard, a screen reader), the dismiss button and Escape remain.

## Alternatives considered

- **A pinned toast never swiped:** the first version of this decision, so that it stayed until answered. On a phone the offer of a new version was the one toast a finger couldn't push away, and Later is what a swipe means there anyway: a new version that waits is taken at the next cold start.
- **Every pinned toast swiped with no answer named:** the box would go while the app still believed it was showing.

- **The toast at the top, like the banner:** far from the thumb that pressed Delete, under the header that hides on scroll; and it would mix the result of what you did with what others did.
- **Sideways only for both:** the banner already did it, but pushing a box back toward its own edge is the first move a finger tries.
- **A flick that counts by its speed:** left out for now; distance alone is what the banner already did, and it is easy to predict.
