// ─────────────────────────────────────────────────────────────────────────────
// RxShift — Game orchestrator
// Player control & interaction, consultation flow, safety/evaluation, payment,
// progression (10 levels + career), random events, the 20-question inspection,
// save checkpoints, settings/quality and performance governors.
// ─────────────────────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { Character, pharmacistDesc, inspectorDesc, makeProp } from './world/character.js';
import { NavGrid } from './world/nav.js';
import { CameraRig } from './world/camera.js';
import { blobShadowTexture } from './world/textures.js';
import { Input } from './core/input.js';
import { CustomerManager } from './systems/customers.js';
import { evaluate, counselOptions } from './systems/evaluation.js';
import { SCENARIOS, QUESTION_TYPES } from './data/scenarios.js';
import { LEVELS, UPGRADES, ACHIEVEMENTS } from './data/levels.js';
import { QUESTION_BANK, drawInspection, MODULES } from './data/questions.js';
import { SECTIONS } from './data/products.js';
import { EVENTS, fillEvent } from './data/events.js';
import { saveGame, newGameState, deleteSave, saveSettings } from './core/state.js';
import { haptic } from './core/audio.js';
import { clamp, fmtMoney, randi, rand, pick, damp } from './core/util.js';
import { t, tp, setLang, getLang, isTA } from './i18n/i18n.js';
import { applyContent } from './i18n/content.js';
import { Guide } from './systems/guide.js';

const _f = new THREE.Vector3(), _r = new THREE.Vector3(), _d = new THREE.Vector3(), _tmp = new THREE.Vector3();
const ray = new THREE.Raycaster();
const _bm = new THREE.Matrix4(), _bq = new THREE.Quaternion(), _bs = new THREE.Vector3(), _bp = new THREE.Vector3();
const _actors = [];
const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const OUTFITS = { default: { shirt: 0x1c9c8c, coat: 0xf6f7f5 }, outfit_teal: { shirt: 0x14867a, coat: 0xf6f7f5 }, outfit_navy: { shirt: 0xe9eef5, coat: 0x23345c }, outfit_charcoal: { shirt: 0x1c9c8c, coat: 0x3a3f46 } };

export class Game {
  constructor({ renderer, scene, camera, world, audio, settings, state, catalog }) {
    Object.assign(this, { renderer, scene, camera, world, audio, settings, state, catalog });
    this.time = 0;
    this.mode = 'title';
    this.tray = [];
    this.activeCustomer = null;
    this.activeEvent = null;
    this.viewed = new Set();
    this.questionCount = QUESTION_BANK.length;
    this.productById = new Map(catalog.map((p) => [p.id, p]));
    for (const p of catalog) {
      p.stock0 = p.stock; p.expired0 = p.expired;
    }
    this.nav = new NavGrid({ minX: -8, maxX: 8, minZ: -9, maxZ: 9 }, 0.2);
    this.nav.rebuild(world.activeColliders(), 0.3);
    this.player = new Character(pharmacistDesc(OUTFITS.default));
    this.player.walkSpeed = 1.8; this.player.runSpeed = 3.3;
    this.player.group.position.copy(world.points.playerStart);
    scene.add(this.player.group);
    this.player.onStep = () => this.audio.sfx('step', { vol: 0.45 });
    this.player.attachProp('bag', makeProp('bag'), 'handR', [0, -0.12, 0.05]);
    this.rig = new CameraRig(camera, world, settings);
    this.customers = new CustomerManager(this);
    // blob shadows (one instanced draw call for every character)
    this.blobs = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: blobShadowTexture(), transparent: true, depthWrite: false, toneMapped: false, opacity: 0.85 }), 24);
    this.blobs.frustumCulled = false; this.blobs.renderOrder = 1;
    scene.add(this.blobs);
    this.frameAvg = 16; this.pr = 1; this.autoTimer = 0;
    this.saveTimer = 0; this.hudTimer = 0; this.alarmTimer = 0;
    this.cineTimers = [];
    this.guide = new Guide(this);
  }

  attachUI(ui) {
    this.ui = ui;
    this.input = new Input(this.renderer.domElement, ui.root, this.settings);
    this.input.onLook = (dx, dy) => { if (this.mode === 'play') this.rig.rotate(dx, dy); };
    this.input.onZoom = (f) => { if (this.mode === 'play') this.rig.zoom(f); };
    this.input.onTap = (x, y) => this.handleTap(x, y);
    this.input.onInteractKey = () => this.contextAction();
    this.input.onKey = (code) => {
      if (this.mode !== 'play') return;
      if (code === 'KeyV') { this.settings.firstPerson = !this.settings.firstPerson; this.applySettings(); }
      if (code === 'KeyT' || code === 'Home') this.recenterCamera();
      if (code === 'KeyR') { this.input.sprint = !this.input.sprint; this.ui.syncSprint?.(); }
    };
    this.world.onDoor = (open) => { if (open) this.audio.sfx('door', { vol: 0.8 }); };
    this.onModalChange = () => { this.input.enabled = this.mode === 'play' && !this.ui.modalOpen; };
  }

  // ───────────────────────── Lifecycle ─────────────────────────
  showTitle(hasSave) {
    this.mode = 'title';
    this.customers.clearAll();
    this.ui.closeAll(); this.ui.closeDialogue(true);
    this.ui.showHUD(false);
    this.audio.setMusic('calm');
    this.rig.setShot(new THREE.Vector3(1.5, 2.3, 6.7), new THREE.Vector3(-0.8, 1.2, -4), { cut: true });
    this.ui.showTitle({ hasSave, onContinue: () => this.startPlay(false), onNew: () => this.newGame() });
  }
  newGame() {
    const s = newGameState();
    Object.keys(this.state).forEach((k) => delete this.state[k]);
    Object.assign(this.state, s);
    for (const p of this.catalog) { p.stock = p.stock0; p.expired = p.expired0; }
    this.viewed.clear();
    this.startPlay(true);
  }
  startPlay(isNew) {
    const s = this.state;
    for (const id in s.stock) { const p = this.productById.get(id); if (p) p.stock = s.stock[id]; }
    this.applyUnlocks(); this.applyOutfit(); this.world.setTheme(s.theme); this.world.setCertified(s.inspection.certified);
    s.orders = s.orders || []; this.world.setDelivery?.(this.arrivedOrders().length > 0);
    if (!s.levelObjectives) this.initLevelObjectives();
    s.inspection.active = false;
    this.player.group.position.copy(this.world.points.playerStart); this.player.heading = 0; this.rig.yaw = 0; this.rig.pitch = 0.32;
    this.rig.clearShot();
    this.mode = 'play';
    this.ui.showHUD(true); this.ui.updateHUD();
    this.audio.init(); this.audio.setMusic('calm');
    this.customers.spawnTimer = 4;
    const go = () => {
      const L = this.levelDef();
      if (s.careerMode) { this.updateObjective(); return; }
      this.ui.showLevelIntro(L, () => {
        if (!s.tutorialSeen.controls) { s.tutorialSeen.controls = true; this.ui.showControls(() => this.onLevelStart(L)); }
        else this.onLevelStart(L);
      });
    };
    if (!this.settings.acceptedNotice) this.ui.showNotice(() => { this.settings.acceptedNotice = true; this.saveSettingsNow(); go(); });
    else go();
    this.updateObjective();
    this.save();
  }
  exitToTitle() {
    this.save();
    this.activeCustomer = null; this.tray = []; this.activeEvent = null;
    this.world.setFridgeTemp(5.2, false); this.world.expiredCarton.visible = false; this.world.highlightShelf(null); this.world.setMarker(null);
    if (this.inspector) this.inspector.group.visible = false;
    this.world.setMood('normal');
    this.showTitle(true);
  }
  async resetSave() { await deleteSave(); location.reload(); }
  save() { this.state.stock = {}; for (const p of this.catalog) if (p.stock !== p.stock0) this.state.stock[p.id] = p.stock; return saveGame(this.state); }
  lastSaveText() { return this.state.lastSaved ? t('g.autoSaved', { time: new Date(this.state.lastSaved).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }) : t('g.autoSave'); }
  saveSettingsNow() { saveSettings(this.settings); }
  gameDate() { return new Date(2026, 9, 3); }

  // ───────────────────────── Per-frame ─────────────────────────
  update(dt) {
    this.time += dt;
    const ui = this.ui, P = this.player;
    if (this.mode === 'title') {
      const t = this.time * 0.06;
      this.rig.setShot(new THREE.Vector3(Math.sin(t) * 4.5 + 1.5, 2.3 + Math.sin(t * 0.7) * 0.2, 4.5 + Math.cos(t) * 2.2), new THREE.Vector3(-0.8, 1.2, -4), { speed: 1.5 });
    }
    const canControl = this.mode === 'play' && !ui.modalOpen;
    this.input.enabled = canControl;
    const mv = this.input.update();
    let ext = null, moving = false;
    if (canControl && mv.mag > 0.05) {
      if (P.path) { P.path = null; P.onArrive = null; }
      P.faceAngle = null;
      ui.hideJoyHint();
      const f = this.rig.forward(_f);
      const r = _r.set(-f.z, 0, f.x);
      _d.set(0, 0, 0).addScaledVector(r, mv.x).addScaledVector(f, mv.y).normalize();
      // realistic (mocap) walking reads best at a brisk 1.8 m/s; RUN / Shift / full stick = jog-run
      const speed = mv.run ? 3.3 : 0.45 + 1.35 * mv.mag;
      this.movePlayer(_d, speed, dt);
      ext = { vx: _d.x, vz: _d.z, speed };
      moving = true;
    } else if (!P.path && P.faceAngle == null) ext = { vx: 0, vz: 0, speed: 0 };
    if (canControl && this.input.camKeys.rot) this.rig.rotate(this.input.camKeys.rot * 220 * dt, 0);
    if (canControl && this.input.camKeys.zoom) this.rig.zoom(1 + this.input.camKeys.zoom * 1.2 * dt);
    P.update(dt, this.camera.position, ext);
    if (P.path) moving = true;
    this.customers.update(dt);
    if (this.mode !== 'title') this._tickOrders(dt);
    if (this.inspector && this.inspector.group.visible) this.inspector.update(dt, this.camera.position);
    _actors.length = 0; _actors.push(P); for (const a of this.customers.actors()) _actors.push(a); if (this.inspector?.group.visible) _actors.push(this.inspector);
    this.world.update(dt, this.time, _actors, this.camera.position);
    if (this._cineTrack) this.rig.shot.look.set(this._cineTrack.group.position.x, 1.45, this._cineTrack.group.position.z);
    this.rig.update(dt, P, moving);
    this._updateBlobs();
    if (this.mode === 'play') {
      this._checkVisits();
      const ctx = ui.modalOpen ? null : this.contextInfo();
      this._ctx = ctx;
      ui.setContext(ctx && ctx.label, ctx && ctx.icon);
    } else ui.setContext(null);
    // periodic
    this.hudTimer -= dt;
    if (this.hudTimer <= 0) { this.hudTimer = 0.3; if (this.mode !== 'title') { ui.updateHUD(); this.updateObjective(); } }
    this.saveTimer += dt;
    if (this.saveTimer > 60 && this.mode === 'play') { this.saveTimer = 0; this.save(); }
    if (this.activeEvent?.type === 'fridge') { this.alarmTimer -= dt; if (this.alarmTimer <= 0) { this.alarmTimer = 4; if (this.mode === 'play') this.audio.sfx('alarm', { vol: 0.6 }); } }
    if (this._pendingInspection && this.mode === 'play' && !this.activeCustomer && !this.customers.posCust && !ui.modalOpen) { const pi = this._pendingInspection; this._pendingInspection = null; this.startInspection(pi); }
    if (this._pendingLevelComplete && this.mode === 'play' && !ui.modalOpen && !this.activeCustomer) { this._pendingLevelComplete = false; this.levelComplete(); }
  }

  _updateBlobs() {
    if (!this.blobs.visible) return; // real shadows are on — blob shadows not needed
    const m = _bm, q = _bq, s = _bs, p = _bp;
    let n = 0;
    const put = (c) => {
      if (n >= 24 || (!c.group.visible && c !== this.player)) return;
      const k = c.P.H * 0.5 * (1 - c.sitW * 0.2);
      p.set(c.group.position.x, 0.012, c.group.position.z); s.set(k, 1, k);
      m.compose(p, q, s); this.blobs.setMatrixAt(n++, m);
    };
    put(this.player);
    for (const c of this.customers.actors()) put(c);
    if (this.inspector?.group.visible) put(this.inspector);
    this.blobs.count = n; this.blobs.instanceMatrix.needsUpdate = true;
  }

  movePlayer(dir, speed, dt) {
    const p = this.player.group.position;
    let nx = p.x + dir.x * speed * dt, nz = p.z + dir.z * speed * dt;
    const R = 0.27;
    for (let iter = 0; iter < 2; iter++) {
      for (const c of this.world.colliders) {
        if (c.disabled) continue;
        const cx = clamp(nx, c.minX, c.maxX), cz = clamp(nz, c.minZ, c.maxZ);
        const dx = nx - cx, dz = nz - cz, d2 = dx * dx + dz * dz;
        if (d2 < R * R) {
          if (d2 > 1e-9) { const d = Math.sqrt(d2); nx = cx + (dx / d) * R; nz = cz + (dz / d) * R; }
          else {
            const pen = [nx - c.minX, c.maxX - nx, nz - c.minZ, c.maxZ - nz];
            const i = pen.indexOf(Math.min(...pen));
            if (i === 0) nx = c.minX - R; else if (i === 1) nx = c.maxX + R; else if (i === 2) nz = c.minZ - R; else nz = c.maxZ + R;
          }
        }
      }
      for (const a of this.customers.actors()) {
        const ap = a.group.position; const dx = nx - ap.x, dz = nz - ap.z, d2 = dx * dx + dz * dz, rr = 0.5;
        if (d2 < rr * rr && d2 > 1e-6) { const d = Math.sqrt(d2); nx = ap.x + (dx / d) * rr; nz = ap.z + (dz / d) * rr; }
      }
    }
    p.x = clamp(nx, -7.7, 7.7); p.z = clamp(nz, -8.7, 8.6);
  }

  autoWalkTo(target, heading, cb) {
    const P = this.player;
    const d = P.group.position.distanceTo(_tmp.set(target.x, 0, target.z));
    if (d < 0.3) { if (heading != null) P.faceTo(heading); setTimeout(() => cb?.(), 120); return; }
    const path = this.nav.findPath(P.group.position, target);
    if (!path) { cb?.(); return; }
    P.walkPath(path, { run: d > 5, speed: d > 5 ? 3.3 : 1.8, onArrive: () => { if (heading != null) P.faceTo(heading); setTimeout(() => cb?.(), 150); } });
  }

  // ───────────────────────── Interaction ─────────────────────────
  handleTap(x, y) {
    if (this.mode !== 'play' || this.ui.modalOpen) return;
    const ndc = new THREE.Vector2((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, this.camera);
    let best = null;
    const consider = (d, o) => { if (!best || d < best.d) best = { d, ...o }; };
    for (const c of this.customers.active) {
      if (c.state === 'leaving') continue;
      const pos = c.char.group.position;
      const hit = ray.ray.intersectSphere(new THREE.Sphere(new THREE.Vector3(pos.x, c.char.P.H * 0.62 * (1 - c.char.sitW * 0.3), pos.z), 0.42), _tmp);
      if (hit) consider(hit.distanceTo(ray.ray.origin), { kind: 'cust', c });
    }
    for (const hb of this.world.hitBoxes) {
      if (hb.disabled || !hb.ref || hb.ref.disabled) continue;
      const hit = ray.ray.intersectBox(hb.box, _tmp);
      if (hit) consider(hit.distanceTo(ray.ray.origin) + 0.05, { kind: 'it', it: hb.ref });
    }
    const fp = ray.ray.intersectPlane(floorPlane, new THREE.Vector3());
    if (fp && Math.abs(fp.x) < 7.8 && fp.z > -8.8 && fp.z < 8.7) consider(fp.distanceTo(ray.ray.origin) + 0.3, { kind: 'floor', p: fp });
    if (!best) return;
    this.audio.sfx('tap', { vol: 0.6 });
    if (best.kind === 'cust') this.interactCustomer(best.c);
    else if (best.kind === 'it') this.interact(best.it);
    else { this.world.showTap(best.p); this.autoWalkTo(best.p, null); this.ui.hideJoyHint(); }
  }
  interactCustomer(c) {
    if (c === this.customers.counterCust && (c.state === 'atCounter' || c.state === 'talking')) this.startConsultation(c);
    else if (c === this.customers.posCust && c.state === 'atPOS') this.interact(this.world.interactables.find((i) => i.id === 'pos'));
    else if (c.state === 'waiting' || c.state === 'queued' || c.state === 'toSeat') this.ui.toast(t('g.waiting', { name: c.name.split(' ')[0] }), '', 'clock');
  }
  contextInfo() {
    const p = this.player.group.position, W = this.world;
    const cc = this.customers.counterCust;
    if (cc && (cc.state === 'atCounter' || cc.state === 'talking') && p.distanceTo(W.points.pharmService) < 3.2) return { label: tp('g.talk'), icon: 'chat', fn: () => this.startConsultation(cc) };
    const pc = this.customers.posCust;
    if (pc && pc.state === 'atPOS' && p.distanceTo(W.points.posPharm) < 2.6) return { label: tp('g.pay'), icon: 'cash', fn: () => this.ui.showPOS('checkout') };
    let best = null, bd = 1e9;
    for (const it of W.interactables) {
      if (it.disabled) continue;
      const d = p.distanceTo(_tmp.set(it.stand.x, 0, it.stand.z));
      if (d < (it.type === 'shelf' ? 1.6 : 1.5) && d < bd) { bd = d; best = it; }
    }
    if (best) {
      const ev = this.activeEvent;
      let label = this.itLabel(best);
      if (ev && ev.type !== 'shortage' && ((ev.where === best.type) || (ev.type === 'misplaced' && best.section === 'vitamins'))) label = tp('g.handle', { what: String(ev.def?.title || ev.title || '') });
      if (best.type === 'storage' && !ev && this.arrivedOrders().length) label = tp('stk.recvTitle');
      return { label, icon: best.type === 'shelf' ? 'eye' : best.type === 'fridge' ? 'snow' : best.type === 'pos' ? 'cash' : best.type === 'workstation' ? 'book' : best.type === 'storage' ? 'box' : 'hand', fn: () => this.interact(best) };
    }
    return null;
  }
  contextAction() { if (this.mode === 'play' && !this.ui.modalOpen && this._ctx) { this.audio.sfx('tap'); this.haptic('light'); this._ctx.fn(); } }

  interact(it) {
    if (!it || it.disabled) return;
    const go = (cb) => this.autoWalkTo(it.stand, it.heading, cb);
    const ev = this.activeEvent;
    switch (it.type) {
      case 'counter': {
        const cc = this.customers.counterCust;
        if (cc && (cc.state === 'atCounter' || cc.state === 'talking')) this.startConsultation(cc);
        else go(() => this.ui.toast(cc ? t('g.custOnWay') : t('g.noCounter'), '', 'user'));
        break;
      }
      case 'pos': go(() => this.ui.showPOS(this.customers.posCust?.state === 'atPOS' ? 'checkout' : 'orders')); break;
      case 'shelf':
        go(() => { if (ev?.type === 'misplaced' && it.section === 'vitamins') this.openEvent(); else this.openShelf(it); });
        break;
      case 'fridge': go(() => { if (ev?.type === 'fridge') this.openEvent(); else this.openShelf({ ...it, section: 'fridge' }); }); break;
      case 'storage': go(() => { if (ev?.type === 'expired') this.openEvent(); else if (this.arrivedOrders().length) this.ui.showReceive(); else this.showStorage(); }); break;
      case 'workstation': go(() => this.ui.showTraining()); break;
      default: break;
    }
  }
  openShelf(it) {
    const W = this.world;
    this.audio.sfx('shelf');
    this.player.setAction('inspect', 1.4);
    if (it.shelves) {
      W.highlightShelf(it);
      const front = it.shelves[0].front;
      const right = new THREE.Vector3(front.z, 0, -front.x);
      const c = it.pos;
      this.rig.setShot(new THREE.Vector3(c.x, 1.65, c.z).addScaledVector(front, 2.1).addScaledVector(right, 0.5), new THREE.Vector3(c.x, 1.15, c.z), { speed: 3 });
    }
    this.progress('inspectShelf');
    this.ui.showShelf(it, () => { W.highlightShelf(null); this.rig.clearShot(); });
  }
  showStorage() {
    const lows = Object.keys(SECTIONS).map((k) => [k, this.sectionStock(k)]).filter(([, v]) => v.low > 0);
    this.ui.toast(lows.length ? t('g.storageLow', { n: lows.length }) : t('g.storageOk'), lows.length ? 'warn' : 'good', 'box', 3500);
  }

  _checkVisits() {
    if (this.state.careerMode || this.state.level !== 1) return;
    const p = this.player.group.position, W = this.world;
    const T = { counter: W.points.pharmService, fridge: W.points.fridgeStand, pos: W.points.posPharm, storage: W.points.storageStand };
    for (const k in T) if (p.distanceTo(T[k]) < 1.3) this.progress('visit', { target: k });
  }

  // ───────────────────────── Consultation ─────────────────────────
  onCustomerAtCounter(c) {
    c.char.expression = c.scn.difficulty >= 4 ? 'concerned' : 'neutral';
    this.ui.toast(t('g.atCounter', { name: c.name }), '', 'user');
    this.audio.sfx('notify', { vol: 0.6 });
    this.updateObjective();
  }
  onCustomerAtPOS() { this.updateObjective(); }
  onCustomerLeft() { this.afterCustomer(); }
  onCustomerArrive() {}

  startConsultation(c) {
    this.autoWalkTo(this.world.points.pharmService, 0, () => {
      if (!this.customers.active.includes(c)) return;
      this.mode = 'dialogue';
      this.activeCustomer = c;
      c.state = 'talking';
      this.tray = c.tray;
      this.player.lookTarget = new THREE.Vector3(c.char.group.position.x, c.char.P.H - 0.12, c.char.group.position.z);
      this.dialogueShot(c.char);
      this.ui.openDialogue(c);
      if (!c.greeted) {
        c.greeted = true;
        this.isDialogueSpeaking = true;
        c.log.push({ who: 'me', text: t('g.hello') });
        this.ui.refreshDialogue();
        this.pharmacistSay(t('g.hello'), 'g_hello', () => {
          if (this.mode !== 'dialogue' || this.activeCustomer !== c || c.state === 'leaving') {
            this.isDialogueSpeaking = false;
            return;
          }
          setTimeout(() => {
            if (this.mode !== 'dialogue' || this.activeCustomer !== c || c.state === 'leaving') {
              this.isDialogueSpeaking = false;
              return;
            }
            c.log.push({ who: 'cust', text: c.complaint });
            if (c.scn.prescription) c.log.push({ who: 'sys', text: t('g.handsRx') });
            if (c.scn.child && c.scn.child.age < 1) c.log.push({ who: 'sys', text: t('g.holdingBaby', { m: c.scn.child.months }) });
            this.ui.refreshDialogue();
            this.customerSay(c, c.complaint, false, c.scn?.id, () => {
              this.isDialogueSpeaking = false;
              this.ui.refreshDialogue();
            });
          }, 300);
        });
      } else {
        this.isDialogueSpeaking = false;
        this.ui.refreshDialogue();
      }
      this.updateObjective();
    });
  }
  dialogueShot(target) {
    const pp = this.player.group.position, cp = target.group.position;
    const d = new THREE.Vector3(cp.x - pp.x, 0, cp.z - pp.z).normalize();
    const right = new THREE.Vector3(-d.z, 0, d.x);
    const land = window.innerWidth > window.innerHeight && window.innerWidth >= 600;
    const head = target.P.H - 0.14;
    let pos, look;
    if (land) {
      // camera at the pharmacist's left shoulder; pharmacist ends up behind the right-side sheet
      pos = new THREE.Vector3(pp.x, 1.66, pp.z).addScaledVector(d, -0.75).addScaledVector(right, -0.55);
      look = new THREE.Vector3(cp.x, head - 0.05, cp.z).addScaledVector(right, 0.85);
    } else {
      pos = new THREE.Vector3(pp.x, 1.7, pp.z).addScaledVector(d, -0.55).addScaledVector(right, 0.35);
      look = new THREE.Vector3(cp.x, head - 0.62, cp.z);
    }
    this.rig.setShot(pos, look, { speed: 3.5, fov: land ? 40 : 46 });
  }
  pauseConsultation() {
    const c = this.activeCustomer;
    this.audio.stopSpeech();
    this.isDialogueSpeaking = false;
    this.player.say(false);
    if (c?.char) c.char.say(false);
    this.ui.closeDialogue();
    this.rig.clearShot();
    this.player.lookTarget = null;
    this.mode = 'play';
    if (c && c.state === 'talking') c.state = 'atCounter';
    this.ui.toast(t('g.custWaiting'), '', 'info', 3600);
  }
  ask(key) {
    if (this.isDialogueSpeaking) return;
    const c = this.activeCustomer; if (!c || c.asked.has(key)) return;
    c.asked.add(key);
    this.isDialogueSpeaking = true;
    const qKey = key.startsWith('q_') ? key : 'q_' + key;
    c.log.push({ who: 'me', text: t('q.' + key + '.prompt') });
    this.audio.sfx('click');
    this.ui.refreshDialogue();
    this.pharmacistSay(t('q.' + key + '.prompt'), qKey, () => {
      if (this.mode !== 'dialogue' || this.activeCustomer !== c || c.state === 'leaving') {
        this.isDialogueSpeaking = false;
        return;
      }
      setTimeout(() => {
        if (this.mode !== 'dialogue' || this.activeCustomer !== c || c.state === 'leaving') {
          this.isDialogueSpeaking = false;
          return;
        }
        const ans = c.scn.answers[key];
        c.log.push({ who: 'cust', text: ans });
        this.ui.refreshDialogue();
        this.customerSay(c, ans, false, c.scn?.id + '_' + key, () => {
          this.isDialogueSpeaking = false;
          this.ui.refreshDialogue();
        });
      }, 300);
    });
  }
  // The customer answers in their own voice (one voice per customer).
  // The mouth strictly follows the speech turn: turns ON when audio starts, OFF when audio ends.
  customerSay(c, text, queue = false, clipId = null, onEnd = null) {
    if (!c || c.state === 'leaving' || c.state === 'toPOS' || !c.item?.busy) {
      onEnd?.();
      return;
    }
    const dur = clamp(String(text).length * 55, 1200, 6500);
    clearTimeout(c._sayT);
    let started = false;
    const mouth = (on) => { if (c.char && c.state !== 'leaving') c.char.say(on); };
    const stopMouth = () => {
      clearTimeout(c._sayT);
      c._sayT = null;
      mouth(false);
    };

    if (!this.settings.voiceDialogue) {
      mouth(true);
      c._sayT = setTimeout(() => { stopMouth(); onEnd?.(); }, dur);
    } else {
      c._sayT = setTimeout(() => {
        if (!started && c.state !== 'leaving') {
          mouth(true);
          c._sayT = setTimeout(() => { stopMouth(); onEnd?.(); }, dur);
        }
      }, queue ? 9000 : 2000);

      this.audio.speak(text, {
        clipId: clipId || (text === c.complaint ? c.scn?.id : null),
        gender: c.gender,
        age: c.age,
        voice: c.num,
        queue,
        onStart: () => {
          if (!c || c.state === 'leaving' || c.state === 'toPOS' || !c.item?.busy) {
            this.audio.stopSpeech();
            stopMouth();
            onEnd?.();
            return;
          }
          started = true;
          clearTimeout(c._sayT);
          mouth(true);
        },
        onEnd: () => {
          stopMouth();
          onEnd?.();
        }
      });
    }
    if (this.mode !== 'dialogue') this.ui.subtitle(c.name.split(' ')[0], String(text), dur + 600);
  }
  /** The pharmacist (player) says her line out loud — same fixed voice all game. */
  pharmacistSay(text, clipId = null, onEnd = null) {
    const p = this.player;
    clearTimeout(this._pSayT);
    const dur = clamp(String(text).length * 50, 900, 4500);
    const stopMouth = () => { clearTimeout(this._pSayT); this._pSayT = null; p.say(false); };
    if (!this.settings.voiceDialogue) {
      p.say(true);
      this._pSayT = setTimeout(() => { stopMouth(); onEnd?.(); }, dur);
      return;
    }
    let started = false;
    this._pSayT = setTimeout(() => {
      if (!started) {
        p.say(true);
        this._pSayT = setTimeout(() => { stopMouth(); onEnd?.(); }, dur);
      }
    }, 2000);
    this.audio.speak(text, {
      clipId,
      gender: 'F',
      age: 32,
      voice: 1,
      role: 'staff',
      onStart: () => {
        started = true;
        clearTimeout(this._pSayT);
        p.say(true);
      },
      onEnd: () => {
        stopMouth();
        onEnd?.();
      }
    });
  }
  openCabinet(q) {
    if (this.mode !== 'play' && this.mode !== 'dialogue') return;
    this.audio.sfx('shelf');
    this.ui.openInventory({ title: t('dlg.cabinet'), query: q || '' });
  }
  markViewed(p) { this.viewed.add(p.id); }
  onViewDetails(p) {
    const s = this.state;
    s.viewedDetails[p.id] = 1;
    const L = this.levelDef();
    L.objectives.forEach((o, i) => {
      if (o.type !== 'viewDetails' || s.careerMode) return;
      const st = s.levelObjectives[i]; st.ids = st.ids || [];
      if (!st.ids.includes(p.id)) { st.ids.push(p.id); st.count = st.ids.length; }
    });
    this.progress('viewDetails');
  }
  onSymptomSearch() { if (!this.state.searchedSymptom) { this.state.searchedSymptom = true; } this.progress('search'); }
  sectionUnlocked(sec) {
    const s = this.state; if (s.careerMode || this.settings.demoTools) return true;
    if (sec === 'rx') return s.level >= 5;
    if (sec === 'personal') return s.level >= 7;
    return true;
  }
  addToTray(p) {
    const c = this.activeCustomer;
    if (!c) { this.ui.toast(t('g.noCustomer'), 'warn', 'user'); return false; }
    if (p.stock === 0) { this.ui.toast(t('g.oos'), 'warn', 'box'); return false; }
    if (!this.sectionUnlocked(p.section)) { this.ui.toast(t('g.secLocked', { sec: SECTIONS[p.section].name, n: p.section === 'rx' ? 5 : 7 }), 'warn', 'lock'); return false; }
    if (this.tray.find((x) => x.id === p.id)) { this.ui.toast(t('g.inTray'), '', 'tray'); return false; }
    if (this.tray.length >= 3) { this.ui.toast(t('g.trayFull'), 'warn', 'tray'); return false; }
    this.tray.push(p); c.tray = this.tray;
    this.audio.sfx('drop'); this.haptic('light');
    this.ui.toast(t('g.added', { brand: p.brand }), 'good', 'tray', 1600);
    this.player.setAction('inspect', 1.2);
    this.ui.refreshDialogue(); this.ui._invRefresh?.();
    return true;
  }
  removeFromTray(id) {
    const i = this.tray.findIndex((x) => x.id === id); if (i < 0) return;
    this.tray.splice(i, 1);
    this.audio.sfx('click');
    this.ui.refreshDialogue(); this.ui._invRefresh?.();
  }
  openSafetyCheck() {
    const c = this.activeCustomer; if (!c) { this.ui.toast(t('g.noCustomer'), 'warn'); return; }
    const show = () => this.ui.showSafety(c, {
      onDispense: () => this.beginCounsel({ type: 'dispense' }),
      onChange: () => this.openCabinet(),
      onRefer: () => this.ui.showReferral(),
      onProfile: () => this.ui.showProfile(c),
    });
    if (this.mode !== 'dialogue') { this.startConsultation(c); setTimeout(show, 1600); } else show();
  }
  beginCounsel(d) {
    const c = this.activeCustomer; if (!c) return;
    if (this.mode !== 'dialogue') { this.startConsultation(c); setTimeout(() => this.beginCounsel(d), 1600); return; }
    if (d.type === 'dispense') { if (!this.tray.length) { this.ui.toast(t('g.addFirst'), 'warn', 'tray'); return; } d.products = [...this.tray]; }
    else d.products = [];
    const opts = counselOptions(d, c.scn);
    const title = d.type === 'dispense' ? t('g.coDispense') : d.type === 'refer' ? (d.urgency === 'emergency' ? t('g.coEmergency') : t('g.coRefer')) : t('g.coAdvise');
    this.ui.showCounsel(opts, { title, onPick: (i) => this.finalizeDecision(d, opts[i]) });
  }
  finalizeDecision(d, opt) {
    const c = this.activeCustomer; if (!c) return;
    this.isDialogueSpeaking = true;
    c.log.push({ who: 'me', text: opt.text });
    this.ui.refreshDialogue();
    const extra = { counselCorrect: !!opt.correct, requested: c.requested };
    const res = evaluate(d, c.scn, c.asked, extra);
    this.applyResult(res, c, d);
    const outcomeKey = d.type === 'dispense' ? 'thx_dispense' : d.type === 'refer' ? (d.urgency === 'emergency' ? 'thx_emergency' : 'thx_refer') : 'thx_advise';
    const line = d.type === 'dispense' ? t('g.thxDispense') : d.type === 'refer' ? (d.urgency === 'emergency' ? t('g.thxEmergency') : t('g.thxRefer')) : t('g.thxAdvise');
    c.char.expression = d.type === 'refer' ? 'concerned' : 'happy';

    this.pharmacistSay(opt.text, null, () => {
      if (!c || c.state === 'leaving') {
        this.isDialogueSpeaking = false;
        return;
      }
      setTimeout(() => {
        if (!c || c.state === 'leaving') {
          this.isDialogueSpeaking = false;
          return;
        }
        c.log.push({ who: 'cust', text: line });
        this.ui.refreshDialogue();
        this.customerSay(c, line, false, outcomeKey + '_' + c.gender, () => {
          this.isDialogueSpeaking = false;
          setTimeout(() => this.ui.showOutcome(res, () => this.afterOutcome(c, d)), 400);
        });
      }, 300);
    });
  }
  applyResult(res, c, d) {
    const s = this.state, dl = res.deltas;
    s.safety = clamp(s.safety + dl.safety, 0, 100);
    s.satisfaction = clamp(s.satisfaction + dl.satisfaction, 0, 100);
    s.reputation = clamp(s.reputation + dl.reputation, 0, 100);
    s.xp += dl.xp || 0;
    s.served++;
    const safeGood = res.safe && res.grade !== 'poor';
    if (safeGood) { s.servedSafe++; s.safeStreak++; } else if (!res.safe) { s.safeStreak = 0; s.unsafeCount++; } else s.safeStreak = 0;
    if (d.type === 'refer' && c.scn.correct.type === 'refer') s.referralsCorrect++;
    if (s.served === 1) this.achieve('first');
    if (res.extra.detective) this.achieve('detective');
    if (s.safeStreak >= 5) this.achieve('safe5');
    if (res.extra.lifeSaver) this.achieve('referral');
    if (res.extra.genericAlt) this.achieve('generic');
    if (s.served >= 25) this.achieve('served25');
    s.recentScenarios.push(c.scn.id); if (s.recentScenarios.length > 12) s.recentScenarios.shift();
    this.progress('serve', { safe: safeGood });
    this.ui.updateHUD();
  }
  afterOutcome(c, d) {
    this.audio.stopSpeech();
    this.isDialogueSpeaking = false;
    this.player.say(false);
    if (c?.char) c.char.say(false);
    this.ui.closeDialogue();
    this.rig.clearShot();
    this.mode = 'play';
    this.player.lookTarget = null;
    this.activeCustomer = null; this.tray = [];
    if (d.type === 'dispense') {
      c.bill = d.products;
      this.customers.sendToPOS(c);
      const total = c.bill.reduce((a, p) => a + p.price, 0);
      this.world.setPOS({ line1: tp('g.pending'), line2: c.name, total: fmtMoney(total) });
      this.world.setCFD(tp('g.items', { n: c.bill.length }), fmtMoney(total));
      this.ui.toast(t('g.toPOS'), '', 'cash');
    } else {
      if (d.urgency === 'emergency') { this.ui.toast(t('g.emergencyCalled'), 'warn', 'phone', 3500); setTimeout(() => this.audio.sfx('siren'), 1200); }
      this.customers.leave(c, 1800);
    }
    this.updateObjective();
    this.save();
  }
  completePayment(method) {
    const c = this.customers.posCust; if (!c || !c.bill || c.state !== 'atPOS') return;
    this.autoWalkTo(this.world.points.posPharm, 0, () => {
      const s = this.state;
      c.state = 'paying';
      const total = c.bill.reduce((a, p) => a + p.price, 0);
      s.money += total; s.dailyRevenue += total; s.paidCount = (s.paidCount || 0) + 1;
      for (const p of c.bill) p.stock = Math.max(0, p.stock - 1);
      if (c.waitT > 75) { const pen = Math.min(8, 2 + Math.floor((c.waitT - 75) / 30) * 2); s.satisfaction = clamp(s.satisfaction - pen, 0, 100); this.ui.toast(t('g.longWait', { s: Math.round(c.waitT), pen }), 'warn', 'clock'); }
      if (s.upgrades.pos_pro) s.satisfaction = clamp(s.satisfaction + 2, 0, 100);
      this.player.lookTarget = new THREE.Vector3(c.char.group.position.x, 1.5, c.char.group.position.z);
      this.player.setAction('type', 0.9);
      this.audio.sfx('beep');
      if (!c.char.props.card) { c.char.attachProp('card', makeProp('card'), 'handR', [0, -0.11, 0.04]); c.char.attachProp('bag', makeProp('bag'), 'handR', [0, -0.12, 0.05]); }
      setTimeout(() => { c.char.setAction('pay', 1.4); c.char.showProp('card', method !== 'cash'); }, 500);
      setTimeout(() => { this.audio.sfx('cash'); this.player.showProp('bag', true); this.player.setAction('give', 1.4); c.char.showProp('card', false); this.haptic('success'); }, 1300);
      setTimeout(() => { this.player.showProp('bag', false); c.char.setAction('take', 1.0); c.char.showProp('bag', true); c.char.expression = 'smile'; }, 2400);
      setTimeout(() => {
        this.player.lookTarget = null;
        this.audio.stopSpeech();
        this.customers.leave(c, 0);
        setTimeout(() => c.char.showProp('bag', false), 9000);
      }, 3300);
      this.world.setPOS({ line1: tp('g.paid'), line2: tp('g.paidThanks', { method: method.toUpperCase() }), total: fmtMoney(total) });
      this.world.setCFD(tp('g.thankYou'), fmtMoney(total));
      setTimeout(() => { this.world.setPOS({ line1: tp('g.ready'), line2: tp('g.scan') }); this.world.setCFD(tp('g.welcome'), '₹ 0'); }, 5000);
      this.ui.toast(t('g.paidToast', { total: fmtMoney(total) }), 'good', 'cash');
      this.ui.updateHUD();
      this.save();
    });
  }
  afterCustomer() {
    this.updateObjective();
    if (this.state.inspection.active) return;
    this.checkInspectionTrigger();
    const s = this.state, L = this.levelDef();
    if (!this._pendingInspection && !this.activeEvent && (s.careerMode || L.events) && Math.random() < 0.3) setTimeout(() => this.triggerEvent(pick(['fridge', 'expired', 'misplaced'])), 2500);
  }

  // ───────────────────────── Payment-side systems: stock ─────────────────────────
  sectionStock(sec) {
    const items = this.catalog.filter((p) => p.section === sec);
    let low = 0, out = 0, fill = 0, cost = 0;
    for (const p of items) { if (p.stock < 6) { low++; cost += (30 - p.stock) * Math.min(p.price, 400) * 0.05; } if (p.stock === 0) out++; fill += Math.min(1, p.stock / 30); }
    return { low, out, pct: Math.round((fill / items.length) * 100), cost: low ? clamp(Math.round(cost / 10) * 10, 100, 900) : 0, n: items.length };
  }
  stockLevel() {
    let tot = 0, n = 0;
    for (const k of Object.keys(SECTIONS)) { const st = this.sectionStock(k); tot += st.pct * st.n; n += st.n; }
    return n ? tot / n : 0;
  }
  restock(sec) {
    const info = this.sectionStock(sec);
    if (!info.low) return;
    if ((this.state.orders || []).some((o) => o.sec === sec && o.status !== 'received')) { this.ui.toast(t('stk.already'), '', 'box'); return; }
    const items = this.catalog.filter((p) => p.section === sec && p.stock < 6 && !this.pendingOrderFor(p.id)).map((p) => ({ id: p.id, qty: 30 + randi(0, 20) - p.stock }));
    if (!items.length) return;
    this.placeOrder(items, info.cost, { sec });
  }

  // ───────────────────────── Stock-in: orders → delivery → receive ─────────────────────────
  orderCost(p, qty = 30) { return clamp(Math.round((qty * Math.min(p.price, 600) * 0.3) / 10) * 10, 60, 1500); }
  pendingOrderFor(pid) { return (this.state.orders || []).find((o) => o.status !== 'received' && o.items.some((i) => i.id === pid)); }
  arrivedOrders() { return (this.state.orders || []).filter((o) => o.status === 'arrived'); }
  activeOrders() { return (this.state.orders || []).filter((o) => o.status !== 'received'); }
  orderLabel(o) { return o.sec ? t('stk.secOrder', { sec: SECTIONS[o.sec].name }) : (this.productById.get(o.items[0]?.id)?.name || ''); }
  orderProduct(p, qty = 30) {
    if (this.pendingOrderFor(p.id)) { this.ui.toast(t('stk.already'), '', 'box'); return null; }
    return this.placeOrder([{ id: p.id, qty }], this.orderCost(p, qty), {});
  }
  placeOrder(items, cost, extra = {}) {
    const s = this.state; s.orders = s.orders || [];
    if (s.money < cost) { this.ui.toast(t('stk.noFunds'), 'warn', 'cash'); return null; }
    s.money -= cost;
    s.orderCounter = (s.orderCounter || 0) + 1;
    const eta = this.settings.demoTools ? 8 : 22 + randi(0, 8);
    const o = { id: 'PO-' + String(1000 + s.orderCounter), items, cost, t: 0, eta, status: 'ordered', ...extra };
    s.orders.push(o);
    s.orders = s.orders.filter((x) => x.status !== 'received').concat(s.orders.filter((x) => x.status === 'received').slice(-6));
    s.restockOrders++;
    this.audio.sfx('cash');
    this.ui.toast(t('stk.placed', { what: this.orderLabel(o), cost: fmtMoney(cost), s: eta }), 'good', 'box', 3200);
    this.ui.updateHUD(); this.save(); this.ui._invRefresh?.();
    return o;
  }
  _tickOrders(dt) {
    const list = this.state.orders; if (!list || !list.length) return;
    for (const o of list) {
      if (o.status === 'received' || o.status === 'arrived') continue;
      o.t += dt;
      if (o.status === 'ordered' && o.t > o.eta * 0.3) o.status = 'transit';
      if (o.t >= o.eta) { o.status = 'arrived'; this.onDeliveryArrived(o); }
    }
  }
  onDeliveryArrived() {
    this.world.setDelivery?.(true);
    this.ui.toast(t('stk.arrivedToast'), 'good', 'box', 4200);
    this.audio.sfx('notify'); this.haptic('light');
    this.updateObjective(); this.save();
  }
  receiveOrders() {
    const s = this.state, arrived = this.arrivedOrders();
    if (!arrived.length) return 0;
    let n = 0;
    const d = this.gameDate();
    for (const o of arrived) {
      for (const it of o.items) {
        const p = this.productById.get(it.id); if (!p) continue;
        p.stock = Math.min(99, p.stock + it.qty);
        if (it.batch) p.batch = it.batch;
        if (it.expiry) { p.expiry = it.expiry; p.expired = false; }
        n++;
      }
      o.status = 'received';
      if (this.activeEvent?.type === 'shortage' && o.sec === this.activeEvent.section) { this.activeEvent = null; s.safety = clamp(s.safety + 2, 0, 100); }
    }
    void d;
    this.world.setDelivery?.(false);
    this.audio.sfx('shelf'); this.player.setAction('inspect', 1.4);
    this.progress('restock');
    this.ui.toast(t('stk.received', { n }), 'good', 'box', 3000);
    this.updateObjective(); this.ui.updateHUD(); this.save();
    return n;
  }
  /** Delivery lines with batch/expiry for the receiving check (generated once per order). */
  deliveryLines() {
    const out = [];
    for (const o of this.arrivedOrders()) for (const it of o.items) {
      const p = this.productById.get(it.id); if (!p) continue;
      if (!it.batch) { it.batch = 'B' + randi(100000, 999999); const m = randi(14, 30), e = new Date(2026, 9 + m, 1); it.expiry = `${String(e.getMonth() + 1).padStart(2, '0')}/${e.getFullYear()}`; }
      out.push({ p, qty: it.qty, batch: it.batch, expiry: it.expiry, cold: p.section === 'fridge' });
    }
    return out;
  }

  // ───────────────────────── Events ─────────────────────────
  triggerEvent(type) {
    if (this.activeEvent || this.state.inspection.active) return;
    const W = this.world;
    if (type === 'shortage') {
      const sec = 'syrups';
      let k = 0; for (const p of this.catalog) if (p.section === sec && k < 40 && Math.random() < 0.6) { p.stock = randi(0, 3); k++; }
      this.activeEvent = { type, section: sec, title: t('g.shortage'), objective: t('g.shortageObj', { sec: SECTIONS[sec].name }), where: 'pos' };
      this.ui.toast(t('g.shortageToast', { sec: SECTIONS[sec].name }), 'warn', 'box', 4000);
      this.audio.sfx('notify'); this.updateObjective(); return;
    }
    const def = EVENTS[type];
    const ev = { type, ...def, def };
    if (type === 'fridge') { ev.temp = this.state.upgrades.fridge_pro ? rand(8.6, 9.5) : rand(10.5, 13.5); W.setFridgeTemp(ev.temp, true); this.alarmTimer = 0; }
    if (type === 'expired') {
      const cand = this.catalog.filter((p) => !p.expired && p.section !== 'fridge' && p.section !== 'devices');
      ev.product = pick(cand);
      ev.expiry = '08/2026';
      W.expiredCarton.visible = true;
    }
    if (type === 'misplaced') { ev.product = this.catalog.find((p) => p.baseKey === 'insulinGlargine') || this.catalog[0]; const it = W.interactables.find((i) => i.section === 'vitamins'); ev.shelf = it; W.highlightShelf(it); }
    this.activeEvent = ev;
    this.ui.toast(def.toast, 'warn', 'bell', 4000);
    this.audio.sfx('notify'); this.haptic('warning');
    this.updateObjective();
  }
  openEvent() {
    const ev = this.activeEvent; if (!ev) return;
    this.ui.showEvent({ title: ev.def?.title || ev.title, icon: ev.icon, text: fillEvent({ ...ev, text: ev.def?.text || ev.text }), options: ev.options, type: ev.type }, (i) => this.resolveEvent(i));
  }
  resolveEvent(i) {
    const ev = this.activeEvent; if (!ev) return;
    const ok = !!ev.options[i].correct;
    const s = this.state;
    if (ok) {
      s.safety = clamp(s.safety + 6, 0, 100); s.reputation = clamp(s.reputation + 3, 0, 100); s.xp += 50;
      if (ev.type === 'fridge') { this.world.setFridgeTemp(5.0, false); this.achieve('coldchain'); }
      if (ev.type === 'expired') { this.world.expiredCarton.visible = false; this.achieve('expired'); }
      if (ev.type === 'misplaced') this.world.highlightShelf(null);
      this.activeEvent = null;
      this.progress('event', { event: ev.type });
    } else if (!ev.penalised) { ev.penalised = true; s.safety = clamp(s.safety - 8, 0, 100); s.reputation = clamp(s.reputation - 3, 0, 100); }
    this.ui.showEventResult(ok, ok ? (ev.def?.learn || ev.learn) : String(ev.def?.learn || ev.learn) + ' ' + tp('ev.tryAgain'), () => { this.updateObjective(); this.save(); });
    this.ui.updateHUD();
  }

  // ───────────────────────── Inspection ─────────────────────────
  inspectionReady() {
    const s = this.state;
    const ok = s.safety >= 70 && (s.modulesDone.length >= 3 || s.practiceBest >= 8);
    return { ok, why: ok ? t('g.readyWhy') : t('g.notReadyWhy', { s: Math.round(s.safety) }) };
  }
  checkInspectionTrigger() {
    const s = this.state;
    if (s.inspection.active || (!s.careerMode && (s.level < 4 || s.level >= 9))) return;
    if (s.served >= s.inspection.nextAt) this._pendingInspection = { official: false };
  }
  ensureInspector() {
    if (this.inspector) return this.inspector;
    const ins = new Character(inspectorDesc());
    ins.walkSpeed = 1.15;
    ins.onStep = (c) => { const d = c.group.position.distanceTo(this.camera.position); if (d < 8) this.audio.sfx('step', { vol: 0.5 * (1 - d / 8) }); };
    ins.group.visible = false;
    this.scene.add(ins.group);
    this.inspector = ins;
    return ins;
  }
  startInspection({ official = false, force = false } = {}) {
    const s = this.state;
    if (s.inspection.active) return;
    if (!force && (this.mode !== 'play' || this.activeCustomer || this.customers.posCust)) { this._pendingInspection = { official }; return; }
    s.inspection.active = true; s.inspection.official = official;
    this.customers.hold = true;
    const cc = this.customers.counterCust;
    if (cc && cc.state !== 'leaving') { this.customers.counterCust = null; cc.state = 'entering'; this.customers._routeNext(cc); }
    if (this.activeEvent?.type === 'fridge') { this.world.setFridgeTemp(5.0, false); }
    this.activeCustomer = null; this.tray = [];
    this.ui.closeAll(); this.ui.closeDialogue(true);
    this.world.highlightShelf(null); this.world.setMarker(null);
    this.mode = 'cine';
    this.runInspectionCinematic(official);
  }
  _cine(fn, ms) { this.cineTimers.push(setTimeout(fn, ms)); }
  runInspectionCinematic(official) {
    const W = this.world, ins = this.ensureInspector(), P = this.player, ui = this.ui;
    this.audio.setMusic('inspection');
    W.setMood('inspection');
    W.setPOS({ title: tp('w.pos'), line1: tp('g.inspMode'), line2: tp('g.compliance'), mode: 'inspection' });
    ui.cinema(true, tp(official ? 'insp.official' : 'insp.surprise'));
    P.path = null; P.group.position.copy(W.points.pharmService); P.heading = 0; P.faceTo(0); P.lookTarget = null;
    const spot = W.points.service;
    ins.group.visible = true; ins.group.position.set(0.3, 0, W.points.doorOutside.z); ins.heading = Math.PI; ins.expression = 'serious';
    ins.setAction('clipboard', 99999);
    ins.walkPath([W.points.doorInside, new THREE.Vector3(-0.2, 0, 3.0), new THREE.Vector3(-1.0, 0, -1.2), spot], { onArrive: () => { ins.faceTo(Math.PI); } });
    this.rig.setShot(new THREE.Vector3(1.6, 1.45, 5.2), new THREE.Vector3(0, 1.35, 9.5), { cut: true, speed: 2 });
    this.audio.sfx('chime');
    const finish = () => {
      this.cineTimers.forEach(clearTimeout); this.cineTimers = [];
      this._cineTrack = null;
      ins.path = null; ins.group.position.copy(spot); ins.heading = Math.PI; ins.faceTo(Math.PI);
      ins.lookTarget = new THREE.Vector3(P.group.position.x, 1.55, P.group.position.z);
      P.lookTarget = new THREE.Vector3(spot.x, 1.65, spot.z);
      this.dialogueShot(ins);
      ui.cinema(false); ui.showHUD(false);
      this.mode = 'quiz';
      ui.showInspectionIntro({ official, onBegin: () => this.beginInspectionQuiz() });
    };
    ui.skipButton(finish);
    this._cine(() => { this._cineTrack = ins; this.rig.setShot(new THREE.Vector3(-2.4, 0.95, 1.4), new THREE.Vector3(0, 1.45, 4), { speed: 1.4 }); }, 2800);
    this._cine(() => { this._cineTrack = null; this.dialogueShot(ins); ins.lookTarget = new THREE.Vector3(P.group.position.x, 1.55, P.group.position.z); P.lookTarget = new THREE.Vector3(spot.x, 1.65, spot.z); }, 7600);
    this._cine(() => {
      const line = tp('g.inspGreeting');
      ins.say(true); setTimeout(() => ins.say(false), 4200);
      this.audio.speak(line, { gender: 'M', age: 52, voice: 3, role: 'staff' });
      ui.subtitle(tp('g.inspector'), line, 4800);
    }, 8600);
    this._cine(finish, 13200);
  }
  beginInspectionQuiz() {
    const s = this.state;
    this.insp = { qs: drawInspection(20), i: 0, correct: 0 };
    s.inspection.attempts++;
    this.mode = 'quiz';
    this.nextInspectionQ();
  }
  nextInspectionQ() {
    const I = this.insp;
    if (I.i >= I.qs.length) return this.inspectionPassed();
    const q = I.qs[I.i];
    this.ui.quizCard({ q, index: I.i, total: 20, mode: 'inspection', streak: I.correct, onAnswer: (ok) => {
      if (ok) { I.correct++; I.i++; this.inspector?.setAction('clipboard', 99999); this.nextInspectionQ(); }
      else this.inspectionFailed();
    } });
  }
  inspectionFailed() {
    const s = this.state, I = this.insp;
    s.inspection.failed++; s.inspection.best = Math.max(s.inspection.best, I.correct);
    this.save();
    const line = tp('g.inspWrong');
    this.inspector.say(true); setTimeout(() => this.inspector.say(false), 3000); this.audio.speak(line, { gender: 'M', age: 52, voice: 3, role: 'staff' });
    this.ui.showInspectionFail(I.correct, () => this.beginInspectionQuiz(), () => this.ui.showTraining());
  }
  inspectionPassed() {
    const s = this.state;
    s.reputation = clamp(s.reputation + 15, 0, 100); s.safety = clamp(s.safety + 10, 0, 100); s.money += 1000; s.xp += 300;
    s.inspection.passed++; s.inspection.certified = true; s.inspection.best = 20;
    s.inspection.nextAt = s.served + randi(10, 15);
    this.world.setCertified(true);
    this.achieve('certified');
    this.audio.sfx('complete'); this.haptic('success');
    const line = tp('g.inspPass');
    this.inspector.expression = 'smile'; this.inspector.say(true); setTimeout(() => this.inspector.say(false), 3500); this.audio.speak(line, { gender: 'M', age: 52, voice: 3, role: 'staff' });
    this.save();
    this.ui.showInspectionPass(() => {
      const ins = this.inspector, W = this.world;
      ins.lookTarget = null;
      const path = this.nav.findPath(ins.group.position, W.points.doorInside) || [W.points.doorInside];
      ins.walkPath([...path, W.points.doorOutside, new THREE.Vector3(3, 0, 13.5)], { onArrive: () => { ins.group.visible = false; } });
      W.setMood('normal');
      W.setPOS({ line1: tp('g.ready'), line2: tp('g.scan') });
      this.audio.setMusic('calm');
      s.inspection.active = false;
      this.customers.hold = false;
      this.player.lookTarget = null;
      this.rig.clearShot();
      this.mode = 'play';
      this.ui.showHUD(true);
      setTimeout(() => this.customers.advanceQueue(), 1500);
      this.progress('inspection');
      this.updateObjective();
      this.save();
    });
  }

  // ───────────────────────── Progression ─────────────────────────
  levelDef() { return LEVELS[Math.min(this.state.level, 10) - 1]; }
  rankName() { return this.state.careerMode ? tp('g.manager') : String(this.levelDef().rank); }
  levelProgressFrac() {
    const s = this.state; if (s.careerMode) return 1;
    const objs = s.levelObjectives || []; if (!objs.length) return 0;
    return objs.filter((o) => o.done).length / objs.length;
  }
  initLevelObjectives() { this.state.levelObjectives = this.levelDef().objectives.map(() => ({ done: false, count: 0 })); }
  canSpawn() {
    if (this.mode === 'title' || this.mode === 'cine' || this.mode === 'quiz') return false;
    if (this.state.inspection.active || this._pendingInspection || this._pendingLevelComplete) return false;
    return true;
  }
  pickScenario() {
    const s = this.state, L = this.levelDef();
    const diffs = s.careerMode ? [1, 2, 3, 3, 4, 4, 5, 5] : (L.difficulties || [1]);
    let pool = SCENARIOS.filter((x) => diffs.includes(x.difficulty) && !s.recentScenarios.includes(x.id) && !this.customers.active.some((c) => c.scn.id === x.id));
    if (!pool.length) pool = SCENARIOS.filter((x) => diffs.includes(x.difficulty));
    return pick(pool);
  }
  forceCustomer() { const scn = this.pickScenario() || SCENARIOS[0]; this.customers.spawn(scn); }
  onLevelStart(L) {
    this.customers.spawnTimer = 3;
    if (L.n === 6) {
      this.triggerEvent('shortage');
      setTimeout(() => { if (this.state.level === 6 && !this.isObjDone('event', 'expired')) this._queueEvent('expired'); }, 30000);
      setTimeout(() => { if (this.state.level === 6 && !this.isObjDone('event', 'fridge')) this._queueEvent('fridge'); }, 75000);
    }
    if (L.n === 10) setTimeout(() => this.startInspection({ official: true, force: true }), 600);
    this.updateObjective();
  }
  _queueEvent(type) {
    const tryIt = () => { if (this.activeEvent || this.mode !== 'play') setTimeout(tryIt, 5000); else this.triggerEvent(type); };
    tryIt();
  }
  isObjDone(type, ev) {
    const L = this.levelDef(), s = this.state;
    return L.objectives.some((o, i) => o.type === type && (!ev || o.event === ev) && s.levelObjectives?.[i]?.done);
  }
  progress(type, data = {}) {
    const s = this.state;
    if (s.careerMode || !s.levelObjectives) return;
    const L = this.levelDef();
    let changed = false;
    L.objectives.forEach((o, i) => {
      const st = s.levelObjectives[i];
      if (!st || st.done || o.type !== type) return;
      switch (type) {
        case 'visit': if (data.target === o.target) { st.done = true; changed = true; } break;
        case 'serve': if (o.safe && !data.safe) { this.ui.toast(t('g.notSafeCount'), 'warn', 'shield'); break; } st.count++; if (st.count >= o.count) st.done = true; changed = true; break;
        case 'viewDetails': if ((st.count || 0) >= o.count) { st.done = true; } changed = true; break;
        case 'event': if (data.event === o.event) { st.done = true; changed = true; } break;
        case 'modules': st.count = s.modulesDone.length; if (st.count >= o.count) st.done = true; changed = true; break;
        case 'practice': if (data.score >= o.score) { st.done = true; changed = true; } break;
        default: st.done = true; changed = true; break;
      }
    });
    if (!changed) return;
    this.audio.sfx('notify', { vol: 0.7 });
    this.updateObjective();
    if (s.levelObjectives.every((o) => o.done)) this._pendingLevelComplete = true;
    this.save();
  }
  levelComplete() {
    const L = this.levelDef();
    this.ui.showLevelComplete(L, () => this.advanceLevel());
  }
  advanceLevel() {
    const s = this.state;
    if (s.level >= 10) { s.careerMode = true; this.applyUnlocks(); this.ui.toast(t('g.career'), 'good', 'trophy', 4000); this.updateObjective(); this.save(); return; }
    s.level++;
    this.initLevelObjectives();
    this.applyUnlocks();
    const L = this.levelDef();
    if (L.n === 9) { const st = s.levelObjectives; L.objectives.forEach((o, i) => { if (o.type === 'modules') { st[i].count = s.modulesDone.length; st[i].done = st[i].count >= o.count; } if (o.type === 'practice' && s.practiceBest >= o.score) st[i].done = true; }); }
    this.save();
    this.ui.showLevelIntro(L, () => { this.onLevelStart(L); if (s.levelObjectives.every((o) => o.done)) this._pendingLevelComplete = true; });
  }
  jumpToLevel(n) {
    const s = this.state;
    this.customers.clearAll(); this.activeCustomer = null; this.tray = []; this.activeEvent = null;
    s.careerMode = false; s.level = n; this.initLevelObjectives(); this.applyUnlocks();
    this.world.setFridgeTemp(5.2, false); this.world.expiredCarton.visible = false; this.world.highlightShelf(null);
    this.ui.updateHUD();
    const L = this.levelDef();
    this.ui.showLevelIntro(L, () => this.onLevelStart(L));
  }
  applyUnlocks() {
    const s = this.state;
    const lv = s.careerMode ? 11 : s.level;
    if (lv >= 2) s.upgrades.outfit_teal = true;
    if (lv >= 6) s.upgrades.theme_evening = true;
    if (lv >= 7) s.upgrades.expansion = true;
    this.world.setExpansion(!!s.upgrades.expansion);
    this.nav.rebuild(this.world.activeColliders(), 0.3);
  }
  buyUpgrade(u) {
    const s = this.state;
    if (s.money < u.cost) { this.ui.toast(t('g.noFunds'), 'warn', 'cash'); return false; }
    s.money -= u.cost; s.upgrades[u.id] = true;
    this.audio.sfx('cash');
    this.applyUpgrade(u, true);
    this.ui.updateHUD(); this.save();
    return true;
  }
  applyUpgrade(u) {
    const s = this.state;
    if (u.type === 'outfit') { s.outfit = u.id; this.applyOutfit(); }
    if (u.type === 'environment') {
      if (u.id === 'expansion') { this.world.setExpansion(true); this.nav.rebuild(this.world.activeColliders(), 0.3); }
      else { s.theme = s.theme === u.id ? 'modern' : u.id; this.world.setTheme(s.theme); }
    }
    if (u.id === 'fridge_pro') this.ui.toast(t('g.fridgePro'), 'good', 'snow');
    this.save();
  }
  applyOutfit() {
    const o = OUTFITS[this.state.outfit] || OUTFITS.default;
    const old = this.player;
    const P = new Character(pharmacistDesc(o));
    P.walkSpeed = 1.8; P.runSpeed = 3.3;
    P.group.position.copy(old.group.position); P.heading = old.heading;
    P.onStep = old.onStep;
    P.attachProp('bag', makeProp('bag'), 'handR', [0, -0.12, 0.05]);
    this.scene.remove(old.group); old.dispose();
    this.scene.add(P.group);
    this.player = P;
  }
  achieve(id) {
    const s = this.state;
    if (s.achievements[id]) return;
    s.achievements[id] = Date.now();
    const a = ACHIEVEMENTS.find((x) => x.id === id);
    if (a) { this.ui.toast(t('g.achievement', { name: a.name }), 'good', 'trophy', 3500); this.audio.sfx('levelup', { vol: 0.6 }); }
  }
  completeModule(id) {
    const s = this.state;
    if (!s.modulesDone.includes(id)) s.modulesDone.push(id);
    if (s.modulesDone.length >= MODULES.length) this.achieve('scholar');
    this.progress('modules');
    this.ui.toast(t('g.studied'), 'good', 'book', 1800);
    this.save();
  }
  drawQuestions(n) { return drawInspection(n); }
  recordPractice(score) {
    const s = this.state;
    s.practiceBest = Math.max(s.practiceBest, score);
    this.progress('practice', { score });
    this.save();
  }

  updateObjective() {
    const ui = this.ui, s = this.state, W = this.world, cc = this.customers.counterCust, pc = this.customers.posCust;
    let text = '', step = '', ic = 'flag', marker = null, mh = 2.3;
    if (s.inspection.active) { text = tp('g.objInsp'); ic = 'shield'; }
    else if (this.mode === 'dialogue' && this.activeCustomer) { text = this.guide.objectiveHint() || tp('g.objDialogue'); ic = 'chat'; }
    else if (pc && (pc.state === 'atPOS' || pc.state === 'toPOS')) { text = tp('g.objPOS'); ic = 'cash'; marker = W.points.posPharm; }
    else if (this.activeEvent) {
      const ev = this.activeEvent; text = String(ev.def?.objective || ev.objective); ic = 'bell';
      marker = ev.where === 'fridge' ? W.points.fridgeStand : ev.where === 'storage' ? W.points.storageStand : ev.where === 'pos' ? W.points.posPharm : ev.shelf ? ev.shelf.stand : null;
    } else if (cc && (cc.state === 'atCounter' || cc.state === 'talking')) { text = tp(this.activeCustomer === cc ? 'g.objReturn' : 'g.objTalk'); ic = 'user'; marker = W.points.pharmService; }
    else if (this.arrivedOrders().length) { text = tp('stk.obj'); ic = 'box'; marker = W.points.storageStand; }
    else if (s.careerMode) { text = tp('g.objCareer'); step = tp('g.served', { n: s.served }); ic = 'star'; }
    else {
      const L = this.levelDef();
      const i = (s.levelObjectives || []).findIndex((o) => !o.done);
      if (i >= 0) {
        const o = L.objectives[i], st = s.levelObjectives[i];
        text = String(o.label); if (o.count) step = `${Math.min(st.count || 0, o.count)}/${o.count}`;
        if (o.type === 'visit') marker = { counter: W.points.pharmService, fridge: W.points.fridgeStand, pos: W.points.posPharm, storage: W.points.storageStand }[o.target];
        if (o.type === 'modules' || o.type === 'practice') { marker = W.interactables.find((x) => x.id === 'workstation').stand; ic = 'book'; }
        if (o.type === 'restock') { marker = W.points.posPharm; ic = 'box'; }
        if (o.type === 'inspectShelf') { ic = 'eye'; }
        if (o.type === 'serve') { ic = 'user'; if (!cc) text = tp(this.customers.active.length ? 'g.arriving' : 'g.waitingFor', { obj: isTA() ? String(o.label) : String(o.label).toLowerCase() }); }
        if (o.type === 'viewDetails' || o.type === 'search') ic = 'search';
      } else { text = tp('g.levelDone'); ic = 'trophy'; }
    }
    ui.setObjective(text, step, ic);
    const tgt = marker && this.mode === 'play' ? marker : null;
    const cur = W.marker.target;
    if (!tgt) { if (cur) W.setMarker(null); }
    else if (!cur || cur.distanceTo(tgt) > 0.01) W.setMarker(tgt, mh);
    if (tgt && this.player.group.position.distanceTo(tgt) < 0.9) W.setMarker(null);
  }

  // ───────────────────────── Settings & performance ─────────────────────────
  applySettings(persist = true) {
    const S = this.settings;
    document.documentElement.style.setProperty('--ts', S.textScale);
    this.ui.root.classList.toggle('color-safe', S.colorSafe);
    document.body.classList.toggle('reduced', S.reducedMotion);
    this.audio.applyVolumes();
    if (!S.voiceDialogue) this.audio.stopSpeech();
    this.world.setLODDebug(S.lodDebug);
    this.applyQuality();
    this.ui.updateHUD();
    if (persist) { clearTimeout(this._setT); this._setT = setTimeout(() => this.saveSettingsNow(), 400); }
  }
  applyQuality() {
    const q = this.settings.quality, dpr = window.devicePixelRatio || 1;
    this.maxPR = q === 'low' ? Math.min(dpr, 1) * 0.8 : q === 'medium' ? Math.min(dpr, 1.5) : q === 'high' ? Math.min(dpr, 2) : q === 'ultra' ? Math.min(dpr, 2.5) : Math.min(dpr, 2);
    if (q !== 'auto' || !this.pr || this.pr > this.maxPR) this.pr = q === 'auto' ? Math.min(this.maxPR, 1.5) : this.maxPR;
    this.renderer.setPixelRatio(this.pr);
    const shadows = q === 'high' || q === 'ultra' || q === 'auto';
    const ultra = q === 'ultra';
    const key = (shadows ? 1 : 0) + (ultra ? 2 : 0);
    if (this._shadowKey !== key) {
      this._shadowKey = key;
      this.renderer.shadowMap.enabled = shadows;
      this.world.setShadows(shadows, ultra, window.matchMedia?.('(hover: hover) and (pointer: fine)').matches);
      Character.shadows = shadows;
      this.scene.traverse((o) => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { m.needsUpdate = true; }); if (o.isSkinnedMesh) o.castShadow = shadows; });
      this.blobs.visible = !shadows;
    }
    this.bloom = ultra && !this._bloomDropped;
    // planar floor reflections: Ultra everywhere, High on PCs (mouse + keyboard); auto-dropped if the GPU struggles
    const desk = document.documentElement.classList.contains('desktop') || window.matchMedia?.('(hover: hover) and (pointer: fine)').matches;
    this.ao = (ultra || (q === 'high' && desk)) && !this._aoDropped;      // ambient occlusion pass
    this.reflWanted = (ultra || (q === 'high' && desk)) && !this._reflDropped;
    this.world.setReflections?.(this.reflWanted, ...this.reflSize());
    Character.lodDist = ultra ? 16 : q === 'low' ? 6 : 9;
    const near = q === 'low' ? 5 : ultra ? 16 : q === 'medium' ? 8 : 11, far = q === 'low' ? 10 : ultra ? 30 : q === 'medium' ? 16 : 20;
    for (const s of this.world.shelves) { s.lod.levels[1].distance = near; s.lod.levels[2].distance = far; }
    this.onQualityChange?.(q);
  }
  reflSize() { const v = this.renderer.getDrawingBufferSize(this._dbs || (this._dbs = new THREE.Vector2())); return [Math.max(256, Math.round(v.x * 0.5)), Math.max(256, Math.round(v.y * 0.5))]; }
  recenterCamera() { this.rig.yaw = this.player.heading; this.rig.pitch = 0.3; this.rig.dist = 3.1; this.rig.lastManual = this.rig.time; }
  canFullscreen() { const d = document.documentElement; return !!(d.requestFullscreen || d.webkitRequestFullscreen) && !window.Capacitor?.isNativePlatform?.() && !/RxShiftApp/.test(navigator.userAgent); } // the Android app is already full-screen
  toggleFullscreen() {
    try {
      const d = document.documentElement;
      if (document.fullscreenElement || document.webkitFullscreenElement) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      else { const r = (d.requestFullscreen || d.webkitRequestFullscreen).call(d, { navigationUI: 'hide' }); r?.then?.(() => { try { screen.orientation?.lock?.('landscape').catch(() => {}); } catch { /* ignore */ } }).catch?.(() => {}); }
    } catch { /* ignore */ }
  }
  /** Dynamic resolution (auto quality) */
  perfTick(frameMs) {
    this.frameAvg = this.frameAvg * 0.95 + frameMs * 0.05;
    if (this.settings.quality !== 'auto' && !this.settings.adaptiveRes) return;
    this.autoTimer += frameMs / 1000;
    if (this.autoTimer < 2) return;
    // Smooth mode: drop resolution quickly when frames are slow, raise it back slowly.
    // keep it HD: never below ~1× on PCs, ~1.2× on high-DPI phones (effects step down first)
    const dpr = window.devicePixelRatio || 1, desk = document.documentElement.classList.contains('desktop');
    const minPR = this.settings.quality === 'low' ? Math.max(0.6, this.maxPR * 0.6) : Math.min(this.maxPR, desk ? Math.max(0.85, dpr * 0.75) : Math.max(0.9, Math.min(1.25, dpr * 0.6)));
    const slow = this.settings.fpsCap === 30 ? 36 : 19.5, fast = this.settings.fpsCap === 30 ? 26 : 14;
    // at the lowest render scale and still slow: drop costly effects one by one instead of going blurry
    if (this.frameAvg > slow && this.pr <= minPR + 1e-3) { if (this._degrade()) { this.autoTimer = -2; return; } }
    if (this.frameAvg > slow && this.pr > minPR) { this.pr = Math.max(minPR, this.pr - (this.frameAvg > slow * 1.5 ? 0.2 : 0.1)); this.renderer.setPixelRatio(this.pr); this.onQualityChange?.(this.settings.quality); this.autoTimer = 0.5; }
    else if (this.frameAvg < fast && this.pr < this.maxPR) { this.pr = Math.min(this.maxPR, this.pr + 0.05); this.renderer.setPixelRatio(this.pr); this.onQualityChange?.(this.settings.quality); this.autoTimer = -3; }
    else this.autoTimer = 1;
  }
  /** One step down the effects ladder (reflections → bloom → fixture shadows → all shadows). */
  _degrade() {
    if (this.ao) { this._aoDropped = true; this.ao = false; return true; }
    if (this.world.reflOn) { this._reflDropped = true; this.world.setReflections(false); return true; }
    if (this.bloom) { this._bloomDropped = true; this.bloom = false; return true; }
    if (this._shadowKey >= 2) { this._shadowKey = 1; this.world.setShadows(true, false, false); return true; }
    if (this.renderer.shadowMap.enabled) {
      this._shadowKey = 0; this.renderer.shadowMap.enabled = false; this.world.setShadows(false, false); Character.shadows = false;
      this.scene.traverse((o) => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { m.needsUpdate = true; }); if (o.isSkinnedMesh) o.castShadow = false; });
      this.blobs.visible = true; return true;
    }
    return false;
  }
  haptic(kind) { haptic(this.settings, kind); }

  // ───────────────────────── Language ─────────────────────────
  setLanguage(code, persist = true) {
    setLang(code);
    const L = getLang();
    applyContent(L);
    this.settings.lang = L;
    if (persist) this.saveSettingsNow();
    for (const c of this.customers.active) this.customers.relocalize(c);
    this.audio.lang = L;
    this.world.relabel?.();
    this.ui.relabel();
    if (this.mode === 'title') this.ui.refreshTitle?.();
    if (this.ui.dlgCust) this.ui.refreshDialogue?.();
    if (this.state.level) this.updateObjective();
  }
  itLabel(it) {
    switch (it.type) {
      case 'fridge': return tp('it.fridge');
      case 'workstation': return tp('it.workstation');
      case 'storage': return tp('it.storage');
      case 'counter': return tp('it.counter');
      case 'pos': return tp('it.pos');
      case 'shelf': return tp('it.shelf', { name: String(SECTIONS[it.section]?.name || '') });
      default: return String(it.label || '');
    }
  }
}
