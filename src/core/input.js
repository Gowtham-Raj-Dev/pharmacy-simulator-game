// Mobile-first input: virtual joystick, swipe-to-look, pinch-to-zoom, tap-to-interact.
// Desktop fallback: WASD/arrows + Shift, mouse drag, wheel, E to interact.
export class Input {
  constructor(el, ui, settings) {
    this.el = el; this.settings = settings;
    this.move = { x: 0, y: 0, mag: 0, run: false };
    this.sprint = false;
    this.camKeys = { rot: 0, zoom: 0 };
    this.onKey = null;
    this.onTap = null; this.onLook = null; this.onZoom = null; this.onInteractKey = null;
    this.enabled = true;
    this.pointers = new Map();
    this.joy = { id: null, ox: 0, oy: 0, x: 0, y: 0 };
    this.keys = new Set();
    this.pinchDist = 0;
    // joystick DOM
    this.joyBase = ui.querySelector('#joy');
    this.joyKnob = ui.querySelector('#joyKnob');
    this._bind();
  }
  get joySide() { return this.settings.handed === 'left' ? 'right' : 'left'; }

  _inJoyZone(x, y) {
    const w = window.innerWidth, h = window.innerHeight;
    const inBottom = y > h * 0.38;
    return this.joySide === 'left' ? x < w * 0.42 && inBottom : x > w * 0.58 && inBottom;
  }
  _bind() {
    const el = this.el;
    el.addEventListener('pointerdown', (e) => this._down(e), { passive: false });
    window.addEventListener('pointermove', (e) => this._moveEv(e), { passive: false });
    window.addEventListener('pointerup', (e) => this._up(e));
    window.addEventListener('pointercancel', (e) => this._up(e));
    el.addEventListener('wheel', (e) => { e.preventDefault(); if (this.enabled) this.onZoom?.(e.deltaY > 0 ? 1.08 : 0.93); }, { passive: false });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', (e) => {
      if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
      this.keys.add(e.code);
      if ((e.code === 'KeyE' || e.code === 'Space' || e.code === 'Enter') && this.enabled) { e.preventDefault(); this.onInteractKey?.(); }
      if (this.enabled) this.onKey?.(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => { this.keys.clear(); this._resetJoy(); });
  }
  _down(e) {
    e.preventDefault();
    try { this.el.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    const p = { id: e.pointerId, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now(), moved: 0, type: 'look', mouse: e.pointerType === 'mouse' };
    if (this.enabled && e.pointerType !== 'mouse' && this.joy.id === null && this._inJoyZone(e.clientX, e.clientY)) {
      p.type = 'joy';
      this.joy.id = e.pointerId; this.joy.ox = e.clientX; this.joy.oy = e.clientY; this.joy.x = 0; this.joy.y = 0;
      this._showJoy(true);
    }
    this.pointers.set(e.pointerId, p);
    const looks = [...this.pointers.values()].filter((q) => q.type === 'look');
    if (looks.length === 2) this.pinchDist = Math.hypot(looks[0].x - looks[1].x, looks[0].y - looks[1].y);
  }
  _moveEv(e) {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    p.moved = Math.max(p.moved, Math.hypot(p.x - p.sx, p.y - p.sy));
    if (p.type === 'joy') {
      const R = 56;
      let jx = p.x - this.joy.ox, jy = p.y - this.joy.oy;
      const d = Math.hypot(jx, jy);
      if (d > R) { jx *= R / d; jy *= R / d; }
      this.joy.x = jx / R; this.joy.y = jy / R;
      this._showJoy(true);
      return;
    }
    const looks = [...this.pointers.values()].filter((q) => q.type === 'look');
    if (looks.length === 2) {
      const d = Math.hypot(looks[0].x - looks[1].x, looks[0].y - looks[1].y);
      if (this.pinchDist > 0 && this.enabled) this.onZoom?.(this.pinchDist / d);
      this.pinchDist = d;
    } else if (looks.length === 1 && p.moved > 6 && this.enabled) {
      if (p.mouse && !(e.buttons & 1) && !(e.buttons & 2)) return;
      this.onLook?.(dx, dy);
    }
  }
  _up(e) {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    this.pointers.delete(e.pointerId);
    if (p.type === 'joy') { this._resetJoy(); return; }
    const dt = performance.now() - p.t;
    if (p.moved < 12 && dt < 350 && this.enabled) this.onTap?.(p.x, p.y);
    this.pinchDist = 0;
  }
  _resetJoy() { this.joy.id = null; this.joy.x = 0; this.joy.y = 0; this._showJoy(false); }
  _showJoy(active) {
    if (!this.joyBase) return;
    const side = this.joySide;
    this.joyBase.classList.toggle('right', side === 'right');
    this.joyBase.classList.toggle('active', active);
    if (active && this.joy.id !== null) {
      this.joyBase.style.left = this.joy.ox + 'px'; this.joyBase.style.top = this.joy.oy + 'px';
      this.joyBase.style.right = 'auto'; this.joyBase.style.bottom = 'auto';
      this.joyKnob.style.transform = `translate(${this.joy.x * 56}px, ${this.joy.y * 56}px)`;
    } else {
      this.joyBase.style.left = ''; this.joyBase.style.top = ''; this.joyBase.style.right = ''; this.joyBase.style.bottom = '';
      this.joyKnob.style.transform = 'translate(0,0)';
    }
  }
  /** Returns movement vector in screen terms: x (right), y (forward) */
  update() {
    let x = this.joy.x, y = -this.joy.y;
    const k = this.keys;
    if (k.has('KeyW') || k.has('ArrowUp')) y += 1;
    if (k.has('KeyS') || k.has('ArrowDown')) y -= 1;
    if (k.has('KeyA') || k.has('ArrowLeft')) x -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) x += 1;
    const mag = Math.min(1, Math.hypot(x, y));
    if (mag > 1e-3) { const n = Math.hypot(x, y); x /= n; y /= n; }
    this.move.x = x; this.move.y = y; this.move.mag = this.enabled ? mag : 0;
    this.move.run = this.sprint || (k.has('ShiftLeft') || k.has('ShiftRight')) || (this.joy.id !== null && mag > 0.95);
    this.camKeys.rot = (k.has('KeyC') ? 1 : 0) - (k.has('KeyZ') ? 1 : 0);
    this.camKeys.zoom = (k.has('Minus') || k.has('NumpadSubtract') ? 1 : 0) - (k.has('Equal') || k.has('NumpadAdd') ? 1 : 0);
    return this.move;
  }
}
