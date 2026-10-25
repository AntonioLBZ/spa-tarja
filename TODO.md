# TODO

- Check the installed PWA on a real phone: install prompt and the update prompt. Desktop Chromium already loads the shell offline.
- Check the layout on a real iOS Safari and Android Chrome (safe areas, keyboard, install), and the visual identity there: the Dot Matrix logo in the header, the amber accent next to the orange and yellow category icons, and the slide between screens (a browser without view transitions, like iOS Safari before 18, just switches).
- Charts, once the items above are done: new pages to see the spending per day, week and month, with filters (category, date range). They are computed on the client from the local data, so they work offline, and the aggregation goes in `core/`. Each expense counts in the month that deferred expenses and installments assign to it. A chart can't tell categories apart by color alone, so it depends on the open question about category identification in `design.md` §8.
