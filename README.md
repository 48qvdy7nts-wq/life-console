# Life Console

Local-first personal dashboard built with Vite and React.

## What it does

- Shows verified deadlines, manual commitments, recurring items, journal entries, and routines in one place.
- Imports JSON, generic CSV, Google Calendar CSV, Notion-style CSV, ICS, and loose text.
- Scans local folders in the browser for candidate commitments.
- Supports free private GitHub Gist sync.
- Works as a static PWA.

## Local use

```bash
npm install
npm run build:all
npm run preview
```

Useful scripts:

- `npm run sync:apple`
- `npm run sync:local`
- `npm run sync:projects`
- `npm run sync:all`

## Free deployment

### GitHub Pages

This repo already includes [`.github/workflows/deploy-pages.yml`](./.github/workflows/deploy-pages.yml).

1. Push the repo to GitHub.
2. In GitHub, enable Pages and choose `GitHub Actions` as the source.
3. Push to `main` or `master`, or run the workflow manually.

### Cloudflare Pages

This is a plain static build. Run `npm run build:all` and upload the `dist/` folder to any free static host, including Cloudflare Pages.

## Honest limits

- Apple Calendar and Reminders sync depends on macOS Automation permissions.
- GitHub Gist sync needs your own token with `gist` scope.
- Local folder scanning only sees what the browser is allowed to read.
