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

| Token                       | Light     | Dark      | Use                                                                                |
| --------------------------- | --------- | --------- | ---------------------------------------------------------------------------------- |
| `--color-bg-primary`        | `#fff`    | `#000`    | Page background                                                                    |
| `--color-bg-secondary`      | `#f4f4f4` | `#141414` | Header and raised surfaces. The browser toolbar matches it                         |
| `--color-content-primary`   | `#000`    | `#fff`    | Text and icons                                                                     |
| `--color-content-secondary` | `#595959` | `#a3a3a3` | Secondary text                                                                     |
| `--color-border`            | `#000`    | `#fff`    | Structural borders (ink)                                                           |
| `--color-border-subtle`     | `#d4d4d4` | `#2e2e2e` | Hairline dividers                                                                  |
| `--color-accent`            | `#9a5b00` | `#f0a830` | The interface hue: links, selection, primary action (amber by default, see Accent) |
| `--color-bg-accent`         | accent    | accent    | Fill behind a primary action                                                       |
| `--color-content-on-accent` | `#fff`    | `#000`    | Text on that fill                                                                  |
| `--color-border-focus`      | accent    | accent    | Focus ring                                                                         |
| `--color-danger`            | `#c81e1e` | `#f87171` | Errors and destructive actions only                                                |

Rules:

- One accent at a time and one danger color. There are no success or warning colors: use text, an icon or position instead. A new color needs a reason and an update to this table.
- Components use only the semantic `--color-*` tokens, never raw values. Raw values live in `tokens.css`.
- Never convey meaning by color alone.
- Contrast follows WCAG 2 AA: 4.5:1 for text, 3:1 for borders and focus rings. Every pair in the table was checked on 2026-10-25 (text on a background: 4.5:1 at worst; ink on background: 18:1 or more). Check again when a value changes.
- Category colors have their own rules (see Category colors).

### Accent

The user picks the accent from a fixed list, as in `spa-anicalendar`: `data-accent` on `<html>` selects a block that redefines `--color-accent` and the tokens built on it. Amber is the default. Each preset has its own light and dark tone, tuned by hand and checked against both surfaces (`--color-bg-primary` and `--color-bg-secondary`).

| Preset            | Light     | Dark      |
| ----------------- | --------- | --------- |
| `amber` (default) | `#9a5b00` | `#f0a830` |
| `blue`            | `#1d4ed8` | `#8aa4ff` |
| `green`           | `#15803d` | `#4ade80` |
| `violet`          | `#6d28d9` | `#c4b5fd` |
| `pink`            | `#be185d` | `#f9a8d4` |
| `gray`            | `#404040` | `#d4d4d4` |

- Every accent reaches 4.5:1 as text on both surfaces, and its on-accent text (white in light, black in dark) reaches 5:1 on its own fill. Checked on 2026-10-25.
- There is no red preset: it would read as the danger color.
- The accent never changes the browser toolbar color, which follows the header surface.
- The choice lives in `localStorage` (`tarja:accent`) and is applied with the theme before the first render. The settings screen holds it as a `ChoiceGroup` next to the theme. Each option is labeled with its name, not just a swatch.

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
- Default categories have a fixed color and icon, defined in `core/` next to their ids. Custom categories choose one of the eight colors and one icon when created or edited; the default is the next color the user's categories haven't used yet (cycling once all are used) and the generic icon.
- Amber, orange and yellow sit close in hue. It is acceptable because the accent never paints an icon and every icon comes with its name; check it on screen and rebalance a tone if they get confused.

### Themes

Three settings, as in `spa-anicalendar`: system (the default), light and dark.

- Tokens are defined once with `light-dark()`, with `color-scheme: light dark` on `:root`. An explicit choice sets `data-theme="light"` or `data-theme="dark"` on `<html>`, which forces `color-scheme`. "System" removes the attribute, so the OS preference applies from the first paint, with no flash and no inline script.
- A theme change fades the colors instead of snapping. Wrap the state update in `withColorTransition`, as `lib/color-transition.ts` does in `spa-anicalendar`: it sets `data-color-transition` on `<html>` for `--duration-slow`. Don't use a View Transition for this: it makes the page inert, and a click in the middle of the fade lands on `<html>`.
- The browser toolbar color (`<meta name="theme-color">`) mirrors `--color-bg-secondary`, the header surface. `index.html` carries one per OS preference; JS points them all at the header surface for an explicit choice and puts them back for "system".
- The choice lives in `localStorage` (`tarja:theme`) and is applied before the first render. The settings screen (`/settings`, linked from the header) holds it, next to the language. Both are a `ChoiceGroup`: a radio group drawn as a row of boxes, the checked one filled with the accent.

## 3. Shape

- **No rounded corners.** Never use `border-radius`; there are no radius tokens. This includes buttons, inputs, avatars and focus outlines.
- **Borders carry the structure** where other designs use shadows. `--color-border` (ink) for structure, `--color-border-subtle` for dividers. Dividers are 1 px (`--size-px`); the notch and emphasis use `--size-1`.
- **Form controls** share one look, set on the elements in `base.css`: the notch (below) on a `--color-bg-secondary` field, no radius, at least `--size-touch` tall. A button has the notch too; the primary action fills with the accent (`--color-bg-accent`) and a destructive one takes `--color-danger` for its text.
- **The notch.** The tally-stick cut: every box (form control, button, list row, card) has a thick ink border (`--size-1`) on the left and at the bottom, and none on top or on the right. Without an outline, a box that takes input sits on `--color-bg-secondary` so it still reads as a field. The focus ring is the exception: a full accent outline around the box. Messages (status, notices, errors) keep a thick left border only, in ink, or in `--color-danger` for errors. The widths are starting values, to tune on screen (§8).

## 4. Typography and icons

### Typography

- Everything is set in **IBM Plex Mono** (SIL OFL 1.1), amounts included: monospace lines the digits up and fits the ledger feeling. It comes from `@fontsource/ibm-plex-mono`, the latin subset (which covers the accents, ñ, ¿, ¡ and €) in weights 400 and 700, about 15 KB each. It is served by the app itself and precached, so it works offline; `font-display: swap` shows the fallback while it loads.
- Stack: `'IBM Plex Mono', ui-monospace, 'Cascadia Mono', Menlo, Consolas, monospace`.
- Form controls inherit the page font and its 16 px size.
- The type scale is open (§8). For now everything is 1 rem and the hierarchy comes from weight, case and spacing.
- The logo: the name set in the _Dot Matrix_ font (Moonbase Press, on dafont) is being considered, not adopted. See §8.

### Icons

- **Material Symbols, Sharp style** (Apache 2.0): square ends and corners, like the rest of the identity. Weight 400, 24 px grid, shown at `1.5rem`.
- Only the icons in use are copied into the repo as inline SVG (a few hundred bytes each), with the license notice. No icon font and no package at runtime.
- Icons are decorative (`aria-hidden`): the name always comes with them. They take `currentColor`, or the color of their category.
- The default categories use `restaurant`, `shopping_cart`, `sports_esports`, `receipt_long`, `home`, `directions_bus`, `medical_services` and `more_horiz`. A custom category with no pick uses `category`.

## 5. Layout and mobile-first

- Base CSS targets phones. Widen with `@media (width >= 40rem)` and `(width >= 64rem)`, never with `max-width` queries.
- The content column is capped at 40 rem and centered on larger screens.
- Touch targets are at least `--size-touch` (44 px).
- `viewport-fit=cover` is on, so anything anchored to an edge pads itself with `env(safe-area-inset-*)`.
- Use `dvh`, not `vh`, for full-height blocks.
- Form controls use 16 px or more, so iOS doesn't zoom in on focus.
- Layout still needs a check on a real iOS Safari and Android Chrome (`TODO.md`).

## 6. Motion

- Animated transitions are part of the identity: things enter, leave and change with a transition.
- Always use `--duration-fast`, `--duration-base` and `--duration-slow` (120, 200 and 360 ms) and `--ease-standard`, `--ease-enter` and `--ease-exit`. Never literal values.
- `prefers-reduced-motion` zeroes the durations in one place (`tokens.css`). Components don't special-case it.
- Prefer animating `transform` and `opacity`.
- **Routes slide horizontally.** Each route has a depth: `/` is 0, `/settings` 1, `/categories` 2. Going deeper, the new screen enters from the right and the old one leaves to the left; going back, the other way round. Fade plus `translateX`, over `--duration-base`. With reduced motion the durations are zero, so the screen just changes.
- **Lists.** A new expense enters from above with a fade and a short vertical shift; a deleted one fades out before it leaves.

## 7. CSS and copy conventions

- Plain CSS, in the file of the route or component that uses it. BEM class names, alphabetical properties, no `!important`; Stylelint enforces them. Combine classes with `clsx`.
- Spacing, motion and color come from `tokens.css`.
- UI text is never hard-coded: it goes through i18n (`src/assets/locales`). Everything else in the project is in English.

## 8. Open questions

- Type scale: everything is 1 rem today; decide whether the hierarchy needs sizes.
- Logo: _Dot Matrix_ is only "100% free" on dafont's label. The license is in the zip's text file and has to be read before the font goes into the repo; then pick the format (a subset with the letters of "Tarja", or an SVG of the name).
- The notch: the widths, and how a stack of list rows looks with a thick bottom edge each. Tune on screen.
- The 30 or so icons a custom category can choose from.
