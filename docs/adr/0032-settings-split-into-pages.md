# ADR-0032: Settings split into pages

- Status: Proposed
- Date: 2026-11-15

## Context

`/settings` had grown into one long column: the language, the theme, Amounts, Profile, Notifications, a section that only led to the categories, Your data, the account and About Tarja. On a phone the account and About Tarja were several screens down, and the settings that are changed once (the theme, how amounts look, the nickname) sat between the ones a person looks for.

## Decision

`/settings` keeps what is short or looked at often, and the rest goes to three pages under it:

- **`/settings`**, in this order: the language (as before); three rows together in one list, each a link to a page on paper, with no box and no notch, holding only its title and a `chevron_right` on one line over a hairline, as tall as any other row of the app: Appearance, Categories and Account; under the hairline of each row, close enough to read as its foot, a short line in secondary text that describes the link: "Theme and amounts", "Your own, beside the built-in ones", and for Account the name the person's friends see (the nickname, else the first name of the Google account) and their email; Notifications (as before, after the rows and never between them); and About Tarja with the privacy notice.
- **`/settings/appearance`**: the theme, then Amounts, whose sample of an amount that comes in and one that goes out is drawn with the real `Amount` above the checkboxes, so it follows the choices as they change.
- **`/settings/categories`**: the manager of the categories that was `/categories`. `/categories` redirects there, so old links and installed apps keep working.
- **`/settings/account`**: Profile (the nickname), Your data, and the session (who is signed in, Sign out, Delete account). "Download your data first" in the dialog of Delete account still leads to the heading of Your data, now on the same page.

Each page has its own title. The way back is the one every screen deeper than a tab already has: on a phone, the link at the left of the header, a chevron and "Settings"; from 40 rem, the underlined Settings of the header. The pages are depth 2 under Settings, so the header and the bottom bar mark Settings as current on them, and going in and out slides forward and back.

## Consequences

- The section of the settings that only led to the categories goes: the row says it.
- The privacy notice names where the controls are: Your data and the nickname under Account.
- A page has no new component: a row is a link with a hairline under it, so it stays thin and the three read as a list, not as three boxes.
- The line under a row describes its link (`aria-describedby`), so it is read with it but kept out of its name.

## Alternatives considered

- Keeping one page with folded sections: the page stays as long once a section is open, and the headings stop being something to scroll to.
- A page for every section, the language and Notifications included: one more tap for things changed in a press, and a settings screen made only of links.
- Putting Notifications among the rows: the owner wants the rows together.
- The rows as `Card`s with the notch: three thick boxes, taller than the rest, for what is only a way to another page.
