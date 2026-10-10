// The trailer's director. capture.mjs injects this into the running game page (dev server), then calls
// __promo.begin(shot) once and __promo.frame(shot, f, shoot) for every frame of each shot.
//
// Virtual clock: requestAnimationFrame, setTimeout/setInterval, performance.now and Date.now are replaced,
// so the game (which mixes dt-driven updates with wall-clock timers) advances exactly 1/30 s per frame.
// CSS transitions and animations are stepped the same way through the Web Animations API.
(() => {
  const g = window.__game, FPS = 30, STEP = 1000 / FPS;
  let SC = {}, LIP = {}, TXT = {}, T = (k) => k, skipAnims = 0;

  // ───────────────────────── virtual clock ─────────────────────────
  const realRAF = window.requestAnimationFrame.bind(window);
  let vt = performance.now(), seq = 1, rafQ = [];
  const timers = new Map();
  function installClock() {
    const date0 = Date.now() - vt;
    window.requestAnimationFrame = (cb) => { const id = seq++; rafQ.push({ id, cb }); return id; };
    window.cancelAnimationFrame = (id) => { rafQ = rafQ.filter((r) => r.id !== id); };
    window.setTimeout = (fn, ms = 0, ...a) => { const id = seq++; timers.set(id, { at: vt + Math.max(0, +ms || 0), fn: () => fn(...a) }); return id; };
    window.setInterval = (fn, ms = 0, ...a) => { const id = seq++; timers.set(id, { at: vt + Math.max(1, +ms || 0), fn: () => fn(...a), every: Math.max(1, +ms || 0) }); return id; };
    window.clearTimeout = window.clearInterval = (id) => { timers.delete(id); };
    performance.now = () => vt;
    Date.now = () => Math.round(date0 + vt);
  }
  function runTimers(until) {
    for (let guard = 0; guard < 5000; guard++) {
      let next = null, nid = 0;
      for (const [id, t] of timers) if (t.at <= until && (!next || t.at < next.at)) { next = t; nid = id; }
      if (!next) break;
      vt = Math.max(vt, next.at);
      if (next.every) next.at += next.every; else timers.delete(nid);
      try { next.fn(); } catch (e) { console.error('promo: timer', e); }
    }
    vt = until;
  }
  /** Advance CSS transitions / animations by ms (they are paused and driven by hand). */
  function stepAnimations(ms) {
    for (const a of document.getAnimations()) {
      if (a.playState === 'finished' || a.playState === 'idle') continue;
      const end = a.effect?.getComputedTiming().endTime;
      if (a.__vt === undefined) { a.pause(); a.__vt = 0; }
      a.__vt += ms;
      if (Number.isFinite(end) && a.__vt >= end) a.finish(); else a.currentTime = a.__vt;
    }
  }
  /** One 1/30 s step. render: draw it through the game's own loop (update + composer); else update only. */
  function step(render = true) {
    g.customers.spawnTimer = 999; // no surprise walk-ins: the director sends every customer
    runTimers(vt + STEP);
    stepAnimations(STEP);
    if (render) { const q = rafQ; rafQ = []; for (const r of q) { try { r.cb(vt); } catch (e) { console.error('promo: frame', e); } } } else g.update(1 / FPS);
  }
  const ff = (sec) => { for (let i = 0; i < Math.round(sec * FPS); i++) step(false); };
  const realFrame = () => new Promise((r) => realRAF(() => realRAF(r)));

  // ───────────────────────── helpers ─────────────────────────
  const V = (x, y, z) => g.rig.pos.clone().set(x, y, z);
  const lerp = (a, b, t) => a + (b - a) * t;
  const c01 = (x) => Math.max(0, Math.min(1, x));
  const smooth = (t) => t * t * (3 - 2 * t);
  const easeOut = (t) => 1 - Math.pow(1 - c01(t), 3);
  const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  function cam(p, l, fov = 50) {
    g.rig.setShot(V(...p), V(...l), { cut: true, fov });
    g.camera.fov = fov; g.camera.updateProjectionMatrix();
  }
  const $ui = () => document.getElementById('ui');
  const showUI = (on) => { $ui().style.visibility = on ? '' : 'hidden'; };
  function placePlayer(x, z, heading) {
    const P = g.player; P.stop?.(); P.path = null;
    P.group.position.set(x, 0, z); P.heading = heading; P.faceTo(heading);
  }
  function resetScene() {
    timers.clear();
    try { g.finishTalk(true); } catch {}
    g.ui.closeDialogue?.(true); g.ui.closeAll(); g.ui.cinema(false);
    g.customers.clearAll(); g.customers.hold = false;
    g.activeCustomer = null; g._speaker = null; g._cineTrack = null; g.mode = 'play';
    g.world.setMood?.('normal'); g.world.highlightShelf?.(null);
    if (g.inspector) g.inspector.group.visible = false;
    g.rig.clearShot(); g.player.lookTarget = null; g.player.say(false);
    const s = g.world.points.pharmService; placePlayer(s.x, s.z, 0);
    document.querySelectorAll('#ui .toasts > *').forEach((e) => e.remove());
  }
  /** Send in a customer; avatar: which visitor model plays them (else the game's own pick). */
  function customer(id, avatar) {
    const p = avatar && g.customers.pool.find((p) => !p.busy && p.char.desc?.avatar === avatar);
    if (p) p.lastUsed = -1e9;                             // _acquire takes the least recently used
    return g.customers.spawn(SC[id]);
  }
  /** Stand a customer somewhere in the shop (browsing a shelf, waiting in line). */
  function stand(c, x, z, heading, action) {
    const ch = c.char;
    ch.path = null; ch.onArrive = null; ch.group.position.set(x, 0, z); ch.heading = heading; ch.faceTo(heading);
    c.state = 'waiting';
    if (action) ch.setAction(action, 9999);
    return c;
  }
  let hushCss = null;
  /** Keep the game's own subtitle bar and toasts off camera. */
  function hush(on) {
    if (on && !hushCss) hushCss = document.head.appendChild(Object.assign(document.createElement('style'), { textContent: '#ui .subtitle, #ui .toasts { display: none !important; }' }));
    else if (!on && hushCss) { hushCss.remove(); hushCss = null; }
  }
  /** Put a customer at the counter now (what _goCounter does when the walk ends). */
  function toCounter(c) {
    const ch = c.char, M = g.customers;
    ch.path = null; ch.onArrive = null; ch.group.position.copy(g.world.points.service);
    ch.heading = Math.PI; ch.faceTo(Math.PI);
    M.counterCust = c; c.state = 'atCounter'; c.atCounterT = g.time; g.onCustomerAtCounter?.(c);
  }
  /** Lip-sync a character to a recorded line: its loudness per video frame (work/lip.json) drives the jaw. */
  function speakWith(ch, key, f) {
    const env = LIP[key] || [];
    g._speaker = ch; ch.say(true);
    g.audio.lipLevel = () => (f < env.length ? env[f] : 0);
  }
  function stopSpeaking(ch) { g.audio.lipLevel = () => null; g._speaker = null; ch.lip = null; ch.say(false); }

  // ───────────────────────── overlay (logo, captions, subtitles, end card) ─────────────────────────
  let O = {};
  function buildOverlay() {
    const css = `
#promo { position: fixed; inset: 0; z-index: 2147483000; pointer-events: none; overflow: hidden; color: #fff; font-family: "Inter", "Noto Sans Tamil", system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
#promo > * { position: absolute; opacity: 0; }
#promo .p-shade { inset: 0; background: linear-gradient(90deg, rgba(5,16,14,.93) 0%, rgba(5,16,14,.86) 34%, rgba(5,16,14,.5) 48%, rgba(5,16,14,0) 66%); }
#promo .p-shade-b { left: 0; right: 0; bottom: 0; height: 48%; background: linear-gradient(0deg, rgba(5,16,14,.86), rgba(5,16,14,0)); }
#promo .p-shade-l { left: 0; bottom: 0; width: 800px; height: 52%; background: radial-gradient(ellipse 100% 100% at 0% 100%, rgba(5,16,14,.9) 0%, rgba(5,16,14,.62) 45%, rgba(5,16,14,0) 100%); }
#promo .p-shade-t { left: 0; right: 0; top: 0; height: 40%; background: linear-gradient(180deg, rgba(5,16,14,.8), rgba(5,16,14,0)); }
#promo .p-fade { inset: 0; background: #05100e; }
#promo .p-cross { position: relative; flex: none; }
#promo .p-cross::before, #promo .p-cross::after { content: ''; position: absolute; background: linear-gradient(135deg, #3fe0c8, #0fa596); border-radius: 17%; }
#promo .p-cross::before { left: 32.5%; top: 0; width: 35%; height: 100%; }
#promo .p-cross::after { left: 0; top: 32.5%; width: 100%; height: 35%; }
#promo .p-logo { left: 76px; top: 50%; }
#promo .p-logo .p-row { display: flex; align-items: center; gap: 26px; }
#promo .p-logo .p-cross { width: 104px; height: 104px; }
#promo .p-logo h1 { margin: 0; font-size: 116px; line-height: 1; font-weight: 800; letter-spacing: -.035em; }
#promo .p-logo h1 span, #promo .p-end h1 span { color: #7fe0d4; }
#promo .p-logo .p-tag { margin-top: 20px; font-size: 23px; font-weight: 700; letter-spacing: .22em; text-transform: uppercase; color: #a9c4c0; }
#promo .p-logo .p-line { margin-top: 30px; max-width: 560px; font-size: 30px; line-height: 1.3; font-weight: 600; color: #e9f5f3; }
#promo .p-cap { left: 68px; bottom: 62px; max-width: 800px; }
#promo .p-cap.p-top { bottom: auto; top: 96px; max-width: 640px; }
#promo .p-cap .k { display: inline-block; margin-bottom: 12px; padding-left: 14px; border-left: 4px solid #14b8a6; font-size: 15px; font-weight: 800; letter-spacing: .16em; text-transform: uppercase; color: #7fe0d4; }
#promo .p-cap h2 { margin: 0; font-size: 50px; line-height: 1.1; font-weight: 800; letter-spacing: -.02em; text-shadow: 0 2px 20px rgba(0,0,0,.5); }
#promo .p-cap p { margin: 12px 0 0; font-size: 22px; line-height: 1.35; font-weight: 600; color: #d3ebe7; text-shadow: 0 1px 12px rgba(0,0,0,.6); }
#promo .p-say { left: 50%; bottom: 66px; width: 920px; margin-left: -460px; text-align: center; }
#promo .p-say .p-who { display: inline-block; margin-bottom: 12px; padding: 6px 14px; border-radius: 999px; background: #7fe0d4; color: #05100e; font-size: 15px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
#promo .p-say .p-txt { display: inline-block; padding: 16px 28px; border-radius: 20px; background: rgba(5,16,14,.8); font-size: 34px; line-height: 1.32; font-weight: 700; }
#promo .p-chips { right: 64px; top: 60px; display: flex; gap: 12px; }
#promo .p-chips span { padding: 10px 20px; border-radius: 999px; font-size: 22px; font-weight: 800; background: rgba(5,16,14,.72); border: 2px solid #1f4a45; color: #a9c4c0; }
#promo .p-chips span.on { background: #0fa596; border-color: #0fa596; color: #fff; }
#promo .p-chips { left: 236px; right: auto; top: 14px; }
#promo .p-chips span { font-size: 17px; padding: 8px 16px; }
#promo .p-tap { width: 46px; height: 46px; border-radius: 50%; border: 3px solid #fff; background: rgba(255,255,255,.22); box-shadow: 0 0 0 6px rgba(20,184,166,.35), 0 4px 14px rgba(0,0,0,.35); }
#promo .p-tap.down { background: rgba(20,184,166,.75); }
#promo .p-ring { border: 3px solid #ef4444; border-radius: 14px; box-shadow: 0 0 0 5px rgba(239,68,68,.22); }
#promo .p-end { inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; background: radial-gradient(1100px 620px at 50% 42%, rgba(20,80,74,.66), rgba(5,16,14,.9)); }
#promo .p-end .p-row { display: flex; align-items: center; gap: 24px; }
#promo .p-end .p-cross { width: 92px; height: 92px; }
#promo .p-end h1 { margin: 0; font-size: 104px; line-height: 1; font-weight: 800; letter-spacing: -.035em; }
#promo .p-end .p-tag { margin-top: 16px; font-size: 21px; font-weight: 700; letter-spacing: .22em; text-transform: uppercase; color: #a9c4c0; }
#promo .p-end .p-cta { margin-top: 44px; display: flex; gap: 18px; }
#promo .p-end .p-cta b { display: flex; align-items: center; gap: 12px; padding: 18px 30px; border-radius: 18px; font-size: 27px; font-weight: 800; }
#promo .p-end .p-cta b.a { background: linear-gradient(135deg, #14b8a6, #0b7f74); box-shadow: 0 10px 30px rgba(15,165,150,.4); }
#promo .p-end .p-cta b.b { background: #fff; color: #0b3d38; }
#promo .p-end .p-foot { margin-top: 34px; font-size: 22px; font-weight: 600; color: #a9c4c0; }
#promo .p-end .p-foot i { font-style: normal; color: #7fe0d4; padding: 0 10px; }`;
    document.head.appendChild(Object.assign(document.createElement('style'), { textContent: css }));
    const root = Object.assign(document.createElement('div'), { id: 'promo' });
    root.innerHTML = `
<div class="p-shade"></div><div class="p-shade-b"></div><div class="p-shade-l"></div><div class="p-shade-t"></div>
<div class="p-logo"><div class="p-row"><div class="p-cross"></div><h1>Rx<span>Shift</span></h1></div><div class="p-tag">Pharmacy Training Simulator</div><div class="p-line"></div></div>
<div class="p-cap"><span class="k"></span><h2></h2><p></p></div>
<div class="p-say"><div class="p-who"></div><br><div class="p-txt"></div></div>
<div class="p-chips"><span>English</span><span>தமிழ்</span></div>
<div class="p-end"><div class="p-row"><div class="p-cross"></div><h1>Rx<span>Shift</span></h1></div><div class="p-tag">Pharmacy Training Simulator</div>
  <div class="p-cta"><b class="a"><svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>Play free in your browser</b><b class="b"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 10l5 5 5-5M5 21h14"/></svg>Android app</b></div>
  <div class="p-foot">English<i>·</i>தமிழ்<i>·</i>Zrubix</div></div>
<div class="p-ring"></div><div class="p-tap"></div>
<div class="p-fade"></div>`;
    document.body.appendChild(root);
    for (const k of ['shade', 'shade-b', 'shade-l', 'shade-t', 'logo', 'cap', 'say', 'chips', 'end', 'fade', 'tap', 'ring']) O[k] = root.querySelector('.p-' + k);
  }
  /** Fade + rise an overlay element in at frame a and out at frame b. */
  function show(el, f, a, b, { fade = 10, rise = 26, base = '' } = {}) {
    const i = c01((f - a) / fade), o = c01((b - f) / fade);
    el.style.opacity = String(Math.min(smooth(i), smooth(o)));
    el.style.transform = `${base} translateY(${((1 - easeOut((f - a) / (fade * 1.6))) * rise).toFixed(2)}px)`;
  }
  /** A finger-tap marker on a UI element: arrives before frame f0, presses at f0. */
  function tap(el, f, f0) {
    if (!el || f < f0 - 14 || f > f0 + 12) return;
    const r = el.getBoundingClientRect(), t = O.tap, a = c01((f - (f0 - 14)) / 9), o = c01((f0 + 12 - f) / 6), down = f >= f0 && f < f0 + 5;
    t.style.left = (r.left + r.width / 2) + 'px'; t.style.top = (r.top + r.height / 2) + 'px';
    t.style.opacity = String(Math.min(a, o));
    t.style.transform = `translate(-50%, -50%) scale(${(down ? 0.7 : lerp(1.6, 1, easeOut(a))).toFixed(3)})`;
    t.classList.toggle('down', down);
  }
  /** A highlight frame around a UI element between frames a and b. */
  function ring(el, f, a, b) {
    if (!el || f < a || f > b) return;
    const r = el.getBoundingClientRect(), t = O.ring, pulse = 1 + Math.sin((f - a) * 0.32) * 0.012;
    Object.assign(t.style, { left: (r.left - 6) + 'px', top: (r.top - 6) + 'px', width: (r.width + 12) + 'px', height: (r.height + 12) + 'px', opacity: String(Math.min(c01((f - a) / 6), c01((b - f) / 6))), transform: `scale(${pulse.toFixed(4)})` });
  }
  const hide = (...ks) => { for (const k of ks) O[k].style.opacity = '0'; };
  const hideAll = () => hide('shade', 'shade-b', 'shade-l', 'shade-t', 'logo', 'cap', 'say', 'chips', 'end', 'fade', 'tap', 'ring');
  /** side: the caption sits beside the game's dialogue panel (narrower, its shade only over the 3D view). */
  function caption(f, a, b, k, title, sub = '', side = false) {
    const el = O.cap, top = false;
    el.classList.toggle('p-top', top);
    el.style.maxWidth = side ? '640px' : '';
    el.querySelector('.k').textContent = k; el.querySelector('h2').textContent = title;
    el.querySelector('p').textContent = sub; el.querySelector('p').style.display = sub ? '' : 'none';
    show(el, f, a, b);
    show(side ? O['shade-l'] : O['shade-b'], f, a - 2, b + 2, { rise: 0 });
  }
  function subtitle(f, a, b, who, text) {
    O.say.querySelector('.p-who').textContent = who; O.say.querySelector('.p-txt').textContent = text;
    show(O.say, f, a, b, { fade: 7, rise: 14 });
    show(O['shade-b'], f, a - 2, b + 2, { rise: 0 });
  }
  /** Dip to dark over the first / last n frames of a shot. */
  function dip(f, N, { head = 0, tail = 0 } = {}) {
    const a = head ? 1 - c01(f / head) : 0, b = tail ? c01((f - (N - 1 - tail)) / tail) : 0;
    O.fade.style.opacity = String(Math.max(smooth(a), smooth(b)));
  }

  // ───────────────────────── shots ─────────────────────────
  // Durations follow the narration (tools/promo/vo.py); build.py lays each line under its shot.
  const S = {};        // state shared between shots (the customer being served …)
  const SHOTS = [];
  const shot = (name, sec, def) => SHOTS.push({ name, frames: Math.round(sec * FPS), ...def });
  const q = (sel) => document.querySelector(sel);
  const byText = (sel, re) => [...document.querySelectorAll(sel)].find((e) => re.test(e.textContent));
  const KEYS = ['duration', 'symptoms', 'allergies', 'meds', 'history', 'lifestyle'];

  // 1. Title: push in from the entrance towards the counter and the PHARMACY sign; the logo comes up.
  shot('title', 5.4, {
    setup() {
      resetScene(); showUI(false);
      S.a = customer('S10', 'rbM02'); toCounter(S.a); S.a.char.say(true);
      S.b = stand(customer('S05', 'rbF05'), -1.25, -1.55, Math.PI);                  // next in the queue
      S.c = stand(customer('S14', 'visitorM2'), -2.2, 1.35, -Math.PI / 2, 'inspect');  // reading a pack at the first-aid shelves
      S.d = stand(customer('S18', 'visitorF2'), 4.6, 2.3, -Math.PI / 2, 'inspect');    // … and at the devices
      g.player.lookTarget = V(-1.2, 1.5, -2.85);
      ff(1.5);
    },
    frame(f, N) {
      const u = f / (N - 1);
      cam(mix([2.55, 1.72, 7.6], [2.1, 1.78, 3.9], u), mix([-1.3, 1.5, -6], [-1.5, 1.55, -6], u), lerp(54, 50, u));
      dip(f, N, { head: 14 });
      show(O.shade, f, 4, N + 30, { rise: 0, fade: 22 });
      show(O.logo, f, 14, N + 30, { fade: 16, rise: 34, base: 'translateY(-50%)' });
      const line = O.logo.querySelector('.p-line');
      line.textContent = 'Learn to serve patients safely, one shift at a time.';
      line.style.opacity = String(smooth(c01((f - 62) / 16)));
    },
    done() { S.a.char.say(false); },
  });

  // 2. The shop: along the tablet wall behind the counter, then in on the shelves across the floor.
  shot('shop', 5.4, {
    setup() { hideAll(); },
    frame(f, N) {
      const half = Math.round(N * 0.5);
      if (f < half) {
        const u = f / (half - 1), x = lerp(-3.3, 1.2, u);
        cam([x, 1.48, -6.35], [x + 1.25, 1.3, -8.77], 46);
        caption(f, 6, half - 2, 'The pharmacy', 'A complete 3D hospital pharmacy');
      } else {
        const u = (f - half) / (N - half - 1);
        cam(mix([0.75, 1.5, 3.1], [1.7, 1.32, 0.9], u), mix([3.18, 1.05, 1.5], [3.18, 1.02, 1.0], u), 44);
        caption(f, half + 4, N - 2, 'The shelves', 'Real medicine brands on every shelf');
      }
    },
  });

  // 3. Walk-in: patients come through the doors.
  shot('walkin', 3.3, {
    setup() {
      hideAll(); resetScene(); showUI(false);
      S.w1 = customer('S02', 'meena'); ff(2.6);
      S.w2 = customer('S06', 'visitorM1'); ff(1.5);
    },
    frame(f, N) {
      const u = f / (N - 1);
      if (f === 30) S.w3 = customer('S16', 'visitorF1');
      cam(mix([3.7, 1.52, 5.9], [3.4, 1.54, 5.2], u), mix([-0.3, 1.3, 9.0], [-0.6, 1.25, 6.8], u), 50);
      caption(f, 6, N - 2, 'The patients', 'Patients walk in with real problems');
    },
  });

  // 4. A patient speaks (the game's own recorded voice; the jaw follows its loudness).
  shot('speak', 4.1, {
    setup() {
      hideAll(); resetScene(); showUI(false);
      S.cust = customer('S01', 'visitorM1'); toCounter(S.cust); ff(1.2);
      S.cust.char.expression = 'pain';
      g.player.lookTarget = V(-1.2, S.cust.char.P.H - 0.12, -2.85);
    },
    frame(f, N) {
      const u = f / (N - 1), c = S.cust, head = c.char.P.H - 0.13;
      cam(mix([-1.92, head + 0.02, -4.32], [-1.84, head + 0.02, -4.2], u), [-1.17, head - 0.02, -2.85], 27);
      speakWith(c.char, 'en/S01', f - 8);
      subtitle(f, 6, N - 3, c.name, TXT['en/S01']);
    },
    done() { stopSpeaking(S.cust.char); },
  });

  // 5. The consultation: the real dialogue panel; two questions are asked.
  shot('ask', 6.0, {
    setup() {
      hideAll(); showUI(true);
      g.startConsultation(S.cust); ff(6.4);              // greeting and complaint are in the log
    },
    frame(f, N) {
      caption(f, 8, N - 4, 'The consultation', 'Ask the right questions', 'Duration · symptoms · allergies · medicines · history', true);
      tap(byText('#ui .sheet button', /other symptoms/i), f, 20);
      if (f === 20) g.ask('symptoms');
      tap(byText('#ui .sheet button', /allerg/i), f, 150);
      if (f === 150) { g.finishTalk(); g.ask('allergies'); }
    },
  });

  // 6. To the shelf: walk over, open the tablets, read a medicine card, add it for the customer.
  shot('pick', 4.6, {
    setup() {
      hideAll();
      for (const k of KEYS) if (!S.cust.asked.has(k)) { g.finishTalk(); g.ask(k); ff(0.15); }   // the rest of the questions, off camera
      g.finishTalk();
      g.pauseConsultation();
      document.querySelectorAll('#ui .toasts > *').forEach((e) => e.remove());
      g.interact(g.world.interactables.find((i) => i.section === 'tablets'));
      ff(1.1);
      S.pk = { open: -1, card: -1 };
    },
    frame(f, N) {
      const k = S.pk;
      caption(f, 4, k.open > 0 ? k.open + 4 : N, 'The shelf', 'Choose the right medicine');
      const dolo = [...document.querySelectorAll('#ui .pcard')].find((e) => /^Dolo 650 mg Tablet$/.test(e.querySelector('.pn')?.textContent || ''));
      if (k.open < 0 && dolo) k.open = f;
      if (k.open > 0 && k.card < 0) { tap(dolo, f, k.open + 24); if (f === k.open + 24) { dolo.click(); k.card = f; } }
      if (k.card > 0) { const add = byText('#ui .layer > :last-child button', /add to customer/i); tap(add, f, k.card + 36); if (f === k.card + 36) add?.click(); }
    },
  });

  // 7. Safety: the red flags that mean "refer", the safety check, and the result.
  shot('refer', 5.2, {
    setup() {
      hideAll(); g.ui.closeAll(); ff(0.2);
      g.startConsultation(S.cust); ff(3.8);
    },
    frame(f, N) {
      tap(q('#ui .sug-head'), f, 8);
      if (f === 8) q('#ui .sug-head')?.click();
      const flag = f > 12 && f < 66 ? [...document.querySelectorAll('#ui .layer > :last-child *')].find((e) => /^\s*Refer to a doctor if/i.test(e.textContent) && e.children.length <= 2) : null;
      ring(flag, f, 22, 64);
      if (f === 66) g.ui.closeAll();
      tap(byText('#ui .sheet button', /safety check/i), f, 74);
      if (f === 74) g.openSafetyCheck();
      const go = f >= 74 && f <= 112 ? byText('#ui .layer > :last-child button', /^\s*Dispense/i) : null;
      tap(go, f, 112);
      if (f === 112 && go) {
        const sc = g.ui.showCounsel;                      // the counselling choice is made off camera (the right one)
        g.ui.showCounsel = (o, { onPick }) => onPick(o.findIndex((x) => x.correct));
        go.click(); g.ui.showCounsel = sc;
        for (let i = 0; i < 400 && !byText('#ui .layer > :last-child button', /^\s*Continue/i); i++) ff(0.1);
      }
    },
  });

  // 8. Two languages: the same game switches to Tamil while you watch (text, names, even the shop signs).
  shot('lang', 4.4, {
    setup() {
      hideAll(); resetScene(); showUI(true);
      S.t = customer('S04', 'receptionist'); toCounter(S.t); ff(1);
      g.startConsultation(S.t); ff(7.5);
    },
    frame(f, N) {
      const ta = f >= 46;
      if (f === 46) {
        g.setLanguage('ta', false);
        for (const e of S.t.log) e.text = e.who === 'me' ? T('g.hello') : e.who === 'cust' ? S.t.complaint : e.text;   // the lines already in the log, in Tamil too
        g.ui.closeDialogue(true); g.ui.openDialogue(S.t);
        skipAnims = 3;
      }
      const [en, tm] = O.chips.children;
      en.classList.toggle('on', !ta); tm.classList.toggle('on', ta);
      show(O.chips, f, 4, N - 3, { rise: 0 });
      tap(tm, f, 46);
      caption(f, 8, N - 4, 'Two languages', 'English & தமிழ்', 'Voices, text and the signs in the shop', true);
    },
  });

  // 9. … and the patient speaks Tamil.
  shot('tamil', 5.2, {
    setup() {
      hideAll(); showUI(false);
      S.t.char.expression = 'concerned';
    },
    frame(f, N) {
      const u = f / (N - 1), c = S.t, head = c.char.P.H - 0.13;
      cam(mix([-0.42, head + 0.02, -4.3], [-0.52, head + 0.02, -4.18], u), [-1.24, head - 0.02, -2.85], 27);
      speakWith(c.char, 'ta/S04', f - 8);
      subtitle(f, 6, N - 3, c.name, TXT['ta/S04']);
    },
    done() { stopSpeaking(S.t.char); g.setLanguage('en', false); },
  });

  // 10. Progress: level complete, the inspector walks in, 20 / 20.
  shot('inspect', 5.4, {
    setup() {
      hideAll(); resetScene(); showUI(true); hush(true);
      cam([0.3, 2.0, 7.5], [-0.5, 1.2, -3], 52);
      g.ui.showLevelComplete(g.levelDef(), () => {}); ff(0.3);
    },
    frame(f, N) {
      if (f < 45) cam(mix([0.3, 2.0, 7.5], [0.1, 2.0, 7.1], f / 44), [-0.5, 1.2, -3], 52);
      if (f === 45) { g.ui.closeAll(); g.startInspection({ official: false, force: true }); ff(1.5); }
      if (f === 112) { timers.clear(); g._cineTrack = null; g.ui.cinema(false); g.inspectionPassed(); }
    },
    done() { hush(false); },
  });

  // 11. End card over the shop.
  shot('end', 6.3, {
    setup() {
      hideAll(); resetScene(); showUI(false);
      S.e1 = customer('S07', 'rbF15'); toCounter(S.e1); S.e2 = customer('S12', 'rbM06'); ff(7);
    },
    frame(f, N) {
      const u = f / (N - 1), t = lerp(0.2, 0.75, u);
      cam([Math.sin(t) * 4.2 + 1.2, 2.25, 4.8 + Math.cos(t) * 2.0], [-0.8, 1.25, -4], 52);
      show(O.end, f, 2, N + 30, { fade: 16, rise: 0 });
      for (const [sel, a] of [['.p-row', 8], ['.p-tag', 16], ['.p-cta', 34], ['.p-foot', 52]]) {
        const el = O.end.querySelector(sel), k = easeOut((f - a) / 18);
        el.style.opacity = String(c01((f - a) / 12)); el.style.transform = `translateY(${((1 - k) * 26).toFixed(2)}px)`;
      }
      dip(f, N, { tail: 16 });
    },
  });

  // ───────────────────────── entry points ─────────────────────────
  window.__promo = {
    async init(lip) {
      LIP = lip.env || {}; TXT = lip.text || {};
      SC = Object.fromEntries((await import('/src/data/scenarios.js')).SCENARIOS.map((s) => [s.id, s]));
      T = (await import('/src/i18n/i18n.js')).t;
      await document.fonts.ready;
      installClock();
      g.perfTick = () => {};
      g.settings.acceptedNotice = true; g.state.tutorialSeen.controls = true;
      g.ui._title?.remove(); g.ui._title = null;
      g.startPlay(true); g.ui.closeAll();
      g.state.level = 8; g.initLevelObjectives(); g.applyUnlocks(); g.ui.updateHUD(); // every section open, the expansion wing built
      g.world.setMarker(null); g.world.setMarker = () => {};
      buildOverlay();
      ff(1);
      const c = g.renderer.domElement;
      return { pr: g.pr, w: c.width, h: c.height, ao: !!g.ao, bloom: !!g.bloom, quality: g.settings.quality };
    },
    list: () => SHOTS.map((s) => ({ name: s.name, frames: s.frames })),
    async begin(name) { await SHOTS.find((s) => s.name === name).setup?.(); },
    /** Stage frame f, advance the game by 1/30 s, and (when it will be photographed) let the browser paint it. */
    async frame(name, f, shoot) {
      const s = SHOTS.find((x) => x.name === name);
      O.tap.style.opacity = '0'; O.ring.style.opacity = '0';
      s.frame(f, s.frames);
      step(shoot);
      if (shoot) {
        await realFrame();
        for (const a of document.getAnimations()) { if (skipAnims > 0) a.finish(); else if (a.__vt === undefined) { a.pause(); a.currentTime = 0; a.__vt = 0; } }
        if (skipAnims > 0) { skipAnims--; await realFrame(); }
      }
    },
    end(name) { SHOTS.find((s) => s.name === name).done?.(); },
    // for trying things out from the console / a scratch script
    x: { g, S, ff, step, cam, V, customer, toCounter, resetScene, showUI, hideAll, realFrame, timers, snap: async () => { step(true); await realFrame(); } },
  };
})();
