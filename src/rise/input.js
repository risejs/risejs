import { DEFAULTS } from './config.js';

/**
 * Input: keyboard + mouse, pointer lock, and a mouse-drag fallback.
 * Actions instead of hard-coded key codes; rebind through config.input.binds.
 */
export class Input {
  constructor(canvas, config = {}) {
    const cfg = { ...DEFAULTS.input, ...config };
    this.canvas = canvas;
    this.binds = cfg.binds;
    this.sensitivity = cfg.sensitivity;

    this.codes = new Set();
    this.letters = new Set();
    this.pressedCodes = new Set();
    this.buttons = new Set();
    this.pressedButtons = new Set();
    this.activity = 0;
    this.pad = null;
    this.padAxes = [0, 0, 0, 0];
    this.padButtons = new Set();
    this.padPressed = new Set();
    this.touch = null;
    this.look = { dx: 0, dy: 0 };
    this.locked = false;
    this.dragging = false;
    this._lastX = 0;
    this._lastY = 0;
    this._offs = [];

    this._bind();
  }

  /** Attaches a listener and records it so dispose() removes exactly what was attached. */
  _on(target, type, fn, opts) {
    if (!target?.addEventListener) return;
    target.addEventListener(type, fn, opts);
    this._offs.push(() => target.removeEventListener(type, fn, opts));
  }

  /** Removes every listener (canvas/window/document) and clears key state. Safe to call more than once. */
  dispose() {
    for (const off of this._offs.splice(0)) off();
    this.clear();
    this.locked = this.dragging = false;
    globalThis.document?.body?.classList?.remove('locked');
  }

  _bind() {
    const c = this.canvas;
    const on = this._on.bind(this);

    on(c, 'click', () => {
      c.focus();
      if (!this.locked) this.requestLock();
    });

    on(c, 'mousedown', (e) => {
      if (e.button !== 0 || this.locked) return;
      this.dragging = true;
      this._lastX = e.clientX;
      this._lastY = e.clientY;
    });

    on(window, 'mouseup', (e) => {
      this.dragging = false;
      this.buttons.delete(e.button);
    });

    on(c, 'mousedown', (e) => {
      this.buttons.add(e.button);
      this.pressedButtons.add(e.button);
      this.activity++;
    });

    // the right mouse button aims, so block the context menu on the canvas
    on(c, 'contextmenu', (e) => e.preventDefault());

    on(document, 'pointerlockchange', () => {
      this.locked = document.pointerLockElement === c;
      document.body.classList.toggle('locked', this.locked);
      if (!this.locked) {
        this.dragging = false;
        this.clear();
      }
    });

    on(document, 'mousemove', (e) => {
      if (this.locked) {
        this.look.dx += e.movementX;
        this.look.dy += e.movementY;
      } else if (this.dragging) {
        this.look.dx += e.clientX - this._lastX;
        this.look.dy += e.clientY - this._lastY;
        this._lastX = e.clientX;
        this._lastY = e.clientY;
      }
    });

    on(window, 'keydown', (e) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      this.codes.add(e.code);
      this.letters.add(String(e.key).toLowerCase());
      this.pressedCodes.add(e.code);
      this.activity++;
      if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
    });

    on(window, 'keyup', (e) => {
      this.codes.delete(e.code);
      this.letters.delete(String(e.key).toLowerCase());
    });

    // prevent stuck keys
    on(window, 'blur', () => this.clear());
    on(window, 'pagehide', () => this.clear());
    on(document, 'visibilitychange', () => {
      if (document.hidden) this.clear();
    });
  }

  requestLock() {
    const req = this.canvas.requestPointerLock?.();
    if (req && typeof req.catch === 'function') req.catch(() => {});
  }

  /** Key codes configured for an action (e.g. 'KeyW'). */
  _codes(action) {
    return this.binds[action] || [];
  }

  down(action) {
    if (this.auto) {
      const a = this.auto;
      if (action === 'forward') return a.mz > 0.3;
      if (action === 'back') return a.mz < -0.3;
      if (action === 'left') return a.mx < -0.3;
      if (action === 'right') return a.mx > 0.3;
    }
    if (this.touch) {
      const t = this.touch;
      if (action === 'forward' && t.y < -0.35) return true;
      if (action === 'back' && t.y > 0.35) return true;
      if (action === 'left' && t.x < -0.35) return true;
      if (action === 'right' && t.x > 0.35) return true;
      if (action === 'jump' && t.jump) return true;
      if (action === 'crouch' && t.crouch) return true;
    }
    const PAD = { jump: [0], crouch: [1], reload: [2], interact: [3], view: [9], pause: [8], run: [10] };
    if (this.pad) {
      const [lx, ly] = this.padAxes;
      if (action === 'forward' && ly < -0.35) return true;
      if (action === 'back' && ly > 0.35) return true;
      if (action === 'left' && lx < -0.35) return true;
      if (action === 'right' && lx > 0.35) return true;
      const mapped = PAD[action];
      if (mapped && mapped.some((i) => this.padButtons.has(i))) return true;
    }
    for (const code of this._codes(action)) {
      if (code.startsWith('Mouse') && this.buttons.has(Number(code.slice(5)))) return true;
      if (this.codes.has(code)) return true;
      if (code.startsWith('Key') && this.letters.has(code.slice(3).toLowerCase())) return true;
    }
    return false;
  }

  justPressed(action) {
    if (this.pad) {
      const PAD = { jump: [0], crouch: [1], reload: [2], interact: [3], view: [9], pause: [8] };
      const mapped = PAD[action];
      if (mapped && mapped.some((i) => this.padPressed.has(i))) return true;
    }
    for (const code of this._codes(action)) {
      if (code.startsWith('Mouse') && this.pressedButtons.has(Number(code.slice(5)))) return true;
      if (this.pressedCodes.has(code)) return true;
    }
    return false;
  }

  /** Reads the gamepad every frame (if present). */
  poll() {
    if (this.touch) {
      this.look.dx += (this.touch.lookX || 0) * 14;
      this.look.dy += (this.touch.lookY || 0) * 14;
    }

    const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
    const pad = [...pads].find((p) => p && p.connected);
    this.pad = pad || null;

    if (!pad) {
      this.padButtons.clear();
      this.padPressed.clear();
      this.padAxes = [0, 0, 0, 0];
      return;
    }

    const now = new Set();
    pad.buttons.forEach((b, i) => {
      if (b.pressed) now.add(i);
    });
    this.padPressed = new Set([...now].filter((i) => !this.padButtons.has(i)));
    this.padButtons = now;
    this.padAxes = pad.axes.slice(0, 4);

    // right stick → look
    this.look.dx += this.padAxes[2] * 12;
    this.look.dy += this.padAxes[3] * 12;
  }

  /** Call at the end of each frame to clear "just pressed" state and the mouse delta. */
  endFrame() {
    this.pressedCodes.clear();
    this.pressedButtons.clear();
    this.padPressed.clear();
    this.look.dx = 0;
    this.look.dy = 0;
  }

  clear() {
    this.codes.clear();
    this.letters.clear();
    this.pressedCodes.clear();
    this.buttons.clear();
    this.pressedButtons.clear();
  }
}
