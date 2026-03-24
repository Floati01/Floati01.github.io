# Cloudflare Worker Setup (Recommended Free Option)

This project now expects a Cloudflare Worker proxy so the frontend can fetch Spotify data without exposing your client secret.

## Why this provider

- Very generous free tier for hobby traffic.
- Fast global edge runtime.
- Easy secret management.

## 1. Create the Worker

1. Create a Cloudflare account.
2. Open Workers and Pages.
3. Create Worker.
4. Name it something like `spotify-artist-proxy`.
5. Replace default code with the file content from:
   - `worker/spotify-proxy-worker.js`
6. Deploy.

## 2. Add Worker secrets and variables

In Worker settings:

1. Add secret `SPOTIFY_CLIENT_ID`.
2. Add secret `SPOTIFY_CLIENT_SECRET`.
3. Add variable `ALLOWED_ORIGINS` as a comma-separated allowlist, for example:
   - `https://floati01.github.io,localhost`

This allows production site and any local dev server origin like:

- `http://localhost:5500`
- `http://127.0.0.1:5173`

If you use a custom domain for your site, set that origin instead.

## 3. Verify proxy is running

Open this URL in browser:

- `https://YOUR_WORKER_SUBDOMAIN.workers.dev/api/health`

Expected response:

- `{ "ok": true, "service": "spotify-proxy-worker" }`

Then verify albums endpoint with a real artist id:

- `https://YOUR_WORKER_SUBDOMAIN.workers.dev/api/artist/0qc4BFxcwRFZfevTck4fOi/albums`

Expected response includes:

- `{ "items": [ ... ] }`

## 4. Connect frontend to Worker

In `main.js`, set this value near the top:

- `const PROXY_BASE_URL = 'https://YOUR_WORKER_SUBDOMAIN.workers.dev';`

## 5. Deploy your site update

1. Commit changed files.
2. Push to GitHub Pages branch.
3. Open your site and search artists.

## 6. Troubleshooting

- `Origin not allowed`: check `ALLOWED_ORIGINS` includes your site origin and/or `localhost`.
- `Missing SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET`: set Worker secrets.
- `Proxy error 500`: check Worker logs for Spotify error details.

## Notes

- Keep your current GitHub Actions data workflow if you want a fallback static data feed.
- The interactive graph explorer now uses live proxy calls and no token input field.
