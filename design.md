# Tarja — Design

Source of truth for the visual and interaction rules. `src/assets/styles/tokens.css` implements the tokens; if a rule changes, update this document first. Architecture and product decisions live in `ARCHITECTURE.md`.

## 1. Principles

- **Simple for the user.** Few things on screen, few choices, sensible defaults. Logging an expense should take seconds and work one-handed.
- **Minimalist.** Black and white do the work. Color is rare and always means something.
- **Flat.** Solid fills only.
- **Sharp.** No rounded corners.
- **Mobile-first.** The phone layout is the base; larger screens are an extension.
- **Motion explains.** Transitions show what changed. They never decorate.

## 2. Color and themes

### Flat colors

Solid colors only: no gradients, no shadows, no blur. Separation comes from borders and from the two surface tones, not from elevation.

### Palette

The base is white (light theme) or black (dark theme), with text in the opposite one. The dark theme is true black. Everything else is a neutral gray, one accent and one danger color.

| Token                       | Light     | Dark      | Use                                                        |
| --------------------------- | --------- | --------- | ---------------------------------------------------------- |
| `--color-bg-primary`        | `#fff`    | `#000`    | Page background                                            |
| `--color-bg-secondary`      | `#f4f4f4` | `#141414` | Header and raised surfaces. The browser toolbar matches it |
| `--color-content-primary`   | `#000`    | `#fff`    | Text and icons                                             |
| `--color-content-secondary` | `#595959` | `#a3a3a3` | Secondary text                                             |
| `--color-border`            | `#000`    | `#fff`    | Structural borders (ink)                                   |
| `--color-border-subtle`     | `#d4d4d4` | `#2e2e2e` | Hairline dividers                                          |
| `--color-accent`            | `#1d4ed8` | `#8aa4ff` | The only hue: links, selection, primary action             |
| `--color-bg-accent`         | accent    | accent    | Fill behind a primary action                               |
| `--color-content-on-accent` | `#fff`    | `#000`    | Text on that fill                                          |
| `--color-border-focus`      | accent    | accent    | Focus ring                                                 |
| `--color-danger`            | `#c81e1e` | `#f87171` | Errors and destructive actions only                        |

Rules:

- One accent and one danger color. There are no success or warning colors: use text, an icon or position instead. A new color needs a reason and an update to this table.
- Components use only the semantic `--color-*` tokens, never raw values. Raw values live in `tokens.css`.
- Never convey meaning by color alone.
- Contrast follows WCAG 2 AA: 4.5:1 for text, 3:1 for borders and focus rings. Every pair in the table was checked on 2026-10-25 (text on a background: 5.2:1 at worst; ink on background: 18:1 or more). Check again when a value changes.
- Categories aren't color-coded by default (§8).

### Themes

Three settings, as in `spa-anicalendar`: system (the default), light and dark.

- Tokens are defined once with `light-dark()`, with `color-scheme: light dark` on `:root`. An explicit choice sets `data-theme="light"` or `data-theme="dark"` on `<html>`, which forces `color-scheme`. "System" removes the attribute, so the OS preference applies from the first paint, with no flash and no inline script.
- A theme change fades the colors instead of snapping. Wrap the state update in `withColorTransition`, as `lib/color-transition.ts` does in `spa-anicalendar`: it sets `data-color-transition` on `<html>` for `--duration-slow`. Don't use a View Transition for this: it makes the page inert, and a click in the middle of the fade lands on `<html>`.
- The browser toolbar color (`<meta name="theme-color">`) mirrors `--color-bg-secondary`, the header surface. `index.html` carries one per OS preference; once the theme setting exists, JS updates it for an explicit choice.

The theme setting itself isn't built yet (see `TODO.md`).

## 3. Shape

- **No rounded corners.** Never use `border-radius`; there are no radius tokens. This includes buttons, inputs, avatars and focus outlines.
- **Borders carry the structure** where other designs use shadows. `--color-border` (ink) for structure, `--color-border-subtle` for dividers. The standard width is 1 px (`--size-px`); a thicker border (`--size-1`) marks emphasis.
- **Uneven borders.** The edges of one box don't have to match: different widths, or an edge missing, give the cut-by-hand feeling of a tally stick. The direction is decided; the concrete rules are open (§8). The status line on the home screen is the current example: a thick left border only.

## 4. Typography

The system font stack (`system-ui`) is a placeholder. The typeface and the type scale are open (§8). Form controls inherit the page font and its 16 px size.

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
- Route and list transitions are open (§8).

## 7. CSS and copy conventions

- Plain CSS, in the file of the route or component that uses it. BEM class names, alphabetical properties, no `!important`; Stylelint enforces them. Combine classes with `clsx`.
- Spacing, motion and color come from `tokens.css`.
- UI text is never hard-coded: it goes through i18n (`src/assets/locales`). Everything else in the project is in English.

## 8. Open questions

- Uneven borders: which sides, which widths, and whether each component gets its own pattern or they share one.
- Accent hue: the blue is provisional. Confirm it or pick another.
- Typeface and type scale.
- How categories are told apart without color (icon, initial, position), or whether they get subtle tints after all.
- Icon style.
- Route and list transition style.
