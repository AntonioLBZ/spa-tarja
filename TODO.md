# TODO

Items build on each other in the order they appear below. Delete an item when it is done and its docs are updated; the numbers stay.

## 17. Revisar junto al owner los componentes, a11y y diseño

El owner pedirá cambios en diferentes componentes llegado el momento, ir de la mano paso a paso.

Los componentes que sean el "mismo" pero diferente, reusar el mismo pero con diferentes size o variants.

The design system is in Storybook now (`pnpm storybook`, [ADR-0011](docs/adr/0011-design-system-in-storybook.md)): the stories and their accessibility panel are where to start. What is left of this item, with the owner. Done on 2026-11-01: the update toast, the swatch pickers, the rings of `ChoiceGroup`, `Select` and `Dialog`, the ghost buttons, the hints and the categories screen on sheets.

- **Stories of the groups.** None yet for Settle up, the Leave and Delete panels, the steps of a person, `InvitationLink` or `InviteFriend`; the ledger row has one (`Features/LedgerRow`).
- **`:focus-visible` of the rest.** The ring of `ChoiceGroup`, `Select` and the `Dialog` is done. What is left is the global one, on buttons, links and fields: with the gray accent it sits next to the ink edge and may be hard to tell apart, which only the owner's eye can say. A throwaway story that forces the focus on each component, to look at every accent in light and dark, would settle it.

## 18. More locales

Locales beyond `en` and `es` (the owner's `spa-anicalendar` also ships `fr` and `de`) come among the last things, not now.
