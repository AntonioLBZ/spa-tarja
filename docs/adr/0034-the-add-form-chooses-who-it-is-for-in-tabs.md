---
status: Accepted
date: 2026-11-15
refines: [ADR-0026]
tags: [expenses, groups]
specs: [expenses.md, shared-expenses.md]
summary: 'For (Just me / Shared) is the first row of the add form, underlined-word tabs like the pinned ones, still a radio group (`ChoiceGroup` variant `tabs`); With goes first inside Split; its summary is two short lines at the end of the row of the tabs ("With Flat" / "Equally among 3"), describing the Split toggle, whose toggle says who paid after the word while closed, on one line, cut with an ellipsis ("Split · Paid by you"), with no icon; no group is guessed (the screen''s, else the last used, else the only one, else nothing chosen and Split opens; Add marks With); your own member first in Paid by and Who''s in; a sheet''s edge shadows are drawn only while its content overflows (`data-overflow`, kept by a `ResizeObserver`); refines ADR-0026.'
---

# ADR-0034: The add form chooses who it is for in tabs

- Amended: 2026-11-17, by the owner: who paid moved from the summary beside the tabs into the toggle of Split.

## Context

In the add form of [ADR-0026](0026-the-add-form-keeps-its-button-in-sight-and-folds-its-options.md), For (Just me or Shared) is a `ChoiceGroup` of boxes under Category, so the choice that changes the whole lower half of the form is made after the amount, the description and the category, and it looks like any other field. Shared then shows With, the group or friend, on its own above the Split disclosure, although who it is shared with is part of how it is split. And in Who's in and Paid by the person's own member is wherever the group put it, so the row a person checks most often moves from one group to another.

## Decision

Confirmed by the owner:

- **For is a row of tabs at the top of the form**, its first row, above Amount: the words Just me and Shared with the current one in ink and underlined, the other in secondary text, no notch and no rule, as the tabs of the pinned groups in the title of Expenses ([ADR-0021](0021-pinned-groups.md)). It stays a radio group (the `tabs` variant of `ChoiceGroup`, its legend kept for assistive technology and hidden from sight), so the arrow keys move between the two as in any radio group. It shows when it shows today: not while an expense is edited, not when the form is opened inside a group.
- **With goes inside Split**, first in its panel, before Paid by.
- **The summary of the split sits beside the tabs.** While Shared is chosen, the end of the row of the tabs says it in two short lines, one per part, in small secondary text aligned to the end: "With Flat", "Equally among 3", each half the height of the tabs. Each line is cut with an ellipsis when it doesn't fit, and the whole summary goes under the tabs, still aligned to the end, when the row is too narrow for both (a phone of 320 px). Where there are no tabs (an edit or a copy of an entry of a group) it takes the same place, alone at the end of the first row. It describes the toggle of Split for assistive technology (`aria-describedby`), read as one sentence with a pause between the lines.
- **The toggle of Split says who paid.** While it is closed and a group is chosen, the toggle reads "Split" and then, in secondary text, who paid: "Paid by you", "Paid by Bea", "Choose who paid", as More options says its day and payment. It never wraps: the payer is cut with an ellipsis when the line doesn't fit. Open, it reads "Split" alone, as Paid by is in sight. Neither toggle has an icon: the word says it, and the three dots More options would take are the icon of the category Other.
- **No group is guessed.** With starts on the group of the screen, else on the one used last on the device, else, when the person has only one group or friend, on that one; otherwise nothing is chosen, the summary says "Choose who it's with" and Split opens by itself when Shared is picked, so the person picks. Add with nothing chosen marks With and opens Split, as Add opens what folds a problem ([ADR-0026](0026-the-add-form-keeps-its-button-in-sight-and-folds-its-options.md)).
- **You first.** In Paid by and in the rows of Who's in, the person's own member comes first and the others keep the order of the group.

- **A shadow goes with what scrolls.** The shadows of the edges of a sheet or a page ([ADR-0018](0018-a-shadow-where-content-scrolls-under-an-edge.md)) are drawn only while what it holds is taller than it, a mark kept by the sizes of the dialog and of what it holds rather than by its scroll, so folding Split or More options after a scroll takes the shadow of the title row away with the scroll.

This refines ADR-0026, which put For under the head as a group of boxes, With above Split and the summary of the split above its toggle on one line.

## Consequences

- The form says what kind of expense it is before anything is typed, and its fields read top to bottom in the order they are chosen.
- An expense is never shared with a group the person didn't pick or use last: with two or more and no memory, the first in the list is no longer taken.
- The tabs are drawn by `ChoiceGroup`, which gains a variant and its story; the pinned tabs stay links, as they lead somewhere.
- `Disclosure` gains `oneLine`, which keeps the summary and the hint on one line and cuts the hint, with its story.
- Only the order in which the people are shown changes: the shares, the seed and what is saved are the same.
- No server, migration, API, outbox or sync change.

## Alternatives considered

- Tabs with `role="tablist"` and panels: the two tails aren't panels the person browses but a choice the form saves, which a radio group already says, with the arrow keys for free.
- Keeping With outside Split: one more field in sight for a choice that, once made, is remembered.
- Starting on the first of the list, as before: a group the person may not mean, out of sight now that With folds.
- The whole summary in the toggle of Split ("Split · With Flat · Paid by you · Equally among 3"): too long for one line on a phone.
- An icon before Split (`call_split`, an arrow that forks): left out, the word already says it and More options has none.
