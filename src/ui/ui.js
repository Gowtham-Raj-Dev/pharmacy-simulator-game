// UI core: HUD, modal stack, toasts, subtitles, title, language picker, menus,
// settings, stats, training library, levels, guide panel. Gameplay panels live in panels.js.
import { h, icon, fmtMoney, clamp } from '../core/util.js';
import { LEVELS, UPGRADES, ACHIEVEMENTS } from '../data/levels.js';
import { MODULES } from '../data/questions.js';
import { panelMethods, bindPanels } from './panels.js';
import { K } from './keys.js';
import { t, tp, getLang, isTA } from '../i18n/i18n.js';

const SVG = (d, s = 20) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const MENTOR_IC = SVG('<circle cx="12" cy="7" r="4"/><path d="M5 21v-1a7 7 0 0 1 14 0v1"/><path d="M12 14v4M10 16h4"/>', 22);

export class UI {
  constructor(root, game) {
    this.root = root; this.g = game;
    bindPanels(game);
    this.stack = [];
    root.innerHTML = '';
    this.hud = h('div', { class: 'hud off' });
    root.appendChild(this.hud);
    this._buildHUD();
    this.layer = h('div', { class: 'layer' });
    root.appendChild(this.layer);
    this.toasts = h('div', { class: 'toasts' });
    root.appendChild(this.toasts);
    this.sub = h('div', { class: 'subtitle hidden' });
    root.appendChild(this.sub);
    this.fpsEl = h('div', { class: 'fps hidden' });
    root.appendChild(this.fpsEl);
  }

  /** Rebuild language-dependent static UI (HUD labels). Open dialogs are closed by the caller. */
  relabel() {
    const keep = this.hud.className;
    this.hud.innerHTML = '';
    this._buildHUD();
    this.hud.className = keep;
    this.updateHUD();
  }

  // ───────────────────────── HUD ─────────────────────────
  _buildHUD() {
    const H = this.hud;
    this.el = {};
    const g = this.g;
    this.el.lvlNum = h('b', {}, '1');
    this.el.rank = h('div', { class: 'rank' }, '');
    this.el.ttl = h('div', { class: 'ttl' }, '');
    this.el.xp = h('i');
    const tl = h('button', { class: 'hud-tl pe', onclick: () => this.showLevels(), 'aria-label': tp('hud.trainingPath'), 'data-key': 'l', 'data-kbd': 'L' },
      h('div', { class: 'lvl-badge' }, h('small', {}, tp('hud.lv')), this.el.lvlNum),
      h('div', { class: 'lvl-info' }, this.el.rank, this.el.ttl, h('div', { class: 'xpbar' }, this.el.xp)));
    this.el.objTxt = h('span', { class: 'txt' }, '');
    this.el.objStep = h('span', { class: 'step' }, '');
    this.el.objIc = h('span', { class: 'dot', html: icon('flag', 16) });
    this.el.obj = h('button', { class: 'objective pe', onclick: () => this.showGuide() }, this.el.objIc, h('span', { class: 'txt-wrap' }, this.el.objTxt, this.el.objStep));
    const tc = h('div', { class: 'hud-tc' }, this.el.obj);
    this.el.money = h('span', {}, '₹0'); this.el.rep = h('span', {}, '50'); this.el.safe = h('span', {}, '70%');
    this.el.chipMoney = h('button', { class: 'chip money pe', onclick: () => this.showStats(), 'aria-label': tp('hud.money') }, h('span', { class: 'icw', html: icon('cash', 16) }), this.el.money);
    this.el.chipRep = h('button', { class: 'chip rep pe', onclick: () => this.showStats(), 'aria-label': tp('hud.reputation') }, h('span', { class: 'icw', html: icon('star', 16) }), this.el.rep);
    this.el.chipSafe = h('button', { class: 'chip safe pe', onclick: () => this.showStats(), 'aria-label': tp('hud.safety'), 'data-key': 'k' }, h('span', { class: 'icw', html: icon('shield', 16) }), this.el.safe);
    const menuBtn = h('button', { class: 'chip menu pe', 'aria-label': tp('hud.menu'), 'data-key': 'Escape m', 'data-kbd': 'Esc', onclick: () => { g.audio.sfx('tap'); this.showMenu(); } }, h('span', { class: 'icw', html: icon('menu', 18) }));
    const tr = h('div', { class: 'hud-tr' }, this.el.chipMoney, this.el.chipRep, this.el.chipSafe, menuBtn);
    this.el.top = h('div', { class: 'topbar' }, tl, tc, tr);
    const sb = (ic, lab, fn, cls = '', key = '') => h('button', { class: 'rbtn ' + cls, 'aria-label': lab, 'data-key': key.toLowerCase() || null, 'data-kbd': key || null, onclick: () => { g.audio.sfx('tap'); fn(); } }, h('span', { class: 'icw', html: ic.startsWith('<') ? ic : icon(ic, 22) }), h('span', { class: 'rlab' }, lab));
    this.el.guideBtn = sb(MENTOR_IC, tp('hud.guide'), () => this.showGuide(), 'guide', 'G');
    this.el.cabBtn = sb('cabinet', tp('hud.cabinet'), () => g.openCabinet(), '', 'I');
    const side = h('div', { class: 'side-btns' }, this.el.guideBtn, this.el.cabBtn, sb('book', tp('hud.study'), () => this.showTraining(), '', 'B'), sb('chart', tp('hud.stats'), () => this.showStats(), '', 'O'));
    this.el.actBtn = h('button', { class: 'act-main', 'aria-label': tp('hud.interact'), 'data-kbd': 'E', onclick: () => g.contextAction() });
    this.el.actLab = h('div', { class: 'lab' }, '');
    this.el.act = h('div', { class: 'act off' }, this.el.actBtn, this.el.actLab);
    this.el.sprint = h('button', { class: 'sprint pe' + (g.input?.sprint ? ' on' : ''), 'aria-label': tp('hud.sprint'), 'aria-pressed': 'false', 'data-kbd': 'R', onclick: () => { const on = !g.input.sprint; g.input.sprint = on; this.el.sprint.classList.toggle('on', on); this.el.sprint.setAttribute('aria-pressed', String(on)); g.audio.sfx('click'); g.haptic('light'); } },
      h('span', { class: 'icw', html: SVG('<circle cx="15" cy="4.5" r="2"/><path d="M8 21l3-6 3 2v5M6 12l3-3 4 1 2 4 3 1M11 15l-1-5"/>', 24) }), h('span', { class: 'slab' }, tp('hud.run')));
    const hold = (ic, lab, fn) => {
      const b = h('button', { class: 'cbtn adv', 'aria-label': lab }, h('span', { class: 'icw', html: ic }));
      let raf = null;
      const step = () => { fn(); raf = requestAnimationFrame(step); };
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); b.classList.add('down'); step(); g.haptic('light'); });
      const stop = () => { b.classList.remove('down'); if (raf) cancelAnimationFrame(raf); raf = null; };
      b.addEventListener('pointerup', stop); b.addEventListener('pointerleave', stop); b.addEventListener('pointercancel', stop);
      return b;
    };
    const tap = (ic, lab, fn) => h('button', { class: 'cbtn', 'aria-label': lab, onclick: () => { g.audio.sfx('click'); fn(); } }, h('span', { class: 'icw', html: ic }));
    this.el.viewBtn = tap(SVG('<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'), tp('cam.view'), () => { g.settings.firstPerson = !g.settings.firstPerson; g.applySettings(); this.toast(g.settings.firstPerson ? tp('cam.first') : tp('cam.third'), '', 'eye', 1400); });
    const cam = h('div', { class: 'cam-bar pe' },
      hold(SVG('<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 3v6h6"/>'), tp('cam.left'), () => g.rig.rotate(-9, 0)),
      hold(SVG('<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 3v6h-6"/>'), tp('cam.right'), () => g.rig.rotate(9, 0)),
      h('span', { class: 'csep adv' }),
      hold(SVG('<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4M8 11h6"/>'), tp('cam.zoomOut'), () => g.rig.zoom(1.025)),
      hold(SVG('<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4M8 11h6M11 8v6"/>'), tp('cam.zoomIn'), () => g.rig.zoom(0.975)),
      h('span', { class: 'csep adv' }),
      tap(SVG('<circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>'), tp('cam.recenter'), () => g.recenterCamera()),
      this.el.viewBtn);
    const joy = h('div', { id: 'joy' }, h('div', { class: 'joy-arrows', html: SVG('<path d="M12 3l-3 3h6zM12 21l-3-3h6zM3 12l3-3v6zM21 12l-3-3v6z" fill="currentColor" stroke="none"/>') }), h('div', { id: 'joyKnob' }));
    this.el.joyHint = h('div', { class: 'joy-hint' }, tp('hud.move'));
    this.el.joy = joy;
    joy.classList.toggle('right', g.settings.handed === 'left');
    // PC: compact key legend replaces the touch joystick / RUN / camera bar
    const kc = (...k) => k.map((x) => h('kbd', {}, x));
    const it = (keys, lab) => h('span', { class: 'pk' }, ...keys, h('em', {}, lab));
    this.el.pcKeys = h('div', { class: 'pc-keys' },
      it(kc('W', 'A', 'S', 'D'), tp('hud.move')), it(kc('Shift'), tp('hud.sprint')), it(kc('E'), tp('hud.interact')),
      it(kc(tp('hud.pcDrag')), tp('hud.pcLook')), it(kc(tp('hud.pcWheel')), tp('hud.pcZoom')), it(kc('V'), tp('hud.pcView')));
    H.append(this.el.top, side, this.el.act, this.el.sprint, cam, joy, this.el.joyHint, this.el.pcKeys);
    if (!this._ro) {
      this._ro = new ResizeObserver(() => { if (this.el.top.isConnected) this.root.style.setProperty('--top-h', this.el.top.getBoundingClientRect().height + 'px'); });
    }
    this._ro.disconnect(); this._ro.observe(this.el.top);
    if (g.input) g.input.joyBase = joy, g.input.joyKnob = joy.querySelector('#joyKnob');
  }
  showHUD(on) { this.hud.classList.toggle('off', !on); }
  updateHUD() {
    const s = this.g.state, g = this.g;
    const lv = g.levelDef();
    this.el.lvlNum.textContent = s.careerMode ? '★' : s.level;
    this.el.rank.textContent = g.rankName();
    this.el.ttl.textContent = s.careerMode ? tp('lvl.career') : String(lv.title);
    this.el.xp.style.width = clamp(g.levelProgressFrac() * 100, 0, 100) + '%';
    const set = (el, chip, v) => { if (el.textContent !== v) { el.textContent = v; chip.classList.remove('bump'); void chip.offsetWidth; chip.classList.add('bump'); } };
    set(this.el.money, this.el.chipMoney, fmtMoney(s.money));
    set(this.el.rep, this.el.chipRep, String(Math.round(s.reputation)));
    set(this.el.safe, this.el.chipSafe, Math.round(s.safety) + '%');
    this.root.classList.toggle('left', g.settings.handed === 'left');
    this.hud.classList.toggle('left', g.settings.handed === 'left');
    if (!this.el.joy.classList.contains('active')) this.el.joy.classList.toggle('right', g.settings.handed === 'left');
    this.el.viewBtn.classList.toggle('on', !!g.settings.firstPerson);
    this.el.guideBtn.classList.toggle('on', !!g.settings.guided);
  }
  setObjective(text, step = '', ic = 'flag') {
    if (this.el.objTxt.textContent !== text) { this.el.obj.classList.remove('pulse'); void this.el.obj.offsetWidth; this.el.obj.classList.add('pulse'); }
    this.el.objTxt.textContent = text; this.el.objStep.textContent = step ? `· ${step}` : '';
    this.el.objIc.innerHTML = icon(ic, 16);
  }
  setContext(label, ic = 'hand') {
    if (!label) { this.el.act.classList.add('off'); return; }
    this.el.act.classList.remove('off');
    if (this.el.actLab.textContent !== label) { this.el.actLab.textContent = label; this.el.actBtn.innerHTML = icon(ic, 34); }
  }
  hideJoyHint() { this.el.joyHint.classList.add('hidden'); }
  setFPS(v) { this.fpsEl.classList.toggle('hidden', !this.g.settings.showFps); if (this.g.settings.showFps) this.fpsEl.textContent = v; }

  toast(msg, tone = '', ic = 'info', ms = 2800) {
    msg = String(msg);
    if (this.stack.length || this.root.classList.contains('letterbox')) { this._tq = this._tq || []; if (this._tq.length < 6 && !this._tq.some((q) => q[0] === msg)) this._tq.push([msg, tone, ic, ms]); return; }
    if ([...this.toasts.children].some((c) => c.dataset.msg === msg)) return;
    const el = h('div', { class: 'toast ' + tone, dataset: { msg, tone, ic, ms: String(ms) } }, h('span', { class: 'icw', html: icon(ic, 18) }), h('span', {}, msg));
    this.toasts.appendChild(el);
    while (this.toasts.children.length > 2) this.toasts.firstChild.remove();
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 400); }, ms);
  }
  parkToasts() {
    const vis = [...this.toasts.children].filter((x) => !x.classList.contains('out'));
    if (!vis.length) return;
    this._tq = this._tq || [];
    for (const x of vis) { if (!this._tq.some((q) => q[0] === x.dataset.msg)) this._tq.push([x.dataset.msg, x.dataset.tone, x.dataset.ic, +x.dataset.ms || 2800]); x.remove(); }
  }
  flushToasts() {
    if (this.stack.length || !this._tq || !this._tq.length || this.root.classList.contains('letterbox')) return;
    const q = this._tq; this._tq = [];
    q.slice(-2).forEach((x, i) => setTimeout(() => this.toast(...x), 350 + i * 700));
  }
  subtitle(who, text, ms = 3500) {
    if (!this.g.settings.subtitles) return;
    this.sub.innerHTML = ''; this.sub.append(h('b', {}, who + ':'), text);
    this.sub.classList.remove('hidden');
    clearTimeout(this._subT);
    this._subT = setTimeout(() => this.sub.classList.add('hidden'), ms);
  }
  hideSubtitle() { this.sub.classList.add('hidden'); }

  // ───────────────────────── Modal stack ─────────────────────────
  modal({ cls = '', eyebrow = '', title = '', body, foot, onClose, dismissable = true, noHead = false, raw = false } = {}) {
    const wrap = h('div', { class: 'mwrap', style: { position: 'absolute', inset: 0 } });
    const bd = h('div', { class: 'backdrop' });
    const close = (silent) => {
      if (!wrap.isConnected) return;
      wrap.remove(); this.stack.splice(this.stack.indexOf(api), 1);
      this._syncTitle();
      if (!silent) onClose?.();
      this.g.onModalChange?.();
      setTimeout(() => this.flushToasts(), 50);
    };
    if (dismissable) bd.addEventListener('click', () => { this.g.audio.sfx('click'); close(); });
    let m;
    if (raw) m = body;
    else {
      m = h('div', { class: 'modal ' + cls, role: 'dialog' });
      if (!noHead) m.append(h('div', { class: 'm-head' }, h('div', { style: { flex: 1, minWidth: 0 } }, eyebrow ? h('span', { class: 'eyebrow' }, eyebrow) : null, h('h2', {}, title)),
        dismissable ? h('button', { class: 'xbtn', 'aria-label': t('common.close'), onclick: () => { this.g.audio.sfx('click'); close(); }, html: icon('close', 20) }) : null));
      const b = h('div', { class: 'm-body' }); if (body) b.append(body); m.append(b);
      if (foot) m.append(h('div', { class: 'm-foot' }, foot));
    }
    wrap.append(bd, m);
    this.parkToasts();
    this.layer.appendChild(wrap);
    const api = { el: m, wrap, close, cls };
    this.stack.push(api);
    this._syncTitle();
    this.g.audio.sfx('whoosh', { vol: 0.6 });
    this.g.onModalChange?.();
    return api;
  }
  closeAll() { [...this.stack].forEach((m) => m.close(true)); }
  get modalOpen() { return this.stack.length > 0; }
  get fullCover() { return this.stack.some((m) => m.cls.includes('full')); }

  // ───────────────────────── Loading / language / title / notice ─────────────────────────
  hideLoading() { const l = document.querySelector('.loading'); if (l) { l.classList.add('out'); setTimeout(() => l.remove(), 700); } }

  langSwitch(compact = false, onChange = null) {
    const g = this.g, cur = getLang();
    const b = (code, label, extra = {}) => h('button', { class: cur === code ? 'on' : '', 'aria-pressed': String(cur === code), onclick: () => { if (getLang() === code) return; g.audio.sfx('click'); g.setLanguage(code); onChange?.(); }, ...extra }, label);
    return h('div', { class: 'lang-switch' + (compact ? ' compact' : ''), role: 'group', 'aria-label': 'Language / மொழி' },
      b('en', 'English'), b('ta', 'தமிழ்', { lang: 'ta' }), b('bi', 'தமிழ் + EN', { lang: 'ta' }));
  }
  syncSprint() { const on = !!this.g.input?.sprint; this.el.sprint?.classList.toggle('on', on); this.el.sprint?.setAttribute('aria-pressed', String(on)); }
  /** Element whose [data-key] buttons respond to the keyboard: top modal → dialogue sheet → HUD. */
  keyScope() {
    const top = this.stack[this.stack.length - 1];
    if (top) return top.el;
    if (this._skip?.isConnected) { const b = this._skip; return { querySelectorAll: () => [b], querySelector: () => null }; }
    if (this.dlgSheet?.isConnected && !this.dlgSheet.classList.contains('hidden')) return this.dlgSheet;
    if (this._title?.isConnected) return this._title;
    if (this.g.mode === 'play' && !this.hud.classList.contains('off')) return this.hud;
    return null;
  }
  showLanguagePicker(onPick) {
    const g = this.g;
    const pick = (code) => { g.setLanguage(code, true); m.close(); onPick?.(); };
    const body = h('div', { class: 'lang-pick' },
      h('div', { class: 'notice-ic', html: SVG('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>', 30) }),
      h('p', { class: 'prose', style: { textAlign: 'center' } }, 'Choose your language', h('br'), h('span', { lang: 'ta' }, 'உங்கள் மொழியைத் தேர்ந்தெடுக்கவும்')),
      h('button', { class: 'lang-card', 'data-key': '1', 'data-kbd': '1', onclick: () => pick('en') }, h('b', {}, 'English'), h('span', {}, 'Play the whole game in English')),
      h('button', { class: 'lang-card', lang: 'ta', 'data-key': '2', 'data-kbd': '2', onclick: () => pick('ta') }, h('b', {}, 'தமிழ்'), h('span', {}, 'முழு விளையாட்டும் தமிழில்')),
      h('button', { class: 'lang-card', lang: 'ta', 'data-key': '3', 'data-kbd': '3', onclick: () => pick('bi') }, h('b', {}, 'தமிழ் + English'), h('span', {}, 'தமிழும் ஆங்கிலமும் சேர்த்து · Tamil with English below')));
    const m = this.modal({ title: 'Language · மொழி', body, dismissable: false });
  }

  showTitle({ hasSave, onContinue, onNew }) {
    this.showHUD(false);
    this._titleArgs = { hasSave, onContinue, onNew };
    if (this._title) this._title.remove();
    const s = this.g.state;
    const close = () => { el.remove(); this._title = null; };
    const inner = h('div', { class: 'title-inner' },
      this.langSwitch(true),
      h('div', { class: 'logo' }, h('div', { class: 'cross' }), h('div', {}, h('h1', {}, 'Rx', h('span', {}, 'Shift')), h('p', {}, t('title.subtitle')))),
      h('p', { class: 'tagline' }, t('title.tagline')),
      hasSave ? h('button', { class: 'btn primary', ...K('Enter', '↵'), onclick: () => { this.g.audio.init(); this.g.audio.sfx('tap'); close(); onContinue(); } }, h('span', { class: 'icw', html: icon('play', 20) }), t('title.continue'), h('small', { style: { marginLeft: 'auto' } }, s.careerMode ? t('lvl.career') : t('lvl.levelN', { n: s.level }))) : null,
      h('button', { class: hasSave ? 'btn ghost' : 'btn primary', ...(hasSave ? K('n') : K('Enter', '↵')), onclick: () => { this.g.audio.init(); this.g.audio.sfx('tap'); if (hasSave) this.confirm(t('title.newConfirm'), t('title.newConfirmText'), t('title.startNew'), () => { close(); onNew(); }); else { close(); onNew(); } } }, h('span', { class: 'icw', html: icon('sparkle', 20) }), hasSave ? t('title.newGame') : t('title.start')),
      h('button', { class: 'btn ghost', onclick: () => { this.g.audio.sfx('tap'); this.g.setLayout(this.g.settings.layout === 2 ? 1 : 2); } }, h('span', { class: 'icw', html: SVG('<path d="M3 10l1.5-5h15L21 10"/><path d="M4 10v10h16V10"/><path d="M10 20v-5h4v5"/><path d="M3 10h18"/>') }), t(this.g.settings.layout === 2 ? 'title.medical1' : 'title.medical2'), h('small', { style: { marginLeft: 'auto' } }, t(this.g.settings.layout === 2 ? 'title.layoutNow2' : 'title.layoutNow1'))),
      h('button', { class: 'btn ghost', onclick: () => { this.g.audio.init(); this.showTraining(); } }, h('span', { class: 'icw', html: icon('book', 20) }), t('menu.training')),
      h('button', { class: 'btn ghost', onclick: () => { this.g.audio.init(); this.showSettings(); } }, h('span', { class: 'icw', html: icon('gear', 20) }), t('menu.settings')),
      h('button', { class: 'btn ghost', onclick: () => this.showAbout() }, h('span', { class: 'icw', html: icon('info', 20) }), t('menu.about')),
      this.g.canFullscreen() ? h('button', { class: 'btn ghost', onclick: () => { this.g.audio.init(); this.g.toggleFullscreen(); } }, h('span', { class: 'icw', html: SVG('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>') }), t('title.fullscreen')) : null,
      h('div', { class: 'foot' }, t('title.foot')));
    const el = h('div', { class: 'title' }, inner);
    // below the modal layer: settings / training / about open on top of the title, not under its dark overlay
    this.root.insertBefore(el, this.layer);
    this._title = el;
    this._syncTitle();
  }
  refreshTitle() { if (this._title && this._titleArgs) this.showTitle(this._titleArgs); }
  /** The lobby menu steps aside while a panel (training, settings, about, confirm…) is open over it. */
  _syncTitle() { this._title?.classList.toggle('covered', this.stack.length > 0); }

  showNotice(onAccept) {
    const body = h('div', { class: 'prose' },
      h('div', { class: 'notice-ic', html: icon('shield', 30) }),
      h('p', {}, h('b', {}, t('notice.b1')), ' ', t('notice.p1')),
      h('ul', {}, h('li', {}, t('notice.l1')), h('li', {}, t('notice.l2')), h('li', {}, t('notice.l3'))),
      h('p', {}, t('notice.p2')));
    const m = this.modal({ title: t('notice.title'), eyebrow: t('notice.eyebrow'), body, dismissable: false,
      foot: h('button', { class: 'btn primary block', ...K('Enter', '↵'), onclick: () => { m.close(); onAccept(); } }, t('notice.ok')) });
  }
  showAbout() {
    const body = h('div', { class: 'prose' },
      h('p', {}, h('b', {}, t('about.name')), ' · v3.0'),
      h('p', {}, t('about.p1')),
      h('p', {}, t('about.content', { n: this.g.catalog.length, q: this.g.questionCount })),
      h('p', {}, t('about.safety')),
      h('p', {}, t('about.touch')),
      h('p', {}, t('about.keys')),
      h('p', {}, t('about.credits')));
    this.modal({ title: t('menu.about'), body });
  }
  confirm(title, text, okLabel, onOk, tone = 'primary') {
    const m = this.modal({ title, body: h('div', { class: 'prose' }, h('p', {}, text)),
      foot: [h('button', { class: 'btn ghost grow', onclick: () => m.close() }, t('common.cancel')), h('button', { class: `btn ${tone} grow`, ...K('Enter', '↵'), onclick: () => { m.close(); onOk(); } }, okLabel)] });
  }

  // ───────────────────────── Controls guide ─────────────────────────
  showControls(onDone) {
    const row = (ic, title, text) => h('div', { class: 'ctl-row' }, h('div', { class: 'ctl-ic', html: ic }), h('div', {}, h('b', {}, title), h('span', {}, text)));
    const S2 = (d) => SVG(d, 26);
    const KB = S2('<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>');
    if (document.documentElement.classList.contains('desktop')) {
      const pc = h('div', { class: 'ctl-list' },
        row(KB, t('ctl.keys'), t('ctl.keysT')),
        row(S2('<rect x="7" y="3" width="10" height="18" rx="5"/><path d="M12 7v4"/>'), t('ctl.pcLook'), t('ctl.pcLookT')),
        row(icon('hand', 26), t('ctl.pcAct'), t('ctl.pcActT')),
        row(S2('<path d="M9 11V5a2 2 0 0 1 4 0v6M13 10a2 2 0 0 1 4 0v4a7 7 0 0 1-14 0v-2a2 2 0 0 1 4 0"/>'), t('ctl.pcTap'), t('ctl.pcTapT')),
        row(icon('tray', 26), t('ctl.pick'), t('ctl.pickT')),
        row(MENTOR_IC, t('ctl.guide'), t('ctl.guideT')));
      const m = this.modal({ title: t('ctl.title'), eyebrow: t('ctl.eyebrow'), body: pc, cls: 'wide', onClose: () => onDone?.(), foot: h('button', { class: 'btn primary block', ...K('Enter', '↵'), onclick: () => m.close() }, t('common.gotIt')) });
      return;
    }
    const body = h('div', { class: 'ctl-list' },
      row(S2('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.5" fill="currentColor"/>'), t('ctl.move'), t('ctl.moveT')),
      row(S2('<path d="M4 12h16M14 6l6 6-6 6"/>'), t('ctl.look'), t('ctl.lookT')),
      row(S2('<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 3v6h6"/>'), t('ctl.cam'), t('ctl.camT')),
      row(icon('hand', 26), t('ctl.act'), t('ctl.actT')),
      row(S2('<path d="M9 11V5a2 2 0 0 1 4 0v6M13 10a2 2 0 0 1 4 0v4a7 7 0 0 1-14 0v-2a2 2 0 0 1 4 0"/>'), t('ctl.tap'), t('ctl.tapT')),
      row(icon('tray', 26), t('ctl.pick'), t('ctl.pickT')),
      row(MENTOR_IC, t('ctl.guide'), t('ctl.guideT')),
      row(KB, t('ctl.keys'), t('ctl.keysT')));
    const m = this.modal({ title: t('ctl.title'), eyebrow: t('ctl.eyebrow'), body, cls: 'wide', onClose: () => onDone?.(), foot: h('button', { class: 'btn primary block', ...K('Enter', '↵'), onclick: () => m.close() }, t('common.gotIt')) });
  }

  // ───────────────────────── Guide (mentor) panel ─────────────────────────
  showGuide() {
    const g = this.g;
    const G = g.guide.build();
    const body = h('div', { class: 'guide-panel' });
    body.append(h('div', { class: 'mentor-head' }, h('div', { class: 'mentor-av', html: MENTOR_IC }), h('div', {}, h('b', {}, t('guide.mentor')), h('span', {}, G.intro))));
    const list = h('ol', { class: 'gsteps' });
    G.steps.forEach((st) => {
      const li = h('li', { class: 'gstep ' + st.state },
        h('span', { class: 'gnum', html: st.state === 'done' ? icon('check', 14) : '' }),
        h('div', { class: 'gtext' }, h('div', {}, st.text), st.sub ? h('small', {}, st.sub) : null,
          st.actions?.length ? h('div', { class: 'gacts' }, st.actions.map((a, ai) => h('button', { class: 'btn ' + (a.primary ? 'primary' : 'soft'), ...(st.state === 'now' && ai === 0 ? K('Enter', '↵') : {}), onclick: () => { m.close(); a.fn(); } }, a.icon ? h('span', { class: 'icw', html: icon(a.icon, 16) }) : null, a.label))) : null));
      list.append(li);
    });
    body.append(list);
    if (G.why) body.append(h('div', { class: 'learn', style: { marginTop: '10px' } }, h('b', { html: icon('book', 14) + ' ' + t('guide.why') }), G.why));
    body.append(h('div', { class: 'set-row', style: { borderBottom: 0 } }, h('div', {}, t('set.guided'), h('small', {}, t('set.guidedSub'))),
      h('button', { class: 'toggle' + (g.settings.guided ? ' on' : ''), role: 'switch', onclick: (e) => { g.settings.guided = !g.settings.guided; e.currentTarget.classList.toggle('on', g.settings.guided); g.applySettings(); this.refreshDialogue?.(); } })));
    const m = this.modal({ title: G.title, eyebrow: t('guide.eyebrow'), body, cls: 'wide' });
  }

  // ───────────────────────── Menu ─────────────────────────
  showMenu() {
    const g = this.g;
    const item = (ic, tt, sub, fn, extra = {}) => h('button', { class: 'mitem' + (extra.locked ? ' locked' : ''), onclick: () => { g.audio.sfx('tap'); fn(); } }, h('span', { class: 'icw', html: ic.startsWith('<') ? ic : icon(ic, 20) }), h('div', {}, tt, sub ? h('small', {}, sub) : null), extra.right ? h('span', { class: 'right' }, extra.right) : null);
    const list = h('div', { class: 'menu-list' },
      item('play', t('menu.resume'), t('menu.resumeSub'), () => m.close()),
      item(MENTOR_IC, t('hud.guide'), t('menu.guideSub'), () => { m.close(); this.showGuide(); }),
      item('flag', t('menu.path'), t('menu.pathSub'), () => this.showLevels()),
      item('hand', t('ctl.title'), t('menu.controlsSub'), () => this.showControls()),
      item('chart', t('menu.stats'), t('menu.statsSub'), () => this.showStats()),
      item('book', t('menu.training'), t('menu.trainingSub'), () => this.showTraining()),
      item('sparkle', t('menu.upgrades'), t('menu.upgradesSub'), () => this.showUpgrades()),
      item('trophy', t('menu.achievements'), t('menu.achSub', { n: Object.keys(g.state.achievements).length, total: ACHIEVEMENTS.length }), () => this.showAchievements()),
      item('gear', t('menu.settings'), t('menu.settingsSub'), () => this.showSettings()),
      item('info', t('menu.about'), '', () => this.showAbout()),
      document.documentElement.classList.contains('native') ? null : item('home', isTA() ? 'முகப்புப் பக்கம்' : 'Home page', 'Browser · APK · Desktop', () => { m.close(); window.location.href = window.location.pathname; }), // (the apps have no website home)
      item('door', t('menu.exit'), g.lastSaveText(), () => { m.close(); g.exitToTitle(); }));
    const m = this.modal({ title: t('menu.title'), eyebrow: t('menu.paused'), body: h('div', {}, this.langSwitch(false, () => { m.close(true); this.showMenu(); }), list) });
  }

  // ───────────────────────── Stats ─────────────────────────
  showStats() {
    const g = this.g, s = g.state;
    const blocks = (v) => { const n = Math.round(clamp(v, 0, 100) / 10); return '█'.repeat(n) + '░'.repeat(10 - n); };
    const bar = (cls, label, v) => h('div', { class: 'sbar ' + cls }, h('label', {}, h('span', {}, label), h('span', { class: 'blocks' }, blocks(v) + ' ' + Math.round(v) + '%')), h('div', { class: 'track' }, h('i', { style: { width: clamp(v, 0, 100) + '%' } })));
    const ready = g.inspectionReady();
    const body = h('div', {},
      h('div', { class: 'statgrid' },
        bar('safe', t('stats.safety'), s.safety),
        bar('sat', t('stats.satisfaction'), s.satisfaction),
        bar('rep', t('stats.reputation'), s.reputation),
        bar('stock', t('stats.stock'), g.stockLevel())),
      h('div', { class: 'kpis', style: { marginTop: '14px' } },
        h('div', { class: 'kpi' }, h('b', {}, fmtMoney(s.dailyRevenue)), h('span', {}, t('stats.revenue'))),
        h('div', { class: 'kpi' }, h('b', {}, String(s.served)), h('span', {}, t('stats.served'))),
        h('div', { class: 'kpi' }, h('b', {}, String(s.referralsCorrect)), h('span', {}, t('stats.referrals')))),
      h('div', { class: 'set-row', style: { marginTop: '10px' } }, h('div', {}, t('stats.readiness'), h('small', {}, ready.why)), h('span', { class: 'ready ' + (ready.ok ? 'yes' : 'no') }, ready.ok ? t('stats.ready') : t('stats.notReady'))),
      h('div', { class: 'set-row' }, h('div', {}, t('stats.passed'), h('small', {}, s.inspection.certified ? t('stats.certified') : t('stats.notCertified'))), h('b', {}, String(s.inspection.passed))),
      h('div', { class: 'set-row' }, h('div', {}, t('stats.streak')), h('b', {}, String(s.safeStreak))),
      h('p', { class: 'edu-note' }, h('span', { class: 'icw', html: icon('info', 14) }), t('stats.note')));
    this.modal({ title: t('stats.title'), eyebrow: t('stats.day', { n: s.day }), body });
  }

  // ───────────────────────── Levels ─────────────────────────
  showLevels() {
    const g = this.g, s = g.state;
    const cur = LEVELS[s.level - 1];
    const body = h('div', {});
    if (!s.careerMode) {
      const objs = h('ul', { class: 'objlist' }, cur.objectives.map((o, i) => {
        const st = s.levelObjectives?.[i] || {};
        const cnt = o.count ? ` (${Math.min(st.count || 0, o.count)}/${o.count})` : '';
        return h('li', { class: st.done ? 'done' : '' }, h('span', { class: 'ck', html: st.done ? icon('check', 14) : '' }), o.label + cnt);
      }));
      body.append(h('div', { class: 'learn' }, h('b', { html: icon('flag', 14) + ' ' + t('lvl.current') }), h('div', { style: { fontWeight: 800, fontSize: '1.05em' } }, t('lvl.levelTitle', { n: cur.n, title: cur.title })), h('div', { style: { marginTop: '4px' } }, cur.intro), objs));
    } else body.append(h('div', { class: 'learn' }, h('b', {}, t('lvl.career')), t('lvl.careerText')));
    body.append(h('h4', { class: 'sec-label' }, t('lvl.path')));
    for (const L of LEVELS) {
      const done = s.careerMode || L.n < s.level, curr = !s.careerMode && L.n === s.level;
      const row = h('div', { class: 'lvl-row' + (done ? ' done' : curr ? ' cur' : '') }, h('div', { class: 'n', html: done ? icon('check', 16) : String(L.n) }), h('div', { class: 't' }, L.title, h('small', {}, (done || curr) ? t('lvl.unlocks', { list: L.unlock.join(', ') }) : t('lvl.locked'))));
      if (g.settings.demoTools && !curr) row.append(h('button', { class: 'btn soft', style: { minHeight: '36px', fontSize: '.72em' }, onclick: () => { m.close(); g.jumpToLevel(L.n); } }, t('lvl.jump')));
      body.append(row);
    }
    const m = this.modal({ title: t('menu.path'), eyebrow: g.rankName(), body });
  }
  showLevelIntro(L, onGo) {
    const body = h('div', {},
      h('div', { class: 'oc-top' }, h('div', { class: 'oc-badge good', html: `<b style="font-size:1.7em">${L.n}</b>` }), h('div', { class: 'oc-label good' }, t('lvl.levelOf', { n: L.n })), h('div', { class: 'oc-title' }, L.title)),
      h('p', { class: 'prose', style: { textAlign: 'center' } }, L.intro),
      h('ul', { class: 'objlist' }, L.objectives.map((o) => h('li', {}, h('span', { class: 'ck' }), o.label))));
    const m = this.modal({ noHead: true, body, dismissable: false, foot: h('button', { class: 'btn primary block', ...K('Enter', '↵'), onclick: () => { m.close(); onGo(); } }, h('span', { class: 'icw', html: icon('play', 18) }), t('common.start')) });
  }
  showLevelComplete(L, onNext) {
    this.g.audio.sfx('levelup');
    const next = LEVELS[L.n];
    const body = h('div', {},
      h('div', { class: 'oc-top' }, h('div', { class: 'oc-badge good', html: icon('trophy', 38) }), h('div', { class: 'oc-label good' }, t('lvl.complete')), h('div', { class: 'oc-title' }, L.title)),
      h('div', { class: 'learn' }, h('b', { html: icon('sparkle', 14) + ' ' + t('lvl.unlocked') }), L.unlock.join(' · ')),
      h('p', { class: 'prose', style: { textAlign: 'center', marginTop: '12px' } }, next ? t('lvl.next', { n: next.n, title: next.title }) : t('lvl.allDone')));
    const m = this.modal({ noHead: true, body, dismissable: false, foot: h('button', { class: 'btn primary block', ...K('Enter', '↵'), onclick: () => { m.close(); onNext(); } }, t('common.continue')) });
  }

  // ───────────────────────── Upgrades ─────────────────────────
  showUpgrades() {
    const g = this.g, s = g.state;
    const body = h('div', { class: 'menu-list' });
    const render = () => {
      body.innerHTML = '';
      body.append(h('div', { class: 'set-row' }, h('div', {}, t('up.funds')), h('b', {}, fmtMoney(s.money))));
      for (const u of UPGRADES) {
        const owned = !!s.upgrades[u.id];
        const locked = !g.settings.demoTools && (s.careerMode ? false : s.level < u.level);
        const active = (u.type === 'outfit' && s.outfit === u.id) || (u.type === 'environment' && (s.theme === u.id || (u.id === 'expansion' && owned)));
        const btn = locked ? h('span', { class: 'right' }, h('span', { class: 'icw', html: icon('lock', 14) }), ' ' + t('lvl.levelN', { n: u.level }))
          : owned ? (u.type === 'equipment' || u.id === 'expansion' ? h('span', { class: 'right' }, t('up.owned')) : h('button', { class: 'btn soft', style: { minHeight: '38px', fontSize: '.76em' }, onclick: () => { g.applyUpgrade(u, true); render(); } }, active ? t('up.active') : t('up.use')))
          : h('button', { class: 'btn primary', style: { minHeight: '38px', fontSize: '.76em' }, disabled: s.money < u.cost, onclick: () => { if (g.buyUpgrade(u)) render(); } }, u.cost ? fmtMoney(u.cost) : t('up.free'));
        body.append(h('div', { class: 'mitem' + (locked ? ' locked' : '') }, h('span', { class: 'icw', html: icon(u.type === 'outfit' ? 'user' : u.type === 'equipment' ? 'device' : 'door', 20) }), h('div', { style: { flex: 1, minWidth: 0 } }, u.name, h('small', {}, u.desc)), btn));
      }
    };
    render();
    this.modal({ title: t('menu.upgrades'), eyebrow: t('up.eyebrow'), body });
  }
  showAchievements() {
    const s = this.g.state;
    const body = h('div', {}, ACHIEVEMENTS.map((a) => h('div', { class: 'ach' + (s.achievements[a.id] ? ' got' : '') }, h('span', { class: 'icw', html: icon(s.achievements[a.id] ? 'trophy' : 'lock', 20) }), h('div', {}, h('b', {}, a.name), h('span', {}, a.desc)))));
    this.modal({ title: t('menu.achievements'), body });
  }

  // ───────────────────────── Training library ─────────────────────────
  showTraining() {
    const g = this.g, s = g.state;
    const body = h('div', {});
    body.append(h('div', { class: 'learn', style: { marginBottom: '12px' } }, h('b', { html: icon('book', 14) + ' ' + t('train.prep') }), t('train.prepText'), ' ', h('strong', {}, `${s.practiceBest}/10`)));
    body.append(h('button', { class: 'btn primary block', style: { marginBottom: '12px' }, onclick: () => { m.close(); this.startPractice(); } }, h('span', { class: 'icw', html: icon('play', 18) }), t('train.practice')));
    const list = h('div', { class: 'menu-list' });
    for (const mod of MODULES) {
      const done = s.modulesDone.includes(mod.id);
      list.append(h('button', { class: 'mitem', onclick: () => this.showModule(mod, () => { m.close(); this.showTraining(); }) }, h('span', { class: 'icw', html: icon(mod.icon, 20) }), h('div', { style: { minWidth: 0 } }, mod.title, h('small', {}, t('train.facts', { n: mod.facts.length }))), h('span', { class: 'right', html: done ? `<span style="color:var(--good)">${icon('check', 18)}</span>` : t('train.study') })));
    }
    body.append(list);
    const m = this.modal({ title: t('menu.training'), eyebrow: t('train.eyebrow'), body, cls: 'wide' });
  }
  showModule(mod, onDone) {
    const g = this.g;
    const body = h('div', {}, h('ul', { class: 'modfacts' }, mod.facts.map((f) => h('li', {}, h('span', { class: 'icw', html: icon('check', 16) }), h('span', {}, f)))),
      h('p', { class: 'edu-note' }, h('span', { class: 'icw', html: icon('info', 14) }), t('train.modNote')));
    const m = this.modal({ title: mod.title, eyebrow: t('train.module'), body,
      foot: h('button', { class: 'btn primary block', ...K('Enter', '↵'), onclick: () => { g.completeModule(mod.id); m.close(); onDone?.(); } }, h('span', { class: 'icw', html: icon('check', 18) }), t('train.mark')) });
  }
  startPractice() {
    const g = this.g;
    const qs = g.drawQuestions(10);
    let i = 0, score = 0;
    const next = () => {
      if (i >= qs.length) {
        g.recordPractice(score);
        const body = h('div', { class: 'oc-top' }, h('div', { class: 'result-big' + (score < 8 ? ' fail' : '') }, `${score}/10`), h('div', { class: 'oc-title' }, score === 10 ? t('train.perfect') : score >= 8 ? t('train.great') : t('train.keep')), h('p', { class: 'prose' }, t('train.remember')));
        const m = this.modal({ noHead: true, body, foot: [h('button', { class: 'btn ghost grow', onclick: () => { m.close(); this.showTraining(); } }, t('train.library')), h('button', { class: 'btn primary grow', onclick: () => { m.close(); this.startPractice(); } }, t('train.again'))] });
        return;
      }
      this.quizCard({ q: qs[i], index: i, total: qs.length, mode: 'practice', streak: score, onAnswer: (ok) => { if (ok) score++; i++; next(); } });
    };
    next();
  }

  // ───────────────────────── Settings ─────────────────────────
  showSettings() {
    const g = this.g, S = g.settings;
    const body = h('div', {});
    const sec = (tt, ...rows) => h('div', { class: 'set-sec' }, h('h4', {}, tt), ...rows);
    const tog = (key, label, sub) => { const b = h('button', { class: 'toggle' + (S[key] ? ' on' : ''), role: 'switch', 'aria-checked': String(!!S[key]), 'aria-label': label, onclick: () => { S[key] = !S[key]; b.classList.toggle('on', S[key]); b.setAttribute('aria-checked', String(S[key])); g.applySettings(); } }); return h('div', { class: 'set-row' }, h('div', {}, label, sub ? h('small', {}, sub) : null), b); };
    const seg = (key, label, opts) => { const wrap = h('div', { class: 'seg' }); const draw = () => { wrap.innerHTML = ''; opts.forEach(([v, l]) => wrap.append(h('button', { class: S[key] === v ? 'on' : '', onclick: () => { S[key] = v; draw(); g.applySettings(); } }, l))); }; draw(); return h('div', { class: 'set-row wrap' }, h('div', {}, label), wrap); };
    const rng = (key, label) => { const r = h('input', { type: 'range', min: 0, max: 1, step: 0.05, value: S[key], 'aria-label': label }); r.addEventListener('input', () => { S[key] = +r.value; g.applySettings(false); }); r.addEventListener('change', () => { g.applySettings(); g.audio.sfx('click'); }); return h('div', { class: 'set-row' }, h('div', {}, label), r); };
    body.append(
      sec(t('set.language'), h('div', { class: 'set-row wrap' }, h('div', {}, 'Language · மொழி'), this.langSwitch(true, () => { this.closeAll(); this.showSettings(); }))),
      sec(t('set.help'), tog('guided', t('set.guided'), t('set.guidedSub'))),
      sec(t('set.access'),
        seg('textScale', t('set.textSize'), [[0.9, 'S'], [1, 'M'], [1.15, 'L'], [1.3, 'XL']]),
        tog('subtitles', t('set.subtitles'), t('set.subtitlesSub')),
        tog('colorSafe', t('set.colorSafe'), t('set.colorSafeSub')),
        tog('reducedMotion', t('set.reduced'), t('set.reducedSub')),
        tog('haptics', t('set.haptics')),
        seg('handed', t('set.layout'), [['right', t('set.right')], ['left', t('set.left')]])),
      sec(t('set.audio'), rng('master', t('set.master')), rng('sfx', t('set.sfx')), rng('music', t('set.music')), rng('voice', t('set.voice')), tog('voiceDialogue', t('set.voiceDlg'), t('set.voiceDlgSub'))),
      sec(t('set.camera'),
        rng('camSensitivity', t('set.sens')),
        tog('invertY', t('set.invert')),
        tog('autoCamera', t('set.autoCam')),
        tog('firstPerson', t('set.firstPerson'))),
      sec(t('set.graphics'),
        seg('quality', t('set.quality'), [['low', t('q.low')], ['medium', t('q.medium')], ['high', t('q.high')], ['ultra', t('q.ultra')], ['auto', t('q.auto')]]),
        h('div', { class: 'set-row', style: { borderBottom: 0, paddingTop: 0 } }, h('small', {}, t('set.qualityNote'))),
        tog('adaptiveRes', t('set.adaptive'), t('set.adaptiveSub')),
        h('div', { class: 'set-row' }, h('div', {}, t('set.real'), h('small', {}, t('set.realSub'))), h('button', { class: 'toggle' + (g.settings.realHumans !== false ? ' on' : ''), role: 'switch', onclick: () => { g.settings.realHumans = g.settings.realHumans === false; g.saveSettingsNow(); g.save(); setTimeout(() => location.reload(), 300); } })),
        g.canFullscreen() ? h('div', { class: 'set-row' }, h('div', {}, t('title.fullscreen'), h('small', {}, t('set.fsSub'))), h('button', { class: 'btn soft', style: { minHeight: '38px' }, onclick: () => g.toggleFullscreen() }, t('set.toggle'))) : null,
        seg('fpsCap', t('set.fps'), [[30, t('set.fps30')], [60, '60']]),
        tog('showFps', t('set.showFps')),
        tog('lodDebug', t('set.lod'), t('set.lodSub'))),
      sec(t('set.review'),
        tog('demoTools', t('set.demo'), t('set.demoSub')),
        S.demoTools ? h('div', { class: 'two', style: { marginTop: '8px' } },
          h('button', { class: 'btn soft', onclick: () => { this.closeAll(); g.startInspection({ official: false, force: true }); } }, t('set.dInspection')),
          h('button', { class: 'btn soft', onclick: () => { this.closeAll(); g.triggerEvent('fridge'); } }, t('set.dFridge')),
          h('button', { class: 'btn soft', onclick: () => { this.closeAll(); g.triggerEvent('expired'); } }, t('set.dExpired')),
          h('button', { class: 'btn soft', onclick: () => { this.closeAll(); g.forceCustomer(); } }, t('set.dCustomer'))) : null,
        h('button', { class: 'btn ghost block', style: { marginTop: '10px', color: 'var(--bad)' }, onclick: () => this.confirm(t('set.resetQ'), t('set.resetText'), t('set.reset'), () => g.resetSave(), 'danger') }, t('set.resetBtn'))));
    this.modal({ title: t('menu.settings'), body, cls: 'wide', onClose: () => g.saveSettingsNow() });
  }

  // ───────────────────────── Shared quiz card (practice + inspection) ─────────────────────────
  quizCard({ q, index, total, mode, onAnswer, streak = 0 }) {
    const g = this.g;
    let sel = -1, answered = false;
    const wrap = h('div', { class: 'quiz' });
    const fill = h('i', { style: { width: (index / total) * 100 + '%' } });
    const verdict = h('div', { class: 'verdict' });
    const submit = h('button', { class: 'btn primary', ...K('Enter', '↵'), disabled: true }, t('quiz.submit'));
    const opts = q.options.map((o, i) => h('button', { class: 'opt', ...K('abcd'[i] + ' ' + (i + 1), ''), onclick: () => { if (answered) return; sel = i; opts.forEach((x, j) => x.classList.toggle('sel', j === i)); submit.disabled = false; g.audio.sfx('click'); } }, h('span', { class: 'k' }, 'ABCD'[i]), h('span', {}, o)));
    const modTitle = (MODULES.find((m) => m.id === q.m) || {}).title || '';
    const explain = h('div', { class: 'learn hidden', style: { marginTop: '6px' } });
    const card = h('div', { class: 'qcard' },
      h('div', { class: 'qtop' }, h('span', { class: 'qn' }, t('quiz.qn', { n: String(index + 1).padStart(2, '0'), total })), h('div', { class: 'prog' }, fill), h('span', { class: 'streak' }, mode === 'inspection' ? t('quiz.correctN', { n: streak }) : t('quiz.scoreN', { n: streak }))),
      h('div', { class: 'qbody' }, h('div', { class: 'mod' }, (mode === 'inspection' ? t('quiz.insp') : t('quiz.practice')) + ' · ' + modTitle), h('h3', {}, q.q), ...opts, explain),
      h('div', { class: 'qfoot' }, verdict, submit));
    wrap.append(card);
    this.parkToasts();
    this.layer.appendChild(wrap);
    const api = { el: wrap, close: () => { wrap.remove(); this.stack.splice(this.stack.indexOf(api), 1); g.onModalChange?.(); setTimeout(() => this.flushToasts(), 50); }, cls: 'quiz' };
    this.stack.push(api);
    g.onModalChange?.();
    submit.addEventListener('click', () => {
      if (sel < 0) return;
      if (answered) { api.close(); onAnswer(sel === q.a); return; }
      answered = true;
      const ok = sel === q.a;
      opts[q.a].classList.add('right');
      if (!ok) opts[sel].classList.add('wrong');
      opts.forEach((o) => { o.disabled = true; });
      verdict.className = 'verdict ' + (ok ? 'good' : 'bad');
      verdict.innerHTML = (ok ? icon('check', 20) : icon('x', 20)) + ' ' + (ok ? t('quiz.correct') : t('quiz.incorrect'));
      g.audio.sfx(ok ? 'correct' : 'incorrect');
      g.haptic(ok ? 'success' : 'error');
      fill.style.width = ((index + (ok ? 1 : 0)) / total) * 100 + '%';
      if (!ok || mode === 'practice') { explain.classList.remove('hidden'); explain.innerHTML = `<b>${icon('info', 14)} ${t('quiz.explanation')}</b>`; explain.append(q.x); }
      if (mode === 'inspection' && ok) { submit.textContent = t('quiz.next'); setTimeout(() => { if (wrap.isConnected) { api.close(); onAnswer(true); } }, 900); }
      else submit.textContent = mode === 'inspection' ? t('quiz.seeResult') : (index + 1 < total ? t('quiz.next') : t('quiz.finish'));
    });
    return api;
  }
}

Object.assign(UI.prototype, panelMethods);
