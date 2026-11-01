# ADR-0014: People: usernames, invitations, merging a dummy and deleting an account

- Status: Proposed
- Date: 2026-11-01

## Context

Login is Google only ([ADR-0008](0008-google-login-with-better-auth.md)) and the free tiers have no way to send an email ([ADR-0003](0003-spa-on-one-worker-on-free-tiers.md)). People must be invited to groups, some have no account yet, and the owner wants to split with people who never will. The app will also hold the names of people who are not its user, and anybody with a Google account can sign in, so a person must be able to leave and take their data with them.

## Decision

- A user may set a **username**, unique ignoring case. Others find a user by an exact match on it, never by a prefix, and by the email of the account while no username is set, which is the default. Groups show names, never the username or the email.
- An **invitation** is a link to `/join/<token>` for one person, lasts 14 days and can be revoked. It can be for nobody in particular, and whoever accepts becomes a new member, or for a placeholder, and whoever accepts takes its place and keeps everything already in the ledger. One made for a handle also shows in the Groups screen of that user. Nobody is put in a group without accepting, and a user can decline.
- A placeholder (the dummy) can be used before anybody claims it. It can also be **merged into a real member of the same group**, and only that: the placeholder is marked as merged and its id means the target from then on, in the balances and the ledger. No entry is rewritten, so the sync and the offline writes are not affected. A merge can't be undone.
- Signing in from an invitation link comes back to the link ([authentication](../specs/authentication.md)).
- A person can **delete their account**. Their own data goes: expenses, categories, income, budgets, username, sessions. In the groups they were in, their member becomes "Deleted user" and the entries stay, since they are also the record of the others; the debts they leave can still be settled or removed by the rest. A group they owned passes to the member who is a user and joined first, or closes if there is none.

## Consequences

- No email is sent, so the owner sends the link themselves (a message, a chat). An invitation by handle is seen only when the person opens the app.
- Looking a handle up tells whether an account has it. That is the price of finding people; it answers a name only, to someone signed in ([invitations](../specs/invitations.md)).
- Someone who joins by a general link as a new person and was also added as a placeholder is two members, until the owner merges them.
- Deleting an account is irreversible and needs a connection. The backups D1 keeps on its own expire by themselves. Personal data of others stays in the ledgers of the groups, under the name the group gave them.
- The username, the invitations, the merge and the deletion need a connection ([ADR-0013](0013-shared-entries-sync-through-an-outbox.md)).

## Alternatives considered

- **An invitation by email**: needs a mail service, which isn't free.
- **A link anybody can use**: it leaks the group to whoever sees it.
- **Adding a user by handle without asking**: someone would find strangers' ledgers in their app.
- **A mandatory username**: a step in sign-in for the many who only want to be added.
- **Rewriting the entries to merge**: touches every entry of the group, bumps every cursor and breaks the writes waiting in an outbox.
- **Deleting a person's entries with their account**: it would change the balances of people who did nothing.
