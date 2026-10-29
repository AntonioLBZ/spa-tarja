# ADR-0001: Scope: what is left out, and export only

- Status: Accepted
- Date: 2026-10-25

## Context

What the app is, an installable web app to log everyday expenses that works offline, is in the README. This records where it stops.

## Decision

- Out of scope for now: importing a backup, shared expenses and multiple currencies.
- Export only: Settings offers a backup (JSON) and a spreadsheet (CSV), and no import. Both are built on the device from what it already holds, the persisted cache with the outbox on top, so they work offline and send nothing to the server. The backup holds what is stored and nothing derived, so a later import can restore a database from it.
- No PWA shortcuts on the installed icon (owner, 2026-10-29): the icon already opens on the add form.

## Consequences

- Shared expenses, a Splitwise-like function, is an idea kept in `TODO.md`, not a plan: every row belongs to one user, so it would change the model.
- One currency: [ADR-0004](0004-data-conventions.md).
- The backup keeps `version: 1`, as nothing reads a backup yet. The formats and the guard against a spreadsheet running a text as a formula are in [exporting your data](../specs/export.md).

## Alternatives considered

Cuadra, Menudo, Tally, Slate and Tab as a name: taken on `.app`, `.dev` and `.com`.
