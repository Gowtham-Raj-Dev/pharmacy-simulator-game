// Mentor / guided mode: tells the player exactly where to go, what to ask, which
// medicine to choose and what to do next — in English, Tamil or both.
// The decision is revealed only after the ★ key questions are asked, so the
// player still learns *why*; the mentor never skips the safety reasoning.
import { t, tp } from '../i18n/i18n.js';
import { productIssues, matchesAccept, Q_LABEL } from './evaluation.js';

const PLACES = ['counter', 'fridge', 'pos', 'storage'];

export class Guide {
  constructor(g) { this.g = g; this._sugCache = new Map(); }

  // ───────── helpers ─────────
  keyList(c) {
    const s = c.scn, keys = new Set(s.keyQuestions || []);
    if (s.correct.type === 'refer') keys.add('symptoms');
    return [...keys];
  }
  isKey(c, key) { return this.keyList(c).includes(key); }
  missingKeys(c) { return this.keyList(c).filter((k) => !c.asked.has(k)); }
  keysDone(c) { return this.missingKeys(c).length === 0; }
  listQ(keys) { return keys.map((k) => Q_LABEL[k]).join(', '); }
  rec(c) {
    const cor = c.scn.correct;
    const type = cor.type === 'refer' ? (cor.urgency === 'emergency' ? 'emergency' : 'doctor') : cor.type;
    const accept = cor.accept || [];
    const label = accept.length ? tp('tag.' + accept[0]) : '';
    return { type, accept, label };
  }
  /** Safe, in-stock products that match the correct answer for this customer. */
  suggested(c) {
    if (!c || !this.keysDone(c)) return new Set();
    const r = this.rec(c); if (r.type !== 'dispense') return new Set();
    const key = c.id + ':' + this.g.catalog.reduce((a, p) => a + (p.stock === 0 ? 1 : 0), 0);
    if (this._sugCache.has(key)) return this._sugCache.get(key);
    const all = new Set(['allergies', 'meds', 'history', 'lifestyle', 'symptoms', 'duration']);
    const ids = new Set();
    for (const p of this.g.catalog) {
      if (!matchesAccept(p, r.accept) || p.expired || p.stock === 0 || !this.g.sectionUnlocked(p.section)) continue;
      if (productIssues([p], c.scn, all).some((i) => i.sev === 'major')) continue;
      ids.add(p.id);
    }
    this._sugCache.clear(); this._sugCache.set(key, ids);
    return ids;
  }
  /** A search word that is guaranteed to find the suggested products (current language). */
  query(c) {
    const ids = this.suggested(c); if (!ids.size) return '';
    const p = this.g.productById.get(ids.values().next().value);
    return String(p.generic).replace(/\s*\(.*?\)/g, '').split('/')[0].trim().split(' ').slice(0, 2).join(' ');
  }
  trayState(c) {
    const r = this.rec(c), tray = this.g.tray, all = new Set(['allergies', 'meds', 'history', 'lifestyle', 'symptoms', 'duration']);
    const also = c.scn.alsoOk?.type === 'dispense' ? c.scn.alsoOk.accept : [];
    let good = null, bad = null, badMsg = '';
    for (const p of tray) {
      const maj = productIssues([p], c.scn, all).find((i) => i.sev === 'major');
      if (maj) { bad = bad || p; badMsg = badMsg || maj.msg; continue; }
      if (matchesAccept(p, r.accept) || matchesAccept(p, also)) good = good || p; else bad = bad || p;
    }
    return { good, bad, badMsg };
  }
  _act(label, fn, primary = false, icon = null) { return { label, fn, primary, icon }; }
  _walk(place) {
    const g = this.g, W = g.world;
    const it = W.interactables.find((i) => i.id === place || i.type === place);
    if (place === 'counter') return () => g.autoWalkTo(W.points.pharmService, 0);
    if (place === 'pos') return () => g.interact(W.interactables.find((i) => i.id === 'pos'));
    if (it) return () => g.interact(it);
    return () => {};
  }

  // ───────── dialogue banner ─────────
  next(c) {
    if (!c) return null;
    const g = this.g, ui = g.ui, s = c.scn;
    if (s.prescription && !c.rxViewed) return { text: t('gd.n.rxFirst'), action: this._act(t('gd.act.rx'), () => { c.rxViewed = true; ui.showPrescription(c); }) };
    const miss = this.missingKeys(c);
    if (miss.length) return { text: t('gd.n.askKey', { list: this.listQ(miss) }) };
    const r = this.rec(c);
    if (r.type === 'doctor') return { text: t('gd.n.doctor'), action: this._act(t('gd.act.refer'), () => ui.showReferral()) };
    if (r.type === 'emergency') return { text: t('gd.n.emergency'), action: this._act(t('gd.act.refer'), () => ui.showReferral()) };
    if (r.type === 'advise') return { text: t('gd.n.advise'), action: this._act(t('gd.act.advise'), () => g.beginCounsel({ type: 'advise' })) };
    const ts = this.trayState(c), q = this.query(c);
    if (ts.good && !ts.bad) return { text: t('gd.n.trayGood'), action: this._act(t('gd.act.safety'), () => g.openSafetyCheck()) };
    if (ts.bad) return { text: t('gd.n.trayBad', { name: ts.bad.brand, label: r.label }), action: this._act(t('guide.showMe'), () => g.openCabinet(q)) };
    return { text: t('gd.n.dispense', { label: r.label, q }), action: this._act(t('guide.showMe'), () => g.openCabinet(q)) };
  }
  objectiveHint() {
    if (!this.g.settings.guided) return '';
    const n = this.next(this.g.activeCustomer);
    return n ? String(n.text) : '';
  }

  // ───────── inventory / product / safety / referral hints ─────────
  medicineHint(c) {
    if (!c) return null;
    if (!this.keysDone(c)) return { text: t('gd.h.askFirst') };
    const r = this.rec(c);
    if (r.type !== 'dispense') return { text: t('gd.h.noMed', { what: tp(r.type === 'advise' ? 'gd.h.adviseOnly' : r.type === 'emergency' ? 'gd.h.referEm' : 'gd.h.referDoc') }) };
    return { text: t('gd.h.dispense', { label: r.label }), query: this.query(c) };
  }
  verdict(p, c) {
    if (!c) return null;
    if (!this.keysDone(c)) return { tone: 'warn', text: t('gd.v.askFirst') };
    if (p.expired) return { tone: 'bad', text: t('gd.v.expired') };
    const r = this.rec(c);
    if (r.type === 'doctor' || r.type === 'emergency') return { tone: 'bad', text: t('gd.v.refer') };
    if (r.type === 'advise') return { tone: 'warn', text: t('gd.v.advise') };
    const iss = productIssues([p], c.scn, c.asked).filter((i) => i.sev === 'major');
    const known = iss.find((i) => i.known), unknown = iss.find((i) => !i.known);
    if (known) return { tone: 'bad', text: t('gd.v.unsafe', { msg: known.msg }) };
    if (unknown) return { tone: 'warn', text: t('gd.v.unknown', { q: Q_LABEL[unknown.cat] || unknown.cat }) };
    if (matchesAccept(p, r.accept)) return { tone: 'good', text: t('gd.v.good') };
    const also = c.scn.alsoOk?.type === 'dispense' ? c.scn.alsoOk.accept : [];
    if (matchesAccept(p, also)) return { tone: 'warn', text: t('gd.v.ok', { label: r.label }) };
    return { tone: 'warn', text: t('gd.v.wrong', { label: r.label }) };
  }
  safetyTip(c) {
    if (!c) return null;
    const r = this.rec(c), tray = this.g.tray;
    if (r.type === 'doctor' || r.type === 'emergency') return { tone: 'bad', text: t('gd.s.refer') };
    if (r.type === 'advise') return { tone: 'warn', text: t('gd.s.advise') };
    if (!tray.length) return { tone: 'warn', text: t('gd.s.empty') };
    const miss = this.missingKeys(c);
    if (miss.length) return { tone: 'warn', text: t('gd.s.unasked', { list: this.listQ(miss) }) };
    const ts = this.trayState(c);
    if (ts.badMsg) return { tone: 'bad', text: t('gd.s.remove', { name: ts.bad.brand, msg: ts.badMsg }) };
    if (ts.good && !ts.bad) return { tone: 'good', text: t('gd.s.good') };
    return { tone: 'warn', text: t('gd.s.change', { label: r.label }) };
  }
  referTip(c) {
    if (!c) return null;
    const miss = this.missingKeys(c);
    if (miss.length) return { tone: 'warn', text: t('gd.n.askKey', { list: this.listQ(miss) }) };
    const r = this.rec(c);
    if (r.type === 'doctor') return { tone: 'good', text: t('gd.r.doctor'), pick: 'doctor' };
    if (r.type === 'emergency') return { tone: 'good', text: t('gd.r.emergency'), pick: 'emergency' };
    return { tone: 'warn', text: t('gd.r.no', { what: tp(r.type === 'advise' ? 'gd.h.adviseOnly' : 'gd.r.dispense') }) };
  }

  // ───────── full step-by-step panel ─────────
  build() {
    const g = this.g, s = g.state, W = g.world, ui = g.ui;
    const cc = g.customers.counterCust, pc = g.customers.posCust;
    const step = (text, state, actions, sub) => ({ text, state, actions, sub });
    if (s.inspection.active) return { title: t('gd.title.insp'), intro: t('gd.intro.insp'), steps: [step(t('gd.inspAll'), 'now'), step(t('gd.inspWrong'), 'todo')] };
    const c = g.activeCustomer || (cc && (cc.state === 'atCounter' || cc.state === 'talking') ? cc : null);
    if (c) return this._consultSteps(c);
    if (pc && (pc.state === 'atPOS' || pc.state === 'toPOS')) {
      return { title: t('gd.title.pos'), intro: t('gd.intro.pos'), steps: [
        step(t('gd.goPOS'), 'now', [this._act(t('guide.takeMe'), this._walk('pos'), true, 'cash')]),
        step(t('gd.choosePay'), 'todo')] };
    }
    const ev = g.activeEvent;
    if (ev) {
      const where = ev.type === 'shortage' ? 'pos' : ev.type === 'misplaced' ? 'vitamins' : ev.where;
      const placeName = tp('gd.place.' + (where === 'vitamins' ? 'vitamins' : where));
      const go = ev.type === 'misplaced' ? () => g.interact(ev.shelf) : ev.type === 'shortage' ? () => g.autoWalkTo(W.points.posPharm, 0, () => ui.showPOS('orders')) : this._walk(where);
      const steps = [step(t('gd.goTo', { place: placeName }), 'now', [this._act(t('guide.takeMe'), go, true)])];
      if (ev.type === 'shortage') steps.push(step(t('gd.obj.restock'), 'todo'), step(t('stk.gd'), 'todo'));
      else steps.push(step(t('gd.openEvent'), 'todo', [this._act(t('guide.openNow'), () => g.openEvent())]), step(t('gd.eventTip'), 'todo'));
      return { title: t('gd.title.event'), intro: ev.def?.objective || ev.objective, steps };
    }
    if (g.arrivedOrders().length) {
      return { title: t('stk.recvTitle'), intro: t('stk.gd'), steps: [
        step(t('gd.goTo', { place: tp('gd.place.storage') }), 'now', [this._act(t('guide.takeMe'), this._walk('storage'), true, 'box')]),
        step(t('stk.check1'), 'todo'), step(t('stk.check2'), 'todo'), step(t('stk.check3'), 'todo')], why: t('stk.learn') };
    }
    if (cc && cc.state !== 'leaving') {
      return { title: t('gd.title.wait'), intro: t('gd.intro.wait'), steps: [
        step(t('gd.goCounter'), 'now', [this._act(t('guide.takeMe'), this._walk('counter'), true)]), step(t('gd.waitCust'), 'todo')] };
    }
    if (s.careerMode) return { title: t('gd.title.career'), intro: t('gd.intro.career'), steps: [step(t('gd.careerServe'), 'now', [this._act(t('guide.takeMe'), this._walk('counter'), true)]), step(t('gd.careerInsp'), 'todo', [this._act(t('gd.act.library'), () => ui.showTraining())])] };
    return this._levelSteps();
  }

  _levelSteps() {
    const g = this.g, s = g.state, ui = g.ui, L = g.levelDef();
    let nowSet = false;
    const steps = L.objectives.map((o, i) => {
      const st = s.levelObjectives?.[i] || {};
      const state = st.done ? 'done' : nowSet ? 'todo' : (nowSet = true, 'now');
      const acts = [];
      let text = String(o.label);
      switch (o.type) {
        case 'visit': text = t('gd.obj.visit', { place: tp('gd.place.' + o.target) }); acts.push(this._act(t('guide.takeMe'), this._walk(o.target === 'counter' ? 'counter' : o.target), true)); break;
        case 'inspectShelf': text = t('gd.obj.inspectShelf'); acts.push(this._act(t('guide.takeMe'), () => this._nearestShelf(), true)); break;
        case 'viewDetails': text = t('gd.obj.viewDetails', { n: o.count }); acts.push(this._act(t('gd.act.cabinet'), () => g.openCabinet(), true, 'cabinet')); break;
        case 'search': text = t('gd.obj.search'); acts.push(this._act(t('gd.act.search', { q: tp('gd.searchWord') }), () => g.openCabinet(tp('gd.searchWord')), true, 'search')); break;
        case 'serve': text = t('gd.obj.serve'); acts.push(this._act(t('guide.takeMe'), this._walk('counter'), true)); break;
        case 'event': text = o.label; break;
        case 'restock': text = t('gd.obj.restock'); acts.push(this._act(t('gd.act.pay'), () => g.autoWalkTo(g.world.points.posPharm, 0, () => ui.showPOS('orders')), true, 'cash')); break;
        case 'modules': text = t('gd.obj.modules', { n: o.count }); acts.push(this._act(t('gd.act.library'), () => ui.showTraining(), true, 'book')); break;
        case 'practice': text = t('gd.obj.practice', { n: o.score }); acts.push(this._act(t('gd.act.practice'), () => ui.startPractice(), true, 'book')); break;
        case 'inspection': text = t('gd.obj.inspection'); break;
        default: break;
      }
      const sub = o.count && !st.done ? `${Math.min(st.count || 0, o.count)} / ${o.count}` : null;
      return { text, state, actions: state === 'done' ? [] : acts, sub };
    });
    return { title: t('gd.title.level'), intro: t('gd.intro.level'), steps };
  }
  _nearestShelf() {
    const g = this.g, p = g.player.group.position;
    let best = null, bd = 1e9;
    for (const it of g.world.interactables) { if (it.type !== 'shelf' || it.disabled) continue; const d = p.distanceTo(it.stand); if (d < bd) { bd = d; best = it; } }
    if (best) g.interact(best);
  }

  _consultSteps(c) {
    const g = this.g, ui = g.ui, s = c.scn;
    const step = (text, state, actions) => ({ text, state, actions });
    const steps = [];
    const talking = g.activeCustomer === c;
    if (!talking) steps.push(step(t('gd.goCounter'), 'now', [this._act(t('gd.act.talk'), () => g.startConsultation(c), true, 'chat')]));
    steps.push(step(t('gd.listen', { c: String(c.complaint) }), c.greeted ? 'done' : 'todo'));
    if (s.prescription) steps.push(step(t('gd.readRx'), c.rxViewed ? 'done' : 'todo', talking ? [this._act(t('gd.act.rx'), () => { c.rxViewed = true; ui.showPrescription(c); })] : []));
    const keys = this.keyList(c), miss = this.missingKeys(c), done = !miss.length;
    steps.push(step(done ? t('gd.askKeyDone', { list: this.listQ(keys) }) : t('gd.askKey', { list: this.listQ(miss) }), done ? 'done' : 'todo'));
    const r = this.rec(c);
    steps.push(step(done ? t('gd.decide.' + r.type, { label: r.label }) : t('gd.decide.hidden'), done ? 'done' : 'todo'));
    if (done) {
      if (r.type === 'dispense') {
        const ts = this.trayState(c), q = this.query(c);
        const picked = !!ts.good && !ts.bad;
        steps.push(step(t('gd.find', { q }), picked ? 'done' : 'todo', [this._act(t('gd.act.search', { q }), () => g.openCabinet(q), true, 'search')]));
        steps.push(step(t('gd.read'), picked ? 'done' : 'todo'));
        steps.push(step(t('gd.safety'), 'todo', picked ? [this._act(t('gd.act.safety'), () => g.openSafetyCheck(), true, 'shield')] : []));
        steps.push(step(t('gd.explain'), 'todo'), step(t('gd.payment'), 'todo'));
      } else if (r.type === 'advise') {
        steps.push(step(t('gd.adviseStep'), 'todo', [this._act(t('gd.act.advise'), () => g.beginCounsel({ type: 'advise' }), true, 'chat')]), step(t('gd.explain'), 'todo'));
      } else {
        steps.push(step(t('gd.referStep', { opt: tp(r.type === 'emergency' ? 'ref.emergency' : 'ref.doctor') }), 'todo', [this._act(t('gd.act.refer'), () => ui.showReferral(), true, 'refer')]), step(t('gd.explain'), 'todo'));
      }
    }
    // first not-done step becomes "now"
    if (!steps.some((x) => x.state === 'now')) { const f = steps.find((x) => x.state !== 'done'); if (f) f.state = 'now'; }
    return { title: t('gd.title.consult'), intro: t('gd.intro.consult'), steps, why: t('gd.why.consult') };
  }
}
export { PLACES };
