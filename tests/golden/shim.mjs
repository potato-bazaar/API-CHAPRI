// The browser surface needed to import the game bundle in Node. The solo race path uses the real code.
// Everything else is a no-op. Visual objects use visualStub: calls do nothing and arithmetic reads 0,
// so a visual read can neither throw nor feed a number into the physics.
const noop = () => {};
const zeroFn = Object.assign(() => undefined, { valueOf: () => 0, toString: () => '0' });

export function visualStub(base = {}) {
  return new Proxy(base, {
    get: (t, k) => (k in t ? t[k] : typeof k === 'symbol' ? undefined : zeroFn),
    set: (t, k, v) => { t[k] = v; return true; },
  });
}

// Canvas 2D context: textures are painted into it (05_textures.js). Painting does nothing; gradients and metrics return usable values.
function make2d(canvas) {
  const gradient = () => ({ addColorStop: noop });
  const special = {
    createLinearGradient: gradient,
    createRadialGradient: gradient,
    createConicGradient: gradient,
    createPattern: () => ({}),
    measureText: (s) => ({ width: String(s).length * 5 }),
    createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
    getImageData: (x, y, w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
    getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
  };
  const state = { canvas, font: '10px sans-serif', globalAlpha: 1, fillStyle: '#000', strokeStyle: '#000', lineWidth: 1 };
  return new Proxy(state, {
    get: (t, k) => {
      if (k in t) return t[k];
      if (typeof k === 'symbol') return undefined;
      return k in special ? special[k] : noop;
    },
    set: (t, k, v) => { t[k] = v; return true; },
  });
}

function makeCanvas() {
  const c = { width: 300, height: 150, style: visualStub({}), addEventListener: noop, removeEventListener: noop, setAttribute: noop };
  c.getContext = (type) => (type === '2d' ? (c._2d || (c._2d = make2d(c))) : null);   // no WebGL context
  c.toDataURL = () => 'data:,';
  return c;
}

function makeElement(tag = 'div', id = '') {
  return visualStub({
    tagName: String(tag).toUpperCase(), id, hidden: false, textContent: '', innerHTML: '', className: '', dataset: {},
    style: visualStub({}),
    classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
  });
}

const elements = new Map();
const byId = (id) => {
  if (!elements.has(id)) elements.set(id, makeElement(id === 'gl' ? 'canvas' : 'div', id));
  return elements.get(id);
};

const documentStub = visualStub({
  hidden: false,
  visibilityState: 'visible',
  documentElement: makeElement('html'),
  body: makeElement('body'),
  fonts: { load: () => Promise.resolve([]) },
  querySelector: (sel) => (String(sel).startsWith('#') ? byId(String(sel).slice(1)) : makeElement('div')),
  querySelectorAll: () => [],
  getElementById: (id) => byId(id),
  createElement: (tag) => (String(tag).toLowerCase() === 'canvas' ? makeCanvas() : makeElement(tag)),
  addEventListener: noop,
  removeEventListener: noop,
});

const memStore = new Map();
const localStorageStub = {
  getItem: (k) => (memStore.has(k) ? memStore.get(k) : null),
  setItem: (k, v) => { memStore.set(k, String(v)); },
  removeItem: (k) => { memStore.delete(k); },
  clear: () => memStore.clear(),
};

// Pins the clock. Date.now() and new Date() return nowMs. performance.now() returns 0.
// The game reads the clock only for a race seed (45_race.js) and for timestamps that nothing hashed uses.
export function pinClock(nowMs) {
  const RealDate = Date;
  class PinnedDate extends RealDate {
    constructor(...args) { if (args.length === 0) super(nowMs); else super(...args); }
    static now() { return nowMs; }
  }
  globalThis.Date = PinnedDate;
  Object.defineProperty(performance, 'now', { value: () => 0, configurable: true, writable: true });
}

// Installs the browser globals that the module code reads at import time or on the solo race path.
// requestAnimationFrame never calls back, so the game's frame loop and boot sequence stay parked.
export function installBrowserStubs({ innerWidth = 480, innerHeight = 270 } = {}) {
  const globals = {
    window: globalThis,
    document: documentStub,
    localStorage: localStorageStub,
    location: { search: '', href: 'http://localhost/', hostname: 'localhost' },
    matchMedia: (q) => ({ matches: false, media: q, addEventListener: noop, removeEventListener: noop }),
    innerWidth,
    innerHeight,
    devicePixelRatio: 1,
    requestAnimationFrame: () => 0,
    cancelAnimationFrame: noop,
    addEventListener: noop,
    removeEventListener: noop,
    screen: { orientation: { angle: 0, lock: () => Promise.resolve() } },
  };
  for (const [k, v] of Object.entries(globals)) {
    Object.defineProperty(globalThis, k, { value: v, configurable: true, writable: true });
  }
}
