# The Screens of Groups, First Half (item 24a) Implementation Plan

**Goal:** The read side of groups and the simple actions on them: the Groups tab (totals, the groups and the friends with your balance in each, closed and archived ones, New group), a group with its balances pair by pair, and the settings of a group (Show in my expenses, Archive, the name, the people: add a dummy, rename, remove). Not here (item 24b): friends (adding one, a friend in place of a dummy, the friend `Select` of New group and of Add a person), the merge, Make owner, leave, delete and the settle up form.

**Architecture:** Thin route files (`groups.index.tsx`, `groups.$groupId.index.tsx`, `groups.$groupId.edit.tsx`) over components in `src/features/groups`. Everything reads `useGroups` and `useLedgers` (the local copy, so it opens offline) and writes through `useGroupActions`; its refusals (`LocalRefusal` and `ApiError` codes) turn into copy in one place (`group-failure.ts`). The names a screen shows ("Deleted user", "Ana (2)", "(left)", the title of a friend) and the balance in words come from one hook (`use-group-words.ts`) over a pure function (`member-names.ts`), so 24b's rows say the same. `Checkbox` is built here, since the settings need it.

**Spec:** `docs/specs/groups.md`, `balances.md`, `bottom-navigation.md`, `frontend.md`, `design-system/DESIGN.md`, ADR-0012, ADR-0014.

## Choices where the docs are open

- `GET /groups` has no day a group was deleted, so the notice of a closed group is worded without it ("This group was deleted. Its expenses stay as they were."); `groups.md` follows.
- New group has no currency to pick: a group takes the app's (`DEFAULT_CURRENCY`, ADR-0012).
- A row that leads to a group ends with `chevron_right` (Material Symbols), a new interface icon: `expand_more` is the chevron of a disclosure. `check` comes with `Checkbox`, as `DESIGN.md` says.
- `ButtonLink` takes `ghost`, for "Edit group", which `DESIGN.md` allows for links.
- The totals of the Groups tab and the balance of a row come only from the ledgers the device holds; a group whose ledger was never pulled shows no balance rather than "Settled".
- The people of the settings are those who haven't left; who left shows in Everyone's balance with "(left)". Remove says the balance isn't zero before asking, from the local copy, and shows the server's `409 unsettled` the same way.
- Two members are told apart by a number among those not merged, in the group's order.

## Tasks

### Task 1: Checkbox and the icons

- Create `src/components/checkbox/checkbox.tsx`, `.css`, `.test.tsx`, `design-system/stories/components/checkbox.stories.tsx`. Modify `src/components/icon/icon-paths.ts` (`check`, `chevron_right`), `NOTICE.md`, `DESIGN.md` §4.
- Produces: `Checkbox` with `CheckboxProps { label; hint?; checked; disabled?; onChange(checked) }`.
- Tests: a native checkbox named by its label and described by its hint; pressing the label toggles it; off when disabled; the icon test covers the two new shapes.
- Commit: `feat: add the checkbox`

### Task 2: A group and its balances

- Create `src/routes/groups.$groupId.index.tsx`, `src/features/groups/member-names.ts` (+ test), `use-group-words.ts`, `group-screen.tsx` (+ `.css`, `.test.tsx`), `group-balances.tsx` (+ `.css`), `group-failure.ts`, `design-system/stories/features/group-balances.stories.tsx`. Modify `src/lib/route-transition.ts` (+ test), `src/components/button/button-link.tsx` (+ test, story, `DESIGN.md`), locales, `groups.md`.
- Produces: `memberNames(members, words): Map<string, string>`; `useGroupWords(group)` → `{ title, nameOf, mine(cents), sentence(memberId, cents), debt(debt) }`; `GroupScreen`, `GroupBalances { group; entries }`; `failureOf(error): GroupFailure`; depth 2 and the Groups section for `/groups/$groupId`.
- Tests: the title is the name, or the other person's for a friend; your balance in words; debts pair by pair, yours first, in words and with no color; Everyone's balance with "(left)" and "Deleted user"; numbered twins; a closed group says why, with no date; it opens offline from the local copy; a group the device doesn't hold says so with a link back to Groups.
- Commit: `feat: show a group and who owes whom in it`

### Task 3: The Groups tab

- Rename `src/routes/groups.tsx` to `groups.index.tsx`; rewrite `src/features/groups/groups.tsx` (+ `.css`, `.test.tsx`); create `new-group.tsx` (+ `.css`), `group-list.tsx` (+ `.css`). Modify `src/routes/routes.test.tsx`, locales.
- Produces: `Groups`, `NewGroup`, `GroupList { label; ledgers; kind: 'open' | 'closed' }`.
- Tests: the totals in words (owed, owe, All settled), across open groups and friends only; groups and friends on their sheets with the balance of each, leading to the group; closed and archived under their disclosures, each saying why it's closed and whether it shows in your expenses, left out when empty; the empty state; New group makes the group with its dummies (added and removed one at a time, Enter adds) and opens it; a bad name is refused before sending; the server's refusal in words; offline everything that makes is off with a notice, and the lists still show.
- Commit: `feat: list the groups and make a new one`

### Task 4: The settings of a group

- Create `src/routes/groups.$groupId.edit.tsx`, `src/features/groups/group-settings.tsx` (+ `.css`, `.test.tsx`). Modify `group-screen.tsx` (the Edit link), `route-transition.ts` (+ test), locales.
- Produces: `GroupSettings`; depth 3 for `/groups/$groupId/edit`.
- Tests: Show in my expenses switches and keeps it, for open and closed groups; Archive and Bring back only for a closed group; the name for the owner only, saved and refused in words; a closed group has only the switches; offline everything is off with a notice; a friend has no name section; the Edit link reads Edit group or Edit friend.
- Commit: `feat: add the settings of a group`

### Task 5: The people of a group

- Create `src/features/groups/group-people.tsx` (+ `.css`, `.test.tsx`), `person-row.tsx`. Modify `group-settings.tsx`, locales.
- Produces: `GroupPeople { group; entries }`, `PersonRow`.
- Tests: a row per member who hasn't left, with You, Owner and Not joined and the balance in words; Rename for the owner on anybody and for a user on themselves; Remove for the owner, not on themselves, asking first with the focus on Cancel; a balance that isn't zero is said instead of asking; the server's `unsettled` and the local `read-only` in words; Add a person adds a dummy by name; offline it is all off.
- Commit: `feat: add the people of a group`

### Task 6: Close

- Delete this plan; rewrite item 24 of `TODO.md` to what 24b has left and take `Checkbox` out of item 25; check `AGENTS.md`, `frontend.md` and `DESIGN.md` are in sync.
- Commit: `docs: close the first half of the group screens`

## Review Focus

- A ledger never pulled leaves its group out of the totals without saying so.
- The local check before Remove reads the device's entries, which may be behind the server: the server's `409 unsettled` still decides, and is shown.
- `useLedgers` syncs every group on each screen that reads it (the tab, a group, its settings), one request per group.
- The form of New group keeps its ids while it is open, so a retry after a lost answer makes nothing twice; closing the disclosure doesn't drop them.
- The names of twins are numbered over every member not merged, those who left included, so a number can skip in People, which lists only those who haven't left.
