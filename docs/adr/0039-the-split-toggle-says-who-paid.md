# ADR-0039: The Split toggle says who paid

- Status: Accepted
- Date: 2026-11-17

## Context

In the add form of [ADR-0034](0034-the-add-form-chooses-who-it-is-for-in-tabs.md) the summary of a shared expense is three short lines at the end of the row of the tabs: who it is with, who paid and how it is split. The toggle of Split reads "Split" alone, while More options says what it holds in the toggle itself ("Today · Now"). Who paid is the part a person checks most and changes inside Split, yet it is told away from it. Putting the whole summary in the toggle would not fit one line on a phone.

## Decision

Confirmed by the owner:

- **The Split toggle starts with an icon**, `call_split` (an arrow that forks in two), before the word Split. More options keeps no icon: the three dots it would take are the icon of the category Other.
- **The toggle says who paid** while it is closed, after "Split" in secondary text, as More options says its day and payment: "Paid by you", "Paid by Bea", "Choose who paid". It never wraps: the toggle stays on one line and the payer is cut with an ellipsis when it doesn't fit. Open, the toggle reads "Split" alone, as Paid by is in sight.
- **The summary beside the tabs keeps two lines**: who it is with and how it is split ("With Flat", "Equally among 3"), or "Choose who it's with" alone, each line half the height of the tabs, so choosing Shared still moves nothing under the row. It still describes the toggle for assistive technology.

This refines ADR-0034, which put who paid in the summary beside the tabs.

## Consequences

- `Disclosure` gains an `icon` at the start of its toggle and a `oneLine` look that keeps the summary and the hint on one line, cutting the hint; both come with its story.
- `call_split` joins the icons of the interface, which a category can't take.
- No server, migration, API, outbox or sync change.

## Alternatives considered

- The whole summary in the toggle ("Split · With Flat · Paid by you · Equally among 3"): too long for one line on a phone.
- `groups` as the icon: it already means Groups in the bottom bar.
- An icon for More options too (`more_horiz`): the same three dots as the category Other.
