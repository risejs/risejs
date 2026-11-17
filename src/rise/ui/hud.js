import { effect } from '../reactive.js';

/**
 * HUD frame: crosshair, objective, badge, stats, hint.
 * Every part can be switched on or off through config.hud; the game only supplies the text.
 */
export function createHud(root, cfg = {}) {
  const c = cfg.crosshair || {};
  const objective = cfg.objective || {};

  root.innerHTML = `
    <div class="xh ${c.enabled === false ? 'off' : ''} style-${c.style || 'cross'}"
         style="--xh-size:${c.size ?? 18}px;--xh-gap:${c.gap ?? 4}px;--xh-thick:${c.thickness ?? 1}px;${c.color ? `--xh-color:${c.color};` : ''}--xh-opacity:${c.opacity ?? 0.75}"
         aria-hidden="true">
      <i class="xh-arm t"></i><i class="xh-arm b"></i><i class="xh-arm l"></i><i class="xh-arm r"></i>
      <i class="xh-dot"></i>
    </div>

    <div class="obj ${objective.enabled === false ? 'off' : ''}">
      <div class="obj-k">${objective.kicker || ''}</div>
      <div class="obj-t">${objective.title || ''}</div>
      <div class="obj-s">${objective.sub || ''}</div>
    </div>

    <div class="badge ${cfg.badge?.enabled === false ? 'off' : ''}">
      <b id="rise-view">FP</b><span id="rise-surf">STREET</span>
    </div>

    <div class="hint ${cfg.hint?.enabled === false ? 'off' : ''}">${cfg.hint?.text || 'V — CHANGE VIEW · CLICK TO LOCK MOUSE · WASD / ARROWS · SHIFT RUN · SPACE JUMP'}</div>

    <div class="stats ${cfg.stats?.enabled === false ? 'off' : ''}">
      <span id="rise-calls">0</span> calls · <span id="rise-tris">0</span>k tris · <span id="rise-fps">60</span> FPS
    </div>

    <div class="pause off">
      <div class="pause-k">PAUSED</div>
      <div class="pause-s">P — resume</div>
    </div>
  `;

  const q = (sel) => root.querySelector(sel);
  const crosshair = q('.xh');
  const fps = q('#rise-fps');
  const view = q('#rise-view');
  const surf = q('#rise-surf');
  const calls = q('#rise-calls');
  const tris = q('#rise-tris');

  let acc = 0;
  let frames = 0;

  return {
    root,
    update(dt) {
      acc += dt;
      frames++;
      if (acc >= 0.5) {
        if (fps) fps.textContent = String(Math.round(frames / acc));
        acc = 0;
        frames = 0;
      }
    },

    setState({ mode, surface }) {
      if (view) view.textContent = mode === 'tp' ? 'TP' : 'FP';
      if (surf) surf.textContent = String(surface || 'street').toUpperCase();
    },

    setStats({ calls: cc, tris: tt }) {
      if (calls) calls.textContent = cc;
      if (tris) tris.textContent = (tt / 1000).toFixed(1);
    },

    setObjective({ kicker, title, sub } = {}) {
      if (kicker !== undefined) q('.obj-k').textContent = kicker;
      if (title !== undefined) q('.obj-t').textContent = title;
      if (sub !== undefined) q('.obj-s').textContent = sub;
    },

    setHint(text) {
      const el = q('.hint');
      if (el) el.textContent = text;
    },

    /** Shows or hides the hint line (the app calls this when pointer lock changes). */
    toggleHint(on) {
      q('.hint')?.classList.toggle('off', !on);
    },

    setPaused(on) {
      q('.pause')?.classList.toggle('off', !on);
      root.classList.toggle('paused', !!on);
    },

    /**
     * Reactive binding: the HUD updates itself when state changes.
     *   hud.bind('.obj-s', () => `HP ${s.hp}`)
     *   hud.bind('#rise-calls', () => stats.calls)
     */
    bind(target, getter, { format } = {}) {
      const el = typeof target === 'string' ? root.querySelector(target) : target;
      if (!el) return () => {};
      return effect(() => {
        const value = getter();
        const text = format ? format(value) : String(value ?? '');
        if (el.textContent !== text) el.textContent = text;
      });
    },

    /**
     * Changes the crosshair at runtime:
     *   hud.setCrosshair(false)                    // off
     *   hud.setCrosshair({ style:'dot', size:10 }) // change style
     */
    setCrosshair(patch) {
      if (!crosshair) return;
      if (patch === false) {
        crosshair.classList.add('off');
        return;
      }
      if (patch === true) {
        crosshair.classList.remove('off');
        return;
      }
      crosshair.classList.remove('off');
      if (patch.style) {
        crosshair.classList.remove('style-cross', 'style-dot');
        crosshair.classList.add(`style-${patch.style}`);
      }
      if (patch.size != null) crosshair.style.setProperty('--xh-size', `${patch.size}px`);
      if (patch.gap != null) crosshair.style.setProperty('--xh-gap', `${patch.gap}px`);
      if (patch.thickness != null) crosshair.style.setProperty('--xh-thick', `${patch.thickness}px`);
      if (patch.color) crosshair.style.setProperty('--xh-color', patch.color);
      if (patch.opacity != null) crosshair.style.setProperty('--xh-opacity', patch.opacity);
    },

    /** Removes the HUD DOM built inside root (called by app.destroy()). The HUD attaches no listeners. */
    dispose() {
      root.innerHTML = '';
      root.classList?.remove('paused');
    },

    /** Shows or hides one part: 'crosshair' | 'objective' | 'badge' | 'stats' | 'hint'. */
    toggle(name, on) {
      const map = { crosshair: '.xh', objective: '.obj', badge: '.badge', stats: '.stats', hint: '.hint' };
      const el = q(map[name] || '');
      if (el) el.classList.toggle('off', !on);
    },
  };
}
