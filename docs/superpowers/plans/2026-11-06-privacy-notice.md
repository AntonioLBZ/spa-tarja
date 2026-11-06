# Privacy notice

Item 30 of `TODO.md`. A `Dialog` with the notice, in `en` and `es`, opened from the account section of Settings and from the sign-in screen. Every statement is checked against the code and the specs; what the repository cannot show is left out and listed in the report.

## Task 1: the notice in Settings

Files: `src/lib/contact.ts`, `src/features/auth/privacy-notice.tsx`, `privacy-notice.css`, `privacy-notice.test.tsx`, `account.tsx`, `src/assets/locales/{en,es}.json`.

- `CONTACT_EMAIL` (`antoniolozbez@gmail.com`, the visible text), `CONTACT_MAILTO` (`mailto:antoniolozbez+tarja@gmail.com`, the link target) and `PORTFOLIO_URL` (`https://albz.app`).
- `PrivacyNotice = () => JSX`: a ghost `Button` (`privacy.open`) and a `Dialog` titled `privacy.title` with one ghost `Close` action. Plain `h3` headings per section; the contact and the portfolio are ghost links (`button button--ghost`) so they are 44 px high.
- Copy under `privacy.*` in both locales; the names of the screens it points to (Settings, Your data, Delete account) are taken from the settings keys, so they cannot drift.
- Tests (`renderApp`, `/settings`): opens from the button with the focus on the dialog; closes with Escape and with Close; the mailto carries the tag and the text does not; the sections are there in `en` and in `es`; the dialog sends no request.

## Task 2: the notice on the sign-in screen

Files: `sign-in-screen.tsx`, `sign-in-screen.css`, `auth-gate.test.tsx` or `privacy-notice.test.tsx`.

- The same `PrivacyNotice` under the Google button.
- Tests: signed out it opens and closes; with the server out of reach and offline it still opens and fetches nothing; the Google button keeps working beside it.

## Task 3: the docs

Files: `docs/specs/settings.md`, `docs/specs/authentication.md`, `design-system/DESIGN.md` (Dialog), `AGENTS.md`, `TODO.md`, this plan deleted.

## Review Focus

- A statement in the copy that the code does not keep (IP address of a session, logs of the platform, backups).
- The dialog wider than 320 px (the email and the address of the portfolio have no spaces to break at).
- The focus returning to the button that opened it, which jsdom does not do.
- The trigger inside the sign-in screen taking the place of the Google button in the tab order.
