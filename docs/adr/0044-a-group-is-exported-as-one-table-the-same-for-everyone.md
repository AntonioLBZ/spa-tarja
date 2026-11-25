# ADR-0044: A group is exported as one table, the same for everyone

- Status: Accepted
- Date: 2026-11-24

## Context

The export of the settings is the person's own: the JSON holds every group as stored and the CSV holds the person's part of each shared expense ([exporting your data](../specs/export.md)). Neither shows a group to somebody who doesn't use the app, or lets a person take one group to a spreadsheet to do sums or keep it elsewhere. Importing a backup was weighed in the same item and left out: the owner sees no real use for it, so [ADR-0012](0012-shared-expenses.md) still holds (export only).

## Decision

- **One table per group, the same whoever makes it.** Nothing in it is the person's: no "your part", no "You", no payment method (only the payer has one, and it is theirs). People are named as the group names them (the numbers of equal names, "Deleted user"), a merged placeholder inside the member it was merged into.
- **A column per person, each cell what the entry does to their balance**: whoever paid is credited the whole and every share is debited, as the balances add it up ([balances](../specs/balances.md)). A settlement is a row like any other (the one who paid gains, the one paid loses), so every column adds up. A cell is empty for a person who neither paid nor has a share, and zero for one who is in it and comes out even. Only the people in a row of the range, or with an opening balance that isn't zero, have a column.
- **The filters of the ledger** ([ADR-0042](0042-the-ledger-of-a-group-is-searched-and-filtered-from-one-button.md)): the same button and sheet, with the search, Type, the category, From and To, Paid by and With, all empty at the start, which is the whole group. Narrowed by the days alone, a first day adds a row before the entries with the balance each person held then, and the last row is the balance at the end: the columns are the opening balance plus the rows. Narrowed by anything else, the rows are only some of what moved the balances, so there is no opening balance and the last row is **the total of these rows**, each column the sum of what it shows; the table never says "balance" of a number its rows don't make. The search finds an entry by its text, category and payer, and by its whole amount and what it does to any person, never only to the one who searches. The caption says the days and each filter in use, so paper says what it holds.
- **A page of its own**, `/groups/$groupId/export`, reached from the settings of the group (open or closed): **Print**, which opens the browser's print (where a PDF is saved too), and **Download CSV**, with the button of the filters at the end of their row; then the table. On paper, the app's header, bar, toasts and banner and the controls of the page are gone, the table takes the width of the sheet, a row is never cut between two sheets, and the colors are those of the light theme whatever the theme.
- **The CSV is the same table**: the columns date, text, category, paid by, amount and currency, then one per person, signed, with the opening and closing balances as rows of their own; the numbers, delimiter, byte order mark and guard against formulas of the other CSV.
- **The amounts**: on screen and on paper each cell always shows its sign; the color and the symbol of the currency follow Settings → Amounts ([ADR-0028](0028-amounts-show-which-way-they-go.md)), as they are only how money is drawn, and the color is never the only cue. The whole of an expense is neutral. The CSV writes the currency code.
- Built on the device from what it holds, so it works offline; while the group's expenses haven't reached it, the page says so and its actions are off.

## Consequences

- A group with many people gives a wide table: on screen it scrolls in its box, and on paper the person can choose landscape in the browser.
- The ledger of the screen keeps a settlement neutral ([ADR-0030](0030-a-ledger-row-says-who-paid-and-what-it-does-to-you.md)), while this table signs it: here the columns have to add up.
- What each person was due of an expense is not a column of its own, but it is the amount minus the cell for whoever paid and minus the cell for everybody else, so nothing is lost.

## Alternatives considered

- **A column per person with their share**: closer to "who consumed what", but a settlement fits no column and the columns don't add up to the balances.
- **One row per share** (an entry times a person): easy to filter in a spreadsheet, hard to read on paper.
- **A table per person**, each with what it cost, what they paid, their part and its effect: it repeats what each column already says and, built from the side of whoever exports it, it is not the same for everyone.
- **Print styles on the screen of the group**: its ledger is folded and shows a page at a time, so it would print half of it.
- **A PDF made by a library**: a dependency for what the browser already does.
- **The printable view of the person's own expenses** in this decision: it is the person's side, not the same for everyone, so it is a decision of its own ([ADR-0045](0045-your-expenses-print-as-the-list-shows-them.md)).
