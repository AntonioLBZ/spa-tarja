# Docs

The decisions are in [`adr/`](adr/), one each ([the format](adr/README.md)); how things behave is in [`specs/`](specs/), one file per topic; the visual rules are in [`DESIGN.md`](../design-system/DESIGN.md). They are the source of truth: `AGENTS.md` only distills the rules that are easy to break.

## Front matter

Every ADR and every spec starts with a front matter, so that a file can be picked without reading it: `head -12 docs/adr/*.md`, or a `grep` over it, says what each one is about. One key per line and lists in brackets, so a line of `grep` holds the whole value; a list fits in the 120 characters of Prettier, which would otherwise break it over lines (name a folder instead of its files). A test checks every key below.

An ADR:

```yaml
---
status: Accepted # Accepted, Rejected, Proposed or Superseded
superseded_by: ADR-0015 # only with status Superseded
date: 2026-11-21 # the day the decision was first written down
supersedes: [ADR-0002] # optional
refines: [ADR-0016, ADR-0024] # optional: what it changes without replacing it
tags: [expenses, design]
specs: [expenses.md] # optional: the specs that describe what it decided
summary: 'What was decided, in a line.'
---
```

A spec:

```yaml
---
tags: [groups, people]
adrs: [ADR-0012, ADR-0014] # optional: every ADR the spec links to
code: [core/groups/shared-group.ts, src/features/groups/list/] # the main files and folders it describes
summary: 'What the spec covers, in a line.'
---
```

- `summary` is quoted, in the quotes Prettier picks (single, with a quote inside written twice, or double, with `\"` inside), at most 125 characters, and says the what, never the why: the why is in the body, and what other keys say (what it refines) isn't repeated.
- `adrs` of a spec is every ADR its body links to, and only those; each link names the ADR's file exactly. `code` holds paths that exist, a folder ending in `/` and only a folder; it is how a file of code leads to its doc (`grep -l 'src/lib/offline/' docs/specs/*.md`).
- A new ADR or spec takes its tags from the list below; a new tag is added to the list first.

## Tags

- `a11y`: the focus, what is announced, assistive technology.
- `architecture`: the stack, the layout of the repository, the conventions of the code and the tests.
- `auth`: signing in, sessions, the user of a request.
- `balances`: who owes whom in a group, settling up.
- `budgets`: the limits and their warnings.
- `categories`: default and custom categories, the suggestion of one.
- `charts`: the charts screen.
- `counting`: what counts in a month and on which day.
- `data`: the schema, ids, money, dates.
- `deploy`: CI, production, the prerelease, releases.
- `design`: the look: colors, shape, components.
- `expenses`: adding, editing, duplicating and deleting an expense.
- `export`: files, tables to print or download.
- `filters`: the search and the filters of a list.
- `groups`: groups and friends, their members and their entries.
- `ledger`: the expenses of a group.
- `list`: the list of the person's expenses.
- `motion`: transitions, swipes, what moves.
- `navigation`: screens, tabs, the header and the bottom bar.
- `notifications`: the banner and push notifications.
- `people`: friends, invitations, nicknames, dummies.
- `privacy`: what is stored, shown or sent about a person.
- `scope`: what the app does and doesn't do.
- `settings`: the settings screens.
- `summary`: the summary of a month.
- `sync`: the offline model, the outboxes and the cursors.
