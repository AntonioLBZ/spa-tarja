# ADR-0014: People: usernames, friends by invitation, merging a dummy and deleting an account

- Status: Proposed
- Date: 2026-11-01

## Context

Login is Google only ([ADR-0008](0008-google-login-with-better-auth.md)) and the free tiers have no way to send an email ([ADR-0003](0003-spa-on-one-worker-on-free-tiers.md)). People must be able to use the app together, some have no account yet, and the owner wants to split with people who never will. The app will also hold the names of people who are not its user, and anybody with a Google account can sign in, so a person must be able to leave and take their data with them.

## Decision

- A user may set a **username**, unique ignoring case. Others find a user by an exact match on it, never by a prefix, and by the email of the account while no username is set, which is the default. Groups show names, never the username or the email.
- **Invitations are for being friends**, and for nothing else. A friend is made by name first, a group of two with a dummy next to the maker; an invitation, a link or a handle, is for that dummy, and whoever accepts takes its place and keeps everything already in the ledger between the two. Nobody is made a friend without accepting, and a user can decline. There are no invitations to a group.
- **A group holds dummies and friends only.** A member adds a dummy by name, or one of their own friends who is a real person, and a friend is a member at once: being friends is the consent. When the group has dummies, adding a friend asks whether they replace one or are a new member.
- A dummy can be **merged into a real member of the same group**, and only that: the dummy is marked as merged and its id means the target from then on, in the balances and the ledger. No entry is rewritten, so the sync and the offline writes are not affected. A merge can't be undone.
- Signing in from an invitation link comes back to the link ([authentication](../specs/authentication.md)).
- A person can **delete their account**. Their own data goes: expenses, categories, income, budgets, username, sessions. In the groups they were in, their member becomes "Deleted user" and the entries stay, since they are also the record of the others; the debts they leave can still be settled or removed by the rest. A group they owned passes to the member who is a user and joined first, or closes if there is none.

## Consequences

- No email is sent, so the owner sends the link themselves (a message, a chat). A request by handle is seen only when the person opens the app.
- Bringing a new real person into a group takes two steps: they become a friend, then they are added. Adding a dummy takes one.
- A friend who is added to a group can't refuse, only leave once their balance is zero; anybody in the group can write entries that split with them. That is the trust the friendship stands for.
- Looking a handle up tells whether an account has it. That is the price of finding people; it answers a name only, to someone signed in ([invitations](../specs/invitations.md)).
- A person can be a dummy friend that someone typed and, through their own request, a real friend: two friends that are never merged. Sending the invitation of the dummy that exists avoids it.
- Deleting an account is irreversible and needs a connection. The backups D1 keeps on its own expire by themselves. Personal data of others stays in the ledgers of the groups, under the name the group gave them.
- The username, the invitations, the merge and the deletion need a connection ([ADR-0013](0013-shared-entries-sync-through-an-outbox.md)).

## Alternatives considered

- **An invitation by email**: needs a mail service, which isn't free.
- **An invitation to a group**, by link or by handle: it leaks the group to whoever sees a link, and it is a second kind of invitation next to the one for friends. The owner prefers friends only.
- **A link for nobody in particular**: if the person is already a dummy friend, accepting would make a second friend, and two friends can't be merged.
- **Adding a user by handle without asking**: someone would find strangers' ledgers in their app.
- **A mandatory username**: a step in sign-in for the many who only want to be added.
- **Rewriting the entries to merge**: touches every entry of the group, bumps every cursor and breaks the writes waiting in an outbox.
- **Deleting a person's entries with their account**: it would change the balances of people who did nothing.
