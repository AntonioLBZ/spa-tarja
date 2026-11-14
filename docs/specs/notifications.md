# Notifications

How a person hears of a shared expense somebody else adds ([ADR-0025](../adr/0025-shared-expenses-notify-the-people-they-concern.md)): a banner in the window that is open, and a system notification with the app closed.

## What is told

- **A notice** is an entry of a group that a pull brings to the device and that:
    - the device didn't hold (its id is new to the cache of that group);
    - isn't deleted;
    - somebody else made: its `createdBy` is not the person's member (`me` of `GET /groups`), so the person's own entries made on another device are not told; an entry whose author deleted their account (no `createdBy`) is told;
    - concerns the person: an expense with a share of theirs, or a settlement they pay (`paidBy`) or are paid (its one share), every member read through `canonicalMember`, so a placeholder merged into them counts as them.
- **Not told**: an edit or a delete of an entry the device holds, an entry between two other members, and anything brought by the first pull of a group (no pull of it ever went through on the device; a copy kept with a cursor counts as pulled), which would be its whole history. The first entry of a group the device pulled while it was empty is told. What a group wrote while the person was away and is brought by the pull after they come back ([groups](groups.md)) is told, summed up as below.
- `noticesFor` (`core/notices.ts`) decides it from the entries the device held, the entries a pull brought and the group; it is the one rule, used by the device for the banner and by the server for the push. Your part is the cents of the person's share for an expense, and the amount for a settlement.

## The watcher

- `GET /groups` answers each group's cursor as `seq`: `MAX(seq)` of its entries, 0 when it has none, and for a person who left, no more than their `left_seq` ([groups](groups.md)), so it never tells them a group moved after they left.
- While the person is signed in, the page is visible and the device is online, the `groups` query refetches every 60 s (`WATCH_EVERY_MS`), besides the triggers it has (open, focus, reconnect); a hidden page asks nothing.
- After each answer, the device pulls, with the same `syncGroup`, every open group whose `seq` is past the cursor it holds, whatever screen is showing, and only those. A group the device never pulled is pulled too, silently (first pull). A closed group is left to the rules it has ([offline sync](offline-sync.md)).
- Every pull, whoever starts it (a screen, the watcher, a write, a push), hands its notices to `onNotices`, a listener of the user's data (`src/lib/offline`), so the banner hears of them wherever they come from and a pull is never run twice for them.

## The banner

- `Banner` (`src/components/banner`): a box that drops in from the top, over the header and under the top safe area, `--size-4` from the sides on a phone, and as wide as the content column from 40 rem, centered. Its look is in [`DESIGN.md`](../../design-system/DESIGN.md): the notch on `--color-bg-secondary` with `--shadow-popup`.
- Two lines: a title (where it comes from) and a message (what happened). The title and the message together are one `<button>` that opens what the banner is about; beside it, a `glyph` ghost `Button` with the `close` icon, named by the `dismissLabel` the provider takes by props. A swipe to the side of more than a third of its width, or Escape while the focus is inside it, dismisses it; a shorter swipe goes back. It goes away by itself after 8 s, and hovering it or holding the focus inside pauses the count. It never takes the focus. Its `role="status"` region is always in the page, so a banner that comes in is announced.
- One at a time: notices that come while one shows are added to it, which then sums them up and starts its 8 s again.
- It comes in from above and leaves the same way, with a fade and a vertical shift over `--duration-base`; a dismissal by swipe leaves to the side it was swiped to. With reduced motion it only appears and goes.
- It is shown by `NoticeBanner` (`src/features/notices`), which listens to `onNotices` and words them with the names the group gives (`useGroupWords`), and does not show a notice of the group whose screen is showing (`/groups/$groupId`, or that group as a pinned tab of Expenses, [ADR-0021](../adr/0021-pinned-groups.md)): the person sees the row come in.

### Copy

The person's part and the amounts are formatted as everywhere ([shared expenses](shared-expenses.md)); Ana is how the group names the author, Piso the group.

| What                                  | Title         | Message                          |
| ------------------------------------- | ------------- | -------------------------------- |
| One expense in a group                | Piso          | Ana added Cena · your part €6.25 |
| One expense with a friend             | Ana           | Ana added Cena · your part €6.25 |
| One settlement, they paid the person  | Piso (or Ana) | Ana paid you €20.00              |
| One settlement, the person paid them  | Piso (or Ana) | Ana noted you paid them €20.00   |
| Several, one group, all expenses      | Piso (or Ana) | 3 new expenses                   |
| Several, one group, with a settlement | Piso (or Ana) | 3 new entries                    |
| Several groups                        | Groups        | 5 new entries in 2 groups        |

A tap opens the group (`/groups/$groupId`), or Groups (`/groups`) for several groups. The copy is in the locales (`notices.*`), in `en` and `es`.

## Push notifications

### Turning them on

- **Notifications**, a section of the settings after Profile ([settings](settings.md)): a hint ("Hear about a shared expense somebody adds with you, also with Tarja closed.") and a `Checkbox` "Notifications on this device", off by default. It belongs to the device, not the account: each browser has its own subscription, and the switch reads it (`pushManager.getSubscription()` and `Notification.permission`).
    - Turning it on asks the browser's permission, subscribes with the server's public key (`GET /api/push/key`) and sends the subscription (`PUT /api/push`); when the server doesn't take it, the browser drops it again, so the switch never shows on for a subscription that brings nothing. Turning it off deletes it (`DELETE /api/push`) and unsubscribes; an address the server refuses for good (a `4xx`) is dropped in the browser all the same. Both need a connection and are off, with a notice, without one.
    - Where the browser has no push (no `PushManager`, as in Safari on an iPhone not added to the Home Screen) the switch is off and a line says so: "This browser can't show notifications. On an iPhone, add Tarja to the Home Screen first."
    - Where the permission was denied, the switch is off and a line says it is changed in the settings of the browser.
- **The suggestion.** The screen of an open group with another member who is a user shows, under the title, a quiet `Notice` ("Want to hear when somebody adds an expense with you?") with two ghost `Button`s, Turn on (which does what the switch does) and Not now, only while push is there, the permission was never asked (`default`), the device has no subscription and the person never answered it on this device. Either answer, or a refusal of the browser's prompt, is kept for good on the device (`tarja:push-suggestion:<user id>` in `localStorage`, forgotten with the rest of the user's local data, [authentication](authentication.md)).
- **Kept fresh.** While the switch is on, the device sends its subscription again when the app opens and when the language changes, so the server holds the current address and language, and a subscription the browser renewed by itself is caught up.
- **Signing out** with the button deletes the subscription of the device on the server first, while the session can still ask it, and unsubscribes it in the browser; a sign-out the server decides (the session ended) unsubscribes it in the browser, and the server deletes its row when the push service answers it is gone. Another account signing in on the same browser starts with the switch off.

### The server

- `push_subscriptions` ([data model](data-model.md)): the address (`endpoint`), the keys of the browser (`p256dh`, `auth`), the language (`en` or `es`) and the user. The address is unique: a `PUT` of an address held by another user moves it to the caller, the browser belonging to whoever is signed in now. A person keeps at most 5 (`MAX_PUSH_SUBSCRIPTIONS`); the sixth replaces the one sent longest ago.
- `GET /api/push/key` answers the public key, read from the private one (`VAPID_PRIVATE_KEY`, a JWK of P-256 in one secret per environment, so the two can't drift), or `503 push-unavailable` without it. `PUT /api/push` takes `{ endpoint, keys: { p256dh, auth }, locale }` in the body, never in the URL, as the Worker's logs keep URLs; `DELETE /api/push` takes `{ endpoint }` and deletes it only if it is the caller's, answering `204` either way. All three need a session; the two writes, the origin check ([authentication](authentication.md)).
- **Only the push services.** The address must be `https` on a host of a push service: `fcm.googleapis.com` or a numbered `jmt<n>.google.com` (the browsers built on Chromium), `updates.push.services.mozilla.com`, `*.push.apple.com` or `*.notify.windows.com`; any other answers `400`. So no stored address makes the Worker call another host.
- **When.** A `PUT /api/groups/:groupId/entries/:id` that makes the row (no entry had that id), and whose entry isn't deleted, sends, after the answer (`waitUntil`), one push to each subscription of every member who is a user, hasn't left and is concerned by the entry (`noticesFor`), but its author. An entry sent again, edited or deleted sends nothing.
- **The message** is JSON, encrypted for the subscription (`aes128gcm`, RFC 8291) and authorised with a JWT signed with the private key (`VAPID_PRIVATE_KEY` and `VAPID_SUBJECT`, secrets, the contact as `mailto:`, RFC 8292), by `server/web-push.ts`, over Web Crypto. It holds what the service worker needs to word it: the language, the group (id, and its title as the person sees it), and the notice (kind, the author's name in the group, the text, the person's part or the amount, the currency, and which side of a settlement the person is). Texts are cut so it stays under 3 KB. `TTL` is one day and `Urgency` normal.
- **The answer of the push service.** `201` is done; `404` and `410` mean the subscription is gone and it is deleted; anything else, and a network error, is dropped, as a push is a hint and the next sync brings the entry anyway. Nothing is retried.

### The service worker

- A script of its own (`src/features/notices/push-worker.ts`), built with the app as a classic script, `push-worker.js` (a plugin of `vite.config.ts`), and imported by the generated service worker (`importScripts`), handles `push` and `notificationclick`. It words a message with the copy of the banner (`notices.*` only, so it doesn't carry the rest of the locales), in the language the message carries, through the same `wordNotices`.
- **A push**: if a window of the app is visible, it posts it `{ type: 'sync' }`, and that window refetches the groups, so the watcher pulls and the banner tells it. Otherwise, and always in Safari, which takes away the subscription of a site that receives a push without showing a notification, it shows one: the title and the message of the banner, the app's icon, tagged with the group so a later one of the same group replaces it, summed up with the one it replaces ("3 new expenses"), and the path of the group in its data.
- **A tap** posts `{ type: 'open', path }` to a window of the app, which moves its router there, and focuses it; with no window it opens one there. `PushSync` (`src/features/notifications`) is what listens in the page, to `sync` and `open` alike.

## Privacy

The privacy notice ([settings](settings.md)) says, in both locales with a new "last updated": for each device where notifications are on, its push address and its language are stored, until they are turned off or the account is deleted; signing out stops them on that device at once (the browser drops its subscription), and the address is deleted when the push service next says it is gone, which a sign-out with the button does at once when it has a connection; and the push service of the browser (Google, Apple, Mozilla or Microsoft) carries each notification, encrypted so that it can't read it, though it sees when one is sent and to which device.
