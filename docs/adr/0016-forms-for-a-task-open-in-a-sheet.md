# ADR-0016: Forms for a task open in a sheet

- Status: Accepted
- Date: 2026-11-10

## Context

The add form was a collapsible panel at the top of the home screen. Because of it the logo and Expenses had to open and collapse it, the form pushed the list below the fold, Edit and Duplicate had to scroll back up to it, and the group screen and Settle up each had a copy of the same panel. Logging an expense should still take seconds and work one-handed ([ADR-0010](0010-edit-duplicate-and-delete-expenses.md)).

## Decision

Confirmed by the owner:

- A form for a task (adding, editing and duplicating an expense, settling up) opens in a **sheet**: a bottom sheet on a phone (below 40 rem) and a centered dialog from 40 rem. It is one component, a variant of `Dialog`, not a second one.
- A **"+"** adds an expense from any screen: the action in the middle of the phone bottom bar, a floating button from 40 rem.
- Inside an open group (or its settings) the "+" starts a shared expense in that group. The group is where it starts, not a lock: the person can switch to Just me or another group. Editing or duplicating a shared expense keeps its group.
- The logo and Expenses only lead home. Neither opens, collapses or changes a form.
- Closing an add keeps what was typed; closing an edit or a copy ends it, as Cancel does. Saving an add closes the sheet.
- Disclosures that show information or the actions of a row (the rows of expenses, categories, entries and people, the list filters, Everyone's balance, the closed and archived groups, the numbers of the charts) stay as they are.

This refines ADR-0010 without superseding it: Edit and Duplicate still replace a half typed expense without asking, and nothing is saved by Duplicate until Add.

## Consequences

- Adding several expenses in a row costs one "+" each. If it bites, a way to keep the sheet open is a later decision.
- The phone bar holds four destinations and an action, so each tab is narrower (68 px at 320 px instead of 80).
- The page behind a modal is inert, so a toast cannot be answered while a sheet is open; a toast comes after the sheet closes.
- Away from the home screen a saved expense has no list to animate into, so a toast says it was added.
- The keyboard with a bottom-anchored sheet cannot be judged without a real phone; it is checked on the prerelease ([ADR-0015](0015-github-actions-deploys-and-a-prerelease-worker.md)).
- No server, migration, API, outbox or sync change.

## Alternatives considered

- A fixed button above the bottom bar: it covers the rows that scroll under it.
- A docked strip above the bar: it never covers anything but costs height on a small phone, with two fixed bars stacked.
- A side panel on wide screens: it enters from the right, which reads as a change of route.
- Keeping the disclosures: the logo and Expenses keep fighting over one panel, and each form is copied on three screens.
