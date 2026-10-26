# Tarja — Design

Source of truth for the visual and interaction rules. `src/assets/styles/tokens.css` implements the tokens; if a rule changes, update this document first. Architecture and product decisions live in `ARCHITECTURE.md`.

## 1. Principles

- **Simple for the user.** Few things on screen, few choices, sensible defaults. Logging an expense should take seconds and work one-handed.
- **Minimalist.** Black and white do the work. Color is rare and always means something: the accent marks what can be acted on, and a category color marks a category.
- **Flat.** Solid fills only.
- **Sharp.** No rounded corners.
- **Mobile-first.** The phone layout is the base; larger screens are an extension.
- **Motion explains.** Transitions show what changed. They never decorate.

## 2. Color and themes

### Flat colors

Solid colors only: no gradients, no shadows, no blur. Separation comes from borders and from the two surface tones, not from elevation.

### Palette

The base is white (light theme) or black (dark theme), with text in the opposite one. The dark theme is true black. Everything else is a neutral gray, one accent (picked from a fixed list), one danger color and the category palette.

| Token                       | Light     | Dark      | Use                                                                               |
| --------------------------- | --------- | --------- | --------------------------------------------------------------------------------- |
| `--color-bg-primary`        | `#fff`    | `#000`    | Page background                                                                   |
| `--color-bg-secondary`      | `#f4f4f4` | `#141414` | Header and raised surfaces. The browser toolbar matches it                        |
| `--color-content-primary`   | `#000`    | `#fff`    | Text and icons                                                                    |
| `--color-content-secondary` | `#595959` | `#a3a3a3` | Secondary text                                                                    |
| `--color-border`            | `#000`    | `#fff`    | Structural borders (ink)                                                          |
| `--color-border-subtle`     | `#d4d4d4` | `#2e2e2e` | Hairline dividers                                                                 |
| `--color-accent`            | `#404040` | `#d4d4d4` | The interface hue: links, selection, primary action (gray by default, see Accent) |
| `--color-bg-accent`         | accent    | accent    | Fill behind a primary action                                                      |
| `--color-content-on-accent` | `#fff`    | `#000`    | Text on that fill                                                                 |
| `--color-border-focus`      | accent    | accent    | Focus ring                                                                        |
| `--color-danger`            | `#c81e1e` | `#f87171` | Errors and destructive actions only                                               |

Rules:

- One accent at a time and one danger color. There are no success or warning colors: use text, an icon or position instead. A new color needs a reason and an update to this table.
- Components use only the semantic `--color-*` tokens, never raw values. Raw values live in `tokens.css`.
- Never convey meaning by color alone.
- Contrast follows WCAG 2 AA: 4.5:1 for text, 3:1 for borders and focus rings. Every pair in the table was checked on 2026-10-25 (text on a background: 4.5:1 at worst; ink on background: 18:1 or more). Check again when a value changes.
- Category colors have their own rules (see Category colors).

### Accent

The user picks the accent from a fixed list, as in `spa-anicalendar`: `data-accent` on `<html>` selects a block that redefines `--color-accent` and the tokens built on it. Gray is the default, so it is the value the tokens start with and needs no block. The settings call the section "App color" ("Color de la app"): "accent" means nothing to most people. Each preset has its own light and dark tone, tuned by hand and checked against both surfaces (`--color-bg-primary` and `--color-bg-secondary`).

| Preset           | Light     | Dark      |
| ---------------- | --------- | --------- |
| `gray` (default) | `#404040` | `#d4d4d4` |
| `amber`          | `#9a5b00` | `#f0a830` |
| `blue`           | `#1d4ed8` | `#8aa4ff` |
| `green`          | `#15803d` | `#4ade80` |
| `violet`         | `#6d28d9` | `#c4b5fd` |
| `pink`           | `#be185d` | `#f9a8d4` |

- Every accent reaches 4.5:1 as text on both surfaces, and its on-accent text (white in light, black in dark) reaches 5:1 on its own fill. Checked on 2026-10-25.
- There is no red preset: it would read as the danger color.
- The accent never changes the browser toolbar color, which follows the header surface.
- The choice lives in `localStorage` (`tarja:accent`) and is applied with the theme before the first paint (see Themes). The settings screen holds it as a `ChoiceGroup` next to the theme. Each option is labeled with its name, not just a swatch.

### Category colors

Every category has a color and an icon (see Icons). The color only helps to find a category at a glance: the icon and the name always come with it, so no meaning depends on color alone.

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

- Seven of them are the Okabe-Ito set, designed for color-vision deficiency; gray is for "Other". Each tone is adjusted per theme to reach 3:1 against both surfaces (3.08:1 at worst in light, 3.55:1 in dark), the WCAG minimum for graphics.
- Tokens are `--color-category-<key>`, defined with `light-dark()`. The database stores the key, never the value, so retuning a tone is a CSS change.
- A category color paints its icon (and nothing else). It is never used for text, borders or fills behind text.
- Default categories have a fixed color and icon, defined in `core/` next to their ids. Custom categories choose one of the eight colors and one icon when created or edited, in a picker behind "Color and icon": each color is drawn on the current icon and each icon in the current color, and the chosen one carries the notch and a surface fill, so it doesn't rely on color; the default is the least used by the user's own categories among the seven that stand out (the first one on ties, never gray) and the generic icon.
- Amber (an accent the user can pick), orange and yellow sit close in hue. It is acceptable because the accent never paints an icon and every icon comes with its name; check it on screen and rebalance a tone if they get confused.

### Themes

Three settings: light (the default), dark and system, which follows the OS.

- Tokens are defined once with `light-dark()`. `:root` has `color-scheme: light`, which is the default look; `data-theme="dark"` on `<html>` forces dark and `data-theme="system"` sets `color-scheme: light dark`, so the OS preference applies. Once the app runs the theme is always written on `<html>`, light included.
- The default is no longer what the OS says, so a small inline script at the top of `index.html` copies the saved `tarja:theme` and `tarja:accent` to `<html>` before the first paint: whoever chose dark, system or another accent doesn't see the defaults flash. It is the only inline script, and its keys are those of `src/lib/theme` and `src/lib/accent`.
- A theme change fades the colors instead of snapping. Wrap the state update in `withColorTransition`, as `lib/color-transition.ts` does in `spa-anicalendar`: it sets `data-color-transition` on `<html>` for `--duration-slow`. Don't use a View Transition for this: it makes the page inert, and a click in the middle of the fade lands on `<html>`.
- The browser toolbar color (`<meta name="theme-color">`) mirrors `--color-bg-secondary`, the header surface. `index.html` carries one per OS preference; JS points them all at the header surface for an explicit choice (light and dark) and puts them back for "system".
- The choice lives in `localStorage` (`tarja:theme`). The settings screen (`/settings`, linked from the header) holds it, next to the language. Both are a `ChoiceGroup`: a radio group drawn as a row of boxes, the checked one filled with the accent.

## 3. Shape

- **No rounded corners.** Never use `border-radius`; there are no radius tokens. This includes buttons, inputs, avatars and focus outlines.
- **Borders carry the structure** where other designs use shadows. `--color-border` (ink) for structure, `--color-border-subtle` for dividers. Dividers are 1 px (`--size-px`); the notch and emphasis use `--size-1`.
- **Form controls** share one look, set on the elements in `base.css`: the notch (below) on a `--color-bg-secondary` field, no radius, at least `--size-touch` tall. A button has the notch too; the primary action fills with the accent (`--color-bg-accent`) and a destructive one takes `--color-danger` for its text.
- **The notch.** The tally-stick cut: every box (form control, button, list row, card) has a thick ink border (`--size-1`) on the left and at the bottom, and none on top or on the right. Without an outline, a box that takes input sits on `--color-bg-secondary` so it still reads as a field. The focus ring is the exception: a full accent outline around the box. Messages (status, notices, errors) keep a thick left border only, in ink, or in `--color-danger` for errors. Both edges are `--size-1` (4 px), checked on screen on the form, the lists and the choice groups. A primary button keeps the ink notch on its accent fill.
- **Room around the notch.** A box that holds a label has `--size-4` before the text and `--size-12` after it, so its bottom edge runs on past the text like the tail of an L; buttons and the options of a `ChoiceGroup` all share it. Boxes in a row are `--size-4` apart, wrapped or not, so each notch stands on its own; rows stacked in a list are `--size-2` apart. A link that does what a button does takes the class `.button` and looks like one. A box that holds only a glyph (the arrows of the month, the swatches of the color and icon pickers) keeps its padding even, and the swatches sit `--size-2` apart.

### Components

The rules above live in shared components, in `src/components/<name>/`. A screen uses them instead of styling raw elements again; they add no rule of their own.

- **`Notice`**: a message set apart by a thick left edge. It is a paragraph that holds only the text. `tone` is `info` (ink, the default), `danger` (`--color-danger`, for errors) or `quiet` (a hairline and secondary text, for what is only background, like an empty list). `role` is `alert` for an error that shows up after an action and `status` for a line that changes while the person looks at it; text that was always there has none.
- **`Button`**: a box with the notch. `variant` is the default, `primary` (the accent fill, for the main action of a form) or `danger` (the notch in the hairline color and the text in `--color-danger`, for what deletes). `glyph` is for a box that holds only a symbol: even padding, and an `aria-label` is required. `pressed` fills it with the accent and sets `aria-pressed`, for a toggle. A button is `type="button"` unless it submits. `ButtonLink` is a link that looks like a button, typed like `Link`, and `buttonClass()` gives the class to anything else that has to look like one. `base.css` styles buttons and links with `:where()`, so a variant wins whatever order the stylesheets load in.
- **`Field`**: a label, the control and, under it, a hint and the error. The label is `--size-1` from the control, and the hint and the error come `--size-1` under it. Fields in a form are `--size-4` apart, the gap of the form itself. The error is a `Notice` with `role="alert"`, directly under the field it is about, so it is never at the bottom of the form; a message about the form as a whole (a save that failed) goes after the last field. The control is an `<input>`, a `<select>`, `CategorySelect` or a row (an input with its buttons) that spreads what `Field` gives it: the `id` the label points at, `aria-describedby` and `aria-invalid`. A `ChoiceGroup` is a fieldset with its own legend and stays outside.
- **`Card` and `CardList`**: a `Card` is a box with the notch and the padding of a row (`--size-2` above and below, `--size-3` at the sides). A `CardList` stacks them `--size-2` apart, as a list of rows should be; `flush` puts them edge to edge, the exception for a list whose rows are already far enough apart, like the expenses of a day. What goes inside a card is up to the screen.
- **`Disclosure`**: a toggle and the panel it opens under it, with `aria-expanded` on the toggle and `aria-controls` only while the panel is there. The panel comes in with a fade and a short vertical shift over `--duration-base`. `keepMounted` keeps the panel in the page, hidden, while it is closed, so what was typed in it survives; such a panel also leaves with the fade and the shift before it drops out of the layout. `chevron` ends the toggle with the `expand_more` icon, a half turn when open. `heading` (`h2` or `h3`) puts the toggle inside a heading, for a disclosure that titles a section, like the add form; the heading keeps the size of the text around it and the toggle takes its weight. `DisclosurePanel` is the same panel on its own, for what looks like an open disclosure without being one, like a category being edited.

## 4. Typography and icons

### Typography

- Everything is set in **IBM Plex Mono** (SIL OFL 1.1), amounts included: monospace lines the digits up and fits the ledger feeling. It comes from `@fontsource/ibm-plex-mono`, the latin subset (which covers the accents, ñ, ¿, ¡ and €) in weights 400 and 700, about 15 KB each. It is served by the app itself and precached, so it works offline; `font-display: swap` shows the fallback while it loads.
- Stack: `'IBM Plex Mono', ui-monospace, 'Cascadia Mono', 'Menlo', 'Consolas', monospace`.
- Form controls inherit the page font and its 16 px size.
- **Type scale**: a standard modular scale, minor third (×1.2) from a 1 rem base. `--font-size-s` is 0.833 rem (secondary text), `--font-size-m` 1 rem (body and form controls), `--font-size-l` 1.2 rem (page titles) and `--font-size-xl` 1.44 rem (the sign-in title). The logo is sized apart (`--font-size-logo`). Form controls never go below `--font-size-m`, so iOS doesn't zoom. Hierarchy also uses weight (700) and case, never a size outside the scale.
- **The logo**: the name _Tarja_ is set in the regular weight of Dot Matrix (Svein Kåre Gunnarson, Dionaea Fonts), whose readme says "the fonts are freeware". The bold came first; the owner asked to try the regular one, so the weight is pending a look on a real device (thin at `--font-size-l` in the header, better large, `--font-size-logo`, 3 rem, on the sign-in screen). Only the letters of the name ship, as a woff2 subset of about 1.5 KB; the original TTFs aren't in the repo, and `src/assets/fonts/NOTICE.md` credits the author and records how the subset was made. It is for the name only, never for text: a dot matrix face doesn't read small. Its terms say nothing about redistribution, so the subset stays limited to those letters. The `Brand` component sets it.

### Icons

- **Material Symbols, Sharp style** (Apache 2.0): square ends and corners, like the rest of the identity. Weight 400, 24 px grid, shown at `1.5rem`.
- Only the icons in use are copied into the repo as inline SVG (a few hundred bytes each), with the license notice. No icon font and no package at runtime.
- Icons are decorative (`aria-hidden`): the name always comes with them. They take `currentColor`, or the color of their category.
- The default categories use `restaurant`, `shopping_cart`, `sports_esports`, `receipt_long`, `home`, `directions_bus`, `medical_services` and `more_horiz`. A custom category with no pick uses `category`.
- The icons a custom category can choose from (Material Symbols names), grouped here only for reading: `restaurant`, `local_cafe`, `local_bar`, `fastfood`, `bakery_dining`; `shopping_cart`, `shopping_bag`, `storefront`, `checkroom`, `redeem`; `sports_esports`, `movie`, `music_note`, `sports_soccer`, `fitness_center`, `theater_comedy`, `beach_access`; `directions_bus`, `directions_car`, `local_gas_station`, `train`, `flight`, `two_wheeler`; `home`, `bolt`, `water_drop`, `wifi`, `receipt_long`, `build`, `bed`; `medical_services`, `local_pharmacy`, `spa`; `pets`, `school`, `child_care`, `work`; `savings`, `payments`, `credit_card`, `account_balance`, `subscriptions`; `volunteer_activism`, `more_horiz`, `category`. The stored value is the name; the picker shows them in this order.
- The interface has icons of its own, kept out of that list: `expand_more`, the chevron of a disclosure (`UI_ICONS` in `src/components/icon/icon-paths.ts`). It is the "can be pressed" icon, and it ends every row that opens a panel, the expenses and the person's own categories. It is not a pencil: a pencil would promise Edit, which is only one of the actions in the panel. A category can't take it, and neither the picker nor the server accepts it. `Icon` draws both kinds.

## 5. Layout and mobile-first

- Base CSS targets phones. Widen with `@media (width >= 40rem)` and `(width >= 64rem)`, never with `max-width` queries.
- The content column is capped at 40 rem and centered on larger screens.
- Touch targets are at least `--size-touch` (44 px).
- `viewport-fit=cover` is on, so anything anchored to an edge pads itself with `env(safe-area-inset-*)`.
- Use `dvh`, not `vh`, for full-height blocks.
- Form controls use 16 px or more, so iOS doesn't zoom in on focus.
- Layout still needs a check on a real iOS Safari and Android Chrome (`TODO.md`).

### Header

- One row on `--color-bg-secondary` with an ink hairline under it, `--size-touch` tall plus the top safe area. It has three zones on a grid (`minmax(max-content, 1fr) auto minmax(max-content, 1fr)`, `--size-2` apart): Expenses on the left, the logo in the middle, and Summary and Settings on the right, `--size-2` apart. The words are at `--font-size-s` and every link is `--size-touch` tall.
- Expenses and the logo both lead to the home screen: Expenses with the add form collapsed, the logo with it open (see Expenses). A click that opens the link somewhere else (with a modifier key, or another mouse button) leaves the form as it is.
- The word of the current section is underlined: a `--size-1` bar in ink (`--color-border`) as wide as the word, flush with the bottom of the header. A deeper screen underlines the one it is reached from (the charts underline Summary, the categories Settings), and that link is marked as current for assistive technology too. The logo is never underlined.
- Widths: IBM Plex Mono advances 0.6 em, so a word takes 8 px a letter at `--font-size-s`, and the logo is 57.6 px wide (about 65 px in the fallback face, before Dot Matrix loads). The side columns grow alike while there is room, which keeps the logo in the middle; in English that needs about 362 px (346 px in Spanish). Below that the wider side keeps its width and the logo drifts left of the middle instead of anything overflowing: measured in Chrome, 20.6 px at 320 px in English (24.5 px in the fallback face), 12.6 px in Spanish, and 0.6 px at 360 px in English. Nothing overflows at 320, 360 or 390 px in either language, with the fonts loaded or not; the English row needs at least 298 px (306 px in the fallback face).

### Category select

- A native `<select>` can't draw an icon inside its options, and on iOS there is no way around that, so the field that picks a category (the expense form, the filter of the charts) is a list of our own, `CategorySelect`: a field with the notch that shows the icon and the name of the chosen category, and a list under it with one row per category, each with its icon and its name. The color alone says nothing, so the name is always there.
- The list is a box with the notch on `--color-bg-primary`, as wide as the field, taller than `--size-touch` per row, and scrolls past half the screen (`dvh`). It comes in with a fade and a short vertical shift over `--duration-base`. The row under the pointer or the keyboard is on `--color-bg-secondary`, and the chosen one carries the thick left edge of the notch.
- A row without an icon (the "All categories" of the charts) keeps the place of one, so the names line up.
- It follows the select-only combobox pattern of the ARIA Authoring Practices: a `combobox` button that owns a `listbox`, arrow keys, Home and End to move, Enter or Space to choose, Escape to close, letters to jump to a name. Pressing outside or leaving the field closes the list without choosing.

### Expenses

- The add form opens the home screen. Its title is a heading that is also the toggle of a `Disclosure`, with the chevron: pressing it collapses the form and pressing it again opens it, the focus staying on it. The form stays in the page while it is collapsed, so what was typed survives. Whether it is open lives in memory only: every start of the app and every link from outside open it. The header's Expenses collapses it and the logo opens it, also from another screen, and pressing Expenses collapses it again even after it was opened by hand.
- The list on the home screen, a day at a time. An expense is a row with the badge of its category, its name, its amount and what else there is to say: the category when the name is the person's own text, how and when it is charged, and "Not synced yet". A plan is one row on the purchase day, with its total.
- A row is a disclosure, like the rows of the categories: the whole row is the toggle, so the notch is the toggle's box, and a chevron at its end says it can be pressed. Pressing it opens a panel right under it and pressing it again closes the panel. Rows open one by one, not as an accordion: each keeps its own state, and an open row stays open while expenses come in around it.
- The panel holds what can be done to the expense. For now that is Delete, with Edit to join it. Delete is one press, with no confirmation: the expense, or every part of its plan, is deleted at once, and the row fades out before it goes. The panel comes in with a fade and a short vertical shift over `--duration-base`, like the one of a category.

### Categories

- `/categories`, reached from a section of the settings that says what categories are for. The person's own categories are rows of the notch with the icon, the name and the chevron at its end; the built-in ones are rows with nothing to open, so they have no chevron.
- A row is a disclosure: pressing it opens a panel right under it with Edit and Delete, and pressing it again closes the panel. Rows open one by one, not as an accordion. The panel comes in with a fade and a short vertical shift over `--duration-base`, like a new expense.
- Edit turns the name of the row into a field, in the same box, and the panel under it holds the color and icon picker as it always did (still behind its "Color and icon" summary), then Save and Cancel, all outside the L of the field. Saving closes the panel; cancelling goes back to Edit and Delete.
- Delete asks in the panel, with the question and Delete and Cancel, and says what happens to the expenses.
- Offline, the rows still open but the buttons in the panel are off, with the notice at the top saying why.

### Summary

- `/summary`, linked from the header, shows one month at a time. It opens on the current month, whose name sits between two arrow buttons (previous and next, at least `--size-touch` wide); the month isn't in the URL.
- The month's numbers are notch-bordered rows: income (what the person set, or "Not set"), restaurant card (only when something was paid that way), spent, and left. Left is the row that matters: bold, and in `--color-danger` below zero. It stays hidden, with a hint, until the income is set. The rows are `--size-2` apart, as in the category list, and the arrows of the month and the income field with its buttons are `--size-4` apart, also when the income row wraps.
- Under the rows, one form sets the income: an amount field and Save, and Remove once there is one. Setting it needs a connection (`ARCHITECTURE.md` §5), so offline the form is disabled and says why; the numbers themselves still show from the local copy.
- A link at the bottom leads to the charts.

### Charts

- `/charts`, one level deeper than the summary it is reached from. Everything is computed on the device from the local expenses, so it works offline.
- Filters on top: group by (day, week or month, a choice group), category (a select that starts at all of them) and from/to dates. Until the person picks dates the range follows the grouping: the whole current month for days, twelve weeks counting this one for weeks, twelve months counting this one for months, each up to the end of its period so that what is still to be charged in it shows, as it does in the summary. Picking dates keeps them whatever the grouping, and a button brings the defaults back. Only days between 2000 and 2099 count, because a date field passes through years like 0002 and 0020 while one is typed; whatever doesn't make a day yet stays in the field without touching the chart, and leaving the field puts the range back. A start after the end, or a range of more than 400 rows, is refused with a message tied to the fields instead of an empty or endless chart; for a range that is too long the total and the split by category still show. Weeks start on Monday.
- The first chart is a list with a row for each day, week or month, oldest first, empty ones included: its name (with the year when the range goes over a New Year), a bar and the amount. The bar is flat, in the accent color, and is a `scaleX` of the biggest row, so a change animates over `--duration-base` like everything else. The name and the amount are text, so the bar is only a help.
- Under it, the total of the range and its split by category, the biggest first: the icon with the name (the color alone says nothing), the amount, the share and a bar like the others. The split ignores the category filter, so it still answers where the money went; categories that took the same go in the order of their names. Until the categories are known, an expense is never moved to the fallback. A category that was deleted shows as the fallback category, like in the list.
- Category colors paint the icon only (see Category colors), so the bars never use them.

## 6. Motion

- Animated transitions are part of the identity: things enter, leave and change with a transition.
- Always use `--duration-fast`, `--duration-base` and `--duration-slow` (120, 200 and 360 ms) and `--ease-standard`, `--ease-enter` and `--ease-exit`. Never literal values.
- `prefers-reduced-motion` zeroes the durations in one place (`tokens.css`). Components don't special-case it.
- Prefer animating `transform` and `opacity`.
- **Routes slide horizontally.** Each route has a depth: `/` is 0, `/settings` and `/summary` 1, `/categories` and `/charts` 2. Going deeper, the new screen enters from the right and the old one leaves to the left; going back, the other way round. Fade plus `translateX`, over `--duration-base`. Between two screens at the same depth (Summary and Settings, the charts and the categories) the page doesn't slide: it only fades, over `--duration-base` (the `level` transition type). With reduced motion the durations are zero, so the screen just changes.
- **The header underline** slides to the word of the new section as one piece, stretching to its width, over `--duration-base` with `--ease-standard`, whatever the page does under it. It is a single element with a `view-transition-name` of its own (`nav-underline`), and no script animates it; only the new mark is drawn while it moves. The header reads the screen already shown, not the one being opened, so the underline is still in its old place when the transition takes its first picture.
- **Lists.** A new expense enters from above with a fade and a short vertical shift; a deleted one fades out before it leaves.
- **Disclosures.** The panel under a row comes in with a fade and a short vertical shift, over `--duration-base`. A panel kept in the page, like the add form, leaves the same way, over `--duration-base` with `--ease-exit`, and only then drops out of the layout. The chevron at the end of the row turns half a turn as it opens and turns back as it closes, over `--duration-base` with `--ease-standard`, by `transform`, driven by `aria-expanded` on the toggle.

## 7. CSS and copy conventions

- Plain CSS, in the file of the route or component that uses it. BEM class names, alphabetical properties, no `!important`; Stylelint enforces them. Combine classes with `clsx`.
- Spacing, motion and color come from `tokens.css`.
- UI text is never hard-coded: it goes through i18n (`src/assets/locales`). Everything else in the project is in English.

## 8. Open questions

None at the moment. Add here what comes up, and ask the owner before settling it.
