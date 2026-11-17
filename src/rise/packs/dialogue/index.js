import './dialogue.css';

/**
 * Dialogue pack: branching dialogue, independent of the quest pack.
 *
 *   app.use(dialoguePlugin);
 *   app.dialogue.start({ intro: { speaker, text, choices: [...] } }, 'intro');
 *
 * Keys 1–9 choose, Esc closes. The existing `app.dialogue` API is unchanged.
 */
export function createDialogue(app) {
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
  el.className = 'pkg-dlg off';
  el.innerHTML = `
    <div class="pkg-dlg-box">
      <div class="pkg-dlg-speaker"></div>
      <div class="pkg-dlg-text"></div>
      <div class="pkg-dlg-choices"></div>
      <div class="pkg-dlg-foot">1–9 CHOOSE · ESC CLOSE</div>
    </div>
  `;
  app.hud.root.appendChild(el);

  const speakerEl = el.querySelector('.pkg-dlg-speaker');
  const textEl = el.querySelector('.pkg-dlg-text');
  const choicesEl = el.querySelector('.pkg-dlg-choices');

  let graph = null;
  let node = null;
  let prevState = 'playing';

  function render(nodeId) {
    node = graph?.[nodeId];
    if (!node) return end();

    speakerEl.textContent = node.speaker || '';
    textEl.textContent = node.text || '';
    choicesEl.innerHTML = (node.choices || [])
      .map((c, i) => `<button data-i="${i}">${i + 1} · ${escapeHtml(c.label)}</button>`)
      .join('');
    if (!node.choices?.length) choicesEl.innerHTML = '<button data-i="0">1 · Continue</button>';
  }

  function choose(i) {
    if (!node) return;
    const choice = node.choices?.[i];
    if (!choice) {
      if (!node.choices?.length) return end();
      return;
    }
    choice.action?.(app);
    if (choice.next) render(choice.next);
    else end();
  }

  function start(nextGraph, nodeId = 'intro') {
    graph = nextGraph;
    prevState = app.state.is('paused') ? 'paused' : 'playing';
    if (document.pointerLockElement) document.exitPointerLock();
    el.classList.remove('off');
    app.setState('dialogue');
    app.events.emit('dialogue:start');
    render(nodeId);
  }

  function end() {
    el.classList.add('off');
    graph = null;
    node = null;
    app.setState(prevState === 'paused' ? 'paused' : 'playing');
    app.hud.setPaused(prevState === 'paused');
    app.events.emit('dialogue:end');
  }

  on(choicesEl, 'click', (e) => {
    const btn = e.target.closest('button');
    if (btn) choose(Number(btn.dataset.i));
  });

  on(
    window,
    'keydown',
    (e) => {
      if (el.classList.contains('off')) return;
      if (e.code === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        return end();
      }
      const n = Number(e.key);
      if (n >= 1 && n <= 9) {
        e.preventDefault();
        e.stopPropagation();
        choose(n - 1);
      }
    },
    true
  );

  return {
    start,
    end,
    choose,
    get isOpen() {
      return !el.classList.contains('off');
    },
    dispose() {
      runOffs();
      el.remove();
    },
  };
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}

export function dialoguePlugin(app) {
  const api = createDialogue(app);
  const inner = api.dispose;
  api.dispose = () => {
    inner();
    if (app.dialogue === api) app.dialogue = null;
  };
  app.dialogue = api;
  return api;
}
