// Usage: node test/validate-ta.mjs <en.json> <ta.json>
// Checks: identical keys, identical array lengths (except "keywords"), placeholders kept, Tamil present.
import fs from 'fs';
const [a, b] = process.argv.slice(2);
const en = JSON.parse(fs.readFileSync(a, 'utf8'));
let ta;
try { ta = JSON.parse(fs.readFileSync(b, 'utf8')); } catch (e) { console.log('INVALID JSON:', e.message); process.exit(1); }
const errs = []; let strings = 0, tamil = 0;
const TA = /[஀-௿]/;
function walk(x, y, path) {
  if (typeof x === 'string') {
    if (typeof y !== 'string' || !y.trim()) return errs.push(path + ': missing/empty');
    strings++; if (TA.test(y)) tamil++;
    const ph = (s) => (s.match(/\{\w+\}/g) || []).sort().join();
    if (ph(x) !== ph(y)) errs.push(path + ': placeholders differ ' + ph(x) + ' vs ' + ph(y));
    return;
  }
  if (Array.isArray(x)) {
    if (!Array.isArray(y)) return errs.push(path + ': not array');
    if (!path.endsWith('keywords') && x.length !== y.length) errs.push(path + `: length ${x.length} vs ${y.length}`);
    if (path.endsWith('keywords')) { if (!y.length) errs.push(path + ': empty'); return; }
    x.forEach((v, i) => walk(v, y[i], path + '[' + i + ']'));
    return;
  }
  if (x && typeof x === 'object') {
    if (!y || typeof y !== 'object') return errs.push(path + ': not object');
    for (const k of Object.keys(x)) { if (!(k in y)) errs.push(path + '.' + k + ': missing key'); else walk(x[k], y[k], path + '.' + k); }
    for (const k of Object.keys(y)) if (!(k in x)) errs.push(path + '.' + k + ': extra key');
  }
}
walk(en, ta, '$');
console.log(errs.length ? errs.slice(0, 40).join('\n') : 'STRUCTURE OK', `\nstrings ${strings}, with Tamil script ${tamil} (${Math.round(100 * tamil / Math.max(1, strings))}%)`);
process.exit(errs.length ? 1 : 0);
