import { writeFile } from 'node:fs/promises';

const clientId = process.env.SPOTIFY_CLIENT_ID;
const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
const artistId = process.env.SPOTIFY_ARTIST_ID;

if (!clientId || !clientSecret || !artistId) {
  console.error('Missing required env vars: SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, SPOTIFY_ARTIST_ID');
  process.exit(1);
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
  let nextUrl = `https://api.spotify.com/v1/artists/${artistId}/albums?include_groups=album,single&limit=50`;
  const allItems = [];

  while (nextUrl) {
    const response = await fetch(nextUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    if (!response.ok) {
      const details = await response.text();
      throw new Error(`Albums request failed (${response.status}): ${details}`);
    }

    const data = await response.json();
    allItems.push(...(data.items || []));
    nextUrl = data.next;
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
    artist_id: artistId,
    items
  };

  await writeFile('data/fakemink-releases.json', `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  console.log(`Wrote ${items.length} releases to data/fakemink-releases.json`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
