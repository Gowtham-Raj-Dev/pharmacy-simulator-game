// Language core.
//  - t(key, vars): UI strings. English is the fallback for any missing key.
//  - Languages: 'en' (English), 'ta' (Tamil), 'bi' (Tamil + English together).
//  - In 'bi' mode t() returns a String object carrying the English text in `.en`.
//    The DOM helper h() renders such values as two lines (Tamil, then English).
//    Any string concatenation gracefully degrades to Tamil only.
import { EN } from './en.js';

let lang = 'en';
const dicts = { en: EN, ta: {} };
const listeners = new Set();
export const LANGS = ['en', 'ta', 'bi'];

export function registerDict(code, dict) { dicts[code] = Object.assign(dicts[code] || {}, dict); }
export function getLang() { return lang; }
/** Tamil content active (Tamil-only or bilingual) */
export function isTA() { return lang === 'ta' || lang === 'bi'; }
export function isBi() { return lang === 'bi'; }
export function onLangChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

/** Combine a Tamil and an English string for bilingual mode. */
export function bi(ta, en) {
  if (ta == null || ta === '') return en;
  if (en == null || String(ta) === String(en)) return String(ta);
  const s = new String(ta); s.en = String(en); return s;
}
/** Apply a string transform to both halves of a (possibly bilingual) string. */
export function mapBi(s, fn) {
  if (s instanceof String && s.en != null) return bi(fn(String(s)), fn(s.en));
  return fn(s == null ? '' : String(s));
}
/** English half of a (possibly bilingual) value */
export const enOf = (s) => (s instanceof String && s.en != null ? s.en : s);

function fill(s, vars, half) {
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (m, k) => {
    const v = vars[k];
    if (v == null) return m;
    return half === 'en' && v instanceof String && v.en != null ? v.en : String(v);
  });
}

export function t(key, vars) {
  const en = EN[key];
  if (lang === 'en') return en == null ? key : fill(en, vars, 'en');
  const ta = dicts.ta[key] ?? en;
  if (ta == null) return key;
  if (lang === 'ta') return fill(ta, vars, 'ta');
  return bi(fill(ta, vars, 'ta'), en == null ? null : fill(en, vars, 'en'));
}
/** Plain (single-language) version of t(): Tamil in 'ta' and 'bi', for tight spots such as tiny buttons, canvas and speech. */
export function tp(key, vars) { return String(t(key, vars)); }
/** Pick a localized value from an {en, ta} pair */
export const pickL = (o) => {
  if (o == null) return '';
  if (typeof o === 'string' || o instanceof String) return o;
  if (lang === 'en') return o.en;
  if (lang === 'ta') return o.ta ?? o.en;
  return bi(o.ta, o.en);
};

export function setLang(code) {
  if (!LANGS.includes(code)) code = 'en';
  lang = code;
  document.documentElement.lang = code === 'en' ? 'en' : 'ta';
  document.documentElement.classList.toggle('lang-ta', code !== 'en');
  document.documentElement.classList.toggle('lang-bi', code === 'bi');
  for (const fn of listeners) { try { fn(code); } catch (e) { console.error(e); } }
}
