# Plan: simplified debts (TODO item 28)

Specs: `balances.md`, `groups.md`, `shared-expenses.md`, `offline-sync.md`, ADR-0012, ADR-0013. Choices where the specs are
open, written into the spec in the task that needs them:

- **A view, never a rewrite.** `groupDebts(entries, members, simplified)` picks the debts a group shows: `pairwiseDebts`
  or `simplifyDebts(memberBalances(...))`. Nothing else reads the switch: the balance in words, "Everyone's balance",
  the totals of Groups and the server's checks stay on `memberBalances`, so the net of each person is the same in both.
- **Computed once.** `GroupView` works the debts out once (`useGroupDebts`) and passes them to `GroupBalances` and to
  `SettleUp`. While a settlement is edited the form gets the debts without it, the lines the ones with it.
- **The suggestions are the lines of the view in use.** Settle up on a simplified line records an ordinary settlement
  between the two people of that line, nothing else; the form starts on the debt of the view in use, and the debt in its
  hint is the one of that view.
- **"After this" says what the view shows once the settlement is saved.** In the simplified view a partial payment can
  re-route the other payments, so `before - amount` would promise what the lines then deny: the form works the debts out
  again over the entries with the settlement on top and reads the pair from there. With pairs it is the same number as
  before.
- **The switch** is a `Checkbox` in the edit screen of a group, for its owner only (hidden for anybody else, as the
  name is; a friend has none), off by default, off offline, and only in an open group. It sends `{ simplifyDebts }`
  through `useGroupActions().change`, shows what was asked until the server answers, and says a refusal in words.
- **A quiet `Notice`** at the top of the balances sheet whenever the group is simplified, also with no debts and in a
  closed group, so the sheet always says which view it shows.

## Tasks

1. **The debts a group shows, in `core`.** `core/group-debts.ts`: `groupDebts(entries, members, simplified): Debt[]`.
   Tests first in `core/group-debts.test.ts`: off is `pairwiseDebts`, on is `simplifyDebts` of the balances; over many
   seeded groups (merged members, deleted entries, settlements, odd cents) what each member is owed or owes by the lines
   is the same in both views and is their balance; a member who left with a balance of zero is routed around by the
   simplified view. Commit `feat: work out the debts a group shows, pair by pair or simplified`.
2. **The balances on the screen.** `use-group-debts.ts` (`useGroupDebts(group, entries, editingId): { debts, form }`),
   `group-screen.tsx`, `group-balances.tsx` (takes `debts`, the Notice), `settle-up.tsx` (takes `entries` and `debts`
   without the edited settlement, the hint reads the view after the settlement), `en.json` and `es.json`
   (`groups.debts.simplified`), the `GroupBalances` story, `balances.md`. Tests first in `group-screen.test.tsx` and
   `settle-up.test.tsx` with `sampleGroup({ simplifyDebts: true })`: the same ledger pair by pair and simplified (the
   lines, and the same balance in words and in Everyone's balance); the Notice only when simplified, also settled and
   closed; a line naming someone who left has no Settle up and a left member who is net zero is routed around; a merged
   dummy; odd cents; Settle up on a simplified line fills the two of that line and saves a plain settlement between them
   (outbox, offline), and the lines change at once; a partial payment re-routes the lines and the hint says it;
   editing a settlement in the simplified view; a switch that changes under an open form. Commit
   `feat: show the simplified debts in a group when it is on`.
3. **The switch in the settings.** `group-settings.tsx` (`SimplifyDebts`), `en.json` and `es.json`
   (`groups.edit.simplify`, `simplifyHint`), `groups.md`, `balances.md`, `AGENTS.md`; this plan and item 28 of `TODO.md`
   deleted, with the header sentence. Tests first in `group-settings.test.tsx`: off by default, on and off again and the
   server keeps it; a member who is not the owner, a friend and a closed group have none; offline it is off and nothing
   is sent; a refusal of the server (`not-owner`, `closed`, a plain failure) is said and the box stays as it was; two
   quick taps send one change; once on, the group screen shows the simplified lines. Commit
   `feat: switch the simplified debts of a group from its settings`.

## Review Focus

- A hint that lies after a partial payment in the simplified view (re-routing), and in the edit of a settlement (the
  edited one must leave both the "before" and the what-if).
- `GroupBalances` or `SettleUp` working the debts out on their own again: only the what-if of the form may.
- A line of a simplified view naming someone who left: no Settle up, as pair by pair. The balance of someone who left
  that is not zero is still listed and still paid by a line the rest can settle.
- The balance in words, Everyone's balance and the totals of Groups changing with the switch: they must not.
- A switch changed from another device while the form holds a debt taken from a line (the draft is kept, the start of
  the form follows the new view).
- The switch shown to somebody who is not the owner, in a friend, or in a closed group, or enabled offline; a second tap
  while the first is on its way; a failure that leaves the box checked.
- Spanish copy at 320 px, labels that contain their visible words, the Notice with no `role` (it was always there).
