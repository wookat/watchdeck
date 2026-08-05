# WatchDeck

Free, web-first TV show & movie tracker with one-click TV Time GDPR import.
Live at https://watchdeck.zalize.com

## Stack
Cloudflare Workers + D1 + KV · Hono (JSX SSR) · Tailwind CSS v4 · TMDB API

## Develop
```
npm install
echo "TMDB_READ_TOKEN=..." > .dev.vars
npx wrangler d1 execute watchdeck --local --file=schema.sql
npm run dev
```

## Deploy
```
npm run deploy
```
Secrets: `wrangler secret put TMDB_READ_TOKEN`, optional `INDEXNOW_KEY`.
