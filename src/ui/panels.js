// Gameplay panels: consultation dialogue (+ mentor banner), customer profile,
// prescription, smart medicine search (virtualised, drag-to-tray, mentor
// suggestions), medicine information card, shelf view, safety check, referral,
// counselling, outcome, POS, events, inspection.
import { h, icon, fmtMoney } from '../core/util.js';
import { QUESTION_TYPES, SYMPTOM_GUIDE } from '../data/scenarios.js';
import { SECTIONS, STATUS_LABEL, FLAG_INFO } from '../data/products.js';
import { safetyRows, GRADE_STYLE, subjectAge } from '../systems/evaluation.js';
import { K } from './keys.js';
import { suggestFor } from '../systems/suggest.js';
import { t, tp, getLang } from '../i18n/i18n.js';

const FORM_ICON = (p) => {
  const f = p.form;
  if (/Tablet|Capsule|Lozenge|Gum/.test(f)) return 'pill';
  if (/Syrup|Suspension|Solution|Tonic|Shampoo/.test(f)) return 'bottle';
  if (/Drops|Injection/.test(f)) return 'drop';
  if (/Cream|Ointment|Gel|Lotion|Paste|Stick/.test(f)) return 'tube';
  if (/Spray|Inhaler/.test(f)) return 'spray';
  if (/Powder/.test(f)) return 'powder';
  if (/Strip|Pad|Roll|Dressing|Wipe|Pack|Mask/.test(f) && p.section !== 'devices') return 'bandage';
  if (/Diaper/.test(f)) return 'baby';
  return p.section === 'devices' ? 'device' : 'box';
};
const pic = (p, size = 20) => h('div', { class: 'pic', style: { background: SECTIONS[p.section]?.color || '#0fa596' }, html: icon(FORM_ICON(p), size) });
const statusTag = (p) => h('span', { class: 'stat ' + p.status }, t('status.short.' + p.status));
let G = null;
export function bindPanels(g) { G = g; }
const stockTag = (p) => {
  const ord = p.stock < 6 && G?.pendingOrderFor(p.id);
  if (ord) return h('span', { class: 'stock order' }, ord.status === 'arrived' ? tp('stk.st.arrived') : tp('stk.onOrder'));
  return h('span', { class: 'stock' + (p.stock === 0 ? ' out' : p.stock < 6 ? ' low' : '') }, p.stock === 0 ? tp('inv.outOfStock') : tp('inv.stockN', { n: p.stock }));
};
const etaText = (o) => (o.status === 'arrived' ? tp('stk.st.arrived') : tp('stk.eta', { s: Math.max(1, Math.ceil(o.eta - o.t)) }));
const AV_COLORS = ['#0fa596', '#2f80c9', '#d9822b', '#a05bd1', '#e06c9f', '#3aa76d', '#4a5a75'];
const MENTOR = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="7" r="4"/><path d="M5 21v-1a7 7 0 0 1 14 0v1"/><path d="M12 14v4M10 16h4"/></svg>';
const num3 = (n) => String(n).padStart(3, '0');

export const panelMethods = {
  // ───────────────────────── Consultation dialogue ─────────────────────────
  openDialogue(c) {
    const g = this.g;
    this.closeDialogue(true);
    const initials = c.name.split(' ').map((x) => x[0]).join('').slice(0, 2);
    const forWhom = c.scn.child ? ' · ' + (c.scn.child.age < 1 ? t('dlg.forBaby', { m: c.scn.child.months }) : t('dlg.forChild', { name: c.childName, age: c.scn.child.age })) : '';
    const head = h('div', { class: 'dlg-head' },
      h('div', { class: 'avatar', style: { background: AV_COLORS[c.num % AV_COLORS.length] } }, initials),
      h('div', { class: 'who' }, h('div', { class: 'num' }, t('dlg.customerN', { n: num3(c.num) })), h('div', { class: 'nm' }, c.name), h('div', { class: 'meta' }, t('dlg.meta', { age: c.age, gender: t(c.gender === 'M' ? 'common.male' : 'common.female') }) + forWhom)),
      h('span', { class: 'diff' }, t('diff.' + c.scn.difficulty)),
      h('button', { class: 'xbtn', 'aria-label': t('dlg.stepAway'), onclick: () => g.pauseConsultation(), html: icon('close', 20) }));
    this.dlgLog = h('div', { class: 'log' });
    this.dlgMentor = h('div', { class: 'mentor-bar hidden' });
    this.dlgSug = h('div', { class: 'sug-bar hidden' });
    this.dlgQ = h('div', { class: 'qgrid' });
    this.dlgTray = h('div', { class: 'tray', dataset: { drop: 'tray' } });
    const act = (ic, label, fn, cls = 'ghost', keys = null) => h('button', { class: 'btn ' + cls, ...(keys ? K(...keys) : {}), onclick: () => { g.audio.sfx('tap'); fn(); } }, h('span', { class: 'icw', html: icon(ic, 18) }), label);
    this.dlgActs = h('div', { class: 'dlg-actions' },
      act('user', t('dlg.profile'), () => this.showProfile(c), 'ghost', ['p']),
      act('cabinet', t('dlg.cabinet'), () => g.openCabinet(), 'soft', ['i']),
      act('refer', t('dlg.refer'), () => this.showReferral(), 'ghost', ['f']),
      c.scn.prescription ? act('rx', t('dlg.prescription'), () => { c.rxViewed = true; this.showPrescription(c); }, 'ghost', ['x']) : act('chat', t('dlg.advise'), () => g.beginCounsel({ type: 'advise' }), 'ghost', ['x']),
      act('shield', t('dlg.safety'), () => g.openSafetyCheck(), 'primary', ['Enter', '↵']));
    this.dlgActs.lastChild.style.gridColumn = 'span 2';
    const sheet = h('div', { class: 'sheet pe' }, head, this.dlgLog, this.dlgMentor, this.dlgQ, this.dlgSug, h('div', { style: { padding: '0 0 6px' } }, this.dlgTray), this.dlgActs);
    this.layer.prepend(sheet);
    this.dlgSheet = sheet; this.dlgCust = c;
    this.hud.classList.add('dlg'); this.root.classList.add('dlg-open'); this._logFor = null;
    this.refreshDialogue();
  },
  refreshDialogue() {
    const c = this.dlgCust; if (!c || !this.dlgSheet) return;
    const g = this.g;
    if (this._logFor !== c || this.dlgLog.childElementCount > c.log.length) { this.dlgLog.innerHTML = ''; this._logFor = c; }
    for (const e of c.log.slice(this.dlgLog.childElementCount)) {
      if (e.who === 'me') this.dlgLog.append(h('div', { class: 'bub me' }, e.text));
      else if (e.who === 'sys') this.dlgLog.append(h('div', { class: 'bub sys' }, e.text));
      else this.dlgLog.append(h('div', { class: 'bub cust', dataset: { who: c.name.split(' ')[0] } }, e.text));
    }
    this.dlgLog.scrollTop = this.dlgLog.scrollHeight;
    const guided = g.settings.guided;
    this.dlgQ.innerHTML = '';
    for (const q of QUESTION_TYPES) {
      const done = c.asked.has(q.key);
      const key = guided && g.guide.isKey(c, q.key) && !done;
      const disabled = done || !!g.isDialogueSpeaking;
      this.dlgQ.append(h('button', {
        class: 'qbtn' + (done ? ' done' : '') + (key ? ' key' : '') + (g.isDialogueSpeaking ? ' speaking-disabled' : ''),
        disabled,
        ...K(String(QUESTION_TYPES.indexOf(q) + 1)),
        onclick: () => { if (!done && !g.isDialogueSpeaking) g.ask(q.key); }
      },
        h('span', { class: 'icw', html: icon(done ? 'check' : q.icon, 17) }),
        h('span', { class: 'ql' }, t('q.' + q.key + '.label')),
        key ? h('span', { class: 'star', 'aria-label': t('guide.keyQ') }, '★') : null
      ));
    }
    // mentor banner
    if (guided) {
      const nx = g.guide.next(c);
      this.dlgMentor.innerHTML = '';
      this.dlgMentor.classList.toggle('hidden', !nx);
      if (nx) this.dlgMentor.append(...[h('span', { class: 'micon', html: MENTOR }), h('div', { class: 'mtext' }, nx.text),
        nx.action ? h('button', { class: 'btn primary', ...K('m'), onclick: () => { g.audio.sfx('tap'); nx.action.fn(); } }, nx.action.label) : null,
        h('button', { class: 'btn soft mmore', onclick: () => this.showGuide() }, t('guide.more'))].filter(Boolean));
    } else this.dlgMentor.classList.add('hidden');
    this.renderSuggest(c);
    this.renderTray(this.dlgTray);
  },
  // ── stock suggestions: "fever" → the brands we keep for fever (by symptom only)
  renderSuggest(c) {
    const el = this.dlgSug;
    const sug = suggestFor(this.g.catalog, c);
    const list = sug.flatMap((s) => s.cats.flatMap((x) => x.products));
    const uniq = [...new Map(list.map((p) => [p.id, p])).values()].slice(0, 6);
    const emergency = sug.find((s) => s.emergency);
    el.innerHTML = '';
    el.classList.toggle('hidden', !sug.length);
    el.classList.toggle('bad', !!emergency);
    if (!sug.length) return;
    const refresh = () => this.refreshDialogue();
    el.append(
      h('button', { class: 'sug-head', onclick: () => this.showSuggest(c, sug) },
        h('span', { class: 'icw', html: icon(emergency ? 'alert' : 'pill', 16) }),
        h('b', {}, emergency ? t('sug.emergency') : t('sug.title')), h('span', { class: 'sug-for' }, sug.map((s) => s.entry.title).join(' · ')),
        h('span', { class: 'sug-more' }, t('sug.more'), h('span', { class: 'icw', html: icon('info', 14) }))),
      uniq.length ? h('div', { class: 'sug-chips' }, uniq.map((p) => h('button', { class: 'sug-chip', onclick: () => { this.g.audio.sfx('package'); this.showMedicine(p, { refresh }); } },
        h('b', {}, p.brand), h('small', {}, [p.strength, p.formL].filter(Boolean).join(' ')), p.status === 'Rx' ? h('span', { class: 'stat Rx' }, 'Rx') : null))) : null,
      h('div', { class: 'sug-ref' }, (emergency || sug[0]).entry.refer));
  },
  showSuggest(c, sug) {
    const refresh = () => this.refreshDialogue();
    let m;
    const row = (p) => h('button', { class: 'mitem', onclick: () => { m.close(); this.showMedicine(p, { refresh }); } }, pic(p),
      h('div', { style: { flex: 1, minWidth: 0 } }, p.name, h('small', {}, `${p.generic} · ${p.manufacturer} · ${SECTIONS[p.section]?.name || ''}`)),
      h('span', { class: 'right' }, fmtMoney(p.price), h('br'), stockTag(p)));
    const body = h('div', {},
      h('p', { class: 'edu-note' }, h('span', { class: 'icw', html: icon('shield', 14) }), t('sug.check')),
      ...sug.map((s) => h('div', { class: 'sug-sec' + (s.emergency ? ' bad' : '') },
        h('h4', {}, s.entry.title),
        ...s.cats.map((x) => h('div', { class: 'sug-cat' }, h('b', {}, x.cat.name), h('div', { class: 'why' }, x.cat.why), h('div', { class: 'menu-list' }, x.products.map(row)))),
        h('div', { class: 'gr' }, h('b', {}, t('sug.refer') + ': '), s.entry.refer))));
    m = this.modal({ title: t('sug.modal'), eyebrow: c.name, body });
  },
  renderTray(el) {
    const g = this.g;
    el.innerHTML = '';
    if (!g.tray.length) el.append(h('div', { class: 'ph' }, h('span', { class: 'icw', html: icon('tray', 18) }), t('tray.empty')));
    for (const p of g.tray) el.append(h('div', { class: 'titem' }, h('span', {}, p.name), h('button', { 'aria-label': t('common.remove'), onclick: () => g.removeFromTray(p.id), html: icon('close', 14) })));
  },
  closeDialogue(silent) {
    this.g?.audio?.stopSpeech?.();
    if (this.g) {
      this.g.isDialogueSpeaking = false;
      this.g.player?.say(false);
      if (this.dlgCust?.char) this.dlgCust.char.say(false);
    }
    if (this.dlgCust) {
      clearTimeout(this.dlgCust._sayT);
      this.dlgCust._sayT = null;
      if (this.dlgCust.char) { this.dlgCust.char.talking = false; this.dlgCust.char.say(false); }
    }
    if (this.dlgSheet) { this.dlgSheet.remove(); this.dlgSheet = null; this.dlgCust = null; }
    this.hud.classList.remove('dlg'); this.root.classList.remove('dlg-open');
    if (!silent) this.g.onModalChange?.();
  },

  // ───────────────────────── Profile & prescription ─────────────────────────
  showProfile(c) {
    const s = c.scn;
    const pf = (label, key, full) => {
      const known = !key || c.asked.has(key);
      const txt = !key ? null : s.answers[key];
      const flagged = known && key && (s.facts || []).some((f) => ({ allergies: 'allergy', meds: 'med', history: 'cond', lifestyle: 'life' })[key] === f.split(':')[0]);
      return h('div', { class: 'pf' + (full ? ' full' : '') + (known ? '' : ' unknown') + (flagged ? ' flag' : '') }, h('label', {}, label), h('div', {}, known ? txt : t('prof.notAsked')));
    };
    const age = subjectAge(s);
    const body = h('div', {},
      h('div', { class: 'prof-grid' },
        h('div', { class: 'pf' }, h('label', {}, t('prof.name')), h('div', {}, c.name)),
        h('div', { class: 'pf' }, h('label', {}, t('prof.ageGender')), h('div', {}, `${c.age} · ${t(c.gender === 'M' ? 'common.male' : 'common.female')}`)),
        s.child ? h('div', { class: 'pf full flag' }, h('label', {}, t('prof.for')), h('div', {}, t('prof.forText', { name: c.childName, age: age < 1 ? t('prof.months', { n: s.child.months }) : t('prof.years', { n: s.child.age }), kind: t(s.child.gender === 'M' ? 'prof.boy' : 'prof.girl') }))) : null,
        h('div', { class: 'pf full' }, h('label', {}, t('prof.complaint')), h('div', {}, `“${c.complaint}”`)),
        pf(t('q.duration.label'), 'duration'), pf(t('q.symptoms.label'), 'symptoms'),
        pf(t('q.allergies.label'), 'allergies'), pf(t('q.meds.label'), 'meds'),
        pf(t('q.history.label'), 'history'), pf(t('q.lifestyle.label'), 'lifestyle'),
        h('div', { class: 'pf' }, h('label', {}, t('prof.budget')), h('div', {}, fmtMoney(s.budget))),
        h('div', { class: 'pf' }, h('label', {}, t('prof.rx')), h('div', {}, s.prescription ? t('prof.rxYes') : t('prof.rxNo')))),
      s.prescription ? this._rxCard(c) : null,
      h('p', { class: 'edu-note' }, h('span', { class: 'icw', html: icon('info', 14) }), t('prof.note')));
    this.modal({ title: t('prof.title'), eyebrow: t('dlg.customerN', { n: num3(c.num) }), body });
  },
  _rxCard(c) {
    const rx = c.scn.prescription;
    const d = new Date(this.g.gameDate()); d.setDate(d.getDate() - rx.daysAgo);
    const date = d.toLocaleDateString(getLang() === 'ta' ? 'ta-IN' : 'en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    return h('div', { class: 'rx-card' }, h('div', { class: 'rxl' }, '℞'),
      h('div', { class: 'rx-eyebrow' }, t('rx.title')),
      h('div', { style: { fontWeight: 800, marginTop: '6px' } }, rx.doctor),
      h('div', { style: { fontSize: '.84em', color: 'var(--ink-2)', margin: '2px 0 8px' } }, t('rx.patientDate', { name: c.name, date })),
      h('div', { style: { fontWeight: 800, fontSize: '1.05em' } }, rx.drug),
      h('div', { style: { fontSize: '.88em' } }, rx.directions),
      rx.issue ? null : null,
      h('div', { style: { fontSize: '.78em', color: 'var(--ink-3)', marginTop: '8px' } }, t('rx.signature'), ' ', h('i', {}, t('rx.signed'))));
  },
  showPrescription(c) {
    const body = h('div', {}, this._rxCard(c), h('p', { class: 'edu-note' }, h('span', { class: 'icw', html: icon('info', 14) }), t('rx.note')));
    this.modal({ title: t('dlg.prescription'), body });
  },

  // ───────────────────────── Smart medicine search ─────────────────────────
  openInventory({ section = null, title = null, shelf = null, query = '' } = {}) {
    const g = this.g;
    const st = { q: query, mode: 'all', section, status: 'all', inStock: false };
    const all = g.catalog;
    const cust = g.activeCustomer;
    const guided = g.settings.guided && cust;
    const suggested = guided ? g.guide.suggested(cust) : new Set();
    const input = h('input', { type: 'search', placeholder: t('inv.placeholder'), enterkeyhint: 'search', autocomplete: 'off', 'aria-label': t('inv.searchLabel') });
    input.value = query;
    const modes = ['all', 'name', 'generic', 'symptom', 'category', 'form', 'manufacturer'];
    const modeChips = h('div', { class: 'chips mode-chips' });
    const secChips = h('div', { class: 'chips' });
    const meta = h('div', { class: 'inv-meta' });
    const guideBox = h('div', {});
    const list = h('div', { class: 'vlist' });
    const spacer = h('div', { style: { position: 'relative' } });
    list.append(spacer);
    const ROW = 74;
    let results = [];
    const drawChips = () => {
      modeChips.innerHTML = '';
      modes.forEach((k) => modeChips.append(h('button', { class: 'fchip' + (st.mode === k ? ' on' : ''), onclick: () => { st.mode = k; drawChips(); run(); } }, t('inv.mode.' + k))));
      secChips.innerHTML = '';
      if (guided && suggested.size) secChips.append(h('button', { class: 'fchip mentor' + (st.sugOnly ? ' on' : ''), onclick: () => { st.sugOnly = !st.sugOnly; drawChips(); run(); } }, '★ ' + t('inv.suggestedOnly')));
      [['all', t('inv.allSections')], ...Object.keys(SECTIONS).map((k) => [k, t('sec.chip.' + k)])].forEach(([k, l]) => {
        const locked = k !== 'all' && !g.sectionUnlocked(k);
        secChips.append(h('button', { class: 'fchip' + ((st.section || 'all') === k ? ' on' : ''), style: locked ? { opacity: 0.5 } : null, onclick: () => { st.section = k === 'all' ? null : k; drawChips(); run(); } }, (locked ? '🔒 ' : '') + l));
      });
      [['all', t('inv.anyStatus')], ['OTC', 'OTC'], ['P', t('status.short.P')], ['Rx', 'Rx']].forEach(([k, l]) => secChips.append(h('button', { class: 'fchip' + (st.status === k ? ' on' : ''), onclick: () => { st.status = k; drawChips(); run(); } }, l)));
      secChips.append(h('button', { class: 'fchip' + (st.inStock ? ' on' : ''), onclick: () => { st.inStock = !st.inStock; drawChips(); run(); } }, t('inv.inStock')));
    };
    const run = () => {
      const q = st.q.trim().toLowerCase();
      const toks = q.split(/\s+/).filter(Boolean);
      const field = (p) => {
        switch (st.mode) {
          case 'name': return (p.name + ' ' + p.brand + ' ' + (p._nameEN || '')).toLowerCase();
          case 'generic': return (p.generic + ' ' + (p._genEN || '')).toLowerCase();
          case 'symptom': return p._symIdx;
          case 'category': return (p.categoryL + ' ' + p.category + ' ' + p.cls + ' ' + (p._clsEN || '')).toLowerCase();
          case 'form': return (p.form + ' ' + p.formL).toLowerCase();
          case 'manufacturer': return p.manufacturer.toLowerCase();
          default: return p._idx;
        }
      };
      results = all.filter((p) => {
        if (st.sugOnly && !suggested.has(p.id)) return false;
        if (st.section && p.section !== st.section) return false;
        if (st.status !== 'all' && p.status !== st.status) return false;
        if (st.inStock && p.stock === 0) return false;
        if (!toks.length) return true;
        const f = field(p);
        return toks.every((tk) => f.includes(tk));
      });
      if (toks.length || suggested.size) {
        results.sort((a, b) => {
          const sa = suggested.has(a.id) ? 0 : 1, sb = suggested.has(b.id) ? 0 : 1;
          if (sa !== sb) return sa - sb;
          if (!toks.length) return 0;
          const an = a.name.toLowerCase().startsWith(q) || a.generic.toLowerCase().startsWith(q) ? 0 : 1;
          const bn = b.name.toLowerCase().startsWith(q) || b.generic.toLowerCase().startsWith(q) ? 0 : 1;
          return an - bn || (b.stock > 0) - (a.stock > 0) || a.price - b.price;
        });
      }
      meta.innerHTML = '';
      meta.append(h('span', {}, t('inv.count', { n: results.length.toLocaleString(), total: all.length.toLocaleString() })), h('span', {}, st.mode === 'all' ? t('inv.allFields') : t('inv.byField', { f: t('inv.mode.' + st.mode) })));
      guideBox.innerHTML = '';
      if (guided && !q && !st.sugOnly) {
        const gs = g.guide.medicineHint(cust);
        if (gs) guideBox.append(h('div', { class: 'mentor-card' }, h('span', { class: 'micon', html: MENTOR }), h('div', {}, h('b', {}, t('guide.mentor')), h('div', {}, gs.text)),
          gs.query ? h('button', { class: 'btn primary', onclick: () => { input.value = gs.query; st.q = gs.query; run(); } }, t('guide.showMe')) : null));
      }
      if (q.length >= 3) {
        const gEntry = SYMPTOM_GUIDE.find((e) => e.k.some((k) => k.includes(q) || q.includes(k)));
        if (gEntry) {
          if (st.mode === 'symptom' || st.mode === 'all') g.onSymptomSearch?.();
          const card = h('div', { class: 'edu-guide-card' }, h('h4', { html: icon('info', 16) + ' ' + t('inv.eduGuide') + ': ' }, gEntry.title));
          gEntry.cats.forEach((cat) => card.append(h('div', { class: 'gc' }, h('b', {}, t('inv.relevant') + ': ' + cat.name), h('span', {}, t('inv.why') + ': ' + cat.why), cat.q ? h('div', {}, h('button', { class: 'fchip', style: { marginTop: '6px' }, onclick: () => { input.value = cat.q; st.q = cat.q; st.mode = 'all'; drawChips(); run(); } }, t('inv.showProducts'))) : null)));
          card.append(h('div', { class: 'gr' }, t('inv.whenRefer') + ': ' + gEntry.refer));
          card.append(h('div', { class: 'disc' }, t('inv.disclaimer')));
          guideBox.append(card);
        }
      }
      spacer.style.height = results.length * ROW + 'px';
      list.scrollTop = 0;
      render();
    };
    const render = () => {
      const top = list.scrollTop, hgt = list.clientHeight || 500;
      const start = Math.max(0, Math.floor(top / ROW) - 3), end = Math.min(results.length, start + Math.ceil(hgt / ROW) + 7);
      spacer.innerHTML = '';
      for (let i = start; i < end; i++) {
        const p = results[i];
        const handle = pic(p);
        handle.style.touchAction = 'none';
        handle.title = t('inv.dragTip');
        const sug = suggested.has(p.id);
        const row = h('div', { class: 'vrow', style: { top: i * ROW + 'px' } },
          h('div', { class: 'prow' + (p.stock === 0 ? ' oos' : '') + (sug ? ' sug' : ''), onclick: () => { g.audio.sfx('package'); this.showMedicine(p, { refresh: () => { render(); this.renderTray(trayEl); } }); } },
            handle,
            h('div', { class: 'pinfo' }, h('div', { class: 'pn' }, sug ? h('span', { class: 'sugtag' }, '★ ' + t('inv.suggested')) : null, p.name), h('div', { class: 'pg' }, `${p.generic} · ${p.formL} · ${p.cls}`)),
            h('div', { class: 'pright' }, h('span', { class: 'price' }, fmtMoney(p.price)), h('div', { style: { display: 'flex', gap: '4px', alignItems: 'center' } }, statusTag(p), stockTag(p)))));
        this._dragSource(handle, p, () => trayEl, () => { render(); this.renderTray(trayEl); });
        spacer.append(row);
      }
    };
    let rafPending = false;
    list.addEventListener('scroll', () => { if (rafPending) return; rafPending = true; requestAnimationFrame(() => { rafPending = false; render(); }); }, { passive: true });
    let deb;
    input.addEventListener('input', () => { clearTimeout(deb); deb = setTimeout(() => { st.q = input.value; run(); }, 140); });
    const trayEl = h('div', { class: 'tray', dataset: { drop: 'tray' } });
    const trayBar = h('div', { class: 'inv-tray' }, h('div', { class: 'row' }, trayEl,
      cust ? h('button', { class: 'btn primary', onclick: () => { m.close(); g.openSafetyCheck(); } }, h('span', { class: 'icw', html: icon('shield', 18) }), t('dlg.safety')) : null));
    const head = h('div', { class: 'm-head' }, h('div', { style: { flex: 1, minWidth: 0 } }, h('span', { class: 'eyebrow' }, cust ? t('inv.forCust', { name: cust.name }) : t('inv.browser')), h('h2', {}, title || t('dlg.cabinet'))),
      h('button', { class: 'xbtn', 'aria-label': t('common.close'), onclick: () => m.close(), html: icon('close', 20) }));
    const panel = h('div', { class: 'modal full' }, head,
      h('div', { class: 'inv' },
        h('div', { class: 'inv-top' }, h('div', { class: 'searchbox' }, h('span', { class: 'icw', html: icon('search', 20) }), input), modeChips, secChips, meta),
        guideBox, list, trayBar));
    const m = this.modal({ raw: true, body: panel, cls: 'full', onClose: () => { g.onInventoryClosed?.(shelf); this.refreshDialogue(); } });
    drawChips(); this.renderTray(trayEl);
    run();
    this._invRefresh = () => { render(); this.renderTray(trayEl); };
    return m;
  },
  _dragSource(handle, p, getTray, after) {
    const g = this.g;
    handle.addEventListener('pointerdown', (e) => {
      e.stopPropagation(); e.preventDefault();
      const ghost = h('div', { class: 'drag-ghost' }, p.brand);
      document.body.appendChild(ghost);
      const mv = (ev) => {
        ghost.style.left = ev.clientX + 'px'; ghost.style.top = ev.clientY + 'px';
        const tr = getTray(); const r = tr.getBoundingClientRect();
        tr.classList.toggle('over', ev.clientX > r.left && ev.clientX < r.right && ev.clientY > r.top - 20 && ev.clientY < r.bottom + 20);
      };
      const up = (ev) => {
        window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
        ghost.remove();
        const tr = getTray(); const over = tr.classList.contains('over'); tr.classList.remove('over');
        if (over) {
          if (!g.viewed.has(p.id)) { this.toast(t('inv.reviewFirst'), 'warn', 'info'); this.showMedicine(p, { refresh: after, mustConfirm: true }); }
          else { g.addToTray(p); after(); }
        } else if (Math.hypot(ev.clientX - e.clientX, ev.clientY - e.clientY) < 8) this.showMedicine(p, { refresh: after });
      };
      mv(e);
      window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
    });
  },

  // ───────────────────────── Medicine information card ─────────────────────────
  showMedicine(p, { refresh, mustConfirm } = {}) {
    const g = this.g;
    g.markViewed(p);
    let expanded = false;
    const details = h('div', {});
    const kv = (label, content, cls = '') => h('div', { class: 'r ' + cls }, h('label', {}, label), h('div', {}, content));
    const cust = g.activeCustomer;
    let mentor = null;
    if (g.settings.guided && cust) {
      const v = g.guide.verdict(p, cust);
      if (v) mentor = h('div', { class: 'mentor-card ' + v.tone }, h('span', { class: 'micon', html: MENTOR }), h('div', {}, h('b', {}, t('guide.mentor')), h('div', {}, v.text)));
    }
    const summary = h('div', { class: 'kv' },
      kv(t('med.category'), `${p.cls} · ${p.categoryL}`),
      kv(t('med.use'), p.use),
      kv(t('med.important'), h('div', {}, t('med.importantText'), p.warnings[0] ? h('div', { style: { marginTop: '4px' } }, p.warnings[0]) : null), 'imp'),
      kv(t('med.status'), h('span', {}, statusTag(p), ' ', STATUS_LABEL[p.status])));
    const drawDetails = () => {
      details.innerHTML = '';
      if (!expanded) return;
      details.append(h('div', { class: 'kv' },
        kv(t('med.generic'), `${p.generic}${p.form !== 'Device' ? ' — ' + p.strength : ''}`),
        h('div', { class: 'two' }, kv(t('med.form'), p.formL), kv(t('med.pack'), p.pack)),
        kv(t('med.warnings'), h('ul', {}, p.warnings.map((w) => h('li', {}, w))), 'imp'),
        kv(t('med.flags'), p.flags.length ? h('div', { class: 'flags' }, p.flags.map((f) => h('span', { class: 'flag' }, FLAG_INFO[f] || f))) : t('med.noFlags')),
        kv(t('med.storage'), p.storage),
        h('div', { class: 'two' }, kv(t('med.stock'), p.stock === 0 ? t('inv.outOfStock') : t('med.units', { n: p.stock })), kv(t('med.price'), fmtMoney(p.price))),
        h('div', { class: 'two' }, kv(t('med.batch'), `${p.batch} · ${p.expiry}${p.expired ? ' (' + t('med.expired') + ')' : ''}`, p.expired ? 'imp' : ''), kv(t('med.manufacturer'), p.manufacturer)),
        kv(t('med.description'), p.description),
        kv(t('med.location'), `${p.sku} · ${SECTIONS[p.section].name}`)));
    };
    const body = h('div', { class: 'minfo' },
      mentor,
      h('div', { class: 'hero' }, pic(p, 30), h('div', { style: { minWidth: 0 } }, h('h3', {}, p.name), h('div', { class: 'sub' }, `${p.generic} · ${p.pack}`), h('div', { style: { display: 'flex', gap: '6px', marginTop: '6px', alignItems: 'center', flexWrap: 'wrap' } }, statusTag(p), stockTag(p), p.isGeneric ? h('span', { class: 'stat OTC' }, t('med.genericTag')) : null))),
      this._stockBox(p, () => { m.close(); this.showMedicine(p, { refresh }); refresh?.(); }),
      summary, details,
      h('p', { class: 'edu-note' }, h('span', { class: 'icw', html: icon('info', 14) }), t('med.note')));
    const viewBtn = h('button', { class: 'btn ghost grow', ...K('d'), onclick: () => { expanded = !expanded; viewBtn.lastChild.textContent = expanded ? t('med.hide') : t('med.view'); drawDetails(); if (expanded) g.onViewDetails(p); } }, h('span', { class: 'icw', html: icon('eye', 18) }), h('span', {}, t('med.view')));
    const canAdd = !!cust;
    const addBtn = h('button', { class: 'btn primary grow', ...K('Enter', '↵'), disabled: !canAdd || p.stock === 0, onclick: () => { if (g.addToTray(p)) { m.close(); refresh?.(); } } }, h('span', { class: 'icw', html: icon('tray', 18) }), canAdd ? (p.stock === 0 ? t('med.oos') : t('med.add')) : t('med.noCustomer'));
    const alt = p.stock === 0 ? h('button', { class: 'btn soft block', ...K('a'), onclick: () => { m.close(); this.showAlternatives(p, refresh); } }, h('span', { class: 'icw', html: icon('search', 18) }), t('med.findAlt')) : null;
    const foot = [h('button', { class: 'btn ghost', ...K('Escape Backspace', 'Esc'), onclick: () => m.close() }, h('span', { class: 'icw', html: icon('back', 18) }), t('med.back')), viewBtn, addBtn];
    if (alt) foot.unshift(alt);
    const m = this.modal({ title: t('med.title'), eyebrow: mustConfirm ? t('med.reviewBefore') : SECTIONS[p.section].name, body, foot });
    return m;
  },
  showAlternatives(p, refresh) {
    const g = this.g;
    const alts = g.catalog.filter((x) => x.baseKey === p.baseKey && x.strengthRaw === p.strengthRaw && x.form === p.form && x.id !== p.id && x.stock > 0 && !x.expired).sort((a, b) => a.price - b.price).slice(0, 12);
    const body = h('div', {}, h('div', { class: 'ev-hero info' }, h('span', { class: 'icw', html: icon('info', 22) }), t('alt.text', { gen: p.generic.replace(/\s*\(.*?\)/, ''), str: p.strength, form: p.formL })),
      alts.length ? h('div', { class: 'menu-list' }, alts.map((a) => h('button', { class: 'mitem', onclick: () => { m.close(); this.showMedicine(a, { refresh }); } }, pic(a), h('div', { style: { flex: 1, minWidth: 0 } }, a.name, h('small', {}, `${a.manufacturer} · ${t('inv.stockN', { n: a.stock })}`)), h('span', { class: 'right' }, fmtMoney(a.price))))) : h('p', {}, t('alt.none')));
    const m = this.modal({ title: t('alt.title'), body });
  },

  // ───────────────────────── Shelf view (tap shelves) ─────────────────────────
  showShelf(it, onClose) {
    const g = this.g;
    const prods = g.catalog.filter((p) => p.section === it.section);
    const grid = h('div', { class: 'cardgrid' });
    const cust = g.activeCustomer;
    const suggested = g.settings.guided && cust ? g.guide.suggested(cust) : new Set();
    const trayEl = h('div', { class: 'tray', dataset: { drop: 'tray' } });
    const refresh = () => { draw(input.value); this.renderTray(trayEl); this.refreshDialogue(); };
    const draw = (q = '') => {
      grid.innerHTML = '';
      const ql = q.toLowerCase();
      const list = prods.filter((p) => !ql || p._idx.includes(ql));
      list.sort((a, b) => (suggested.has(a.id) ? 0 : 1) - (suggested.has(b.id) ? 0 : 1));
      list.slice(0, 120).forEach((p) => {
        const handle = pic(p, 18);
        handle.style.touchAction = 'none';
        handle.title = cust ? t('inv.dragTip') : '';
        const sug = suggested.has(p.id);
        const card = h('div', { class: 'pcard' + (sug ? ' sug' : ''), role: 'button', tabindex: '0', onclick: (e) => { if (e.target.closest('.pic')) return; g.audio.sfx('package'); g.player.setAction('inspect', 1.6); this.showMedicine(p, { refresh }); } },
          h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' } }, handle, statusTag(p), sug ? h('span', { class: 'sugtag' }, '★') : null),
          h('div', { class: 'pn' }, p.name), h('div', { class: 'pg' }, p.generic),
          h('div', { class: 'bot' }, h('span', { class: 'price' }, fmtMoney(p.price)), stockTag(p)));
        if (cust) this._dragSource(handle, p, () => trayEl, refresh);
        else handle.addEventListener('click', () => this.showMedicine(p, { refresh }));
        grid.append(card);
      });
    };
    const input = h('input', { type: 'search', placeholder: t('shelf.search', { name: SECTIONS[it.section].name }), 'aria-label': t('shelf.searchLabel') });
    input.addEventListener('input', () => draw(input.value));
    const locked = !g.sectionUnlocked(it.section);
    const body = h('div', {},
      locked ? h('div', { class: 'ev-hero info' }, h('span', { class: 'icw', html: icon('lock', 20) }), t('shelf.locked')) : null,
      suggested.size && prods.some((p) => suggested.has(p.id)) ? h('div', { class: 'mentor-card good' }, h('span', { class: 'micon', html: MENTOR }), h('div', {}, h('b', {}, t('guide.mentor')), h('div', {}, t('shelf.mentorHere')))) : null,
      h('div', { class: 'searchbox', style: { marginBottom: '10px' } }, h('span', { class: 'icw', html: icon('search', 20) }), input),
      h('div', { class: 'inv-meta', style: { marginBottom: '8px' } }, h('span', {}, t('shelf.count', { n: prods.length })), h('span', {}, cust ? t('shelf.dragHint') : t('shelf.tapHint'))),
      grid);
    draw();
    this.renderTray(trayEl);
    this._invRefresh = () => this.renderTray(trayEl);
    const foot = cust ? [h('div', { class: 'row', style: { display: 'flex', gap: '8px', width: '100%', alignItems: 'center' } }, h('div', { style: { flex: 1, minWidth: 0 } }, trayEl),
      h('button', { class: 'btn primary', onclick: () => { m.close(); g.openSafetyCheck(); } }, h('span', { class: 'icw', html: icon('shield', 18) }), t('dlg.safety')))] : null;
    const m = this.modal({ title: SECTIONS[it.section].name, eyebrow: cust ? t('shelf.picking', { name: cust.name }) : t('shelf.eyebrow'), body, foot, cls: 'wide', onClose });
    return m;
  },

  // ───────────────────────── Safety check ─────────────────────────
  showSafety(c, { onDispense, onChange, onRefer, onProfile }) {
    const g = this.g;
    const { rows, headline, level } = safetyRows(g.tray, c.scn, c.asked);
    const ic = { ok: 'check', bad: 'x', warn: 'alert', unknown: 'info' };
    let mentor = null;
    if (g.settings.guided) {
      const v = g.guide.safetyTip(c);
      if (v) mentor = h('div', { class: 'mentor-card ' + v.tone }, h('span', { class: 'micon', html: MENTOR }), h('div', {}, h('b', {}, t('guide.mentor')), h('div', {}, v.text)));
    }
    const body = h('div', {},
      mentor,
      h('div', { class: 'two', style: { marginBottom: '10px' } }, h('div', { class: 'pf' }, h('label', {}, t('sc.customer')), h('div', {}, c.name)), h('div', { class: 'pf' }, h('label', {}, t('sc.for')), h('div', {}, c.scn.child ? `${c.childName} (${c.scn.child.age < 1 ? t('prof.months', { n: c.scn.child.months }) : t('prof.years', { n: c.scn.child.age })})` : t('sc.self', { age: c.age })))),
      h('div', { class: 'sel-prods' }, h('label', { class: 'sec-label' }, t('sc.selected')), g.tray.length ? g.tray.map((p) => h('div', { class: 'sp' }, pic(p, 16), h('span', { style: { flex: 1, minWidth: 0 } }, p.name), statusTag(p))) : h('div', { class: 'sp' }, t('sc.none'))),
      h('div', { class: 'sc-head ' + level }, h('span', { class: 'icw', html: icon(ic[level], 24) }), h('div', {}, h('b', {}, level === 'ok' ? t('sc.noIssue') : t('sc.issue')), h('div', {}, headline))),
      h('div', {}, rows.map((r) => h('div', { class: 'sc-row' }, h('span', { class: 'sc-ic ' + r.state, html: icon(ic[r.state], 16) }), h('div', {}, h('b', {}, r.label), h('span', {}, r.text))))),
      h('div', { class: 'sc-q' }, g.tray.length ? t('sc.question') : t('sc.selectFirst')));
    const btn = (cls, ic2, label, fn, dis, keys) => h('button', { class: 'btn ' + cls, ...(keys ? K(...keys) : {}), disabled: !!dis, onclick: () => { m.close(); fn(); } }, h('span', { class: 'icw', html: icon(ic2, 18) }), label);
    const m = this.modal({ title: t('sc.title'), eyebrow: t('sc.eyebrow'), body,
      foot: [
        h('div', { class: 'two', style: { width: '100%' } }, btn('ghost', 'user', t('sc.profile'), onProfile, false, ['p']), btn('ghost', 'cabinet', t('sc.change'), onChange, false, ['c'])),
        h('div', { class: 'two', style: { width: '100%' } }, btn('warn', 'refer', t('sc.refer'), onRefer, false, ['f']), btn('primary', 'check', t('sc.dispense'), onDispense, !g.tray.length, ['Enter', '↵'])),
      ] });
    if (level === 'bad') g.haptic('warning');
  },

  showReferral() {
    const g = this.g;
    const tip = g.settings.guided && g.activeCustomer ? g.guide.referTip(g.activeCustomer) : null;
    const body = h('div', {},
      tip ? h('div', { class: 'mentor-card ' + tip.tone }, h('span', { class: 'micon', html: MENTOR }), h('div', {}, h('b', {}, t('guide.mentor')), h('div', {}, tip.text))) : null,
      h('p', { class: 'prose' }, t('ref.intro')),
      h('button', { class: 'opt' + (tip?.pick === 'doctor' ? ' hint' : ''), ...K('1'), onclick: () => { m.close(); g.beginCounsel({ type: 'refer', urgency: 'doctor' }); } }, h('span', { class: 'k', html: icon('user', 16) }), h('span', {}, h('b', {}, t('ref.doctor')), h('br'), t('ref.doctorSub'))),
      h('button', { class: 'opt' + (tip?.pick === 'emergency' ? ' hint' : ''), ...K('2'), onclick: () => { m.close(); g.beginCounsel({ type: 'refer', urgency: 'emergency' }); } }, h('span', { class: 'k', style: { background: 'var(--bad-l)', color: 'var(--bad)' }, html: icon('phone', 16) }), h('span', {}, h('b', {}, t('ref.emergency')), h('br'), t('ref.emergencySub'))));
    const m = this.modal({ title: t('dlg.refer'), eyebrow: t('ref.eyebrow'), body });
  },

  showCounsel(options, { title, sub = '', onPick }) {
    const g = this.g;
    let sel = -1;
    const confirm = h('button', { class: 'btn primary grow', ...K('Enter', '↵'), disabled: true, onclick: () => { m.close(); onPick(sel); } }, h('span', { class: 'icw', html: icon('chat', 18) }), t('co.explain'));
    const opts = options.map((o, i) => h('button', { class: 'opt', ...K('abcd'[i] + ' ' + (i + 1), ''), onclick: () => { sel = i; opts.forEach((x, j) => x.classList.toggle('sel', j === i)); confirm.disabled = false; g.audio.sfx('click'); } }, h('span', { class: 'k' }, 'ABC'[i]), h('span', {}, o.text)));
    const tipBtn = g.settings.guided ? h('button', { class: 'btn soft', ...K('h'), onclick: () => { const i = options.findIndex((o) => o.correct); if (i >= 0) { opts[i].classList.add('hint'); opts[i].scrollIntoView({ block: 'nearest' }); } tipBtn.disabled = true; } }, h('span', { class: 'icw', html: MENTOR }), t('guide.tip')) : null;
    const body = h('div', {}, h('p', { class: 'prose' }, sub || t('co.sub')), ...opts);
    const m = this.modal({ title: title || t('co.title'), eyebrow: t('co.eyebrow'), body, foot: [tipBtn, confirm], dismissable: false });
  },

  showOutcome(res, onContinue) {
    const g = this.g;
    const st = GRADE_STYLE[res.grade];
    const dl = (k, label) => { const v = res.deltas[k]; if (!v) return null; return h('span', { class: 'delta ' + (v > 0 ? 'up' : 'down') }, `${label} ${v > 0 ? '+' : ''}${v}`); };
    const body = h('div', {},
      h('div', { class: 'oc-top' }, h('div', { class: 'oc-badge ' + st.tone, html: icon(st.icon, 40) }), h('div', { class: 'oc-label ' + st.tone }, t('grade.' + res.grade)), h('div', { class: 'oc-title' }, res.title)),
      h('div', { class: 'deltas' }, dl('safety', t('oc.safety')), dl('satisfaction', t('oc.satisfaction')), dl('reputation', t('oc.reputation')), dl('xp', 'XP')),
      res.notes.length ? h('ul', { class: 'notes' }, res.notes.map((n) => h('li', {}, h('span', { class: 'icw', html: icon(st.tone === 'bad' ? 'alert' : 'info', 16) }), h('span', {}, n)))) : null,
      h('div', { class: 'learn' }, h('b', { html: icon('book', 14) + ' ' + t('oc.note') }), res.learning));
    const m = this.modal({ noHead: true, body, dismissable: false, foot: h('button', { class: 'btn primary block', ...K('Enter Space', '↵'), onclick: () => { m.close(); onContinue(); } }, t('common.continue')) });
    g.audio.sfx(st.tone === 'good' ? 'correct' : st.tone === 'bad' ? 'incorrect' : 'notify');
    g.haptic(st.tone === 'good' ? 'success' : st.tone === 'bad' ? 'error' : 'light');
  },

  // ───────────────────────── POS ─────────────────────────
  showPOS(tab = 'checkout') {
    const g = this.g, s = g.state;
    const pc = g.customers.posCust;
    const pending = pc && pc.state === 'atPOS' && pc.bill;
    let method = 'upi';
    const body = h('div', {});
    const tabs = h('div', { class: 'tabs' });
    const content = h('div', {});
    const draw = () => {
      tabs.innerHTML = '';
      [['checkout', t('pos.checkout')], ['orders', t('pos.orders')], ['sales', t('pos.sales')]].forEach(([k, l]) => tabs.append(h('button', { class: tab === k ? 'on' : '', onclick: () => { tab = k; draw(); } }, l)));
      content.innerHTML = '';
      if (tab === 'checkout') {
        if (!pending) { content.append(h('div', { class: 'ev-hero info' }, h('span', { class: 'icw', html: icon('cash', 22) }), t('pos.none'))); return; }
        const total = pc.bill.reduce((a, p) => a + p.price, 0);
        if (g.settings.guided) content.append(h('div', { class: 'mentor-card good' }, h('span', { class: 'micon', html: MENTOR }), h('div', {}, h('b', {}, t('guide.mentor')), h('div', {}, t('pos.mentor')))));
        content.append(h('div', { class: 'pf', style: { marginBottom: '10px' } }, h('label', {}, t('sc.customer')), h('div', {}, `${pc.name} · #${num3(pc.num)}`)),
          h('div', { class: 'bill' }, pc.bill.map((p) => h('div', { class: 'li' }, h('span', {}, p.name), h('span', {}, fmtMoney(p.price)))), h('div', { class: 'tot' }, h('span', {}, t('pos.total')), h('span', {}, fmtMoney(total)))),
          h('div', { class: 'paym' }, [['upi', t('pos.upi'), 'device'], ['card', t('pos.card'), 'cash'], ['cash', t('pos.cash'), 'cash']].map(([k, l, ic]) => h('button', { class: method === k ? 'on' : '', ...K(String(['upi', 'card', 'cash'].indexOf(k) + 1)), onclick: () => { method = k; draw(); } }, h('span', { class: 'icw', html: icon(ic, 22) }), l))));
        content.append(h('button', { class: 'btn primary block', ...K('Enter', '↵'), style: { marginTop: '14px' }, onclick: () => { m.close(); g.completePayment(method); } }, h('span', { class: 'icw', html: icon('check', 18) }), t('pos.complete')));
      } else if (tab === 'orders') {
        this._ordersTab(content, draw, () => m.close());
      } else {
        content.append(h('div', { class: 'kpis' },
          h('div', { class: 'kpi' }, h('b', {}, fmtMoney(s.dailyRevenue)), h('span', {}, t('pos.revenue'))),
          h('div', { class: 'kpi' }, h('b', {}, String(s.served)), h('span', {}, t('pos.served'))),
          h('div', { class: 'kpi' }, h('b', {}, s.served ? fmtMoney(s.dailyRevenue / Math.max(1, s.paidCount || s.served)) : '₹0'), h('span', {}, t('pos.basket')))),
          h('p', { class: 'edu-note' }, h('span', { class: 'icw', html: icon('shield', 14) }), t('pos.note')));
      }
    };
    body.append(tabs, content);
    draw();
    const m = this.modal({ title: t('pos.title'), eyebrow: t('pos.eyebrow'), body, cls: 'wide' });
    const iv = setInterval(() => { if (!m.el.isConnected) return clearInterval(iv); for (const [el, o] of this._etaEls || []) el.textContent = etaText(o); if (tab === 'orders' && (this._etaEls || []).some(([, o]) => o.status === 'arrived' && !o._shown)) draw(); }, 1000);
  },

  // ───────────────────────── Stock-in ─────────────────────────
  _stockBox(p, reopen) {
    const g = this.g;
    if (p.stock >= 6) return null;
    const ord = g.pendingOrderFor(p.id);
    const cost = g.orderCost(p);
    const btn = ord ? h('span', { class: 'stock order' }, ord.status === 'arrived' ? t('stk.st.arrived') : t('stk.onOrder') + ' · ' + etaText(ord))
      : h('button', { class: 'btn ' + (p.stock === 0 ? 'primary' : 'soft'), ...K('o'), disabled: g.state.money < cost, onclick: () => { if (g.orderProduct(p)) reopen(); } }, h('span', { class: 'icw', html: icon('box', 18) }), t('stk.orderCost', { cost: fmtMoney(cost) }));
    return h('div', { class: 'ev-hero stockbox ' + (p.stock === 0 ? 'warn' : 'info') }, h('span', { class: 'icw', html: icon('box', 22) }), h('div', { style: { flex: 1, minWidth: 0 } }, h('div', {}, p.stock === 0 ? t('stk.medOOS') : t('stk.medLow')), h('div', { style: { marginTop: '8px' } }, btn)));
  },
  _ordersTab(content, redraw, closeModal) {
    const g = this.g, s = g.state;
    this._etaEls = [];
    content.append(h('div', { class: 'set-row' }, h('div', {}, t('up.funds')), h('b', {}, fmtMoney(s.money))));
    if (g.settings.guided) content.append(h('div', { class: 'mentor-card' }, h('span', { class: 'micon', html: MENTOR }), h('div', {}, h('b', {}, t('stk.howTitle')), h('div', {}, t('stk.how')))));
    // deliveries
    content.append(h('h4', { class: 'sec-label' }, t('stk.deliveries')));
    const act = g.activeOrders();
    if (!act.length) content.append(h('p', { class: 'muted-line' }, t('stk.noDeliveries')));
    for (const o of act) {
      const steps = ['ordered', 'transit', 'arrived'];
      const idx = steps.indexOf(o.status);
      const eta = h('span', { class: 'eta' }, etaText(o));
      this._etaEls.push([eta, o]); o._shown = o.status === 'arrived';
      content.append(h('div', { class: 'delivery ' + o.status },
        h('div', { class: 'd-top' }, h('b', {}, g.orderLabel(o)), h('span', { class: 'muted' }, o.id + ' · ' + tp('stk.items', { n: o.items.length }))),
        h('div', { class: 'd-steps' }, steps.map((st, i) => h('span', { class: 'dstep' + (i < idx ? ' done' : i === idx ? ' now' : '') }, tp('stk.st.' + st)))),
        h('div', { class: 'd-foot' }, eta, o.status === 'arrived' ? h('button', { class: 'btn primary', ...K('r'), onclick: () => { closeModal(); g.autoWalkTo(g.world.points.storageStand, Math.PI / 2, () => this.showReceive()); } }, h('span', { class: 'icw', html: icon('box', 16) }), t('stk.receiveNow')) : null)));
    }
    // out of stock list
    const out = g.catalog.filter((p) => p.stock === 0 && g.sectionUnlocked(p.section) && !g.pendingOrderFor(p.id));
    content.append(h('h4', { class: 'sec-label' }, t('stk.outList') + ` (${out.length})`));
    if (!out.length) content.append(h('p', { class: 'muted-line' }, t('stk.noneOut')));
    else {
      const all = out.reduce((a, p) => a + g.orderCost(p), 0);
      const allCost = Math.min(all, 4000);
      content.append(h('button', { class: 'btn soft block', style: { marginBottom: '8px' }, disabled: s.money < allCost, onclick: () => { g.placeOrder(out.map((p) => ({ id: p.id, qty: 30 })), allCost, {}); redraw(); } }, h('span', { class: 'icw', html: icon('box', 16) }), t('stk.orderAll', { cost: fmtMoney(allCost) })));
      for (const p of out.slice(0, 40)) {
        const cost = g.orderCost(p);
        content.append(h('div', { class: 'order-row oos' }, pic(p, 16), h('div', { class: 'nm' }, p.name, h('small', {}, String(SECTIONS[p.section].name))),
          h('button', { class: 'btn primary', style: { minHeight: '36px', fontSize: '.76em' }, disabled: s.money < cost, onclick: () => { g.orderProduct(p); redraw(); } }, t('stk.orderCost', { cost: fmtMoney(cost) }))));
      }
    }
    // sections
    content.append(h('h4', { class: 'sec-label' }, t('stk.sections')));
    for (const [k, sec] of Object.entries(SECTIONS)) {
      const info = g.sectionStock(k);
      const pend = (s.orders || []).some((o) => o.sec === k && o.status !== 'received');
      const bar = h('div', { class: 'sbar stock bar' }, h('div', { class: 'track' }, h('i', { style: { width: info.pct + '%' } })));
      content.append(h('div', { class: 'order-row' }, h('div', { class: 'nm' }, sec.name, h('div', { style: { fontSize: '.78em', color: info.low ? 'var(--warn)' : 'var(--ink-3)', fontWeight: 600 } }, t('pos.lowOut', { low: info.low, out: info.out }))), bar,
        h('button', { class: 'btn soft', style: { minHeight: '38px', fontSize: '.76em' }, disabled: pend || !info.low || s.money < info.cost, onclick: () => { g.restock(k); redraw(); } }, pend ? tp('stk.onOrder') : info.low ? t('pos.reorder', { cost: fmtMoney(info.cost) }) : 'OK')));
    }
    content.append(h('p', { class: 'edu-note' }, h('span', { class: 'icw', html: icon('info', 14) }), t('pos.fefo')));
  },
  showReceive() {
    const g = this.g;
    const lines = g.deliveryLines();
    if (!lines.length) return;
    const cold = lines.some((l) => l.cold);
    const checks = ['stk.check1', 'stk.check2', 'stk.check3', ...(cold ? ['stk.check4'] : [])];
    const ticked = new Set();
    const recv = h('button', { class: 'btn primary block', ...K('Enter', '↵'), disabled: true, onclick: () => { m.close(); g.receiveOrders(); } }, h('span', { class: 'icw', html: icon('check', 18) }), t('stk.recvBtn'));
    const list = h('div', { class: 'recv-list' }, lines.slice(0, 60).map((l) => h('div', { class: 'recv-li' }, pic(l.p, 16),
      h('div', { class: 'nm' }, l.p.name, h('small', {}, tp('stk.batchExp', { b: l.batch, e: l.expiry }) + (l.cold ? ' · ❄ ' + tp('stk.cold') : ''))), h('b', {}, tp('stk.qty', { n: l.qty })))));
    const chk = h('div', { class: 'recv-checks' }, checks.map((k, i) => {
      const b = h('button', { class: 'chk', ...K(String(i + 1)), onclick: () => { if (ticked.has(k)) ticked.delete(k); else ticked.add(k); b.classList.toggle('on', ticked.has(k)); recv.disabled = ticked.size < checks.length; g.audio.sfx('click'); } }, h('span', { class: 'box', html: icon('check', 14) }), h('span', {}, t(k)));
      return b;
    }));
    const body = h('div', {},
      g.settings.guided ? h('div', { class: 'mentor-card' }, h('span', { class: 'micon', html: MENTOR }), h('div', {}, h('b', {}, t('guide.mentor')), h('div', {}, t('stk.recvTip')))) : null,
      list, h('h4', { class: 'sec-label' }, t('stk.recvEyebrow')), chk,
      h('p', { class: 'edu-note' }, h('span', { class: 'icw', html: icon('info', 14) }), t('stk.learn')));
    const m = this.modal({ title: t('stk.recvTitle'), eyebrow: t('stk.recvEyebrow'), body, foot: recv, cls: 'wide' });
  },

  // ───────────────────────── Events ─────────────────────────
  showEvent(ev, onPick) {
    const g = this.g;
    let sel = -1;
    const confirm = h('button', { class: 'btn primary grow', ...K('Enter', '↵'), disabled: true, onclick: () => { m.close(); onPick(sel); } }, t('ev.confirm'));
    const opts = ev.options.map((o, i) => h('button', { class: 'opt', ...K('abcd'[i] + ' ' + (i + 1), ''), onclick: () => { sel = i; opts.forEach((x, j) => x.classList.toggle('sel', j === i)); confirm.disabled = false; g.audio.sfx('click'); } }, h('span', { class: 'k' }, 'ABCD'[i]), h('span', {}, o.t)));
    const tipBtn = g.settings.guided ? h('button', { class: 'btn soft', ...K('h'), onclick: () => { const i = ev.options.findIndex((o) => o.correct); if (i >= 0) opts[i].classList.add('hint'); tipBtn.disabled = true; } }, h('span', { class: 'icw', html: MENTOR }), t('guide.tip')) : null;
    const body = h('div', {}, h('div', { class: 'ev-hero' }, h('span', { class: 'icw', html: icon(ev.icon || 'alert', 24) }), h('span', {}, ev.text)), h('p', { class: 'prose' }, t('ev.question')), ...opts);
    const m = this.modal({ title: ev.title, eyebrow: t('ev.eyebrow'), body, foot: [tipBtn, confirm] });
  },
  showEventResult(ok, learn, onDone) {
    const body = h('div', {}, h('div', { class: 'oc-top' }, h('div', { class: 'oc-badge ' + (ok ? 'good' : 'bad'), html: icon(ok ? 'check' : 'x', 38) }), h('div', { class: 'oc-label ' + (ok ? 'good' : 'bad') }, ok ? t('ev.correct') : t('ev.incorrect'))), h('div', { class: 'learn' }, h('b', { html: icon('book', 14) + ' ' + t('oc.note') }), learn));
    const m = this.modal({ noHead: true, body, dismissable: false, foot: h('button', { class: 'btn primary block', ...K('Enter Space', '↵'), onclick: () => { m.close(); onDone?.(); } }, t('common.continue')) });
    this.g.audio.sfx(ok ? 'correct' : 'incorrect');
  },

  // ───────────────────────── Inspection ─────────────────────────
  cinema(on, title) {
    this.root.classList.toggle('letterbox', on);
    if (this._cineTitle) { this._cineTitle.remove(); this._cineTitle = null; }
    if (this._skip) { this._skip.remove(); this._skip = null; }
    if (on && title) { this._cineTitle = h('div', { class: 'cine-title' }, title); this.root.appendChild(this._cineTitle); }
    this.showHUD(!on);
  },
  skipButton(fn) { if (this._skip) this._skip.remove(); this._skip = h('button', { class: 'skip', ...K('Escape Enter', 'Esc'), onclick: () => { this._skip?.remove(); this._skip = null; fn(); } }, t('insp.skip')); this.root.appendChild(this._skip); },
  _inspWrap(card) {
    const wrap = h('div', { class: 'insp-intro' }, card);
    this.parkToasts();
    this.layer.appendChild(wrap);
    const api = { el: wrap, close: () => { wrap.remove(); const i = this.stack.indexOf(api); if (i >= 0) this.stack.splice(i, 1); }, cls: 'insp' };
    this.stack.push(api);
    return api;
  },
  showInspectionIntro({ official, onBegin }) {
    let api;
    const card = h('div', { class: 'insp-card' },
      h('div', { class: 'insp-band' }, h('div', { class: 'eyebrow' }, official ? t('insp.official') : t('insp.surprise')), h('h1', {}, t('insp.title')), h('div', { class: 'big' }, t('insp.20q'))),
      h('div', { class: 'insp-body' },
        h('div', { class: 'passreq' }, h('span', {}, t('insp.passReq')), h('b', {}, '20 / 20')),
        h('p', {}, t('insp.rules')),
        h('button', { class: 'btn navy block', ...K('Enter', '↵'), onclick: () => { api.close(); onBegin(); } }, h('span', { class: 'icw', html: icon('play', 18) }), t('insp.begin'))));
    api = this._inspWrap(card);
  },
  showInspectionFail(score, onRestart, onReview) {
    let api;
    const card = h('div', { class: 'insp-card' },
      h('div', { class: 'insp-band fail' }, h('div', { class: 'eyebrow' }, t('insp.result')), h('h1', {}, t('insp.failed'))),
      h('div', { class: 'insp-body' },
        h('div', { class: 'sec-label', style: { textAlign: 'center' } }, t('insp.score')),
        h('div', { class: 'result-big fail' }, `${score} / 20`),
        h('p', {}, t('insp.failQuote')),
        h('button', { class: 'btn danger block', ...K('Enter', '↵'), onclick: () => { api.close(); onRestart(); } }, h('span', { class: 'icw', html: icon('restart', 18) }), t('insp.restart')),
        h('button', { class: 'btn ghost block', style: { marginTop: '8px' }, onclick: () => onReview() }, h('span', { class: 'icw', html: icon('book', 18) }), t('insp.review'))));
    api = this._inspWrap(card);
  },
  showInspectionPass(onContinue) {
    let api;
    const card = h('div', { class: 'insp-card' },
      h('div', { class: 'insp-band pass' }, h('div', { class: 'eyebrow' }, t('insp.result')), h('h1', {}, t('insp.passed'))),
      h('div', { class: 'insp-body' },
        h('div', { class: 'result-big' }, '20 / 20'),
        h('div', { class: 'stamp' }, t('insp.certified')),
        h('p', {}, t('insp.passText')),
        h('div', { class: 'deltas' }, h('span', { class: 'delta up' }, t('oc.reputation') + ' +15'), h('span', { class: 'delta up' }, t('oc.safety') + ' +10'), h('span', { class: 'delta up' }, t('insp.bonus')), h('span', { class: 'delta up' }, 'XP +300')),
        h('button', { class: 'btn primary block', ...K('Enter', '↵'), onclick: () => { api.close(); onContinue(); } }, t('insp.continue'))));
    api = this._inspWrap(card);
  },
};
