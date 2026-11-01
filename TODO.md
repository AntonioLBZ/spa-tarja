# TODO

Items build on each other in the order they appear below. Delete an item when it is done and its docs are updated; the numbers stay.

## Needs the owner

- Check the layout on a real iOS Safari: safe areas, keyboard, install, the Undo toast, that the JSON and the CSV files download from the installed app, the Dot Matrix logo in the header and the slide between screens (a browser without view transitions, like iOS Safari before 18, just switches). Android Chrome, the installed app and the web, was seen by the owner and is right. The colors wait for a review with the owner, and so do the Dot Matrix logo and whether categories keep a color of their own ([DESIGN.md §8](design-system/DESIGN.md#8-open-questions)).
- Retire the notice that the app moved once nobody opens the old address: `AppMoved` (`features/pwa`), `src/lib/address.ts` and its strings in the locales go, and `"workers_dev"` in `wrangler.jsonc` turns to `false` so the old address stops answering. `Dialog` stays.
- Locales beyond `en` and `es` (the owner's `spa-anicalendar` also ships `fr` and `de`) come among the last things, not now.

## 17. Revisar junto al owner los componentes, a11y y diseño

El owner pedirá cambios en diferentes componentes llegado el momento, ir de la mano paso a paso.

Los componentes que sean el "mismo" pero diferente, reusar el mismo pero con diferentes size o variants.

The design system is in Storybook now (`pnpm storybook`, [ADR-0011](docs/adr/0011-design-system-in-storybook.md)): the stories and their accessibility panel are where to start. What is left of this item, with the owner. Done on 2026-11-01: the update toast, the swatch pickers, the rings of `ChoiceGroup`, `Select` and `Dialog`, the ghost buttons, the hints and the categories screen on sheets.

- **The same component, another variant.** Not answered yet: the row of actions copied in `category-row`, `expense-row`, `expense-form` and `dialog` (a component or leave it), and the titles and hints repeated in eight CSS files (`:where(h1)` and `:where(h2)` in `base.css`, or leave them).
- **`:focus-visible` of the rest.** The ring of `ChoiceGroup`, `Select` and the `Dialog` is done. What is left is the global one, on buttons, links and fields: with the gray accent it sits next to the ink edge and may be hard to tell apart, which only the owner's eye can say. A throwaway story that forces the focus on each component, to look at every accent in light and dark, would settle it.

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
