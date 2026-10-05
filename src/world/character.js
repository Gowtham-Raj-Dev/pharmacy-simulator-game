// ─────────────────────────────────────────────────────────────────────────────
// Procedural realistic-proportion humans.
// Each character is ONE SkinnedMesh (1 draw call) built from sculpted parts
// (lathe torso, tapered limbs, deformed head, facial features, hair styles,
// clothing) with ~25 bones. Animation is procedural and layered/blended:
// locomotion (idle/walk/run/sit) → talk → actions → symptom gestures → look-at
// → facial expression, blink and lip movement. Two geometry LODs.
// ─────────────────────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { RealHumans } from './realhumans.js';
import { Rocketbox } from './rocketbox.js';
export { RealHumans, Rocketbox };
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { clamp, lerp, damp, angleDamp, noise1, mulberry32 } from '../core/util.js';

const BONES = ['root', 'hips', 'spine', 'chest', 'neck', 'head', 'jaw', 'browL', 'browR', 'lidL', 'lidR', 'mouthL', 'mouthR',
  'upperArmL', 'foreArmL', 'handL', 'upperArmR', 'foreArmR', 'handR', 'thighL', 'shinL', 'footL', 'thighR', 'shinR', 'footR'];
const BI = Object.fromEntries(BONES.map((b, i) => [b, i]));
const PARENT = { hips: 'root', spine: 'hips', chest: 'spine', neck: 'chest', head: 'neck', jaw: 'head', browL: 'head', browR: 'head', lidL: 'head', lidR: 'head', mouthL: 'head', mouthR: 'head',
  upperArmL: 'chest', foreArmL: 'upperArmL', handL: 'foreArmL', upperArmR: 'chest', foreArmR: 'upperArmR', handR: 'foreArmR',
  thighL: 'hips', shinL: 'thighL', footL: 'shinL', thighR: 'hips', shinR: 'thighR', footR: 'shinR' };

export const SKIN_TONES = [0xf1d0b5, 0xe8b996, 0xd9a47c, 0xc68a64, 0xa86f4c, 0x8d5a3b, 0x6e4430, 0x5a3626];
export const HAIR_COLORS = { black: 0x1b1714, darkbrown: 0x3b2618, brown: 0x6a4428, auburn: 0x7a3a22, grey: 0x9a9a98, white: 0xdcdad5, blonde: 0xb89a62 };

const _c = new THREE.Color();
const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// Tapered capsule along -Y (joint at y=0, end at y=-len)
function limb(r1, r2, len, seg, topFlat = 1) {
  const pts = [];
  const cap = Math.max(3, Math.floor(seg / 3));
  for (let i = 0; i <= cap; i++) { const a = -Math.PI / 2 + (i / cap) * (Math.PI / 2); pts.push(new THREE.Vector2(Math.max(0.0005, Math.cos(a) * r2), -len + Math.sin(a) * r2)); }
  for (let i = 0; i <= cap; i++) { const a = (i / cap) * (Math.PI / 2); pts.push(new THREE.Vector2(Math.max(0.0005, Math.cos(a) * r1), Math.sin(a) * r1 * topFlat)); }
  return new THREE.LatheGeometry(pts, seg);
}
// Shared skull deformation (head, hair and beard shells use the same shape)
function skullShape(x, y, z) {
  if (y < 0) { const k = 1 - 0.22 * Math.pow(-y, 1.6); x *= k; z = z > 0 ? z * (1 - 0.1 * y * y) : z * k; }
  if (y < -0.75) y = -0.75 - (y + 0.75) * 0.6;
  if (z > 0.6 && Math.abs(y) < 0.5) z = 0.6 + (z - 0.6) * 0.85;
  if (z < -0.2 && y > -0.2) z *= 1.04;
  return [x, y, z];
}
function ellipsoid(rx, ry, rz, ws, hs) { const g = new THREE.SphereGeometry(1, ws, hs); g.scale(rx, ry, rz); return g; }

// ── Geometry builder accumulating skinned parts ──
class Builder {
  constructor(boneWorld, rnd) { this.bw = boneWorld; this.geos = []; this.rnd = rnd; }
  add(geo, color, bone, { at = [0, 0, 0], weights = null, noise = 0.035, shade = null, mat = 0, tint = null } = {}) {
    const o = this.bw[bone];
    const ox = o.x + at[0], oy = o.y + at[1], oz = o.z + at[2];
    if (geo.index === null) geo = mergeGeometries([geo]);
    if (geo.attributes.uv) geo.deleteAttribute('uv');
    if (geo.attributes.uv1) geo.deleteAttribute('uv1');
    const pos = geo.attributes.position, n = pos.count;
    const col = new Float32Array(n * 3), si = new Uint16Array(n * 4), sw = new Float32Array(n * 4), mt = new Float32Array(n).fill(mat);
    _c.set(color);
    const p = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      p.fromBufferAttribute(pos, i);
      const k = 1 + (this.rnd() - 0.5) * noise * 2;
      let r = _c.r * k, g = _c.g * k, b = _c.b * k;
      if (shade) { const s = shade(p); r *= s; g *= s; b *= s; }
      if (tint) { const tt = tint(p); r *= tt[0]; g *= tt[1]; b *= tt[2]; }
      col[i * 3] = r; col[i * 3 + 1] = g; col[i * 3 + 2] = b;
      const w = weights ? weights(p) : [[BI[bone], 1]];
      for (let j = 0; j < 4; j++) { si[i * 4 + j] = w[j] ? w[j][0] : 0; sw[i * 4 + j] = w[j] ? w[j][1] : 0; }
      pos.setXYZ(i, p.x + ox, p.y + oy, p.z + oz);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4));
    geo.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
    geo.setAttribute('aMat', new THREE.BufferAttribute(mt, 1));
    geo.computeVertexNormals();
    this.geos.push(geo);
  }
  build() {
    const g = mergeGeometries(this.geos, false);
    this.geos.forEach((x) => x.dispose());
    return g;
  }
}

function limbWeights(parent, self, child, len, bt = 0.12, bb = 0.16) {
  return (p) => {
    const t = -p.y / len;
    const out = [];
    let wp = 0, wc = 0;
    if (parent != null && t < bt) wp = clamp((bt - t) / (2 * bt), 0, 0.5);
    if (child != null && t > 1 - bb) wc = clamp((t - (1 - bb)) / (2 * bb), 0, 0.5);
    out.push([BI[self], 1 - wp - wc]);
    if (wp > 0) out.push([BI[parent], wp]);
    if (wc > 0) out.push([BI[child], wc]);
    return out;
  };
}

/** Body proportions from height/age/sex/build */
function proportions(o) {
  const H = o.height, c = o.age < 13 ? clamp((13 - o.age) / 11, 0, 1) : 0;
  const M = o.sex === 'M';
  const bw = o.build;
  const P = { H, c, M, bw };
  P.headH = H * lerp(0.13, 0.185, c);
  P.headPivotY = H - 0.92 * P.headH;
  P.neckLen = H * 0.034 * (1 - 0.35 * c);
  P.neckBaseY = P.headPivotY - P.neckLen;
  P.shoulderY = P.neckBaseY - H * 0.015;
  P.hipY = H * lerp(0.53, 0.47, c);
  P.chestY = P.hipY + (P.shoulderY - P.hipY) * 0.62;
  P.spineY = P.hipY + (P.shoulderY - P.hipY) * 0.25;
  P.hipJointY = P.hipY - H * 0.03;
  P.kneeY = H * lerp(0.28, 0.255, c);
  P.ankleY = H * 0.042;
  P.thighLen = P.hipJointY - P.kneeY;
  P.shinLen = P.kneeY - P.ankleY;
  P.upperArm = H * 0.18; P.foreArm = H * 0.15; P.hand = H * 0.1;
  P.shoulderHalf = H * (M ? 0.106 : 0.096) * Math.pow(bw, 0.35);
  P.hipHalf = H * (M ? 0.05 : 0.057) * Math.pow(bw, 0.5);
  P.hipR = H * (M ? 0.082 : 0.092) * bw;
  P.waistR = H * (M ? 0.078 : 0.066) * bw * (o.belly ? 1.12 : 1);
  P.chestR = H * (M ? 0.088 : 0.08) * Math.pow(bw, 0.7);
  P.stoop = o.age >= 68 ? 0.16 : o.age >= 60 ? 0.07 : 0;
  return P;
}

function boneWorldPositions(P) {
  const W = {};
  const v = (x, y, z) => new THREE.Vector3(x, y, z);
  W.root = v(0, 0, 0);
  W.hips = v(0, P.hipY, 0);
  W.spine = v(0, P.spineY, 0);
  W.chest = v(0, P.chestY, 0);
  W.neck = v(0, P.neckBaseY, 0);
  W.head = v(0, P.headPivotY, 0);
  const hc = v(0, P.headPivotY + P.headH * 0.42, P.headH * 0.06);
  P.hc = hc;
  const rx = P.headH * (P.M ? 0.385 : 0.365) * (1 + P.c * 0.06), ry = P.headH * 0.5, rz = P.headH * 0.47;
  P.hr = { rx, ry, rz };
  const surfZ = (x, y) => hc.z + rz * Math.sqrt(Math.max(0, 1 - (x / rx) ** 2 - (y / ry) ** 2));
  P.surfZ = surfZ;
  const eyeX = P.headH * 0.15, eyeY = P.headH * 0.03;
  P.eye = { x: eyeX, y: eyeY, r: P.headH * 0.055 };
  const eyeZ = surfZ(eyeX, eyeY) - P.eye.r * 0.92;
  P.eye.z = eyeZ;
  W.jaw = v(0, hc.y - P.headH * 0.12, hc.z + rz * 0.15);
  W.browL = v(eyeX, hc.y + eyeY + P.headH * 0.095, surfZ(eyeX, eyeY + P.headH * 0.095) + 0.001);
  W.browR = v(-eyeX, W.browL.y, W.browL.z);
  W.lidL = v(eyeX, hc.y + eyeY, eyeZ);
  W.lidR = v(-eyeX, hc.y + eyeY, eyeZ);
  const mouthY = -P.headH * 0.22, mx = P.headH * 0.075;
  P.mouth = { y: mouthY, x: mx };
  W.mouthL = v(mx, hc.y + mouthY, surfZ(mx * 0.8, mouthY) - 0.002);
  W.mouthR = v(-mx, W.mouthL.y, W.mouthL.z);
  W.upperArmL = v(P.shoulderHalf, P.shoulderY, -0.005);
  W.foreArmL = v(P.shoulderHalf, P.shoulderY - P.upperArm, -0.005);
  W.handL = v(P.shoulderHalf, P.shoulderY - P.upperArm - P.foreArm, -0.005);
  W.upperArmR = v(-P.shoulderHalf, P.shoulderY, -0.005);
  W.foreArmR = v(-P.shoulderHalf, P.shoulderY - P.upperArm, -0.005);
  W.handR = v(-P.shoulderHalf, P.shoulderY - P.upperArm - P.foreArm, -0.005);
  W.thighL = v(P.hipHalf, P.hipJointY, 0);
  W.shinL = v(P.hipHalf, P.kneeY, 0);
  W.footL = v(P.hipHalf, P.ankleY, 0);
  W.thighR = v(-P.hipHalf, P.hipJointY, 0);
  W.shinR = v(-P.hipHalf, P.kneeY, 0);
  W.footR = v(-P.hipHalf, P.ankleY, 0);
  return W;
}

/** Build skinned geometry for a character description at a given LOD */
function buildGeometry(o, P, W, lod) {
  const rnd = mulberry32(o.seed || 1);
  const B = new Builder(W, rnd);
  const S = lod === 0 ? 1 : 0.55; // segment scale
  const seg = (n) => Math.max(5, Math.round(n * S));
  const H = P.H;
  const skin = o.skin, shirt = o.top, pants = o.bottom, shoes = o.shoes, hair = o.hairColor;
  const lip = new THREE.Color(skin).multiplyScalar(0.82).lerp(new THREE.Color(0xa65a55), 0.3).getHex();
  const skinDark = new THREE.Color(skin).multiplyScalar(0.9).getHex();

  // ── Torso (lathe, densified so chest/back/belly can be sculpted) ──
  const torsoColor = o.coat ? o.coat : shirt;
  const coatScale = o.coat ? 1.05 : 1;
  const rawProf = [
    [P.hipY - 0.03 * H, P.hipR * 0.72], [P.hipY - 0.012 * H, P.hipR * 0.95], [P.hipY + 0.05 * H, P.waistR * 1.03], [P.hipY + 0.1 * H, P.waistR],
    [P.chestY - 0.03 * H, P.chestR * 0.97], [P.chestY + 0.03 * H, P.chestR], [P.shoulderY - 0.045 * H, P.chestR * 1.02],
    [P.shoulderY - 0.012 * H, P.shoulderHalf * 1.0], [P.shoulderY + 0.004 * H, P.shoulderHalf * 0.93], [P.shoulderY + 0.014 * H, P.shoulderHalf * 0.78], [P.shoulderY + 0.024 * H, P.shoulderHalf * 0.58], [P.shoulderY + 0.032 * H, 0.038 * H], [P.shoulderY + 0.04 * H, 0.002],
  ];
  const dense = [];
  for (let i = 0; i < rawProf.length - 1; i++) {
    const [y0, r0] = rawProf[i], [y1, r1] = rawProf[i + 1];
    const steps = i < rawProf.length - 3 ? 3 : 1;
    for (let k = 0; k < steps; k++) { const t = k / steps, e = t * t * (3 - 2 * t); dense.push([lerp(y0, y1, t), lerp(r0, r1, e)]); }
  }
  dense.push(rawProf[rawProf.length - 1]);
  const prof = dense.map(([y, r]) => new THREE.Vector2(r * coatScale, y - P.hipY));
  const torso = new THREE.LatheGeometry(prof, seg(22));
  {
    const pos = torso.attributes.position;
    const adultF = !P.M && P.c < 0.3;
    const g2 = (d, s2) => Math.exp(-(d * d) / (s2 * s2));
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i) + P.hipY;
      let x = pos.getX(i);
      const dz = lerp(0.62, 1, smoothstep(P.shoulderY - 0.02 * H, P.neckBaseY + 0.01 * H, y)) * (y < P.spineY ? 1.08 : 1);
      const rr = Math.hypot(x, pos.getZ(i)) || 1;
      let z = pos.getZ(i) * Math.min(dz, (P.chestR * 0.66 * coatScale) / rr);
      if (y > P.chestY - 0.05 * H && y < P.shoulderY && z < 0) z *= 0.92; // flatter back
      if (z < 0 && y > P.chestY - 0.02 * H && y < P.shoulderY - 0.01 * H) z -= 0.008 * H * g2(Math.abs(x) - 0.05 * H, 0.03 * H); // shoulder blades
      if (z < 0 && y < P.hipY + 0.01 * H && y > P.hipY - 0.04 * H) z -= 0.012 * H * g2(Math.abs(x) - 0.04 * H, 0.04 * H); // seat
      if (z > 0) {
        if (adultF) z += 0.024 * H * coatScale * g2(y - (P.chestY - 0.012 * H), 0.032 * H) * g2(Math.abs(x) - 0.045 * H, 0.034 * H); // bust
        else if (P.M && P.c < 0.3) z += 0.006 * H * g2(y - (P.chestY + 0.01 * H), 0.03 * H) * g2(Math.abs(x) - 0.045 * H, 0.04 * H); // pecs
        if (o.belly) z += 0.07 * H * g2(y - (P.hipY + 0.075 * H), 0.075 * H) * g2(x, 0.09 * H);
      }
      if (y > P.shoulderY - 0.03 * H && y < P.shoulderY + 0.02 * H) x *= 1 + 0.03 * g2(y - P.shoulderY, 0.015 * H); // deltoid line
      pos.setX(i, x); pos.setZ(i, z);
    }
  }
  const torsoW = (p) => {
    const y = p.y + P.hipY;
    if (y <= P.hipY) return [[BI.hips, 1]];
    if (y < P.spineY) { const t = (y - P.hipY) / (P.spineY - P.hipY); return [[BI.hips, 1 - t], [BI.spine, t]]; }
    if (y < P.chestY) { const t = (y - P.spineY) / (P.chestY - P.spineY); return [[BI.spine, 1 - t], [BI.chest, t]]; }
    if (y < P.neckBaseY - 0.005 * H) {
      const ax = Math.abs(p.x);
      if (y > P.shoulderY - 0.035 * H && ax > P.shoulderHalf * 0.72) { const w = clamp((ax - P.shoulderHalf * 0.72) / (P.shoulderHalf * 0.4), 0, 0.45); return [[BI.chest, 1 - w], [p.x > 0 ? BI.upperArmL : BI.upperArmR, w]]; }
      return [[BI.chest, 1]];
    }
    return [[BI.chest, 0.6], [BI.neck, 0.4]];
  };
  // subtle fabric folds / shading on the torso
  B.add(torso, torsoColor, 'hips', { weights: torsoW, noise: 0.02, shade: (p) => { const y = p.y + P.hipY; return (y < P.hipY + 0.02 * H ? 0.93 : 1) * (p.z < 0 ? 0.97 : 1); } });

  if (o.coat) {
    // shirt "V" & collar visible under coat, lapels, pockets, name badge
    const v = new THREE.CylinderGeometry(0.001, 0.05 * H, 0.11 * H, 3, 1);
    v.rotateZ(Math.PI); v.scale(1, 1, 0.25);
    B.add(v, shirt, 'chest', { at: [0, P.shoulderY - P.chestY - 0.035 * H, P.chestR * 0.62 * coatScale - 0.004] });
    for (const sx of [1, -1]) {
      const lapel = new THREE.BoxGeometry(0.03 * H, 0.1 * H, 0.006 * H, 1, 3, 1);
      lapel.rotateZ(sx * 0.32);
      B.add(lapel, new THREE.Color(o.coat).multiplyScalar(0.95).getHex(), 'chest', { at: [sx * 0.026 * H, P.shoulderY - P.chestY - 0.05 * H, P.chestR * 0.66 * coatScale], noise: 0.01, shade: (p) => (p.z > 0 ? 1 : 0.9) });
      const pocket = new THREE.BoxGeometry(0.05 * H, 0.04 * H, 0.004 * H);
      B.add(pocket, new THREE.Color(o.coat).multiplyScalar(0.93).getHex(), 'hips', { at: [sx * 0.06 * H, -0.045 * H, P.hipR * 1.2 * 0.72 + 0.006 * H], noise: 0.01 });
    }
    const collarL = new THREE.BoxGeometry(0.045 * H, 0.012 * H, 0.02 * H); collarL.rotateZ(-0.6); collarL.rotateY(0.4);
    B.add(collarL, o.coat, 'chest', { at: [0.028 * H, P.shoulderY - P.chestY + 0.004 * H, P.chestR * 0.45], noise: 0.01 });
    const collarR = new THREE.BoxGeometry(0.045 * H, 0.012 * H, 0.02 * H); collarR.rotateZ(0.6); collarR.rotateY(-0.4);
    B.add(collarR, o.coat, 'chest', { at: [-0.028 * H, P.shoulderY - P.chestY + 0.004 * H, P.chestR * 0.45], noise: 0.01 });
    if (o.tie) {
      const tie = new THREE.BoxGeometry(0.018 * H, 0.15 * H, 0.006 * H, 1, 3, 1);
      { const tp = tie.attributes.position; for (let i = 0; i < tp.count; i++) { const yy = tp.getY(i); tp.setX(i, tp.getX(i) * (1 + Math.max(0, -yy / (0.075 * H)) * 0.5)); } }
      B.add(tie, o.tie, 'chest', { at: [0, P.shoulderY - P.chestY - 0.08 * H, P.chestR * 0.62 * coatScale + 0.002], noise: 0.01, mat: 5 });
    }
    if (o.badge) {
      const badge = new THREE.BoxGeometry(0.045 * H, 0.02 * H, 0.004);
      B.add(badge, 0xffffff, 'chest', { at: [0.05 * H, -0.005 * H, P.chestR * 0.62 * coatScale + 0.004 + (P.M ? 0 : 0.012 * H)], noise: 0.005, mat: 5, shade: (p) => (p.y > 0.004 * H ? 0.55 : 1) });
    }
    // coat skirt down to mid-thigh / hip (jacket)
    const len = (o.coatLen || 0.24) * H;
    const top = P.hipY + 0.05 * H;
    const skirtProf = [new THREE.Vector2(P.hipR * 1.32, -len - 0.05 * H), new THREE.Vector2(P.hipR * 1.27, -len * 0.55), new THREE.Vector2(P.hipR * 1.18, -0.02 * H), new THREE.Vector2(P.waistR * 1.09, 0.05 * H)];
    const sk = new THREE.LatheGeometry(skirtProf, seg(22), 0, Math.PI * 2);
    {
      const pos = sk.attributes.position;
      for (let i = 0; i < pos.count; i++) pos.setZ(i, pos.getZ(i) * 0.72);
    }
    B.add(sk, o.coat, 'hips', {
      at: [0, top - P.hipY - 0.05 * H, 0], shade: (p) => (Math.abs(p.x) < 0.006 * H && p.z > 0 ? 0.8 : 1), weights: (p) => {
        const t = clamp(-(p.y) / (len + 0.05 * H), 0, 1);
        const w = 0.55 * t * t;
        if (Math.abs(p.x) < 0.01) return [[BI.hips, 1]];
        return [[BI.hips, 1 - w], [p.x > 0 ? BI.thighL : BI.thighR, w]];
      },
    });
  } else {
    // shirt collar / neckline + button placket
    const collar = new THREE.TorusGeometry(0.038 * H, 0.006 * H, 5, seg(16));
    collar.rotateX(Math.PI / 2); collar.scale(1, 1, 0.8);
    B.add(collar, new THREE.Color(shirt).multiplyScalar(0.92).getHex(), 'chest', { at: [0, P.neckBaseY - P.chestY + 0.006 * H, 0.002 * H], noise: 0.01 });
    if (P.M && P.c < 0.3) for (let k = 0; k < 4; k++) B.add(new THREE.SphereGeometry(0.0035 * H, 5, 4), new THREE.Color(shirt).multiplyScalar(0.8).getHex(), 'chest', { at: [0, P.shoulderY - P.chestY - 0.03 * H - k * 0.045 * H, P.chestR * 1.0 + 0.004 * H - k * 0.002 * H], noise: 0, mat: 5 });
  }

  // Pelvis / hips (trousers or skirt top) + belt
  B.add(ellipsoid(P.hipR * 0.98, 0.06 * H, P.hipR * 0.7, seg(16), seg(10)), pants, 'hips', { at: [0, -0.012 * H, -0.004 * H] });
  if (!o.coat && !o.skirt && P.c < 0.5) {
    const belt = new THREE.CylinderGeometry(P.waistR * 1.06, P.waistR * 1.08, 0.016 * H, seg(20), 1, true);
    belt.scale(1, 1, 0.82);
    B.add(belt, 0x2a2420, 'hips', { at: [0, 0.035 * H, 0], noise: 0.02, mat: 5 });
  }

  // Neck (with throat / sternocleidomastoid hint)
  const neck = new THREE.CylinderGeometry(0.025 * H * (P.M ? 1.1 : 1), 0.031 * H * (P.M ? 1.05 : 0.95), P.neckLen + P.headH * 0.3, seg(14), 3);
  neck.translate(0, (P.neckLen + P.headH * 0.3) / 2 - 0.004 * H, 0);
  { const np = neck.attributes.position; for (let i = 0; i < np.count; i++) { if (np.getZ(i) > 0) np.setZ(i, np.getZ(i) * 0.94); } }
  B.add(neck, skin, 'neck', { mat: 1, noise: 0.01, shade: (p) => (p.y < 0.01 * H ? 0.93 : p.z < 0 ? 0.97 : 1), weights: (p) => { const t = clamp(p.y / (P.neckLen + P.headH * 0.15), 0, 1); return [[BI.neck, 1 - t * 0.7], [BI.head, t * 0.7]]; } });

  // ── Head: skull + facial structure (sockets, brow ridge, cheekbones, jaw, chin) ──
  const { rx, ry, rz } = P.hr, hc = P.hc;
  const head = new THREE.SphereGeometry(1, seg(36), seg(28));
  const ex = P.eye.x / rx, ey = P.eye.y / ry;
  const gs = (d2, s) => Math.exp(-d2 / (s * s));
  {
    const pos = head.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      let [x, y, z] = skullShape(pos.getX(i), pos.getY(i), pos.getZ(i));
      if (z > 0.2) {
        const ax = Math.abs(x);
        z -= 0.11 * gs((ax - ex) ** 2 + ((y - ey) * 1.3) ** 2, 0.17);           // eye sockets
        z += 0.05 * gs(((y - ey - 0.2) * 2.2) ** 2 + (ax * 0.8) ** 2, 0.42) * (ax < 0.65 ? 1 : 0.4); // brow ridge
        const cb = 0.06 * gs((ax - 0.52) ** 2 + ((y + 0.16) * 1.4) ** 2, 0.2); // cheekbones
        z += cb * 0.8; x += Math.sign(x) * cb * 0.6;
        z -= 0.04 * gs((ax - 0.36) ** 2 + ((y + 0.42) * 1.2) ** 2, 0.16);     // under-cheek hollow
        z += 0.04 * gs(x * x + ((y + 0.33) * 1.6) ** 2, 0.14);                // philtrum / mouth mound
        z += 0.05 * gs(x * x * 1.6 + ((y + 0.78) * 2.2) ** 2, 0.2);           // chin
      }
      if (y < -0.35) { const k = 1 - (P.M ? 0.06 : 0.12) * smoothstep(-0.35, -0.85, y); x *= k; } // jaw taper
      pos.setXYZ(i, x * rx, y * ry, z * rz);
    }
  }
  const headLocal = new THREE.Vector3(hc.x - W.head.x, hc.y - W.head.y, hc.z - W.head.z);
  const stubble = P.M && P.c < 0.3 && !o.beard && o.age > 18;
  const blush = [1.05, 0.955, 0.94];
  B.add(head, skin, 'head', {
    at: [headLocal.x, headLocal.y, headLocal.z], noise: 0.012, mat: 1,
    shade: (p) => (p.y < -0.25 * ry && p.z > 0 ? 0.97 : 1),
    tint: (p) => {
      const ux = p.x / rx, uy = p.y / ry, uz = p.z / rz;
      if (uz < 0.1) return [1, 1, 1];
      const ax = Math.abs(ux);
      const ch = gs((ax - 0.5) ** 2 + (uy + 0.12) ** 2, 0.2);                     // warm cheeks
      const ue = gs((ax - ex) ** 2 + ((uy - ey + 0.1) * 1.6) ** 2, 0.12) * 0.07;  // under-eye shadow
      const st = stubble ? gs(ux * ux * 0.7 + ((uy + 0.62) * 1.1) ** 2, 0.34) * 0.12 : 0;
      const nl = gs((ax - (0.2 + (-0.28 - uy) * 0.35)) ** 2 * 18, 0.35) * gs((uy + 0.36) ** 2, 0.14) * (o.age > 30 ? 0.08 : 0.04); // nasolabial fold
      const d = ue + st + nl;
      return [lerp(1, blush[0], ch) - d, lerp(1, blush[1], ch) - d * 0.97, lerp(1, blush[2], ch) - d * 0.9];
    },
  });

  const toHead = (x, y, z) => [x - W.head.x, y - W.head.y, z - W.head.z];
  // Nose: narrow bridge widening to a rounded tip, with alae (nostril wings)
  const nose = new THREE.SphereGeometry(1, seg(12), seg(12));
  {
    const np = nose.attributes.position;
    for (let i = 0; i < np.count; i++) {
      const x = np.getX(i), y = np.getY(i), z = np.getZ(i);
      const t = (1 - y) / 2; // 0 top (bridge) → 1 bottom (tip)
      const w = lerp(0.42, 1, Math.pow(t, 1.4));
      const d = lerp(0.45, 1, t);
      np.setXYZ(i, x * w * 0.04 * P.headH, y * 0.088 * P.headH, (z > 0 ? z * d : z * 0.35) * 0.052 * P.headH);
    }
  }
  nose.rotateX(-0.1);
  const noseY = hc.y - P.headH * 0.08;
  B.add(nose, skinDark, 'head', { at: toHead(0, noseY, P.surfZ(0, -P.headH * 0.08) - 0.024 * P.headH), noise: 0.008, mat: 1, shade: (p) => (p.y < -0.07 * P.headH && p.z < 0.03 * P.headH ? 0.62 : 1) });
  for (const sx of [1, -1]) B.add(ellipsoid(0.022 * P.headH, 0.02 * P.headH, 0.026 * P.headH, seg(8), seg(6)), skinDark, 'head', { at: toHead(sx * 0.033 * P.headH, hc.y - P.headH * 0.145, P.surfZ(0.033 * P.headH, -P.headH * 0.145) - 0.008 * P.headH), noise: 0.008, mat: 1, shade: (p) => (p.y < -0.008 * P.headH ? 0.7 : 1) });
  // Ears (with inner shadow)
  for (const s of [1, -1]) {
    const ear = ellipsoid(0.028 * P.headH, 0.085 * P.headH, 0.055 * P.headH, seg(10), seg(8));
    ear.rotateY(s * 0.3);
    B.add(ear, skinDark, 'head', { at: toHead(s * rx * 0.96, hc.y - 0.01 * P.headH, hc.z - 0.05 * P.headH), noise: 0.01, mat: 1, shade: (p) => (p.x * s > 0.012 * P.headH ? 0.82 : 1) });
  }
  // Eyes: glossy eyeball + iris/pupil discs + lids + lashes (lid bones blink)
  const er = P.eye.r;
  const lashColor = new THREE.Color(o.browColor ?? hair).multiplyScalar(0.55).getHex();
  for (const s of ['L', 'R']) {
    const sx = s === 'L' ? 1 : -1;
    const ec = [sx * P.eye.x, hc.y + P.eye.y, P.eye.z];
    B.add(new THREE.SphereGeometry(er, seg(16), seg(12)), 0xf1ece4, 'head', { at: toHead(...ec), noise: 0.004, mat: 3, shade: (p) => (p.z < er * 0.4 ? 0.82 : 1) });
    const iris = new THREE.CircleGeometry(er * 0.5, seg(18));
    { const ip = iris.attributes.position; for (let i = 0; i < ip.count; i++) { const r2 = (ip.getX(i) ** 2 + ip.getY(i) ** 2) / (er * er * 0.25); ip.setZ(i, (1 - r2) * er * 0.06); } }
    const irisCol = new THREE.Color(o.eyeColor || 0x3a2416).multiplyScalar(1.45);
    B.add(iris, irisCol.getHex(), 'head', { at: toHead(ec[0], ec[1], ec[2] + er * 0.985), noise: 0.05, mat: 3, tint: (p) => { const r = Math.hypot(p.x, p.y) / (er * 0.5); return r > 0.86 ? [0.5, 0.5, 0.5] : [0.85 + 0.35 * r, 0.85 + 0.3 * r, 0.85 + 0.25 * r]; } });
    B.add(new THREE.CircleGeometry(er * 0.21, seg(12)), 0x040404, 'head', { at: toHead(ec[0], ec[1], ec[2] + er * 1.05), noise: 0, mat: 3 });
    // upper lid shell (skin) — rotated by lid bone
    const lid = new THREE.SphereGeometry(er * 1.1, seg(16), seg(8), 0, Math.PI * 2, 0, 1.15);
    lid.rotateX(0.12);
    B.add(lid, skinDark, 'lid' + s, { noise: 0.008, mat: 1, shade: (p) => (p.y < er * 0.6 ? 0.88 : 1) });
    // upper lash line (dark, follows lid)
    const lash = new THREE.TorusGeometry(er * 1.02, er * 0.085, 3, seg(14), Math.PI);
    lash.rotateX(Math.PI / 2); lash.translate(0, Math.cos(1.15) * er * 1.1, 0); lash.rotateX(0.12);
    { const lp = lash.attributes.position; for (let i = 0; i < lp.count; i++) { if (lp.getZ(i) < er * 0.15) lp.setY(i, lp.getY(i) - er * 0.05); } }
    B.add(lash, lashColor, 'lid' + s, { noise: 0.02, mat: 2 });
    // lower lid shell (almond-shaped eye opening) + soft rim
    const lowShell = new THREE.SphereGeometry(er * 1.07, seg(16), seg(6), 0, Math.PI * 2, Math.PI - 1.22, 1.22);
    lowShell.rotateX(-0.18);
    B.add(lowShell, skinDark, 'head', { at: toHead(...ec), noise: 0.008, mat: 1, shade: (p) => (p.y > -er * 0.5 ? 0.9 : 1) });
    const low = new THREE.TorusGeometry(er * 0.9, er * 0.07, 4, seg(12), Math.PI);
    low.rotateZ(Math.PI); low.rotateX(0.45);
    B.add(low, skinDark, 'head', { at: toHead(ec[0], ec[1] - er * 0.2, ec[2] + er * 0.12), noise: 0.008, mat: 1 });
    // outer-corner taper: tiny skin wedges narrow the opening at the sides
    for (const side of [1, -1]) {
      const wedge = ellipsoid(er * 0.32, er * 0.5, er * 0.4, seg(8), seg(6));
      B.add(wedge, skinDark, 'head', { at: toHead(ec[0] + side * er * 0.92, ec[1] - er * 0.02, ec[2] + er * 0.42), noise: 0.008, mat: 1 });
    }
    // arched, tapered brows
    const bw = P.headH * 0.135;
    const brow = new THREE.BoxGeometry(bw, P.headH * 0.02, P.headH * 0.022, 8, 1, 1);
    {
      const bp = brow.attributes.position;
      for (let i = 0; i < bp.count; i++) {
        const nx = bp.getX(i) / (bw / 2); // -1..1 (inner→outer depends on side)
        const outer = Math.max(0, nx * sx);
        bp.setY(i, bp.getY(i) * (1 - 0.55 * outer) + P.headH * 0.012 * (1 - nx * nx) - P.headH * 0.006 * outer);
        bp.setZ(i, bp.getZ(i) - P.headH * 0.03 * nx * nx);
      }
    }
    B.add(brow, o.browColor ?? hair, 'brow' + s, { noise: 0.05, mat: 2 });
  }
  // Mouth: interior, sculpted upper lip (head + corners), fuller lower lip (jaw + corners)
  const mY = hc.y + P.mouth.y, mZ = P.surfZ(0, P.mouth.y);
  const interior = ellipsoid(P.mouth.x * 0.85, P.headH * 0.014, P.headH * 0.008, seg(10), seg(6));
  B.add(interior, 0x2a1214, 'head', { at: toHead(0, mY - P.headH * 0.008, mZ - P.headH * 0.002), noise: 0.01, mat: 4, weights: (p) => (p.y < 0 ? [[BI.jaw, 1]] : [[BI.head, 1]]) });
  const cornerW = (centerBone) => (p) => {
    const t = clamp((Math.abs(p.x) / P.mouth.x - 0.35) / 0.6, 0, 1);
    const cb = p.x > 0 ? BI.mouthL : BI.mouthR;
    return [[BI[centerBone], 1 - t], [cb, t]];
  };
  const lipShape = (g, yCurve, zWrap) => {
    const lp = g.attributes.position;
    for (let i = 0; i < lp.count; i++) { const u = lp.getX(i) / P.mouth.x; lp.setY(i, lp.getY(i) + yCurve * u * u * P.headH); lp.setZ(i, lp.getZ(i) - zWrap * u * u * P.headH); }
    return g;
  };
  {
    const lipU = lipShape(ellipsoid(P.mouth.x * 1.02, P.headH * 0.0135, P.headH * 0.022, seg(14), seg(8)), -0.006, 0.026);
    { const lp = lipU.attributes.position; for (let i = 0; i < lp.count; i++) { const u = lp.getX(i) / P.mouth.x; if (lp.getY(i) > 0) lp.setY(i, lp.getY(i) - 0.004 * P.headH * Math.exp(-(u * u) / 0.02)); } } // cupid's bow
    B.add(lipU, lip, 'head', { at: toHead(0, mY + P.headH * 0.011, mZ - P.headH * 0.01), weights: cornerW('head'), noise: 0.01, mat: 4 });
    const lipL = lipShape(ellipsoid(P.mouth.x * 0.9, P.headH * 0.017, P.headH * 0.024, seg(14), seg(8)), 0.005, 0.03);
    B.add(lipL, lip, 'head', { at: toHead(0, mY - P.headH * 0.017, mZ - P.headH * 0.012), weights: cornerW('jaw'), noise: 0.01, mat: 4 });
  }

  // ── Hair ──
  addHair(B, o, P, W, seg, toHead);
  if (o.beard) {
    const beard = new THREE.SphereGeometry(1, seg(24), seg(16));
    const pos = beard.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const keep = pos.getY(i) < -0.12 && pos.getZ(i) > -0.35;
      const [x, y, z] = skullShape(pos.getX(i), pos.getY(i), pos.getZ(i));
      const s = keep ? 1.05 + (y < -0.6 ? 0.02 : 0) : 0.8;
      pos.setXYZ(i, x * rx * s, y * ry * s, z * rz * s);
    }
    B.add(beard, hair, 'head', { at: [headLocal.x, headLocal.y, headLocal.z], mat: 2, weights: (p) => (p.y < -0.5 * ry ? [[BI.jaw, 0.6], [BI.head, 0.4]] : [[BI.head, 1]]), noise: 0.08 });
  }
  if (o.glasses) {
    for (const s of [1, -1]) {
      const ring = new THREE.TorusGeometry(P.eye.r * 1.55, P.headH * 0.007, 4, seg(16));
      B.add(ring, 0x1d1d1f, 'head', { at: toHead(s * P.eye.x, hc.y + P.eye.y, P.surfZ(P.eye.x, P.eye.y) + P.eye.r * 0.78), noise: 0, mat: 5 });
      const temple = new THREE.BoxGeometry(P.headH * 0.008, P.headH * 0.008, rz * 0.95);
      B.add(temple, 0x1d1d1f, 'head', { at: toHead(s * rx * 0.95, hc.y + P.eye.y + P.headH * 0.01, hc.z + rz * 0.35), noise: 0, mat: 5 });
    }
    const bridge = new THREE.BoxGeometry(P.headH * 0.07, P.headH * 0.008, P.headH * 0.008);
    B.add(bridge, 0x1d1d1f, 'head', { at: toHead(0, hc.y + P.eye.y + P.headH * 0.01, P.surfZ(0, P.eye.y) + P.eye.r * 0.85), noise: 0, mat: 5 });
  }

  // ── Arms ──
  const sleeveColor = o.coat || shirt;
  for (const s of ['L', 'R']) {
    const ua = 'upperArm' + s, fa = 'foreArm' + s, hd = 'hand' + s;
    const r1 = 0.029 * H * Math.pow(P.bw, 0.5) * (o.coat ? 1.1 : 1) * (P.M ? 1.04 : 0.96), r2 = 0.0245 * H * Math.pow(P.bw, 0.4) * (o.coat ? 1.1 : 1);
    if (o.sleeves === 'short' && !o.coat) {
      const sl = limb(r1 * 1.1, r1 * 1.02, P.upperArm * 0.5, seg(14), 0.35);
      B.add(sl, shirt, ua, { weights: limbWeights('chest', ua, null, P.upperArm) });
      B.add(limb(r1 * 0.92, r2 * 0.95, P.upperArm, seg(14), 0.35), skin, ua, { mat: 1, weights: limbWeights('chest', ua, fa, P.upperArm) });
      B.add(limb(r2 * 0.95, 0.022 * H, P.foreArm, seg(14)), skin, fa, { mat: 1, weights: limbWeights(ua, fa, hd, P.foreArm) });
    } else {
      B.add(limb(r1, r2, P.upperArm, seg(14), 0.45), sleeveColor, ua, { weights: limbWeights('chest', ua, fa, P.upperArm), shade: (p) => (p.x * (s === 'L' ? -1 : 1) > r1 * 0.5 ? 0.95 : 1) });
      B.add(limb(r2, 0.026 * H * (o.coat ? 1.15 : 1), P.foreArm * 0.93, seg(14)), sleeveColor, fa, { weights: limbWeights(ua, fa, hd, P.foreArm) });
      B.add(limb(0.022 * H, 0.021 * H, P.foreArm * 0.12, seg(10)), skin, fa, { at: [0, -P.foreArm * 0.86, 0], mat: 1 });
    }
    // hand: palm + 4 fingers + thumb (individual fingers at high detail)
    const sx = s === 'L' ? 1 : -1;
    const palm = new THREE.BoxGeometry(0.019 * H, 0.05 * H, 0.046 * H, 1, 2, 2);
    roundBox(palm, 0.008 * H);
    B.add(palm, skin, hd, { at: [0, -0.03 * H, 0.004 * H], mat: 1, noise: 0.01 });
    if (lod === 0) {
      const fz = [0.0165, 0.0055, -0.0055, -0.0165], fl = [0.042, 0.046, 0.043, 0.034];
      for (let f = 0; f < 4; f++) {
        const fg = limb(0.0058 * H, 0.0049 * H, fl[f] * H, 6);
        fg.rotateZ(sx * -0.18);
        B.add(fg, skin, hd, { at: [sx * -0.001 * H, -0.054 * H, (fz[f] + 0.004) * H], mat: 1, noise: 0.01, shade: (p) => (p.y < -fl[f] * H * 0.85 ? 1.06 : 1) });
      }
    } else {
      const fingers = new THREE.BoxGeometry(0.015 * H, 0.044 * H, 0.043 * H, 1, 2, 2);
      roundBox(fingers, 0.007 * H); fingers.translate(0, -0.022 * H, 0); fingers.rotateZ(sx * -0.12);
      B.add(fingers, skin, hd, { at: [0, -0.056 * H, 0.004 * H], mat: 1 });
    }
    const thumb = limb(0.0075 * H, 0.0062 * H, 0.04 * H, seg(8));
    thumb.rotateX(-0.6); thumb.rotateZ(sx * 0.35);
    B.add(thumb, skin, hd, { at: [sx * -0.005 * H, -0.015 * H, 0.025 * H], mat: 1 });
  }

  // ── Legs ──
  for (const s of ['L', 'R']) {
    const th = 'thigh' + s, sh = 'shin' + s, ft = 'foot' + s;
    const tr1 = 0.054 * H * Math.pow(P.bw, 0.7), tr2 = 0.037 * H * Math.pow(P.bw, 0.5);
    const legTop = o.skirt ? skin : pants;
    const thigh = limb(tr1, tr2, P.thighLen, seg(14));
    B.add(thigh, legTop, th, { mat: o.skirt ? 1 : 0, weights: limbWeights('hips', th, sh, P.thighLen, 0.18, 0.14), shade: (p) => (p.y < -P.thighLen * 0.95 && !o.skirt ? 0.92 : 1) });
    const shin = limb(tr2 * 0.95, 0.025 * H, P.shinLen, seg(14));
    if (o.skirt || o.shorts) { const sp = shin.attributes.position; for (let i = 0; i < sp.count; i++) { const t = -sp.getY(i) / P.shinLen; if (sp.getZ(i) < 0 && t > 0.15 && t < 0.6) sp.setZ(i, sp.getZ(i) * (1 + 0.18 * Math.sin((t - 0.15) / 0.45 * Math.PI))); } } // calf
    B.add(shin, o.skirt || o.shorts ? skin : pants, sh, { mat: o.skirt || o.shorts ? 1 : 0, weights: limbWeights(th, sh, ft, P.shinLen, 0.12, 0.1) });
    if (!o.skirt && !o.shorts) {
      // trouser hem with a slight break over the shoe
      B.add(limb(0.031 * H, 0.033 * H, 0.03 * H, seg(12)), pants, sh, { at: [0, -P.shinLen + 0.04 * H, 0.002 * H], shade: () => 0.95 });
    }
    // shoe: tapered toe box, sole, heel
    const foot = new THREE.BoxGeometry(0.05 * H, 0.045 * H, 0.145 * H, 2, 2, 4);
    roundBox(foot, 0.014 * H);
    {
      const fp = foot.attributes.position;
      for (let i = 0; i < fp.count; i++) {
        const z = fp.getZ(i) / (0.0725 * H); // -1 heel … +1 toe
        if (z > 0) { fp.setX(i, fp.getX(i) * (1 - 0.22 * z * z)); if (fp.getY(i) > 0) fp.setY(i, fp.getY(i) * (1 - 0.45 * z)); }
      }
    }
    B.add(foot, shoes, ft, { at: [0, -0.024 * H, 0.04 * H], mat: 5, shade: (p) => (p.y < -0.016 * H ? 0.45 : 1) });
  }
  if (o.skirt) {
    const top = P.hipY + 0.03 * H, len = top - (P.kneeY + 0.02 * H);
    const prof = [new THREE.Vector2(P.hipR * 1.6, -len), new THREE.Vector2(P.hipR * 1.38, -len * 0.6), new THREE.Vector2(P.hipR * 1.15, -len * 0.3), new THREE.Vector2(P.waistR * 1.05, 0)];
    const sk = new THREE.LatheGeometry(prof, seg(24));
    const pos = sk.attributes.position; for (let i = 0; i < pos.count; i++) { const a = Math.atan2(pos.getZ(i), pos.getX(i)); const fold = 1 + 0.035 * Math.sin(a * 9) * clamp(-pos.getY(i) / len, 0, 1); pos.setX(i, pos.getX(i) * fold); pos.setZ(i, pos.getZ(i) * 0.8 * fold); }
    B.add(sk, o.skirt, 'hips', { at: [0, top - P.hipY, 0], weights: (p) => { const t = clamp(-p.y / len, 0, 1); const w = 0.45 * t * t; return [[BI.hips, 1 - w], [p.x > 0 ? BI.thighL : BI.thighR, w]]; } });
  }

  // ── Props ──
  if (o.clipboard) {
    const board = new THREE.BoxGeometry(0.2, 0.28, 0.012);
    board.rotateX(-0.2);
    B.add(board, 0x6b4a2b, 'handL', { at: [-0.02, -0.08, 0.1], noise: 0.02 });
    const paper = new THREE.BoxGeometry(0.17, 0.22, 0.004); paper.rotateX(-0.2);
    B.add(paper, 0xf7f7f2, 'handL', { at: [-0.02, -0.09, 0.108], noise: 0.0 });
  }
  if (o.infant) {
    const bundle = ellipsoid(0.11, 0.22, 0.1, seg(12), seg(10));
    bundle.rotateZ(1.2);
    B.add(bundle, 0xd8e8f4, 'chest', { at: [0, -0.12 * H, P.chestR * 0.62 + 0.13] });
    B.add(new THREE.SphereGeometry(0.065, seg(14), seg(12)), o.infantSkin || skin, 'chest', { at: [0.17, -0.06 * H, P.chestR * 0.62 + 0.12], mat: 1 });
  }
  return B.build();
}

// Hair styles as shells around the head (face region pushed inside the skull)
function addHair(B, o, P, W, seg, toHead) {
  const { rx, ry, rz } = P.hr, hc = P.hc;
  const style = o.hair;
  if (style === 'none') return;
  const at = [hc.x - W.head.x, hc.y - W.head.y, hc.z - W.head.z];
  const g = new THREE.SphereGeometry(1, seg(26), seg(18));
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    let keep;
    if (style === 'bald') keep = y < 0.38 && y > -0.2 && z < 0.2;
    else if (style === 'buzz') keep = y > (z > 0.3 ? 0.42 : -0.15);
    else {
      const hairline = (z > 0.25 ? 0.36 - (Math.abs(x) > 0.75 ? 0.4 : 0) : -0.3 + (z < -0.3 ? -0.15 : 0)) + noise1(x * 13 + z * 5) * 0.045;
      keep = y > hairline;
      if ((style === 'long' || style === 'bob') && (z < -0.05 || Math.abs(x) > 0.8)) keep = y > -0.55;
    }
    let s = keep ? (style === 'buzz' ? 1.015 : style === 'curly' ? 1.1 + noise1(x * 9 + y * 7) * 0.03 + noise1(z * 11) * 0.03 : 1.065) : 0.8;
    if (keep && y > 0.6 && style !== 'bald') s += 0.03;
    if (keep && style !== 'buzz' && style !== 'bald') s += noise1(x * 17 + y * 11 + z * 7) * 0.014;
    [x, y, z] = skullShape(x, y, z);
    pos.setXYZ(i, x * rx * s, y * ry * s, z * rz * s);
  }
  B.add(g, o.hairColor, 'head', { at, noise: 0.07, mat: 2 });
  const H = P.H;
  if (style === 'long') {
    const back = new THREE.CylinderGeometry(rx * 1.02, rx * 1.12, P.headH * 0.85, seg(14), 3, true, Math.PI * 0.55, Math.PI * 0.9);
    back.translate(0, -P.headH * 0.38, 0);
    B.add(back, o.hairColor, 'head', { mat: 2, at: [at[0], at[1], at[2] - rz * 0.28], weights: (p) => (p.y < -P.headH * 0.5 ? [[BI.head, 0.5], [BI.neck, 0.5]] : [[BI.head, 1]]), noise: 0.08 });
  } else if (style === 'bob') {
    const back = new THREE.CylinderGeometry(rx * 1.05, rx * 1.12, P.headH * 0.45, seg(14), 2, true, Math.PI * 0.4, Math.PI * 1.2);
    back.translate(0, -P.headH * 0.2, 0);
    B.add(back, o.hairColor, 'head', { mat: 2, at: [at[0], at[1], at[2] - rz * 0.15], noise: 0.08 });
  } else if (style === 'bun') {
    B.add(new THREE.SphereGeometry(P.headH * 0.15, seg(10), seg(8)), o.hairColor, 'head', { mat: 2, at: [at[0], at[1] + ry * 0.45, at[2] - rz * 0.85], noise: 0.08 });
  } else if (style === 'ponytail') {
    const tail = limb(P.headH * 0.07, P.headH * 0.04, P.headH * 0.55, seg(8));
    tail.rotateX(0.35);
    B.add(tail, o.hairColor, 'head', { mat: 2, at: [at[0], at[1] + ry * 0.1, at[2] - rz * 0.95], weights: (p) => (p.y < -P.headH * 0.3 ? [[BI.head, 0.6], [BI.neck, 0.4]] : [[BI.head, 1]]), noise: 0.08 });
  }
  void H;
}

function roundBox(g, r) {
  // Spherify box corners slightly for organic look
  g.computeBoundingBox();
  const bb = g.boundingBox, c = new THREE.Vector3(); bb.getCenter(c);
  const half = new THREE.Vector3().subVectors(bb.max, bb.min).multiplyScalar(0.5);
  const pos = g.attributes.position, p = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i).sub(c);
    const q = new THREE.Vector3(clamp(p.x, -half.x + r, half.x - r), clamp(p.y, -half.y + r, half.y - r), clamp(p.z, -half.z + r, half.z - r));
    const d = new THREE.Vector3().subVectors(p, q);
    if (d.lengthSq() > 1e-9) d.setLength(r);
    p.copy(q).add(d).add(c);
    pos.setXYZ(i, p.x, p.y, p.z);
  }
}

// Shared material (one shader program for all humans)
let SHARED_MAT = null;
const EXPR = { neutral: [0, 0, 0, 0], happy: [1, 0.5, 0.6, 0], concerned: [-0.6, 0, 0.3, 1], pain: [-0.8, 0.2, 0.2, 1.2], serious: [-0.15, 0, -0.4, -0.5], smile: [1.3, 0.7, 0.8, 0] };
function humanMaterial() {
  if (SHARED_MAT) return SHARED_MAT;
  // One shader for every human. Per-vertex material id (aMat):
  // 0 cloth · 1 skin · 2 hair · 3 eye (wet/glossy) · 4 lips · 5 leather/plastic.
  // Adds roughness per material, fabric weave, skin mottling, hair strands, fake
  // subsurface warmth on skin and a soft rim light — no textures, one draw call.
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.72, metalness: 0.0, envMapIntensity: 0.75 });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aMat;\nvarying float vMat;\nvarying vec3 vBind;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvMat = aMat; vBind = position;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying float vMat; varying vec3 vBind;
float hh3(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float vn3(vec3 p) { vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hh3(i), hh3(i + vec3(1,0,0)), f.x), mix(hh3(i + vec3(0,1,0)), hh3(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hh3(i + vec3(0,0,1)), hh3(i + vec3(1,0,1)), f.x), mix(hh3(i + vec3(0,1,1)), hh3(i + vec3(1,1,1)), f.x), f.y), f.z); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
float mCloth = 1.0 - step(0.5, vMat);
float mSkin = 1.0 - step(0.5, abs(vMat - 1.0));
float mHair = 1.0 - step(0.5, abs(vMat - 2.0));
float mEye = 1.0 - step(0.5, abs(vMat - 3.0));
float mLip = 1.0 - step(0.5, abs(vMat - 4.0));
float mHard = 1.0 - step(0.5, abs(vMat - 5.0));
float fadeHF = 1.0 - clamp(length(fwidth(vBind)) * 180.0, 0.0, 1.0);
float strand = vn3(vec3(vBind.x * 420.0, vBind.y * 26.0, vBind.z * 420.0));
float weave = sin(vBind.x * 1100.0 + vBind.z * 1100.0) * sin(vBind.y * 1100.0);
float mott = vn3(vBind * 160.0) - 0.5;
diffuseColor.rgb *= 1.0 + mCloth * ((weave * 0.03) * fadeHF + (vn3(vBind * 38.0) - 0.5) * 0.07);
diffuseColor.rgb *= 1.0 + mSkin * (mott * 0.05 * fadeHF + (vn3(vBind * 22.0) - 0.5) * 0.045);
diffuseColor.rgb *= 1.0 + mHair * ((strand - 0.5) * 0.42 * (0.4 + 0.6 * fadeHF));`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
roughnessFactor = mCloth * (0.86 + mott * 0.08) + mSkin * (0.52 + mott * 0.12) + mHair * (0.38 + strand * 0.25) + mEye * 0.06 + mLip * 0.34 + mHard * 0.3;`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
{ vec3 vd = normalize(vViewPosition); float fres = pow(1.0 - clamp(dot(normal, vd), 0.0, 1.0), 3.0);
  totalEmissiveRadiance += diffuseColor.rgb * (mSkin * (0.06 + fres * 0.22) * vec3(1.0, 0.68, 0.55) + (mCloth + mHair) * fres * 0.07 + mLip * 0.05 * vec3(1.0, 0.6, 0.6)); }`);
  };
  m.customProgramCacheKey = () => 'rx-human-v2';
  SHARED_MAT = m;
  return SHARED_MAT;
}

// ─────────────────────────────────────────────────────────────────────────────
export class Character {
  constructor(desc) {
    this.desc = desc;
    this.P = proportions(desc);
    this.W = boneWorldPositions(this.P);
    this.group = new THREE.Group();
    this.group.name = 'char';
    // bones
    this.bones = {};
    for (const name of BONES) { const b = new THREE.Bone(); b.name = name; this.bones[name] = b; }
    for (const name of BONES) {
      const b = this.bones[name];
      const par = PARENT[name];
      const wp = this.W[name];
      if (par) { const pp = this.W[par]; b.position.set(wp.x - pp.x, wp.y - pp.y, wp.z - pp.z); this.bones[par].add(b); }
      else b.position.copy(wp);
    }
    for (const n of BONES) this.bones[n].rotation.order = /Arm|hand|thigh|shin|foot/.test(n) ? 'ZXY' : 'YXZ';
    this.bindPos = Object.fromEntries(BONES.map((n) => [n, this.bones[n].position.clone()]));
    this.skeleton = new THREE.Skeleton(BONES.map((n) => this.bones[n]));
    // realistic body: Rocketbox avatar (textured, mocap animated) → generated MakeHuman body → procedural body
    this.real = Rocketbox.create(this) || RealHumans.create(this);
    if (this.real) {
      this.mesh = null;
      this.group.add(this.bones.root);
      this.group.add(this.real.wrap);
      if (this.real.kind === 'rb') this._rbExtras(desc); else this._realExtras(desc);
    } else {
      this.geoHi = buildGeometry(desc, this.P, this.W, 0);
      this.geoLo = buildGeometry(desc, this.P, this.W, 1);
      this.mesh = new THREE.SkinnedMesh(this.geoHi, humanMaterial());
      this.mesh.add(this.bones.root);
      this.mesh.bind(this.skeleton);
      this.mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, this.P.H * 0.5, 0), this.P.H * 0.85);
      this.mesh.frustumCulled = true;
      this.mesh.castShadow = Character.shadows;
      this.group.add(this.mesh);
    }
    this.lod = 0;
    // props (non-skinned, attached to bones)
    this.props = {};
    // animation state
    this.t = Math.random() * 100;
    this.phase = 0;
    this.speed = 0;
    this.targetSpeed = 0;
    this.heading = 0;
    this.path = null;
    this.onArrive = null;
    this.walkSpeed = desc.age >= 68 ? 0.8 : desc.age < 10 ? 1.0 : 1.2;
    this.runSpeed = 3.4;
    this.sitW = 0; this.sitTarget = 0;
    this.talking = false; this.talkW = 0;
    this.action = null; this.actionW = 0; this.actionT = 0;
    this.gesture = desc.gesture || 'none'; this.gestureW = 0; this.gestureTimer = 3 + Math.random() * 3; this.gestureOn = false;
    this.expression = 'neutral';
    this.exp = { cy: 0, cx: 0, browY: 0, browRot: 0 };
    this.blinkT = 2 + Math.random() * 3; this.blink = 0;
    this.lookTarget = null; this.look = { yaw: 0, pitch: 0 };
    this.jawOpen = 0;
    this.lip = null;         // loudness (0…1) of this character's recorded line while it plays (lip-sync), else null
    this.turnRate = 0; this.moveDir = 1;
    this.limp = desc.gesture === 'limp';
    this.onStep = null;
    this.onCough = null;
    this._lastStepSign = 0;
    this.visible = true;
    this.poseTmp = {};
    for (const n of BONES) this.poseTmp[n] = [0, 0, 0];
  }

  setLOD(l) {
    if (l === this.lod) return;
    this.lod = l;
    if (this.mesh) this.mesh.geometry = l === 0 ? this.geoHi : this.geoLo;
    if (this.real) this.real.setDetail(l === 0);
  }

  /** Accessories for Rocketbox avatars (their clothes, hair and badges are part of the model). */
  _rbExtras(d) {
    const mat = (c, r = 0.6, m = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
    const put = (bone, mesh, pos, rot) => { const f = this.real.frame(bone); f.add(mesh); mesh.position.set(...pos); if (rot) mesh.rotation.set(...rot); mesh.castShadow = false; return mesh; };
    if (d.clipboard) {
      const g = new THREE.Group();
      const board = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.28, 0.012), mat(0x6b4a2b, 0.7));
      const paper = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.22, 0.004), mat(0xf7f7f2, 0.9)); paper.position.set(0, -0.01, 0.008);
      const clip = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.025, 0.02), mat(0xb0b4b8, 0.3, 0.8)); clip.position.set(0, 0.13, 0.008);
      g.add(board, paper, clip);
      put('handL', g, [-0.02, -0.09, 0.1], [-0.2, 0, 0]);
    }
    if (d.infant) {
      const H = this.P.H, g = new THREE.Group();
      const bundle = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), mat(0xd8e8f4, 0.85)); bundle.scale.set(0.1, 0.21, 0.095); bundle.rotation.z = 1.2;
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.062, 16, 12), mat(d.infantSkin || 0xc68a64, 0.6)); head.position.set(0.17, 0.05, 0);
      g.add(bundle, head);
      put('chest', g, [0, -0.12 * H, 0.2]);
    }
  }

  /** Accessories for realistic bodies (the procedural body models these in its geometry). */
  _realExtras(d) {
    const H = this.P.H;
    const mat = (c, r = 0.6, m = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
    const put = (bone, mesh, pos, rot) => { const f = this.real.frame(bone); f.add(mesh); mesh.position.set(...pos); if (rot) mesh.rotation.set(...rot); mesh.castShadow = false; return mesh; };
    if (d.clipboard) {
      const g = new THREE.Group();
      const board = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.28, 0.012), mat(0x6b4a2b, 0.7));
      const paper = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.22, 0.004), mat(0xf7f7f2, 0.9)); paper.position.set(0, -0.01, 0.008);
      const clip = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.025, 0.02), mat(0xb0b4b8, 0.3, 0.8)); clip.position.set(0, 0.13, 0.008);
      g.add(board, paper, clip);
      put('handL', g, [-0.02, -0.09, 0.1], [-0.2, 0, 0]);
    }
    if (d.glasses) {
      const g = new THREE.Group(), fm = mat(0x1d1d1f, 0.35, 0.3);
      for (const sx of [1, -1]) { const ring = new THREE.Mesh(new THREE.TorusGeometry(0.019, 0.0018, 6, 20), fm); ring.position.x = sx * 0.032; g.add(ring); const temple = new THREE.Mesh(new THREE.BoxGeometry(0.002, 0.002, 0.1), fm); temple.position.set(sx * 0.068, 0.004, -0.05); g.add(temple); }
      const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.002, 0.002), fm); bridge.position.y = 0.004; g.add(bridge);
      const e = this.real.eyeCenter();
      g.scale.setScalar(H / 1.7);
      put('head', g, [0, e[1] + 0.004, e[2] + 0.024 * H / 1.7]);
    }
    if (d.sex === 'F' && ['long', 'bob', 'curly'].includes(d.hair)) {
      // hair volume: lathe around the skull, open at the face, flowing down to the chosen length
      const e = this.real.eyeCenter(), k = H / 1.62, cr = d.hair === 'curly' ? 0.012 : 0;
      const prof = [[0.0, 0.104], [0.034, 0.1], [0.062, 0.088], [0.081, 0.064], [0.09, 0.028], [0.093, -0.02]];
      if (d.hair === 'long') prof.push([0.095, -0.08], [0.1, -0.15], [0.106, -0.22], [0.109, -0.27], [0.1, -0.285]);
      else prof.push([0.093, -0.07], [0.087, -0.1], [0.079, -0.104]);
      const toV = (arr) => arr.map(([r, y]) => new THREE.Vector2((r + (r > 0.03 ? cr : 0)) * k, y * k));
      const shape = (geo) => { const gp = geo.attributes.position; for (let i = 0; i < gp.count; i++) { gp.setZ(i, gp.getZ(i) * 1.16); const y = gp.getY(i); if (y < 0) gp.setX(i, gp.getX(i) * (1 + 0.025 * Math.sin(y * 160 + gp.getZ(i) * 90))); } geo.computeVertexNormals(); return geo; };
      const open = 1.55;
      // crown dome: closed all round (hairline across the forehead) · lower part: open at the face
      const domeGeo = shape(new THREE.LatheGeometry(toV([...prof.slice(0, 4), [0.085, 0.05]]), 36));
      const lowGeo = shape(new THREE.LatheGeometry(toV([[0.085, 0.05], ...prof.slice(4)]), 36, open / 2, Math.PI * 2 - open));
      const hv = this.real.mats.hairVol || (this.real.mats.hairVol = Object.assign(this.real.mats.hair.clone(), { vertexColors: false }));
      hv.onBeforeCompile = this.real.mats.hair.onBeforeCompile; hv.customProgramCacheKey = () => 'rxp-hairvol';
      const vol = new THREE.Group(); vol.add(new THREE.Mesh(domeGeo, hv), new THREE.Mesh(lowGeo, hv));
      put('head', vol, [0, e[1] + 0.012 * k, e[2] - 0.079 * k]);
    }
    if (d.hair === 'bun' || d.hair === 'ponytail') {
      const e = this.real.eyeCenter(), k = H / 1.62, hm = this.real.mats.hair;
      if (d.hair === 'bun') put('head', new THREE.Mesh(new THREE.SphereGeometry(0.046 * k, 18, 14), hm), [0, e[1] + 0.06 * k, e[2] - 0.135 * k]);
      else { const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.024 * k, 0.16 * k, 6, 12), hm); put('head', tail, [0, e[1] - 0.03 * k, e[2] - 0.15 * k], [0.3, 0, 0]); }
    }
    if (d.badge) put('chest', new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.022, 0.004), mat(0xffffff, 0.4)), [0.07 * H / 1.66, 0.02, 0.115 * H / 1.66]);
    if (d.infant) {
      const g = new THREE.Group();
      const bundle = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), mat(0xd8e8f4, 0.85)); bundle.scale.set(0.1, 0.21, 0.095); bundle.rotation.z = 1.2;
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.062, 16, 12), mat(d.infantSkin || d.skin, 0.6)); head.position.set(0.17, 0.05, 0);
      g.add(bundle, head);
      put('chest', g, [0, -0.12 * H, 0.2]);
    }
  }

  attachProp(name, mesh, bone = 'handR', offset = [0, -0.1, 0.03]) {
    (this.real ? this.real.frame(bone) : this.bones[bone]).add(mesh);
    mesh.position.set(...offset);
    mesh.visible = false;
    this.props[name] = mesh;
  }
  showProp(name, v) { if (this.props[name]) this.props[name].visible = v; }

  get position() { return this.group.position; }

  /** Walk along points. backward: step back to them, facing away (e.g. backing up to a chair). */
  walkPath(points, { run = false, onArrive = null, speed = null, backward = false } = {}) {
    this.path = points.map((p) => p.clone ? p.clone() : new THREE.Vector3(p.x, 0, p.z));
    this.targetSpeed = speed || (run ? this.runSpeed : this.walkSpeed);
    this.onArrive = onArrive;
    this.backward = backward;
    this.sitTarget = 0;
    this.faceAngle = null;
  }
  stop() { this.path = null; this.targetSpeed = 0; }
  faceTo(angle) { this.faceAngle = angle; }
  sit(v) { this.sitTarget = v ? 1 : 0; }
  setAction(name, dur = 1.6) { this.action = name; this.actionT = dur; }
  say(on) { this.talking = on; }

  dispose() { if (this.real) this.real.dispose(); else { this.geoHi.dispose(); this.geoLo.dispose(); } this.skeleton.dispose(); }

  /** Per-frame update. extMove: {heading, speed} when the game moves this character (player control) */
  update(dt, cameraPos, extMove) {
    this.t += dt;
    const g = this.group;
    const h0 = this.heading;
    this.moveDir = 1;
    // ── movement ──
    if (extMove) {
      this.speed = extMove.speed;
      if (extMove.heading != null) this.heading = extMove.heading;
    } else if (this.path && this.path.length) {
      const tgt = this.path[0];
      const dx = tgt.x - g.position.x, dz = tgt.z - g.position.z;
      const d = Math.hypot(dx, dz);
      const last = this.path.length === 1;
      if (d < (last ? 0.05 : 0.22)) {
        this.path.shift();
        if (!this.path.length) {
          this.path = null; this.targetSpeed = 0;
          const cb = this.onArrive; this.onArrive = null; if (cb) cb(this);
        }
      } else {
        // people walk the way they face: turn towards the next point, slowing down (or turning on
        // the spot) for sharp corners instead of sliding sideways round them
        const back = this.backward ? -1 : 1;
        const want = Math.atan2(dx * back, dz * back);
        this.heading = angleDamp(this.heading, want, 7, dt);
        const err = Math.abs(Math.atan2(Math.sin(want - this.heading), Math.cos(want - this.heading)));
        const sp = (last ? Math.min(this.targetSpeed, d * 2.2 + 0.12) : this.targetSpeed) * clamp((Math.cos(err) - 0.25) / 0.6, 0, 1);
        this.speed = damp(this.speed, sp, sp < this.speed ? 9 : 6, dt);
        const step = Math.min(d, this.speed * dt);
        // along the body's facing, homing in on the point (straight onto the final spot)
        const k = last && d < 0.3 ? 1 : 0.3;
        let mx = Math.sin(this.heading) * back * (1 - k) + (dx / d) * k, mz = Math.cos(this.heading) * back * (1 - k) + (dz / d) * k;
        const ml = Math.hypot(mx, mz) || 1; mx /= ml; mz /= ml;
        g.position.x += mx * step; g.position.z += mz * step;
        this.moveDir = back;
      }
    } else {
      this.speed = damp(this.speed, 0, 10, dt);
      if (this.faceAngle != null) this.heading = angleDamp(this.heading, this.faceAngle, 6, dt);
    }
    g.rotation.y = this.heading;
    // turning speed (rad/s) — the animators step the feet round when turning on the spot (jumps = teleports, ignored)
    const dh = Math.atan2(Math.sin(this.heading - h0), Math.cos(this.heading - h0));
    this.turnRate = Math.abs(dh) > 1 ? 0 : damp(this.turnRate || 0, dh / Math.max(dt, 1e-4), 12, dt);

    // LOD by camera distance
    if (cameraPos) {
      const dist = g.position.distanceTo(cameraPos);
      this.setLOD(dist > Character.lodDist * (this.lod === 1 ? 0.9 : 1.1) ? 1 : 0); // hysteresis: no flip-flopping at the boundary
      if (dist > 22) return; // too far — skip animation work
    }
    this._animate(dt);
    if (this.real) this.real.apply(dt);
  }

  _animate(dt) {
    const P = this.P, t = this.t, B = this.bones;
    const pose = this.poseTmp;
    for (const n in pose) { pose[n][0] = 0; pose[n][1] = 0; pose[n][2] = 0; }
    const add = (n, x, y, z, w = 1) => { const r = pose[n]; r[0] += x * w; r[1] += y * w; r[2] += z * w; };
    const mix = (n, x, y, z, w) => { const r = pose[n]; r[0] += (x - r[0]) * w; r[1] += (y - r[1]) * w; r[2] += (z - r[2]) * w; };

    // ── Locomotion blend ──
    const sp = this.speed;
    const walkW = clamp(sp / 0.9, 0, 1);
    const runAmt = clamp((sp - 1.6) / 1.6, 0, 1);
    const strideLen = P.H * (0.42 + runAmt * 0.25) * (P.stoop ? 0.85 : 1);
    this.phase += (sp / strideLen) * Math.PI * dt * (this.moveDir || 1);
    const ph = this.phase;
    const breath = Math.sin(t * 1.7);
    const idleW = 1 - walkW;
    // idle
    add('spine', 0.03 + P.stoop + breath * 0.008, 0, Math.sin(t * 0.35) * 0.015, idleW);
    add('chest', breath * 0.012 + P.stoop * 0.6, 0, 0, idleW);
    add('hips', 0, Math.sin(t * 0.23) * 0.03, Math.sin(t * 0.31) * 0.02, idleW);
    add('upperArmL', 0.04, 0, 0.1 + breath * 0.01, idleW); add('upperArmR', 0.04, 0, -0.1 - breath * 0.01, idleW);
    add('foreArmL', -0.2, 0, 0, idleW); add('foreArmR', -0.2, 0, 0, idleW);
    add('handL', -0.05, 0, 0.05, idleW); add('handR', -0.05, 0, -0.05, idleW);
    add('thighL', 0, 0, 0.03, idleW); add('thighR', 0, 0, -0.03, idleW);
    add('shinL', 0.03, 0, 0, idleW); add('shinR', 0.03, 0, 0, idleW);
    add('head', noise1(t * 0.25 + 3) * 0.05 + P.stoop * -0.6, noise1(t * 0.2) * 0.14, 0, idleW);
    if (this.limp && idleW > 0) { add('thighR', -0.1, 0, 0, idleW); add('shinR', 0.25, 0, 0, idleW); add('hips', 0, 0, 0.04, idleW); }
    // walk / run
    if (walkW > 0) {
      const A = (0.42 + runAmt * 0.32) * (P.stoop ? 0.75 : 1);
      const s = Math.sin(ph), c = Math.cos(ph);
      const limpK = this.limp ? 0.55 : 1;
      add('thighL', -s * A, 0, 0.02, walkW); add('thighR', s * A * limpK, 0, -0.02, walkW);
      const kL = 0.12 + Math.max(0, c) * (0.85 + runAmt * 0.7), kR = 0.12 + Math.max(0, -c) * (0.85 + runAmt * 0.7) * limpK;
      add('shinL', kL, 0, 0, walkW); add('shinR', kR, 0, 0, walkW);
      add('footL', -(-s * A + kL) * 0.55 + 0.1, 0, 0, walkW); add('footR', -(s * A * limpK + kR) * 0.55 + 0.1, 0, 0, walkW);
      const aA = A * (0.75 + runAmt * 0.3);
      add('upperArmL', s * aA, 0, 0.08, walkW); add('upperArmR', -s * aA, 0, -0.08, walkW);
      add('foreArmL', -0.3 - runAmt * 1.0 - Math.max(0, -s) * 0.25, 0, 0, walkW); add('foreArmR', -0.3 - runAmt * 1.0 - Math.max(0, s) * 0.25, 0, 0, walkW);
      add('hips', 0, s * 0.09, (this.limp ? 0.05 : 0), walkW); add('chest', 0, -s * 0.11, 0, walkW);
      add('spine', 0.05 + runAmt * 0.16 + P.stoop, 0, 0, walkW);
      add('head', -0.04 - runAmt * 0.1 + P.stoop * -0.5, s * 0.04, 0, walkW);
      // footsteps on heel strike
      const sign = Math.sign(c);
      if (sign !== this._lastStepSign && sp > 0.4) { this._lastStepSign = sign; if (this.real?.kind !== 'rb') this.onStep?.(this); } // mocap bodies step on their own touch-downs
    }
    // sit
    this.sitW = damp(this.sitW, this.sitTarget, 5, dt);
    if (this.sitW > 0.001) {
      const w = this.sitW;
      mix('thighL', -1.5, 0, 0.08, w); mix('thighR', -1.5, 0, -0.08, w);
      mix('shinL', 1.5, 0, 0, w); mix('shinR', 1.5, 0, 0, w);
      mix('footL', 0, 0, 0, w); mix('footR', 0, 0, 0, w);
      mix('spine', -0.05, 0, 0, w);
      mix('upperArmL', -0.25, -0.5, 0.1, w); mix('upperArmR', -0.25, 0.5, -0.1, w);
      mix('foreArmL', -1.0, 0, 0, w); mix('foreArmR', -1.0, 0, 0, w);
    }

    // ── Talking layer ──
    this.talkW = damp(this.talkW, this.talking ? 1 : 0, 6, dt);
    if (this.talkW > 0.01) {
      const w = this.talkW;
      add('head', Math.sin(t * 2.3) * 0.035 + noise1(t * 1.3) * 0.03, noise1(t * 0.8 + 9) * 0.08, noise1(t * 0.6) * 0.03, w);
      const gp = (Math.sin(t * 0.9) + 1) / 2;
      mix('upperArmR', -0.35 - 0.2 * gp + Math.sin(t * 1.7) * 0.06, 0.35, -0.12, w * (0.55 + 0.45 * gp));
      mix('foreArmR', -1.15 - 0.25 * Math.sin(t * 2.7), -0.4, 0, w * (0.55 + 0.45 * gp));
      mix('handR', -0.2, 0, -0.25 + Math.sin(t * 3.1) * 0.2, w * 0.6);
      const gl = (Math.sin(t * 0.7 + 2) + 1) / 2;
      mix('upperArmL', -0.25 - 0.15 * gl, -0.3, 0.12, w * gl * 0.7);
      mix('foreArmL', -0.95 - 0.2 * Math.sin(t * 2.1 + 1), 0.4, 0, w * gl * 0.7);
    }

    // ── Symptom gesture layer (intermittent) ──
    if (this.gesture && this.gesture !== 'none' && this.gesture !== 'limp' && walkW < 0.3) {
      this.gestureTimer -= dt;
      if (this.gestureTimer <= 0) {
        this.gestureOn = !this.gestureOn;
        this.gestureTimer = this.gestureOn ? 2.4 + Math.random() * 1.2 : 4 + Math.random() * 4;
        if (this.gestureOn && (this.gesture === 'cough' || this.gesture === 'sneeze')) setTimeout(() => this.onCough?.(this), 450);
      }
    } else this.gestureOn = false;
    this.gestureW = damp(this.gestureW, this.gestureOn ? 1 : 0, 5, dt);
    if (this.gestureW > 0.01) this._gesturePose(mix, add, this.gestureW, t);

    // ── Action layer ──
    if (this.action) { this.actionT -= dt; if (this.actionT <= 0 && this.action !== 'clipboard' && this.action !== 'carry') this.action = null; }
    this.actionW = damp(this.actionW, this.action ? 1 : 0, 7, dt);
    if (this.actionW > 0.01) this._actionPose(mix, add, this.actionW, t, this._lastAction = this.action || this._lastAction);

    // ── Look-at (head/neck) ──
    let ty = 0, tp = 0;
    if (this.lookTarget) {
      const g = this.group;
      const head = this.W.head;
      const dx = this.lookTarget.x - g.position.x, dz = this.lookTarget.z - g.position.z;
      const dy = this.lookTarget.y - (g.position.y + head.y * (1 - this.sitW * 0.3));
      let yaw = Math.atan2(dx, dz) - this.heading;
      yaw = Math.atan2(Math.sin(yaw), Math.cos(yaw));
      if (Math.abs(yaw) < 1.9) { ty = clamp(yaw, -1.1, 1.1); tp = clamp(-Math.atan2(dy, Math.hypot(dx, dz)), -0.5, 0.6); }
    }
    this.look.yaw = damp(this.look.yaw, ty, 5, dt); this.look.pitch = damp(this.look.pitch, tp, 5, dt);
    add('neck', this.look.pitch * 0.35, this.look.yaw * 0.4, 0);
    add('head', this.look.pitch * 0.65, this.look.yaw * 0.6, 0);

    // ── Apply rotations ──
    for (const n in pose) { const r = pose[n]; B[n].rotation.set(r[0], r[1], r[2]); }
    // hips height (bob + sitting)
    const bob = walkW * (Math.abs(Math.cos(ph)) - 0.6) * 0.03 * (1 + runAmt);
    const sitDrop = this.sitW * (P.hipY - 0.47);
    B.hips.position.y = this.bindPos.hips.y + bob - sitDrop;
    B.hips.position.z = this.bindPos.hips.z - this.sitW * 0.05;

    // ── Face: expression, blink, jaw ──
    const exprName = (this.gestureW > 0.4 && this._gExpr) ? this._gExpr : this.expression;
    const E = EXPR[exprName] || EXPR.neutral;
    const u = P.headH;
    this.exp.cy = damp(this.exp.cy, E[0], 6, dt); this.exp.cx = damp(this.exp.cx, E[1], 6, dt);
    this.exp.browY = damp(this.exp.browY, E[2], 6, dt); this.exp.browRot = damp(this.exp.browRot, E[3], 6, dt);
    B.mouthL.position.set(this.bindPos.mouthL.x + this.exp.cx * u * 0.012, this.bindPos.mouthL.y + this.exp.cy * u * 0.022, this.bindPos.mouthL.z);
    B.mouthR.position.set(this.bindPos.mouthR.x - this.exp.cx * u * 0.012, this.bindPos.mouthR.y + this.exp.cy * u * 0.022, this.bindPos.mouthR.z);
    B.browL.position.y = this.bindPos.browL.y + this.exp.browY * u * 0.018;
    B.browR.position.y = this.bindPos.browR.y + this.exp.browY * u * 0.018;
    B.browL.rotation.z = -this.exp.browRot * 0.22; B.browR.rotation.z = this.exp.browRot * 0.22;
    this.blinkT -= dt;
    if (this.blinkT <= 0) { this.blink = 1; this.blinkT = 2.2 + Math.random() * 3.5; }
    this.blink = Math.max(0, this.blink - dt * 7);
    const lid = Math.sin(Math.min(1, this.blink) * Math.PI) * 1.25 + (exprName === 'pain' ? 0.25 : 0);
    B.lidL.rotation.x = lid; B.lidR.rotation.x = lid;
    const speak = this.lip != null ? this.lip : this.talking ? Math.max(0, Math.sin(t * 13) * 0.5 + noise1(t * 9) * 0.5) : 0; // lip: loudness of the voice playing
    this.jawOpen = damp(this.jawOpen, speak * 0.13, 18, dt);
    B.jaw.rotation.x = this.jawOpen;
  }

  // Rotation conventions (limb bones use Euler order ZXY):
  //   x: swing (negative = forward / flexion of forearm), y: twist about the bone
  //   (right arm +y = internal rotation toward the body), z: abduction (left +, right −)
  _gesturePose(mix, add, w, t) {
    this._gExpr = null;
    const R = (ua, fa, hd) => { mix('upperArmR', ...ua, w); mix('foreArmR', ...fa, w); if (hd) mix('handR', ...hd, w); };
    const L = (ua, fa, hd) => { mix('upperArmL', ua[0], -ua[1], -ua[2], w); mix('foreArmL', fa[0], -fa[1], -fa[2], w); if (hd) mix('handL', hd[0], -hd[1], -hd[2], w); };
    switch (this.gesture) {
      case 'headache': R([-1.7, 0.75, 0.12], [-2.15, 0, 0], [-0.35, 0, 0]); add('head', 0.15, 0, 0, w); this._gExpr = 'pain'; break;
      case 'cough': case 'sneeze': R([-1.05, 0.75, 0.12], [-2.3, 0, 0], [-0.2, 0, 0]); add('chest', 0.12 * Math.max(0, Math.sin(t * 9)), 0, 0, w); add('head', 0.16, 0, 0, w); break;
      case 'stomach': R([-0.3, 0.95, 0.14], [-1.35, 0, 0]); L([-0.22, 0.9, 0.12], [-1.2, 0, 0]); add('spine', 0.08, 0, 0, w); this._gExpr = 'pain'; break;
      case 'chest': R([-0.4, 1.05, 0.12], [-1.95, 0, 0]); this._gExpr = 'concerned'; break;
      case 'back': R([0.45, 1.25, -0.1], [-1.45, 0, 0]); add('spine', -0.06, 0, 0, w); this._gExpr = 'pain'; break;
      case 'eyes': R([-1.45, 0.7, 0.1], [-2.35, 0, 0]); add('head', 0.1, 0, 0, w); break;
      case 'mouth': R([-1.15, 0.45, -0.05], [-2.4, 0, 0]); add('head', 0, 0, -0.1, w); this._gExpr = 'pain'; break;
      case 'ear': R([-1.0, -0.1, -0.55], [-2.4, 0, 0]); add('head', 0, 0, -0.12, w); break;
      case 'throat': R([-0.75, 0.95, 0.1], [-2.35, 0, 0]); this._gExpr = 'concerned'; break;
      case 'arm': case 'hand': L([-0.5, 0.5, 0.05], [-1.3, 0, 0]); R([-0.5, 0.95, 0.1], [-1.35, 0, 0]); add('head', 0.25, 0, 0, w); break;
      case 'tired': add('spine', 0.14, 0, 0, w); add('head', 0.2, 0, 0, w); break;
      default: break;
    }
  }

  _actionPose(mix, add, w, t, action) {
    const R = (ua, fa, hd) => { mix('upperArmR', ...ua, w); mix('foreArmR', ...fa, w); if (hd) mix('handR', ...hd, w); };
    const L = (ua, fa, hd) => { mix('upperArmL', ua[0], -ua[1], -ua[2], w); mix('foreArmL', fa[0], -fa[1], -fa[2], w); if (hd) mix('handL', hd[0], -hd[1], -hd[2], w); };
    switch (action) {
      case 'reach': case 'give': case 'pay':
        R([-1.2, 0.15, 0.05], [-0.45, 0, 0], [0.1, 0, 0]); add('spine', 0.07, 0, 0, w); add('head', 0.15, 0, 0, w); break;
      case 'take': R([-0.85, 0.3, 0.05], [-1.0, 0, 0]); add('head', 0.15, 0, 0, w); break;
      case 'inspect': R([-0.65, 0.65, 0.08], [-1.35, 0, 0]); L([-0.65, 0.65, 0.08], [-1.35, 0, 0]); add('head', 0.35, 0, 0, w); break;
      case 'type': R([-0.4, 0.45, 0.05], [-1.1 + Math.sin(t * 14) * 0.05, 0, 0]); L([-0.4, 0.45, 0.05], [-1.1 + Math.sin(t * 13 + 1) * 0.05, 0, 0]); add('head', 0.3, 0, 0, w); break;
      case 'clipboard':
        L([-0.35, 0.85, 0.1], [-1.65, 0, 0], [0.15, 0, 0]); R([-0.45, 0.8, 0.1], [-1.5 + Math.sin(t * 8) * 0.05, 0, 0]); add('head', 0.22, 0, 0, w); break;
      case 'carry': L([-0.35, 0.95, 0.08], [-1.6, 0, 0]); R([-0.35, 0.95, 0.08], [-1.6, 0, 0]); add('head', 0.2, 0, 0, w); break;
      case 'wave': R([-0.2, 0, -2.4], [-0.5 + Math.sin(t * 9) * 0.35, 0, 0]); break;
      case 'nod': add('head', Math.sin(t * 7) * 0.18, 0, 0, w); break;
      case 'shrug': R([-0.25, -0.5, -0.35], [-1.3, 0, 0]); L([-0.25, -0.5, -0.35], [-1.3, 0, 0]); add('head', 0, 0, 0.12, w); break;
      default: break;
    }
  }
}

Character.shadows = false;
Character.lodDist = 9;

// ── Character description presets ──
const pickR = (rnd, a) => a[Math.floor(rnd() * a.length)];
export function randomCustomerDesc({ gender, age, seed = Math.floor(Math.random() * 1e9), gesture = 'none' }) {
  const rnd = mulberry32(seed);
  const M = gender === 'M';
  const child = age < 13;
  const elderly = age >= 62;
  const skin = pickR(rnd, SKIN_TONES);
  const hairColor = elderly ? pickR(rnd, [HAIR_COLORS.grey, HAIR_COLORS.white, HAIR_COLORS.grey]) : pickR(rnd, [HAIR_COLORS.black, HAIR_COLORS.black, HAIR_COLORS.darkbrown, HAIR_COLORS.brown, HAIR_COLORS.auburn]);
  const heightBase = child ? lerp(0.86, 1.6, clamp((age - 2) / 13, 0, 1)) : M ? 1.66 + rnd() * 0.18 : 1.53 + rnd() * 0.15;
  const build = child ? 0.95 + rnd() * 0.1 : pickR(rnd, [0.9, 0.95, 1.0, 1.0, 1.08, 1.18]);
  const tops = M ? [0x3d5a80, 0x2f3e46, 0xe0e1dd, 0x8d5b4c, 0x52796f, 0x6c757d, 0x9c6644, 0x1d3557, 0xc9ada7]
    : [0xe76f51, 0x2a9d8f, 0xf4a261, 0x8e7dbe, 0xd88c9a, 0x588157, 0xe9c46a, 0x457b9d, 0xb5838d, 0xffffff];
  const bottoms = [0x22303c, 0x3a3a3a, 0x4a5568, 0x6b5b45, 0x2b2d42, 0x354f52, 0x1f2a44];
  const desc = {
    seed, sex: gender, age, height: heightBase, build, belly: !child && build > 1.1 && rnd() < 0.7,
    skin, hairColor, eyeColor: pickR(rnd, [0x2b1a10, 0x3a2416, 0x4a3020, 0x1e1410]),
    top: pickR(rnd, tops), bottom: pickR(rnd, bottoms), shoes: pickR(rnd, [0x1f1f1f, 0x3b2a20, 0xeeeeee, 0x5a4636]),
    sleeves: rnd() < 0.55 ? 'short' : 'long',
    hair: M ? (elderly ? pickR(rnd, ['bald', 'short', 'buzz']) : pickR(rnd, ['short', 'short', 'buzz', 'curly'])) : pickR(rnd, elderly ? ['bun', 'bob', 'short'] : ['long', 'long', 'ponytail', 'bun', 'bob', 'curly']),
    beard: M && !child && age > 20 && rnd() < 0.3,
    glasses: !child && (elderly ? rnd() < 0.7 : rnd() < 0.18),
    skirt: !M && !child && rnd() < 0.3 ? pickR(rnd, [0x6d597a, 0x355070, 0xb56576, 0x2b2d42]) : null,
    gesture,
  };
  if (desc.skirt) desc.sleeves = 'long';
  if (child) { desc.top = pickR(rnd, [0xff6b6b, 0x4ecdc4, 0xffd166, 0x06d6a0, 0x118ab2, 0xef476f]); desc.shorts = rnd() < 0.5; desc.beard = false; }
  return desc;
}

export function pharmacistDesc(outfit = {}) {
  if (Rocketbox.has('pharmacistF')) return { seed: 77, sex: 'F', age: 29, height: 1.68, build: 1.0, skin: 0xd9a47c, hairColor: HAIR_COLORS.darkbrown, top: 0xbcd4ee, bottom: 0x1d1f24, shoes: 0x111111, sleeves: 'long', hair: 'bun', avatar: 'pharmacistF' };
  return {
    seed: 77, sex: 'F', age: 30, height: 1.66, build: 1.0, skin: 0xc68a64, hairColor: HAIR_COLORS.black, eyeColor: 0x2b1a10,
    top: outfit.shirt ?? 0x1c9c8c, bottom: 0x2b2d42, shoes: 0x1f1f1f, sleeves: 'long', hair: 'bun', coat: outfit.coat ?? 0xf6f7f5, coatLen: 0.27, badge: true,
  };
}

export function inspectorDesc() {
  if (Rocketbox.has('doctor')) return { seed: 4242, sex: 'M', age: 48, height: 1.79, build: 1.0, skin: 0xd9a47c, hairColor: HAIR_COLORS.black, top: 0xffffff, bottom: 0x222222, shoes: 0x111111, sleeves: 'long', hair: 'short', clipboard: true, avatar: 'doctor' };
  return {
    seed: 4242, sex: 'M', age: 52, height: 1.78, build: 1.04, skin: 0xd9a47c, hairColor: HAIR_COLORS.grey, eyeColor: 0x2b1a10,
    top: 0xffffff, bottom: 0x3a3f46, shoes: 0x111111, sleeves: 'long', hair: 'short', coat: 0x1f2d4d, coatLen: 0.1, tie: 0x7a1f2b, glasses: true, clipboard: true,
  };
}

export function makeProp(kind) {
  let g, m;
  if (kind === 'bag') { g = new THREE.BoxGeometry(0.16, 0.2, 0.08); m = new THREE.MeshStandardMaterial({ color: 0xf2efe6, roughness: 0.9 }); }
  else if (kind === 'card') { g = new THREE.BoxGeometry(0.085, 0.055, 0.004); m = new THREE.MeshStandardMaterial({ color: 0x1d6fb8, roughness: 0.4, metalness: 0.2 }); }
  else if (kind === 'phone') { g = new THREE.BoxGeometry(0.072, 0.15, 0.009); m = new THREE.MeshStandardMaterial({ color: 0x15181d, roughness: 0.25, metalness: 0.4, emissive: 0x2b4f6e, emissiveIntensity: 0.35 }); } // UPI: phone showing the QR scanner
  else if (kind === 'notes') { g = new THREE.BoxGeometry(0.13, 0.065, 0.006); m = new THREE.MeshStandardMaterial({ color: 0xb9a0c9, roughness: 0.85 }); } // a few folded rupee notes
  else if (kind === 'box') { g = new THREE.BoxGeometry(0.09, 0.05, 0.13); m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 }); }
  else { g = new THREE.BoxGeometry(0.1, 0.1, 0.1); m = new THREE.MeshStandardMaterial({ color: 0xff00ff }); }
  const mesh = new THREE.Mesh(g, m);
  return mesh;
}
