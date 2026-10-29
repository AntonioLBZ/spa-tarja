# ADR-0011: The design system is shown in Storybook, in a workspace folder of its own

- Status: Accepted
- Date: 2026-10-29

## Context

The shared components in `src/components` and the rules in [`DESIGN.md`](../../design-system/DESIGN.md) are only visible inside the screens that use them. The owner wants to see them on their own, from a URL, locally for now.

## Decision

- `design-system/` is a private pnpm workspace package that holds Storybook and the stories. The components stay in `src/components` and the stories import them, so `src/` carries no Storybook file, story or dependency. The package imports from `src/` and `core/`; nothing imports from it.
- It runs on the owner's machine only (`pnpm storybook`). It is not published and not part of the deployed Worker, whose service worker would precache it. If it is ever published, it goes in a Worker of its own, never in the `dist` of the app.
- Storybook 10 with `@storybook/react-vite` and `@storybook/addon-a11y` (10.6.5 on 2026-10-29, which accepts Vite 8 and React 19). No test addon: `@storybook/addon-vitest` needs Playwright browsers and overlaps the `front` tests.
- It has its own Vite config, without the Cloudflare, router and PWA plugins of the app.

## Consequences

- Shared components take their copy by props: they read no messages (`use-intl`), import no virtual module and only `ButtonLink` knows the router. `Toast` reads the duration tokens through `lib/motion` and `DateRangeFields` the day check of `core/date`; both stay.
- Stories are not tests, and `types:check` and `lint` cover the folder. CI doesn't build Storybook: a broken story would otherwise stop the deploy of the app.

## Alternatives considered

- **A package for the components** (`packages/ui`) with Storybook inside, rejected for now: `MonthSwitch` and `UpdatePrompt` read the messages, `ButtonLink` is typed against the app's routes, `Toast` and `DateRangeFields` import from `lib` and `core`, the tokens and the fonts live in `src/assets`, and 24 files import `@/components`. With one consumer and nothing to publish it buys nothing the workspace folder doesn't. Revisit with a second consumer.
- **Stories next to each component**, rejected for the same reason: `src/` would carry Storybook's files, its dependencies and a lint exception for `export default`.
