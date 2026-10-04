// Swaps every piece of game content (scenarios, medicines, quiz, levels, events…)
// between English, Tamil and bilingual Tamil+English. English originals are kept,
// so switching back and forth is lossless. Search indexes are bilingual and static.
import { registerDict, bi } from './i18n.js';
import { SCENARIOS, SYMPTOM_GUIDE } from '../data/scenarios.js';
import { QUESTION_BANK, MODULES } from '../data/questions.js';
import { BASES, SECTIONS, STATUS_LABEL, FLAG_INFO } from '../data/products.js';
import { LEVELS, RANKS, UPGRADES, ACHIEVEMENTS } from '../data/levels.js';
import { EVENTS } from '../data/events.js';
import { NAMES } from '../data/names.js';
import { RULES } from '../systems/evaluation.js';
import TA_SC from './ta/scenarios.json';
import TA_Q from './ta/questions.json';
import TA_P from './ta/products.json';
import TA_PH from './ta/phrases.json';
import TA_M from './ta/misc.json';
import TA_UI from './ta/ui.json';
import { TA_EXTRA } from './ta_extra.js';

registerDict('ta', { ...TA_UI, ...TA_EXTRA });

const PACK_VARIANTS = ['', 'Value pack', 'Family pack', 'Clinic pack'];
// entry: [object, key, taValue, plain]   (plain → never shown bilingually, e.g. names & labels)
const entries = [];
const add = (obj, key, ta, plain = false) => {
  if (!obj || ta == null) return;
  entries.push([obj, key, ta, plain, obj[key]]);
};
const addArr = (arr, taArr, plain = false) => {
  if (!Array.isArray(arr) || !Array.isArray(taArr)) return;
  for (let i = 0; i < arr.length && i < taArr.length; i++) add(arr, i, taArr[i], plain);
};
let built = false;

export function initContent(catalog) {
  if (built) return; built = true;
  // ── scenarios
  for (const s of SCENARIOS) {
    const T = TA_SC[s.id]; if (!T) continue;
    add(s, 'title', T.title); add(s, 'complaint', T.complaint); add(s, 'learning', T.learning);
    if (s.seeDoctor && T.seeDoctor) add(s, 'seeDoctor', T.seeDoctor);
    for (const k in s.answers) add(s.answers, k, T.answers?.[k]);
    if (s.adviceOptions && T.adviceOptions) s.adviceOptions.forEach((o, i) => add(o, 'text', T.adviceOptions[i]));
    if (s.prescription && T.rx) for (const k of ['drug', 'directions', 'doctor', 'issue']) if (s.prescription[k]) add(s.prescription, k, T.rx[k], k !== 'issue');
  }
  // ── quiz + study modules
  for (const q of QUESTION_BANK) {
    const T = TA_Q.questions[q.id]; if (!T) continue;
    add(q, 'q', T.q); addArr(q.options, T.options); add(q, 'x', T.x);
  }
  for (const m of MODULES) { const T = TA_Q.modules[m.id]; if (!T) continue; add(m, 'title', T.title); addArr(m.facts, T.facts); }
  // ── symptom guide (keywords: union so both languages always search)
  SYMPTOM_GUIDE.forEach((e, i) => {
    const T = TA_M.symptoms[i] || e.ta; if (!T) return;
    add(e, 'title', T.title); add(e, 'refer', T.refer);
    e.k = [...new Set([...e.k, ...T.keywords.map((x) => x.toLowerCase())])];
    e.cats.forEach((c, j) => { add(c, 'name', T.cats[j]?.name); add(c, 'why', T.cats[j]?.why); });
  });
  // ── levels, ranks, upgrades, achievements, events, rules, names
  LEVELS.forEach((L, i) => {
    const T = TA_M.levels[i]; if (!T) return;
    add(L, 'title', T.title); add(L, 'rank', T.rank, true); add(L, 'intro', T.intro);
    L.objectives.forEach((o, j) => add(o, 'label', T.objectives[j]));
    addArr(L.unlock, T.unlock, true);
  });
  addArr(RANKS, TA_M.ranks, true);
  for (const u of UPGRADES) { const T = TA_M.upgrades[u.id]; if (T) { add(u, 'name', T.name); add(u, 'desc', T.desc); } }
  for (const a of ACHIEVEMENTS) { const T = TA_M.achievements[a.id]; if (T) { add(a, 'name', T.name); add(a, 'desc', T.desc); } }
  for (const [k, e] of Object.entries(EVENTS)) {
    const T = TA_M.events[k]; if (!T) continue;
    add(e, 'title', T.title); add(e, 'toast', T.toast); add(e, 'objective', T.objective); add(e, 'text', T.text); add(e, 'learn', T.learn);
    e.options.forEach((o, i) => add(o, 't', T.options[i]));
  }
  for (const r of RULES) add(r, 'msg', TA_M.rules[r.msg]);
  for (const k of Object.keys(NAMES)) addArr(NAMES[k], TA_M.names[k], true);
  // ── product glossaries
  for (const [k, s] of Object.entries(SECTIONS)) { const T = TA_PH.sections[k]; if (T) { add(s, 'name', T.name); add(s, 'short', T.short, true); } }
  for (const k of Object.keys(STATUS_LABEL)) add(STATUS_LABEL, k, TA_PH.status[k]);
  for (const k of Object.keys(FLAG_INFO)) add(FLAG_INFO, k, TA_PH.flags[k]);
  // ── catalog products
  const baseBy = Object.fromEntries(BASES.map((b) => [b.key, b]));
  const PH = TA_PH, PL = PH.packLabels;
  for (const p of catalog) {
    const b = baseBy[p.baseKey], T = TA_P[p.baseKey] || {};
    const strTA = PH.strengths[p.strengthRaw] ?? p.strengthRaw;
    const formTA = PH.forms[p.form] ?? p.form;
    const label = PACK_VARIANTS[p.packIdx] || '';
    const gen = p.isGeneric ? ' ' + (PL.Generic || 'Generic') : '';
    const formWord = p.form === 'Device' ? '' : formTA;
    const nameTA = `${p.brandBase}${gen} ${strTA}${formWord ? ' ' + formWord : ''}${label ? ' · ' + (PL[label] || label) : ''}`.replace(/\s+/g, ' ').trim();
    const packTA = (PH.packs[p.packRaw] ?? p.packRaw) + (p.packIdx ? ` ×${p.packMult}` : '');
    const noteTA = p.note ? (PH.notes[p.note] ?? p.note) : '';
    const genTA = T.generic || p.generic;
    const descTA = TA_EXTRA['p.desc'].replace('{gen}', genTA).replace('{str}', p.strengthRaw && p.form !== 'Device' ? ` (${strTA})` : '').replace('{use}', T.use || p.use).replace('{note}', noteTA ? noteTA + ' ' : '');
    // English display helpers
    p.formL = p.form; p.categoryL = p.category;
    // bilingual static search index
    p._nameEN = p.name; p._genEN = p.generic; p._clsEN = p.cls;
    p._symIdx = [...p.symptoms, ...(T.symptoms || []), ...p.tags].join(' ').toLowerCase();
    p._idx = [p.name, nameTA, p.brand, p.generic, genTA, p.category, PH.categories[p.category] || '', p.cls, T.cls || '', p.form, formTA, p.manufacturer,
      p._symIdx, SECTIONS[p.section].name, PH.sections[p.section]?.name || ''].join(' | ').toLowerCase();
    add(p, 'name', nameTA, true); add(p, 'brand', p.brandBase + gen, true); add(p, 'generic', genTA, true); add(p, 'cls', T.cls);
    add(p, 'use', T.use); add(p, 'warnings', T.warnings ? T.warnings.slice() : null); add(p, 'symptoms', T.symptoms ? T.symptoms.slice() : null, true);
    add(p, 'storage', PH.storage[b?.storage] ?? null); add(p, 'pack', packTA, true); add(p, 'strength', strTA, true);
    if (p.note) add(p, 'note', noteTA); add(p, 'description', descTA);
    add(p, 'formL', formTA, true); add(p, 'categoryL', PH.categories[p.category] ?? p.category, true);
  }
}

/** Apply a language to all registered content. */
export function applyContent(lang) {
  for (const [obj, key, ta, plain, en] of entries) {
    if (lang === 'en') obj[key] = en;
    else if (lang === 'ta' || plain) obj[key] = ta;
    else obj[key] = Array.isArray(en) ? en.map((x, i) => bi(ta[i], x)) : bi(ta, en);
  }
}
