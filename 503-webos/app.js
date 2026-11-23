'use strict';

const BASE = 'http://192.168.1.150';
const POLL_INTERVAL = 5000;

const ZONES = ['cozinha', 'sala', 'quarto', 'banheiro', 'escritorio'];

const state = {
  zones: Object.fromEntries(ZONES.map(z => [z, false])),
  reachable: true,
};

// ── DOM refs ──────────────────────────────────────────────────────────────────

const statusDot = document.getElementById('status-dot');
const zoneEls = Object.fromEntries(
  ZONES.map(z => [z, document.getElementById('zone-' + z)])
);

// ── Render ─────────────────────────────────────────────────────────��──────────

function render() {
  statusDot.classList.toggle('unreachable', !state.reachable);

  for (const zone of ZONES) {
    const el = zoneEls[zone];
    const on = state.zones[zone];
    el.classList.toggle('on', on);
    el.querySelector('.zone-icon').textContent = on ? '🔊' : '🔇';
  }
}

// ── Network ───────────────────────────────────────────────────────────────────

async function fetchZones() {
  try {
    const res = await fetch(BASE + '/zones');
    if (!res.ok) throw new Error('bad status');
    const data = await res.json();
    for (const zone of ZONES) {
      if (typeof data[zone] === 'boolean') state.zones[zone] = data[zone];
    }
    state.reachable = true;
  } catch {
    state.reachable = false;
  }
  render();
}

async function post(path) {
  try {
    await fetch(BASE + path, { method: 'POST' });
  } catch {
    // ignore; next poll will sync state
  }
}

// ── Actions ───────────────────────────────────────────────────────────────────

const app = {
  async toggleZone(zone) {
    const on = state.zones[zone];
    await post('/zones/' + zone + (on ? '/off' : '/on'));
    state.zones[zone] = !on; // optimistic update
    render();
    await fetchZones();       // sync with server
  },

  async power()      { await post('/power'); },
  async input()      { await post('/input'); },
  async volumeUp()   { await post('/volume/up'); },
  async volumeDown() { await post('/volume/down'); },
};

// ── Zone button click handlers ────────────────────────────────────────────────

for (const zone of ZONES) {
  zoneEls[zone].addEventListener('click', () => app.toggleZone(zone));
}

// ── WebOS remote / TV key handling ───────────────────────────────────────────
// LG Magic Remote and standard remotes emit DOM key events.

document.addEventListener('keydown', (e) => {
  switch (e.keyCode) {
    case 461: // BACK
    case 27:  // ESC — exit app via webOS bridge if available
      if (window.webOS && webOS.platformBack) webOS.platformBack();
      break;
    // Red/Green/Yellow/Blue keys (F1–F4 or color codes)
    case 403: app.power();      break; // Red
    case 404: app.input();      break; // Green
    case 405: app.volumeDown(); break; // Yellow
    case 406: app.volumeUp();   break; // Blue
  }
});

// ── Startup ───────────────────────────────────────────────────────────────────

fetchZones();
setInterval(fetchZones, POLL_INTERVAL);
