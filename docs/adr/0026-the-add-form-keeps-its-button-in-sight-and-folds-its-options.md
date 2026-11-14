# ADR-0026: The add form keeps its button in sight and folds its options

- Status: Proposed
- Date: 2026-11-14

## Context

The add form is one column: Amount, Description, Category, Date, For, and under them the tail (the payment, its charge date, your part, the installments and their parts; or, shared, With, Paid by, Split, the people and How you paid). On a phone, in the sheet of [ADR-0016](0016-forms-for-a-task-open-in-a-sheet.md), Add is at the end of all of it, below the fold, so logging a coffee means typing the amount and scrolling down to find the button. Most expenses are made today and paid now, so the fields that take most of the height are the ones least often touched.

Add was also off until the expense could be saved. A button that does nothing says nothing about why: the person has to find the field that is missing on their own. And with Amount empty the browser stopped the submit with its own bubble, not the message of the app.

## Decision

Confirmed by the owner:

- **Add stays in sight.** Below 40 rem the form takes the whole screen (the `page` variant of `Dialog`): its title row is stuck to the top while the form scrolls under it, with the way back (`chevron_left`, named Close) at its start and the main button (Add, or Save while editing) at its end, where the × was. The way back closes it as the × did, so an edit or a copy is ended by it, as Cancel did, and there is no Cancel. From 40 rem it stays the floating dialog of [ADR-0016](0016-forms-for-a-task-open-in-a-sheet.md), its × at the end of the title row, and the main button (with Cancel beside it while editing or duplicating) is in its actions, stuck to its bottom edge while the form scrolls under them, as the actions of the list filters are ([ADR-0024](0024-the-list-filters-open-in-a-sheet.md)). The actions of a sheet that holds a form may hold its main button, which is a box; the others stay ghosts. The title row of the page, and the actions of a sheet, cast the shadow of [ADR-0018](0018-a-shadow-where-content-scrolls-under-an-edge.md) while the form goes on under them.
- **More options.** Amount, Description, Category and For are always shown, and so is With for a shared expense. Who paid, how it is split and who is in fold under a `Disclosure` "Split" whose toggle says them while it is closed ("You paid · equally among 3 people"); it opens to change them, and on Add when something in it is to fix. A share by percent ends with "%" in its box. The day, how it is paid (its charge date and your part) and the installments (and their parts), or, shared, the day and How you paid, go under a `Disclosure` "More options" at the end of the form, kept in the page while closed. Its toggle says what they hold while it is closed (the day and the payment), so nothing is saved that the person can't see. It starts open when an edit or a duplicate holds something other than what a new expense starts with (another day, a card, a plan), and it closes again once a new expense is added.
- **Add is never off.** Pressing it checks the form: every problem is marked on its own field, with its message, and the focus goes to the first one (opening More options first when it is there). A problem that was only a quiet line while typing (what is left to assign, a payer who is gone) is said as an error once Add has been pressed, until the form is saved. A marked field clears as it is corrected. A second press while saving is ignored, without dimming the button.

This refines ADR-0016, which put the form's actions at its end and kept Add off until the expense could be saved.

## Consequences

- On a phone the head of the form and its button fit on one screen for the usual expense, and the rarer fields are one tap away; a sheet anchored to the bottom no longer shows a strip of the page above it.
- The person learns what is wrong by pressing Add, in words and on the field, instead of guessing from a dim button.
- The form gives its button to the dialog: the button sends the form by its id. The sheet reads the width (`useWide`) to choose the page or the floating dialog.
- No server, migration, API, outbox or sync change.

## Alternatives considered

- Fields two to a row (Amount with Date, Description with Category): shorter, but cramped at 320 px, and the payment and installments still push Add down.
- Only the button stuck to the foot: the button is in sight, but the form stays as long.
- Keeping Add off with a hint of what is missing: a hint far from the field, and still a button that does nothing.
