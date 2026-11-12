# Icons

The shapes in `icon-paths.ts` come from Material Symbols (Rounded style, weight 500), copyright Google, under the Apache License 2.0 (see `LICENSE` here, and <https://github.com/google/material-design-icons>). They were copied from the `@material-symbols/svg-500` package, version 0.49.0, `rounded/<name>.svg`; each entry is the `d` of the file's single `<path>`, with its numbers rounded to one decimal on the 960 unit grid.

`expand_more`, the chevron of a disclosure, is an icon of the interface (`UI_ICONS`), not one a category can take. That version of the package has no `expand_more.svg`; Google draws the same chevron for `keyboard_arrow_down`, so the entry is the `d` of `rounded/keyboard_arrow_down.svg`.

The icons of the interface are the ones in `UI_ICONS`: `chevron_left`, `chevron_right`, `check`, `groups`, `person`, `bar_chart`, `settings`, `add`, `close`, `search`, `tune`, `delete`, `edit`, `content_copy`, `person_add` and `link`. Each is the `d` of the file of the same name in `rounded/`. The × of the search field of the list is also a CSS mask of `rounded/close.svg`.
