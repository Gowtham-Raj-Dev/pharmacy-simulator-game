// Small shared helpers: DOM builder, icons, math, RNG.

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const k in attrs) {
    const v = attrs[k];
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    if (c instanceof String) { el.appendChild(c.en != null ? biNode(c) : document.createTextNode(String(c))); continue; }
    el.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
  }
  return el;
}
/** Bilingual text (Tamil + English) → <span class="bi"><span class="bt">…</span><span class="be">…</span></span> */
function biNode(s) {
  const w = document.createElement('span'); w.className = 'bi';
  const a = document.createElement('span'); a.className = 'bt'; a.textContent = String(s);
  const b = document.createElement('span'); b.className = 'be'; b.lang = 'en'; b.textContent = s.en;
  w.append(a, b); return w;
}
/** Set an element's text, rendering bilingual values as two lines. */
export function setText(el, s) {
  if (s instanceof String && s.en != null) { el.textContent = ''; el.appendChild(biNode(s)); }
  else el.textContent = s == null ? '' : String(s);
}

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
export const smooth = (t) => t * t * (3 - 2 * t);
export function angleLerp(a, b, t) {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
export function angleDamp(a, b, lambda, dt) { return angleLerp(a, b, 1 - Math.exp(-lambda * dt)); }

export function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const rand = (a, b) => a + Math.random() * (b - a);
export const randi = (a, b) => Math.floor(rand(a, b + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

// Cheap 1D value noise for natural idle motion.
export function noise1(x) {
  const i = Math.floor(x), f = x - i;
  const r = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  return lerp(r(i), r(i + 1), smooth(f)) * 2 - 1;
}

export const fmtMoney = (n) => '₹' + Math.round(n).toLocaleString('en-IN');
export const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));
export const wait = (ms) => new Promise((r) => setTimeout(r, ms));
/**
 * Full screen, then lock to landscape. A web page may only lock the orientation while it is full screen
 * (Android browsers allow it; iPhones and PCs refuse, harmlessly). Must be called from a tap.
 */
export function fullscreenLandscape() {
  const d = document.documentElement, req = d.requestFullscreen || d.webkitRequestFullscreen;
  const lock = () => { try { screen.orientation?.lock?.('landscape').catch(() => {}); } catch { /* not supported */ } };
  if (document.fullscreenElement || document.webkitFullscreenElement || !req) { lock(); return; }
  try { const r = req.call(d, { navigationUI: 'hide' }); if (r?.then) r.then(lock, () => {}); else lock(); } catch { /* blocked */ }
}

// ── Inline SVG icon set (stroke icons, 24×24) ──
const P = {
  pill: '<path d="M10.5 3.5a5 5 0 0 1 7 7l-7 7a5 5 0 0 1-7-7z"/><path d="M7 10l7 7"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  pulse: '<path d="M3 12h4l2-5 4 10 2-5h6"/>',
  alert: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.5"/>',
  file: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>',
  car: '<path d="M5 16h14v-4l-2-5H7l-2 5z"/><circle cx="8" cy="17" r="1.6"/><circle cx="16" cy="17" r="1.6"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-5 15-5 16 0"/>',
  cabinet: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M4 12h16M10 7.5h4M10 16.5h4"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  check: '<path d="M5 12l5 5 9-10"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
  star: '<path d="M12 3l2.8 5.8 6.2.9-4.5 4.4 1 6.3L12 17.5 6.5 20.4l1-6.3L3 9.7l6.2-.9z"/>',
  heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  box: '<path d="M3 7l9-4 9 4-9 4z"/><path d="M3 7v10l9 4 9-4V7M12 11v10"/>',
  cash: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/>',
  card: '<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M2.5 10h19M6.5 15h4"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
  book: '<path d="M4 4h6a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H4z"/><path d="M20 4h-6a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h6z"/>',
  refer: '<path d="M4 12h12M12 6l6 6-6 6"/><path d="M20 4v16"/>',
  phone: '<path d="M5 3h4l2 5-3 2a12 12 0 0 0 6 6l2-3 5 2v4a2 2 0 0 1-2 2A17 17 0 0 1 3 5a2 2 0 0 1 2-2z"/>',
  chat: '<path d="M4 5h16v11H9l-5 4z"/>',
  tray: '<path d="M3 13l3-8h12l3 8v6H3z"/><path d="M3 13h5l1 2h6l1-2h5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
  flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  snow: '<path d="M12 2v20M4 6l16 12M20 6L4 18"/>',
  trophy: '<path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4M12 14v4M8 21h8"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  play: '<path d="M7 4l13 8-13 8z"/>',
  skip: '<path d="M5 5l10 7-10 7z"/><path d="M19 5v14"/>',
  hand: '<path d="M8 12V5a1.5 1.5 0 0 1 3 0v6M11 11V4a1.5 1.5 0 0 1 3 0v7M14 11V5.5a1.5 1.5 0 0 1 3 0V14a7 7 0 0 1-7 7 6 6 0 0 1-5-3l-2.5-4.5a1.5 1.5 0 0 1 2.6-1.5L8 14"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  thermo: '<path d="M14 14.8V5a2 2 0 0 0-4 0v9.8a4 4 0 1 0 4 0z"/>',
  flower: '<circle cx="12" cy="12" r="2.5"/><path d="M12 9.5V4M12 20v-5.5M9.5 12H4M20 12h-5.5"/>',
  stomach: '<path d="M9 3v4c0 2-3 3-3 7a6 6 0 0 0 12 0c0-3-3-3-3-6V3"/>',
  lungs: '<path d="M12 4v8M12 12c-2-2-6-1-6 5 0 2 1 3 3 3s3-2 3-5M12 12c2-2 6-1 6 5 0 2-1 3-3 3s-3-2-3-5"/>',
  bandage: '<rect x="3" y="9" width="18" height="6" rx="3" transform="rotate(-35 12 12)"/>',
  family: '<circle cx="8" cy="6" r="2.5"/><circle cx="16" cy="8" r="2"/><path d="M4 21v-5a4 4 0 0 1 8 0v5M13 21v-4a3 3 0 0 1 6 0v4"/>',
  link: '<path d="M10 14a4 4 0 0 0 6 0l3-3a4 4 0 0 0-6-6l-1 1M14 10a4 4 0 0 0-6 0l-3 3a4 4 0 0 0 6 6l1-1"/>',
  device: '<rect x="6" y="3" width="12" height="18" rx="2"/><path d="M10 17h4"/>',
  cart: '<path d="M3 4h2l2.5 11h11L21 7H6"/><circle cx="9" cy="19" r="1.5"/><circle cx="17" cy="19" r="1.5"/>',
  sparkle: '<path d="M12 3l1.8 6.2L20 11l-6.2 1.8L12 19l-1.8-6.2L4 11l6.2-1.8z"/>',
  door: '<path d="M5 21V3h11v18M16 5h3v16M12 12v.5"/>',
  drag: '<path d="M9 5h.01M15 5h.01M9 12h.01M15 12h.01M9 19h.01M15 19h.01" stroke-width="3"/>',
  rx: '<path d="M6 20V4h5a4 4 0 0 1 0 8H6M10 12l8 8M18 13l-5 7"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  zoom: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4M8 11h6M11 8v6"/>',
  restart: '<path d="M4 12a8 8 0 1 0 2.5-5.8"/><path d="M4 4v4h4"/>',
  bottle: '<path d="M9 3h6v3l2 3v12H7V9l2-3z"/><path d="M7 13h10"/>',
  drop: '<path d="M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11z"/>',
  tube: '<path d="M7 3h10l-2 14H9z"/><path d="M10 17v4h4v-4"/>',
  spray: '<rect x="7" y="9" width="10" height="12" rx="2"/><path d="M10 9V5h4v4M14 5h3"/>',
  powder: '<path d="M5 8h14l-2 13H7z"/><path d="M8 8l1-4h6l1 4"/>',
  baby: '<circle cx="12" cy="9" r="5"/><path d="M7 21c0-3 2-5 5-5s5 2 5 5M10 9h.01M14 9h.01"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 21h4"/>',
  home: '<path d="M3 10.5L12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-4v6H4a1 1 0 0 1-1-1z"/>',
};
export function icon(name, size = 20, cls = '') {
  return `<svg class="ic ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || P.info}</svg>`;
}
export function iconEl(name, size = 20, cls = '') {
  const s = document.createElement('span');
  s.className = 'icw';
  s.innerHTML = icon(name, size, cls);
  return s;
}
