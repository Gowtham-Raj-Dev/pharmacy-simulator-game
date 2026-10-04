// Realistic people: Microsoft Rocketbox avatars (MIT licence) — scanned-quality textured
// humans with an 81-bone Biped rig and motion-captured animation (idle, walk, fast walk,
// run, talk, listen, sit). Each character plays the mocap clips through an
// AnimationMixer, synced to its real movement speed so feet don't slide, and the game's
// procedural animator layers on top what mocap can't know about: handing over
// medicines, paying, holding a clipboard, symptom gestures (cough, headache …),
// looking at whoever they talk to, blinking.
//
// Files live in public/people/*.glb (one per avatar). Avatars without their own clips
// share the clips of a same-gender donor (identical Biped bone names).
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';

// role: pharmacist (the player) · doctor (the inspector) · visitor (customers)
// age: 'adult' or 'older' (used for elderly customers)
export const AVATARS = [
  { id: 'pharmacistF', sex: 'F', role: 'pharmacist' },   // the player: Rocketbox Medical_Female_02 (lab coat), 2048² textures
  { id: 'intern', sex: 'M' },
  { id: 'doctor', sex: 'M', role: 'doctor' },
  { id: 'visitorM1', sex: 'M' }, { id: 'visitorM2', sex: 'M' }, { id: 'visitorM3', sex: 'M' }, { id: 'staff', sex: 'M' },
  { id: 'visitorF1', sex: 'F' }, { id: 'visitorF2', sex: 'F' }, { id: 'visitorF3', sex: 'F', age: 'older' },
  { id: 'meena', sex: 'F' }, { id: 'nurse', sex: 'F' }, { id: 'receptionist', sex: 'F' },
  // more visitors from the Rocketbox library (tools/rocketbox-import.mjs)
  { id: 'rbF01', sex: 'F' }, { id: 'rbF02', sex: 'F', age: 'older' }, { id: 'rbF05', sex: 'F' }, { id: 'rbF07', sex: 'F' },
  { id: 'rbF10', sex: 'F' }, { id: 'rbF14', sex: 'F', age: 'older' }, { id: 'rbF15', sex: 'F' },
  { id: 'rbM02', sex: 'M' }, { id: 'rbM03', sex: 'M', age: 'older' }, { id: 'rbM05', sex: 'M', age: 'older' }, { id: 'rbM06', sex: 'M' },
  { id: 'rbM08', sex: 'M' }, { id: 'rbM09', sex: 'M' }, { id: 'rbM12', sex: 'M' }, { id: 'rbM13', sex: 'M', age: 'older' }, { id: 'rbM19', sex: 'M' },
];
const DONOR = { M: 'visitorM1', F: 'visitorF1' };
const CLIPS = ['idle', 'walk', 'walkFast', 'run', 'talk', 'listen', 'sit'];
const LOCO = ['walk', 'walkFast', 'run'];

const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion(), _qd = new THREE.Quaternion();
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3();
const AX = new THREE.Vector3(1, 0, 0), AY = new THREE.Vector3(0, 1, 0), DOWN = new THREE.Vector3(0, -1, 0);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));

const T = new Map();      // id → template (loaded)
const P = new Map();      // id → load promise
const usage = new Map();  // id → number of characters using it (for variety)

function baseUrl() { try { return new URL('people/', document.baseURI).href; } catch { return './people/'; } }
/** .glb normally; hosts that only serve web file types get <id>.json (glTF + base64 buffer) + image files. */
async function loadAvatarFile(id) {
  const loader = new GLTFLoader();
  if (window.RX_PEOPLE_FORMAT !== 'json') return loader.loadAsync(baseUrl() + id + '.glb');
  const res = await fetch(baseUrl() + id + '.json');
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const j = await res.json();
  const b64 = j.extras.rxBin; delete j.extras.rxBin;
  const raw = atob(b64), bin = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bin[i] = raw.charCodeAt(i);
  // rebuild a GLB container in memory (JSON chunk + BIN chunk); images stay external files
  const enc = new TextEncoder().encode(JSON.stringify(j));
  const jl = (enc.length + 3) & ~3, bl = (bin.length + 3) & ~3;
  const buf = new ArrayBuffer(12 + 8 + jl + 8 + bl), dv = new DataView(buf), u8 = new Uint8Array(buf);
  dv.setUint32(0, 0x46546c67, true); dv.setUint32(4, 2, true); dv.setUint32(8, buf.byteLength, true);
  dv.setUint32(12, jl, true); dv.setUint32(16, 0x4e4f534a, true); u8.fill(0x20, 20, 20 + jl); u8.set(enc, 20);
  dv.setUint32(20 + jl, bl, true); dv.setUint32(24 + jl, 0x004e4942, true); u8.set(bin, 28 + jl);
  return loader.parseAsync(buf, baseUrl());
}

export const Rocketbox = {
  enabled: true,
  texBudget: null,     // visitors: { head, body, normal } max texture sizes, or null for full resolution
  playerBudget: null,  // the pharmacist (seen up close all game): its own, larger budget
  maxVisitors: 0,      // 0 = every visitor model; phones load fewer to stay inside GPU memory
  get ready() { return T.size > 0; },
  templates: T,
  has(id) { return T.has(id); },
  info(id) { return AVATARS.find((a) => a.id === id); },
  /** Load one avatar (and its clip donor). Resolves to the template or null. */
  load(id) {
    if (!this.enabled) return Promise.resolve(null);
    if (P.has(id)) return P.get(id);
    const a = this.info(id);
    const pr = (async () => {
      try {
        const donorId = a && DONOR[a.sex] !== id ? DONOR[a.sex] : null;
        const [gltf, donor, runDonor] = await Promise.all([
          loadAvatarFile(id),
          donorId ? this.load(donorId) : null,
          a?.sex === 'F' ? this.load(DONOR.M) : null,
        ]);
        const budget = a?.role === 'pharmacist' ? this.playerBudget : this.texBudget;
        if (budget) await downscale(gltf.scene, budget);
        const t = prepare(id, gltf, donor, runDonor);
        T.set(id, t);
        return t;
      } catch (e) { console.warn('avatar failed to load:', id, e?.message || e); return null; }
    })();
    P.set(id, pr);
    return pr;
  },
  loadAll(ids, onProgress) {
    let n = 0;
    return Promise.all(ids.map((id) => this.load(id).then((t) => { onProgress?.(++n / ids.length); return t; })));
  },
  /** Pick an avatar for a description: least-used visitor of the right sex. */
  pick(desc) {
    if (desc.avatar) return desc.avatar;
    if (desc.age < 13) return null;                       // children use the generated bodies
    const want = desc.age >= 62 ? 'older' : 'adult';
    let list = AVATARS.filter((a) => !a.role && a.sex === desc.sex && T.has(a.id));
    const aged = list.filter((a) => (a.age || 'adult') === want);
    if (aged.length) list = aged;
    if (!list.length) return null;
    let best = null, bu = 1e9;
    for (const a of list) { const u = (usage.get(a.id) || 0) + Math.random() * 0.5; if (u < bu) { bu = u; best = a.id; } }
    return best;
  },
  /** Unique textures of a loaded avatar (to pre-upload them to the GPU without a frame hitch). */
  textures(id) {
    const t = T.get(id), out = new Set();
    t?.scene.traverse((o) => { if (o.isMesh) for (const m of [].concat(o.material)) for (const k of ['map', 'normalMap']) if (m[k]) out.add(m[k]); });
    return [...out];
  },
  visitorIds(sex) {
    let ids = AVATARS.filter((a) => !a.role && (!sex || a.sex === sex)).map((a) => a.id);
    if (this.maxVisitors && ids.length > this.maxVisitors) {
      // keep a balanced, varied subset: user-supplied models + the older visitors first, then alternate F / M
      const pri = (id) => (!id.startsWith('rb') ? 0 : this.info(id).age === 'older' ? 1 : 2);
      const sorted = [...ids].sort((a, b) => pri(a) - pri(b));
      ids = sorted.slice(0, this.maxVisitors);
    }
    return ids;
  },
  create(ch) {
    if (!this.enabled) return null;
    const id = this.pick(ch.desc);
    const t = id && T.get(id);
    if (!t) return null;
    ch.desc.avatar = id;
    usage.set(id, (usage.get(id) || 0) + 1);
    return new RocketBody(ch, t);
  },
};

// ───────────────────────── template preparation ─────────────────────────
function prepare(id, gltf, donor, runDonor) {
  const scene = gltf.scene;
  const bones = {}; const meshes = [];
  scene.traverse((o) => { if (o.isBone) bones[o.name] = o; if (o.isSkinnedMesh) meshes.push(o); });
  scene.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(scene);
  const height = box.max.y - box.min.y;
  // a texture that failed to load (e.g. a sandbox blocking blob: images) would give white people: reject → fallback body
  for (const m of meshes) for (const mat of [].concat(m.material)) if (/_(body|head)$/.test(mat.name) && !mat.map) throw new Error('textures missing');
  for (const m of meshes) {
    m.frustumCulled = true;
    m.castShadow = true; m.receiveShadow = false;
    for (const mat of [].concat(m.material)) tuneMaterial(mat);
  }
  // clips: own, or the donor's (root height rescaled to this body)
  const hipY = (scene.getObjectByName('Bip01') || bones.Bip01_Pelvis).position.y;
  const clips = {};
  for (const c of gltf.animations) clips[c.name] = c;
  if (donor) {
    const k = hipY / donor.hipY;
    for (const name of CLIPS) if (!clips[name] && donor.srcClips[name]) clips[name] = rescaleRoot(donor.srcClips[name], k);
  }
  if (!clips.run && runDonor?.srcClips.run) clips.run = rescaleRoot(runDonor.srcClips.run, hipY / runDonor.hipY);
  if (!clips.run && clips.walkFast) clips.run = clips.walkFast;
  const srcClips = { ...clips };
  // locomotion clips don't animate fingers / face: give them the relaxed idle values
  if (clips.idle) for (const name of LOCO) if (clips[name]) clips[name] = fillFrom(clips[name], clips.idle);
  // rest-pose data for retargeting the procedural action / gesture layer
  const W0 = (n) => bones[n].getWorldQuaternion(new THREE.Quaternion());
  const P0 = (n) => bones[n].getWorldPosition(new THREE.Vector3());
  const align = (a, b) => new THREE.Quaternion().setFromUnitVectors(P0(b).sub(P0(a)).normalize(), DOWN);
  const rt = {};
  for (const s of ['L', 'R']) {
    const ua = `Bip01_${s}_UpperArm`, fa = `Bip01_${s}_Forearm`, hd = `Bip01_${s}_Hand`, fg = `Bip01_${s}_Finger2`;
    rt[s] = {
      ua: { R0: W0(ua), A: align(ua, fa) },
      fa: { R0: W0(fa), A: align(fa, hd) },
      hd: { R0: W0(hd), A: bones[fg] ? align(hd, fg) : align(fa, hd) },
    };
  }
  rt.chest0inv = W0('Bip01_Spine2').invert();
  const t = { id, scene, bones, height, hipY, clips, srcClips, rt, speed: {} };
  if (clips.sit) t.sitPelvis = sampleBone(t, clips.sit, 'Bip01_Pelvis', 0.5);
  for (const name of LOCO) if (clips[name]) t.speed[name] = measureSpeed(t, clips[name]);
  // keep the progression sane if a clip measured oddly
  t.speed.walk = clamp(t.speed.walk || 1.3, 0.9, 1.8);
  t.speed.walkFast = clamp(t.speed.walkFast || 2.0, t.speed.walk + 0.3, 3.0);
  t.speed.run = clamp(t.speed.run || 3.4, t.speed.walkFast + 0.4, 5.0);
  return t;
}

function tuneMaterial(mat) {
  mat.envMapIntensity = 0.75;
  if (mat.metalness > 0.1) mat.metalness = 0;
  if (/head/i.test(mat.name)) mat.roughness = Math.min(mat.roughness, 0.6);
  if (mat.alphaTest > 0 || mat.transparent) {           // hair cards / veil edges
    mat.transparent = false; mat.alphaTest = Math.max(0.4, mat.alphaTest || 0.45);
    mat.alphaToCoverage = true; mat.side = THREE.DoubleSide; mat.depthWrite = true;
  }
  if (mat.map) mat.map.anisotropy = 8;
  // gentle skin warmth: light scattering under the skin keeps faces from looking waxy-grey
  if (/head|body/i.test(mat.name)) {
    mat.onBeforeCompile = (sh) => {
      sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
{ vec3 c = diffuseColor.rgb; float skin = clamp((c.r - c.b) * 3.0 - 0.15, 0.0, 1.0) * step(c.b * 1.05, c.g) ;
  vec3 vd = normalize(vViewPosition); float fres = pow(1.0 - clamp(dot(normal, vd), 0.0, 1.0), 3.0);
  totalEmissiveRadiance += c * skin * (0.05 + fres * 0.12) * vec3(1.0, 0.62, 0.5); }`);
    };
    mat.customProgramCacheKey = () => 'rb-skin';
  }
}

/** Phones: cap texture sizes (faces keep the most detail) to stay inside mobile GPU memory. */
async function downscale(scene, B) {
  const seen = new Set();
  const jobs = [];
  scene.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of [].concat(o.material)) for (const k of ['map', 'normalMap']) {
      const tx = m[k]; if (!tx || seen.has(tx) || !tx.image) continue;
      const s2 = k === 'normalMap' ? B.normal : /head/i.test(m.name) ? B.head : B.body;
      if ((tx.image.width || 0) <= s2) continue;
      seen.add(tx);
      jobs.push((async () => {
        try {
          if (typeof createImageBitmap === 'function') tx.image = await createImageBitmap(tx.image, { resizeWidth: s2, resizeHeight: s2, resizeQuality: 'high' });
          else { const c = document.createElement('canvas'); c.width = c.height = s2; c.getContext('2d').drawImage(tx.image, 0, 0, s2, s2); tx.image = c; }
          tx.needsUpdate = true;
        } catch { /* keep full size */ }
      })());
    }
  });
  await Promise.all(jobs);
}

function rescaleRoot(clip, k) {
  if (Math.abs(k - 1) < 0.005) return clip;
  const c = clip.clone();
  for (const tr of c.tracks) if (tr.name === 'Bip01.position') { const v = tr.values = tr.values.slice(); for (let i = 0; i < v.length; i++) v[i] *= k; }
  return c;
}
function fillFrom(clip, idle) {
  const have = new Set(clip.tracks.map((t) => t.name));
  const extra = [];
  for (const tr of idle.tracks) {
    if (have.has(tr.name) || !tr.name.endsWith('.quaternion') || /Blink|Toe/.test(tr.name)) continue;
    const v = Array.from(tr.values.slice(0, 4));
    extra.push(new THREE.QuaternionKeyframeTrack(tr.name, [0, clip.duration], [...v, ...v]));
  }
  if (!extra.length) return clip;
  return new THREE.AnimationClip(clip.name, clip.duration, [...clip.tracks, ...extra]);
}
function sampleBone(t, clip, name, frac) {
  const s = cloneSkinned(t.scene); let b = null; s.traverse((o) => { if (o.name === name) b = o; });
  const mx = new THREE.AnimationMixer(s); mx.clipAction(clip).play(); mx.setTime(clip.duration * frac); s.updateMatrixWorld(true);
  const p = b.getWorldPosition(new THREE.Vector3()); mx.stopAllAction(); mx.uncacheRoot(s); return p;
}
/** Ground speed of an in-place locomotion clip: how fast a planted foot slides backwards. */
function measureSpeed(t, clip) {
  const s = cloneSkinned(t.scene);
  const bones = {}; s.traverse((o) => { if (o.isBone) bones[o.name] = o; });
  const mx = new THREE.AnimationMixer(s); mx.clipAction(clip).play();
  const N = 48, feet = ['Bip01_L_Foot', 'Bip01_R_Foot'].map((n) => bones[n]).filter(Boolean);
  const rec = feet.map(() => []);
  for (let i = 0; i <= N; i++) {
    mx.setTime((i / N) * clip.duration); s.updateMatrixWorld(true);
    feet.forEach((f, k) => { f.getWorldPosition(_v); rec[k].push([_v.y, _v.z]); });
  }
  const dt = clip.duration / N; let sum = 0, n = 0;
  for (const r of rec) {
    const minY = Math.min(...r.map((p) => p[0]));
    for (let i = 1; i < r.length; i++) if (r[i][0] < minY + 0.02 && r[i - 1][0] < minY + 0.02) { sum += Math.abs(r[i][1] - r[i - 1][1]) / dt; n++; }
  }
  mx.stopAllAction(); mx.uncacheRoot(s);
  return n ? sum / n : 0;
}

// ───────────────────────── per-character body ─────────────────────────
const OUR = { L: ['upperArmL', 'foreArmL', 'handL'], R: ['upperArmR', 'foreArmR', 'handR'] };
const FRAME_BONE = { handR: 'Bip01_R_Hand', handL: 'Bip01_L_Hand', head: 'Bip01_Head', chest: 'Bip01_Spine2', hips: 'Bip01_Pelvis', foreArmR: 'Bip01_R_Forearm', foreArmL: 'Bip01_L_Forearm' };
const ACT_SIDES = { reach: 'R', give: 'R', pay: 'R', take: 'R', wave: 'R', inspect: 'LR', type: 'LR', clipboard: 'LR', carry: 'LR', shrug: 'LR' };
const GES_SIDES = { headache: 'R', cough: 'R', sneeze: 'R', stomach: 'LR', chest: 'R', back: 'R', eyes: 'R', mouth: 'R', ear: 'R', throat: 'R', arm: 'LR', hand: 'LR' };

class RocketBody {
  constructor(ch, t) {
    this.kind = 'rb';
    this.ch = ch; this.t = t;
    this.model = cloneSkinned(t.scene);
    this.b = {}; this.meshes = [];
    // Culling sphere around the whole body. It lives in the MESH's local space, and Rocketbox meshes are
    // rotated −90° about X inside the file — a plain (0, h/2, 0) centre would sit on the floor and leave the
    // head outside, so close-up shots culled the customer for a frame (flicker / vanishing). Convert it.
    this.model.updateMatrixWorld(true);
    const _inv = new THREE.Matrix4();
    this.model.traverse((o) => {
      if (o.isBone) this.b[o.name] = o;
      if (o.isSkinnedMesh) {
        this.meshes.push(o); o.castShadow = ch.constructor.shadows;
        _inv.copy(o.matrixWorld).invert();
        o.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, t.height * 0.5, 0).applyMatrix4(_inv), t.height * 0.8);
      }
    });
    this.s = clamp((ch.desc.height || t.height) / t.height, 0.94, 1.06);
    this.wrap = new THREE.Group(); this.wrap.add(this.model); this.wrap.scale.setScalar(this.s);
    this.mixer = new THREE.AnimationMixer(this.model);
    this.act = {}; this.w = {};
    for (const k of CLIPS) {
      if (!t.clips[k]) continue;
      const a = this.mixer.clipAction(t.clips[k]);
      a.play(); a.setEffectiveWeight(k === 'idle' ? 1 : 0);
      if (LOCO.includes(k)) a.setEffectiveTimeScale(0); else a.time = Math.random() * t.clips[k].duration;
      this.act[k] = a; this.w[k] = k === 'idle' ? 1 : 0;
    }
    this.cyc = Math.random(); this.acc = 0; this.near = true; this.frames = {};
    this.blinkT = 1 + Math.random() * 3; this.blink = 0;
    // (Biped eyelid bones: blink is left to the mocap clips — procedural lid rotation reads poorly on this rig)
    this.lidRest = {};
    this._ourW = {}; for (const k of ['hips', 'spine', 'chest', ...OUR.L, ...OUR.R]) this._ourW[k] = new THREE.Quaternion();
    this._wc = new Map();
    this.mixer.update(0);
  }
  get height() { return this.t.height * this.s; }

  /** Object3D that follows one of our bones' frames (for props: bag, card, clipboard …). */
  frame(ourBone) {
    if (this.frames[ourBone]) return this.frames[ourBone];
    const bone = this.b[FRAME_BONE[ourBone] || 'Bip01_Spine2'];
    const o = new THREE.Object3D();
    const side = ourBone.endsWith('L') ? 'L' : 'R';
    const r = /hand/.test(ourBone) ? this.t.rt[side].hd : /foreArm/.test(ourBone) ? this.t.rt[side].fa : null;
    // our bone frame (at rest: aligned with the character) expressed in the Biped bone's frame
    if (r) o.quaternion.copy(r.A).multiply(r.R0).invert();
    else o.quaternion.copy(this.t.bones[bone.name].getWorldQuaternion(_q3)).invert();
    o.scale.setScalar(1 / this.s);
    bone.add(o);
    this.frames[ourBone] = o;
    return o;
  }

  /** world (model-space) rotation of a bone, from the current local rotations */
  _W(b) {
    let q = this._wc.get(b);
    if (q) return q;
    q = new THREE.Quaternion();
    if (b.parent && b.parent.isBone) q.copy(this._W(b.parent)).multiply(b.quaternion);
    else { q.copy(b.quaternion); let p = b.parent; while (p && p !== this.model) { q.premultiply(p.quaternion); p = p.parent; } }
    this._wc.set(b, q);
    return q;
  }

  update(dt) { this.apply(dt); }

  apply(dt = 1 / 60) {
    const ch = this.ch, t = this.t, A = this.act, W = this.w;
    // far away: animate at half rate
    this.acc += dt;
    if (!this.near && this.acc < 1 / 24) return;
    dt = this.acc; this.acc = 0;
    const sp = ch.speed / this.s;
    const sitting = ch.sitTarget > 0.5 || ch.sitW > 0.5;
    // ── target weights ──
    const moveW = sitting ? 0 : clamp((sp - 0.06) / 0.35, 0, 1);
    const vW = t.speed.walk, vF = t.speed.walkFast, vR = t.speed.run;
    // walk → fast walk → run; each clip may play up to ~30% faster before blending into the next
    let lw = 1, lf = 0, lr = 0;
    const wE = Math.min(vW * 1.2, vF - 0.05), fE = Math.min(vF * 1.3, vR - 0.2);
    if (sp > wE) { const k = clamp((sp - wE) / (vF * 1.05 - wE), 0, 1); lw = 1 - k; lf = k; }
    if (sp > fE && A.run) { const k = clamp((sp - fE) / (vR - fE), 0, 1); lr = k; lf *= 1 - k; lw *= 1 - k; }
    const standW = 1 - moveW;
    const talk = ch.talking && A.talk ? 1 : 0;
    const listen = !talk && A.listen && ch.lookTarget ? 1 : 0;
    const tgt = {
      idle: sitting ? 0 : standW * (1 - talk) * (1 - listen),
      talk: sitting ? 0 : standW * talk,
      listen: sitting ? 0 : standW * listen,
      sit: sitting ? 1 : 0,
      walk: moveW * lw, walkFast: moveW * lf, run: moveW * lr,
    };
    let sum = 0;
    for (const k in A) { W[k] = damp(W[k], tgt[k] || 0, LOCO.includes(k) ? 9 : 5, dt); sum += W[k]; }
    for (const k in A) { const w = sum > 1e-4 ? W[k] / sum : (k === 'idle' ? 1 : 0); A[k].setEffectiveWeight(w); A[k].enabled = w > 0.002; }
    // ── locomotion phase: one shared cycle so walk ↔ run blends keep the feet in step ──
    let rate = 0, lwSum = 0;
    for (const k of LOCO) { if (!A[k]) continue; const w = W[k]; const stride = t.speed[k] * t.clips[k].duration; rate += w * (sp > 0.05 ? sp / stride : 1 / t.clips[k].duration); lwSum += w; }
    if (lwSum > 1e-4) this.cyc = (this.cyc + (rate / lwSum) * dt) % 1;
    for (const k of LOCO) if (A[k]) A[k].time = this.cyc * t.clips[k].duration;
    this.mixer.update(dt);
    // seated: put the pelvis over the chair seat (seat top 0.49 m, centre just behind the character origin)
    const sw = W.sit || 0;
    if (t.sitPelvis) { this.model.position.set(0, sw * (0.58 / this.s - t.sitPelvis.y), sw * (-0.05 / this.s - t.sitPelvis.z)); }
    // ── procedural layers on top of the mocap ──
    this._wc.clear();
    this._overlayArms(ch);
    this._lookAt(ch);
    this._blink(dt);
  }

  _overlayArms(ch) {
    const act = ch.action || ch._lastAction, ges = ch.gestureW > 0.01 ? ch.gesture : null;
    const aw = ch.actionW > 0.01 && act ? ch.actionW : 0, gw = ges ? ch.gestureW : 0;
    const wS = { L: 0, R: 0 };
    for (const s of ['L', 'R']) wS[s] = Math.max(aw && (ACT_SIDES[act] || '').includes(s) ? aw : 0, gw && (GES_SIDES[ges] || '').includes(s) ? gw : 0);
    if (wS.L < 0.01 && wS.R < 0.01) return;
    // our procedural world rotations (character space) for the chest and arms
    const B = ch.bones, O = this._ourW;
    O.hips.copy(B.hips.quaternion); O.spine.copy(O.hips).multiply(B.spine.quaternion); O.chest.copy(O.spine).multiply(B.chest.quaternion);
    const chestInv = _q3.copy(O.chest).invert();
    // mocap chest delta from its rest pose
    const dC = _qd.copy(this._W(this.b.Bip01_Spine2)).multiply(this.t.rt.chest0inv);
    for (const s of ['L', 'R']) {
      const w = wS[s]; if (w < 0.01) continue;
      const [ua, fa, hd] = OUR[s];
      O[ua].copy(O.chest).multiply(B[ua].quaternion); O[fa].copy(O[ua]).multiply(B[fa].quaternion); O[hd].copy(O[fa]).multiply(B[hd].quaternion);
      const rt = this.t.rt[s];
      const chain = [[`Bip01_${s}_UpperArm`, ua, rt.ua], [`Bip01_${s}_Forearm`, fa, rt.fa], [`Bip01_${s}_Hand`, hd, rt.hd]];
      for (const [bn, ok, r] of chain) {
        const bone = this.b[bn]; if (!bone) continue;
        // desired = ΔChest · (our bone relative to our chest) · align · rest
        _q.copy(dC).multiply(_q2.copy(chestInv).multiply(O[ok])).multiply(r.A).multiply(r.R0);
        const pw = this._W(bone.parent);
        _q2.copy(pw).invert().multiply(_q);
        bone.quaternion.slerp(_q2, w);
        this._wc.delete(bone);
      }
    }
  }

  _lookAt(ch) {
    let yaw = ch.look?.yaw || 0, pitch = ch.look?.pitch || 0;
    if (ch.actionW > 0.01 && (ch.action || ch._lastAction) === 'nod') pitch += Math.sin(ch.t * 7) * 0.16 * ch.actionW;
    if (Math.abs(yaw) < 0.002 && Math.abs(pitch) < 0.002) return;
    for (const [n, k] of [['Bip01_Neck', 0.4], ['Bip01_Head', 0.6]]) {
      const bone = this.b[n]; if (!bone) continue;
      const pw = this._W(bone.parent);
      _qd.setFromAxisAngle(AY, yaw * k).multiply(_q.setFromAxisAngle(AX, pitch * k));
      _q2.copy(pw).multiply(bone.quaternion).premultiply(_qd);
      bone.quaternion.copy(_q.copy(pw).invert().multiply(_q2));
      this._wc.delete(bone);
    }
  }

  _blink(dt) {
    this.blinkT -= dt;
    if (this.blinkT <= 0) { this.blink = 1; this.blinkT = 2.2 + Math.random() * 3.8; }
    this.blink = Math.max(0, this.blink - dt * 7);
    const k = Math.sin(Math.min(1, this.blink) * Math.PI);
    if (k < 0.01) return;
    for (const n in this.lidRest) this.b[n].quaternion.multiply(_q.setFromAxisAngle(BLINK_AXIS, BLINK_ANGLE * k));
  }

  eyeCenter() { return [0, 0.08, 0.09]; }
  setDetail(near) { this.near = near; }
  dispose() {
    this.mixer.stopAllAction(); this.mixer.uncacheRoot(this.model);
    for (const m of this.meshes) m.skeleton?.dispose();
    const id = this.ch.desc.avatar; if (id) usage.set(id, Math.max(0, (usage.get(id) || 1) - 1));
  }
}
// eyelid bones: local rotation that closes the upper lid (Biped facial rig)
const BLINK_AXIS = new THREE.Vector3(0, 0, 1);
const BLINK_ANGLE = 0.5;
