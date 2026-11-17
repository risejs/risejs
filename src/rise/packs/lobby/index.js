import './lobby.css';
import { pickRoom, formatRooms } from './core.js';
export { pickRoom, formatRooms };

/**
 * Lobby pack: room list and quick match.
 *
 *   app.use(lobbyPlugin, { url: 'http://127.0.0.1:8787' });
 *   await app.lobby.quickMatch();   // → room name or null
 */
export function lobbyPlugin(app, { url = '' } = {}) {
  const offs = [];
  const on = (t, type, fn, o) => {
    t.addEventListener(type, fn, o);
    offs.push(() => t.removeEventListener(type, fn, o));
  };
  const runOffs = () => {
    while (offs.length) {
      try {
        offs.pop()();
      } catch {}
    }
  };
  const ac = typeof AbortController === 'function' ? new AbortController() : null;
  const el = document.createElement('div');
  el.className = 'lobby off';
  el.innerHTML = `
    <div class="lobby-head"><b>ROOMS</b><span class="lobby-count">—</span></div>
    <div class="lobby-list">—</div>
    <div class="lobby-foot">L — close · Q — quick match</div>
  `;
  app.hud.root.appendChild(el);

  const listEl = el.querySelector('.lobby-list');
  const countEl = el.querySelector('.lobby-count');
  let open = false;

  async function refresh() {
    try {
      const res = await fetch(`${url}/api/rooms`, ac ? { signal: ac.signal } : undefined);
      if (!res.ok) throw new Error(`rooms ${res.status}`);
      const data = await res.json();
      listEl.textContent = formatRooms(data);
      countEl.textContent = `${data.open ?? 0} open · ${data.total ?? 0} players`;
      return data;
    } catch {
      listEl.textContent = 'Could not reach the server.';
      countEl.textContent = '—';
      return null;
    }
  }

  async function quickMatch({ maxPlayers = 16 } = {}) {
    const data = await refresh();
    const room = pickRoom(data?.rooms || [], { maxPlayers });
    if (room) app.events.emit('lobby:join', { room });
    return room;
  }

  on(
    window,
    'keydown',
    (e) => {
      if (!app.state.is('playing')) return;
      if (e.code === 'KeyL') {
        e.preventDefault();
        open = !open;
        el.classList.toggle('off', !open);
        if (open) refresh();
      } else if (e.code === 'KeyQ' && open) {
        quickMatch();
      }
    },
    true
  );

  const api = {
    refresh,
    quickMatch,
    pickRoom,
    get isOpen() {
      return open;
    },
    dispose() {
      runOffs();
      ac?.abort();
      el.remove();
      if (app.lobby === api) app.lobby = null;
    },
  };
  app.lobby = api;
  return api;
}
