# Settings

- `/settings`, linked from the header. One column of sections, `--size-8` apart: the language, the theme and the app color (each a `ChoiceGroup`, see [Color and themes](../../design-system/DESIGN.md#2-color-and-themes)), Categories (a hint and a link to `/categories`), Your data, and the account.
- **Your data** has a heading, a hint that says what the files hold and that they are made on the device, so they work offline, and two `Button`s side by side, `--size-4` apart and wrapping: the backup (JSON) and the spreadsheet (CSV). A press downloads the file at once, with nothing to confirm and no state to show: the browser says that it saved it. Both are always on, offline too. The formats are in [exporting your data](export.md).
