# Plan: invite a friend with no dummy behind (milestone 26b)

The owner (2026-11-06): inviting a friend must not need a fake friend first; a temporary invitation is made directly.
Specs: `invitations.md`, `groups.md`, `data-model.md`, `offline-sync.md`, `authentication.md`, ADR-0012, ADR-0014.
Choices where the request is open, written into the specs in task 1:

- **A direct invitation** is a row of `friend_invitations` with no `member_id`. Its `group_id` is null while it is open
  and becomes the friend it made once accepted, so an accept sent again answers that friend even if the inviter has
  deleted their account since. A `CHECK`: an invitation of a dummy has both, a direct one has no member and a group
  exactly when it was accepted. Same token, same join page, same `read`, `accept` and `decline` routes.
- **Routes of the person's own links**: `GET /invitations` lists the open ones (newest first, with their token, so they
  can be copied again); `POST /invitations` makes one (no body); `DELETE /invitations/:invitationId` revokes one and
  answers the list. An id that isn't one of the caller's direct invitations is `404 not-found`, the same as a missing
  one. Only open links are listed: a declined, used, revoked or expired one leaves the list.
- **Limits**: at most `MAX_OPEN_INVITATIONS` (20) open direct invitations per person, counted in the statement that adds
  one (`409 too-many-invitations`); making one also needs room for a friend (`409 too-many-friends`,
  `409 too-many-closed-groups`, as making a friend by name). Accepting one checks the accepter (`too-many-friends`,
  `too-many-closed-groups`) and the inviter (`409 inviter-at-limit`, one code for both limits of the inviter, so it says
  no more than that they can't take a friend now), counted just before, as every limit of groups.
- **Accepting** is one batch: mark the invitation taken (only while it is open, the caller isn't the inviter and the two
  aren't friends, all read in that statement), then the group (`direct`, the app's currency, made by the inviter) and its
  two members, the inviter as owner and the accepter, each insert guarded by the mark of this very request (the new group
  id). The ids of the group and its members are made by the server: making a friend needs a connection anyway.
- **On the Groups tab**: a primary `block` button "Invite a friend" with a hint under it, between New group and "Add a
  friend by name" (renamed), and under them a `Sheet` "Invitation links" with each open link: the field, the day it ends,
  Share or Copy, and Revoke (the same piece as in Edit friend, extracted). The new link takes the focus; once one is
  revoked the focus goes back to Invite a friend.

## Tasks

1. **Docs.** ADR-0014 (amended in place, it is `Proposed`), `invitations.md`, `groups.md`, `data-model.md`,
   `offline-sync.md`, `authentication.md`, `testing-and-ci.md` if it names the flows, `AGENTS.md`. Commit
   `docs: describe invitations to be friends with no dummy behind`.
2. **Migration `0013`.** `db/migrations/0013_direct_invitations.sql` rebuilds `friend_invitations` (new table, rows copied
   with their `rowid`, old dropped, renamed, every index back, the new `CHECK`); `vitest.config.ts` gets a second D1 for
   the test of the migration. Tests first in `server/db/invitations.test.ts`: a direct row is taken; a row with only one
   of `group_id`, `member_id` is refused; a direct row with a group but not accepted is refused; on a database at `0012`
   with rows, `0013` keeps every row, its `rowid` order and its constraints. Commit
   `feat: let an invitation to be friends have no dummy behind it`.
3. **Make, list and revoke on the server.** `core/shared-group.ts` (`MAX_OPEN_INVITATIONS`), `core/invitation.ts`
   (`PendingInvitation`, `invitationIdSchema`), `server/db/invitations.ts` (`createDirectInvitation(db, by, at):
Promise<{ id; expiresAt } | null>`, `listPendingInvitations(db, userId, at): Promise<{ id; expiresAt }[]>`,
   `revokeDirectInvitation(db, userId, id, at): Promise<boolean>`), `server/routes/invitations.ts`. Tests first in
   `server/routes/invitations.test.ts`: make answers a link of the right shape for 14 days; listed with the token; the cap
   (21st refused, revoking or expiry frees a slot); the friend limits on make; another user's id revokes nothing and
   answers the same `404` as a missing one, byte for byte; list shows only the caller's own open ones; `no-store`, the
   framing headers and `X-Tarja-User` on the three; `401` signed out. Commit
   `feat: make, list and revoke a link to be friends on the server`.
4. **Read, accept and decline a direct link.** `core/invitation.ts` (`InvitationView.forDummy`),
   `server/db/invitations.ts` (`acceptDirectInvitation(db, id, taker, inviter): Promise<string | null>`, `READ` and
   `DECLINE` for both kinds), `server/routes/invitations.ts`. Tests first: read shows the inviter's nickname or name and
   `forDummy: false`; accepting makes one open friend with two real members, the inviter owner, in the app's currency,
   for both people; sent again answers it; `410` byte for byte when revoked, expired, used, declined, forged, or the
   inviter deleted their account; `409 yourself`; `already-friends` (also through a claimed dummy, and two links of one
   inviter at once make one friend); `too-many-friends`, `too-many-closed-groups`, `inviter-at-limit`; two people
   accepting at once: one wins and no second group exists; deleting the account revokes the open ones. Commit
   `feat: become friends through a link with no dummy behind`.
5. **The device: API, fake and actions.** `src/lib/api/invitations.ts` (`PENDING_INVITATIONS_KEY`,
   `fetchPendingInvitations`, `postInvitation`, `deleteInvitation`), `queries.ts` (`pendingInvitationsQuery`),
   `fake-groups.ts` (`pending`, `forDummy` on a link), `use-group-actions.ts` (`inviteFriend`, `revokeLink`),
   `group-failure.ts` (`tooManyInvitations`). Tests first in `src/lib/api/invitations.test.ts` and the persister test (the
   list is never persisted). Commit `feat: reach the links to be friends from the device`.
6. **The Groups tab.** `invitation-link.tsx` (the field, Share or Copy, Revoke; `FriendInvite` uses it),
   `invite-friend.tsx`, `groups.tsx`, `add-friend.tsx`, `en.json`/`es.json`. Tests first in `invite-friend.test.tsx`:
   make shows the link with the focus on it and its day; listed links on open; copy and share; revoke, focus back;
   offline off with the notice and nothing sent; the cap said in words; the empty state and the two buttons say the
   difference. `friend-invite.test.tsx` stays green. Commit `feat: invite a friend from the Groups tab with a link`.
7. **The join page for both kinds.** `join-screen.tsx`, the locales. Tests first in `join-screen.test.tsx`: a direct
   link says you become friends, a dummy's says you take over what was shared; `inviter-at-limit` and
   `too-many-closed-groups` said in words; accepting opens the friend. This plan deleted, gaps added to item 31 of
   `TODO.md`, every doc in sync. Commit `feat: say on the join page what accepting a link does`.

## Review Focus

- **Authorization**: listing and revoking touch only `created_by = caller AND member_id IS NULL`; another user's id, a
  dummy's invitation id and a missing id answer the same `404` body. `read`, `accept`, `decline` of a direct link answer
  the generic `410` for every dead state, byte for byte, and `409 yourself` only to the inviter.
- **The accept batch**: the mark, the group and the two members all hinge on the mark of this request (the new group id),
  so a lost race inserts nothing; the already-friends check sits in the marking statement. The limits are counted just
  before, as everywhere, so accepts at the same instant can pass them by a few.
- **The migration**: `rowid` is copied, since the latest invitation of a friend is read by it; every index and `CHECK`
  of `0012` is back; foreign keys still point at the right tables after the rename.
- **The token never in a URL**: the `DELETE` path holds the invitation id, which opens nothing without the signature.
  `no-store` on every answer of `/invitations`, the list included.
- **Account deletion**: the open direct ones are revoked by `created_by` in the same batch; an accepted one keeps its
  group.
- **Not covered by tests**: make and revoke in a loop add a row per request (as the link of a dummy does today); a
  person with a dummy friend who accepts that inviter's direct link becomes a second friend (the hint says to use the
  dummy's link); the list on the Groups tab is refreshed only when the tab reads it again.
- **The screen** at 320 px with a long link and Spanish copy, labels with their visible words, 44 px targets, several
  links with the same labels.
