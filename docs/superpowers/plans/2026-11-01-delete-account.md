# Plan: delete the account (TODO item 29)

Specs: `authentication.md`, `settings.md`, `groups.md`, `invitations.md`, `data-model.md`, `offline-sync.md`, ADR-0008,
ADR-0012, ADR-0014. Choices where the specs are open, written into the spec in the task that needs them:

- **"The user is gone" is one check, in `withUser`.** After the session, one read of the `user` row by its key; without it
  the answer is `401`. The cookie cache of a session (up to 5 minutes) no longer lets a deleted user through any route,
  so `readProfile`, `PUT /profile`, making a group, adding a friend and the invitation routes never meet a missing
  caller. A revoked session still lasts up to 5 minutes, as today. The device asks `get-session` with the cookie cache
  off, so a `401` signs it out at once instead of after the cache expires.
- **No balance blocks the deletion** (the spec keeps the entries and lets the others settle). No migration: the indexes
  on every user column of the shared tables are in `0011` and `0012` already.
- **One batch, in this order:** revoke the open invitations they made; close every open group they are in (and haven't
  left) where no other member is a user who hasn't left (a friend whose other side is a dummy or a deleted user, a group
  of their own with nobody else); demote them where they are the owner; make owner, in every group they are in that has
  no owner then, the member who is a user, hasn't left and joined first (`claimed_at`, then id); blank the name of their
  members; delete their expenses, categories, income, budgets and profile; delete the `user` row (sessions and accounts
  cascade, every other user column is set to null by its foreign key). A group closed with no user left has no owner.
- **The confirmation** is `{ email }`, compared trimmed and without case by `confirmsEmail` (`core/account.ts`), the same
  check the dialog uses; another email is `422 wrong-email`. Success is `204` with the cookies expired by Better Auth's
  own sign-out, so the browser forgets them.
- **On the device:** the dialog follows `settings.md` (the email typed to confirm, the focus on the dialog). On success it
  deletes both outboxes and the cache (`discard`) and the saved shared-with, then `auth.forget({ cleared })` signs out
  on the device alone; the sign-in screen says the account was deleted, or that this device couldn't delete its copy.
  There is no invitation state on the device to clear (the link lives in the address only).

## Tasks

1. **A deleted user gets 401.** `server/user.ts` (`withUser` reads the user), `server/test/session.ts`
   (`cachedSession(session): Promise<TestSession>`, the cookie with the session cache), `authentication.md`. Tests first
   in `server/auth.test.ts`: with the cache cookie and the `user` row deleted, `GET`/`PUT /profile`, `PUT /groups/:id`,
   adding a friend, `/invitations/read` and `/accept`, and the reads of every protected route answer `401`; the cache
   cookie of a user who exists still works. Commit `fix: answer 401 to a deleted user whose session is cached`.
2. **`DELETE /api/account`, the user's own data.** `core/account.ts` (`accountDeletionSchema`, `confirmsEmail(typed,
email): boolean`), `server/db/account.ts` (`deleteAccount(db, userId, at): Promise<void>`), `server/routes/account.ts`,
   `server/app.ts`, `authentication.md`. Tests first in `core/account.test.ts` and `server/routes/account.test.ts`:
   expenses, categories, income, budgets, profile, sessions on two devices and accounts go; the cookies are expired; both
   cookies (with and without cache) answer `401` after; a second delete is `401`; a visitor is `401`, another user's
   cookie or a wrong email (`422`) deletes nothing; another user's rows are untouched; a failure in the last statement
   (a trigger) leaves everything as it was. Commit `feat: delete an account and its own data on the server`.
3. **The groups of a deleted account.** `server/db/account.ts`, `groups.md`, `data-model.md`, `invitations.md`. Tests
   first in `server/routes/account.test.ts`: the others read their ledgers with the member blank ("Deleted user"),
   `createdBy`/`updatedBy` null, balances unchanged; a group they owned goes to the user who joined first (not one who
   left), and one with nobody else closes; a friend with a dummy or a deleted user closes, a friend with a user stays
   open and that user owns it; no member keeps `owner` without a user; their open invitations are revoked and an
   invitation they accepted loses `accepted_by`; every user column of the shared tables is null for them. Commit
   `feat: hand over or close the groups of a deleted account`.
4. **The device side.** `src/lib/api/account.ts` (`deleteAccount(email): Promise<void>`), `fake-api.ts` (`DELETE
/api/account`, `accountDeletions`, `state.accountDeleteStatus`), `src/lib/auth` (`forget(deleted: DeletedAccount)`,
   `get-session?disableCookieCache=true`), `sign-in-screen.tsx` (the notice), `en.json`/`es.json` (`auth.deleted`,
   `auth.deletedNotCleared`). Tests first in `auth.test.ts`, `service.test.ts`, `auth-gate.test.tsx`. Commit
   `feat: sign out on the device once the account is deleted`.
5. **The dialog in the settings.** `src/features/auth/delete-account.tsx` and `.css`, `account.tsx`,
   `src/features/groups/shared-with.ts` (`forgetSharedWith`), `your-data.tsx` (the heading the dialog points at),
   `en.json`/`es.json`, `settings.md`, `authentication.md`, `AGENTS.md`; this plan and item 29 of `TODO.md` deleted, with
   the header sentence. Tests first in `delete-account.test.tsx`: the button under Sign out, the dialog's copy, the focus
   on the dialog, Delete off until the email matches, Cancel, offline off with a notice and nothing sent, a failure said
   in words, success clears both outboxes, the cache and the shared-with and lands on the sign-in screen saying so, a
   device that fails to clear says it, Download your data first goes to Your data. Commit
   `feat: delete the account from the settings`.

## Review Focus

- A statement of the batch that touches another user's rows: the hand-over and the close must only reach groups the
  deleted user is in; a placeholder or a member who left never becomes owner.
- The order inside the batch: the unique owner index needs the demotion before the promotion, and the user's members are
  found by `user_id` only until the `user` row goes.
- The race between `withUser`'s read and the route (a write that lands right after the batch): accepted, not covered.
- `get-session` with the cookie cache off on every check of the device: one more D1 read on open and after a `401`.
- The dialog at 320 px with a long email, Spanish copy, labels with their visible words, 44 px targets.
- A deletion whose answer is lost: the device keeps the user signed in until the next `401` signs it out, and the local
  data is then kept as for any sign-out.
