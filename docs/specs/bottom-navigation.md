# Bottom navigation

On a phone the destinations are a bar at the bottom; from 40 rem up they stay in the header ([header](header.md)). The header at 320 px already drifts to fit three words and the logo, Groups make four, and the thumb reaches the bottom of a tall phone ([`DESIGN.md`](../../design-system/DESIGN.md#1-principles)).

## Rules

- **Four destinations**, in this order: Expenses (`/`), Groups (`/groups`), Summary (`/summary`) and Settings (`/settings`). The charts, the budgets, the categories, a group and its settings are deeper screens with no tab of their own: the tab of the screen they are reached from is the current one (the charts and the budgets under Summary, the categories under Settings, a group and its settings under Groups). `navSection` in `lib/route-transition` says which.
- **Below 40 rem** the bar is drawn and the header holds only the logo, centered, which leads home with the add form open as it does today. **From 40 rem** the bar isn't drawn and the header holds Expenses on the left, the logo and Groups, Summary and Settings on the right, with the same underline as now.
- **Expenses** does what the header word does ([expenses](expenses.md)): it leads home with the add form collapsed, also when it is pressed on the home screen. The other tabs lead to their screen; pressing the current one scrolls the page to the top.
- **Going between tabs** fades like any two screens at the same depth; going deeper slides ([`DESIGN.md`](../../design-system/DESIGN.md#6-motion)). Groups is depth 1, a group 2, its settings 3, `/join/$token` 1.
- **Nothing is hidden behind it.** The page has room at the bottom for the bar, and whatever is anchored to the bottom, the toast first, sits above the bar and the safe area. The bar is hidden while a text field or a `Select` has the focus, so the keyboard doesn't leave it floating, and comes back when the focus leaves.

## Screen

- `BottomNav`, a shared component (`src/components/bottom-nav`, with its story), fixed to the bottom on `--color-bg-secondary` with an ink hairline on top, as tall as `--size-touch` plus the label, plus `env(safe-area-inset-bottom)`. It is a `<nav>` with a list of links of equal width. Each is an icon over its word, at `--font-size-s`; the icon is decorative (`aria-hidden`) and the word is always there. A link is at least `--size-touch` tall.
- The current tab has `aria-current="page"` and, for a mark that doesn't depend on color, a bar of `--size-1` in ink along the top edge of its box, the counterpart of the underline of the header. No fill and no accent: the accent marks what can be acted on. It does not move between tabs: it appears on the new one with the fade of the page.
- Icons: `receipt_long` (Expenses), `groups` (Groups), `bar_chart` (Summary) and `settings` (Settings), in the interface set (`UI_ICONS`), outside the category icons. `groups` and `person` are also the icons of a group and a friend in the lists.
- The component takes its items by props: label, path and icon; it knows the router the way `ButtonLink` does and reads no messages ([frontend](frontend.md)).
- The words in Spanish are "Gastos", "Grupos", "Resumen" and "Ajustes". At 320 px each tab is 80 px wide, and nothing overflows in either language, with the fonts loaded or not.
