import './vn.css';
import { Typewriter, paginate, normalizeNode, EXPRESSIONS } from './core.js';
export { Typewriter, paginate, normalizeNode, EXPRESSIONS };

/**
 * VN pack: visual novel with typewriter text, backlog, auto, skip, portraits and choices.
 *
 *   app.use(vnPlugin);
 *   app.vn.start({ start: 'a', nodes: { a: { speaker: 'MARA', text: '...', next: 'b' } } });
 *
 * Keys: Space/Enter advance · 1–9 choose · B backlog · A auto · Ctrl skip · Esc close
 */
export function vnPlugin(app, { speed = 45, cpsFast = 4 } = {}) {
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
  const el = document.createElement('div');
  el.className = 'vn off';
  el.innerHTML = `
    <div class="vn-portrait off"><span class="vn-face">?</span><i class="vn-expr">neutral</i></div>
    <div class="vn-box">
      <div class="vn-name"></div>
      <div class="vn-text"></div>
      <div class="vn-choices"></div>
      <div class="vn-foot"><span class="vn-hint">SPACE advance · B backlog · A auto · CTRL skip</span><span class="vn-count"></span></div>
    </div>
    <div class="vn-backlog off"><b>BACKLOG</b><div class="vn-log"></div></div>
  `;
  app.hud.root.appendChild(el);

  const box = el.querySelector('.vn-box');
  const nameEl = el.querySelector('.vn-name');
  const textEl = el.querySelector('.vn-text');
  const choicesEl = el.querySelector('.vn-choices');
  const portraitEl = el.querySelector('.vn-portrait');
  const faceEl = el.querySelector('.vn-face');
  const exprEl = el.querySelector('.vn-expr');
  const countEl = el.querySelector('.vn-count');
  const backlogEl = el.querySelector('.vn-backlog');
  const logEl = el.querySelector('.vn-log');

  const type = new Typewriter('', { speed });
  let script = null;
  let node = null;
  let pages = [];
  let page = 0;
  let auto = false;
  let autoTimer = 0;
  let skipping = false;
  const backlog = [];

  function show(nextId) {
    if (!script) return;
    if (nextId === null || nextId === undefined) return close();

    const raw = script.nodes?.[nextId];
    if (!raw) return close();

    node = normalizeNode({ id: nextId, ...raw });
    pages = paginate(node.text, 240);
    page = 0;

    if (node.speaker) nameEl.textContent = node.speaker;
    nameEl.style.display = node.speaker ? 'block' : 'none';

    if (node.portrait) {
      portraitEl.classList.remove('off');
      faceEl.textContent = node.portrait;
      exprEl.textContent = node.expression;
      portraitEl.dataset.expr = node.expression;
    } else {
      portraitEl.classList.add('off');
    }

    renderPage();
    backlog.push({ speaker: node.speaker, text: node.text });
    renderLog();
    app.events.emit('vn:node', node);
  }

  function renderPage() {
    const text = pages[page] || '';
    type.setText(text);
    type.speed = skipping ? speed * cpsFast : speed;
    textEl.textContent = '';
    countEl.textContent = pages.length > 1 ? `${page + 1}/${pages.length}` : '';
    choicesEl.innerHTML = '';
  }

  function renderChoices() {
    if (!node) return;
    if (page < pages.length - 1) return;

    const list = node.choices || [];
    choicesEl.innerHTML = list
      .map((c, i) => `<button class="vn-choice" data-i="${i}"><b>${i + 1}</b>${escapeHtml(c.label || `Choice ${i + 1}`)}</button>`)
      .join('');

    for (const btn of choicesEl.querySelectorAll('.vn-choice')) {
      btn.addEventListener('click', () => choose(Number(btn.dataset.i)));
    }
  }

  function choose(i) {
    const c = node?.choices?.[i];
    if (!c) return;
    app.events.emit('vn:choice', { node, choice: c });
    if (typeof c.action === 'function') c.action(app);
    const nextId = typeof c.next === 'function' ? c.next(app) : c.next;
    if (nextId === null || nextId === undefined) close();
    else show(nextId);
  }

  function advance() {
    if (!node) return;

    if (!type.done) {
      type.skip();
      return;
    }
    if (page < pages.length - 1) {
      page++;
      renderPage();
      return;
    }
    if ((node.choices || []).length) return; // wait for a choice

    if (node.next) show(node.next);
    else close();
  }

  function renderLog() {
    logEl.innerHTML = backlog
      .slice(-40)
      .map((l) => `<div class="vn-log-line">${l.speaker ? `<b>${escapeHtml(l.speaker)}</b>` : ''}<span>${escapeHtml(l.text)}</span></div>`)
      .join('');
    logEl.scrollTop = logEl.scrollHeight;
  }

  function close() {
    el.classList.add('off');
    app.state.set('playing');
    app.events.emit('vn:end', { script });
    script = null;
    node = null;
  }

  offs.push(app.events.on('frame', (dt) => {
    if (!script || !node) return;

    type.update(dt);
    textEl.textContent = type.render();

    if (type.done && !choicesEl.children.length) renderChoices();
    if (!type.done) return;

    if (skipping) {
      autoTimer += dt;
      if (autoTimer > 0.12) {
        autoTimer = 0;
        advance();
      }
    } else if (auto) {
      autoTimer += dt;
      if (autoTimer > (node.auto || 1.6)) {
        autoTimer = 0;
        advance();
      }
    }
  }));

  on(
    window,
    'keydown',
    (e) => {
      if (!script) return;
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        advance();
      } else if (e.code === 'KeyB') {
        backlogEl.classList.toggle('off');
      } else if (e.code === 'KeyA') {
        auto = !auto;
        autoTimer = 0;
        el.classList.toggle('auto', auto);
      } else if (e.code === 'ControlLeft' || e.code === 'ControlRight') {
        skipping = true;
      } else if (e.code === 'Escape') {
        close();
      } else if (/^Digit[1-9]$/.test(e.code)) {
        choose(Number(e.code.slice(5)) - 1);
      }
    },
    true
  );

  on(window, 'keyup', (e) => {
    if (e.code === 'ControlLeft' || e.code === 'ControlRight') skipping = false;
  });

  const api = {
    start(nextScript, { at = null } = {}) {
      script = nextScript;
      backlog.length = 0;
      el.classList.remove('off');
      app.state.set('paused');
      show(at || nextScript.start || Object.keys(nextScript.nodes || {})[0]);
      return api;
    },
    advance,
    choose,
    close,
    get isOpen() {
      return !!script;
    },
    get node() {
      return node;
    },
    dispose() {
      runOffs();
      script = node = null;
      el.remove();
      if (app.vn === api) app.vn = null;
    },
  };

  app.vn = api;
  return api;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}
