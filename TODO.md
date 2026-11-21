# TODO

Items build on each other in the order they appear below. Delete an item when it is done and its docs are updated; the numbers stay.

## 17. Revisar junto al owner los componentes, a11y y diseño

El owner pedirá cambios en diferentes componentes llegado el momento, ir de la mano paso a paso.

Los componentes que sean el "mismo" pero diferente, reusar el mismo pero con diferentes size o variants.

The design system is in Storybook now (`pnpm storybook`, [ADR-0011](docs/adr/0011-design-system-in-storybook.md)): the stories and their accessibility panel are where to start. What is left of this item, with the owner. Done on 2026-11-01: the update toast, the swatch pickers, the rings of `ChoiceGroup`, `Select` and `Dialog`, the ghost buttons, the hints and the categories screen on sheets.

- **Stories of the groups.** None yet for Settle up, the Leave and Delete panels, the steps of a person, `InvitationLink` or `InviteFriend`; the ledger row has one (`Features/LedgerRow`).
- **`:focus-visible` of the rest.** The ring of `ChoiceGroup`, `Select` and the `Dialog` is done. What is left is the global one, on buttons, links and fields: with the gray accent it sits next to the ink edge and may be hard to tell apart, which only the owner's eye can say. A throwaway story that forces the focus on each component, to look at every accent in light and dark, would settle it.

## 19. A daily clean-up on the server

A Cron Trigger of the Worker (free tier), once a day: delete the invitations that expired, the push subscriptions a push service answered `404` or `410`, and the sessions of Better Auth that ended. Soft-deleted expenses and entries stay: the `seq` cursor needs them. Each environment gets its own trigger; the privacy notice changes if what is kept changes.

## 20. Performance

Measure before changing anything: the size of the bundle per route, and the LCP and INP on a slow phone (a build, `pnpm preview`, throttled). Then check that the charts, the groups and the settings pages load lazily and stay out of the first paint, and that the persisted cache doesn't hold back the first screen.

## 21. A note on an expense (analysis first)

An optional free text on an expense. Analyse before building: where it shows (list row, detail, search), whether shared entries get one too (today their text is empty for settlements), what the export carries, and the length limit. The migration only adds a column.

## 22. Search by amount

The search of the list also finds amounts: a plain number (`12,30` or `12.30`, in the locale's format) matches that amount, and `>50` / `<10` match above or below. Decide whether it reads the whole amount or your part, as the list shows it.

## 23. Compare months in the Summary

A line in the Summary that compares the month so far with the same days of the month before ("15 % more than October at this point"). The charts already compare spans (`comparison`, `previousRange`): reuse it.

## 24. Budgets warn earlier

A limit also warns when it reaches 80 % of it, not only when it is passed. It still only warns ([ADR-0009](docs/adr/0009-budgets-only-warn.md)).

## 25. Frequent expenses (analysis, likely dropped)

When the "+" opens, offer the 3 or 4 texts the person types most, to fill the form in one press. Not recurring expenses ([ADR-0010](docs/adr/0010-edit-duplicate-and-delete-expenses.md)). Analyse whether it earns its place in the form; the owner will probably drop it.

## 26. Remind a debt with a push

In the balances of a group, a "Remind" on a debt you are owed sends a Web Push to the debtor, on their devices that allow it. Needs an ADR that refines [ADR-0025](docs/adr/0025-shared-expenses-notify-the-people-they-concern.md): how often one can remind (a limit per pair and day), what the push says, and that it needs a connection.

## 27. Export a group, import, and a printable view

- **Export one group** to CSV, from the group's screen, for people who don't use the app.
- **Import** a backup (the JSON of the export). Out of scope today ([ADR-0001](docs/adr/0001-scope-of-the-app.md), [ADR-0012](docs/adr/0012-shared-expenses.md)): a new ADR first, deciding what is imported (own expenses, categories, budgets; never groups), and how ids and conflicts are handled.
- **A printable view**: a new page for a group or for your expenses over a range, laid out for printing or saving as PDF from the browser (`@media print`).

## 28. Empty states and the first run

Go over what a new person sees on every screen: no expenses, no groups, no friends, no budget, no income. Each empty screen says what it is for and offers the one action that fills it.

## 29. Performance with many people and a lot of data

Fill a local D1 with a heavy account: many friends, many groups with many members (users and dummies), thousands of shared entries and years of personal expenses. Then measure the first load, the sync from an empty device (the pages of `seq`), the watcher's `GET /groups`, the balances and simplified debts of a big group, the list with its search and filters, the charts over a long range, and the size of the persisted cache and of the outbox. Also check the Worker's answers against the limits of the free tier (CPU time, D1 rows read).

## 30. A Lighthouse pass on every screen

After the accessibility audit now under way is done, run Lighthouse (the CLI through `pnpm dlx`, never a dependency) on every screen, signed in, and fix what it finds: accessibility first, then best practices and performance (a starting point for item 20).

- **On localhost, never production**: `pnpm build`, then `pnpm preview`, against the local D1.
- **A fake session**: make a test user and its session in the local D1, as `signIn()` of the server tests does, sign the cookie with the `BETTER_AUTH_SECRET` of `.dev.vars` and hand it to Lighthouse as a `Cookie` header (`--extra-headers`). Google is never involved, and the owner's own session is never used.
- **Data on screen**: fill that user with expenses, budgets, income, custom categories, friends and groups, so no screen is measured empty (the same seed can serve item 29).
- **The screens**: Expenses (and a pinned tab), Groups, a group, `/groups/new`, Summary, Charts, Budgets, Settings and its pages, the join page, and the sign-in screen without the cookie. Light and dark theme, phone and desktop widths.

## 18. More locales

Locales beyond `en` and `es` (the owner's `spa-anicalendar` also ships `fr` and `de`) come among the last things, not now.
