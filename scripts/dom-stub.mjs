/**
 * Minimal DOM for Node tests (no jsdom): enough for createApp/Input/HUD.
 * Counts addEventListener/removeEventListener per target to check that destroy() removes everything.
 */
export class Target {
  constructor() {
    this.listeners = new Map();
    this.adds = 0;
    this.removes = 0;
  }
  addEventListener(type, fn) {
    this.adds++;
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(fn);
  }
  removeEventListener(type, fn) {
    this.removes++;
    this.listeners.get(type)?.delete(fn);
  }
  dispatch(type, ev = {}) {
    for (const fn of [...(this.listeners.get(type) || [])]) fn({ type, preventDefault() {}, ...ev });
  }
  get live() {
    let n = 0;
    for (const set of this.listeners.values()) n += set.size;
    return n;
  }
}

class ClassList {
  constructor() {
    this.set = new Set();
  }
  add(...c) {
    c.forEach((x) => this.set.add(x));
  }
  remove(...c) {
    c.forEach((x) => this.set.delete(x));
  }
  toggle(c, on = !this.set.has(c)) {
    on ? this.set.add(c) : this.set.delete(c);
    return on;
  }
  contains(c) {
    return this.set.has(c);
  }
}

export class El extends Target {
  constructor(tag, doc) {
    super();
    this.tagName = String(tag).toUpperCase();
    this.ownerDocument = doc;
    this.id = '';
    this.className = '';
    this.classList = new ClassList();
    this.style = { cssText: '', setProperty() {} };
    this.children = [];
    this.parentNode = null;
    this.textContent = '';
    this._html = '';
  }
  set innerHTML(v) {
    this._html = String(v);
    for (const c of this.children) c.parentNode = null;
    this.children = [];
  }
  get innerHTML() {
    return this._html;
  }
  appendChild(el) {
    el.parentNode?.removeChild(el);
    this.children.push(el);
    el.parentNode = this;
    return el;
  }
  removeChild(el) {
    const i = this.children.indexOf(el);
    if (i >= 0) this.children.splice(i, 1);
    el.parentNode = null;
    return el;
  }
  remove() {
    this.parentNode?.removeChild(this);
  }
  *walk() {
    for (const c of this.children) {
      yield c;
      yield* c.walk();
    }
  }
  querySelector(sel) {
    if (sel.startsWith('#')) {
      for (const el of this.walk()) if (el.id === sel.slice(1)) return el;
      return null;
    }
    return new El('div', this.ownerDocument); // temporary HUD element (innerHTML is not parsed)
  }
  focus() {}
  requestPointerLock() {}
  getContext() {
    return null;
  }
}

export class Doc extends Target {
  constructor() {
    super();
    this.body = new El('body', this);
    this.visibilityState = 'visible';
    this.hidden = false;
    this.pointerLockElement = null;
  }
  createElement(tag) {
    return new El(tag, this);
  }
  getElementById(id) {
    return this.body.querySelector(`#${id}`);
  }
  /** Every element in the body (to count the nodes the core creates). */
  all() {
    return [...this.body.walk()];
  }
}

export class Win extends Target {
  constructor() {
    super();
    this.innerWidth = 800;
    this.innerHeight = 600;
    this.devicePixelRatio = 1;
  }
}

/** Installs a fresh window/document/localStorage on globalThis; returns { window, document }. */
export function installDom() {
  const document = new Doc();
  const window = new Win();
  window.document = document;
  globalThis.window = window;
  globalThis.document = document;
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
  return { window, document };
}

/** Fake renderer: captures the setAnimationLoop callback so tests can step frames themselves. */
export function fakeRenderer() {
  return {
    loop: null,
    count: { render: 0, compile: 0, setSize: 0, dispose: 0 },
    info: { render: { calls: 0, triangles: 0 } },
    shadowMap: { enabled: false },
    xr: { enabled: false },
    toneMappingExposure: 1,
    setAnimationLoop(fn) {
      this.loop = fn;
    },
    render() {
      this.count.render++;
    },
    compile() {
      this.count.compile++;
    },
    setSize() {
      this.count.setSize++;
    },
    setPixelRatio() {},
    dispose() {
      this.count.dispose++;
    },
  };
}
