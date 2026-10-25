# TODO

- Check the installed PWA on a real phone: install prompt and the update prompt. Desktop Chromium already loads the shell offline.
- Visual identity: settle the open questions in `design.md` §8 (uneven borders, accent hue, typeface, category identification without color, icons, route transitions).
- Check the layout on a real iOS Safari and Android Chrome (safe areas, keyboard, install).
- Release the login: set the three secrets of `.dev.vars.example` in production (`wrangler secret put <NAME>`), then apply the migrations and redeploy (`pnpm db:migrate:remote`, `pnpm deploy:prod`). The live Worker still has a stray `tarja` D1 binding from the first upload. Sign in once with Google on `localhost` and on the `workers.dev` URL to check both redirect URIs.
