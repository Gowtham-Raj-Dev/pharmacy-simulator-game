// Realistic human characters, generated from MakeHuman's CC0 base mesh
// (see tools/gen-humans.mjs). One compact file holds a fitted body with clothes,
// hair, eyes, lashes and teeth plus 10 body variants (young / slim / heavy / old
// men and women, boys and girls) stored as morph targets with per-variant joint
// positions. Every customer gets a unique blend of variants, height, skin tone,
// hair colour and clothes, baked on the CPU into its own geometry (no runtime
// morphing cost). The skeleton is driven by RxShift's procedural animator
// through a retargeting layer, so walking, talking, gestures, sitting, paying
// and the inspector's clipboard all work on the realistic bodies.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import peopleUrl from '../assets/humans/people.glb?url';

const MAP = {
  hips: 'Hips', spine: 'Spine', chest: 'Spine2', neck: 'Neck', head: 'Head', jaw: 'Jaw',
  upperArmL: 'LeftArm', foreArmL: 'LeftForeArm', handL: 'LeftHand',
  upperArmR: 'RightArm', foreArmR: 'RightForeArm', handR: 'RightHand',
  thighL: 'LeftUpLeg', shinL: 'LeftLeg', footL: 'LeftFoot',
  thighR: 'RightUpLeg', shinR: 'RightLeg', footR: 'RightFoot',
};
const OUR_ORDER = ['hips', 'spine', 'chest', 'neck', 'head', 'jaw', 'upperArmL', 'foreArmL', 'handL', 'upperArmR', 'foreArmR', 'handR', 'thighL', 'shinL', 'footL', 'thighR', 'shinR', 'footR'];
const OUR_PARENT = { hips: null, spine: 'hips', chest: 'spine', neck: 'chest', head: 'neck', jaw: 'head', upperArmL: 'chest', foreArmL: 'upperArmL', handL: 'foreArmL', upperArmR: 'chest', foreArmR: 'upperArmR', handR: 'foreArmR', thighL: 'hips', shinL: 'thighL', footL: 'shinL', thighR: 'hips', shinR: 'thighR', footR: 'shinR' };
const ALIGN_GROUP = { upperArmL: 'armL', foreArmL: 'foreL', handL: 'foreL', upperArmR: 'armR', foreArmR: 'foreR', handR: 'foreR', thighL: 'legL', shinL: 'shinL', footL: 'shinL', thighR: 'legR', shinR: 'shinR', footR: 'shinR' };
const INV_MAP = Object.fromEntries(Object.entries(MAP).map(([a, b]) => [b, a]));
const DOWN = new THREE.Vector3(0, -1, 0);

let T = null; // template data
let ready = false;
const _qi = new THREE.Quaternion(), _v = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3();

export const RealHumans = {
  get ready() { return ready; },
  enabled: true,
  async load() {
    try {
      const loader = new GLTFLoader();
      let gltf;
      if (peopleUrl.startsWith('data:')) {
        // single-file build: decode the embedded model directly (no network / fetch needed)
        const bin = atob(peopleUrl.slice(peopleUrl.indexOf(',') + 1));
        const buf = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
        gltf = await loader.parseAsync(buf.buffer, '');
      } else gltf = await loader.loadAsync(peopleUrl);
      T = prepare(gltf);
      ready = !!T;
    } catch (e) { console.warn('realistic people failed to load — using procedural bodies', e); ready = false; }
    return ready;
  },
  create(ch) { return ready && this.enabled ? new RealBody(ch) : null; },
};

function prepare(gltf) {
  let info = null; const meshes = [];
  gltf.scene.traverse((o) => { if (o.userData?.rxPeople) info = o.userData.rxPeople; if (o.isMesh) meshes.push(o); });
  if (!info || !meshes.length) return null;
  const g0 = meshes[0].geometry;
  const pos = g0.attributes.position, n = pos.count;
  const base = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { base[i * 3] = pos.getX(i); base[i * 3 + 1] = pos.getY(i); base[i * 3 + 2] = pos.getZ(i); }
  const deltas = (g0.morphAttributes.position || []).map((a) => { const d = new Float32Array(n * 3); for (let i = 0; i < n; i++) { d[i * 3] = a.getX(i); d[i * 3 + 1] = a.getY(i); d[i * 3 + 2] = a.getZ(i); } return d; });
  // skin attributes as plain arrays (shared by every instance)
  // (attributes may be interleaved — always read element-wise)
  const ca = g0.attributes.color, sa = g0.attributes.skinIndex;
  const cArr = new Uint8Array(n * 4), sArr = new Uint16Array(n * 4);
  for (let i = 0; i < n; i++) {
    cArr[i * 4] = Math.round(ca.getX(i) * 255); cArr[i * 4 + 1] = Math.round(ca.getY(i) * 255); cArr[i * 4 + 2] = Math.round(ca.getZ(i) * 255); cArr[i * 4 + 3] = Math.round(ca.getW(i) * 255);
    sArr[i * 4] = sa.getX(i); sArr[i * 4 + 1] = sa.getY(i); sArr[i * 4 + 2] = sa.getZ(i); sArr[i * 4 + 3] = sa.getW(i);
  }
  const color = new THREE.BufferAttribute(cArr, 4, true);
  const skinIndex = new THREE.BufferAttribute(sArr, 4);
  const sw = g0.attributes.skinWeight; const swA = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) { swA[i * 4] = sw.getX(i); swA[i * 4 + 1] = sw.getY(i); swA[i * 4 + 2] = sw.getZ(i); swA[i * 4 + 3] = sw.getW(i); }
  const skinWeight = new THREE.BufferAttribute(swA, 4);
  const index = {};
  for (const m of meshes) index[m.material.name] = Uint16Array.from(m.geometry.index.array);
  const allTris = Object.values(index).reduce((a, x) => a + x.length, 0);
  const all = new Uint32Array(allTris); let o = 0; for (const k in index) { all.set(index[k], o); o += index[k].length; }
  const vIndex = Object.fromEntries(info.variants.map((v, i) => [v.name, i]));
  return { n, base, deltas, color, skinIndex, skinWeight, index, all, variants: info.variants, vIndex, bones: info.bones, parents: info.parents };
}

// ── appearance helpers ──
const lin = (hex) => new THREE.Color(hex);
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
/** Variant blend for a description → { variantName: weight } */
function blendFor(d) {
  const F = d.sex === 'F', P = F ? 'F' : 'M', age = d.age;
  const w = {};
  const add = (k, v) => { if (v > 1e-3) w[P + '_' + k] = (w[P + '_' + k] || 0) + v; };
  if (age < 13) { const t = smooth(9, 14, age) * 0.45; add('child', 1 - t); add('young', t); return w; }
  const old = smooth(42, 76, age);
  const b = d.build || 1;
  const heavy = Math.max(d.belly ? 0.55 : 0, smooth(1.0, 1.18, b));
  const slim = smooth(1.0, 0.9, b) * (1 - heavy);
  const teen = age < 18 ? smooth(18, 13, age) * 0.35 : 0;
  add('young', (1 - old) * (1 - heavy - slim) * (1 - teen));
  add('heavy', heavy * (1 - old * 0.5));
  add('slim', slim * (1 - old) + teen * 0.6);
  add('old', old * (1 - heavy * 0.5));
  add('child', teen * 0.4);
  const s = Object.values(w).reduce((a, x) => a + x, 0) || 1;
  for (const k in w) w[k] /= s;
  return w;
}

// shared shader snippets
const NOISE = `
float rxH3(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float rxN3(vec3 p) { vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(rxH3(i), rxH3(i + vec3(1,0,0)), f.x), mix(rxH3(i + vec3(0,1,0)), rxH3(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(rxH3(i + vec3(0,0,1)), rxH3(i + vec3(1,0,1)), f.x), mix(rxH3(i + vec3(0,1,1)), rxH3(i + vec3(1,1,1)), f.x), f.y), f.z); }`;
function patch(mat, kind, U = {}) {
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vRx;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvRx = position;');
    if (!sh.uniforms.uC) sh.uniforms.uC = { value: new THREE.Vector3() };
    let f = sh.fragmentShader.replace('#include <common>', `#include <common>\nvarying vec3 vRx;\nuniform vec3 uA; uniform vec3 uB; uniform vec3 uC;${NOISE}`);
    const fade = 'float rxFade = 1.0 - clamp(length(fwidth(vRx)) * 160.0, 0.0, 1.0);';
    if (kind === 'skin') {
      f = f.replace('#include <color_fragment>', `${fade}
  vec4 mk = vColor; vec3 sk = diffuseColor.rgb;
  float mot = rxN3(vRx * 140.0) - 0.5, big = rxN3(vRx * 18.0) - 0.5;
  sk *= 1.0 + mot * 0.05 * rxFade + big * 0.05;
  sk = mix(sk, sk * uA, clamp(mk.r * 0.95, 0.0, 1.0));
  sk = mix(sk, uB, mk.g * 0.9);
  sk = mix(sk, sk * vec3(1.07, 0.92, 0.9), mk.b * 0.55);
  sk *= 1.0 - mk.a * 0.38;
  diffuseColor.rgb = sk;`)
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = clamp(0.5 + mot * 0.12 - mk.r * 0.18 + mk.a * 0.15, 0.25, 0.85);')
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
{ vec3 vd = normalize(vViewPosition); float fres = pow(1.0 - clamp(dot(normal, vd), 0.0, 1.0), 3.0);
  totalEmissiveRadiance += diffuseColor.rgb * (0.055 + fres * 0.2) * vec3(1.0, 0.66, 0.52); }`);
    } else if (kind === 'eye') {
      f = f.replace('#include <color_fragment>', `vec4 mk = vColor;
  vec3 c = vec3(0.92, 0.89, 0.85) * (0.8 + 0.2 * mk.a);
  float fib = rxN3(vRx * 900.0);
  c = mix(c, uA * (0.7 + 0.6 * fib), mk.r);
  c = mix(c, c * 0.45, mk.b);
  c = mix(c, vec3(0.01), mk.g);
  diffuseColor.rgb = c;`).replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = 0.04;');
    } else if (kind === 'hair') {
      f = f.replace('#include <color_fragment>', `${fade}
  float st = rxN3(vec3(vRx.x * 380.0, vRx.y * 22.0, vRx.z * 380.0));
  float cl = rxN3(vRx * 45.0);
  vec3 hc = diffuseColor.rgb * (0.72 + st * 0.5 * (0.45 + 0.55 * rxFade) + (cl - 0.5) * 0.2);
  #ifdef USE_COLOR_ALPHA
  hc = mix(hc, uA, clamp(vColor.r * (0.65 + st * 0.5), 0.0, 1.0) * 0.85);
  #endif
  diffuseColor.rgb = hc;`)
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = 0.42 + st * 0.25;')
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
{ vec3 vd = normalize(vViewPosition); float fres = pow(1.0 - clamp(dot(normal, vd), 0.0, 1.0), 2.5); totalEmissiveRadiance += diffuseColor.rgb * fres * 0.12; }`);
    } else if (kind === 'coat') {
      // lab coat body: open V collar showing the shirt (uA), lapel folds, button placket, chest pocket.
      // uB = (neckY, V-bottom Y, front Z) · uC = (hipsY, centre X, -)
      f = f.replace('#include <color_fragment>', `${fade}
  float ax = abs(vRx.x - uC.y);
  float fr = smoothstep(uB.z - 0.01, uB.z + 0.012, vRx.z);
  float above = step(uB.y, vRx.y);
  float vt = clamp((vRx.y - uB.y) / max(uB.x - uB.y, 0.01), 0.0, 1.0);
  float halfW = 0.074 * pow(vt, 0.85);
  float inV = fr * above * (1.0 - smoothstep(halfW - 0.0025, halfW + 0.0025, ax));
  float lapel = fr * above * (1.0 - smoothstep(0.002, 0.009, abs(ax - halfW - 0.006))) * (1.0 - inV);
  float plk = fr * (1.0 - above) * (1.0 - smoothstep(0.0012, 0.003, abs(vRx.x - uC.y - 0.003)));
  float bt = 0.0;
  for (int i = 0; i < 3; i++) { float by = uB.y - 0.05 - float(i) * 0.105; bt = max(bt, 1.0 - smoothstep(0.0042, 0.0068, length(vec2(vRx.x - uC.y - 0.013, vRx.y - by)))); }
  bt *= fr;
  float px = vRx.x - uC.y - 0.088, py = vRx.y - (uB.y - 0.035);
  float pk = fr * step(abs(px), 0.042) * (1.0 - smoothstep(0.0012, 0.004, abs(py)));
  float pks = fr * step(py, 0.0) * step(-0.11, py) * (1.0 - smoothstep(0.001, 0.003, abs(abs(px) - 0.042)));
  float wv = sin(vRx.x * 1500.0 + vRx.z * 1500.0) * sin(vRx.y * 1500.0);
  float fold = rxN3(vRx * vec3(9.0, 22.0, 9.0)) - 0.5;
  vec3 cc = diffuseColor.rgb * (1.0 + wv * 0.03 * rxFade + (rxN3(vRx * 55.0) - 0.5) * 0.05 + fold * 0.11);
  cc *= 1.0 - 0.28 * lapel - 0.2 * plk - 0.22 * pk - 0.12 * pks;
  cc = mix(cc, vec3(0.62, 0.64, 0.66), bt * 0.85);
  vec3 sc = uA * (1.0 + fold * 0.12) * (0.82 + 0.18 * smoothstep(0.0, 0.03, halfW - ax));
  diffuseColor.rgb = mix(cc, sc, inV);`)
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = 0.78 + fold * 0.1;')
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
{ vec3 vd = normalize(vViewPosition); float fres = pow(1.0 - clamp(dot(normal, vd), 0.0, 1.0), 3.0); totalEmissiveRadiance += diffuseColor.rgb * fres * 0.06; }`);
    } else if (kind === 'skirt') {
      // coat tails / skirts: cut at the hem (uC.z), coat opens at the front below the hips, hip pockets
      // uB = (isCoat, -, front Z) · uC = (hipsY, centre X, hemY)
      f = f.replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
  if (vRx.y < uC.z) discard;
  float ax = abs(vRx.x - uC.y);
  float fr = smoothstep(uB.z - 0.01, uB.z + 0.015, vRx.z);
  float split = uB.x * fr * step(0.0, (uC.x - 0.06) - vRx.y) * (0.006 + ((uC.x - 0.06) - vRx.y) * 0.16);
  if (ax < split) discard;`).replace('#include <color_fragment>', `${fade}
  float wv = sin(vRx.x * 1500.0 + vRx.z * 1500.0) * sin(vRx.y * 1500.0);
  float fold = rxN3(vRx * vec3(9.0, 22.0, 9.0)) - 0.5;
  vec3 cc = diffuseColor.rgb * (1.0 + wv * 0.03 * rxFade + (rxN3(vRx * 55.0) - 0.5) * 0.06 + fold * 0.13);
  float hem = 1.0 - smoothstep(0.004, 0.016, vRx.y - uC.z);
  float edge = uB.x * fr * (1.0 - smoothstep(0.0, 0.008, ax - split - 0.002));
  float px = abs(ax - 0.11), py = vRx.y - (uC.x - 0.085);
  float pk = uB.x * fr * step(px, 0.052) * (1.0 - smoothstep(0.0012, 0.004, abs(py)));
  float pks = uB.x * fr * step(py, 0.0) * step(-0.14, py) * (1.0 - smoothstep(0.001, 0.003, abs(px - 0.052)));
  cc *= 1.0 - 0.2 * hem - 0.18 * edge - 0.22 * pk - 0.1 * pks;
  diffuseColor.rgb = cc;`)
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = 0.8 + fold * 0.1;')
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
{ vec3 vd = normalize(vViewPosition); float fres = pow(1.0 - clamp(dot(normal, vd), 0.0, 1.0), 3.0); totalEmissiveRadiance += diffuseColor.rgb * fres * 0.06; }`);
    } else if (kind === 'pants') {
      // trousers under a lab coat: only the parts the coat does not cover are drawn (below the hem and
      // in the front opening), so they can never show through the coat as dark specks
      f = f.replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
  if (uB.x > 0.5 && vRx.y > uC.z + 0.03) {
    float ax = abs(vRx.x - uC.y), top = uC.x - 0.06;
    float open = step(uB.z - 0.03, vRx.z) * step(vRx.y, top) * step(ax, 0.05 + (0.006 + max(0.0, top - vRx.y) * 0.16));
    if (open < 0.5) discard;
  }`).replace('#include <color_fragment>', `${fade}
  float wv = sin(vRx.x * 1500.0 + vRx.z * 1500.0) * sin(vRx.y * 1500.0);
  float fold = rxN3(vRx * vec3(9.0, 22.0, 9.0)) - 0.5;
  diffuseColor.rgb *= 1.0 + wv * 0.035 * rxFade + (rxN3(vRx * 55.0) - 0.5) * 0.08 + fold * 0.12;`)
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = 0.84 + fold * 0.1;');
    } else if (kind === 'cloth') {
      f = f.replace('#include <color_fragment>', `${fade}
  float wv = sin(vRx.x * 1500.0 + vRx.z * 1500.0) * sin(vRx.y * 1500.0);
  float fold = rxN3(vRx * vec3(9.0, 22.0, 9.0)) - 0.5;
  diffuseColor.rgb *= 1.0 + wv * 0.035 * rxFade + (rxN3(vRx * 55.0) - 0.5) * 0.08 + fold * 0.12;`)
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = 0.84 + fold * 0.1;')
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
{ vec3 vd = normalize(vViewPosition); float fres = pow(1.0 - clamp(dot(normal, vd), 0.0, 1.0), 3.0); totalEmissiveRadiance += diffuseColor.rgb * fres * 0.08; }`);
    }
    sh.fragmentShader = f;
  };
  mat.customProgramCacheKey = () => 'rxp-' + kind;
  return mat;
}

class RealBody {
  constructor(ch) {
    this.ch = ch;
    const d = ch.desc, P = ch.P;
    // ── variant blend → joints, height, positions, normals ──
    const blend = blendFor(d);
    const lam = new Float32Array(T.variants.length);
    for (const [k, v] of Object.entries(blend)) if (T.vIndex[k] != null) lam[T.vIndex[k]] = v;
    let sum = 0; for (let i = 1; i < lam.length; i++) sum += lam[i];
    lam[0] = Math.max(0, 1 - sum);
    const J = {}; let height = 0;
    for (const b of T.bones) J[b] = [0, 0, 0];
    T.variants.forEach((v, i) => { const l = lam[i]; if (!l) return; height += v.height * l; for (const b of T.bones) { const j = v.joints[b]; J[b][0] += j[0] * l; J[b][1] += j[1] * l; J[b][2] += j[2] * l; } });
    const n = T.n, pos = new Float32Array(T.base);
    for (let k = 1; k < lam.length; k++) { const l = lam[k]; if (!l) continue; const dd = T.deltas[k - 1]; for (let i = 0; i < n * 3; i++) pos[i] += dd[i] * l; }
    const nrm = new Float32Array(n * 3), t = T.all;
    for (let i = 0; i < t.length; i += 3) {
      const a = t[i] * 3, b = t[i + 1] * 3, c = t[i + 2] * 3;
      const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2], vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      nrm[a] += nx; nrm[a + 1] += ny; nrm[a + 2] += nz; nrm[b] += nx; nrm[b + 1] += ny; nrm[b + 2] += nz; nrm[c] += nx; nrm[c + 1] += ny; nrm[c + 2] += nz;
    }
    for (let i = 0; i < n; i++) { const l = Math.hypot(nrm[i * 3], nrm[i * 3 + 1], nrm[i * 3 + 2]) || 1; nrm[i * 3] /= l; nrm[i * 3 + 1] /= l; nrm[i * 3 + 2] /= l; }
    // ── groups (per-instance visibility: sleeves, shorts, skirt / coat, hair length) ──
    const coat = d.coat && (d.coatLen || 0.2) >= 0.2;
    // ── per-instance cloth fit: a lab coat hangs loose and skirts sit clear of the legs,
    //    so trousers never poke through (no z-fighting specks) ──
    if (coat || d.skirt) {
      const hy = J.Hips[1], hx = J.Hips[0], hz = J.Hips[2];
      const seen = new Uint8Array(n);
      const grow = (idx, fn) => { if (!idx) return; for (const i of idx) { if (seen[i]) continue; seen[i] = 1; fn(i); } };
      grow(T.index.skirt, (i) => {
        const y = pos[i * 3 + 1], dx = pos[i * 3] - hx, dz = pos[i * 3 + 2] - hz, l = Math.hypot(dx, dz) || 1;
        const k = (coat ? 0.008 : 0.004) + (coat ? 0.026 : 0.012) * smooth(hy + 0.04, hy - 0.32, y);
        pos[i * 3] += (dx / l) * k; pos[i * 3 + 2] += (dz / l) * k;
      });
      if (coat) {
        grow(T.index.top, (i) => { const k = 0.007 * smooth(J.Neck[1] + 0.02, J.Neck[1] - 0.08, pos[i * 3 + 1]); pos[i * 3] += nrm[i * 3] * k; pos[i * 3 + 1] += nrm[i * 3 + 1] * k; pos[i * 3 + 2] += nrm[i * 3 + 2] * k; });
        grow(T.index.sleeve, (i) => { pos[i * 3] += nrm[i * 3] * 0.009; pos[i * 3 + 1] += nrm[i * 3 + 1] * 0.009; pos[i * 3 + 2] += nrm[i * 3 + 2] * 0.009; });
      }
    }
    const show = {
      skin: true, shoes: true, top: true, sleeve: d.sleeves !== 'short' || !!d.coat,
      pants: !(d.skirt && !d.coat), pantsLow: !(d.skirt && !d.coat) && !d.shorts,
      skirt: !!d.skirt || coat, hair: d.hair !== 'bald' && d.hair !== 'none',
      hairLong: d.sex === 'F' && ['long', 'bob', 'curly'].includes(d.hair), teeth: true, tongue: true, lashes: true, eyes: true,
    };
    const skinC = lin(d.skin), hairC = lin(d.hairColor || 0x1b1714);
    const mats = {
      skin: patch(new THREE.MeshStandardMaterial({ color: skinC, vertexColors: true, roughness: 0.5, envMapIntensity: 0.6 }), 'skin', {
        uA: { value: new THREE.Color(0.9, 0.66, 0.64) }, uB: { value: hairC.clone().multiplyScalar(0.85) } }),
      eyes: patch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.05, envMapIntensity: 1.0 }), 'eye', { uA: { value: lin(d.eyeColor || 0x3a2416).multiplyScalar(1.6) }, uB: { value: new THREE.Color() } }),
      hair: patch(new THREE.MeshStandardMaterial({ color: hairC, vertexColors: true, roughness: 0.45, side: THREE.DoubleSide, envMapIntensity: 0.6 }), 'hair', { uA: { value: skinC.clone().multiplyScalar(0.9) }, uB: { value: new THREE.Color() } }),
      top: coat
        ? patch(new THREE.MeshStandardMaterial({ color: lin(d.coat).multiplyScalar(0.93), roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }), 'coat', {
          uA: { value: lin(d.top) }, uB: { value: new THREE.Vector3(J.Neck[1] + 0.005, J.Spine2[1] - 0.035, J.Spine2[2] + 0.035) }, uC: { value: new THREE.Vector3(J.Hips[1], J.Hips[0], 0) } })
        : patch(new THREE.MeshStandardMaterial({ color: lin(d.coat || d.top), roughness: 0.85, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }), 'cloth', { uA: { value: new THREE.Color() }, uB: { value: new THREE.Color() } }),
      bottom: patch(new THREE.MeshStandardMaterial({ color: lin(d.bottom), roughness: 0.85, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }), 'pants', {
        uA: { value: new THREE.Color() }, uB: { value: new THREE.Vector3(coat ? 1 : 0, 0, J.Hips[2] + 0.04) },
        uC: { value: new THREE.Vector3(J.Hips[1], J.Hips[0], coat ? J.Hips[1] - (d.coatLen || 0.27) * height : -1) } }),
      skirt: patch(new THREE.MeshStandardMaterial({ color: coat ? lin(d.coat).multiplyScalar(0.93) : lin(d.skirt || d.bottom), roughness: 0.85, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -3 }), 'skirt', {
        uA: { value: new THREE.Color() }, uB: { value: new THREE.Vector3(coat ? 1 : 0, 0, J.Hips[2] + 0.04) },
        uC: { value: new THREE.Vector3(J.Hips[1], J.Hips[0], coat ? J.Hips[1] - (d.coatLen || 0.27) * height : -1) } }),
      shoes: new THREE.MeshStandardMaterial({ color: lin(d.shoes), roughness: 0.38, envMapIntensity: 0.8 }),
      mouth: new THREE.MeshStandardMaterial({ color: 0xe9e2d4, roughness: 0.35 }),
      lashes: new THREE.MeshStandardMaterial({ color: hairC.clone().multiplyScalar(0.35), roughness: 0.7, side: THREE.DoubleSide }),
    };
    const GROUPS = [['skin', ['skin']], ['shoes', ['shoes']], ['top', ['top', 'sleeve']], ['bottom', ['pants', 'pantsLow']], ['skirt', ['skirt']], ['hair', ['hair', 'hairLong']], ['eyes', ['eyes']], ['mouth', ['teeth', 'tongue']], ['lashes', ['lashes']]];
    const parts = [], matList = [];
    let total = 0;
    for (const [mk, names] of GROUPS) {
      const idx = names.filter((nm) => show[nm] && T.index[nm]).map((nm) => T.index[nm]);
      if (!idx.length) continue;
      const len = idx.reduce((a, x) => a + x.length, 0);
      parts.push({ idx, len, mat: matList.length }); matList.push(mats[mk]); total += len;
    }
    const index = new Uint16Array(total);
    const geo = new THREE.BufferGeometry();
    let off = 0;
    for (const p of parts) { const start = off; for (const a of p.idx) { index.set(a, off); off += a.length; } geo.addGroup(start, p.len, p.mat); }
    geo.setIndex(new THREE.BufferAttribute(index, 1));
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
    geo.setAttribute('color', T.color);
    geo.setAttribute('skinIndex', T.skinIndex);
    geo.setAttribute('skinWeight', T.skinWeight);
    // ── skeleton from blended joints (identity rotations) ──
    const bones = {}, list = [];
    for (const b of T.bones) { const bone = new THREE.Bone(); bone.name = b; bones[b] = bone; list.push(bone); }
    for (const b of T.bones) { const par = T.parents[b], j = J[b], pj = par ? J[par] : [0, 0, 0]; bones[b].position.set(j[0] - pj[0], j[1] - pj[1], j[2] - pj[2]); if (par) bones[par].add(bones[b]); }
    const root = new THREE.Group(); root.add(bones.Hips);
    const mesh = new THREE.SkinnedMesh(geo, matList);
    root.add(mesh);
    root.updateMatrixWorld(true);
    const skel = new THREE.Skeleton(list);
    mesh.bind(skel);
    geo.computeBoundingSphere();
    mesh.frustumCulled = true;
    mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, height * 0.5, 0), height * 0.9);
    mesh.castShadow = ch.constructor.shadows;
    this.mesh = mesh; this.bones = bones; this.mats = mats; this.root = root;
    // ── scale to this person's height ──
    const s = P.H / height;
    this.wrap = new THREE.Group();
    this.wrap.scale.setScalar(s);
    this.wrap.add(root);
    this.s = s;
    // ── retarget data ──
    const dir = (a, b) => _a.set(...J[b]).sub(_b.set(...J[a])).normalize();
    const align = {
      armL: new THREE.Quaternion().setFromUnitVectors(dir('LeftArm', 'LeftForeArm'), DOWN), armR: new THREE.Quaternion().setFromUnitVectors(dir('RightArm', 'RightForeArm'), DOWN),
      legL: new THREE.Quaternion().setFromUnitVectors(dir('LeftUpLeg', 'LeftLeg'), DOWN), legR: new THREE.Quaternion().setFromUnitVectors(dir('RightUpLeg', 'RightLeg'), DOWN),
      foreL: new THREE.Quaternion().setFromUnitVectors(dir('LeftForeArm', 'LeftHand'), DOWN), foreR: new THREE.Quaternion().setFromUnitVectors(dir('RightForeArm', 'RightHand'), DOWN),
      shinL: new THREE.Quaternion().setFromUnitVectors(dir('LeftLeg', 'LeftFoot'), DOWN), shinR: new THREE.Quaternion().setFromUnitVectors(dir('RightLeg', 'RightFoot'), DOWN),
    };
    const order = [];
    const visit = (b) => { order.push(b); for (const c of b.children) if (c.isBone) visit(c); };
    visit(bones.Hips);
    const idxOf = new Map(order.map((b, i) => [b, i]));
    this.chain = order.map((b) => { const our = INV_MAP[b.name] || null; return { bone: b, our, A: our && ALIGN_GROUP[our] ? align[ALIGN_GROUP[our]] : new THREE.Quaternion(), parentIdx: idxOf.has(b.parent) ? idxOf.get(b.parent) : -1 }; });
    this.W = order.map(() => new THREE.Quaternion());
    this.ourW = Object.fromEntries(OUR_ORDER.map((k) => [k, new THREE.Quaternion()]));
    this.hipsRest = bones.Hips.position.clone();
    this.frames = {};
    this._ident = new THREE.Quaternion();
  }

  /** Object3D that follows one of our bones' frames (for props / accessories). */
  frame(ourBone) {
    if (this.frames[ourBone]) return this.frames[ourBone];
    const e = this.chain.find((x) => x.our === ourBone);
    const o = new THREE.Object3D();
    o.quaternion.copy(e.A).invert();
    o.scale.setScalar(1 / this.s);
    e.bone.add(o);
    this.frames[ourBone] = o;
    return o;
  }

  /** Copy the procedural pose onto the realistic skeleton. */
  apply() {
    const B = this.ch.bones, ourW = this.ourW, C = this.chain, W = this.W;
    for (const k of OUR_ORDER) { const p = OUR_PARENT[k]; if (p) ourW[k].copy(ourW[p]).multiply(B[k].quaternion); else ourW[k].copy(B.hips.quaternion); }
    for (let i = 0; i < C.length; i++) {
      const e = C[i], w = W[i], parentW = e.parentIdx >= 0 ? W[e.parentIdx] : this._ident;
      if (e.our) { w.copy(ourW[e.our]).multiply(e.A); e.bone.quaternion.copy(_qi.copy(parentW).invert()).multiply(w); }
      else w.copy(parentW).multiply(e.bone.quaternion);
    }
    const hp = B.hips.position, bp = this.ch.bindPos.hips;
    _v.set((hp.x - bp.x) / this.s, (hp.y - bp.y) / this.s, (hp.z - bp.z) / this.s);
    this.bones.Hips.position.copy(this.hipsRest).add(_v);
  }
  /** Eye centre relative to the head joint, in metres (head frame). */
  eyeCenter() {
    if (this._eye) return this._eye;
    const idx = T.index.eyes, p = this.mesh.geometry.attributes.position.array, h = this.bones.Head.getWorldPosition(new THREE.Vector3());
    this.root.updateMatrixWorld(true); this.bones.Head.getWorldPosition(h);
    let x = 0, y = 0, z = 0; for (const i of idx) { x += p[i * 3]; y += p[i * 3 + 1]; z += p[i * 3 + 2]; }
    const n = idx.length;
    this._eye = [(x / n - h.x) * this.s, (y / n - h.y) * this.s, (z / n - h.z) * this.s];
    return this._eye;
  }
  /** Distance detail: hide tiny parts (eyes, lashes, teeth) far away to save draw calls. */
  setDetail(near) { if (this._near === near) return; this._near = near; this.mats.lashes.visible = near; this.mats.mouth.visible = near; }
  dispose() { this.mesh.geometry.dispose(); for (const m of Object.values(this.mats)) m.dispose(); }
}
