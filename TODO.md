# TODO

Items build on each other in the order they appear below. Delete an item when it is done and its docs are updated; the numbers stay.

## Needs the owner

- **Before the merge, in the dashboards and on production:**
    1. What one Workers Logs entry holds (the `cookie` header, the IP, `x-tarja-user`, the location): open one of `PUT /api/expenses/<id>` and one of `GET /api/auth/callback/google`. If the cookie shows, turn the invocation logs off (`"observability": { "enabled": true, "logs": { "invocation_logs": false } }`).
    2. An account deletion from start to end in production with a second Google account: make a group with a dummy, add that account as a friend in the dummy's place, delete it, then look for its email and the old dummy name in `user`, `session`, `account`, `profile`, `expenses` and `shared_members`.
    3. The Google consent screen (Google Cloud console): publishing status, app name and support email.
- On a real phone, in production, the notifications ([notifications](docs/specs/notifications.md)): a push with Tarja closed (Android Chrome, and iOS with the app on the Home Screen), a tap on it opening the group, the banner with the app open and its swipe, and the switch of the settings turned off and on again. And in Workers Logs, that the outgoing requests to the push services don't log their address.
- Locales beyond `en` and `es` (the owner's `spa-anicalendar` also ships `fr` and `de`) come among the last things, not now.

## 17. Revisar junto al owner los componentes, a11y y diseño

El owner pedirá cambios en diferentes componentes llegado el momento, ir de la mano paso a paso.

Los componentes que sean el "mismo" pero diferente, reusar el mismo pero con diferentes size o variants.

The design system is in Storybook now (`pnpm storybook`, [ADR-0011](docs/adr/0011-design-system-in-storybook.md)): the stories and their accessibility panel are where to start. What is left of this item, with the owner. Done on 2026-11-01: the update toast, the swatch pickers, the rings of `ChoiceGroup`, `Select` and `Dialog`, the ghost buttons, the hints and the categories screen on sheets.

- **Stories of the groups.** None yet for Settle up, the Leave and Delete panels, the steps of a person, `InvitationLink` or `InviteFriend`; the ledger row has one (`Features/LedgerRow`).
- **`:focus-visible` of the rest.** The ring of `ChoiceGroup`, `Select` and the `Dialog` is done. What is left is the global one, on buttons, links and fields: with the gray accent it sits next to the ink edge and may be hard to tell apart, which only the owner's eye can say. A throwaway story that forces the focus on each component, to look at every accent in light and dark, would settle it.
