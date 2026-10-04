// ─────────────────────────────────────────────────────────────────────────────
// Safety check + decision evaluation. Compares the player's decision against the
// predefined educational outcome of the scenario. Safety outweighs revenue.
// ─────────────────────────────────────────────────────────────────────────────
import { pick, shuffle, fmtMoney } from '../core/util.js';
import { t, tp, mapBi } from '../i18n/i18n.js';

// fact → product flags that conflict
export const RULES = [
  { fact: 'allergy:nsaid', flags: ['nsaid', 'aspirin', 'topical_nsaid', 'salicylate'], sev: 'major', msg: 'Customer reported an NSAID/aspirin allergy.' },
  { fact: 'allergy:penicillin', flags: ['penicillin'], sev: 'major', msg: 'Customer is allergic to penicillin.' },
  { fact: 'allergy:iodine', flags: ['iodine'], sev: 'major', msg: 'Customer reacts to iodine.' },
  { fact: 'allergy:sulfa', flags: ['sulfa'], sev: 'major', msg: 'Customer has a sulfonamide allergy.' },
  { fact: 'cond:asthma_nsaid', flags: ['nsaid', 'aspirin', 'topical_nsaid', 'salicylate'], sev: 'major', msg: 'Asthma that worsened after an NSAID.' },
  { fact: 'cond:asthma', flags: ['nsaid', 'aspirin'], sev: 'caution', msg: 'Asthma — NSAIDs can trigger bronchospasm in some people.' },
  { fact: 'cond:peptic_ulcer', flags: ['nsaid', 'aspirin'], sev: 'major', msg: 'History of stomach ulcer / GI bleed.' },
  { fact: 'cond:hypertension', flags: ['decongestant_oral'], sev: 'major', msg: 'High blood pressure — oral decongestants can raise BP.' },
  { fact: 'cond:hypertension', flags: ['decongestant_topical'], sev: 'caution', msg: 'High blood pressure — use topical decongestants cautiously and short-term.' },
  { fact: 'cond:diabetes', flags: ['contains_sugar'], sev: 'caution', msg: 'Diabetes — a sugar-free formulation is preferable.' },
  { fact: 'cond:pregnancy', flags: ['pregnancy_avoid'], sev: 'major', msg: 'Customer is pregnant — this product is generally avoided in pregnancy.' },
  { fact: 'cond:pregnancy', flags: ['pregnancy_caution'], sev: 'caution', msg: 'Pregnancy — check with the doctor before use.' },
  { fact: 'cond:prostate', flags: ['anticholinergic'], sev: 'major', msg: 'Prostate enlargement — anticholinergic effects can cause urinary retention.' },
  { fact: 'cond:glaucoma', flags: ['anticholinergic'], sev: 'major', msg: 'Glaucoma — anticholinergic medicines can worsen it.' },
  { fact: 'cond:kidney', flags: ['nsaid'], sev: 'major', msg: 'Kidney disease — NSAIDs can worsen kidney function.' },
  { fact: 'med:warfarin', flags: ['nsaid', 'aspirin'], sev: 'major', msg: 'Takes warfarin — NSAIDs/aspirin increase bleeding risk.' },
  { fact: 'med:warfarin', flags: ['topical_nsaid', 'salicylate'], sev: 'caution', msg: 'Takes warfarin — topical NSAIDs/salicylates can still increase bleeding risk.' },
  { fact: 'med:antihypertensive', flags: ['nsaid'], sev: 'caution', msg: 'Takes blood-pressure medicine — NSAIDs can reduce blood-pressure control.' },
  { fact: 'med:decongestant_oral', flags: ['decongestant_oral'], sev: 'major', msg: 'Already taking an oral decongestant (duplicate).' },
  { fact: 'cond:prostate', flags: ['decongestant_oral'], sev: 'caution', msg: 'Prostate enlargement — decongestants can worsen urinary retention.' },
  { fact: 'cond:glaucoma', flags: ['decongestant_oral'], sev: 'caution', msg: 'Glaucoma — decongestants should be used with caution.' },
  { fact: 'med:lithium', flags: ['nsaid'], sev: 'major', msg: 'Takes lithium — NSAIDs can raise lithium levels (toxicity).' },
  { fact: 'med:antihypertensive', flags: ['decongestant_oral'], sev: 'major', msg: 'Takes blood-pressure medicine — oral decongestants oppose its effect.' },
  { fact: 'med:maoi', flags: ['decongestant_oral', 'decongestant_topical', 'dextromethorphan'], sev: 'major', msg: 'Takes an MAO inhibitor — dangerous interaction.' },
  { fact: 'med:paracetamol_combo', flags: ['paracetamol'], sev: 'major', msg: 'Already taking a paracetamol-containing product (duplicate ingredient).' },
  { fact: 'med:sedatives', flags: ['sedating'], sev: 'major', msg: 'Takes other sedating medicines.' },
  { fact: 'life:driver', flags: ['sedating'], sev: 'major', msg: 'Drives professionally — sedating products impair driving.' },
  { fact: 'age:young_infant', flags: ['not_under_3m'], sev: 'major', msg: 'Not suitable for a baby under 3 months.' },
  { fact: 'age:under1', flags: ['not_under_1'], sev: 'major', msg: 'Honey-containing products must not be given under 1 year.' },
  { fact: 'age:infant', flags: ['adult_only', 'not_under_16', 'not_under_2', 'not_under_6'], sev: 'major', msg: 'Not suitable for an infant.' },
  { fact: 'age:under6', flags: ['not_under_6'], sev: 'major', msg: 'Not suitable for a child under 6.' },
  { fact: 'age:child', flags: ['adult_only', 'not_under_16'], sev: 'major', msg: 'Not suitable for a child of this age.' },
  { fact: 'age:teen', flags: ['not_under_16'], sev: 'major', msg: 'Not for under-16s (aspirin — Reye\'s syndrome risk).' },
  { fact: 'age:elderly', flags: ['sedating', 'anticholinergic'], sev: 'caution', msg: 'Older adult — sedating/anticholinergic medicines increase falls and confusion risk.' },
];

export const FACT_SOURCE = { allergy: 'allergies', med: 'meds', cond: 'history', life: 'lifestyle', age: null };
export const Q_LABEL = new Proxy({}, { get: (o, k) => (typeof k === 'string' ? tp('qn.' + k) : undefined) });

export function subjectAge(scn) {
  if (scn.child) return scn.child.age + (scn.child.months || 0) / 12;
  return scn.patient.age;
}
export function deriveFacts(scn) {
  const f = new Set(scn.facts || []);
  const age = subjectAge(scn);
  if (age < 0.25) f.add('age:young_infant');
  if (age < 1) f.add('age:under1');
  if (age < 6) f.add('age:under6');
  if (age < 2) f.add('age:infant'); else if (age < 12) f.add('age:child'); else if (age < 16) f.add('age:teen');
  if (age >= 65) f.add('age:elderly');
  return f;
}
export function matchesAccept(p, list = []) {
  return list.some((expr) => expr.split('+').every((t) => p.tags.includes(t)));
}

/** Issues for one product (or tray) given customer facts. */
export function productIssues(products, scn, asked) {
  const facts = deriveFacts(scn);
  const out = [];
  for (const p of products) {
    if (p.expired) out.push({ sev: 'major', cat: 'expiry', known: true, msg: tp('eval.expired', { name: p.name, batch: p.batch, expiry: p.expiry }), pid: p.id });
    if (p.status === 'Rx') {
      const rx = scn.prescription;
      if (!rx) out.push({ sev: 'major', cat: 'rx', known: true, msg: tp('eval.rxNone', { name: p.name }), pid: p.id });
      else if (!rx.valid) out.push({ sev: 'major', cat: 'rx', known: true, msg: tp('eval.rxInvalid', { issue: String(rx.issue || tp('eval.invalid')) }), pid: p.id });
      else if (rx.baseKey !== p.baseKey || (rx.tag && !p.tags.includes(rx.tag))) out.push({ sev: 'major', cat: 'rx', known: true, msg: tp('eval.rxMismatch', { name: p.name, drug: String(rx.drug) }), pid: p.id });
    }
    for (const r of RULES) {
      if (!facts.has(r.fact)) continue;
      const hit = r.flags.filter((fl) => p.flags.includes(fl));
      if (!hit.length) continue;
      let sev = r.sev;
      if (scn.escalate && hit.some((h) => scn.escalate.includes(h))) sev = 'major';
      const src = FACT_SOURCE[r.fact.split(':')[0]];
      out.push({ sev, cat: src || 'age', known: src ? asked.has(src) : true, msg: String(r.msg), pid: p.id, product: p.name });
    }
  }
  // duplicate ingredients within the tray
  const dupFlags = ['paracetamol', 'nsaid', 'sedating', 'decongestant_oral', 'antihistamine'];
  for (const fl of dupFlags) {
    const withF = products.filter((p) => p.flags.includes(fl));
    if (withF.length > 1) out.push({ sev: 'major', cat: 'duplicate', known: true, msg: tp('eval.dup', { n: withF.length, what: tp('eval.dup.' + fl) }) });
  }
  return out;
}

/** Visible safety-check rows for the UI (only what the player knows). */
export function safetyRows(products, scn, asked) {
  const issues = productIssues(products, scn, asked);
  const known = issues.filter((i) => i.known);
  const rows = [];
  const cats = [
    ['allergies', t('sc.allergies')], ['meds', t('sc.meds')], ['history', t('sc.history')], ['lifestyle', t('sc.lifestyle')],
  ];
  for (const [k, label] of cats) {
    const iss = known.filter((i) => i.cat === k);
    if (iss.length) rows.push({ label, state: iss.some((i) => i.sev === 'major') ? 'bad' : 'warn', text: iss.map((i) => i.msg).join(' ') });
    else if (asked.has(k)) rows.push({ label, state: 'ok', text: t('eval.checked') });
    else rows.push({ label, state: 'unknown', text: t('eval.notAsked', { q: Q_LABEL[k] }) });
  }
  const ageIss = known.filter((i) => i.cat === 'age');
  rows.push({ label: t('sc.age'), state: ageIss.length ? (ageIss.some((i) => i.sev === 'major') ? 'bad' : 'warn') : 'ok', text: ageIss.length ? ageIss.map((i) => i.msg).join(' ') : t('eval.ageOk', { age: Math.floor(subjectAge(scn)) || '<1' }) });
  const rxIss = known.filter((i) => i.cat === 'rx');
  const hasRx = products.some((p) => p.status === 'Rx');
  rows.push({ label: t('sc.rx'), state: rxIss.length ? 'bad' : 'ok', text: rxIss.length ? rxIss.map((i) => i.msg).join(' ') : hasRx ? t('eval.rxOk') : products.some((p) => p.status === 'P') ? t('eval.pOnly') : t('eval.otc') });
  const exp = known.filter((i) => i.cat === 'expiry' || i.cat === 'duplicate');
  rows.push({ label: t('sc.batch'), state: exp.length ? 'bad' : 'ok', text: exp.length ? exp.map((i) => i.msg).join(' ') : t('eval.batchOk') });
  rows.push({ label: t('sc.redflags'), state: asked.has('symptoms') ? 'ok' : 'unknown', text: asked.has('symptoms') ? t('eval.symOk') : t('eval.symNo') });
  const headline = known.find((i) => i.sev === 'major') || known.find((i) => i.sev === 'caution');
  return { rows, headline: headline ? headline.msg : rows.some((r) => r.state === 'unknown') ? t('eval.someUnchecked') : t('eval.noConflicts'), level: headline ? (headline.sev === 'major' ? 'bad' : 'warn') : rows.some((r) => r.state === 'unknown') ? 'unknown' : 'ok' };
}

const WRONG_COUNSEL = ['eval.wrong1', 'eval.wrong2', 'eval.wrong3', 'eval.wrong4', 'eval.wrong5'];

export function counselOptions(decision, scn) {
  let opts;
  if (decision.type === 'dispense') {
    const p = decision.products.find((x) => matchesAccept(x, scn.correct.accept || [])) || decision.products[0];
    const right = t('eval.counselRight', { brand: p.brand, gen: mapBi(p.generic, (g) => g.replace(/\s*\(.*?\)/g, '')), use: p.use, warn: p.warnings[0] || '', when: scn.seeDoctor || t('eval.persist') });
    opts = [{ text: right, correct: true }, ...shuffle([...WRONG_COUNSEL]).slice(0, 2).map((k) => ({ text: t(k) }))];
  } else if (scn.adviceOptions && ((decision.type === 'refer' && (scn.correct.type === 'refer' || scn.alsoOk?.type === 'refer')) || (decision.type === 'advise' && (scn.correct.type === 'advise' || scn.alsoOk?.type === 'advise')))) {
    opts = scn.adviceOptions.map((o) => ({ ...o }));
  } else if (decision.type === 'refer') {
    opts = [
      { text: t(decision.urgency === 'emergency' ? 'eval.emergencyRight' : 'eval.referRight'), correct: true },
      { text: t('eval.referWrong1') },
      { text: t('eval.referWrong2') },
    ];
  } else {
    opts = [
      { text: t('eval.adviseRight'), correct: true },
      { text: t('eval.adviseWrong1') },
      { text: t('eval.adviseWrong2') },
    ];
  }
  return shuffle(opts);
}

/** Evaluate the final decision. */
export function evaluate(decision, scn, asked, extra = {}) {
  const N = []; // notes
  const d = { safety: 0, satisfaction: 0, reputation: 0, xp: 0 };
  let grade = 'good', title = '', safe = true;
  const correct = scn.correct, also = scn.alsoOk;
  const missed = (scn.keyQuestions || []).filter((k) => !asked.has(k));
  const emergency = correct.type === 'refer' && correct.urgency === 'emergency';

  if (decision.type === 'dispense') {
    const issues = productIssues(decision.products, scn, asked);
    const majors = issues.filter((i) => i.sev === 'major'), cautions = issues.filter((i) => i.sev === 'caution');
    if (correct.type === 'refer') {
      grade = 'dangerous'; safe = false; title = t(emergency ? 'eval.t.missedEmergency' : 'eval.t.missedReferral');
      d.safety -= emergency ? 26 : 18; d.reputation -= 8; d.satisfaction -= 4;
      N.push(t(emergency ? 'eval.n.emergency' : 'eval.n.referral'));
      if (!asked.has('symptoms')) N.push(t('eval.n.askSymptoms'));
    } else if (majors.length) {
      grade = 'unsafe'; safe = false; title = t('eval.t.unsafe');
      d.safety -= 16 + 3 * (majors.length - 1); d.reputation -= 6; d.satisfaction -= 6;
      for (const m of majors) N.push(m.known ? m.msg : t('eval.n.notAskedAbout', { msg: m.msg, q: Q_LABEL[m.cat] || m.cat }));
    } else {
      const accept = correct.type === 'dispense' ? correct.accept : [];
      const alsoAcc = also?.type === 'dispense' ? also.accept : [];
      const best = decision.products.some((p) => matchesAccept(p, accept));
      const ok = decision.products.some((p) => matchesAccept(p, alsoAcc));
      const extraItems = decision.products.filter((p) => !matchesAccept(p, [...accept, ...alsoAcc]));
      if (best) { grade = 'excellent'; title = t('eval.t.safe'); d.safety += 9; d.satisfaction += 10; d.reputation += 4; d.xp += 60; }
      else if (ok) { grade = 'good'; title = t('eval.t.acceptable'); d.safety += 5; d.satisfaction += 5; d.reputation += 2; d.xp += 35; N.push(t('eval.n.better')); }
      else if (correct.type === 'advise') { grade = 'poor'; title = t('eval.t.notNeeded'); d.safety -= 4; d.satisfaction -= 3; d.xp += 10; N.push(t('eval.n.advice')); }
      else { grade = 'poor'; title = t('eval.t.notAppropriate'); d.safety -= 5; d.satisfaction -= 10; d.reputation -= 3; d.xp += 5; N.push(t('eval.n.wrongProduct')); }
      for (const c of cautions) { d.safety -= 3; N.push(t('eval.n.caution', { msg: c.msg })); if (grade === 'excellent') grade = 'good'; }
      if (extraItems.length && (best || ok)) { d.satisfaction -= 3 * extraItems.length; N.push(t('eval.n.unnecessary', { list: extraItems.map((p) => p.brand).join(', ') })); }
      const total = decision.products.reduce((s, p) => s + p.price, 0);
      if (total > scn.budget * 1.3) { d.satisfaction -= 4; N.push(t('eval.n.budget', { total: fmtMoney(total), budget: fmtMoney(scn.budget) })); }
      else if ((best || ok) && decision.products.some((p) => p.isGeneric)) { d.satisfaction += 2; N.push(t('eval.n.generic')); }
      if (extra.requested && (best || ok) && !decision.products.some((p) => p.id === extra.requested.id)) { N.push(t('eval.n.alt')); extra.genericAlt = true; }
    }
  } else if (decision.type === 'refer') {
    if (correct.type === 'refer') {
      if (emergency && decision.urgency !== 'emergency') { grade = 'good'; title = t('eval.t.underTriaged'); d.safety += 4; d.xp += 30; N.push(t('eval.n.underTriaged')); }
      else { grade = 'excellent'; title = t(emergency ? 'eval.t.emergencyOk' : 'eval.t.referralOk'); d.safety += emergency ? 14 : 11; d.satisfaction += 6; d.reputation += 6; d.xp += emergency ? 90 : 70; if (emergency) extra.lifeSaver = true; }
    } else if (also?.type === 'refer') { grade = 'good'; title = t('eval.t.safeReferral'); d.safety += 6; d.satisfaction += 2; d.xp += 40; }
    else {
      grade = 'ok'; title = t('eval.t.referralNo'); d.safety += 2; d.satisfaction -= 6; d.reputation -= 1; d.xp += 15;
      N.push(t('eval.n.referralNo'));
      if (decision.urgency === 'emergency') { d.satisfaction -= 8; d.reputation -= 2; N.push(t('eval.n.emergencyMinor')); }
    }
  } else if (decision.type === 'advise') {
    if (correct.type === 'advise') { grade = 'excellent'; title = t('eval.t.goodAdvice'); d.safety += 9; d.satisfaction += 8; d.reputation += 4; d.xp += 60; }
    else if (also?.type === 'advise') { grade = 'good'; title = t('eval.t.reasonableAdvice'); d.safety += 5; d.satisfaction += 3; d.xp += 35; }
    else if (correct.type === 'refer') { grade = 'dangerous'; safe = false; title = t(emergency ? 'eval.t.missedEmergency' : 'eval.t.missedReferral'); d.safety -= emergency ? 24 : 15; d.reputation -= 6; N.push(t('eval.n.needReferral')); }
    else { grade = 'poor'; title = t('eval.t.noHelp'); d.satisfaction -= 8; d.reputation -= 2; d.xp += 10; N.push(t('eval.n.otcAvailable')); }
  }

  if (safe && missed.length && grade !== 'dangerous') {
    d.safety -= 3 * missed.length;
    N.push(t('eval.n.keyMissed', { list: missed.map((k) => Q_LABEL[k]).join(', ') }));
    if (grade === 'excellent') grade = 'good';
  }
  if (extra.counselCorrect === true) { d.xp += 15; d.satisfaction += 3; }
  else if (extra.counselCorrect === false) { d.safety -= 5; d.satisfaction -= 3; N.push(t('eval.n.badCounsel')); }
  if (asked.size >= 6) extra.detective = true;

  const learn = scn.learning;
  return { grade, title, safe, deltas: d, notes: N, learning: learn, extra };
}

export const GRADE_STYLE = {
  excellent: { label: 'EXCELLENT', tone: 'good', icon: 'check' },
  good: { label: 'GOOD', tone: 'good', icon: 'check' },
  ok: { label: 'SAFE', tone: 'warn', icon: 'info' },
  poor: { label: 'NEEDS IMPROVEMENT', tone: 'warn', icon: 'alert' },
  unsafe: { label: 'UNSAFE', tone: 'bad', icon: 'x' },
  dangerous: { label: 'DANGEROUS', tone: 'bad', icon: 'x' },
};

export { pick };
