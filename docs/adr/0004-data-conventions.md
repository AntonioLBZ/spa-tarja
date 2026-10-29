# ADR-0004: Data conventions: hand-written SQL, text dates and money in cents

- Status: Accepted
- Date: 2026-10-25

## Context

The schema is small and `wrangler` already is the migration tool. Amounts are added, split and compared throughout the app.

## Decision

- Hand-written SQL migrations in `db/migrations`, applied with `wrangler d1 migrations`. No ORM. Queries are typed next to the code that runs them and tested in `workerd` against a real D1.
- Migrations reach production before the new code goes live, so the new code never meets an old schema. Each migration must therefore work with the code still running: add, never rename or drop.
- `date` is the day the user picked, as `YYYY-MM-DD` text, so there is no time zone to get wrong. Timestamps are epoch milliseconds.
- An amount is an integer in cents plus a currency code, never a `float`. There is a single currency for now (`EUR`, `DEFAULT_CURRENCY` in `core/`), and the code is stored on each row.

## Consequences

- A rename takes a release that adds the new column, one that moves the code over, and a later one that drops the old column.
- A column added later gets a default that means what older clients always meant: `payment` is `direct`, `personal_cents` is NULL. See [data model](../specs/data-model.md).
- A failed migration stops the deploy ([ADR-0002](0002-solo-project-deployed-from-main.md)).
- Adding currencies later needs no migration, but multiple currencies are out of scope for now ([ADR-0001](0001-scope-of-the-app.md)).
- Splitting an amount, as installments do, is done in cents, the remainder going to the first parts.
