async function loadReleases() {
  const list = document.getElementById('albums-list');

  try {
    const response = await fetch('./data/fakemink-releases.json', { cache: 'no-store' });

    if (!response.ok) {
      throw new Error(`Could not load release data (${response.status})`);
    }

    const payload = await response.json();
    const releases = payload.items || [];

    list.innerHTML = '';

    if (releases.length === 0) {
      const li = document.createElement('li');
      li.textContent = 'No releases available yet.';
      list.appendChild(li);
      return;
    }

    releases.forEach((item) => {
      const li = document.createElement('li');
      const a = document.createElement('a');

      a.href = item.url || '#';
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = item.name;

      li.appendChild(a);
      li.append(` (${item.release_date}, ${item.type})`);
      list.appendChild(li);
    });
  } catch (error) {
    list.innerHTML = '';
    const li = document.createElement('li');
    li.textContent = 'Failed to load releases data.';
    list.appendChild(li);
    console.error(error);
  }
}

loadReleases();