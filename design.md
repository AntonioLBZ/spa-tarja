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
- Contrast follows WCAG 2 AA: 4.5:1 for text, 3:1 for focus rings and the marks of a chart. Structural borders are ink, 18:1 or more. Two decorations are not held to 3:1, because something else says what they frame (owner decision, 2026-10-29):
    - The hairline `--color-border-subtle`, 1.4 to 1.6:1 in both themes. It draws disabled notches, quiet notices, the Delete notch, the chart grid and the rules of the numbers table; the text names each box.
    - The ink notch on an accent fill (primary button, checked option of a choice group, pressed toggle), 1.5 to 2.4:1 in dark and 2.0 to 4.2:1 in light. The fill, at 4.5:1 or more against the page, is what marks the control.

    Every other pair in the table was checked on 2026-10-25 (text on a background: 4.5:1 at worst; ink on background: 18:1 or more). Check again when a value changes.

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
- A category color paints its icon and, in the charts, its segment of the split by category (owner decision, 2026-10-29), and nothing else. It is never used for text, borders or fills behind text.
- Default categories have a fixed color and icon, defined in `core/` next to their ids. Custom categories choose one of the eight colors and one icon when created or edited, in a picker behind "Color and icon": each color is drawn on the current icon and each icon in the current color, and the chosen one carries the notch and a surface fill, so it doesn't rely on color; the default is the least used by the user's own categories among the seven that stand out (the first one on ties, never gray) and the generic icon.
- Amber (an accent the user can pick), orange and yellow sit close in hue. It is acceptable because the accent never paints an icon and every icon comes with its name; check it on screen and rebalance a tone if they get confused.

### Themes

Three settings: light (the default), dark and system, which follows the OS.

- Tokens are defined once with `light-dark()`. `:root` has `color-scheme: light`, which is the default look; `data-theme="dark"` on `<html>` forces dark and `data-theme="system"` sets `color-scheme: light dark`, so the OS preference applies. Once the app runs the theme is always written on `<html>`, light included.
- The default is no longer what the OS says, so a small inline script at the top of `index.html` copies the saved `tarja:theme` and `tarja:accent` to `<html>` before the first paint: whoever chose dark, system or another accent doesn't see the defaults flash. It also sets the browser toolbar color (below) before the first paint. It is the only inline script, and its keys are those of `src/lib/theme` and `src/lib/accent`.
- A theme change fades the colors instead of snapping. Wrap the state update in `withColorTransition`, as `lib/color-transition.ts` does in `spa-anicalendar`: it sets `data-color-transition` on `<html>` for `--duration-slow`. Don't use a View Transition for this: it makes the page inert, and a click in the middle of the fade lands on `<html>`.
- The browser toolbar color (`<meta name="theme-color">`) mirrors `--color-bg-secondary`, the header surface. `index.html` carries one per OS preference, above the inline script. For an explicit theme (light, also when nothing was saved, and dark) the inline script points them all at that theme's header surface before the first paint, so a light app on a dark phone never opens under a dark toolbar; the app keeps them there and puts them back for "system".
- The web app manifest (`vite.config.ts`) holds a single `theme_color` and `background_color` and can't follow the theme. It has the light values of `--color-bg-secondary` and `--color-bg-primary`, as light is the default. An installed app set to dark therefore opens on a light splash screen (Android draws it from the manifest) until the page paints; from then on the toolbar follows the meta tags.
- The choice lives in `localStorage` (`tarja:theme`). The settings screen (`/settings`, linked from the header) holds it, next to the language. Both are a `ChoiceGroup`: a radio group drawn as a row of boxes, the checked one filled with the accent.

## 3. Shape

- **No rounded corners.** Never use `border-radius`; there are no radius tokens. This includes buttons, inputs, avatars and focus outlines.
- **Borders carry the structure** where other designs use shadows. `--color-border` (ink) for structure, `--color-border-subtle` for dividers. Dividers are 1 px (`--size-px`); the notch and emphasis use `--size-1`.
- **Form controls** share one look, set on the elements in `base.css`: the notch (below) on a `--color-bg-secondary` field, no radius, at least `--size-touch` tall. A button has the notch too; the primary action fills with the accent (`--color-bg-accent`) and a destructive one takes `--color-danger` for its text.
- **The notch.** The tally-stick cut: every box (form control, button, list row, card) has a thick ink border (`--size-1`) on the left and at the bottom, and none on top or on the right. Without an outline, a box that takes input sits on `--color-bg-secondary` so it still reads as a field. The focus ring is the exception: a full accent outline around the box. Messages (status, notices, errors) keep a thick left border only, in ink, or in `--color-danger` for errors; a quiet notice uses the hairline. Both edges are `--size-1` (4 px), checked on screen on the form, the lists and the choice groups. A primary button keeps the ink notch on its accent fill, which is what marks it (§2, Palette).
- **Room around the notch.** A box that holds a label has `--size-4` before the text and `--size-12` after it, so its bottom edge runs on past the text like the tail of an L; buttons and the options of a `ChoiceGroup` all share it. Boxes in a row are `--size-4` apart, wrapped or not, so each notch stands on its own; rows stacked in a list are `--size-2` apart. A link that does what a button does takes the class `.button` and looks like one. A box that holds only a glyph (the arrows of the month, the swatches of the color and icon pickers) keeps its padding even, and the swatches sit `--size-2` apart.

### Components

The rules above live in shared components, in `src/components/<name>/`. A screen uses them instead of styling raw elements again; they add no rule of their own.

- **`Notice`**: a message set apart by a thick left edge. It is a paragraph that holds only the text. `tone` is `info` (ink, the default), `danger` (`--color-danger`, for errors) or `quiet` (a hairline and secondary text, for what is only background, like an empty list). `role` is `alert` for an error that shows up after an action and `status` for a line that changes while the person looks at it; text that was always there has none.
- **`Button`**: a box with the notch. `variant` is the default, `primary` (the accent fill, for the main action of a form) or `danger` (the notch in the hairline color and the text in `--color-danger`, for what deletes). `glyph` is for a box that holds only a symbol: even padding, and an `aria-label` is required, on a `ButtonLink` too. `pressed` fills it with the accent and sets `aria-pressed`, for a toggle; an `aria-pressed` the caller sets itself wins over it. A disabled button looks the same whatever its variant: no fill, its text in `--color-content-secondary` and its notch in the hairline color. A button is `type="button"` unless it submits. `ButtonLink` is a link that looks like a button, typed like `Link`, and `buttonClass()` gives the class to anything else that has to look like one. `base.css` styles buttons and links with `:where()`, so a variant wins whatever order the stylesheets load in.
- **`Field`**: a label, the control and, under it, a hint and the error. The label is `--size-1` from the control, and the hint and the error come `--size-1` under it. Fields in a form are `--size-4` apart, the gap of the form itself. The error is a `Notice` with `role="alert"`, directly under the field it is about, so it is never at the bottom of the form; a message about the form as a whole (a save that failed) goes after the last field, except in a form whose only field is the thing being saved, like the new category, where it goes under that field. The control is an `<input>`, a `<select>`, `CategorySelect` or a row (an input with its buttons) that spreads what `Field` gives it: the `id` the label points at, `aria-describedby` and `aria-invalid`. A `ChoiceGroup` is a fieldset with its own legend and stays outside.
- **`Card` and `CardList`**: a `Card` is a box with the notch and the padding of a row (`--size-2` above and below, `--size-3` at the sides). A `CardList` stacks rows `--size-2` apart, as a list of rows should be; `flush` puts them edge to edge, the exception for a list whose rows are already far enough apart, like the expenses of a day. `label` names a list that has no heading of its own, for assistive technology. What goes inside a card is up to the screen. The rows that open, the expenses and the person's own categories, are not `Card`s but `Disclosure` items in a `CardList`: the box with the notch is their toggle, with the padding of a card, and the panel sits under it.
- **`DateRangeFields`**: the From and To fields of a range of days, each a `Field`, side by side while both fit (a date field is never narrower than about 9.5 rem, so a phone narrower than about 365 px in the list, or 350 px in the charts, puts one under the other). A day counts only between 2000 and 2099, because a date field passes through years like 0002 and 0020 while one is typed: whatever doesn't make a day yet stays in the field without reaching the screen's state, and leaving the field puts the last good day back. `allowEmpty` lets a field be cleared, for a range that may be open at one end. `invalid` and `describedBy` tie both fields to a message the screen shows once, for both of them.
- **`Toast`**: a message that goes away by itself and offers one action, for the result of something the person can take back (Undo after Delete); errors stay `Notice`s. It floats at the bottom, centered in the content column and `--size-4` from the edges and above the bottom safe area: a box with the notch on `--color-bg-secondary` that holds the message and a `Button`. One at a time: a new one replaces the one showing. It stays 8 s; hovering it or keeping the focus inside pauses the count, which goes on with what was left. Escape closes it, unless a control that uses Escape (an open category list) took the key. `ToastProvider` sits in the root layout next to the add form, so a toast survives a change of screen, and its `role="status"` region is always in the page, so a message that comes in is announced. It is the last stop in the tab order and never blocks a click outside the box. It comes in and leaves with a fade and a short vertical shift over `--duration-base` (§6).
- **`Disclosure`**: a toggle and the panel it opens under it, with `aria-expanded` on the toggle and `aria-controls` whenever the panel is in the page: while it is open, and while a `keepMounted` panel is closed and hidden, but not when a closed panel has been dropped. The panel comes in with a fade and a short vertical shift over `--duration-base`. `keepMounted` keeps the panel in the page, hidden, while it is closed, so what was typed in it survives; such a panel also leaves with the fade and the shift before it drops out of the layout. `chevron` ends the toggle with the `expand_more` icon, a half turn when open. `heading` (`h2` or `h3`) puts the toggle inside a heading, for a disclosure that titles a section, like the add form; the heading keeps the size of the text around it and the toggle takes its weight. A toggle brought into view (the heading of the add form on Edit, a row taking the focus back) stops `--size-2` from the edge, so its focus ring shows whole. `DisclosurePanel` is the same panel on its own, for what looks like an open disclosure without being one, like a category being edited.

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
- The interface has icons of its own, kept out of that list: `expand_more`, the chevron of a disclosure (`UI_ICONS` in `src/components/icon/icon-paths.ts`). It is the "can be pressed" icon, and it ends every row that opens a panel, the expenses and the person's own categories. It is not a pencil: a pencil would promise Edit, which is only one of the actions in the panel. A category can't take it, and neither the picker nor the server accepts it. `Icon` draws both kinds. `close` is the only one drawn by CSS instead of `Icon`: a mask of the × of the search field (`expense-list-controls.css`).

## 5. Layout and mobile-first

- Base CSS targets phones. Widen with `@media (width >= 40rem)` and `(width >= 64rem)`, never with `max-width` queries.
- The content column is capped at 40 rem and centered on larger screens.
- Touch targets are at least `--size-touch` (44 px).
- `viewport-fit=cover` is on, so anything anchored to an edge pads itself with `env(safe-area-inset-*)`.
- Use `dvh`, not `vh`, for full-height blocks.
- Form controls use 16 px or more, so iOS doesn't zoom in on focus.
- Layout still needs a check on a real iOS Safari and Android Chrome (`TODO.md`).

### Header

- One row on `--color-bg-secondary` with an ink hairline under it, `--size-touch` tall plus the top safe area. It has three zones on a grid (`minmax(max-content, 1fr) auto minmax(max-content, 1fr)`, `--size-2` apart): Expenses on the left, the logo in the middle, and Summary and Settings on the right, `--size-2` apart on a phone and `--size-4` apart from 40 rem up, where the room lets them stop reading as one phrase. The words are at `--font-size-s` and every link is `--size-touch` tall.
- Expenses and the logo both lead to the home screen, with the add form adding a new expense (an edit ends): Expenses with the form collapsed, the logo with it open (see Expenses). A click that opens the link somewhere else (with a modifier key, or another mouse button) leaves the form as it is.
- The word of the current section is underlined: a `--size-1` bar in ink (`--color-border`) as wide as the word, sitting on the hairline. A deeper screen underlines the one it is reached from (the charts underline Summary, the categories Settings), and that link is marked as current for assistive technology too. The logo is never underlined.
- Widths: the side columns grow alike while there is room, which keeps the logo in the middle. Below that, the wider side keeps its width and the logo drifts left of the middle instead of anything overflowing; it drifts further in the fallback face the logo has before Dot Matrix loads, and in the language with the longer words. Nothing overflows at 320, 360 or 390 px in either language, with the fonts loaded or not. Check it again when a word of the header or the logo changes.

### Category select

- A native `<select>` can't draw an icon inside its options, and on iOS there is no way around that, so the field that picks a category (the expense form, the filters of the charts and of the list) is a list of our own, `CategorySelect`: a field with the notch that shows the icon and the name of the chosen category, and a list under it with one row per category, each with its icon and its name. The color alone says nothing, so the name is always there.
- The list is a box with the notch on `--color-bg-primary`, as wide as the field, taller than `--size-touch` per row, and scrolls past half the screen (`dvh`). It comes in with a fade and a short vertical shift over `--duration-base`. The row under the pointer or the keyboard is on `--color-bg-secondary`, and the chosen one carries the thick left edge of the notch.
- A row without an icon (the "All categories" of the charts and of the list) keeps the place of one, so the names line up.
- It follows the select-only combobox pattern of the ARIA Authoring Practices: a `combobox` button that owns a `listbox`, arrow keys, Home and End to move, Enter or Space to choose, Escape to close, letters to jump to a name. Pressing outside or leaving the field closes the list without choosing.

### Expenses

- The add form opens the home screen. Its title is a heading that is also the toggle of a `Disclosure`, with the chevron: pressing it collapses the form and pressing it again opens it, the focus staying on it. The form stays in the page while it is collapsed, so what was typed survives. Whether it is open lives in memory only: every start of the app and every link from outside open it. The header's Expenses collapses it and the logo opens it, also from another screen, and pressing Expenses collapses it again even after it was opened by hand.
- With "Restaurant card" as the payment, the form asks "Your part" under the charge date, an amount like the others; empty means all of it was yours. "Amount" keeps its label: it is what the card paid. While your part is less than the amount, a hint under the field says "Others pay back" and the difference; a part over the amount marks the field invalid, with a message under it, and the expense is not saved. Choosing another payment clears it, and installments stay offered only for "Now".
- The list on the home screen, a group at a time: by day unless the person picks another grouping (see Expense list controls). An expense is a row with the badge of its category, its name, its amount and what else there is to say: the category when the name is the person's own text, how and when it is charged, what the card paid ("Paid" and the amount) when your part of a restaurant card is less than that, and "Not synced yet". The amount of a restaurant card expense is your part. A plan is one row on the purchase day, with its total.
- A row is a disclosure, like the rows of the categories: the whole row is the toggle, so the notch is the toggle's box, and a chevron at its end says it can be pressed. Pressing it opens a panel right under it and pressing it again closes the panel. Rows open one by one, not as an accordion: each keeps its own state, and an open row stays open while expenses come in around it.
- The panel holds what can be done to the expense: Edit, then Delete, `--size-4` apart. Delete is one press, with no confirmation: the expense, or every part of its plan, is deleted at once, and the row fades out before it goes. A `Toast` says "Deleted <name>" (the text of the expense, else its category) and offers Undo for 8 s; the next delete replaces it, so only the last one can be taken back. Undo brings the expense, or the whole plan, back with the animation of a new expense and the focus goes to its row. The focus doesn't stay on a button that is leaving: it goes at once to the toggle of the next row, or of the one before when the row was the last, or to the list title when no row is left. The panel comes in with a fade and a short vertical shift over `--duration-base`, like the one of a category.
- Edit loads the expense, or the whole plan, into the add form, which opens if it was collapsed. The page scrolls to the form (at once under reduced motion) and the focus goes to its heading, never to a field, so a phone doesn't open its keyboard. While it edits, the heading reads "Edit the expense", the main button "Save", and Cancel sits `--size-4` beside it; nothing else in the form changes. The fields hold what was saved: the charge date, your part, the number of payments and the amount of each. The category stays the saved one, with no suggestion; one that no longer exists shows as "Other" and is kept unless another is picked. Save or Cancel puts the form back to adding, empty, and the focus back on the row, or on the list title when the row is gone. Deleting the expense being edited, or pressing Expenses or the logo, also puts the form back to adding. A half typed new expense is replaced by the edit without asking. For a plan whose payments aren't all on the device yet, Edit is off and a quiet notice under the buttons says why.

### Expense list controls

- Under the title of the list, once there is an expense, come a search field, a "Filters" toggle and, while anything is narrowing the list, a status line. With no expenses at all there are no controls, only "No expenses yet".
- **Search** is a full-width `type="search"` field inside a `Field`. Every word typed has to appear in the description or in the name of the category as the row shows it, ignoring case and accents, so "caf" finds "Café" and "other" finds an expense whose category was deleted. It narrows the list as the person types, deferred so typing never waits for the list. The × that clears it is ours, not the blue one Chrome and Safari draw: the `close` icon (§4) in `--color-content-primary`, inside a `--size-touch` square, shown by the browser only while there is text. It clears the search alone; the Clear button of the status line below drops the filters too.
- **Filters (n)** is a `Disclosure` closed by default, with the chevron; `n` is how many of the filters in its panel are in use (category, dates and paid with count one each; the grouping is not a filter), and it is left out at zero. The panel comes in like any other, with a fade and a short vertical shift (§6), and holds, in this order and `--size-4` apart: Group by (a `ChoiceGroup`: Day, Week, Month, Category, whose options wrap as those of any `ChoiceGroup` do: at 320 px, Day and Week, then Month, then Category), Filter by category (the `CategorySelect` of the charts, starting at all of them; its label differs from the "Category" of the add form so the two are never mixed up), From and To (`DateRangeFields`, either end may be empty), and Paid with (a `ChoiceGroup`: Any, Now, Credit card, Restaurant card, Installments).
- The filters look at the row as it is shown. A plan is one row: the search and the category look at its description and category, the dates at its purchase day, and Installments keeps the plans while Now keeps what was paid at once and is not part of one. Dates are those of the day the expense was made, both ends included. A category that no longer exists counts as "Other" for the filter, and the expense keeps its id.
- **The status line** is a quiet `Notice` and a Clear button, shown while the search or any filter is in use: "Showing x of y", or "No expenses match" when nothing does. The `Notice` sits in a `role="status"` region that is always in the page and empty while nothing narrows the list, so that the first count is announced as well as the next ones. Clear drops the search and every filter, leaves the grouping alone and puts the focus on the search field, since the button is gone.
- **What is remembered.** The filters live in the screen's state only: leaving the screen or reloading clears them, so a filter left on never hides a new expense. For the same reason, adding an expense from the form clears the search and every filter (not the grouping), and so does the list having no expenses left; rows that arrive from the server never clear them, as the person may be typing. The grouping is a preference like the theme and is kept in `localStorage` (`tarja:list-grouping`; a blocked storage means it lasts for the session).
- **Groups.** A group's header has the label at the start and the subtotal at the end, over the same hairline as before. The day is the long weekday date; a week reads "Week of" its Monday; a month is its name; a category is its icon and name. The year is added to the label when the groups cross a New Year. Days, weeks and months go newest first, and the rows inside a group too; categories go from the biggest subtotal to the smallest, and by id when they tie. A screen reader hears "Total" before the subtotal. When the grouping is not by day, each row's details start with the day it was made.
- **The subtotal** adds the rows of the group, all of them, even those still behind "Show more": a plan at its full price on its purchase day and a restaurant card expense at your part. It is by the day made, so it is not what was spent in that period, and it can differ from the summary and the charts, which count each expense on the day it is charged (`ARCHITECTURE.md` §5).
- **Show more.** The list draws 100 rows, and "Show more" under it adds 100 each time; any change to the search, a filter or the grouping starts over at 100. The focus goes to the first row that "Show more" brings in, also when that was the last press and the button is gone. Variable-height cards, the fade of a deleted row and the browser's find in page rule out windowing the list.
- On a phone the search field and the toggle take the full width, and nothing overflows down to 320 px: the dates stack under 365 px or so, and the options of a `ChoiceGroup` wrap.

### Categories

- `/categories`, reached from a section of the settings that says what categories are for. The person's own categories are rows of the notch with the icon, the name and the chevron at its end; the built-in ones are rows with nothing to open, so they have no chevron.
- A row is a disclosure: pressing it opens a panel right under it with Edit and Delete, and pressing it again closes the panel. Rows open one by one, not as an accordion. The panel comes in with a fade and a short vertical shift over `--duration-base`, like a new expense.
- Edit turns the name of the row into a field, in the same box, and the panel under it holds the color and icon picker as it always did (still behind its "Color and icon" summary), then Save and Cancel, all outside the L of the field. Saving closes the panel; cancelling goes back to Edit and Delete.
- Delete asks in the panel, with the question and Delete and Cancel, and says what happens to the expenses.
- Offline, the rows still open but the buttons in the panel are off, with the notice at the top saying why.

### Summary

- `/summary`, linked from the header, shows one month at a time. It opens on the current month, whose name sits between two arrow buttons (previous and next, at least `--size-touch` wide); the month isn't in the URL.
- The month's numbers are notch-bordered rows: income (what the person set, or "Not set"), restaurant card (what the card paid for you of the expenses charged in the month, only when there is some), paid back by others (what others paid back of the restaurant card expenses made in the month, only when there is some), spent, and left. Left is the row that matters: bold, and in `--color-danger` below zero. It stays hidden, with a hint, until the income is set. The rows are `--size-2` apart, as in the category list, and the arrows of the month and the income field with its buttons are `--size-4` apart, also when the income row wraps.
- Under the rows, one form sets the income: an amount field and Save, and Remove once there is one. Setting it needs a connection (`ARCHITECTURE.md` §5), so offline the form is disabled and says why; the numbers themselves still show from the local copy.
- A link at the bottom leads to the charts.

### Charts

- `/charts`, one level deeper than the summary it is reached from. Everything is computed on the device from the local expenses, so it works offline.
- Filters on top: group by (day, week or month, a choice group), category (a select that starts at all of them) and from/to dates. Until the person picks dates the range follows the grouping: the whole current month for days, twelve weeks counting this one for weeks, twelve months counting this one for months, each up to the end of its period so that what is still to be charged in it shows, as it does in the summary. Picking dates keeps them whatever the grouping, and a button brings the defaults back. Only days between 2000 and 2099 count, because a date field passes through years like 0002 and 0020 while one is typed; whatever doesn't make a day yet stays in the field without touching the chart, and leaving the field puts the range back. A start after the end, or a range of more than 400 rows, is refused with a message tied to the fields instead of an empty or endless chart; for a range that is too long the total and the split by category still show. Weeks start on Monday.
- **The stat row** comes first under the filters, as a `Card`: the total of the whole range in the category picked, in bold, and under it the change against an earlier span of the same length (`ARCHITECTURE.md` §5), in the same category: an arrow (↑ or ↓, none when it rounds to 0%), the signed share and what is compared. When the whole range is compared, the line names the earlier span, as in "↑ +12% vs. Aug 31 – Sep 30". While the range is still running only its days up to today are compared, so the line names both sides, as in "↓ -50%, Oct 1 – 3 vs. Sep 28 – 30". A span of whole months reads as months ("Sep 2026"), any other as days, with the year when it isn't this one. When nothing was spent in the earlier span, the line says so instead of a share; a range that starts after today has no line at all. The arrow and the sign carry the direction; no color does, and spending more is not an error, so the danger color stays out of it. A range too long to draw still has its stat row and its split.
- **The spending chart** has a column for each day, week or month of the range, oldest first, empty ones included, in one `<svg>` that stretches to the width of the screen's column (a `viewBox` with `preserveAspectRatio="none"`) at a fixed height. Columns are flat rectangles in the accent (`--color-bg-accent`) with square corners, a quarter of their slot apart while there are 60 or fewer; past that they touch and read as a silhouette. A column with anything spent is never flatter than 2 px, so a small amount never reads as nothing. A column is never narrower than 1 px, so 400 days on a phone scroll sideways inside the chart's box and the page never does.
- The scale is round (`niceScale`): 3 to 5 ticks, 1, 2, 2.5 or 5 times a power of ten apart, from 0 to the first one that holds the biggest column (one euro when nothing was spent). Every tick but 0 is a hairline (`--color-border-subtle`) across the plot, and its amount is an HTML label on the left at `--font-size-s`, so it follows the font tokens; a scale in whole euros leaves out the cents. The plot box has the notch: its thick ink left edge is the axis and its bottom edge the baseline. Under it, the first and the last row are named in short, also in HTML.
- Two columns are marked by shape, not by color. The biggest one wears an ink cap, a short bar as wide as the column just above its top (the first of them on a tie, none when nothing was spent). Today's row is framed by an ink hairline from the top of the plot down to the baseline, so it shows even when nothing was spent that day.
- **Reading a column.** The chart is one tab stop. The arrows move the selection one row (from none, → picks the first and ← the last), Home and End jump to the first and the last (with Alt, Ctrl or ⌘ held they are left to the browser, whose Alt+← goes back), and a tap or a click picks the column under it: the whole slot, as tall as the plot, answers, so a thin column needn't be hit. Dragging picks nothing, so a swipe still scrolls a chart wider than its box. The selected slot sits on `--color-bg-secondary` and its column turns ink, also never flatter than 2 px, so a picked empty row still shows on the baseline. A line under the chart (`aria-live="polite"`) reads the selection: the row's name and its amount, with the category when one is picked ("Sun, Oct 25: €48.99", "Sun, Oct 25, Food: €3.00"); before any, it says how to pick one. The selection stays on its row when the category changes and goes away when the row leaves the range or the grouping changes. The focus ring goes around the plot box. The chart stays an image, not a slider: screen readers in browse mode, such as NVDA and JAWS, keep the arrows for themselves, so their users read the summary label and the table instead.
- **The text alternative.** The `<svg>` has `role="img"` and a label made from the numbers: how many rows, the total and the biggest row ("Spending over 31 days: €89.49 in total. Highest: €48.99 (Sun, Oct 25)."). Under the readout, a closed `Disclosure`, "Show the numbers", holds a table with a row for each day, week or month, empty ones included: its name (with the year when the range goes over a New Year) and its amount.
- **The split by category** comes last: one strip, `--size-4` tall, cut into a segment per category, the biggest first from the start, each as wide as its share, in the color of its category (the same as its icon, gray for "Other" and for a deleted category) and parted by a 2 px gap of the page color. It is `aria-hidden`: the rows under it carry the numbers. The rows are `Card`s in a `CardList`, each with the icon and the name (the color alone says nothing), the amount and the share, and no bar of its own. The split ignores the category filter, so it still answers where the money went; categories that took the same go in the order of their names. Until the categories are known, an expense is never moved to the fallback. A category that was deleted shows as the fallback category, like in the list. With nothing spent, a quiet `Notice` says so instead.
- Category colors paint the icon and the segments of the split (see Category colors); the columns of the spending chart stay in the accent. The color never says which segment is which alone: the rows under the strip give each one its icon and its name.

## 6. Motion

- Animated transitions are part of the identity: things enter, leave and change with a transition.
- Always use `--duration-fast`, `--duration-base` and `--duration-slow` (120, 200 and 360 ms) and `--ease-standard`, `--ease-enter` and `--ease-exit`. Never literal values.
- `prefers-reduced-motion` zeroes the durations in one place (`tokens.css`). Components don't special-case it.
- Prefer animating `transform` and `opacity`.
- **Routes slide horizontally.** Each route has a depth: `/` is 0, `/settings` and `/summary` 1, `/categories` and `/charts` 2. Going deeper, the new screen enters from the right and the old one leaves to the left; going back, the other way round. Fade plus `translateX`, over `--duration-base`. Between two screens at the same depth (Summary and Settings, the charts and the categories) the page doesn't slide: it only fades, over `--duration-base` (the `level` transition type). With reduced motion the durations are zero, so the screen just changes.
- **The header underline** slides to the word of the new section as one piece, stretching to its width, over `--duration-base` with `--ease-standard`, whatever the page does under it. It is a single element with a `view-transition-name` of its own (`nav-underline`), and no script animates it; only the new mark is drawn while it moves. The header reads the screen already shown, not the one being opened, so the underline is still in its old place when the transition takes its first picture.
- **Toast.** It comes in from below with a fade and a short vertical shift over `--duration-base` with `--ease-enter`, and leaves the same way with `--ease-exit`.
- **Lists.** A new expense enters from above with a fade and a short vertical shift; a deleted one fades out before it leaves. A row that starts to match a search or a filter, or that lands in another group, comes in the same way; one that stops matching just leaves.
- **Disclosures.** The panel under a row comes in with a fade and a short vertical shift, over `--duration-base`. A panel kept in the page, like the add form, leaves the same way, over `--duration-base` with `--ease-exit`, and only then drops out of the layout. The chevron at the end of the row turns half a turn as it opens and turns back as it closes, over `--duration-base` with `--ease-standard`, by `transform`, driven by `aria-expanded` on the toggle.
- **Charts.** Columns grow up from the baseline (`scaleY`, from the bottom) and the segments of the split along from their start (`scaleX`, moved into place by `translateX`), over `--duration-base` with `--ease-standard`, when they come in and on every change of range, grouping or category. The cap of the biggest column rides on its top the same way. The selection, today's frame and the scale change at once.

## 7. CSS and copy conventions

- Plain CSS, in the file of the route or component that uses it. BEM class names, alphabetical properties, no `!important`; Stylelint enforces them. Combine classes with `clsx`.
- Spacing, motion and color come from `tokens.css`.
- UI text is never hard-coded: it goes through i18n (`src/assets/locales`). Everything else in the project is in English.

## 8. Open questions

Add here what comes up, and ask the owner before settling it.

- The selected column of the spending chart turns ink, and in the gray accent in dark (`#d4d4d4` against white) that is a weak change; the tint of its slot is the only other mark. Should it get an ink frame instead?
