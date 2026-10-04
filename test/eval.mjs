import { buildCatalog } from '../src/data/products.js';
import { SCENARIOS } from '../src/data/scenarios.js';
import { evaluate, matchesAccept, productIssues } from '../src/data/../systems/evaluation.js';
const cat = buildCatalog();
const all = new Set(['duration','symptoms','allergies','meds','history','lifestyle']);
let problems = 0;
for (const s of SCENARIOS) {
  const c = s.correct;
  if (c.type === 'dispense') {
    const cands = cat.filter(p => matchesAccept(p, c.accept) && p.stock > 0 && !p.expired && (p.status !== 'Rx' || s.prescription));
    const safe = cands.filter(p => productIssues([p], s, all).filter(i=>i.sev==='major').length === 0);
    const r = safe.length ? evaluate({type:'dispense', products:[safe[0]]}, s, all, {counselCorrect:true}) : null;
    if (!safe.length || r.grade !== 'excellent') { problems++; console.log('PROBLEM', s.id, s.title, 'cands', cands.length, 'safe', safe.length, r && r.grade, r && r.notes); }
  } else {
    const r = evaluate({type:c.type, urgency:c.urgency, products:[]}, s, all, {counselCorrect:true});
    if (r.grade !== 'excellent') { problems++; console.log('PROBLEM', s.id, r.grade, r.notes); }
  }
}
// trap checks
const byId = Object.fromEntries(SCENARIOS.map(s=>[s.id,s]));
const ibu = cat.find(p=>p.baseKey==='ibuprofen' && p.form==='Tablet' && !p.expired);
const asp = cat.find(p=>p.baseKey==='aspirin' && p.strength.startsWith('300') && !p.expired);
const chl = cat.find(p=>p.baseKey==='chlorphenamine' && p.form==='Tablet' && !p.expired);
const sugarDex = cat.find(p=>p.baseKey==='dextromethorphan' && p.flags.includes('contains_sugar') && !p.expired);
const coldCombo = cat.find(p=>p.baseKey==='coldCombo' && !p.expired);
const amox = cat.find(p=>p.baseKey==='amoxicillin' && !p.expired);
const t = (id, p, asked=all) => { const r = evaluate({type:'dispense', products:[p]}, byId[id], asked, {}); console.log(id, p.name, '→', r.grade, '|', r.notes[0]); };
t('S23', ibu); t('S24', ibu); t('S28', asp); t('S27', chl); t('S26', sugarDex); t('S53', coldCombo); t('S44', amox); t('S30', ibu); t('S39', cat.find(p=>p.baseKey==='antacid'));
t('S23', ibu, new Set(['symptoms']));
console.log('problems', problems);
