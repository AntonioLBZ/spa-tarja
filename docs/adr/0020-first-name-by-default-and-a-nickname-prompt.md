# ADR-0020: The first name by default, and a prompt for the nickname

- Status: Accepted
- Date: 2026-11-12

## Context

[ADR-0014](0014-people-in-groups.md) gives a person a nickname, the name their friends see, and falls back to the name of their Google account when they have none. That name is usually a full name with surnames, which is more than friends need and reads badly in lists of people. Few people find the nickname in the settings.

## Decision

Asked for by the owner (2026-11-12):

- **Without a nickname, a person is shown by their first name**: the first word of the name of their Google account, as the server stores it. It is the name a person starts with in a group they make or join, the name a friend is made with, and the name whoever opens their invitation link sees. Nothing new is stored: the first name is worked out from the stored name each time, so it applies to every user, those who signed in before as well, with no migration. A compound first name loses its second word ("María José" is "María"); the nickname is there to fix it.
- **The app asks for the nickname right after each sign-in** while the person has none, in a sheet titled "What should your friends call you?", never when it opens on a device that already holds the session. The field starts empty, nothing is written in it for the person. Saving sets the nickname and the sheet never comes back. It can be skipped, "Not now", and then it comes back at the next sign-in. That it was skipped is not stored anywhere. Setting a nickname needs a connection ([ADR-0013](0013-shared-entries-sync-through-an-outbox.md)), so offline the app doesn't ask.
- The rest of ADR-0014 stands: the nickname is not unique, nobody can be found by it, and the email is never shown. This refines ADR-0014 without superseding it.

## Consequences

- Names already stored in a group stay as they are: a group keeps the name a person started with there.
- A friend who has no nickname shows the name stored on their member, as before; friends made from now on start with the first name.
- The privacy notice says the friends see the first name, not the whole name of the Google account.
- A person who never sets a nickname sees the sheet each time they sign in, which is rare: a session lasts 30 days and the device keeps it.

## Alternatives considered

- **Google's `given_name`**: right for compound first names, but only for people who sign in from now on, Google may leave it out, and keeping it needs a new column. Turned down by the owner to keep the database as it is.
- **The sheet written in advance with the first name**: turned down by the owner: the person writes the name.
- **Remembering a skip**, on the device or on the server: turned down by the owner: the app asks while there is no nickname.
- **Asking each time the app opens**: tried first and turned down by the owner (2026-11-12): it is asked only after signing in.
- **A mandatory nickname**: turned down by the owner: it can be skipped.
