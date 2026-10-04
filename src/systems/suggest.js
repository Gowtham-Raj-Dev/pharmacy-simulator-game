// Stock suggestions: reads what the customer says ("I have fever…"), matches it to
// the symptom guide and lists the brands on our shelves that fit — like a senior
// pharmacist saying "for fever we keep Dolo 650, Crocin, Calpol…". Suggestions come
// from the symptom only; the trainee still has to ask the safety questions
// (allergies, medicines, pregnancy, age) before choosing.
import { SYMPTOM_GUIDE } from '../data/scenarios.js';

const norm = (s) => ' ' + String(s || '').toLowerCase().replace(/[’']/g, '').replace(/[-_/,.;:!?()“”"]/g, ' ').replace(/\s+/g, ' ') + ' ';
const LATIN = /^[a-z0-9 ]+$/;
const hit = (text, kw) => {
  const k = norm(kw).trim();
  if (!k) return false;
  return LATIN.test(k) ? text.includes(' ' + k + ' ') : text.includes(k);
};

/** Symptom-guide entries mentioned in a piece of text, most specific first. */
export function detectSymptoms(text) {
  const tx = norm(text);
  const found = [];
  for (const e of SYMPTOM_GUIDE) {
    const kws = e.k.filter((k) => hit(tx, k));
    if (kws.length) found.push({ e, kws: kws.map((k) => norm(k).trim()) });
  }
  // "cough" is covered by "dry cough"; "சளி" by "நெஞ்சுச் சளி" → keep the specific one
  const kept = found.filter((f) => !f.kws.every((k) => found.some((o) => o !== f && o.kws.some((ok) => ok !== k && ok.includes(k)))));
  return kept.slice(0, 3).map((f) => f.e);
}

// Never suggest something the label rules out for this age (the trainee still checks everything else).
const MIN_AGE = { not_under_3m: 0.25, not_under_1: 1, not_under_2: 2, not_under_6: 6, adult_only: 12, not_under_16: 16, codeine: 18 };
const ageOk = (p, age) => p.flags.every((f) => !(f in MIN_AGE) || age >= MIN_AGE[f]);

const idxOf = (p) => p._sugIdx || (p._sugIdx = norm([p._nameEN || p.name, p._genEN || p.generic, p._clsEN || p.cls, p.tags.join(' '), p._symIdx || p.symptoms.join(' ')].join(' ')));

/** In-stock products for one guide category, one per brand, age-appropriate first. */
export function productsFor(catalog, q, { age = 30, max = 4 } = {}) {
  const qn = norm(q).trim();
  if (!qn) return [];
  const toks = qn.split(' ');
  const child = age < 12, infant = age < 1;
  const fit = (p) => {
    const ped = p.tags.includes('paediatric') || /paediatric/.test(p.strengthRaw), inf = p.tags.includes('infant') || /infant/.test(p.strengthRaw);
    const kid = ped || inf || /Syrup|Suspension|Drops/.test(p.form);
    if (infant) return inf ? 0 : kid ? 1 : 3;
    if (child) return ped ? 0 : kid ? 1 : 3;
    return ped || inf ? 3 : 0;
  };
  // 0 = the ingredient itself (paracetamol → Dolo, not Sinarest), 1 = tagged with it, 2 = mentions it
  const direct = (p) => (p.baseKey.toLowerCase() === qn.replace(/ /g, '') ? 0 : norm(p._genEN || p.generic).trim().startsWith(qn) || p.tags.some((tg) => norm(tg).trim() === qn) ? 1 : 2);
  let pool = catalog.filter((p) => p.stock > 0 && !p.expired && ageOk(p, age) && toks.every((tk) => idxOf(p).includes(tk)));
  if (!pool.length) return [];
  const best = Math.min(...pool.map(direct));
  if (best > 0) pool = pool.filter((p) => p.status !== 'Rx'); // prescription items only when the category is about them
  pool = pool.filter((p) => direct(p) === best); // menthol → vapour rub, not every balm containing menthol
  pool.sort((a, b) => fit(a) - fit(b) || a.isGeneric - b.isGeneric || a.brandRank - b.brandRank || a.packIdx - b.packIdx || a.price - b.price);
  const out = [], seen = new Set();
  for (const p of pool) {
    const k = p.brandBase + '|' + p.baseKey;
    if (seen.has(k)) continue;
    seen.add(k); out.push(p);
    if (out.length >= max) break;
  }
  return out;
}

/** Suggestions for a customer: [{ entry, cats: [{ cat, products }] }]. */
export function suggestFor(catalog, c) {
  const s = c.scn;
  const age = s.child ? (s.child.age < 1 ? (s.child.months || 6) / 12 : s.child.age) : (c.age || 30);
  return detectSymptoms(c.complaint).map((entry) => ({
    entry,
    emergency: !entry.cats.length,
    cats: entry.cats.filter((cat) => cat.q).map((cat) => ({ cat, products: productsFor(catalog, cat.q, { age }) })).filter((x) => x.products.length),
  }));
}
