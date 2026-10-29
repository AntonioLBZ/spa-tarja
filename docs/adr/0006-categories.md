# ADR-0006: Read-only default categories, and no expense refused for its category

- Status: Accepted
- Date: 2026-10-25

## Context

Every expense has a category. The person can make their own, and can delete one on a device while another still holds expenses filed under it, or create one while a device is offline.

## Decision

- The default categories (food, groceries, leisure, bills, housing, transport, health, other) can't be edited or deleted for now. They live in `core/` with stable ids, and their names come from the locale files, not from the database.
- Custom categories can be created, edited and deleted. They live in D1, so `expenses.category_id` has no foreign key to the defaults.
- An expense is never refused for its category. The server checks only the shape of `category_id` (a default id or a UUID), never that the row exists.
- The category is suggested on the client from the text the person types, and they can change it. A category picked by hand is never replaced by a suggestion.

## Consequences

- An expense whose category no longer exists shows as "Other", with its color and icon, and keeps its id.
- Managing custom categories needs a connection ([ADR-0005](0005-offline-first-with-an-outbox.md)).
- The rules for names, colors, icons and the suggestion are in [categories](../specs/categories.md).
