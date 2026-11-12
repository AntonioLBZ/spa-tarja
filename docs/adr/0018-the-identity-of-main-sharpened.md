# ADR-0018: The identity of the app, sharpened

- Status: Proposed
- Date: 2026-11-12

## Context

The look of the app is black and white, IBM Plex Mono, no radius and the notch, the thick ink edge on the left and at the bottom of every box, with receipt-like sheets for the lists. The owner likes it as an identity but finds the screens flat to use: every box shouts the same, nothing is bigger than anything else, the home opens on a search box and a filter box instead of on the answer to "how am I doing this month", the add form puts seven fields in front of the one that matters, and the motion is fades and short shifts that explain little and reward nothing. A bolder proof of concept that changes the identity itself is on the branch `redesign-poc`; this one keeps the identity and sharpens it, and the notch itself may be edited.

## Decision

Proposed by a proof of concept on the branch `redesign-classic`; the owner decides whether it is merged.

- **Kept.** Ink on paper with true black in the dark theme, the gray default accent and its presets, IBM Plex Mono only and the Dot Matrix logo, no radius, flat colors, the notch, the receipt sheets with their leaders and double rule, the category colors on icons only, the slide of the routes.
- **Figures answer.** A screen opens with its one answer, a label over a big bold figure that counts up, in a box with the **strong notch** (`--notch-strong`, twice the ordinary one): the month's spending on the home, what is left on the Summary, what is owed on Groups. The home puts under it the **tally comb**, the month as one straight ink bar per day, as tall as what was spent that day, grouped by calendar week, today flagged and the days to come as stubs; a finger or a pointer moving along it reads the days off and a tap takes the list to that day. A tally is what the name of the app means.
- **The notch is a token and it moves.** `--notch` (4 px) and `--notch-strong` (8 px). A box that is pressed moves toward the corner its notch is in and springs back; a default button gets a hover tone.
- **Less on the screen at once.** The home controls are a search field with its icon, a Filters button with its count that opens the panel, and the categories as chips on a row that scrolls sideways and says so (`ScrollStrip`: the edge that has more fades out, and a mouse gets an arrow). The add form opens on a big amount and keeps the day and the way of paying under "More options". Days read "Today" and "Yesterday". The health notice only shows when something is wrong.
- **Motion** is GSAP (`gsap` and `@gsap/react`, the stack of the owner's portfolio) where CSS can't say it: the figures count up, the comb draws its marks, the day sheets come out as if printed, the bar of the phone tab bar and the fill of a `ChoiceGroup` glide to the next choice, the sheet of a form unfolds out of the control that opened it as a rectangle, and a tally of five draws itself under the logo of the sign-in screen. CSS does what it can: the panel of a `Disclosure` unfolds in height, the `Toast` is repainted from the right over the 8 s it stays (the ink retreats and leaves a lighter tone), and every pressed box springs. Everything that moves sits under `prefers-reduced-motion: no-preference` and leaves its final state in the page when it doesn't run.
- **Fixes carried along.** The list of a `Select` is above the headings that stick to the top of a sheet; the page reserves the room of the scrollbar (`scrollbar-gutter: stable`) so a long screen doesn't shift the bars and the column, and what measures its box to place a mark follows it when its size changes.

## Consequences

- Two dependencies are added, `gsap` and `@gsap/react` (free to use). The icons gain `search` and `tune`.
- `DESIGN.md` and the specs of the home, the form, the Summary, Groups and the bottom bar are updated in the same branch, and the tests that pinned the old structure (the health notice shown when all is well, the long date of today and yesterday) change with them.
- It and the proposal of `redesign-poc` are alternatives: if one is accepted the other is closed, and the ADR number is reassigned whichever merges second.

## Alternatives considered

- Changing only color and type: the weight of the identical boxes was the complaint, not the palette.
- A hard shadow in place of the notch: it is the same shape as the notch with another name, and the identity would lose its tally stick.
- A figure with no box: the strong notch is what makes it the one thing bigger than what it holds.
- A smooth-scroll library, a WebGL background: they fight native touch scrolling and cost battery for no information.
