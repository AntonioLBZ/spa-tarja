# TODO

Items build on each other in the order they appear below. Delete an item when it is done and its docs are updated; the numbers stay.

## Needs the owner

- Check the layout on a real iOS Safari and Android Chrome (safe areas, keyboard, install, the Undo toast and that the backup and the spreadsheet download from the installed app), and the visual identity there: the Dot Matrix logo in the header, the amber accent (one of those the user can pick) next to the orange and yellow category icons, and the slide between screens (a browser without view transitions, like iOS Safari before 18, just switches).
- Offline, the income and new-category fields still look enabled while their buttons are disabled; disable the fields too?
- The spreadsheet writes the part of a plan as `2/3`, which Excel and Google Sheets may read as a date (2 March). Keep it as you asked, or write it another way (`2 of 3`, or two columns)?
- The selected column of the spending chart turns ink, which in the gray accent in dark is a weak change (`design.md` §8). Give it an ink frame instead?

## 14. Category suggestion from your own history (S, client only)

Owner: it works like the current suggestion and stays simple. No list of earlier expenses and no amount filled in.

1. Only when the keyword classifier (`suggestCategory`) finds nothing and would give "Other", the words of the typed text are looked up in the user's earlier expenses. Doing it always is the other option the owner left open; this one is simpler and leaves the built-in classifier as it is.
2. A word counts when it has at least 4 letters (`normalizeText`, whole words) and every earlier expense that has it is in the same category. The category with the most such words wins, the one with the most expenses on a tie. A word seen in several categories is ignored, which also drops filler like "con" or "the".
3. It can suggest a custom category, which the keyword list never can; a category that no longer exists is skipped. The existing suggestion hint shows as now, and a category picked by hand is never replaced.
4. No new storage, no network and no new screen element: the expenses are already on the device. Tests: the pure function in `core`, and one in the form.
5. Docs: `ARCHITECTURE.md` (where the category is suggested); `design.md` only if the hint changes.

## 15. Budgets (L, architectural: spec before code)

Owner decisions: a monthly total and a limit per category, both; warnings inside the app only, no push. A budget never blocks anything: it only warns when an expense brings a limit near or over it.

1. Progress bars in Summary (the total and each category with a limit), a notice when an added expense brings a limit near or over it, and one when the leftover goes negative.
2. To settle in the spec: whether a limit holds for every month until changed or is set for a month; the thresholds (for example 80 % and 100 %); what counts toward it (`countedCents` by the day made, so a restaurant card counts your part; to confirm); the warning for a credit card whose charges pile up in a month (the open question of `ARCHITECTURE.md` §12); a category deleted while it has a limit; where limits are edited.
3. Storage like income, to confirm: a D1 table by an additive migration, `/api/budgets` behind `withUser`, cached for reading offline, editing needs a connection.
4. Docs: `ARCHITECTURE.md` §1 (budgets are no longer out of scope), §5, §8 if needed, `design.md` §5 (Summary).
5. Process: questions, approaches, a written spec and a plan before any code.

## Far future (an idea to keep in mind, not planned)

A Splitwise-like function: expenses shared between people, who paid, who owes whom and settling up. It is out of scope today (`ARCHITECTURE.md` §1) and would change the model: every row belongs to one user, so it needs groups, invitations between Google accounts, access rules on the server, balances, and a way to relate it to "your part" of an expense and to the offline sync. Nothing to do now.
