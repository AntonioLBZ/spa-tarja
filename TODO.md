# TODO

Items build on each other in the order they appear below. Delete an item when it is done and its docs are updated; the numbers stay.

## Needs the owner

- Check the layout on a real iOS Safari and Android Chrome (safe areas, keyboard, install, the Undo toast and that the backup and the spreadsheet download from the installed app), and the visual identity there: the Dot Matrix logo in the header, the amber accent (one of those the user can pick) next to the orange and yellow category icons, and the slide between screens (a browser without view transitions, like iOS Safari before 18, just switches).
- Offline, the income and new-category fields still look enabled while their buttons are disabled; disable the fields too?
- The spreadsheet writes the part of a plan as `2/3`, which Excel and Google Sheets may read as a date (2 March). Keep it as you asked, or write it another way (`2 of 3`, or two columns)?
- The selected column of the spending chart turns ink, which in the gray accent in dark is a weak change (`design.md` §8). Give it an ink frame instead?

## 15. Budgets (L)

The spec is written (`ARCHITECTURE.md` §5 "Budgets", `design.md` §5 "Budgets") and waits for the owner's review; then the plan, then the code with its tests. When the code lands, update the sections that still don't name the budgets (`ARCHITECTURE.md` §6, §8 and the backup in §5, `design.md` §3 Toast and §6 routes, `AGENTS.md`) and drop the "not built yet" notes.

## Far future (an idea to keep in mind, not planned)

A Splitwise-like function: expenses shared between people, who paid, who owes whom and settling up. It is out of scope today (`ARCHITECTURE.md` §1) and would change the model: every row belongs to one user, so it needs groups, invitations between Google accounts, access rules on the server, balances, and a way to relate it to "your part" of an expense and to the offline sync. Nothing to do now.
