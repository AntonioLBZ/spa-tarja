# ADR-0014: People: nicknames, friends by invitation link, merging a dummy and deleting an account

- Status: Proposed
- Date: 2026-11-01

## Context

Login is Google only ([ADR-0008](0008-google-login-with-better-auth.md)) and the free tiers have no way to send an email ([ADR-0003](0003-spa-on-one-worker-on-free-tiers.md)). People must be able to use the app together, some have no account yet, and the owner wants to split with people who never will. The app will also hold the names of people who are not its user, and anybody with a Google account can sign in, so a person must be able to leave and take their data with them.

## Decision

- **Invitations are for being friends**, and for nothing else, and they are a link. A person makes one directly, and whoever opens it and accepts becomes their friend, a new group of two. A friend can also be made by name, a group of two with a dummy next to the maker, for somebody who won't use the app; a link can then be made for that dummy, and whoever accepts it takes its place and keeps everything already in the ledger between the two. Nobody is made a friend without accepting, and a person can decline. There are no invitations to a group.
- A user may set a **nickname**: it doesn't have to be unique, nobody can be found by it, and it is only the name their friends see (the name of their Google account until they set one). There is **no way to look a person up**: the only way to reach an existing user is a link someone sent them, so the app never answers whether an email or a name has an account, and no email is shown to anybody.
- **A group holds dummies and friends only.** A member adds a dummy by name, or one of their own friends who is a real person, and a friend is a member at once: being friends is the consent. When the group has dummies, adding a friend asks whether they replace one or are a new member.
- A dummy can be **merged into a real member of the same group**, and only that: the dummy is marked as merged and its id means the target from then on, in the balances and the ledger. No entry is rewritten, so the sync and the offline writes are not affected. A merge can't be undone.
- Signing in from an invitation link comes back to the link ([authentication](../specs/authentication.md)).
- A person can **delete their account**. Their own data goes: expenses, categories, income, budgets, nickname, sessions. In the groups they were in, their member becomes "Deleted user" and the entries stay, since they are also the record of the others; the debts they leave can still be settled or removed by the rest. A group they owned passes to the member who is a user and joined first, or closes if there is none.
- The app carries a **privacy notice** that says what is stored, why, who sees it and how to export and delete it ([settings](../specs/settings.md)).

## Consequences

- No email is sent, so the owner sends the link themselves (a message, a chat).
- Bringing a new real person into a group takes two steps: they become a friend, then they are added. Adding a dummy takes one.
- A friend who is added to a group can't refuse, only leave once their balance is zero; anybody in the group can write entries that split with them. That is the trust the friendship stands for.
- A person can be a dummy friend that someone typed and, through a direct link or the link of another dummy, a real friend: two friends that are never merged. Sending the link of the dummy that exists avoids it.
- A direct link holds no place for anybody, so a person keeps only a few of them open at once.
- Deleting an account is irreversible and needs a connection. The backups D1 keeps on its own expire by themselves. Personal data of others stays in the ledgers of the groups, under the name the group gave them.
- The invitations, the merge and the deletion need a connection ([ADR-0013](0013-shared-entries-sync-through-an-outbox.md)).

## Alternatives considered

- **A unique username, or the email, to find a user and send a request**: it tells whoever asks whether an account exists and needs a lookup and a rate limit. The owner kept a nickname for friends and decided against the lookup; a link needs none of it.
- **An invitation by email**: needs a mail service, which isn't free.
- **An invitation to a group**: it leaks the group to whoever sees a link, and it is a second kind of invitation next to the one for friends.
- **Links only for a dummy**: inviting a person who uses the app would mean making a fake friend first and having them replace it, a step the owner found hard to follow (2026-11-06).
- **Rewriting the entries to merge**: touches every entry of the group, bumps every cursor and breaks the writes waiting in an outbox.
- **Deleting a person's entries with their account**: it would change the balances of people who did nothing.
