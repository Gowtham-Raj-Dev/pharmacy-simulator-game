import fs from 'fs';
import { BASES, SECTIONS, STATUS_LABEL, FLAG_INFO, CATEGORIES, buildCatalog } from '../src/data/products.js';
import { SCENARIOS, SYMPTOM_GUIDE } from '../src/data/scenarios.js';
import { QUESTION_BANK, MODULES } from '../src/data/questions.js';
import { LEVELS, RANKS, UPGRADES, ACHIEVEMENTS } from '../src/data/levels.js';
import { EVENTS } from '../src/data/events.js';
import { NAMES } from '../src/data/names.js';
import { RULES } from '../src/systems/evaluation.js';
const out = (f, o) => fs.writeFileSync('src/i18n/en/' + f, JSON.stringify(o, null, 1));
// scenarios
const sc = {};
for (const s of SCENARIOS) {
  sc[s.id] = { title: s.title, complaint: s.complaint, answers: s.answers, ...(s.seeDoctor ? { seeDoctor: s.seeDoctor } : {}), learning: s.learning, ...(s.adviceOptions ? { adviceOptions: s.adviceOptions.map((o) => o.text) } : {}), ...(s.prescription ? { rx: { drug: s.prescription.drug, directions: s.prescription.directions, doctor: s.prescription.doctor, ...(s.prescription.issue ? { issue: s.prescription.issue } : {}) } } : {}) };
}
const ids = Object.keys(sc);
out('scenarios_a.json', Object.fromEntries(ids.slice(0, 28).map((k) => [k, sc[k]])));
out('scenarios_b.json', Object.fromEntries(ids.slice(28).map((k) => [k, sc[k]])));
// questions + modules
out('questions.json', { questions: Object.fromEntries(QUESTION_BANK.map((q) => [q.id, { q: q.q, options: q.options, x: q.x }])), modules: Object.fromEntries(MODULES.map((m) => [m.id, { title: m.title, facts: m.facts }])) });
// products
const bases = Object.fromEntries(BASES.map((b) => [b.key, { generic: b.generic, cls: b.cls, use: b.use, warnings: b.warnings, symptoms: b.symptoms }]));
const bk = Object.keys(bases);
out('products_a.json', Object.fromEntries(bk.slice(0, 60).map((k) => [k, bases[k]])));
out('products_b.json', Object.fromEntries(bk.slice(60).map((k) => [k, bases[k]])));
const cat = buildCatalog();
const uniq = (a) => [...new Set(a)].sort();
const strengths = uniq(cat.map((p) => p.strengthRaw).filter((x) => /[a-zA-Z]{3,}/.test(x.replace(/\b(mg|mL|IU|mcg|CFU|SPF|g|G|w\/v|w\/w)\b/g, ''))));
const packs = uniq(cat.map((p) => p.packRaw));
const notes = uniq(cat.map((p) => p.note).filter(Boolean));
const storage = uniq(BASES.map((b) => b.storage));
const forms = uniq(cat.map((p) => p.form));
out('phrases.json', {
  strengths: Object.fromEntries(strengths.map((x) => [x, x])), packs: Object.fromEntries(packs.map((x) => [x, x])), notes: Object.fromEntries(notes.map((x) => [x, x])),
  storage: Object.fromEntries(storage.map((x) => [x, x])), forms: Object.fromEntries(forms.map((x) => [x, x])), categories: Object.fromEntries(CATEGORIES.map((x) => [x, x])),
  sections: Object.fromEntries(Object.entries(SECTIONS).map(([k, v]) => [k, { name: v.name, short: v.short }])), status: STATUS_LABEL, flags: FLAG_INFO,
  packLabels: { 'Value pack': 'Value pack', 'Family pack': 'Family pack', 'Clinic pack': 'Clinic pack', 'Generic': 'Generic' },
});
// misc
out('misc.json', {
  symptoms: SYMPTOM_GUIDE.map((e) => ({ title: e.title, keywords: e.k, cats: e.cats.map((c) => ({ name: c.name, why: c.why })), refer: e.refer })),
  levels: LEVELS.map((L) => ({ title: L.title, rank: L.rank, intro: L.intro, objectives: L.objectives.map((o) => o.label), unlock: L.unlock })),
  ranks: RANKS,
  upgrades: Object.fromEntries(UPGRADES.map((u) => [u.id, { name: u.name, desc: u.desc }])),
  achievements: Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, { name: a.name, desc: a.desc }])),
  events: Object.fromEntries(Object.entries(EVENTS).map(([k, e]) => [k, { title: e.title, toast: e.toast, objective: e.objective, text: e.text, options: e.options.map((o) => o.t), learn: e.learn }])),
  rules: uniq(RULES.map((r) => r.msg)).reduce((o, m) => (o[m] = m, o), {}),
  names: NAMES,
});
console.log('strengths', strengths.length, 'packs', packs.length, 'notes', notes.length, 'storage', storage.length, 'forms', forms.length);
for (const f of fs.readdirSync('src/i18n/en')) console.log(f, fs.statSync('src/i18n/en/' + f).size);
