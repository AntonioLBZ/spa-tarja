# TODO

- Check the installed PWA on a real phone: install prompt and the update prompt. Desktop Chromium already loads the shell offline.
- Visual identity: settle the open questions in `design.md` §8 (uneven borders, accent hue, typeface, category identification without color, icons, route transitions).
- Check the layout on a real iOS Safari and Android Chrome (safe areas, keyboard, install).
- Apply the migrations to the production D1 and redeploy: `pnpm db:migrate:remote`, then `pnpm deploy:prod`. The live Worker still has a stray `tarja` D1 binding from the first upload.
