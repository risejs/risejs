import './menu.css';

const LABELS = {
  KeyW: 'W', KeyA: 'A', KeyS: 'S', KeyD: 'D', KeyE: 'E', KeyR: 'R', KeyV: 'V', KeyP: 'P',
  KeyQ: 'Q', KeyZ: 'Z', KeyC: 'C', KeyF: 'F', KeyJ: 'J', KeyX: 'X',
  ShiftLeft: 'Shift', ControlLeft: 'Ctrl', Space: 'Space', ArrowUp: '↑', ArrowDown: '↓',
  ArrowLeft: '←', ArrowRight: '→', Mouse0: 'LMB', Mouse2: 'RMB', F1: 'F1',
};

const ACTIONS = [
  ['forward', 'Forward'],
  ['back', 'Back'],
  ['left', 'Left'],
  ['right', 'Right'],
  ['run', 'Run'],
  ['jump', 'Jump'],
  ['crouch', 'Crouch'],
  ['view', 'Change camera'],
  ['interact', 'Interact'],
];

const SETTINGS_KEY = (id) => `rise.settings.${id}`;

/**
 * Pause menu and settings screen, built without a UI library.
 * Controlled with the mouse or the keyboard (↑↓ Enter Esc).
 */
export function createMenu({ app, root, config }) {
  const el = document.createElement('div');
  el.className = 'menu off';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.innerHTML = `
    <div class="menu-scrim"></div>
    <div class="menu-panel">
      <div class="menu-kicker">RISE</div>
      <h2 class="menu-title">PAUSED</h2>
      <div class="menu-body"></div>
      <div class="menu-foot">↑↓ SELECT · ENTER CONFIRM · ESC CLOSE</div>
    </div>
  `;
  root.appendChild(el);

  const titleEl = el.querySelector('.menu-title');
  const body = el.querySelector('.menu-body');
  const foot = el.querySelector('.menu-foot');
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
  const later = (fn, ms) => {
    const t = setTimeout(() => {
      timers.delete(t);
      fn();
    }, ms);
    timers.add(t);
  };

  let screen = 'main';
  let focus = 0;
  let listening = null; // [action, button]

  const settings = loadSettings();
  applySettings(settings);

  /* ---------------- settings persistence ---------------- */

  function loadSettings() {
    const base = {
      volume: config.audio?.volume ?? 0.45,
      sensitivity: config.input?.sensitivity ?? 0.0022,
      pixelRatio: config.render?.pixelRatioCap ?? 2,
      binds: {},
    };
    try {
      const raw = localStorage.getItem(SETTINGS_KEY(app.id));
      if (!raw) return base;
      const saved = JSON.parse(raw);
      return { ...base, ...saved, binds: { ...base.binds, ...(saved.binds || {}) } };
    } catch {
      return base;
    }
  }

  function saveSettings() {
    try {
      localStorage.setItem(SETTINGS_KEY(app.id), JSON.stringify(settings));
    } catch {
      /* ignore */
    }
  }

  function applySettings(s) {
    app.audio?.setVolume(s.volume);
    app.input.sensitivity = s.sensitivity;
    app.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, s.pixelRatio));

    for (const [action, codes] of Object.entries(s.binds)) {
      if (Array.isArray(codes) && codes.length) app.input.binds[action] = codes.slice();
    }
  }

  /* ---------------- render ---------------- */

  function button(label, act, extra = '') {
    return `<button class="menu-btn ${extra}" data-act="${act}">${label}</button>`;
  }

  function renderMain() {
    screen = 'main';
    titleEl.textContent = 'PAUSED';
    body.innerHTML = `
      ${button('RESUME', 'resume')}
      ${button('QUICK SAVE', 'save')}
      ${button('QUICK LOAD', 'load')}
      ${button('SETTINGS', 'settings')}
      ${button('RESTART', 'restart')}
    `;
    foot.textContent = '↑↓ SELECT · ENTER CONFIRM · ESC CLOSE';
    setFocus(0);
  }

  function renderSettings() {
    screen = 'settings';
    titleEl.textContent = 'SETTINGS';
    body.innerHTML = `
      <div class="menu-row">
        <label>Volume</label>
        <input type="range" min="0" max="1" step="0.05" value="${settings.volume}" data-set="volume">
        <b class="menu-val">${Math.round(settings.volume * 100)}%</b>
      </div>
      <div class="menu-row">
        <label>Mouse sensitivity</label>
        <input type="range" min="0.0005" max="0.006" step="0.0005" value="${settings.sensitivity}" data-set="sensitivity">
        <b class="menu-val">${settings.sensitivity.toFixed(4)}</b>
      </div>
      <div class="menu-row">
        <label>Resolution</label>
        <select data-set="pixelRatio">
          ${[0.75, 1, 1.5, 2].map((v) => `<option value="${v}" ${settings.pixelRatio === v ? 'selected' : ''}>${v}×</option>`).join('')}
        </select>
      </div>
      ${app.a11y ? `<div class="menu-sub">ACCESSIBILITY</div>
      <div class="menu-row">
        <label>Color blind mode</label>
        <select data-a11y="colorblind">
          ${['none', 'protanopia', 'deuteranopia', 'tritanopia']
            .map((v) => `<option value="${v}" ${app.a11y.settings.colorblind === v ? 'selected' : ''}>${v}</option>`)
            .join('')}
        </select>
      </div>
      <div class="menu-row">
        <label>UI scale</label>
        <select data-a11y="uiScale">
          ${[0.85, 1, 1.2, 1.4].map((v) => `<option value="${v}" ${app.a11y.settings.uiScale === v ? 'selected' : ''}>${v}×</option>`).join('')}
        </select>
      </div>
      <div class="menu-row">
        <label>Reduce motion</label>
        <select data-a11y="reduceMotion">
          <option value="0" ${!app.a11y.settings.reduceMotion ? 'selected' : ''}>off</option>
          <option value="1" ${app.a11y.settings.reduceMotion ? 'selected' : ''}>on</option>
        </select>
      </div>` : ''}
      <div class="menu-sub">KEYS</div>
      <div class="menu-keys">
        ${ACTIONS.map(([action, label]) => {
          const code = currentCode(action);
          return `<div class="menu-row">
            <label>${label}</label>
            <button class="menu-key" data-bind="${action}">${escapeHtml(LABELS[code] || code)}</button>
          </div>`;
        }).join('')}
      </div>
      <div class="menu-actions">
        ${button('BACK', 'back')}
      </div>
    `;
    foot.textContent = 'CLICK A KEY TO REBIND · ESC BACK';
    setFocus(0);
  }

  function currentCode(action) {
    return settings.binds[action]?.[0] || app.input.binds[action]?.[0] || '—';
  }

  /* ---------------- focus ---------------- */

  function focusables() {
    return [...body.querySelectorAll('button, select, input[type=range]')].filter((n) => !n.disabled);
  }

  function setFocus(i) {
    const list = focusables();
    if (!list.length) return;
    focus = (i + list.length) % list.length;
    list.forEach((n, idx) => n.classList.toggle('focused', idx === focus));
    list[focus].focus?.({ preventScroll: true });
  }

  function moveFocus(delta) {
    setFocus(focus + delta);
  }

  /* ---------------- open/close ---------------- */

  function open(which = 'main') {
    if (document.pointerLockElement) document.exitPointerLock();
    which === 'settings' ? renderSettings() : renderMain();
    el.classList.remove('off');
    app.setState('paused');
    app.hud.setPaused(true);
    later(() => setFocus(0), 0);
  }

  function close() {
    listening = null;
    el.classList.add('off');
    app.setState('playing');
    app.hud.setPaused(false);
    app.input.clear();
  }

  function toggle() {
    el.classList.contains('off') ? open('main') : close();
  }

  /* ---------------- gamepad ---------------- */

  const PAD = { A: 0, B: 1, UP: 12, DOWN: 13, START: 9 };
  let padRepeat = 0;

  offs.push(app.events.on('frame', (dt) => {
    const input = app.input;
    if (!input?.pad) return;

    const isOpen = !el.classList.contains('off');
    const pressed = input.padPressed || new Set();

    if (!isOpen) {
      if (pressed.has(PAD.START) && app.state.is('playing')) open('main');
      return;
    }

    padRepeat -= dt;
    const axisY = input.padAxes?.[1] ?? 0;
    const down = pressed.has(PAD.DOWN) || axisY > 0.6;
    const up = pressed.has(PAD.UP) || axisY < -0.6;

    if ((down || up) && padRepeat <= 0) {
      padRepeat = 0.18;
      const delta = down ? 1 : -1;
      const buttons = [...el.querySelectorAll('button')];
      const current = buttons.findIndex((b) => b === document.activeElement);
      const next = Math.max(0, Math.min(buttons.length - 1, (current < 0 ? 0 : current) + delta));
      buttons[next]?.focus();
    }

    if (pressed.has(PAD.A)) document.activeElement?.click?.();
    if (pressed.has(PAD.B)) close();
  }));

  /* ---------------- events ---------------- */

  on(el, 'click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const act = btn.dataset.act;
    const bind = btn.dataset.bind;

    if (bind) {
      startListening(bind, btn);
      return;
    }
    if (act === 'resume') close();
    else if (act === 'settings') renderSettings();
    else if (act === 'back') renderMain();
    else if (act === 'restart') location.reload();
    else if (act === 'save') {
      app.saveGame?.().then(() => {
        foot.textContent = 'SAVED';
        later(() => (foot.textContent = '↑↓ SELECT · ENTER CONFIRM · ESC CLOSE'), 1200);
      });
    } else if (act === 'load') {
      app.loadGame?.().then((data) => {
        foot.textContent = data ? 'LOADED' : 'NO SAVE FOUND';
        later(() => (foot.textContent = '↑↓ SELECT · ENTER CONFIRM · ESC CLOSE'), 1200);
      });
    }
  });

  on(el, 'input', (e) => {
    const a11yKey = e.target.dataset.a11y;
    if (a11yKey && app.a11y) {
      const raw = e.target.value;
      app.a11y.set({
        [a11yKey]: a11yKey === 'reduceMotion' ? raw === '1' : a11yKey === 'uiScale' ? Number(raw) : raw,
      });
      return;
    }

    const key = e.target.dataset.set;
    if (!key) return;
    const v = key === 'pixelRatio' ? Number(e.target.value) : Number(e.target.value);
    settings[key] = v;
    const label = e.target.parentElement.querySelector('.menu-val');
    if (label) label.textContent = key === 'volume' ? `${Math.round(v * 100)}%` : v.toFixed(4);
    applySettings(settings);
    saveSettings();
  });

  function startListening(action, btn) {
    listening = [action, btn];
    btn.textContent = '…';
    btn.classList.add('listening');
  }

  on(
    window,
    'keydown',
    (e) => {
      if (el.classList.contains('off')) return;

      if (listening) {
        e.preventDefault();
        e.stopPropagation();
        if (e.code === 'Escape') {
          const [action, btn] = listening;
          btn.textContent = LABELS[currentCode(action)] || currentCode(action);
          btn.classList.remove('listening');
          listening = null;
          return;
        }
        const [action, btn] = listening;
        const code = e.code.startsWith('Mouse') ? e.code : e.code;
        settings.binds[action] = [code];
        app.input.binds[action] = [code];
        btn.textContent = LABELS[code] || code;
        btn.classList.remove('listening');
        listening = null;
        saveSettings();
        return;
      }

      if (e.code === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        screen === 'settings' ? renderMain() : close();
        return;
      }
      if (e.code === 'ArrowUp' || e.code === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        moveFocus(e.code === 'ArrowUp' ? -1 : 1);
        return;
      }
      if (e.code === 'Enter' || e.code === 'Space') {
        const list = focusables();
        if (list[focus]) {
          e.preventDefault();
          e.stopPropagation();
          list[focus].click();
        }
      }
    },
    true
  );

  // Esc while playing: leaving pointer lock opens the menu (but not right after entering)
  let hadLock = false;
  on(document, 'pointerlockchange', () => {
    if (document.pointerLockElement) {
      hadLock = true;
      return;
    }
    if (hadLock && app.state.is('playing') && el.classList.contains('off')) {
      hadLock = false;
      open('main');
    }
  });

  return {
    root: el,
    open,
    close,
    toggle,
    renderMain,
    renderSettings,
    get isOpen() {
      return !el.classList.contains('off');
    },
    get screen() {
      return screen;
    },
    settings,
    dispose() {
      runOffs();
      timers.forEach(clearTimeout);
      timers.clear();
      el.remove();
    },
  };
}

export { LABELS, ACTIONS };

function escapeHtml(value) {
  return String(value).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}
