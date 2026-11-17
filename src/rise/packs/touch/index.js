import './touch.css';

/**
 * Touch pack: virtual joystick for phones and tablets.
 * Turns on automatically on touch devices; force it with `app.use(touchPlugin, { force: true })`.
 *
 *   app.use(touchPlugin);
 */
export function touchPlugin(app, options = {}) {
  const hasTouch =
    typeof window !== 'undefined' &&
    ('ontouchstart' in window || (navigator.maxTouchPoints || 0) > 0);
  if (!hasTouch && !options.force) return null;

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
  const input = app.input;
  const state = { x: 0, y: 0, lookX: 0, lookY: 0, jump: false, crouch: false };
  input.touch = state;

  const root = document.createElement('div');
  root.className = 'touch-ui';
  root.innerHTML = `
    <div class="touch-stick left"><i class="touch-knob"></i></div>
    <div class="touch-stick right"><i class="touch-knob"></i></div>
    <div class="touch-actions">
      <button class="touch-btn crouch" data-act="crouch">C</button>
      <button class="touch-btn jump" data-act="jump">↑</button>
    </div>
  `;
  app.hud.root.appendChild(root);

  const sticks = [...root.querySelectorAll('.touch-stick')];
  const knobs = [...root.querySelectorAll('.touch-knob')];

  const reset = () => {
    state.x = 0;
    state.y = 0;
    state.lookX = 0;
    state.lookY = 0;
    state.jump = false;
    state.crouch = false;
    for (const k of knobs) k.style.transform = 'translate(0, 0)';
    for (const b of root.querySelectorAll('.touch-btn')) b.classList.remove('on');
  };

  sticks.forEach((stick, index) => {
    const knob = knobs[index];
    let active = null;
    let cx = 0;
    let cy = 0;
    const left = index === 0;

    const start = (e) => {
      active = e.pointerId;
      const r = stick.getBoundingClientRect();
      cx = r.left + r.width / 2;
      cy = r.top + r.height / 2;
      stick.setPointerCapture(e.pointerId);
      e.preventDefault();
    };

    const move = (e) => {
      if (active !== e.pointerId) return;
      const max = 42;
      let dx = (e.clientX - cx) / max;
      let dy = (e.clientY - cy) / max;
      const len = Math.hypot(dx, dy);
      if (len > 1) {
        dx /= len;
        dy /= len;
      }
      knob.style.transform = `translate(${dx * 34}px, ${dy * 34}px)`;
      if (left) {
        state.x = dx;
        state.y = dy;
      } else {
        state.lookX = dx;
        state.lookY = dy;
      }
      e.preventDefault();
    };

    const end = (e) => {
      if (active !== e.pointerId) return;
      active = null;
      knob.style.transform = 'translate(0, 0)';
      if (left) {
        state.x = 0;
        state.y = 0;
      } else {
        state.lookX = 0;
        state.lookY = 0;
      }
    };

    on(stick, 'pointerdown', start);
    on(stick, 'pointermove', move);
    on(stick, 'pointerup', end);
    on(stick, 'pointercancel', end);
  });

  for (const btn of root.querySelectorAll('.touch-btn')) {
    const act = btn.dataset.act;
    const set = (v) => () => {
      state[act] = v;
      btn.classList.toggle('on', v);
    };
    on(btn, 'pointerdown', (e) => {
      e.preventDefault();
      set(true)();
    });
    on(btn, 'pointerup', set(false));
    on(btn, 'pointercancel', set(false));
    on(btn, 'pointerleave', set(false));
  }

  const api = {
    state,
    reset,
    dispose() {
      runOffs();
      root.remove();
      if (input.touch === state) input.touch = null;
      if (app.touch === api) app.touch = null;
    },
  };
  app.touch = api;
  app.log?.('touch pack ready');

  // avoid a stuck joystick on orientation change, focus loss or tab hide
  on(window, 'orientationchange', reset);
  on(window, 'blur', reset);
  on(document, 'visibilitychange', () => {
    if (document.visibilityState === 'hidden') reset();
  });
  on(root, 'contextmenu', (e) => e.preventDefault());
  on(root, 'dblclick', (e) => e.preventDefault());

  return api;
}
