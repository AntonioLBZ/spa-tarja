# Icons

The shapes in `icon-paths.ts` come from Material Symbols (Sharp style, weight 400), copyright Google, under the Apache License 2.0 (see `LICENSE` here, and <https://github.com/google/material-design-icons>). They were copied from the `@material-symbols/svg-400` package, version 0.48.1, `sharp/<name>.svg`; each entry is the `d` of the file's single `<path>`.

`close`, the × of the search field and of the close button of a sheet, is the `d` of `sharp/close.svg`: an entry of `icon-paths.ts` and, for the search field, also a CSS mask in `src/features/expenses/expense-list-controls.css`. `add`, the + of the bottom bar, is the `d` of `sharp/add.svg` of the same package version.

`expand_more`, the chevron of a disclosure, is an icon of the interface (`UI_ICONS`), not one a category can take. Version 0.48.1 of the package has no `expand_more.svg`; Google draws the same chevron for `keyboard_arrow_down`, so the entry is the `d` of `sharp/keyboard_arrow_down.svg`.

`groups`, `bar_chart` and `settings` are icons of the interface too (`UI_ICONS`): two of the tabs of the bottom bar, the other two being `receipt_long` and `groups`. They are the `d` of `sharp/groups.svg`, `sharp/bar_chart.svg` and `sharp/settings.svg` of the same package version.

`chevron_right`, the end of a row that leads to another screen, and `check`, the mark of a `Checkbox`, are icons of the interface too: the `d` of `sharp/chevron_right.svg` and `sharp/check.svg` of the same package version.

`chevron_left`, the mark of the link back in the header of a phone, is an icon of the interface too: the `d` of `sharp/chevron_left.svg` of the same package version.

`search`, the magnifier of the search field, and `tune`, the mark of the Filters button, are icons of the interface too: the `d` of `sharp/search.svg` and `sharp/tune.svg` of the same package version.
