import { writeFile } from 'node:fs/promises';

const clientId = process.env.SPOTIFY_CLIENT_ID;
const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
const artistId = process.env.SPOTIFY_ARTIST_ID;

if (!clientId || !clientSecret || !artistId) {
  console.error('Missing required env vars: SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, SPOTIFY_ARTIST_ID');
  process.exit(1);
}

function normalizeArtistId(input) {
  const value = String(input || '').trim();

  if (!value) {
    throw new Error('SPOTIFY_ARTIST_ID is empty');
  }

  // Accept raw id, Spotify URI (spotify:artist:<id>), or full URL.
  const uriMatch = value.match(/^spotify:artist:([A-Za-z0-9]+)$/);
  if (uriMatch) {
    return uriMatch[1];
  }

  if (value.startsWith('http://') || value.startsWith('https://')) {
    try {
      const parsed = new URL(value);
      const parts = parsed.pathname.split('/').filter(Boolean);
      const artistIndex = parts.findIndex((part) => part === 'artist');

      if (artistIndex >= 0 && parts[artistIndex + 1]) {
        return parts[artistIndex + 1];
      }
    } catch {
      // Fall through to raw validation below.
    }
  }

  const rawMatch = value.match(/^([A-Za-z0-9]+)$/);
  if (rawMatch) {
    return rawMatch[1];
  }

  throw new Error(
    'SPOTIFY_ARTIST_ID must be a raw id, spotify:artist:<id>, or https://open.spotify.com/artist/<id>'
  );
}

const normalizedArtistId = normalizeArtistId(artistId);

function sanitizeAlbumsUrl(urlInput) {
  const url = new URL(urlInput);

  // Keep request arguments inside Spotify's accepted range and normalize malformed values.
  const rawLimit = url.searchParams.get('limit');
  const parsedLimit = Number.parseInt(rawLimit || '', 10);
  const safeLimit = Number.isInteger(parsedLimit)
    ? Math.min(50, Math.max(1, parsedLimit))
    : 20;

  url.searchParams.set('limit', String(safeLimit));

  if (!url.searchParams.get('include_groups')) {
    url.searchParams.set('include_groups', 'album,single');
  }

  return url.toString();
}

function isLikelyEp(item) {
  const name = item.name || '';
  const normalized = name.toLowerCase();

  return (
    normalized.endsWith(' ep') ||
    normalized.includes('(ep)') ||
    normalized.includes(' - ep') ||
    normalized.includes('[ep]')
  );
}

async function getAccessToken() {
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });

  if (!tokenResponse.ok) {
    const details = await tokenResponse.text();
    throw new Error(`Token request failed (${tokenResponse.status}): ${details}`);
  }

  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}

async function getAllArtistReleases(accessToken) {
  const firstUrl = new URL(`https://api.spotify.com/v1/artists/${normalizedArtistId}/albums`);
  firstUrl.searchParams.set('include_groups', 'album,single');
  firstUrl.searchParams.set('limit', '20');

  let nextUrl = sanitizeAlbumsUrl(firstUrl.toString());
  const allItems = [];

  while (nextUrl) {
    const requestUrl = sanitizeAlbumsUrl(nextUrl);

    const response = await fetch(requestUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    if (!response.ok) {
      const details = await response.text();
      throw new Error(`Albums request failed (${response.status}) for ${requestUrl}: ${details}`);
    }

    const data = await response.json();
    allItems.push(...(data.items || []));
    nextUrl = data.next ? sanitizeAlbumsUrl(data.next) : null;
  }

  return allItems;
}

function normalizeReleases(items) {
  const unique = new Map();

  for (const item of items) {
    const albumType = item.album_type;
    const keep = albumType === 'album' || isLikelyEp(item);

    if (!keep) {
      continue;
    }

    const key = `${item.name}::${item.release_date}`.toLowerCase();

    if (!unique.has(key)) {
      unique.set(key, {
        id: item.id,
        name: item.name,
        release_date: item.release_date,
        type: albumType === 'album' ? 'album' : 'ep',
        total_tracks: item.total_tracks,
        image: item.images?.[0]?.url || null,
        url: item.external_urls?.spotify || null
      });
    }
  }

  return Array.from(unique.values()).sort((a, b) =>
    b.release_date.localeCompare(a.release_date)
  );
}

async function main() {
  const token = await getAccessToken();
  const rawItems = await getAllArtistReleases(token);
  const items = normalizeReleases(rawItems);

  const output = {
    generated_at: new Date().toISOString(),
    artist_id: normalizedArtistId,
    items
  };

  await writeFile('data/fakemink-releases.json', `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  console.log(`Wrote ${items.length} releases to data/fakemink-releases.json`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
