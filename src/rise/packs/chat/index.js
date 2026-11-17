import './chat.css';
import { parseChat, RateLimiter } from './core.js';
import { maskWords, SpamGuard, IgnoreList, DEFAULT_BLOCKED } from './filter.js';

/**
 * Chat pack: zone, all and direct-message channels with rate limiting, a log and an input box.
 *
 *   app.use(chatPlugin);   // needs the net pack to send and receive
 *
 * Keys: T opens the input · Enter sends · Esc closes
 * Commands: /all <text> · /zone <text> · /w <name> <text>
 */
export function chatPlugin(app, { max = 5, window = 5000, blocked = DEFAULT_BLOCKED, mask = true } = {}) {
  const limiter = new RateLimiter({ max, window });
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
  const timers = new Set();
  const spam = new SpamGuard();
  const ignore = new IgnoreList();

  const el = document.createElement('div');
  el.className = 'chat off';
  el.innerHTML = `
    <div class="chat-log"></div>
    <input class="chat-input" maxlength="160" placeholder="Type a message… (/w name, /all)" />
  `;
  app.hud.root.appendChild(el);

  const log = el.querySelector('.chat-log');
  const input = el.querySelector('.chat-input');
  let open = false;

  const print = (text, cls = '') => {
    const line = document.createElement('div');
    line.className = 'chat-line ' + cls;
    line.textContent = text;
    log.appendChild(line);
    while (log.children.length > 10) log.firstChild.remove();
  };

  function toggle(v) {
    open = v;
    el.classList.toggle('off', !v);
    if (v) {
      const t = setTimeout(() => {
        timers.delete(t);
        input.focus();
      }, 0);
      timers.add(t);
    }
    else input.blur();
  }

  function send(raw) {
    const msg = parseChat(raw, { defaultChannel: 'zone' });
    if (!msg?.body) return;
    if (!limiter.try()) {
      print('You are sending too fast. Try again in a moment.', 'warn');
      return;
    }
    if (!spam.accept(msg.body)) {
      print('Please do not repeat the same message.', 'warn');
      return;
    }

    const body = mask ? maskWords(msg.body, blocked) : msg.body;
    const payload = { type: 'chat', channel: msg.channel, text: body };
    if (msg.channel === 'dm') payload.to = msg.to;

    if (app.net?.send) app.net.send(payload);
    else app.events.emit('chat:local', { name: 'You', text: body });

    if (msg.channel === 'dm') print(`[DM → ${msg.to}] ${body}`, 'dm');
    else print(`You: ${body}`);
  }

  on(input, 'keydown', (e) => {
    if (e.code === 'Enter') {
      send(input.value);
      input.value = '';
      toggle(false);
      e.stopImmediatePropagation();
    } else if (e.code === 'Escape') {
      input.value = '';
      toggle(false);
      e.stopImmediatePropagation();
    }
  });

  // the `window` option (ms) shadows the global window, so reach it through globalThis
  on(
    globalThis.window,
    'keydown',
    (e) => {
      if (!open && e.code === 'KeyT' && app.state.is('playing')) {
        e.preventDefault();
        e.stopImmediatePropagation();
        toggle(true);
        return;
      }
      if (open) e.stopImmediatePropagation();
    },
    true
  );

  offs.push(app.events.on('net:chat', (msg) => {
    if (ignore.has(msg.name)) return;
    const label = msg.channel === 'dm' ? `[DM] ${msg.name}` : msg.name || '?';
    print(`${label}: ${mask ? maskWords(msg.text, blocked) : msg.text}`, msg.channel || '');
    app.nameplates?.sayById?.(msg.from ?? msg.id, msg.text, 3);
    app.events.emit('chat:message', msg);
  }));

  const api = {
    open: () => toggle(true),
    close: () => toggle(false),
    send,
    print,
    ignore: (name) => ignore.add(name),
    unignore: (name) => ignore.remove(name),
    get ignored() {
      return ignore.list();
    },
    get isOpen() {
      return open;
    },
    dispose() {
      runOffs();
      timers.forEach(clearTimeout);
      timers.clear();
      el.remove();
      if (app.chat === api) app.chat = null;
    },
  };

  app.chat = api;
  return api;
}
