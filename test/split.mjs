// Split the English content JSONs into ~12 KB parts for parallel translation.
import fs from 'fs';
const dir = 'src/i18n/en/', out = 'src/i18n/parts/en/';
const LIMIT = 12500;
const manifest = {};
for (const f of fs.readdirSync(dir)) {
  const base = f.replace('.json', '');
  const obj = JSON.parse(fs.readFileSync(dir + f, 'utf8'));
  let parts = [], cur = {}, size = 0;
  const entries = base === 'misc'
    ? Object.entries(obj).flatMap(([k, v]) => k === 'symptoms' ? [[k + '#0', v.slice(0, 16)], [k + '#1', v.slice(16)]] : [[k, v]])
    : Object.entries(obj).flatMap(([k, v]) => (base === 'questions' || base === 'phrases') && typeof v === 'object' && !Array.isArray(v) && JSON.stringify(v).length > LIMIT
      ? chunkObj(v).map((c, i) => [k + '#' + i, c]) : [[k, v]]);
  for (const [k, v] of entries) {
    const s = JSON.stringify(v).length;
    if (size + s > LIMIT && Object.keys(cur).length) { parts.push(cur); cur = {}; size = 0; }
    cur[k] = v; size += s;
  }
  if (Object.keys(cur).length) parts.push(cur);
  parts.forEach((p, i) => { const n = `${base}.${i + 1}.json`; fs.writeFileSync(out + n, JSON.stringify(p, null, 1)); manifest[n] = Buffer.byteLength(JSON.stringify(p)); });
}
function chunkObj(v) { const res = []; let c = {}, s = 0; for (const [k, x] of Object.entries(v)) { const l = JSON.stringify(x).length; if (s + l > LIMIT && Object.keys(c).length) { res.push(c); c = {}; s = 0; } c[k] = x; s += l; } if (Object.keys(c).length) res.push(c); return res; }
console.log(manifest);
