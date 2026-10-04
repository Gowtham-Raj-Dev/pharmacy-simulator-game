// Offline generator: builds a realistic, rigged human GLB from MakeHuman's CC0
// base mesh, macro targets (gender / age / muscle / weight / ethnicity), default
// skeleton and skin weights. Body variants are stored as morph targets with
// per-variant joint positions, so the game can blend endless different people
// from one compact file. Clothes, hair, lashes, teeth and tongue come from
// MakeHuman's fitted helper geometry; eyes are generated.
//
// Usage: node tools/gen-humans.mjs   (expects downloads in /tmp/claude-0/mh)
import fs from 'fs';
import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { quantize, prune, dedup } from '@gltf-transform/functions';

const DIR = '/tmp/claude-0/mh';
const OUT = 'src/assets/humans/people.glb';
const S = 0.1; // MakeHuman decimetres → metres

// ── OBJ ──
const lines = fs.readFileSync(`${DIR}/base.obj`, 'utf8').split('\n');
const V0 = []; const faces = []; let grp = '';
for (const l of lines) {
  if (l.startsWith('v ')) { const p = l.trim().split(/\s+/); V0.push(+p[1], +p[2], +p[3]); }
  else if (l.startsWith('g ')) grp = l.slice(2).trim();
  else if (l.startsWith('f ')) faces.push({ g: grp, v: l.trim().split(/\s+/).slice(1).map((s) => +s.split('/')[0] - 1) });
}
const NV = V0.length / 3;
const base = Float64Array.from(V0);

// ── targets ──
const tcache = new Map();
function target(name) {
  if (tcache.has(name)) return tcache.get(name);
  const f = `${DIR}/targets/${name}`;
  let t = null;
  if (fs.existsSync(f)) {
    const idx = [], d = [];
    for (const l of fs.readFileSync(f, 'utf8').split('\n')) { if (!l || l[0] === '#') continue; const p = l.trim().split(/\s+/); if (p.length < 4) continue; idx.push(+p[0]); d.push(+p[1], +p[2], +p[3]); }
    if (idx.length) t = { idx: Int32Array.from(idx), d: Float32Array.from(d) };
  }
  tcache.set(name, t);
  return t;
}
const ageW = (a) => (a < 0.1875 ? { baby: 1 - a / 0.1875, child: a / 0.1875 } : a < 0.5 ? { child: 1 - (a - 0.1875) / 0.3125, young: (a - 0.1875) / 0.3125 } : { young: 1 - (a - 0.5) / 0.5, old: (a - 0.5) / 0.5 });
const tri = (v, lo, mid, hi) => (v < 0.5 ? { [lo]: 1 - v / 0.5, [mid]: v / 0.5 } : { [mid]: 1 - (v - 0.5) / 0.5, [hi]: (v - 0.5) / 0.5 });
function shape({ g, a, m, w, race }) {
  const P = Float64Array.from(base);
  const G = { female: 1 - g, male: g }, A = ageW(a), M = tri(m, 'minmuscle', 'averagemuscle', 'maxmuscle'), W = tri(w, 'minweight', 'averageweight', 'maxweight');
  const apply = (name, k) => { if (k < 1e-4) return; const t = target(name); if (!t) return; for (let i = 0; i < t.idx.length; i++) { const j = t.idx[i] * 3; P[j] += t.d[i * 3] * k; P[j + 1] += t.d[i * 3 + 1] * k; P[j + 2] += t.d[i * 3 + 2] * k; } };
  for (const [gk, gw] of Object.entries(G)) for (const [ak, aw] of Object.entries(A)) {
    for (const [r, rw] of Object.entries(race)) apply(`${r}-${gk}-${ak}.target`, rw * gw * aw);
    for (const [mk, mw] of Object.entries(M)) for (const [wk, ww] of Object.entries(W)) apply(`universal-${gk}-${ak}-${mk}-${wk}.target`, gw * aw * mw * ww);
  }
  return P;
}

// ── skeleton ──
const skel = JSON.parse(fs.readFileSync(`${DIR}/default.mhskel`, 'utf8'));
const mhw = JSON.parse(fs.readFileSync(`${DIR}/default_weights.mhw`, 'utf8')).weights;
const KEEP = {
  root: 'Hips', spine05: 'Spine', spine03: 'Spine1', spine01: 'Spine2', neck01: 'Neck', head: 'Head', jaw: 'Jaw',
  'clavicle.L': 'LeftShoulder', 'upperarm01.L': 'LeftArm', 'lowerarm01.L': 'LeftForeArm', 'wrist.L': 'LeftHand',
  'clavicle.R': 'RightShoulder', 'upperarm01.R': 'RightArm', 'lowerarm01.R': 'RightForeArm', 'wrist.R': 'RightHand',
  'upperleg01.L': 'LeftUpLeg', 'lowerleg01.L': 'LeftLeg', 'foot.L': 'LeftFoot',
  'upperleg01.R': 'RightUpLeg', 'lowerleg01.R': 'RightLeg', 'foot.R': 'RightFoot',
};
const SPECIAL = { 'shoulder01.L': 'LeftArm', 'shoulder01.R': 'RightArm', 'breast.L': 'Spine2', 'breast.R': 'Spine2' };
const OUTB = ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head', 'Jaw', 'LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand', 'RightShoulder', 'RightArm', 'RightForeArm', 'RightHand', 'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'RightUpLeg', 'RightLeg', 'RightFoot'];
const OUT_PARENT = { Hips: null, Spine: 'Hips', Spine1: 'Spine', Spine2: 'Spine1', Neck: 'Spine2', Head: 'Neck', Jaw: 'Head', LeftShoulder: 'Spine2', LeftArm: 'LeftShoulder', LeftForeArm: 'LeftArm', LeftHand: 'LeftForeArm', RightShoulder: 'Spine2', RightArm: 'RightShoulder', RightForeArm: 'RightArm', RightHand: 'RightForeArm', LeftUpLeg: 'Hips', LeftLeg: 'LeftUpLeg', LeftFoot: 'LeftLeg', RightUpLeg: 'Hips', RightLeg: 'RightUpLeg', RightFoot: 'RightLeg' };
const OUT_MH = Object.fromEntries(Object.entries(KEEP).map(([a, b]) => [b, a]));
const outOf = (mh) => { if (SPECIAL[mh]) return SPECIAL[mh]; let b = mh; while (b) { if (KEEP[b]) return KEEP[b]; b = skel.bones[b]?.parent; } return 'Hips'; };
const centroid = (P, list) => { let x = 0, y = 0, z = 0; for (const i of list) { x += P[i * 3]; y += P[i * 3 + 1]; z += P[i * 3 + 2]; } const n = list.length; return [x / n, y / n, z / n]; };
const jointPos = (P, jn) => centroid(P, skel.joints[jn]);

// per-vertex output weights (top 4)
const BI = Object.fromEntries(OUTB.map((b, i) => [b, i]));
const acc = Array.from({ length: NV }, () => new Map());
for (const [mh, list] of Object.entries(mhw)) { const ob = BI[outOf(mh)]; for (const [v, w] of list) acc[v].set(ob, (acc[v].get(ob) || 0) + w); }
const vJ = new Uint8Array(NV * 4), vW = new Float32Array(NV * 4), dom = new Int16Array(NV).fill(-1);
for (let v = 0; v < NV; v++) {
  const e = [...acc[v].entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  const s = e.reduce((a, x) => a + x[1], 0) || 1;
  e.forEach(([b, w], k) => { vJ[v * 4 + k] = b; vW[v * 4 + k] = w / s; });
  if (e.length) dom[v] = e[0][0]; else { vJ[v * 4] = BI.Hips; vW[v * 4] = 1; }
}
const oris = new Float32Array(NV);
for (const [mh, list] of Object.entries(mhw)) if (/^oris/.test(mh)) for (const [v, w] of list) oris[v] += w;

// ── variants ──
const RACE = { caucasian: 0.5, african: 0.28, asian: 0.22 };
const VARIANTS = [
  ['F_young', { g: 0, a: 0.5, m: 0.5, w: 0.5 }], ['M_young', { g: 1, a: 0.5, m: 0.55, w: 0.5 }], ['M_heavy', { g: 1, a: 0.62, m: 0.5, w: 0.95 }],
  ['M_old', { g: 1, a: 0.86, m: 0.35, w: 0.62 }], ['F_heavy', { g: 0, a: 0.6, m: 0.45, w: 0.92 }], ['F_old', { g: 0, a: 0.86, m: 0.35, w: 0.6 }],
  ['M_child', { g: 1, a: 0.16, m: 0.5, w: 0.5 }], ['F_child', { g: 0, a: 0.16, m: 0.5, w: 0.5 }], ['M_slim', { g: 1, a: 0.44, m: 0.62, w: 0.22 }], ['F_slim', { g: 0, a: 0.42, m: 0.5, w: 0.2 }],
];

// ── faces → material groups ──
const USE = new Set(['body', 'helper-tights', 'helper-skirt', 'helper-upper-teeth', 'helper-lower-teeth', 'helper-tongue', 'helper-l-eyelashes-1', 'helper-l-eyelashes-2', 'helper-r-eyelashes-1', 'helper-r-eyelashes-2']);
const B = (n) => BI[n];
const TOP = new Set([B('Spine'), B('Spine1'), B('Spine2'), B('Neck'), B('LeftShoulder'), B('RightShoulder'), B('LeftArm'), B('RightArm')]);
const SLEEVE = new Set([B('LeftForeArm'), B('RightForeArm'), B('LeftHand'), B('RightHand')]);
const PANTS = new Set([B('Hips'), B('LeftUpLeg'), B('RightUpLeg')]);
const FEET = new Set([B('LeftFoot'), B('RightFoot')]);
const majority = (vs) => { const c = new Map(); for (const v of vs) c.set(dom[v], (c.get(dom[v]) || 0) + 1); return [...c.entries()].sort((a, b) => b[1] - a[1])[0][0]; };
const P0 = shape({ ...VARIANTS[0][1], race: RACE });
const ankleY = (jointPos(P0, skel.bones['foot.L'].head)[1]);
const neckY = jointPos(P0, skel.bones['neck01'].head)[1];
const J0 = (b) => jointPos(P0, skel.bones[b].head);
const waistY = J0('spine05')[1] + 0.12, kneeY = J0('lowerleg01.L')[1], elbowX = Math.abs(J0('lowerarm01.L')[0]);
const eyeC = centroid(P0, [...new Set(faces.filter((f) => f.g === 'helper-l-eye').flatMap((f) => f.v))]);
const headZ = J0('head')[2];
const ARM = new Set([B('LeftShoulder'), B('RightShoulder'), B('LeftArm'), B('RightArm'), B('LeftForeArm'), B('RightForeArm'), B('LeftHand'), B('RightHand')]);
const cen = (f, k) => f.v.reduce((a, v) => a + P0[v * 3 + k], 0) / f.v.length;
const hairKeep = (v) => { const y = P0[v * 3 + 1], z = P0[v * 3 + 2]; return !(z > eyeC[2] - 0.6 && y < eyeC[1] + 0.62) && !(z > eyeC[2] - 1.05 && y < eyeC[1] - 0.15); };
const matOf = (f) => {
  if (f.g === 'body') { const d = majority(f.v); return FEET.has(d) && cen(f, 1) < ankleY + 0.25 ? 'shoes' : 'skin'; }
  if (f.g === 'helper-tights') {
    const cx = Math.abs(cen(f, 0)), cy = cen(f, 1);
    if (ARM.has(majority(f.v)) && cx > 1.1) return cx > elbowX - 0.1 ? 'sleeve' : 'top';
    return cy > waistY ? 'top' : cy > kneeY - 0.35 ? 'pants' : 'pantsLow';
  }
  if (f.g === 'helper-skirt') return 'skirt';
  if (f.g === 'helper-hair') {
    if (!f.v.every(hairKeep)) return null;
    if (f.v.every((v) => P0[v * 3 + 1] > neckY + 0.15)) return 'hair';
    return cen(f, 2) < headZ - 0.15 ? 'hairLong' : null;
  }
  if (f.g.includes('teeth')) return 'teeth';
  if (f.g === 'helper-tongue') return 'tongue';
  if (f.g.includes('eyelashes')) return 'lashes';
  return null;
};
const MATS = ['skin', 'shoes', 'top', 'sleeve', 'pants', 'pantsLow', 'skirt', 'hair', 'hairLong', 'teeth', 'tongue', 'lashes', 'eyes'];
const tris = Object.fromEntries(MATS.map((m) => [m, []]));
const used = new Set();
const OFFSET = { top: 0.085, sleeve: 0.085, pants: 0.07, pantsLow: 0.045, skirt: 0.18 };
const vOff = new Float32Array(NV);
for (const f of faces) {
  if (!USE.has(f.g)) continue;
  const m = matOf(f); if (!m) continue;
  const [a, b, c, d] = f.v;
  tris[m].push(a, b, c); if (d != null) tris[m].push(a, c, d);
  for (const v of f.v) { used.add(v); if (OFFSET[m]) vOff[v] = Math.max(vOff[v], OFFSET[m]); }
}
// shoes: slightly inflated feet
for (const f of faces) if (f.g === 'body' && matOf(f) === 'shoes') for (const v of f.v) vOff[v] = Math.max(vOff[v], 0.035);

// compact vertex list
const map = new Int32Array(NV).fill(-1); const order = [];
for (let v = 0; v < NV; v++) if (used.has(v)) { map[v] = order.length; order.push(v); }
// generated eyes (sphere per eye, placed per variant on the helper-eye centroid)
const eyeHelpers = { L: [], R: [] };
for (const f of faces) { if (f.g === 'helper-l-eye') eyeHelpers.L.push(...f.v); if (f.g === 'helper-r-eye') eyeHelpers.R.push(...f.v); }
for (const k of ['L', 'R']) eyeHelpers[k] = [...new Set(eyeHelpers[k])];
const EW = 28, EH = 20;
const eyeUnit = []; for (let j = 0; j <= EH; j++) for (let i = 0; i <= EW; i++) { const th = (j / EH) * Math.PI, ph = (i / EW) * Math.PI * 2; eyeUnit.push(Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph)); }
const eyeTris = []; for (let j = 0; j < EH; j++) for (let i = 0; i < EW; i++) { const a = j * (EW + 1) + i, b = a + EW + 1; eyeTris.push(a, b, a + 1, b, b + 1, a + 1); }
// ── hair: cap generated from the scalp skin (exact head shape) + optional nape/back layer ──
const napeY = eyeC[1] - 0.62, neckBaseY = J0('neck01')[1];
const hairKeep2 = (v) => { const y = P0[v * 3 + 1], z = P0[v * 3 + 2]; return !(z > eyeC[2] - 0.6 && y < eyeC[1] + 0.5) && !(z > eyeC[2] - 1.05 && y < eyeC[1] - 0.1); };
const scalp = (v) => { const x = P0[v * 3], y = P0[v * 3 + 1]; return dom[v] === B('Head') && hairKeep2(v) && y > napeY && !(Math.abs(x) > 0.64 && y < eyeC[1] + 0.36); };
const backV = (v) => { const y = P0[v * 3 + 1], z = P0[v * 3 + 2]; return (dom[v] === B('Head') || dom[v] === B('Neck')) && z < headZ - 0.22 && y <= napeY + 0.05 && y > neckBaseY - 0.25; };
const capF = [], longF = [];
for (const f of faces) { if (f.g !== 'body') continue; if (f.v.filter(scalp).length >= 2) capF.push(f.v); else if (f.v.every((v) => backV(v) || scalp(v)) && f.v.some(backV)) longF.push(f.v); }
const hairList = [...new Set([...capF.flat(), ...longF.flat()])];
const hairIdx = new Map(hairList.map((v, i) => [v, i]));
// offset: thin at the hairline, fuller inside; long layer grows downwards
const edgeCount = new Map();
for (const fv of capF) for (let i = 0; i < fv.length; i++) { const a = fv[i], b = fv[(i + 1) % fv.length], k = a < b ? a + '_' + b : b + '_' + a; edgeCount.set(k, (edgeCount.get(k) || 0) + 1); }
const adj = new Map(); for (const fv of capF) for (const a of fv) for (const b of fv) if (a !== b) { if (!adj.has(a)) adj.set(a, new Set()); adj.get(a).add(b); }
const steps = new Map(); const q = [];
for (const [k, c] of edgeCount) if (c === 1) for (const v of k.split('_').map(Number)) if (!steps.has(v)) { steps.set(v, 0); q.push(v); }
while (q.length) { const v = q.shift(); for (const u of adj.get(v) || []) if (!steps.has(u)) { steps.set(u, steps.get(v) + 1); q.push(u); } }
const inCap = new Set(capF.flat());
const hairOff = hairList.map((v) => { const y = P0[v * 3 + 1]; if (!inCap.has(v)) return 0.09 + 0.22 * Math.min(1, Math.max(0, (napeY - y) / 1.1)); const st = steps.get(v) ?? 4; return [0.0, 0.035, 0.065, 0.09][Math.min(3, st)] + (st >= 4 ? 0.015 : 0); });
const hairEdge = hairList.map((v) => { if (!inCap.has(v)) return 0; const st = steps.get(v) ?? 4; return st === 0 ? 1 : st === 1 ? 0.45 : 0; });
const NB = order.length, NE = eyeUnit.length / 3, NH = hairList.length, HB = NB + NE * 2, NT = HB + NH;
for (const fv of capF) { const [a, b, c, d] = fv.map((v) => HB + hairIdx.get(v)); tris.hair.push(a, b, c); if (d != null) tris.hair.push(a, c, d); }
for (const fv of longF) { const [a, b, c, d] = fv.map((v) => HB + hairIdx.get(v)); tris.hairLong.push(a, b, c); if (d != null) tris.hairLong.push(a, c, d); }
for (let e = 0; e < 2; e++) for (let i = 0; i < eyeTris.length; i += 3) tris.eyes.push(NB + e * NE + eyeTris[i], NB + e * NE + eyeTris[i + 2], NB + e * NE + eyeTris[i + 1]);
for (const m of MATS) if (m !== 'eyes' && m !== 'hair' && m !== 'hairLong') tris[m] = tris[m].map((v) => map[v]);

// ── per-variant geometry ──
function normals(pos) {
  const n = new Float32Array(NT * 3);
  for (const m of MATS) { const t = tris[m]; for (let i = 0; i < t.length; i += 3) {
    const a = t[i] * 3, b = t[i + 1] * 3, c = t[i + 2] * 3;
    const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2], vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    for (const k of [a, b, c]) { n[k] += nx; n[k + 1] += ny; n[k + 2] += nz; }
  } }
  for (let i = 0; i < NT; i++) { const l = Math.hypot(n[i * 3], n[i * 3 + 1], n[i * 3 + 2]) || 1; n[i * 3] /= l; n[i * 3 + 1] /= l; n[i * 3 + 2] /= l; }
  return n;
}
const groundJoint = Object.keys(skel.joints).find((j) => /ground/.test(j));
function buildVariant(params) {
  const P = shape({ ...params, race: RACE });
  const gy = groundJoint ? jointPos(P, groundJoint)[1] : Math.min(...order.map((v) => P[v * 3 + 1]));
  const pos = new Float32Array(NT * 3);
  for (let i = 0; i < NB; i++) { const v = order[i]; pos[i * 3] = P[v * 3]; pos[i * 3 + 1] = P[v * 3 + 1] - gy; pos[i * 3 + 2] = P[v * 3 + 2]; }
  // eyes
  ['L', 'R'].forEach((k, e) => {
    const c = centroid(P, eyeHelpers[k]); c[1] -= gy;
    let r = 0; for (const v of eyeHelpers[k]) r += Math.hypot(P[v * 3] - c[0], P[v * 3 + 1] - gy - c[1], P[v * 3 + 2] - c[2]); r /= eyeHelpers[k].length;
    for (let i = 0; i < NE; i++) { const o = (NB + e * NE + i) * 3; pos[o] = c[0] + eyeUnit[i * 3] * r; pos[o + 1] = c[1] + eyeUnit[i * 3 + 1] * r; pos[o + 2] = c[2] + eyeUnit[i * 3 + 2] * r * 0.98; }
  });
  for (let i = 0; i < NH; i++) { const v = hairList[i], o = (HB + i) * 3; pos[o] = P[v * 3]; pos[o + 1] = P[v * 3 + 1] - gy; pos[o + 2] = P[v * 3 + 2]; }
  // offsets along normals (clothes / hair / shoes)
  const n0 = normals(pos);
  for (let i = 0; i < NH; i++) { const o = (HB + i) * 3, k = hairOff[i]; pos[o] += n0[o] * k; pos[o + 1] += n0[o + 1] * k; pos[o + 2] += n0[o + 2] * k; }
  for (let i = 0; i < NB; i++) { const o = vOff[order[i]]; if (o) { pos[i * 3] += n0[i * 3] * o; pos[i * 3 + 1] += n0[i * 3 + 1] * o; pos[i * 3 + 2] += n0[i * 3 + 2] * o; } }
  for (let i = 0; i < pos.length; i++) pos[i] *= S;
  const nrm = normals(pos);
  const joints = {};
  for (const b of OUTB) { const j = jointPos(P, skel.bones[OUT_MH[b]].head); joints[b] = [j[0] * S, (j[1] - gy) * S, j[2] * S]; }
  let top = 0; for (let i = 0; i < NT; i++) top = Math.max(top, pos[i * 3 + 1]);
  return { pos, nrm, joints, height: top, gy };
}
const vars = VARIANTS.map(([name, p]) => ({ name, params: p, ...buildVariant(p) }));
console.log('variants', vars.map((v) => `${v.name}:${v.height.toFixed(2)}m`).join(' '));

// ── vertex masks (base variant): R lips · G brows · B cheeks · A cavity / eyes: R iris · G pupil · B limbus ──
const col = new Uint8Array(NT * 4);
{
  const pos = vars[0].pos, nrm = vars[0].nrm;
  const jp = (jn) => { const j = jointPos(P0, jn); return [j[0] * S, (j[1] - vars[0].gy) * S, j[2] * S]; };
  const eyeL = jp(Object.keys(skel.joints).find((j) => j === 'eye.L____head') || 'eye.L____head');
  const eyeR = jp('eye.R____head');
  // neighbours for cavity
  const nb = Array.from({ length: NB }, () => new Set());
  for (const m of MATS) if (m === 'skin' || m === 'shoes') { const t = tris[m]; for (let i = 0; i < t.length; i += 3) { const a = t[i], b = t[i + 1], c = t[i + 2]; nb[a].add(b).add(c); nb[b].add(a).add(c); nb[c].add(a).add(b); } }
  const skinV = new Set([...tris.skin]);
  for (const i of skinV) {
    const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
    // cavity
    let ax = 0, ay = 0, az = 0, el = 0; for (const j of nb[i]) { ax += pos[j * 3]; ay += pos[j * 3 + 1]; az += pos[j * 3 + 2]; el += Math.hypot(pos[j * 3] - x, pos[j * 3 + 1] - y, pos[j * 3 + 2] - z); }
    const k = nb[i].size || 1; ax = ax / k - x; ay = ay / k - y; az = az / k - z; el /= k;
    const conc = (ax * nrm[i * 3] + ay * nrm[i * 3 + 1] + az * nrm[i * 3 + 2]) / (el || 1);
    const cav = Math.max(0, Math.min(1, conc * 2.2));
    // lips
    const lip = Math.max(0, Math.min(1, (oris[order[i]] - 0.12) * 1.6));
    // brows (arched band above each eye, front of the face)
    let brow = 0, cheek = 0;
    for (const [E, sx] of [[eyeL, 1], [eyeR, -1]]) {
      if (z < E[2] - 0.004) continue;
      const u = (x - E[0]) * sx; // + = outer
      const cy = E[1] + 0.0225 - 0.0065 * Math.pow((u - 0.002) / 0.026, 2);
      const half = 0.0042 * (1 - 0.45 * Math.max(0, u / 0.03));
      const dy = Math.abs(y - cy);
      if (u > -0.019 && u < 0.031) brow = Math.max(brow, Math.max(0, 1 - Math.max(0, dy - half) / 0.0025) * Math.min(1, (0.031 - u) / 0.008) * Math.min(1, (u + 0.019) / 0.006));
      const dc = Math.hypot((x - (E[0] + sx * 0.012)) / 0.03, (y - (E[1] - 0.03)) / 0.022);
      cheek = Math.max(cheek, Math.max(0, 1 - dc));
    }
    col[i * 4] = Math.round(lip * 255); col[i * 4 + 1] = Math.round(brow * 255); col[i * 4 + 2] = Math.round(cheek * 255); col[i * 4 + 3] = Math.round(cav * 255);
  }
  for (let i = 0; i < NH; i++) col[(HB + i) * 4] = Math.round(hairEdge[i] * 255);
  for (let e = 0; e < 2; e++) for (let i = 0; i < NE; i++) {
    const zf = eyeUnit[i * 3 + 2]; // forward component (+z = looking forward)
    const ang = Math.acos(Math.max(-1, Math.min(1, zf)));
    const iris = ang < 0.5 ? 1 : 0, pupil = ang < 0.2 ? 1 : 0, limb = ang > 0.4 && ang < 0.56 ? 1 : 0;
    const o = (NB + e * NE + i) * 4; col[o] = iris * 255; col[o + 1] = pupil * 255; col[o + 2] = limb * 255; col[o + 3] = Math.round(Math.max(0, 1 - ang / 1.2) * 255);
  }
}

// ── joints / weights for all vertices (eyes → Head) ──
const J = new Uint8Array(NT * 4), Wt = new Float32Array(NT * 4);
for (let i = 0; i < NB; i++) for (let k = 0; k < 4; k++) { J[i * 4 + k] = vJ[order[i] * 4 + k]; Wt[i * 4 + k] = vW[order[i] * 4 + k]; }
for (let i = NB; i < HB; i++) { J[i * 4] = BI.Head; Wt[i * 4] = 1; }
for (let i = 0; i < NH; i++) { const v = hairList[i]; for (let k = 0; k < 4; k++) { J[(HB + i) * 4 + k] = vJ[v * 4 + k]; Wt[(HB + i) * 4 + k] = vW[v * 4 + k]; } }

// ── glTF ──
const doc = new Document();
const buf = doc.createBuffer();
const A = (type, arr, norm = false) => doc.createAccessor().setType(type).setArray(arr).setBuffer(buf).setNormalized(norm);
const base0 = vars[0];
// base: float positions, int8 normals, uint8 colour masks / joints / weights; targets: int16-normalised position deltas
const toI8 = (f) => { const o = new Int8Array(f.length); for (let i = 0; i < f.length; i++) o[i] = Math.max(-127, Math.min(127, Math.round(f[i] * 127))); return o; };
const toU8w = (f) => { const o = new Uint8Array(f.length); for (let v = 0; v < f.length; v += 4) { let s = 0; for (let k = 0; k < 4; k++) { o[v + k] = Math.round(f[v + k] * 255); s += o[v + k]; } o[v] += 255 - s; } return o; };
const aPos = A('VEC3', base0.pos), aNrm = A('VEC3', toI8(base0.nrm), true), aCol = A('VEC4', col, true), aJ = A('VEC4', J), aW = A('VEC4', toU8w(Wt), true);
const targets = vars.slice(1).map((v) => {
  const dp = new Int16Array(NT * 3);
  for (let i = 0; i < NT * 3; i++) dp[i] = Math.max(-32767, Math.min(32767, Math.round((v.pos[i] - base0.pos[i]) * 32767)));
  return { p: A('VEC3', dp, true) };
});
const mesh = doc.createMesh('People');
for (const m of MATS) {
  if (!tris[m].length) continue;
  const mat = doc.createMaterial(m).setBaseColorFactor([1, 1, 1, 1]).setRoughnessFactor(0.7).setMetallicFactor(0);
  const prim = doc.createPrimitive().setMaterial(mat).setIndices(A('SCALAR', Uint16Array.from(tris[m])))
    .setAttribute('POSITION', aPos).setAttribute('NORMAL', aNrm).setAttribute('COLOR_0', aCol).setAttribute('JOINTS_0', aJ).setAttribute('WEIGHTS_0', aW);
  for (const t of targets) prim.addTarget(doc.createPrimitiveTarget().setAttribute('POSITION', t.p));
  mesh.addPrimitive(prim);
}
mesh.setWeights(vars.slice(1).map(() => 0)).setExtras({ targetNames: vars.slice(1).map((v) => v.name) });
const scene = doc.createScene('People');
const arm = doc.createNode('Armature');
scene.addChild(arm);
const nodes = {};
for (const b of OUTB) {
  const p = base0.joints[b], par = OUT_PARENT[b];
  const pp = par ? base0.joints[par] : [0, 0, 0];
  nodes[b] = doc.createNode(b).setTranslation([p[0] - pp[0], p[1] - pp[1], p[2] - pp[2]]);
  (par ? nodes[par] : arm).addChild(nodes[b]);
}
const ibm = new Float32Array(OUTB.length * 16);
OUTB.forEach((b, i) => { const p = base0.joints[b]; ibm.set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -p[0], -p[1], -p[2], 1], i * 16); });
const skin = doc.createSkin('PeopleSkin').setSkeleton(nodes.Hips).setInverseBindMatrices(A('MAT4', ibm));
for (const b of OUTB) skin.addJoint(nodes[b]);
const body = doc.createNode('People').setMesh(mesh).setSkin(skin);
arm.addChild(body);
arm.setExtras({ rxPeople: { variants: vars.map((v) => ({ name: v.name, params: v.params, height: v.height, joints: v.joints })), bones: OUTB, parents: OUT_PARENT } });
doc.getRoot().getAsset().copyright = 'Generated from MakeHuman CC0 assets (base mesh, targets, skeleton, weights).';
doc.createExtension(ALL_EXTENSIONS.find((E) => E.EXTENSION_NAME === 'KHR_mesh_quantization')).setRequired(true);
await new NodeIO().registerExtensions(ALL_EXTENSIONS).write(OUT, doc);
console.log(OUT, (fs.statSync(OUT).size / 1024).toFixed(0) + ' KB', 'verts', NT, 'tris', Object.fromEntries(MATS.map((m) => [m, tris[m].length / 3])));
