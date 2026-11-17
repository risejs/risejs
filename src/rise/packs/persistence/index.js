/**
 * Persistence pack: saves over HTTP (D1) instead of localStorage.
 *
 *   app.use(persistencePlugin, { base: 'http://127.0.0.1:8787', game: 'city', player: 'p1' });
 *   await app.remote.auth();
 *   await app.remote.write({ score: 10 });
 *   const { data } = await app.remote.read();
 */
export class RemoteSave {
  constructor({ base, game, player }) {
    this.base = base.replace(/\/$/, '');
    this.game = game;
    this.player = player;
    this.token = null;
  }

  _headers() {
    const h = { 'content-type': 'application/json' };
    if (this.token) h.authorization = `Bearer ${this.token}`;
    return h;
  }

  async auth() {
    const res = await fetch(`${this.base}/api/auth`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ player: this.player }),
    });
    if (!res.ok) throw new Error('auth failed: ' + res.status);
    const data = await res.json();
    this.token = data.token;
    return data;
  }

  async read() {
    const res = await fetch(`${this.base}/api/save/${this.game}/${this.player}`, { headers: this._headers() });
    if (res.status === 401) throw new Error('unauthorized');
    if (!res.ok) throw new Error('read failed: ' + res.status);
    return res.json();
  }

  async write(data) {
    const res = await fetch(`${this.base}/api/save/${this.game}/${this.player}`, {
      method: 'PUT',
      headers: this._headers(),
      body: JSON.stringify({ data }),
    });
    if (res.status === 401) throw new Error('unauthorized');
    if (!res.ok) throw new Error('write failed: ' + res.status);
    return res.json();
  }

  async event(type, payload = {}) {
    await fetch(`${this.base}/api/events`, {
      method: 'POST',
      headers: this._headers(),
      body: JSON.stringify({ game: this.game, player: this.player, type, payload }),
    }).catch(() => {});
  }

  // KV: fast session/cache storage (stands in for Redis in simple use cases)
  async kvSet(key, value, ttlSeconds) {
    const qs = ttlSeconds ? `?ttl=${ttlSeconds}` : '';
    const res = await fetch(`${this.base}/api/kv/${encodeURIComponent(key)}${qs}`, {
      method: 'PUT',
      headers: this._headers(),
      body: typeof value === 'string' ? value : JSON.stringify(value),
    });
    if (!res.ok) throw new Error('kvSet failed: ' + res.status);
    return res.json();
  }

  async kvGet(key) {
    const res = await fetch(`${this.base}/api/kv/${encodeURIComponent(key)}`, { headers: this._headers() });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error('kvGet failed: ' + res.status);
    const body = await res.json();
    try {
      return JSON.parse(body.value);
    } catch {
      return body.value;
    }
  }

  async kvDel(key) {
    await fetch(`${this.base}/api/kv/${encodeURIComponent(key)}`, {
      method: 'DELETE',
      headers: this._headers(),
    });
  }
}

export function persistencePlugin(app, { base, game, player }) {
  const remote = new RemoteSave({ base, game: game ?? app.id, player: player ?? 'anon' });
  remote.dispose = () => {
    if (app.remote === remote) app.remote = null;
  };
  app.remote = remote;
  return remote;
}
