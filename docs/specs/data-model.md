# Data model

Hand-written SQL migrations in `db/migrations`, applied with `wrangler d1 migrations`; no ORM. The schema is small and `wrangler` already is the migration tool. Queries are typed next to the code that runs them and tested in `workerd` against a real D1.

- Amount as an integer in cents plus a currency code, never a `float`. There is a single currency for now (`EUR`, `DEFAULT_CURRENCY` in `core/`); the code is stored on each row so adding more later needs no migration.
- `id` is a UUID created on the client ([offline sync](offline-sync.md)) and is the primary key. `PUT /expenses/:id` creates the row or updates it, but only when it belongs to the caller: an existing id owned by another user is rejected, never overwritten.
- Columns: `user_id`, `category_id`, `text`, `amount_cents`, `currency`, `date`, `created_at`, `updated_at`, `deleted_at` and `seq`.
- `date` is the day the user picked, as `YYYY-MM-DD` text (no time zone to get wrong). `created_at`, `updated_at` and `deleted_at` are epoch milliseconds.
- `updated_at` is the client clock and only decides conflicts ([offline sync](offline-sync.md)). It can't be the sync cursor: an edit made offline last week arrives with an old `updated_at`, and a device whose cursor is already past it would never pull it. The cursor is `seq`, a per-user counter the server bumps on every write (`MAX(seq) + 1` inside the upsert, which D1 serializes).
- Indexes: `(user_id, date)` for listing and `(user_id, seq)` for the sync by delta. Soft deletes travel as rows with `deleted_at` set, so the delta query sees them.
- `categories` holds the custom categories ([categories](categories.md)), in migration `0002`; migration `0004` adds their `color` and `icon`.
- Rows belong to the signed-in user ([authentication](authentication.md)), resolved in a single place in the server.

## Shared expenses

All additive: nothing in the tables above changes ([ADR-0004](../adr/0004-data-conventions.md)). The rules are in [groups](groups.md), [shared expenses](shared-expenses.md) and [invitations](invitations.md). Names are prefixed with `shared_` because `groups` is a keyword of SQLite.

- `profile` (migration `0010`): `user_id` (the key, references `user`), `username` (lowercase) and `updated_at`; unique on `username`. A row exists only while a username is set.
- `shared_groups` (migration `0011`): `id` (UUID made on the client), `kind` (`group` or `direct`), `name` (null for `direct`), `currency`, `simplify_debts` (0 or 1), `created_by`, `created_at`, `updated_at`, `deleted_at`.
- `shared_members`: `id` (UUID made on the client, what entries refer to), `group_id`, `user_id` (null for a placeholder), `name`, `role` (`owner` or `member`), `created_by`, `created_at`, `claimed_at`, `left_at`. Indexes: `(group_id)`, `(user_id)` for the groups of a user, and a unique `(group_id, user_id)` where `user_id` is not null.
- `shared_entries`: `id` (UUID made on the client), `group_id`, `kind` (`expense` or `settlement`), `text`, `category_id` (null for a settlement), `amount_cents` (greater than 0), `currency`, `date`, `paid_by` (a member id), `split` (`equal`, `percent` or `exact`), `shares` (JSON, `[{ "memberId", "cents" }]`), `created_by` and `updated_by` (user ids, set by the server), `created_at`, `updated_at`, `deleted_at` and `seq`. `seq` is a counter per group, taken as `MAX(seq) + 1` for the group inside the upsert; unique `(group_id, seq)`. Money is cents as everywhere; the shares are the stored truth and no percentage is stored.
- `shared_invitations`: `token` (the key), `group_id`, `member_id`, `target_user_id`, `created_by`, `created_at`, `expires_at`, `accepted_by`, `accepted_at`, `declined_at`, `revoked_at`. Indexes: `(group_id)` and `(target_user_id)`.
- Access is always through the caller's member row: a user touches the rows of a group only while they have a member row there with `left_at` null. A user's own rows (`expenses`, `categories`, `income`, `budget`) are untouched.
