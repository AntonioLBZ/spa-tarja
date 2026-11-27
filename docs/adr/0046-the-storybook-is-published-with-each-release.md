---
status: Accepted
date: 2026-11-27
refines: [ADR-0011, ADR-0040]
tags: [design, deploy]
specs: [repository-structure.md, testing-and-ci.md]
summary: 'The Storybook is public at tarja-storybook.albz.app, a Worker of static files deployed after each release of the app.'
---

# ADR-0046: The Storybook is published with each release

## Context

[ADR-0011](0011-design-system-in-storybook.md) keeps the Storybook on the owner's machine and says that if it is ever published, it goes in a Worker of its own, never in the `dist` of the app. The owner now wants it public, next to the app, so the design system can be seen from a URL without cloning the repository.

## Decision

- **A Worker of its own**, `tarja-storybook`, at `https://tarja-storybook.albz.app`, configured in `design-system/wrangler.jsonc`: the static files of `pnpm --filter design-system build` and nothing else. No code, no database, no secret, `workers_dev` off and its address as a custom-domain route.
- **Public**, with no sign-in in front. The stories draw the app's components with sample data and a fake server in the page, so nothing of a person is in it and no request leaves it.
- **Only with a release.** The job `storybook` of `ci.yml` runs `pnpm deploy:storybook` after the job `release`, under the same condition ([ADR-0040](0040-production-deploys-only-a-new-version.md)): what it shows is the design of the version in production. A branch never deploys it, and it has no prerelease.
- **A broken story never stops the app.** The job `check` still doesn't build the Storybook, and the job `tag` doesn't wait for `storybook`, so a failed build leaves the app deployed and released; the job is run again once fixed, or `pnpm deploy:storybook` by hand.
- **It looks like Tarja**, through Storybook's own theme API and nothing else: the frame, the Docs pages and their blocks take the colors of `tokens.css` and IBM Plex Mono, with square corners, and follow the Theme toolbar (light, dark, system), so a dark story never sits on a light page. The sidebar header is the name in the face of the logo, with the version of the app it was built from, and the favicon is the app's with the diagonal green (`#009e73`). No CSS against Storybook's internal classes, which an update could break.
- **Its own headers**, in `design-system/public/_headers`: framed only by its own pages (the manager shows each story in an `iframe` of the same origin), no sniffing and the origin as the referrer. Not the policy of the app's pages, which forbids the inline scripts Storybook needs.

## Consequences

- The design of a version can be seen at a URL. Unreleased work on `main` or a branch stays in `pnpm storybook`.
- Storybook's own files (its manager, its fonts, `project.json` with the versions of the packages) are public too.
- The first deploy creates the Worker and its domain, with the same API token as the app.

## Alternatives considered

- **Behind Cloudflare Access**, turned down by the owner: the stories hold nothing private.
- **On every push to `main`**, turned down: the Storybook would show design that the app doesn't have yet.
- **Under a path of the app** (`tarja.albz.app/storybook`), ruled out by [ADR-0011](0011-design-system-in-storybook.md): the service worker of the app would precache it and the policy of the pages would block it.
