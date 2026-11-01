# Bottom Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Below 40 rem the four destinations are a tab bar at the bottom of the screen and the header holds only the logo; from 40 rem the header holds the four words, Groups among them.

**Architecture:** A `useWide()` hook on the media query `(width >= 40rem)` decides which navigation is in the page, so there is never a second set of the same links. A shared `BottomNav` component takes its items by props; the root layout builds them, with the same Expenses and logo behavior the header words have. Groups is a placeholder screen until milestone 24.

**Tech Stack:** React 19, TanStack Router (file-based) and Query, `use-intl`, plain CSS with tokens, Vitest with jsdom and Testing Library, Storybook in `design-system/`.

**Spec:** `docs/specs/bottom-navigation.md`, `docs/specs/header.md`, `design-system/DESIGN.md` (components `BottomNav`, layout, motion), `docs/adr/0012-shared-expenses.md`.

## Global Constraints

- pnpm only; no new dependency. Functions are arrow functions; props are an `interface FooProps`, destructured inside the function body; named exports in one `export { … }` at the bottom, types inline; the class string of an element is a `fooClsx` variable above the `return`.
- Imports: `./` inside the same folder, otherwise `@/`, `@core/`, `@server/`; never `../`.
- Tests sit next to the code, import `describe`, `it`, `expect`, `vi` from `vitest`, carry no comments, and read expected copy from `en.json`.
- Shared components take their copy by props: no `use-intl`, no `virtual:*` import, and only the link components know the router.
- Styles: plain CSS, BEM, alphabetical properties, no `!important`, colors only from `--color-*` tokens, no gradients or shadows, transitions only with `--duration-*` and `--ease-*` and only on `transform` and `opacity` where possible. Base CSS targets phones; widen with `@media (width >= 40rem)`, never `max-width`. Touch targets at least `--size-touch`. Pad edge-anchored layouts with `env(safe-area-inset-*)`.
- Copy in `src/assets/locales/{en,es}.json`, a new key in both; "Tarja" is not translated.
- Commit messages: one conventional-commit subject line, no body, no trailers. The husky hook runs `format:check`, `types:check`, `lint` and `test` on every commit.
- The bar: Expenses `/`, Groups `/groups`, Summary `/summary`, Settings `/settings`, in this order, each an icon over its word at `--font-size-s`; fixed at the bottom on `--color-bg-secondary` with an ink hairline on top; current tab `aria-current="page"` and a `--size-1` ink bar along its top edge; hidden from 40 rem up; hidden while a text field or a `Select` has the focus.

## Review Focus

- Crossing 40 rem with the add form half typed: the text must survive the swap between header words and bar (test in Task 4).
- Keyboard users: a hidden bar must not take the focus. A transform alone leaves its links tabbable, so the hidden state also sets `visibility: hidden` (checked by hand in Task 5, CSS only).
- The last content of a long page and the toast must not sit under the bar (padding and offset, checked by hand in Task 5).
- A deeper screen marks the tab it is reached from, and an unknown path marks Expenses (tests in Tasks 1 and 4).
- Landscape phones with side safe areas: the bar pads left and right with `env(safe-area-inset-*)` (checked by hand in Task 5).

---

### Task 1: The Groups screen, its depth and its word in the header

**Files:**

- Modify: `src/lib/route-transition.ts`, `src/lib/route-transition.test.ts`
- Create: `src/routes/groups.tsx`, `src/features/groups/groups.tsx`
- Modify: `src/assets/locales/en.json`, `src/assets/locales/es.json`, `src/routes/__root.tsx`, `src/routes/routes.test.tsx`
- Regenerated: `src/routeTree.gen.ts`

**Interfaces:**

- Produces: `NavSection` gains `'/groups'`; `routeDepth('/groups') === 1`; `navSection('/groups') === '/groups'`; locale keys `nav.groups` ("Groups" / "Grupos"), `nav.label` ("Main" / "Principal", the name of the navigation landmark), `groups.title` ("Groups" / "Grupos"), `groups.soon` ("Groups are coming soon." / "Los grupos llegan pronto."); component `Groups` in `src/features/groups/groups.tsx`; route `/groups` (depth 1).

- [ ] **Step 1: Write the failing tests**

In `route-transition.test.ts`: `routeDepth('/groups')` is 1; `navSection('/groups')` is `'/groups'`; `between('/', '/groups')` is `['forward']`; `between('/groups', '/summary')` and `between('/settings', '/groups')` are `['level']`.
In `routes.test.tsx`: the header test lists `[en.nav.expenses, 'Tarja', en.nav.groups, en.nav.summary, en.nav.settings]`; opening `/groups` shows a heading `en.groups.title` and the text `en.groups.soon`, underlines only `en.nav.groups`, and `link(en.nav.groups)` has `aria-current="true"`; clicking the Groups word from home reaches that heading.

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm vitest run --project core --project front -t "groups|header|routeDepth|navSection|slideTypes"`
Expected: FAIL (no `/groups` depth, no Groups link).

- [ ] **Step 3: Implement**

`route-transition.ts`: add `'/groups': 1` to `DEPTHS`, `'/groups'` to `NavSection`, `'/groups': '/groups'` to `SECTIONS`. Add the four locale keys to both files (keys sorted as the files are). `Groups` renders an `h1.groups__title`-style heading from `t('groups.title')` and a quiet `Notice` with `t('groups.soon')`, the way `src/features/summary` composes a screen; the route file is `createFileRoute('/groups')({ component: Groups })`, like `src/routes/summary.tsx`. In `RootHeader` add the Groups `Link` first in the right group, with `aria-current={current('/groups')}` and `underline('/groups')`. Regenerate the route tree with `pnpm exec vite build` (the router plugin writes `src/routeTree.gen.ts`), then check `git diff --stat src/routeTree.gen.ts`.

- [ ] **Step 4: Run the tests to see them pass**

Run: `pnpm vitest run --project core --project front`
Expected: PASS, including the locale parity test.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add the Groups screen and its word in the header"
```

---

### Task 2: `useWide`, and a viewport for the tests

**Files:**

- Create: `src/lib/use-wide.ts`, `src/lib/use-wide.test.tsx`, `src/lib/test/viewport.ts`
- Modify: `src/lib/test/setup.ts`

**Interfaces:**

- Produces: `WIDE_QUERY = '(width >= 40rem)'` and `useWide(): boolean` from `@/lib/use-wide`; `stubViewport(wide: boolean): { setWide: (wide: boolean) => void }` from `@/lib/test/viewport`, which installs a `window.matchMedia` that answers `WIDE_QUERY` and fires `change` listeners when `setWide` is called.

- [ ] **Step 1: Write the failing tests** in `use-wide.test.tsx`, rendering a probe component that prints the hook's value:
    - without `window.matchMedia` (jsdom's own state) it is `true`;
    - after `stubViewport(false)` it is `false`; after `stubViewport(true)` it is `true`;
    - calling `setWide(true)` on a mounted probe that was `false` re-renders it as `true` (inside `act`);
    - unmounting removes the `change` listener (the stub exposes the listener count it holds, or the test spies on `removeEventListener`).

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm vitest run --project front src/lib/use-wide.test.tsx`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement** `useWide` with `useSyncExternalStore`: the snapshot is `matchMedia(WIDE_QUERY).matches`, or `true` when `window.matchMedia` is not a function; subscribe adds and removes a `change` listener on the `MediaQueryList`, and subscribes to nothing when `matchMedia` is missing; the server snapshot is `true`. `stubViewport` assigns `window.matchMedia` with a `MediaQueryList`-shaped object (`matches`, `media`, `addEventListener`, `removeEventListener`). In `setup.ts`, extend the `afterEach` so `window.matchMedia` is deleted (`Reflect.deleteProperty`) after every test.

- [ ] **Step 4: Run them to see them pass**

Run: `pnpm vitest run --project front`
Expected: PASS, and no other test changes behavior (they all get the wide screen).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add useWide, a hook on the wide screen media query"
```

---

### Task 3: The `BottomNav` component, its icons and its story

**Files:**

- Modify: `src/components/icon/icon-paths.ts`
- Create: `src/components/bottom-nav/bottom-nav.tsx`, `src/components/bottom-nav/bottom-nav.css`, `src/components/bottom-nav/bottom-nav.test.tsx`, `design-system/stories/components/bottom-nav.stories.tsx`

**Interfaces:**

- Produces: `UI_ICONS` gains `'groups'`, `'bar_chart'` and `'settings'` (the fourth tab uses `receipt_long`, already a category icon); `BottomNav` with

```ts
interface BottomNavItem {
    to: LinkProps['to'];
    label: string;
    icon: IconName;
    current: boolean;
    onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
}
interface BottomNavProps {
    label: string;
    items: readonly BottomNavItem[];
}
```

- [ ] **Step 1: Write the failing tests** in `bottom-nav.test.tsx`, inside a router frame like `button-link.test.tsx`'s `renderInRouter` (routes `/`, `/groups`, `/summary`, `/settings`):
    - there is one `navigation` named by `label`, and its links read, in order, the labels of the items, each with the `href` of its `to`;
    - the item with `current` has `aria-current="page"` and the others have no `aria-current`;
    - every link holds an `svg` with `aria-hidden="true"` and `data-icon` equal to its item's icon, and its word as text;
    - pressing a link calls its `onClick` with the event, and one without `onClick` doesn't throw.

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm vitest run --project front src/components/bottom-nav`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement.**
    - Icons: take the Sharp, weight 400 paths of `groups`, `bar_chart` and `settings` from the Material Symbols repository (`https://raw.githubusercontent.com/google/material-design-icons/master/symbols/web/<name>/materialsymbolssharp/<name>_wght400_24px.svg`, viewBox `0 -960 960 960`), copy the `d` of the `<path>` into `ICON_PATHS` and the names into `UI_ICONS`. Carry the license notice the way the existing icons do (`design-system/DESIGN.md`, Icons).
    - `BottomNav` renders `<nav className="bottom-nav" aria-label={label}>` with a `<ul>`; each `<li>` holds a TanStack `Link` (class `bottom-nav__link`, `bottom-nav--current` style via `aria-current`), `Icon` over a `<span className="bottom-nav__word">`. `current` sets `aria-current="page"`.
    - CSS: `position: fixed` at the bottom, `inset-inline: 0`, `background: var(--color-bg-secondary)`, `border-top: var(--size-px) solid var(--color-border)`, padding `0 env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)`, `view-transition-name: bottom-nav`; the list is a grid of equal columns; a link is a column flex (icon over word), `min-height: var(--size-touch)`, centered, `color: inherit`, no underline, `font-size: var(--font-size-s)`, with `border-top: var(--size-1) solid transparent` and `border-top-color: var(--color-border)` for `[aria-current='page']`; a focus ring as the other links have it, drawn inside (`outline-offset: var(--focus-inset)`).
    - Story: `Components/BottomNav`, one function story `BottomNav`, args `label` and `items` with the first current; a router frame as in `button-link.stories.tsx`.

- [ ] **Step 4: Run them to see them pass**

Run: `pnpm vitest run --project front src/components/bottom-nav && pnpm types:check && pnpm lint`
Expected: PASS and no type or lint errors (lint covers the story and the CSS).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add the BottomNav component with its story"
```

---

### Task 4: One navigation at a time in the layout

**Files:**

- Modify: `src/routes/__root.tsx`, `src/routes/root.css`, `src/assets/styles/tokens.css`, `src/components/toast/toast.css`, `src/components/bottom-nav/bottom-nav.css`, `src/routes/routes.test.tsx`

**Interfaces:**

- Consumes: `useWide` (Task 2), `BottomNav` and `BottomNavItem` (Task 3), `navSection`, `useAddForm().collapse/reveal` (existing).
- Produces: token `--bottom-nav-height` in `tokens.css` (the bar without the safe area, `3.75rem`); class `root--tabs` on `.root` while the bar is shown.

- [ ] **Step 1: Write the failing tests** in `routes.test.tsx`, in a new `describe('bottom navigation')` that calls `stubViewport(false)` before `renderApp`:
    - the page has exactly one `navigation`, whose links read `[en.nav.expenses, en.nav.groups, en.nav.summary, en.nav.settings]`, and the `banner` holds a single link, `Tarja`, and no `.root__underline`;
    - `Expenses` collapses the add form and the logo opens it; what was typed in the form survives both;
    - `/charts` marks the Summary tab with `aria-current="page"`, `/categories` Settings, `/groups` Groups, `/nowhere` Expenses, and only that one;
    - pressing the tab that is current calls `window.scrollTo` with `top: 0` (spy) and does not leave the screen;
    - on the wide screen (`stubViewport(true)`, or none) there is no `.bottom-nav`;
    - with the phone layout, text typed in the form is still there after `setWide(true)`, and the header then holds the four words.

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm vitest run --project front src/routes/routes.test.tsx -t "bottom navigation"`
Expected: FAIL.

- [ ] **Step 3: Implement.**
    - `__root.tsx`: `const wide = useWide()` in `RootLayout`. Wide: today's `RootHeader` (its `<nav aria-label>` now takes `t('label')`). Not wide: the header holds only the `Brand` link (same `reveal()` on click, not inside a `<nav>`), and `RootTabs` renders `<BottomNav label={t('label')} items={…}/>` with the four items (`receipt_long`, `groups`, `bar_chart`, `settings`; `current` from `navSection`). The Expenses item's `onClick` collapses the form unless `opensElsewhere`; any item's `onClick` on the current tab calls `window.scrollTo({ top: 0 })`. `.root` gets `root--tabs` while the bar shows.
    - CSS: `tokens.css` defines `--bottom-nav-height: 3.75rem`. `root.css`: on `.root--tabs` the header is the logo centered (`justify-content: center`), and `.root__main` adds `calc(var(--bottom-nav-height) + env(safe-area-inset-bottom))` to its bottom padding. `toast.css`: `:root:has(.bottom-nav) .toast-region` lifts its bottom padding by the same amount. `bottom-nav.css`: while `:root:has(input:focus, textarea:focus, [role='combobox']:focus)` the bar goes `transform: translateY(100%)`, `opacity: 0`, `visibility: hidden` (with `visibility` delayed by `--duration-base` on the way out), `pointer-events: none`, transitioning only `transform` and `opacity`.

- [ ] **Step 4: Run everything**

Run: `pnpm format:check && pnpm types:check && pnpm lint && pnpm test`
Expected: PASS; no existing test changed behavior.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: show the navigation as a bottom bar on phones"
```

---

### Task 5: Look at it, sync the docs, close the item

**Files:**

- Modify: `docs/specs/bottom-navigation.md`, `docs/specs/header.md`, `design-system/DESIGN.md` (only where the build differs from them), `TODO.md`
- Delete: this plan

- [ ] **Step 1: Check by hand** with `pnpm dev` (or `pnpm storybook` for the component) in a browser at 320, 360, 390 and 640 px, light and dark, English and Spanish, gray and one other accent:
    - nothing overflows at 320 px in either language, the four tabs are equal and the words fit;
    - the bar sits above the home indicator (safe area) and, in landscape, clear of the side insets;
    - the last row of a long list and the update toast are not under the bar;
    - the bar slides away when the description field or a `Select` takes the focus, comes back when it loses it, and Tab never lands on its links while it is hidden;
    - changing tab fades; going to `/charts` from Summary slides; the current tab shows the ink bar on its top edge;
    - at 640 px the bar is gone and the header shows four words with the underline.

- [ ] **Step 2: Fix what it shows**, adding a test for anything a test can pin.

- [ ] **Step 3: Sync the docs.** Where the build differs from `bottom-navigation.md`, `header.md` or `DESIGN.md`, change the document first. Delete item 19 from `TODO.md` (the numbers stay) and delete this plan file.

- [ ] **Step 4: Run everything**

Run: `pnpm format:check && pnpm types:check && pnpm lint && pnpm test && pnpm build`
Expected: all PASS.

- [ ] **Step 5: Commit and push**

```bash
git add -A
git commit -m "docs: close the bottom navigation item"
git push
```
