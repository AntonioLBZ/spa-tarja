# Plan: friends by invitation (TODO item 26)

Specs: `invitations.md`, `groups.md`, `authentication.md`, `data-model.md`, ADR-0014. Choices where the specs are open or
change, written into `invitations.md` in the task that needs them:

- The link is `/join/<id>.<signature>`: `id` is the key of the row (a UUID made by the server) and the signature an
  HMAC-SHA256 of it under `BETTER_AUTH_SECRET`, which is never stored, so the table alone (a leak, a backup) opens no
  link, and the open link can still be listed again for Copy. The token is checked by its shape, then by the signature.
- The token travels in a JSON body (`POST /invitations/read|accept|decline` with `{ token }`), never in an API URL,
  since the Worker's request logs keep URLs. The page itself is a static asset, which the Worker never sees, and the
  app sends only its origin as the referrer (`<meta name="referrer" content="strict-origin">`).
- The inviter side lives under the friend: `GET`, `POST` and `DELETE /groups/:groupId/invitations`, each answering
  `{ invitation }` (the open one with its token and `expiresAt`, `{ state: 'declined' }`, or null), so authorization is
  the membership check every group route has (`404` to a non-member).
- Accepting claims the dummy row itself (`user_id`, `claimed_at`, the name), as `invitations.md` says: its id stays, so
  every entry and balance is kept and nothing is rewritten; `merged_into` is for merging, not this.
- Only who accepted is stored (`accepted_by`), not who declined or revoked: nothing reads them.
- The invite section makes the link first and then offers Share (where `navigator.share` exists) or Copy, with the link
  shown in a read-only field: a copy or a share after the network answer can be refused for lack of a user gesture.
- Add a friend keeps opening the new friend (groups.md); the invitation is in Edit friend.

## Tasks

1. **Table and token.** `db/migrations/0012_friend_invitations.sql`; `core/invitation.ts` (`INVITATION_DAYS = 14`,
   `isInvitationToken(token: string): boolean`, `invitationTokenSchema`, `type FriendInvitation`, `interface
InvitationView { name: string }`); `server/invitation-token.ts` (`signInvitation(secret, id): Promise<string>`,
   `readInvitationToken(secret, token): Promise<string | null>`); `server/test/apply-migrations.ts` empties the table;
   `data-model.md`. Tests: `core/invitation.test.ts` (shape), `server/invitation-token.test.ts` (round trip, another
   secret, a changed id or signature, a bad shape), `server/db/invitations.test.ts` (the migration: one open invitation
   per friend, one ending at most, `expires_at` after `created_at`).
2. **The inviter's routes.** `server/db/invitations.ts` (`createInvitation`, `revokeInvitations`, `latestInvitation`),
   `server/routes/invitations.ts` (`friendInvitationsRoutes` under `/groups`), `server/app.ts`. Tests
   (`server/routes/invitations.test.ts`): a stranger gets `404` on all three; a group is `409 not-a-friend`; a claimed
   friend `409 not-placeholder`; a closed friend `409 closed` (and null to read); 14 days; making another revokes the
   first; the token listed again is the same; revoke; the row holds no signature.
3. **The invited person's routes.** `readInvitation`, `acceptInvitation`, `declineInvitation` in the db module,
   `invitationsRoutes` under `/invitations` (with `withUser`). Tests: no session `401`; read answers only `{ name }`
   (nickname, else account name, never the email); unknown, forged, malformed, expired (fake clock), revoked, used,
   declined and deleted-friend tokens all answer the same `410 gone`; `409 yourself` on read, accept and decline;
   accept claims the dummy (same member id, entries and balances kept, the person's own name), answers the friend,
   and is idempotent for the same person; two people at once: one wins, the other `410`; two links of one inviter at
   once: one friend, the other `409 already-friends`; `409 too-many-friends`; decline then `410`, and the inviter
   reads `declined`.
4. **Client and sign-in.** `src/lib/api/invitations.ts` (`fetchFriendInvitation`, `postFriendInvitation`,
   `deleteFriendInvitation`, `readInvitation`, `acceptInvitation`, `declineInvitation`, `friendInvitationQuery`,
   `invitationQuery`), fake routes in `src/lib/test/fake-groups.ts` and `fake-api.ts`;
   `src/lib/auth/return-path.ts` (`returnPath(pathname): string`), used by `startSignIn` as the `callbackURL`; the
   sign-in screen says what a link is for. Tests: `return-path.test.ts` (`/join/<token>` kept; `/join//evil.com`,
   `/join/%2F…`, other paths, a token of the wrong shape all `/`), `service.test.ts`, `auth-gate.test.tsx`.
5. **The join page.** `src/routes/join.$token.tsx`, `src/features/groups/join-screen.tsx` (+ css), depth 1 under
   Groups in `route-transition.ts`, the actions in `use-group-actions.ts`, the referrer meta in `index.html`, the copy.
   Tests (`join-screen.test.tsx`): signed out shows the sign-in with its hint and comes back signed in; the name and
   Accept, which opens the friend and lists it; Decline; gone; yourself; already friends; too many friends; a failure
   with Try again; offline says a connection is needed and sends nothing, and loads once back.
6. **The invite section.** `src/features/groups/friend-invite.tsx` (+ css) in `group-settings.tsx`. Tests: only for
   an open friend whose other side is a dummy; make, the link and its day, Copy (clipboard) or Share; the open one
   listed on load; Revoke; Declined with Make another; offline off.
7. **Docs and close.** `invitations.md`, `authentication.md`, `groups.md`, `offline-sync.md`, `AGENTS.md`, the rate
   limit decision in `invitations.md`, `TODO.md` (item 26 out, header sentence), this plan deleted.

## Review Focus

- **Token**: never in an API URL, never logged, never stored; the signature checked with `crypto.subtle.verify`
  (constant time) over a domain-separated message; the shape checked before any query; rotating the secret voids the
  links (and the sessions), which is fine.
- **Generic refusal**: unknown, forged, expired, revoked, used, declined, a closed friend, a claimed or gone dummy and a
  deleted inviter all answer the same `410 gone`, and only after that `409 yourself`; nothing in a `410` or a `409`
  names the inviter or the group.
- **Authorization (IDOR)**: the inviter's routes go through `readGroup` (membership), so nobody reads, makes or
  revokes an invitation of a friend they aren't in; an invitation only for a `direct` group and its unclaimed dummy;
  accept rechecks all of it inside the statement that marks it, not only before.
- **Races**: one link serves one person (conditional `UPDATE` in the batch that claims); two links of one inviter
  accepted at once make one friend; a revoke or a delete of the friend at the same moment wins or loses cleanly.
- **Redirect**: `callbackURL` is the current path only when it is exactly `/join/<token of the right shape>`, else `/`;
  nothing from outside the app is ever sent.
- **Privacy**: the read answers only the name; the email of neither person is ever answered; the person who declines is
  not stored.
- Not exercised by tests: the real Google round trip, `navigator.share` and the clipboard on a real phone, the referrer
  of a real browser, the Cloudflare request logs.
