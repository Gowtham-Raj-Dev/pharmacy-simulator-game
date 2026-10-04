import fs from 'fs';
const txt = fs.readFileSync('/tmp/claude-0/mh/base.obj', 'utf8').split('\n');
const V = []; let g = ''; const groups = {}; let nf = 0, quads = 0;
for (const l of txt) {
  if (l.startsWith('v ')) { const [, x, y, z] = l.split(/\s+/); V.push([+x, +y, +z]); }
  else if (l.startsWith('g ')) g = l.slice(2).trim();
  else if (l.startsWith('f ')) { const p = l.trim().split(/\s+/).slice(1).map((s) => +s.split('/')[0] - 1); (groups[g] ||= { f: 0, v: new Set() }); groups[g].f++; p.forEach((i) => groups[g].v.add(i)); nf++; if (p.length === 4) quads++; }
}
console.log('verts', V.length, 'faces', nf, 'quads', quads);
for (const [k, o] of Object.entries(groups)) if (!k.startsWith('joint')) {
  const vs = [...o.v]; const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9]; for (const i of vs) for (let a = 0; a < 3; a++) { mn[a] = Math.min(mn[a], V[i][a]); mx[a] = Math.max(mx[a], V[i][a]); }
  console.log(k.padEnd(24), 'faces', o.f, 'verts', vs.length, 'min', mn.map((x) => x.toFixed(2)).join(','), 'max', mx.map((x) => x.toFixed(2)).join(','));
}
console.log('joint groups', Object.keys(groups).filter((k) => k.startsWith('joint')).join(' '));
