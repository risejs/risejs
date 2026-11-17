import './fmv.css';
import { Timeline, QTE, BranchGraph } from './core.js';

/**
 * FMV pack: video scenes with subtitles, choices and quick-time events.
 *
 *   app.use(fmvPlugin, { scenes, start: 'intro', onEnd });
 *   app.fmv.play('intro');
 *
 * Scene: { title, text, duration, bg, video?, subs:[{t,text}],
 *          choices:[{at,label,next}], qte:{at,window,key,next,fail}, next }
 */
export function fmvPlugin(app, { scenes = {}, start = null, onEnd = null } = {}) {
  const graph = new BranchGraph(scenes, start);
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

  const root = document.createElement('div');
  root.className = 'fmv';
  root.innerHTML = `
    <div class="fmv-bg"></div>
    <div class="fmv-title"></div>
    <div class="fmv-text"></div>
    <div class="fmv-sub"></div>
    <div class="fmv-choices"></div>
    <div class="fmv-qte off"><b></b><span></span></div>
    <div class="fmv-foot">SPACE / CLICK · ESC EXIT</div>
  `;
  app.hud.root.appendChild(root);

  const bg = root.querySelector('.fmv-bg');
  const titleEl = root.querySelector('.fmv-title');
  const textEl = root.querySelector('.fmv-text');
  const subEl = root.querySelector('.fmv-sub');
  const choicesEl = root.querySelector('.fmv-choices');
  const qteEl = root.querySelector('.fmv-qte');

  let node = null;
  let timeline = null;
  let qte = null;
  let paused = false;
  let ended = false;

  function renderNode(n) {
    node = n;
    if (!node) return finish();

    timeline = new Timeline(node.subs?.map((s) => ({ t: s.t, text: s.text })) || []);
    qte = node.qte ? new QTE(node.qte) : null;
    paused = false;

    root.style.display = 'block';
    titleEl.textContent = node.title || '';
    textEl.textContent = node.text || '';
    subEl.textContent = '';
    choicesEl.innerHTML = '';
    qteEl.classList.add('off');

    bg.style.background = node.bg || 'var(--rise-background)';
    bg.classList.toggle('video', !!node.video);
    if (node.video) bg.style.backgroundImage = `url(${node.video})`;
  }

  function finish() {
    if (ended) return;
    ended = true;
    root.style.display = 'none';
    onEnd?.();
    app.events.emit('fmv:end', { id: graph.id });
  }

  function showChoices(list) {
    paused = true;
    choicesEl.innerHTML = list.map((c, i) => `<button data-i="${i}">${i + 1} · ${escapeHtml(c.label)}</button>`).join('');
  }

  on(choicesEl, 'click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const next = graph.choose(Number(btn.dataset.i));
    choicesEl.innerHTML = '';
    paused = false;
    renderNode(next);
  });

  function chooseIndex(i) {
    const next = graph.choose(i);
    choicesEl.innerHTML = '';
    paused = false;
    renderNode(next);
  }

  on(
    window,
    'keydown',
    (e) => {
      if (ended || !node) return;
      if (e.code === 'Escape') {
        e.preventDefault();
        return finish();
      }
      if (qte) {
        if (qte.state === 'open' && qte.press(e.code)) {
          e.preventDefault();
          const next = graph.go(node.qte.next);
          renderNode(next);
          return;
        }
      }
      if (paused) {
        const n = Number(e.key);
        if (n >= 1 && n <= 9) {
          e.preventDefault();
          chooseIndex(n - 1);
        }
        return;
      }
      if (e.code === 'Space') {
        e.preventDefault();
        const next = graph.go(node.next);
        renderNode(next);
      }
    },
    true
  );

  on(root, 'click', () => {
    if (ended || !node || paused) return;
    const next = graph.go(node.next);
    renderNode(next);
  });

  function update(dt) {
    if (!node || ended) return;

    if (paused) return;

    if (qte) {
      const state = qte.update(dt);
      qteEl.classList.toggle('off', state !== 'open');
      if (state === 'open') {
        qteEl.querySelector('b').textContent = node.qte.key.replace('Key', '');
        qteEl.querySelector('span').textContent = 'PRESS NOW';
      }
      if (state === 'miss') {
        const next = graph.go(node.qte.fail);
        renderNode(next);
        return;
      }
    }

    for (const cue of timeline.update(dt)) {
      if (cue.text) subEl.textContent = cue.text;
    }

    for (const c of node.choices || []) {
      if (!c._shown && timeline.time >= (c.at ?? 0)) {
        c._shown = true;
        showChoices(node.choices);
        break;
      }
    }

    if (timeline.time >= (node.duration ?? 6)) {
      const next = graph.go(node.next);
      renderNode(next);
    }
  }

  offs.push(app.events.on('frame', update));

  const api = {
    play(id) {
      ended = false;
      renderNode(graph.go(id));
    },
    stop: finish,
    get node() {
      return graph.current();
    },
    get graph() {
      return graph;
    },
    get paused() {
      return paused;
    },
    choose: chooseIndex,
    dispose() {
      runOffs();
      ended = true;
      root.remove();
      if (app.fmv === api) app.fmv = null;
    },
  };

  app.fmv = api;
  if (start) api.play(start);
  return api;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}
