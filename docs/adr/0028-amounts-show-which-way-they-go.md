---
status: Accepted
date: 2026-11-15
refines: [ADR-0012]
tags: [balances, design, settings]
specs: [balances.md, groups.md, settings.md, summary.md]
summary: 'A shared Amount can show color, a sign and an arrow, each switchable in Settings; the person picks the currency symbol.'
---

# ADR-0028: Amounts show which way they go

## Context

The design said that what someone owes or is owed has no color: the words say it. In the balances of a group with three or more people, a column of amounts in words alone is slow to read: the owner tried several looks in Storybook and found that a cue next to the amount, on top of the words, is what lets the eye tell at a glance who gets money back and who pays. Not everybody wants color, and red and green are the pair the most common color-vision deficiencies confuse.

## Decision

- **A shared `Amount`** shows cents in a currency and, each on its own, three cues of the direction of the amount, from the side of whoever the line is about: a color (`--color-money-in`, for what adds to their balance, `--color-money-out` for what takes from it), a sign (+ or −) and an arrow (`north_east` going up, `south_east` going down). The words never go: a cue is never the only thing that says which way an amount goes, and color is never alone. The arrow shows only in the balances of a group ([ADR-0029](0029-the-balances-of-a-group-fold-by-net-balance.md)); everywhere else it never shows, whatever the setting.
- **Settings → Amounts**: three switches, color, sign and arrows, all on by default, and a fourth for a palette for color blindness (blue for in and orange for out instead of green and red), off by default. They are preferences of the device, as the theme is.
- **The symbol of the currency**: the person picks the symbol the app shows (€, $, £ or ¥). It is only what is drawn: no amount is converted, what is stored keeps its cents and its currency code, and the export writes the code. Every amount in the app's currency is drawn with the chosen symbol; a group is in the app's currency, so it shows the same symbol; an amount in any other currency, if one ever appears, keeps its own.
- Where else they show, chosen by the owner from a page of options in Storybook: the Left of the summary of a month, with color and sign; the totals of Groups, the balance of each group's row and the balance in words of a group's screen, with color alone, since the sentence says which way; and the ledger of a group, with color and sign ([ADR-0030](0030-a-ledger-row-says-who-paid-and-what-it-does-to-you.md)). The list of expenses and its subtotals, the budgets, the charts, the forms and the export have none: every expense is money going out, so a cue on each would say nothing.

This replaces the rule of the design document that debts have no color, and refines [ADR-0012](0012-shared-expenses.md), which said the words alone tell a debt.

## Consequences

- Two new pairs of tokens, defined once with `light-dark()` and checked at 4.5:1 on both surfaces in both themes, and a second set for color blindness under `data-money-palette="color-blind"` on `<html>`.
- `--color-danger` stays for errors and for what deletes; an amount that is owed takes `--color-money-out`, even when its value is the same red.
- The amounts read the symbol through one hook, so a screen never formats money with the code alone.
- A push notification is written by the service worker, which can't read the preferences of the page, so it keeps the currency's own symbol.

## Alternatives considered

- Words only, as before: kept as what the switches give when all three are off.
- An ink chip (a filled box for what comes in, an outline for what goes out): one more box among the notched ones, and it says less than an arrow.
- Converting to the currency chosen: needs rates and a network, and an expense is stored in the currency it was paid in.
