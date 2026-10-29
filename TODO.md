# TODO

Items build on each other in the order they appear below. Delete an item when it is done and its docs are updated; the numbers stay.

## Needs the owner

- Check the layout on a real iOS Safari and Android Chrome (safe areas, keyboard, install, the Undo toast and that the backup and the spreadsheet download from the installed app), and the visual identity there: the Dot Matrix logo in the header, the amber accent (one of those the user can pick) next to the orange and yellow category icons, and the slide between screens (a browser without view transitions, like iOS Safari before 18, just switches).
- Decide whether the app gets locales beyond `en` and `es`; the owner's `spa-anicalendar` also ships `fr` and `de`.
- Decide the domain. `tarja.dev` is available (checked on 2026-10-25) but costs money, which clashes with [free tiers only](docs/adr/0003-spa-on-one-worker-on-free-tiers.md); `tarja.app` and `tarja.com` are taken. `workers.dev` is in use, and a custom domain would mean updating the Google redirect URIs ([ADR-0008](docs/adr/0008-google-login-with-better-auth.md)).

## 16. Llevar a un storybook todos los componentes del proyecto como sistema de diseño.

Los componentes que sean el "mismo" pero diferente, reusar el mismo pero con diferentes size o variants

Decided: Storybook in a workspace folder of its own, `design-system/`, local only for now ([ADR-0011](docs/adr/0011-design-system-in-storybook.md)). The components stay in `src/components`. In this order:

1. Set up `design-system/`:
    - A private `package.json`, Storybook 10 with `@storybook/react-vite` and `@storybook/addon-a11y`, and its own Vite config: React and the `@/` and `@core/` aliases only, plus `VitePWA({ disable: true })` if a story needs the virtual module, as the `front` project does.
    - A preview that imports `main.css`, wraps the stories in the real `LocaleProvider`, `ThemeProvider` and `AccentProvider`, and has toolbar controls for the theme, the accent (six), the language and the viewport from 320 px.
    - `packages` in `pnpm-workspace.yaml`, a root `storybook` script that delegates, the folder inside `types:check` and `lint`, and the exception for `*.stories.tsx` (Storybook needs `export default`) in `AGENTS.md` Conventions. Decide whether CI also builds Storybook or `types:check` and `lint` are enough. Check that React resolves to a single copy (`resolve.dedupe`) and whether pnpm 12 asks to allow install scripts or agent skills for the new packages.
2. Write the stories: the foundations first (tokens, accents, category palette, spacing, type, motion, the icon set), then the 12 shared components (`Button` as a matrix of variants and states, `ButtonLink` under a minimal router), then the pieces of the features, seeding their data with the fakes of `src/lib/test` where they can be used. Only a pure move with no visual change is done here; the near duplicates go to 17: `ChoiceGroup` and `StylePicker`, the option of `ChoiceGroup` and `Button`, the four `__actions` rows (two of them use `--size-2` between wrapped rows, `DESIGN.md` says `--size-4`), the two raw `<details>` and the update bar, which is a full-width bar with no notch and has no entry in `DESIGN.md`.

## 17. Revisar junto al owner los componentes, a11y y diseño (depende del 16)

El owner pedirá cambios en diferentes componentes llegado el momento, ir de la mano paso a paso.

## 18. Move the production deploy from GitHub Actions to Cloudflare Workers Builds

Revisar pros y contras antes de nada.

The owner wants the deploy centralized in Cloudflare. The repo is already connected there with builds disabled (_Disable builds_), so GitHub Actions keeps deploying until this is done. Never leave both on: Cloudflare would publish the code before the migrations are applied ([ADR-0002](docs/adr/0002-solo-project-deployed-from-main.md)).

The owner, in the Cloudflare dashboard:

1. Add **Account → D1 → Edit** to the Workers Builds token; by default it has no D1 permission and the remote migrations would fail.
2. Build command `pnpm run build`. No tests there, like the owner's Vercel projects: they stay in the `check` job of GitHub Actions and in the husky hook, so a push with failing tests is still deployed.
3. Deploy command `pnpm db:migrate:remote && npx wrangler deploy`: the migrations go first and a failed one stops the deploy. `d1 migrations apply` does nothing when none is pending, so the "did `db/migrations` change" logic goes away.
4. Enable builds again once the repo side below is in `main`.

The repo side:

- Write the ADR that supersedes [ADR-0002](docs/adr/0002-solo-project-deployed-from-main.md), update `docs/specs/repository-structure.md` and `docs/specs/testing-and-ci.md`, then `AGENTS.md` (Commands and the secrets line): Cloudflare deploys, GitHub Actions only checks.
- Remove the `release` job from `.github/workflows/ci.yml`.
- Add a `.nvmrc` with `26` (today the Node version is pinned only in `ci.yml`), or set `NODE_VERSION` in Cloudflare; check that Workers Builds accepts it.
- Drop `deploy:prod` from `package.json` if nothing uses it, and delete the repository secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` after the first Cloudflare deploy works.

## Far future (an idea to keep in mind, not planned)

A Splitwise-like function: expenses shared between people, who paid, who owes whom and settling up. It is out of scope today ([ADR-0001](docs/adr/0001-scope-of-the-app.md)) and would change the model: every row belongs to one user, so it needs groups, invitations between Google accounts, access rules on the server, balances, and a way to relate it to "your part" of an expense and to the offline sync. Nothing to do now.
