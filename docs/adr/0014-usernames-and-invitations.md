# ADR-0014: People are found by a username, and an invitation claims a member

- Status: Proposed
- Date: 2026-11-01

## Context

Login is Google only ([ADR-0008](0008-google-login-with-better-auth.md)) and the free tiers have no way to send an email ([ADR-0003](0003-spa-on-one-worker-on-free-tiers.md)). People must be invited to groups, some have no account yet, and the owner wants to split with people who never will.

## Decision

- A user may set a **username**, unique ignoring case. Others find a user by an exact match on it, never by a prefix, and by the email of the account while no username is set, which is the default. Groups show names, never the username or the email.
- **An invitation always claims a member.** Inviting someone new first makes a placeholder in the group, and the invitation, a link or a handle, is for that member. Whoever accepts becomes the member and keeps everything already in the ledger. A placeholder can be used before anybody claims it: the dummy of the owner's request and the person who later joins are one row.
- An invitation is a link to `/join/<token>` for one person, lasts 14 days and can be revoked. One by handle also shows in the Groups screen of that user. Nobody is put in a group without accepting, and a user can decline.
- Signing in from an invitation link comes back to the link ([authentication](../specs/authentication.md)).

## Consequences

- No email is sent, so the owner sends the link themselves (a message, a chat). An invitation by handle is seen only when the person opens the app.
- Looking a handle up tells whether an account has it. That is the price of finding people; it answers a name only, to someone signed in ([invitations](../specs/invitations.md)).
- Someone who joins by a link as a new person and was also added as a placeholder is two members, and they can't be merged for now.
- The username and the invitations need a connection ([ADR-0013](0013-shared-entries-sync-through-an-outbox.md)).

## Alternatives considered

- **An invitation by email**: needs a mail service, which isn't free.
- **A link anybody can use**: it leaks the group to whoever sees it.
- **Adding a user by handle without asking**: someone would find strangers' ledgers in their app.
- **A mandatory username**: a step in sign-in for the many who only want to be added.
