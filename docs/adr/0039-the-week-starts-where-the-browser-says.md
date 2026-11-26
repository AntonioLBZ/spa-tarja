---
status: Accepted
date: 2026-11-19
tags: [list, charts]
specs: [charts.md, expense-list.md]
summary: "The first day of the week comes from the browser's language, Monday when it can't tell; no setting."
---

# ADR-0039: The week starts where the browser says

## Context

Weeks group the expense list and the rows of the charts, and they always started on Monday. Many people count them from Sunday (most of America) or from Saturday (parts of the Middle East), and for them every week of the app was off by a day from their calendar. The language of the app says nothing about it: it is only English or Spanish, and English is spoken on both sides.

## Decision

The first day of the week comes from the browser, never from a setting: the week info (`Intl.Locale` `getWeekInfo()`, or the older `weekInfo`) of the first of the browser's preferred languages that names a locale, so `en-US` starts on Sunday, `es-ES` and `en-GB` on Monday. Where the browser can't tell, the week starts on Monday, as before.

It is read on the device once, when the app starts, and shapes only what is shown: the week groups of the list, the week rows of the charts, the default range of twelve weeks and the weeks a range is compared with. Nothing about it is stored or sent.

## Consequences

- The same expenses can fall into different weeks on two devices whose browsers speak differently; nothing stored depends on the week, so they never disagree on data.
- A "Week of" label names the first day of that week, whichever day it is.
- The pure logic takes the first day as an argument, Monday when none is given.

## Alternatives considered

- A setting: one more choice to explain and keep, for something the browser already knows.
- Following the language of the app: English would start on Sunday for people in the United Kingdom, and it knows no region.
