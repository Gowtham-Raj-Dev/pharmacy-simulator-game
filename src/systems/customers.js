// Customer AI: pooled characters, arrival, queueing (counter / waiting seats),
// consultation, payment, leaving. Parents can arrive with a child (follower).
import * as THREE from 'three';
import { Character, randomCustomerDesc, Rocketbox } from '../world/character.js';
import { NAMES } from '../data/names.js';
import { pick, rand, randi } from '../core/util.js';
import { mapBi, tp } from '../i18n/i18n.js';

const _v = new THREE.Vector3(), _off = new THREE.Vector3(), _tgt = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);

function ageGroup(age) { return age >= 62 ? 'elderly' : age < 13 ? 'child' : age < 18 ? 'teen' : 'adult'; }

/**
 * How a customer pays is their own choice, as at a real counter: most people scan UPI, older people
 * more often hand over cash, some tap a card (more so for bigger bills). Cash comes as notes, so there
 * is usually change to give back. Returns { method, given?, change? }.
 */
export function choosePayment(age, total) {
  const w = age >= 60 ? { upi: 0.28, card: 0.17, cash: 0.55 } : age < 30 ? { upi: 0.72, card: 0.1, cash: 0.18 } : { upi: 0.55, card: 0.17, cash: 0.28 };
  if (total > 800) { w.card += 0.15; w.cash = Math.max(0.05, w.cash - 0.1); }
  let r = Math.random() * (w.upi + w.card + w.cash);
  const method = (r -= w.upi) < 0 ? 'upi' : (r -= w.card) < 0 ? 'card' : 'cash';
  if (method !== 'cash') return { method };
  const amt = Math.ceil(total), up = (n) => Math.ceil(amt / n) * n;
  const note = [50, 100, 200, 500, 2000].find((n) => n >= amt) || up(500);
  const given = Math.random() < 0.15 ? amt : pick([...new Set([up(50), up(100), note])]);
  return { method, given, change: given - amt };
}

export class CustomerManager {
  constructor(game) {
    this.g = game;
    this.active = [];
    this.pool = [];
    this.spawnTimer = 3;
    this.counterCust = null;   // customer occupying / heading to the service point
    this.posCust = null;
    this.hold = false;         // inspection hold
  }

  async preload(onProgress) {
    // realistic visitors: one pooled character per Rocketbox avatar (every visitor model gets used).
    // All of them load here, behind the loading screen: nothing pops in or downloads once the lobby is up.
    let plan = [];
    const ageFor = (id, i) => (Rocketbox.info(id).age === 'older' ? 66 + (i % 9) : 24 + ((i * 7) % 30));
    if (Rocketbox.enabled) {
      const all = Rocketbox.visitorIds();
      await Rocketbox.loadAll(all, (p) => onProgress?.(p * 0.75));
      all.forEach((id, i) => { const a = Rocketbox.info(id); if (Rocketbox.has(id)) plan.push([a.sex, ageFor(id, i), { avatar: id }]); });
    }
    if (!plan.length) plan = [['M', 34], ['M', 45], ['M', 28], ['M', 56], ['F', 27], ['F', 38], ['F', 48], ['F', 31], ['M', 70], ['F', 68], ['M', 74], ['F', 66], ['F', 15]];
    plan.push(['M', 6], ['F', 7], ['M', 3]);
    for (let i = 0; i < plan.length; i++) {
      const [gender, age, extra] = plan[i];
      this._build(gender, age, extra);
      onProgress?.(0.75 + 0.25 * (i + 1) / plan.length);
      if (i % 3 === 2) await new Promise((r) => setTimeout(r, 0));
    }
  }
  _build(gender, age, extra = {}) {
    const desc = randomCustomerDesc({ gender, age, seed: randi(1, 1e9) });
    Object.assign(desc, extra);
    const ch = new Character(desc);
    const item = { char: ch, gender, group: ageGroup(age), busy: false, special: !!extra.infant, lastUsed: -Math.random() };
    ch.group.visible = false;
    this.g.scene.add(ch.group);
    this._wire(ch);
    this.pool.push(item);
    return item;
  }
  _wire(ch) {
    ch.onStep = (c) => { const d = c.group.position.distanceTo(this.g.camera.position); if (d < 7) this.g.audio.sfx('step', { vol: 0.35 * (1 - d / 7) }); };
    ch.onCough = (c) => { const d = c.group.position.distanceTo(this.g.camera.position); if (d < 9) this.g.audio.sfx(c.gesture === 'sneeze' ? 'sneeze' : 'cough', { vol: 0.9 * (1 - d / 9) }); };
  }
  _acquire(gender, age, extra = {}) {
    const grp = ageGroup(age);
    // least recently seen free character of the right gender / age group (variety)
    const lru = (ok) => { let best = null; for (const p of this.pool) if (!p.busy && !p.special && p.gender === gender && ok(p) && (!best || p.lastUsed < best.lastUsed)) best = p; return best; };
    let item = !extra.infant && lru((p) => p.group === grp);
    if (!item && !extra.infant && grp !== 'child') item = lru((p) => p.group === 'adult' || p.group === 'elderly' || p.group === 'teen');
    if (!item) item = this._build(gender, age, extra);
    item.busy = true; item.lastUsed = this.g.time || performance.now() / 1000;
    const ch = item.char;
    ch.group.visible = true;
    ch.expression = 'neutral'; ch.talking = false; ch.action = null; ch.sitTarget = 0; ch.sitW = 0; ch.lookTarget = null;
    ch.speed = 0; ch.path = null;
    return item;
  }
  _release(item) {
    if (!item) return;
    item.busy = false; item.char.group.visible = false; item.char.path = null;
    if (item.special) { this.g.scene.remove(item.char.group); item.char.dispose(); this.pool.splice(this.pool.indexOf(item), 1); }
  }

  get queueOrder() { return this.active.filter((c) => ['entering', 'waiting', 'toSeat', 'queued'].includes(c.state)).sort((a, b) => a.arrival - b.arrival); }

  spawn(scn) {
    const g = this.g, W = g.world;
    const gender = scn.patient.gender, age = scn.patient.age;
    const item = this._acquire(gender, age, scn.child && scn.child.age < 1 ? { infant: true } : {});
    const ch = item.char;
    ch.gesture = scn.gesture || 'none'; ch.limp = scn.gesture === 'limp'; ch.gestureOn = false; ch.gestureW = 0;
    const usedNames = new Set(this.active.map((c) => c.name));
    const free = NAMES[gender].map((n, i) => i).filter((i) => !usedNames.has(NAMES[gender][i]));
    const nameIdx = free.length ? pick(free) : randi(0, NAMES[gender].length - 1);
    const name = NAMES[gender][nameIdx];
    g.state.customerCounter++;
    const c = {
      id: Math.random().toString(36).slice(2), num: g.state.customerCounter, scn, name, nameIdx, gender, age, item, char: ch,
      state: 'entering', arrival: g.time, waitT: 0, asked: new Set(), log: [], tray: [], seat: null, greeted: false, requested: null,
    };
    if (scn.child && scn.child.age >= 1) {
      const kid = this._acquire(scn.child.gender, Math.max(2, scn.child.age));
      c.childItem = kid; c.child = kid.char; c.childIdx = randi(0, NAMES[scn.child.gender === 'M' ? 'childM' : 'childF'].length - 1); c.childName = NAMES[scn.child.gender === 'M' ? 'childM' : 'childF'][c.childIdx];
      kid.char.gesture = 'none';
      kid.char.group.position.set(0.6, 0, W.points.doorOutside.z + 0.6);
    }
    if (scn.child && scn.child.age < 1) { ch.setAction('carry', 9999); c.childIdx = randi(0, NAMES[scn.child.gender === 'M' ? 'childM' : 'childF'].length - 1); c.childName = NAMES[scn.child.gender === 'M' ? 'childM' : 'childF'][c.childIdx]; }
    // out-of-stock brand request
    if (scn.request) {
      const cands = g.catalog.filter((p) => p.baseKey === scn.request.baseKey && p.strength === scn.request.strength && !p.isGeneric && p.form === 'Tablet');
      const req = cands[0];
      if (req) { req.stock = 0; g.state.stock[req.id] = 0; c.requested = req; }
    }
    c.complaint = this.complaintFor(c);
    ch.group.position.set(rand(-0.4, 0.4), 0, W.points.doorOutside.z);
    ch.heading = Math.PI;
    ch.walkPath([W.points.doorInside, W.points.entry], { onArrive: () => this._routeNext(c) });
    this.active.push(c);
    g.audio.sfx('chime');
    g.onCustomerArrive?.(c);
    return c;
  }

  complaintFor(c) {
    const s = c.scn.complaint;
    return String(s).includes('{BRAND}') ? mapBi(s, (x) => x.replace('{BRAND}', c.requested ? String(c.requested.name) : tp('cust.usualBrand'))) : s;
  }
  /** Re-localise a live customer after a language change (names + complaint). */
  relocalize(c) {
    if (c.nameIdx != null) c.name = NAMES[c.gender][c.nameIdx];
    if (c.childIdx != null && c.scn.child) c.childName = NAMES[c.scn.child.gender === 'M' ? 'childM' : 'childF'][c.childIdx];
    c.complaint = this.complaintFor(c);
  }

  _routeNext(c) {
    const g = this.g, W = g.world;
    if (!this.counterCust && !this.hold && this.queueOrder[0] === c) return this._goCounter(c);
    // find a seat
    const seat = W.points.waitSeats.find((s) => !s.taken);
    if (seat) {
      seat.taken = c; c.seat = seat; c.state = 'toSeat';
      const approach = seat.pos.clone().add(new THREE.Vector3(0, 0, -0.7));
      const path = g.nav.findPath(c.char.group.position, approach) || [approach];
      c.char.walkPath(path, { onArrive: () => {
        // turn round and step back to the chair, then sit down
        c.char.walkPath([seat.pos], { speed: 0.45, backward: true, onArrive: () => { c.char.faceTo(seat.heading); c.char.sit(true); c.state = 'waiting'; } });
      } });
    } else {
      c.state = 'queued';
      const idx = Math.min(this.active.filter((x) => x.state === 'queued').length - 1, W.points.queue.length - 1);
      const spot = W.points.queue[Math.max(0, idx)];
      const path = g.nav.findPath(c.char.group.position, spot) || [spot];
      c.char.walkPath(path, { onArrive: () => c.char.faceTo(Math.PI) });
    }
  }
  _goCounter(c) {
    const g = this.g, W = g.world;
    this.counterCust = c;
    if (c.seat) { c.seat.taken = null; c.seat = null; }
    c.char.sit(false);
    c.state = 'toCounter';
    const go = () => {
      const path = g.nav.findPath(c.char.group.position, W.points.service) || [W.points.service];
      c.char.walkPath(path, { onArrive: () => { c.state = 'atCounter'; c.char.faceTo(Math.PI); c.atCounterT = g.time; g.onCustomerAtCounter?.(c); } });
    };
    if (c.char.sitW > 0.3) setTimeout(go, 600); else go();
  }
  /** Called when counter frees up */
  advanceQueue() {
    if (this.counterCust || this.hold) return;
    const next = this.queueOrder.find((c) => c.state === 'waiting' || c.state === 'queued');
    if (next) this._goCounter(next);
  }

  sendToPOS(c) {
    const W = this.g.world;
    this.g.endTalkWith(c);
    if (this.counterCust === c) this.counterCust = null;
    this.posCust = c;
    c.state = 'toPOS';
    c.pay = choosePayment(c.age, c.bill ? c.bill.reduce((a, p) => a + p.price, 0) : 0);
    c.char.walkPath([new THREE.Vector3(W.points.posCustomer.x - 0.6, 0, W.points.posCustomer.z + 0.1), W.points.posCustomer], { onArrive: () => { c.state = 'atPOS'; c.char.faceTo(Math.PI); this.g.onCustomerAtPOS?.(c); } });
    setTimeout(() => this.advanceQueue(), 1500);
  }
  leave(c, delay = 0) {
    const g = this.g, W = g.world;
    g.endTalkWith(c);
    c.state = 'leaving';
    setTimeout(() => {
      if (this.counterCust === c) this.counterCust = null;
      if (this.posCust === c) this.posCust = null;
      if (c.seat) { c.seat.taken = null; c.seat = null; }
      c.state = 'leaving';
      c.char.sit(false); c.char.lookTarget = null; c.char.talking = false; c.char.say(false);
      if (c.char.action !== 'carry') c.char.action = null;
      const path = g.nav.findPath(c.char.group.position, W.points.doorInside) || [W.points.doorInside];
      c.char.walkPath([...path, W.points.doorOutside, new THREE.Vector3(c.char.group.position.x > 0 ? 3 : -3, 0, 13.5)], { onArrive: () => this._despawn(c) });
      setTimeout(() => this.advanceQueue(), 1200);
    }, delay);
  }
  _despawn(c) {
    this.active.splice(this.active.indexOf(c), 1);
    this._release(c.item);
    if (c.childItem) this._release(c.childItem);
    this.g.onCustomerLeft?.(c);
  }
  clearAll() {
    this.g.finishTalk(true);
    this.g.audio.stopSpeech();
    for (const c of [...this.active]) { this._release(c.item); if (c.childItem) this._release(c.childItem); if (c.seat) c.seat.taken = null; }
    this.active = []; this.counterCust = null; this.posCust = null;
  }

  update(dt) {
    const g = this.g;
    const camPos = g.camera.position;
    const playerHead = _v.set(g.player.group.position.x, 1.55, g.player.group.position.z);
    for (const c of this.active) {
      const ch = c.char;
      if (c.state === 'waiting' || c.state === 'atCounter' || c.state === 'queued' || c.state === 'atPOS') c.waitT += dt;
      if (c.state === 'atCounter' || c.state === 'talking' || c.state === 'atPOS' || c.state === 'paying') ch.lookTarget = ch.lookTarget || new THREE.Vector3();
      if (ch.lookTarget && (c.state === 'atCounter' || c.state === 'talking' || c.state === 'atPOS' || c.state === 'paying')) ch.lookTarget.copy(playerHead);
      else if (c.state === 'waiting') ch.lookTarget = null;
      ch.update(dt, camPos);
      // child follower
      if (c.child) {
        const k = c.child, p = ch.group.position, hgt = ch.heading;
        const off = _off.set(-0.58, 0, -0.12).applyAxisAngle(_up, hgt);
        const target = _tgt.copy(p).add(off);
        const d = k.group.position.distanceTo(target);
        if (d > 0.12) {
          if (!k.path || k._retarget <= 0) { k.walkPath([target], { speed: Math.max(0.8, ch.speed * 1.15 + d * 0.8) }); k._retarget = 0.25; }
          k._retarget -= dt;
        } else { k.path = null; k.faceTo(hgt); }
        if (c.state === 'atCounter' || c.state === 'talking') { k.lookTarget = k.lookTarget || new THREE.Vector3(); k.lookTarget.copy(playerHead); } else k.lookTarget = null;
        k.update(dt, camPos);
      }
    }
    // spawn logic
    const lv = g.levelDef();
    if (!this.hold && g.canSpawn()) {
      this.spawnTimer -= dt;
      const max = g.state.careerMode ? 3 : (lv.queueMax || 0);
      if (this.spawnTimer <= 0 && this.active.filter((c) => c.state !== 'leaving').length < max) {
        const scn = g.pickScenario();
        if (scn) this.spawn(scn);
        this.spawnTimer = rand(9, 16);
      }
    }
  }

  actors() {
    const out = this._actOut || (this._actOut = []);
    out.length = 0;
    for (const c of this.active) { out.push(c.char); if (c.child) out.push(c.child); }
    return out;
  }
}
