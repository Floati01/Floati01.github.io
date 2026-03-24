let cachedToken = null;
let tokenExpiresAt = 0;

function parseAllowedOrigins(env) {
  const raw = env.ALLOWED_ORIGINS || env.ALLOWED_ORIGIN || '*';

  return String(raw)
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

function isLocalhostOrigin(origin) {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
}

function isOriginAllowed(origin, allowlist) {
  if (!origin) {
    return false;
  }

  if (allowlist.includes('*')) {
    return true;
  }

  for (const allowed of allowlist) {
    if (allowed === origin) {
      return true;
    }

    if (allowed === 'localhost' && isLocalhostOrigin(origin)) {
      return true;
    }
  }

  return false;
}

function getCorsHeaders(origin, isAllowed) {
  const corsOrigin = isAllowed ? origin : 'null';

  return {
    'Access-Control-Allow-Origin': corsOrigin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json; charset=utf-8'
  };
}

function jsonResponse(body, status, corsHeaders) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: corsHeaders
  });
}

async function getAccessToken(env) {
  const now = Date.now();

  if (cachedToken && now < tokenExpiresAt - 15_000) {
    return cachedToken;
  }

  const basic = btoa(`${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`);
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Token request failed (${response.status}): ${details}`);
  }

  const payload = await response.json();
  cachedToken = payload.access_token;
  tokenExpiresAt = now + (payload.expires_in || 3600) * 1000;
  return cachedToken;
}

async function spotifyRequest(env, pathOrUrl) {
  const token = await getAccessToken(env);
  const isAbsolute = pathOrUrl.startsWith('https://');
  const url = isAbsolute ? pathOrUrl : `https://api.spotify.com/v1${pathOrUrl}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Spotify request failed (${response.status}) for ${url}: ${details}`);
  }

  return response.json();
}

async function getAllPages(env, initialPath) {
  const items = [];
  let next = initialPath;

  while (next) {
    const page = await spotifyRequest(env, next);
    items.push(...(page.items || []));
    next = page.next || null;
  }

  return items;
}

function parsePath(pathname) {
  const parts = pathname.split('/').filter(Boolean);

  if (parts.length >= 2 && parts[0] === 'api' && parts[1] === 'health') {
    return { type: 'health' };
  }

  if (parts.length >= 2 && parts[0] === 'api' && parts[1] === 'search') {
    return { type: 'search' };
  }

  if (parts.length >= 4 && parts[0] === 'api' && parts[1] === 'artist' && parts[3] === 'albums') {
    return { type: 'artistAlbums', artistId: parts[2] };
  }

  if (parts.length >= 4 && parts[0] === 'api' && parts[1] === 'album' && parts[3] === 'tracks') {
    return { type: 'albumTracks', albumId: parts[2] };
  }

  return { type: 'unknown' };
}

export default {
  async fetch(request, env) {
    const requestUrl = new URL(request.url);
    const requestOrigin = request.headers.get('Origin') || '';
    const allowlist = parseAllowedOrigins(env);
    const allowed = isOriginAllowed(requestOrigin, allowlist);
    const corsHeaders = getCorsHeaders(requestOrigin, allowed);

    if (request.method === 'OPTIONS') {
      if (!allowed) {
        return jsonResponse({ error: 'Origin not allowed' }, 403, corsHeaders);
      }
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (!allowed) {
      return jsonResponse({ error: 'Origin not allowed' }, 403, corsHeaders);
    }

    if (!env.SPOTIFY_CLIENT_ID || !env.SPOTIFY_CLIENT_SECRET) {
      return jsonResponse({ error: 'Missing SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET in Worker secrets' }, 500, corsHeaders);
    }

    try {
      const route = parsePath(requestUrl.pathname);

      if (route.type === 'health') {
        return jsonResponse({ ok: true, service: 'spotify-proxy-worker' }, 200, corsHeaders);
      }

      if (route.type === 'search') {
        const q = requestUrl.searchParams.get('q') || '';
        const limit = Math.min(20, Math.max(1, Number.parseInt(requestUrl.searchParams.get('limit') || '8', 10) || 8));

        if (!q.trim()) {
          return jsonResponse({ error: 'q query param is required' }, 400, corsHeaders);
        }

        const payload = await spotifyRequest(
          env,
          `/search?q=${encodeURIComponent(q)}&type=artist&limit=${limit}`
        );

        return jsonResponse({ items: payload.artists?.items || [] }, 200, corsHeaders);
      }

      if (route.type === 'artistAlbums') {
        const items = await getAllPages(
          env,
          `/artists/${route.artistId}/albums?include_groups=album,single,appears_on,compilation&market=from_token&limit=20`
        );

        return jsonResponse({ items }, 200, corsHeaders);
      }

      if (route.type === 'albumTracks') {
        const items = await getAllPages(env, `/albums/${route.albumId}/tracks?market=from_token&limit=50`);
        return jsonResponse({ items }, 200, corsHeaders);
      }

      return jsonResponse({ error: 'Route not found' }, 404, corsHeaders);
    } catch (error) {
      return jsonResponse({ error: String(error.message || error) }, 500, corsHeaders);
    }
  }
};
