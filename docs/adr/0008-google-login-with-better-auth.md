# ADR-0008: Google login only, through Better Auth

- Status: Accepted
- Date: 2026-10-25

## Context

Everything sits behind a login and every row belongs to a user. The app must also open with no network.

## Decision

- Google OAuth only, no own passwords, through Better Auth mounted on Hono at `/api/auth/*`. Better Auth takes the D1 binding directly and needs the `nodejs_als` compatibility flag. Any Google account can sign in.
- A session is an `httpOnly` cookie signed with `BETTER_AUTH_SECRET`, valid for 30 days. A 5 minute cookie cache lets most requests skip D1, so a revoked session can stay valid for up to 5 minutes.
- The base URL is the origin of each request, so the same code runs on `localhost`, `workers.dev` and any later domain without configuration.
- No Better Auth client in the browser, to keep the bundle small: three calls and a small store.
- The signed-in user's profile is kept in `localStorage`, so the app opens signed in with no network. Only a definite answer signs the user out, never a network error or a `5xx`.
- Local data belongs to a user: the outbox and the persisted cache are stored under the user id, so another account on the same browser never sees or pushes them.

## Consequences

- Google's console must list `<origin>/api/auth/callback/google` for each origin in use.
- Signing out needs a connection, because the cookie is `httpOnly` and only the server can end it.
- The Worker's secrets are `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
- The details are in [authentication](../specs/authentication.md).

## Alternatives considered

- Own passwords: out of the question.
- **Guest mode** (use the app with no account, local data only, moved to the account on sign-in), rejected by the owner on 2026-10-29: it overturns "Google login only", every future feature would need a guest behaviour, and guest data can be lost with the browser's storage. Revisit only if strangers should be able to try the app.
