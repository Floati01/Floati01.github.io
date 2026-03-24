const PROXY_BASE_URL = 'https://spotify-artist-proxy.isakswiech.workers.dev';

const state = {
  startArtist: null,
  endArtist: null,
  currentArtist: null,
  path: [],
  albumCache: new Map(),
  tracksCache: new Map()
};

let elements = null;

function getRequiredElements() {
  const ids = {
    startQuery: 'start-artist-query',
    endQuery: 'end-artist-query',
    searchStartBtn: 'search-start-btn',
    searchEndBtn: 'search-end-btn',
    startJourneyBtn: 'start-journey-btn',
    resetBtn: 'reset-btn',
    status: 'status',
    journeyState: 'journey-state',
    selectionSummary: 'selection-summary',
    path: 'path',
    startResults: 'start-search-results',
    endResults: 'end-search-results',
    currentArtistLabel: 'current-artist-label',
    albumLabel: 'album-label',
    albumsList: 'albums-list',
    tracksList: 'tracks-list'
  };

  const mapped = {};

  for (const [key, id] of Object.entries(ids)) {
    const node = document.getElementById(id);
    if (!node) {
      throw new Error(`Missing required page element: #${id}`);
    }
    mapped[key] = node;
  }

  return mapped;
}

function showGlobalError(message) {
  const host = document.body || document.documentElement;
  const box = document.createElement('div');
  box.style.margin = '12px';
  box.style.padding = '10px';
  box.style.border = '1px solid #8f2d19';
  box.style.background = '#fff0ed';
  box.style.color = '#8f2d19';
  box.style.fontFamily = 'sans-serif';
  box.textContent = message;
  host.prepend(box);
}

function setStatus(message, type = 'ok') {
  elements.status.textContent = message;
  elements.status.className = `status ${type === 'error' ? 'error' : 'ok'}`;
}

function setJourneyState(message, type = 'ok') {
  elements.journeyState.textContent = message;
  elements.journeyState.className = `status ${type === 'error' ? 'error' : 'ok'}`;
}

function clearNode(node) {
  node.innerHTML = '';
}

function formatArtistMeta(artist) {
  const followers = artist.followers?.total;
  return followers ? `${artist.name} - ${followers.toLocaleString()} followers` : artist.name;
}

function buildProxyUrl(path, params = {}) {
  if (PROXY_BASE_URL.includes('your-worker-subdomain')) {
    throw new Error('Set PROXY_BASE_URL in main.js to your deployed Worker URL first.');
  }

  const url = new URL(`${PROXY_BASE_URL}${path}`);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      url.searchParams.set(key, String(value));
    }
  });

  return url.toString();
}

async function proxyRequest(path, params = {}) {
  const response = await fetch(buildProxyUrl(path, params));

  if (!response.ok) {
    let details = '';
    try {
      const payload = await response.json();
      details = payload?.error?.message || JSON.stringify(payload);
    } catch {
      details = await response.text();
    }

    throw new Error(`Proxy error ${response.status}: ${details}`);
  }

  return response.json();
}

async function searchArtists(query) {
  const data = await proxyRequest('/api/search', {
    q: query.trim(),
    limit: 8
  });
  return data.items || [];
}

function createArtistResultButton(artist, role) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'artist-choice';
  button.innerHTML = `${artist.name}<small>${formatArtistMeta(artist)}</small>`;
  button.addEventListener('click', () => {
    if (role === 'start') {
      state.startArtist = { id: artist.id, name: artist.name };
      setStatus(`Selected start artist: ${artist.name}`);
      clearNode(elements.startResults);
    } else {
      state.endArtist = { id: artist.id, name: artist.name };
      setStatus(`Selected end artist: ${artist.name}`);
      clearNode(elements.endResults);
    }

    renderSelectionSummary();
  });

  return button;
}

function renderSelectionSummary() {
  const parts = [];

  if (state.startArtist) {
    parts.push(`Start: ${state.startArtist.name}`);
  }

  if (state.endArtist) {
    parts.push(`End: ${state.endArtist.name}`);
  }

  elements.selectionSummary.textContent = parts.length ? parts.join(' | ') : 'No artists selected yet.';
}

async function handleSearch(role) {
  const queryInput = role === 'start' ? elements.startQuery : elements.endQuery;
  const resultsNode = role === 'start' ? elements.startResults : elements.endResults;
  const query = queryInput.value.trim();

  if (!query) {
    setStatus('Type an artist name before searching.', 'error');
    return;
  }

  try {
    setStatus(`Searching ${role} artist: ${query}`);
    const artists = await searchArtists(query);
    clearNode(resultsNode);

    if (!artists.length) {
      const p = document.createElement('p');
      p.className = 'empty';
      p.textContent = 'No artist results found.';
      resultsNode.appendChild(p);
      return;
    }

    artists.forEach((artist) => {
      resultsNode.appendChild(createArtistResultButton(artist, role));
    });
  } catch (error) {
    setStatus(error.message, 'error');
  }
}

function appendPathStep(artist) {
  const alreadyLast = state.path.length && state.path[state.path.length - 1].id === artist.id;
  if (!alreadyLast) {
    state.path.push({ id: artist.id, name: artist.name });
  }

  renderPath();
}

function renderPath() {
  clearNode(elements.path);

  if (!state.path.length) {
    elements.path.textContent = 'Journey path will appear here.';
    return;
  }

  state.path.forEach((artist) => {
    const span = document.createElement('span');
    span.className = 'pill';
    span.textContent = artist.name;
    elements.path.appendChild(span);
  });
}

async function getArtistAlbums(artistId) {
  if (state.albumCache.has(artistId)) {
    return state.albumCache.get(artistId);
  }

  const unique = new Map();
  const payload = await proxyRequest(`/api/artist/${artistId}/albums`);
  (payload.items || []).forEach((album) => {
    if (!unique.has(album.id)) {
      unique.set(album.id, album);
    }
  });

  const albums = Array.from(unique.values()).sort((a, b) =>
    (b.release_date || '').localeCompare(a.release_date || '')
  );

  state.albumCache.set(artistId, albums);
  return albums;
}

async function getAlbumTracks(albumId) {
  if (state.tracksCache.has(albumId)) {
    return state.tracksCache.get(albumId);
  }

  const payload = await proxyRequest(`/api/album/${albumId}/tracks`);
  const tracks = payload.items || [];

  state.tracksCache.set(albumId, tracks);
  return tracks;
}

function createFeatureArtistListButton(featureArtist) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'artist-choice';
  button.innerHTML = `${featureArtist.name}<small>${featureArtist.appearances} feature appearances</small>`;

  button.addEventListener('click', async () => {
    try {
      setStatus(`Loading featured artists for ${featureArtist.name}...`);
      state.currentArtist = { id: featureArtist.id, name: featureArtist.name };
      appendPathStep(state.currentArtist);
      markReachedTargetIfNeeded();
      await showDiscographyForCurrentArtist();
      setStatus('Loaded featured artists. Click another artist to continue the journey.');
    } catch (error) {
      setStatus(error.message || 'Failed to load featured artists.', 'error');
    }
  });

  return button;
}

function markReachedTargetIfNeeded() {
  if (!state.currentArtist || !state.endArtist) {
    return;
  }

  if (state.currentArtist.id === state.endArtist.id) {
    setJourneyState(`Reached target artist: ${state.endArtist.name}`);
  } else {
    setJourneyState(`Current artist: ${state.currentArtist.name} | Target: ${state.endArtist.name}`);
  }
}

async function showDiscographyForCurrentArtist() {
  if (!state.currentArtist) {
    return;
  }

  elements.currentArtistLabel.textContent = `${state.currentArtist.name} featured artists across discography`;
  clearNode(elements.albumsList);
  clearNode(elements.tracksList);
  elements.albumLabel.textContent = 'Summary';

  const albums = await getArtistAlbums(state.currentArtist.id);

  if (!albums.length) {
    const li = document.createElement('li');
    li.innerHTML = '<p class="empty">No releases returned for this artist.</p>';
    elements.albumsList.appendChild(li);
    const info = document.createElement('li');
    info.innerHTML = '<p class="empty">No summary available.</p>';
    elements.tracksList.appendChild(info);
    return;
  }

  const featureMap = new Map();

  for (const album of albums) {
    const tracks = await getAlbumTracks(album.id);

    for (const track of tracks) {
      for (const artist of track.artists || []) {
        if (!artist?.id || artist.id === state.currentArtist.id) {
          continue;
        }

        if (!featureMap.has(artist.id)) {
          featureMap.set(artist.id, {
            id: artist.id,
            name: artist.name,
            appearances: 0
          });
        }

        featureMap.get(artist.id).appearances += 1;
      }
    }
  }

  const featuredArtists = Array.from(featureMap.values()).sort((a, b) => {
    if (b.appearances !== a.appearances) {
      return b.appearances - a.appearances;
    }
    return a.name.localeCompare(b.name);
  });

  if (!featuredArtists.length) {
    const li = document.createElement('li');
    li.innerHTML = '<p class="empty">No featured artists found across this discography.</p>';
    elements.albumsList.appendChild(li);
  } else {
    featuredArtists.forEach((artist) => {
      const li = document.createElement('li');
      li.appendChild(createFeatureArtistListButton(artist));
      elements.albumsList.appendChild(li);
    });
  }

  const summaryItems = [
    `Releases scanned: ${albums.length}`,
    `Unique featured artists: ${featuredArtists.length}`
  ];

  summaryItems.forEach((text) => {
    const li = document.createElement('li');
    li.textContent = text;
    elements.tracksList.appendChild(li);
  });
}

async function startJourney() {
  if (!state.startArtist || !state.endArtist) {
    setStatus('Select both start and end artists first.', 'error');
    return;
  }

  try {
    setStatus('Loading discography...');
    state.currentArtist = { ...state.startArtist };
    state.path = [{ ...state.startArtist }];
    renderPath();
    markReachedTargetIfNeeded();
    await showDiscographyForCurrentArtist();
    setStatus('Journey started. Click a featured artist to continue through the graph.');
  } catch (error) {
    setStatus(error.message || 'Failed to load discography.', 'error');
  }
}

function resetAll() {
  state.startArtist = null;
  state.endArtist = null;
  state.currentArtist = null;
  state.path = [];
  state.albumCache.clear();
  state.tracksCache.clear();

  elements.startQuery.value = '';
  elements.endQuery.value = '';
  clearNode(elements.startResults);
  clearNode(elements.endResults);
  clearNode(elements.albumsList);
  clearNode(elements.tracksList);
  elements.currentArtistLabel.textContent = 'Select start and end artists, then click Start Journey.';
  elements.albumLabel.textContent = 'Summary';
  elements.status.textContent = '';
  elements.journeyState.textContent = '';
  renderSelectionSummary();
  renderPath();
}

function initApp() {
  elements = getRequiredElements();

  elements.searchStartBtn.addEventListener('click', () => handleSearch('start'));
  elements.searchEndBtn.addEventListener('click', () => handleSearch('end'));
  elements.startJourneyBtn.addEventListener('click', startJourney);
  elements.resetBtn.addEventListener('click', resetAll);

  elements.startQuery.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      handleSearch('start');
    }
  });

  elements.endQuery.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      handleSearch('end');
    }
  });

  renderSelectionSummary();
  renderPath();
  setStatus('Ready. Search for start and end artists.');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    try {
      initApp();
    } catch (error) {
      showGlobalError(`App failed to initialize: ${error.message}`);
      console.error(error);
    }
  });
} else {
  try {
    initApp();
  } catch (error) {
    showGlobalError(`App failed to initialize: ${error.message}`);
    console.error(error);
  }
}