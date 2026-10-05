// Lists every recorded dialogue line, in English and Tamil, with the voice that speaks it
// (src/data/voices.js) → tools/voice_items.json, which tools/generate_voices.py records.
//
//   node tools/voice-lines.mjs && python tools/generate_voices.py --prune
//
// The texts come from the game's own modules with the same language switching the game
// uses, so what a character says always matches the subtitle on screen.
import fs from 'node:fs';
import path from 'node:path';
import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// the game imports JSON without import attributes (Vite style): let Node load it the same way
register('data:text/javascript,' + encodeURIComponent(`
export async function load(url, ctx, next) {
  if (url.endsWith('.json')) return { format: 'json', source: (await import('node:fs')).readFileSync(new URL(url), 'utf8'), shortCircuit: true };
  return next(url, ctx);
}`));
globalThis.document = { documentElement: { classList: { toggle() {} } } };

const src = (p) => import(pathToFileURL(path.join(ROOT, 'src', p)).href);
const { setLang, tp } = await src('i18n/i18n.js');
const { initContent, applyContent } = await src('i18n/content.js');
const { buildCatalog } = await src('data/products.js');
const { SCENARIOS } = await src('data/scenarios.js');
const { counselClips } = await src('systems/evaluation.js');
const V = await src('data/voices.js');

const catalog = buildCatalog();
initContent(catalog);

// the spoken half of the dispensing explanation ("Crocin contains paracetamol. …" on screen):
// one recording per medicine base + one per "see a doctor if …" (see counselClips in evaluation.js)
const COUNSEL = {
  en: { base: 'This contains {gen}. {use} {warn}', when: 'Please see a doctor {when}.' },
  ta: { base: 'இதில் {gen} உள்ளது. {use} {warn}', when: '{when} மருத்துவரைப் பாருங்கள்.' },
};
const fill = (s, vars) => s.replace(/\{(\w+)\}/g, (m, k) => String(vars[k] ?? ''));
const clean = (s) => String(s).replace(/[“”"*★]/g, '').replace(/\s+/g, ' ').trim();

const items = [];
const say = (lang, id, voice, text) => { const tx = clean(text); if (tx) items.push({ id, lang, voice: voice[0], pitch: voice[1], rate: voice[2], text: tx }); };

for (const lang of ['en', 'ta']) {
  setLang(lang); applyContent(lang);
  const ph = V.fmt(V.PHARMACIST[lang]), ins = V.fmt(V.INSPECTOR[lang]);
  // customers: complaint + answers in their own voice
  const used = new Set();
  for (const s of SCENARIOS) {
    const vid = V.voiceOf(s), voice = V.voiceParams(vid, lang);
    used.add(vid);
    let complaint = String(s.complaint);
    if (complaint.includes('{BRAND}')) {
      // same product the game asks for (customers.js spawn → complaintFor)
      const req = s.request && catalog.find((p) => p.baseKey === s.request.baseKey && p.strength === s.request.strength && !p.isGeneric && p.form === 'Tablet');
      complaint = complaint.replace('{BRAND}', req ? String(req.name) : tp('cust.usualBrand'));
    }
    say(lang, s.id, voice, complaint);
    for (const k of V.ANSWER_KEYS) say(lang, `${s.id}_${k}`, voice, s.answers[k]);
  }
  const THX = { dispense: 'g.thxDispense', refer: 'g.thxRefer', advise: 'g.thxAdvise', emergency: 'g.thxEmergency', return: 'g.thxReturn' };
  for (const vid of [...used].sort()) for (const k of V.THANKS) say(lang, `thx_${k}_${vid}`, V.voiceParams(vid, lang), tp(THX[k]));
  // pharmacist: greeting, the six questions and every counselling line
  say(lang, 'g_hello', ph, tp('g.hello'));
  for (const k of V.ANSWER_KEYS) say(lang, `q_${k}`, ph, tp(`q.${k}.prompt`));
  for (const [id, key] of Object.entries(counselClips.fixed)) say(lang, id, ph, tp(key));
  for (const s of SCENARIOS) (s.adviceOptions || []).forEach((o, i) => say(lang, counselClips.advice(s, i), ph, o.text));
  const seen = new Set();
  for (const p of catalog) {
    if (seen.has(p.baseKey)) continue; seen.add(p.baseKey);
    say(lang, counselClips.base(p), ph, fill(COUNSEL[lang].base, { gen: String(p.generic).replace(/\s*\(.*?\)/g, ''), use: p.use, warn: p.warnings[0] || '' }));
  }
  for (const s of SCENARIOS) if (s.seeDoctor) say(lang, counselClips.when(s), ph, fill(COUNSEL[lang].when, { when: s.seeDoctor }));
  say(lang, counselClips.when({}), ph, fill(COUNSEL[lang].when, { when: tp('eval.persist') }));
  // inspector
  say(lang, 'insp_greeting', ins, tp('g.inspGreeting'));
  say(lang, 'insp_wrong', ins, tp('g.inspWrong'));
  say(lang, 'insp_pass', ins, tp('g.inspPass'));
}
setLang('en'); applyContent('en');

const ids = new Set();
for (const it of items) { const k = it.lang + '/' + it.id; if (ids.has(k)) throw new Error('duplicate clip ' + k); ids.add(k); }
fs.writeFileSync(path.join(ROOT, 'tools', 'voice_items.json'), JSON.stringify(items, null, 1) + '\n');
const per = (l) => items.filter((i) => i.lang === l).length;
console.log(`tools/voice_items.json: ${items.length} lines (en ${per('en')}, ta ${per('ta')}), ${new Set(items.map((i) => i.voice)).size} voices`);
