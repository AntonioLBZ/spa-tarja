# ADR-0025: Shared expenses notify the people they concern

- Status: Accepted
- Date: 2026-11-14

## Context

A shared expense somebody else adds reaches a device only when it syncs: when the app opens, gets the focus, reconnects or saves ([ADR-0013](0013-shared-entries-sync-through-an-outbox.md)). A window left open on a screen learns nothing, and a person who doesn't open the app never hears that a friend logged a dinner they owe half of. The owner wanted to be told, in the window that is open and with the app closed.

A device syncs only the groups the screen it shows mounts, and a person can be in up to 20 groups and 100 friends, so asking every group for its entries every minute would be up to 120 requests a minute per open window.

## Decision

Confirmed by the owner:

- **What is told**: an entry somebody else made, new to the device, not deleted, that concerns the person: an expense they have a share in, or a settlement they pay or are paid by (their merged placeholders included). Not an entry between two other members, not the person's own entries from another device, not an edit nor a delete. Nothing is told on the first pull of a group, which would be its whole history.
- **In the app, a banner.** A new shared component, `Banner`, drops in from the top over the header, like the banner of a system notification: two lines (where it comes from, and what happened, with the person's part), a tap opens the group (or Groups when it sums up several), a `close` button, a swipe to the side or Escape dismiss it, and it goes away by itself after 8 s. Several entries at once are summed up in one banner. It does not show for a group whose screen is showing. It is not the `Toast`, so it never waits for nor covers an Undo.
- **A watcher keeps the groups fresh while the window is seen.** `GET /groups` also answers each group's cursor (`seq`), and while the page is visible and online the device asks it every 60 s, besides open, focus and reconnect, and pulls only the open groups whose cursor moved past the one it holds, whatever screen is showing.
- **With the app closed, Web Push.** A switch per device in the settings, off by default, asks the browser's permission and sends the subscription to the server; the screen of a group with somebody else in it suggests it once, in a quiet notice that is answered for good. When an entry is made (not edited), the server sends a push to the subscriptions of the members it concerns, but its author, after answering. The message is encrypted (RFC 8291) and signed (RFC 8292) with Web Crypto, without a dependency. The service worker shows it as a system notification, unless a window of the app is visible and the browser allows a push without one: then it asks that window to sync, and the banner tells it. Safari requires a notification for every push, so there it shows anyway.
- This refines ADR-0013, whose "Nothing is pushed to other devices" no longer holds; how entries sync is unchanged.

## Consequences

- One request a minute per visible window, plus one per group that changed; no request while the page is hidden. Well inside the free tiers ([ADR-0003](0003-spa-on-one-worker-on-free-tiers.md)), as are the pushes: one outgoing request per subscription and a millisecond of CPU.
- The server stores, per device that turned it on, its push address and its language, and the browser's push service (Google, Apple, Mozilla or Microsoft) carries an encrypted message it can't read. The privacy notice says so.
- The server sends only to the push services of the browsers, so a stored address can't make the Worker call any other host.
- On an iPhone push works only with the app added to the Home Screen; the switch says so where push is missing.
- What jsdom can't run (a real service worker, a notification with the app closed, the swipe) is checked by the owner on a phone, on the prerelease.
- The details are in [notifications](../specs/notifications.md).

## Alternatives considered

- **Pulling every group every minute**: up to 120 requests a minute for a person with many friends.
- **A socket kept open** (a Durable Object per group): instant, but a new kind of server for what a minute and a push already cover.
- **Telling edits and deletes too, or everything in a group**: many more interruptions for what the person mostly doesn't need at once.
- **The `Toast` at the bottom**: it would have to wait for, or cover, the Undo of the person's own delete, and it doesn't read as a notification.
- **Asking the permission at sign-in**: browsers penalise a prompt nobody asked for, and most people turn it down.
- **A library for Web Push**: the two RFCs are about 150 lines over Web Crypto, testable against the RFC's own example, and the libraries in use target Node.
