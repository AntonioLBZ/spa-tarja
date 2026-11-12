# Tarja — Design

Source of truth for the visual and interaction rules of the design system. `src/assets/styles/tokens.css` implements the tokens; if a rule changes, update this document first. How each screen behaves is in [`docs/specs/`](../docs/specs/) and the decisions are in [`docs/adr/`](../docs/adr/); this look is [ADR-0018](../docs/adr/0018-the-stub-a-new-visual-identity.md).

## 1. Principles

- **A ticket you tear.** _Tarja_ means tally and tag. Every screen is a flat colored **field** that holds the answer, a **perforated edge**, and a paper **sheet** with the details.
- **The answer first.** A screen opens on the one number or sentence that matters, big. Details come under it.
- **Friendly and easy.** Plain words, big touch targets, few choices at a time, the common case needs the least typing.
- **One bold thing, the rest calm.** The boldness is the hero of the home: the month's spending over a tally comb. Everything around it is quiet, rounded and flat.
- **Mobile-first.** The phone layout is the base; larger screens are an extension.
- **Motion explains and rewards.** Numbers count, the sheet slides over the field, the tab pill glides, a form blooms out of the "+". It never decorates, and it all stops under `prefers-reduced-motion`.

## 2. Color and themes

### Flat colors

Solid colors only: no gradients as color, no shadows, no blur. Separation comes from whitespace, tints and hairlines. A radial gradient is used once, as a shape: the hard-edged half circles of the perforation.

### Palette

The **app color** (a preset, see below) is the field and what is tapped to act. The paper is white in the light theme and a night tone in the dark one. Tokens are defined once with `light-dark()`; `--p-*` are the raw values a preset changes, `--color-*` what components read.

| Token                       | Light (tangerine)                  | Dark (tangerine) | Use                                                                           |
| --------------------------- | ---------------------------------- | ---------------- | ----------------------------------------------------------------------------- |
| `--color-field`             | `#ff6a3d`                          | `#ff6a3d`        | The colored area of a screen, the primary action, a pressed chip, the toolbar |
| `--color-on-field`          | `#1b0f2e`                          | `#1b0f2e`        | Text and marks on the field                                                   |
| `--color-on-field-muted`    | 88 % of on-field over field        | same             | Secondary text on the field                                                   |
| `--color-field-tint`        | field moved 14 % toward shade      | same             | A chip or hover on the field                                                  |
| `--color-field-tint-strong` | 24 %                               | same             | The active word of the header, a pressed tint                                 |
| `--color-now`               | `#fff`                             | `#fff`           | Today on the comb                                                             |
| `--color-spark`             | `#1b0f2e`                          | `#ffe08a`        | The "+" of the bar and of the header                                          |
| `--color-on-spark`          | `#ffe08a`                          | `#1b0f2e`        | Its icon                                                                      |
| `--color-sheet`             | `#fff`                             | `#150e22`        | The paper: page, dialogs, the tab bar                                         |
| `--color-ink`               | `#1b0f2e`                          | `#f4f2fa`        | Text on the paper                                                             |
| `--color-ink-muted`         | 66 % of ink over sheet             | same             | Secondary text                                                                |
| `--color-surface`           | field 7 % into ink 4 % into sheet  | same             | Fields, chips, cards, hover                                                   |
| `--color-surface-strong`    | field 16 % into ink 6 % into sheet | same             | The checked cell of a swatch, the pill of the current tab, a bar's track      |
| `--color-line`              | ink 12 % into sheet                | same             | Hairlines                                                                     |
| `--color-accent`            | `#b83210`                          | `#ff8a64`        | The app color as text on the paper: links, ghost buttons                      |
| `--color-bg-accent`         | field                              | field            | Fill behind a primary action                                                  |
| `--color-content-on-accent` | on-field                           | on-field         | Text on that fill                                                             |
| `--color-focus`             | accent                             | accent           | The focus ring                                                                |
| `--color-danger`            | `#c81e4a`                          | `#ff6b8a`        | Errors and what deletes only                                                  |
| `--color-danger-surface`    | danger 12 % into sheet             | same             | The box of an error                                                           |
| `--color-veil`              | ink at 55 %                        | black at 65 %    | What dims the page behind a dialog                                            |

Rules:

- One app color at a time and one danger color. There are no success or warning colors: use words, an icon or position instead. A new color needs a reason and an update to this table.
- Components use only the semantic `--color-*` tokens, never raw values.
- Never convey meaning by color alone. What someone owes or is owed has no color: the words say it ("You owe", "owes you", "Settled").
- Contrast follows WCAG 2 AA: 4.5:1 for text, 3:1 for the marks of a chart. Fifteen pairs (on-field over field and over both tints, muted text over the paper and the surface, the link over both, danger, the spark pair, ink over the paper) were checked for every preset in both themes on 2026-11-12, with `now` over the field at 2.8:1 or more, the tangerine one, white on `#ff6a3d`, being the closest to the line. Check again when a value changes.

### App colors

The user picks the app color from a fixed list; `data-accent` on `<html>` selects a block that redefines the raw `--p-*` values. Tangerine is the default and needs no attribute (its block repeats the root so a swatch can show it inside another color). The settings call the section "App color" ("Color de la app") and show each preset as a round swatch painted with its own field color, named for assistive technology.

| Preset                | Field (light / dark)  | On field  | Spark (light / dark)  | Now       |
| --------------------- | --------------------- | --------- | --------------------- | --------- |
| `tangerine` (default) | `#ff6a3d`             | `#1b0f2e` | `#1b0f2e` / `#ffe08a` | `#fff`    |
| `cobalt`              | `#2a3fe8` / `#3347e0` | `#fff`    | `#10163a` / `#ffc83d` | `#ffc83d` |
| `pine`                | `#0c5446` / `#0f6652` | `#f4ffe6` | `#0c2b25` / `#ffdc5e` | `#ffdc5e` |
| `grape`               | `#6b2fd9` / `#6a36d6` | `#fff`    | `#1b0f2e` / `#ffd166` | `#ffd166` |
| `rose`                | `#f0508f` / `#f566a0` | `#2b0a1d` | `#2b0a1d` / `#ffd1e5` | `#fff`    |
| `ink`                 | `#1b0f2e` / `#2f2050` | `#fff`    | `#1b0f2e` / `#ffc83d` | `#ffc83d` |

- A preset also states the tone of the link and, for cobalt and pine, the paper and the ink of its own (a navy and a deep green night). `--p-shade` is what tints on the field move toward, away from the text color, so the text keeps its contrast.
- There is no red preset: it would read as the danger color.
- The choice lives in `localStorage` (`tarja:accent`) and is applied with the theme before the first paint. A stored value that isn't one of these (the old gray, amber, blue, green, violet or pink) falls back to the default.

### Category colors

Every category has a color and an icon. The color only helps to find a category at a glance: the icon and the name always come with it.

| Key          | Light     | Dark      | Default category |
| ------------ | --------- | --------- | ---------------- |
| `vermillion` | `#d55e00` | `#d55e00` | Food             |
| `green`      | `#009e73` | `#009e73` | Groceries        |
| `purple`     | `#c86ea0` | `#cc79a7` | Leisure          |
| `blue`       | `#0072b2` | `#0072b2` | Bills            |
| `orange`     | `#b87f00` | `#e69f00` | Housing          |
| `sky`        | `#1c93d7` | `#56b4e9` | Transport        |
| `yellow`     | `#978e0c` | `#f0e442` | Health           |
| `gray`       | `#767676` | `#767676` | Other            |

- Seven are the Okabe-Ito set; each tone is adjusted per theme to reach 3:1 against both surfaces. Tokens are `--color-category-<key>`; the database stores the key, never the value.
- A color paints the icon of a category and, in the charts, its segment of the split. In a row it also tints the **sticker**: the rounded square behind the icon is the color at 16 % over the paper. It is never used for text.
- Default categories have a fixed color and icon in `core/`; custom ones choose from the eight colors and the icons when created or edited, in a picker of two swatch groups.

### Themes

Three settings: light (the default), dark and system. `:root` has `color-scheme: light`; `data-theme="dark"` forces dark and `data-theme="system"` follows the OS. A small inline script in `index.html` copies the saved theme and app color to `<html>` before the first paint. A theme change fades the colors (`withColorTransition`, never a View Transition, which would make the page inert).

- The browser toolbar (`<meta name="theme-color">`) is the **field**, `#ff6a3d`, for the light and dark preferences alike; the app puts the field of the chosen preset there once it runs. The web app manifest holds a single `theme_color`, the night paper `#150e22` (Android paints its navigation bar with it), and `background_color`, the tangerine field (the splash screen).

## 3. Shape

- **Rounded, with a hierarchy.** `--radius-s` (0.75 rem) for fields, `--radius-m` (1 rem) for stickers, cards and rows, `--radius-l` (1.75 rem) for the sheet of a form and dialogs, `--radius-pill` for what is pressed: buttons, chips, segments, the search. A round swatch or glyph button is a circle.
- **No shadows.** A floating list is a box with a hairline; the toast is filled with ink.
- **Fields** share one look, set in `base.css`: a `--color-surface` box, no edge, at least 3.25 rem tall, that gains a ring and the paper color when focused. A button is a pill at least `--size-touch` tall.
- **The perforation** (`.perforated`, in `base.css`): half circles of `--color-field`, 1 rem across and 0.5 rem deep, bitten out of the top of the paper. It is the edge of the sheet of every page and of the sign-in screen.
- **Stickers.** The category of a row is a 3 rem rounded square (`CategoryBadge` with `sticker`), and a group or a friend one with the `groups` or `person` icon on `--color-surface-strong`.
- **Focus ring.** `--focus-width` (3 px) in `--color-focus`, `--focus-offset` away from the box; inside the box where a parent clips it. On ink or on the field the ring takes the color written there.

## 4. Typography and icons

### Typography

- One family, **Gabarito** (SIL OFL), variable, weights 400 to 900, from `@fontsource-variable/gabarito`: the latin subset (about 34 KB), with latin-ext only when a character needs it. Served by the app itself and precached, so it works offline; `font-display: swap`.
- Stack: `'Gabarito Variable', ui-rounded, 'Nunito', system-ui, sans-serif`. Figures are tabular on the whole page (`font-variant-numeric: tabular-nums`), so amounts line up and don't jitter while they count.
- **Scale**: 0.8125, 0.9375, 1, 1.125, 1.5 and 2.25 rem (`--font-size-xs` to `--font-size-2xl`), and `--font-size-hero`, `clamp(3.75rem, 17vw, 5.5rem)`, for the one number of a screen. Form controls never go below 1 rem, so iOS doesn't zoom. Weights: 500 body, 600 labels, 700 strong, 900 display (headings, amounts, the logo).
- No all-caps labels, no monospace, no eyebrows above headings.
- **The logo** is the word _tarja_ in weight 900, lowercase, in `Brand`; in the prerelease build ([ADR-0015](../docs/adr/0015-github-actions-deploys-and-a-prerelease-worker.md)) it is followed by `-pre` at half its size. The Dot Matrix face is gone.

### Icons

- **Material Symbols, Rounded, weight 500** (Apache 2.0), 24 px grid, shown at 1.5 rem. Only the icons in use are copied into the repo as inline SVG, with the license notice (`src/components/icon/NOTICE.md`); numbers are rounded to one decimal. No icon font.
- Icons are decorative (`aria-hidden`): the name always comes with them. They take `currentColor`, or the color of their category.
- The icons a custom category can choose from are listed in `core/category-style.ts`. The interface has icons of its own, kept out of that list (`UI_ICONS`): `expand_more`, `chevron_left`, `chevron_right`, `check`, `groups`, `person`, `bar_chart`, `settings`, `add`, `close`, `search`, `tune`, `delete`, `edit`, `content_copy`, `person_add` and `link`. A category can't take them.

## 5. Layout and mobile-first

- Base CSS targets phones. Widen with `@media (width >= 40rem)` and `(width >= 64rem)`, never with `max-width` queries. Touch targets are at least `--size-touch` (44 px). `viewport-fit=cover` is on, so edge-anchored layouts pad themselves with `env(safe-area-inset-*)`; use `dvh`, not `vh`.
- **The page** (`Page`, `src/features/shell`): a flex column of
    - a **bar** (phone only), sticky, in the field color: the logo, or on a screen deeper than a tab the link back at the left and the logo at the right, and in the middle a short title that appears once the sheet has covered the hero;
    - the **field**, sticky under the bar: the `h1`, and the hero of the screen (`HeroStat`: a label, the one big number or sentence, a line about it, and what the screen adds under them, such as the comb);
    - the **sheet**, with the perforated top edge, which slides over the field as the page scrolls while the hero fades and shrinks. Its bottom padding keeps the last row clear of the tab bar.
- **Tab bar** below 40 rem ([`BottomNav`](#components)); a screen that isn't a tab is reached from one and has the link back. From 40 rem the header (`root__header`) holds the logo, the four destinations and, at the far end, the "Add expense" pill; the page then has no bar of its own, stands on `--color-surface`, and its sheet is a column of 40 rem centered under the field, a ticket on a quiet desk. Nothing anchored to the bottom hides behind the bar.
- The sign-in screen is the same ticket: the name over a comb of ticks on the field, and under the perforation the sheet that signs in.
- Layout still needs a check on a real iOS Safari and Android Chrome (`TODO.md`).

### Select

- Every field that picks one option from a list is a `Select`, never a native `<select>`: a field that shows the icon of the option, if it has one, and its name, and a list under it with one row per option. The list is a box with a hairline on the paper, `--radius-m`, as wide as the field, scrolling past half the screen (`dvh`), and comes in with a short fade, shift and scale.
- **Where it opens.** Under the field unless it doesn't fit in what a person can see there (the screen without the keyboard, cut down by every box around the field that scrolls or clips, like the sheet of a form); then above it if there is more room there, with at most the room there is, `--size-2` short of the edge, never less than two rows.
- The row under the pointer or the keyboard is on `--color-surface`, the chosen one on `--color-surface-strong` and in bold. The row the arrow keys are on has the focus ring, inside the row.
- It follows the select-only combobox pattern of the ARIA Authoring Practices: a `combobox` button that owns a `listbox`, arrow keys, Home and End, Enter or Space to choose, Escape to close, letters to jump to a name; pressing outside closes without choosing. `CategorySelect` is a `Select` whose options are categories.

## Components

The rules live in shared components, in `src/components/<name>/`. A screen uses them instead of styling raw elements again; they add no rule of their own. Storybook (`design-system/`) shows each one; the rules stay in this document.

- **`Notice`**: a message in a tinted rounded box (`--color-surface`). `tone` is `info` (the default), `danger` (`--color-danger-surface` and `--color-danger`, for errors) or `quiet` (just secondary text, for what is only background, like an empty list). `role` is `alert` for an error that shows up after an action and `status` for a line that changes while the person looks at it.
- **`Button`**: a pill on `--color-surface`. `variant` is the default, `primary` (the field color, for the main action) or `danger`. `ghost` is text only in `--color-accent`, for an action inside a row or on the field's edge; it never goes with `primary` or `pressed`. `block` makes it as wide as its row. `glyph` is a circle that holds only a symbol and must be named by `aria-label`. `pressed` fills it with the field color and sets `aria-pressed`, for a toggle or a chip. Pressing any button scales it to 0.97 with a spring. `ButtonLink` is a link that looks like a button and takes the same props.
- **`ChoiceGroup`**: a fieldset with its legend and one radio per option, drawn as a **segmented control**: a pill track on `--color-surface`, the checked option a pill filled with the field color. The options share a width and fill their row, as many to a row as fit. `swatch` draws them as round-cornered cells that hold what they are given (an icon, a color dot), named by their label; the checked one is marked by an ink ring, not a fill, so what it holds stays visible.
- **`Field`**: a label above the control, the hint and the error under it. The error is a `Notice` with `role="alert"` directly under the field. `className="field--bare"` keeps the label for assistive technology only and lets a placeholder say it on screen.
- **`Select`**: see above.
- **`Card` and `CardList`**: a `Card` is a row on `--color-surface`, `--radius-m`; `flush` puts rows with no surface edge to edge on the paper, for a day's worth of rows.
- **`Sheet`**: a group of rows under a heading that stays at the top, under the bar, while its rows scroll past (`position: sticky`); `id` lets something else scroll to it. The expenses of a day have their total on the line of the heading, which sticks the same way.
- **`DateRangeFields`**: the From and To fields, side by side while both fit.
- **`MonthSwitch`**: the name of a month between two circular glyph buttons with chevrons; on the field the buttons take the field tint.
- **`Toast`**: a message that goes away by itself (8 s) and offers one action when there is something to do about it. It floats above the tab bar, a `--radius-m` box filled with ink (`--color-ink`, text in the paper color) that springs in and leaves the same way; a rule inside its bottom edge is the time left. A toast that goes away ends with a dismiss glyph button. A **pinned** toast has no bar, no count and no dismiss, and sits above the other. One at a time.
- **`Disclosure`**: a toggle and the panel under it, with `aria-expanded` and `aria-controls`. The toggle is a `--radius-m` box on `--color-surface` (on a `Sheet`, a row with no surface of its own); the panel comes in with a fade and a short shift, the chevron turns a half turn with a spring. `keepMounted` keeps the panel in the page, hidden, so what was typed survives.
- **`Dialog`**: the native `<dialog>` opened as a modal, over a veil (`--color-veil`). A box on the paper with `--radius-l`, centered, at most 32 rem wide; its `sheet` variant holds the form of a task ([ADR-0016](../docs/adr/0016-forms-for-a-task-open-in-a-sheet.md)): below 40 rem it is anchored to the bottom edge with the large radius on its top corners, from 40 rem it is the dialog. It **blooms** out of the control that opened it (see Motion). Its title row ends with a circular close button when it has a `closeLabel`; Tapping outside doesn't close it. Its `actions` are buttons under what it holds.
- **`Checkbox`**: a soft square with a label, one target at least `--size-touch` tall; checked, it fills with the field color, shows the check, and pops.
- **`BottomNav`**: the tab bar of a phone ([bottom navigation](../docs/specs/bottom-navigation.md)). Fixed at the bottom on the paper with a hairline on top, `--bottom-nav-height` tall plus the safe area. Five equal columns: an icon over a word for each tab, and in the middle the **"+"**, a 3.5 rem squircle in `--color-spark` with the `add` icon, raised `--bottom-nav-lift` over the bar and cut from it by a ring of the paper color, over its word "Add". The current tab has `aria-current="page"`, its word in weight 900, and a **pill** behind its icon that glides to the next tab, stretching on the way. Hidden, by sliding out of the tab order, while a text field or a `Select` outside a dialog has the focus.
- **`CountUp`**: a number that rolls from what it showed to what it is now, from zero the first time; tabular figures keep it still.
- **`Brand`**: the logo.
- In `features/shell`: **`Page`** (above), **`HeroStat`** (label, big number or sentence at `title` size, a line, children) and **`NotFound`**. In `features/expenses`: **`MonthHero`** and **`MonthComb`**.

## 6. Motion

- All of it is GSAP (`gsap`, `@gsap/react`, ScrollTrigger), set up once in `src/lib/motion/gsap.ts`, which exports the eases and the durations matching the CSS tokens. Everything that moves runs inside `gsap.matchMedia()` under `(prefers-reduced-motion: no-preference)`; outside it, and in a test, the final state is simply in the page. Only `transform` and `opacity` move, apart from the text of a counting number.
- CSS transitions use `--duration-fast`, `--duration-base` and `--duration-slow` (140, 260 and 440 ms) and `--ease-standard`, `--ease-enter`, `--ease-exit` and `--ease-spring` (a `linear()` spring with a small overshoot). Never literal values. `prefers-reduced-motion` zeroes the durations in one place.
- **A screen comes in, once.** The lines of its hero rise one after the other (22 px, 90 ms apart) and its numbers count up. On the home the comb grows from the baseline tick by tick, left to right, with an overshoot. The sign-in screen does the same with its name and comb, and its sheet rises. Nothing else on the page reveals itself on scroll.
- **Routes** keep View Transitions: going deeper, the page slides in from the right and the old one out to the left; going back, the other way round; between two screens at the same depth it only fades. The bar and the tab bar hold still under their own names. In the header (from 40 rem) the pill behind the current word slides and stretches to the new one, with the spring.
- **The curtain.** As the page scrolls, the sheet slides over the field while the hero fades, rises and shrinks (scrubbed by the scroll); once the sheet has covered it, the bar shows the short title.
- **The comb** lifts the day under a finger or pointer and says its amount in the line under the number; a tap on a day scrolls the list to it.
- **The tab bar.** The pill under the icon of the current tab glides to the next tab, first stretching over both and then settling. The "+" turns a quarter while pressed.
- **The bloom.** A sheet of a form opens as a circle that grows from the middle of the control that opened it until it holds the whole sheet, its content following in a short stagger; it closes by sliding down and fading. Under reduced motion it comes up as a plain panel.
- **Lists.** A new expense lands from above with a spring; a deleted one fades and moves aside before it goes. A row that opens does so with a fade and a short shift and its chevron turns with a spring. A budget bar and the segments of the split grow when they come in.
- **Press.** Every button, segment, chip and tab scales to 0.97 and back with the spring.
- **Toast.** It springs in from below with a fade and leaves the same way; its bar shrinks over the 8 s it stays (a timer, not a transition). Under reduced motion the bar stays full.

## 7. CSS and copy conventions

- Plain CSS, in the file of the route or component that uses it. BEM class names, alphabetical properties, no `!important`; Stylelint enforces them. Combine classes with `clsx`.
- Spacing, motion and color come from `tokens.css`.
- UI text is never hard-coded: it goes through i18n (`src/assets/locales`). Everything else in the project is in English.

## 8. Open questions

Add here what comes up, and ask the owner before settling it.

- **The new identity is a proposal** ([ADR-0018](../docs/adr/0018-the-stub-a-new-visual-identity.md)); on a real phone, the owner judges the weight of the hero, the comb, and the feel of the motion.
- **Category colors.** Stickers use the category color as a tint. The earlier thought of dropping them for the app color is still open.
- **The PWA icon** is still the old one, with the old palette; it should follow the identity.
