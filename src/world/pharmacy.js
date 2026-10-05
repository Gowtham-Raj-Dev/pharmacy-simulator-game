// ─────────────────────────────────────────────────────────────────────────────
// Procedural modern retail pharmacy.
// Performance: static geometry merged per material (few draw calls), products
// rendered as InstancedMesh with a packaging atlas, 3-level shelf LOD
// (HIGH instanced+textured → MEDIUM instanced flat → LOW single facade quad),
// baked floor AO, zone culling for storage/expansion rooms.
// ─────────────────────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import * as TX from './textures.js';
import { SECTIONS } from '../data/products.js';
import { mulberry32, damp } from '../core/util.js';
import { tp, isBi } from '../i18n/i18n.js';

export const ROOM = { minX: -8, maxX: 8, minZ: -9, maxZ: 9, h: 3.4 };

class Batch {
  constructor() { this.g = new Map(); }
  /** shade(x, y, z) → brightness multiplier per vertex (cheap baked light falloff / corner occlusion) */
  add(key, geo, color = 0xffffff, shade = null) {
    const n = geo.attributes.position.count;
    const c = new THREE.Color(color);
    const arr = new Float32Array(n * 3);
    const P = geo.attributes.position;
    for (let i = 0; i < n; i++) { const k = shade ? shade(P.getX(i), P.getY(i), P.getZ(i)) : 1; arr[i * 3] = c.r * k; arr[i * 3 + 1] = c.g * k; arr[i * 3 + 2] = c.b * k; }
    geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
    if (geo.index === null) { const idx = []; for (let i = 0; i < n; i++) idx.push(i); geo.setIndex(idx); }
    if (!this.g.has(key)) this.g.set(key, []);
    this.g.get(key).push(geo);
  }
  build(parent, mats) {
    const meshes = {};
    for (const [key, list] of this.g) {
      const merged = mergeGeometries(list, false);
      list.forEach((x) => x.dispose());
      const m = new THREE.Mesh(merged, mats[key]);
      m.matrixAutoUpdate = false; m.updateMatrix();
      m.receiveShadow = true;
      parent.add(m);
      meshes[key] = m;
    }
    return meshes;
  }
}

/** Parallax-corrected (box-projected) reflections: the environment probe captured inside the
 *  pharmacy is re-projected onto the room box, so floors and glossy fittings reflect the shelves,
 *  counter and ceiling lights in the right place instead of as a distant panorama. */
export const PROBE = new THREE.Vector3(0, 1.55, 0.6);
const BOX_MIN = new THREE.Vector3(ROOM.minX, 0, ROOM.minZ), BOX_MAX = new THREE.Vector3(ROOM.maxX, ROOM.h, ROOM.maxZ);
export function boxProject(mat) {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    prev?.call(mat, sh, r);
    sh.uniforms.uBoxMin = { value: BOX_MIN }; sh.uniforms.uBoxMax = { value: BOX_MAX }; sh.uniforms.uProbe = { value: PROBE };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vRxW;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvRxW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vRxW;\nuniform vec3 uBoxMin; uniform vec3 uBoxMax; uniform vec3 uProbe;')
      .replace('#include <envmap_physical_pars_fragment>', THREE.ShaderChunk.envmap_physical_pars_fragment.replace(
        'reflectVec = inverseTransformDirection( reflectVec, viewMatrix );\n\n\t\t\tvec4 envMapColor',
        `reflectVec = inverseTransformDirection( reflectVec, viewMatrix );
      { vec3 p = clamp(vRxW, uBoxMin + 0.01, uBoxMax - 0.01);
        vec3 rr = max((uBoxMax - p) / reflectVec, (uBoxMin - p) / reflectVec);
        float dist = min(min(rr.x, rr.y), rr.z);
        reflectVec = normalize(p + reflectVec * dist - uProbe); }
      vec4 envMapColor`));
  };
  const key = mat.customProgramCacheKey?.bind(mat);
  mat.customProgramCacheKey = () => (key ? key() : '') + '|boxproj';
  return mat;
}

export function buildPharmacy(scene, { quality = 'medium', anisotropy = 4 } = {}) {
  TX.setAnisotropy(anisotropy);
  const W = {
    root: new THREE.Group(), colliders: [], interactables: [], shelves: [], points: {}, hitBoxes: [],
    zones: {}, mats: {}, lights: {}, screens: {}, dynamic: [],
  };
  scene.add(W.root);
  const root = W.root;
  const batch = new Batch();
  const zoneBatches = { storage: new Batch(), expansion: new Batch() };
  const rnd = mulberry32(99);

  // ── Materials ──
  const M = W.mats;
  M.matte = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0.0 });
  M.gloss = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.28, metalness: 0.05, envMapIntensity: 1.0 });
  M.metal = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.7 });
  M.wall = new THREE.MeshStandardMaterial({ vertexColors: true, map: TX.wallTexture(), roughness: 0.92 });
  M.wood = new THREE.MeshStandardMaterial({ vertexColors: true, map: TX.woodTexture(), roughness: 0.55 });
  M.ceiling = new THREE.MeshBasicMaterial({ vertexColors: true, map: TX.ceilingTexture(), color: 0xd2d5d3 });
  M.glow = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  M.glass = new THREE.MeshStandardMaterial({ color: 0xcfe9ee, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.22, envMapIntensity: 1.4, depthWrite: false });
  M.accent = M.matte; // accent strips use vertex colour; theme recolours via W.setTheme
  boxProject(M.gloss); boxProject(M.metal); boxProject(M.glass);
  const mats = M;

  // helpers ─────────────────────────────────────────
  const tmpM = new THREE.Matrix4();
  // box with bottom at y; rotY around its own centre
  function box(key, w, h, d, x, y, z, color = 0xffffff, rotY = 0, b = batch) {
    const g = new THREE.BoxGeometry(w, h, d);
    if (rotY) g.rotateY(rotY);
    g.translate(x, y + h / 2, z);
    b.add(key, g, color);
    return g;
  }
  function cyl(key, rt, rb, h, x, y, z, color = 0xffffff, seg = 16, b = batch) {
    const g = new THREE.CylinderGeometry(rt, rb, h, seg);
    g.translate(x, y + h / 2, z); b.add(key, g, color); return g;
  }
  function col(minX, maxX, minZ, maxZ, h = 2.5, extra = {}) {
    const c = { minX, maxX, minZ, maxZ, minY: 0, maxY: h, ...extra };
    W.colliders.push(c); return c;
  }
  function plane(mat, w, h, x, y, z, rotY = 0, rotX = 0, parent = root) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    m.position.set(x, y, z); m.rotation.set(rotX, rotY, 0);
    m.matrixAutoUpdate = false; m.updateMatrix();
    parent.add(m); return m;
  }
  // Modern acrylic / lightbox signage material with balanced tone mapping and depth offset
  const signMat = (t, opts = {}) => new THREE.MeshStandardMaterial({
    map: t,
    roughness: 0.32,
    metalness: 0.05,
    toneMapped: true,
    transparent: !!opts.transparent,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  // language-aware signs: each keeps a factory so it can be redrawn when the language changes
  W.signs = [];
  const lsign = (make, opts) => { const mat = signMat(make(), opts); W.signs.push({ mat, make }); return mat; };
  const lmat = (make, Ctor = THREE.MeshStandardMaterial) => { const mat = new Ctor({ map: make(), roughness: 0.4, toneMapped: true }); W.signs.push({ mat, make }); return mat; };
  const S = (key, o) => () => { const st = TX.signText(key); return TX.signTexture(st.text, { ...o, sub: st.sub }); };

  const C = {
    wall: 0xf6f6f3, accent: 0x12a594, accentDark: 0x0b7c70, white: 0xf4f5f4, shelf: 0xf1f3f2, shelfBack: 0xe3ece9,
    counterFront: 0xffffff, quartz: 0xf3f2ef, dark: 0x2b3236, steel: 0xb9c0c4, chair: 0x2f6f78, plant: 0x3f8f4a, pot: 0xd9d4cb,
    kick: 0x3a4146, fridge: 0xf2f4f5, carton: 0xc9a46c, red: 0xd64545,
  };

  // ── Floor (tiles + baked AO), exterior ──
  const floorTex = TX.floorTexture();
  floorTex.repeat.set(16 / 1.2, 18 / 1.2);
  const floorGeo = new THREE.PlaneGeometry(16, 18);
  floorGeo.rotateX(-Math.PI / 2);
  const floorMat = new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.17, metalness: 0.0, envMapIntensity: 1.0 });
  boxProject(floorMat);
  W.floorMat = floorMat;
  // Planar reflection (PC high / ultra): a mirrored render of the room, blurred and faded by Fresnel,
  // gives the polished porcelain floor real reflections of shelves, people and ceiling lights.
  const RU = { uRefl: { value: null }, uReflMat: { value: new THREE.Matrix4() }, uReflOn: { value: 0 } };
  {
    const prev = floorMat.onBeforeCompile;
    floorMat.onBeforeCompile = (sh, r) => {
      prev?.call(floorMat, sh, r);
      Object.assign(sh.uniforms, RU);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform mat4 uReflMat; varying vec4 vReflUv;')
        .replace('#include <project_vertex>', '#include <project_vertex>\nvReflUv = uReflMat * (modelMatrix * vec4(transformed, 1.0));');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D uRefl; uniform float uReflOn; varying vec4 vReflUv;')
        .replace('#include <opaque_fragment>', `if (uReflOn > 0.01) {
    vec2 ruv = vReflUv.xy / vReflUv.w;
    vec3 rc = texture2D(uRefl, ruv, 0.8).rgb * 0.55 + texture2D(uRefl, ruv, 2.4).rgb * 0.45;
    float fres = 0.1 + 0.6 * pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 4.0);
    float tile = smoothstep(0.42, 0.62, dot(diffuseColor.rgb, vec3(0.3333)));
    float k = fres * tile * uReflOn * 0.75;
    outgoingLight = outgoingLight * (1.0 - 0.35 * k) + rc * k;
  }
  #include <opaque_fragment>`);
    };
    const key = floorMat.customProgramCacheKey.bind(floorMat);
    floorMat.customProgramCacheKey = () => key() + '|refl';
  }
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.receiveShadow = true; floor.matrixAutoUpdate = false; floor.updateMatrix();
  floor.name = 'floor';
  root.add(floor);
  W.floor = floor;
  // storage floor (concrete-ish tint) as overlay
  {
    const sg = new THREE.PlaneGeometry(3.4, 4.4); sg.rotateX(-Math.PI / 2); sg.translate(6.3, 0.003, -6.8);
    zoneBatches.storage.add('matte', sg, 0xc9ccc8);
  }
  // entrance mat
  { const g = new THREE.PlaneGeometry(2.4, 1.3); g.rotateX(-Math.PI / 2); g.translate(0, 0.004, 8.2); batch.add('matte', g, 0x3c4448); }
  // exterior sidewalk + street backdrop
  { const g = new THREE.PlaneGeometry(30, 7); g.rotateX(-Math.PI / 2); g.translate(0, -0.02, 12.5); batch.add('matte', g, 0xb8b6b0); }
  const streetMat = new THREE.MeshBasicMaterial({ map: TX.streetTexture(), toneMapped: false, fog: false });
  W.streetMat = streetMat;
  plane(streetMat, 34, 12, 0, 4.2, 16, Math.PI);

  // ── Walls ──
  const H = ROOM.h;
  const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  // baked indirect light: walls darken towards the ceiling, the floor line and room corners
  const wallShade = (side) => (x, y, z) => {
    const dc = side ? 9 - Math.abs(z) : 8 - Math.abs(x);
    return (1 - 0.2 * sm(H - 1.5, H, y)) * (1 - 0.12 * (1 - sm(0, 0.6, y))) * (1 - 0.16 * (1 - sm(0, 1.8, dc)));
  };
  const wallBand = (x0, x1, z, rot, y0 = 0, y1 = H) => {
    const w = Math.abs(x1 - x0);
    const g = new THREE.PlaneGeometry(w, y1 - y0, Math.max(1, Math.ceil(w / 1.0)), Math.max(1, Math.ceil((y1 - y0) / 0.3)));
    g.translate(0, (y0 + y1) / 2, 0);
    g.rotateY(rot);
    const cx = (x0 + x1) / 2;
    if (Math.abs(rot) === Math.PI / 2) g.translate(z, 0, cx); else g.translate(cx, 0, z);
    const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / 2.5, uv.getY(i) * (y1 - y0) / 2.5);
    batch.add('wall', g, C.wall, wallShade(Math.abs(rot) === Math.PI / 2));
  };
  // back wall (z=-9, facing +z)
  wallBand(-8, 8, -9, 0);
  // left wall x=-8 facing +x ; right wall x=8 facing -x
  wallBand(-9, 9, -8, Math.PI / 2);
  wallBand(-9, 9, 8, -Math.PI / 2);
  // front wall z=9 facing -z (with storefront openings)
  wallBand(-8, -6.5, 9, Math.PI); wallBand(6.5, 8, 9, Math.PI);
  wallBand(-6.5, -1.3, 9, Math.PI, 0, 0.5); wallBand(1.3, 6.5, 9, Math.PI, 0, 0.5);
  wallBand(-6.5, 6.5, 9, Math.PI, 2.6, H);
  // accent skirting & dado band (teal)
  const accentStrip = (x0, z0, x1, z1, y, h, color = C.accent) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const g = new THREE.BoxGeometry(len, h, 0.02);
    g.rotateY(-Math.atan2(z1 - z0, x1 - x0));
    g.translate((x0 + x1) / 2, y + h / 2, (z0 + z1) / 2);
    batch.add('matte', g, color);
  };
  accentStrip(-8, -8.99, 8, -8.99, 0, 0.12, C.kick);
  accentStrip(-7.99, -9, -7.99, 9, 0, 0.12, C.kick);
  accentStrip(7.99, -9, 7.99, 9, 0, 0.12, C.kick);
  accentStrip(-8, -8.985, 8, -8.985, 2.38, 0.06, C.accent);
  accentStrip(-7.985, -9, -7.985, 9, 2.38, 0.06, C.accent);
  accentStrip(7.985, -9, 7.985, 9, 2.38, 0.06, C.accent);
  // window frames + glass
  for (const [x0, x1] of [[-6.5, -1.3], [1.3, 6.5]]) {
    box('metal', x1 - x0, 0.06, 0.12, (x0 + x1) / 2, 0.5, 9, C.dark);
    box('metal', x1 - x0, 0.06, 0.12, (x0 + x1) / 2, 2.54, 9, C.dark);
    for (let x = x0; x <= x1 + 0.01; x += (x1 - x0) / 3) box('metal', 0.06, 2.1, 0.12, x, 0.5, 9, C.dark);
    plane(M.glass, x1 - x0, 2.04, (x0 + x1) / 2, 1.55, 9, Math.PI);
  }
  // door frame & header
  box('metal', 0.1, 2.5, 0.16, -1.32, 0, 9, C.dark); box('metal', 0.1, 2.5, 0.16, 1.32, 0, 9, C.dark);
  box('metal', 2.74, 0.12, 0.16, 0, 2.46, 9, C.dark);
  // sliding doors
  const doorGeo = new THREE.BoxGeometry(1.3, 2.4, 0.04);
  const doorL = new THREE.Mesh(doorGeo, M.glass); const doorR = new THREE.Mesh(doorGeo, M.glass);
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x2b3236, roughness: 0.4, metalness: 0.6 });
  for (const d of [doorL, doorR]) {
    const f = new THREE.Mesh(new THREE.BoxGeometry(1.32, 0.06, 0.05), frameMat); f.position.y = -1.18; d.add(f);
    const f2 = f.clone(); f2.position.y = 1.18; d.add(f2);
    const hnd = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.5, 0.06), frameMat); hnd.position.set(0, 0, 0); d.add(hnd);
    d.position.set(0, 1.21, 9.02); root.add(d);
  }
  doorL.userData.base = -0.65; doorR.userData.base = 0.65;
  hndOffset(doorL, 0.6); hndOffset(doorR, -0.6);
  function hndOffset(d, x) { d.children[2].position.x = x; }
  W.door = { L: doorL, R: doorR, open: 0, target: 0 };

  // colliders: walls (front wall has door gap)
  col(-8.4, -8, -9, 9, H); col(8, 8.4, -9, 9, H); col(-8, 8, -9.4, -9, H);
  col(-8, -1.3, 9, 9.3, H); col(1.3, 8, 9, 9.3, H);

  // ── Ceiling + light panels ──
  {
    const g = new THREE.PlaneGeometry(16, 18, 32, 36); g.rotateX(Math.PI / 2); g.translate(0, H, 0);
    const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 8, uv.getY(i) * 9);
    const PX = [-5.2, -1.8, 1.8, 5.2], PZ = [-6.8, -3.2, 0.4, 4.0, 7.4];
    // ceiling: bright halo around each light panel, darker towards the walls
    batch.add('ceiling', g, 0xffffff, (x, y, z) => {
      let halo = 0; for (const px of PX) for (const pz of PZ) { const d2 = (x - px) ** 2 + ((z - pz) * 1.4) ** 2; halo = Math.max(halo, Math.exp(-d2 / 1.1)); }
      return (0.8 + 0.28 * halo) * (1 - 0.22 * (1 - sm(0, 2.6, Math.min(8 - Math.abs(x), 9 - Math.abs(z)))));
    });
    for (const x of PX) for (const z of PZ) {
      const p = new THREE.PlaneGeometry(1.2, 0.6); p.rotateX(Math.PI / 2); p.translate(x, H - 0.02, z);
      batch.add('glow', p, 0xffffff);
      const r = new THREE.BoxGeometry(1.26, 0.02, 0.66); r.translate(x, H - 0.005, z); batch.add('metal', r, 0xdadfe1);
    }
  }

  // ── Dispensing counter ──
  const counter = { x0: -6, x1: 3.2, z0: -4.2, z1: -3.4, h: 1.0 };
  box('wood', counter.x1 - counter.x0, 0.92, 0.04, (counter.x0 + counter.x1) / 2, 0.08, counter.z1 - 0.02, 0xffffff);
  box('matte', counter.x1 - counter.x0, 0.92, counter.z1 - counter.z0 - 0.06, (counter.x0 + counter.x1) / 2, 0.08, (counter.z0 + counter.z1) / 2 - 0.02, C.white);
  box('matte', counter.x1 - counter.x0, 0.08, counter.z1 - counter.z0 - 0.1, (counter.x0 + counter.x1) / 2, 0, (counter.z0 + counter.z1) / 2, C.kick);
  box('gloss', counter.x1 - counter.x0 + 0.06, 0.05, counter.z1 - counter.z0 + 0.12, (counter.x0 + counter.x1) / 2, 1.0, (counter.z0 + counter.z1) / 2 + 0.02, C.quartz);
  accentStrip(counter.x0, counter.z1 + 0.005, counter.x1, counter.z1 + 0.005, 0.84, 0.05, C.accent);
  // vertical accent fins on counter front
  for (let x = counter.x0 + 0.6; x < counter.x1; x += 1.6) box('matte', 0.05, 0.84, 0.03, x, 0.1, counter.z1 + 0.01, C.accentDark);
  // under-counter drawers (pharmacist side)
  for (let x = counter.x0 + 0.4; x < counter.x1 - 0.3; x += 0.62) for (let r = 0; r < 3; r++) box('gloss', 0.56, 0.26, 0.02, x + 0.28, 0.12 + r * 0.29, counter.z0 - 0.005, 0xe9eceb);
  col(counter.x0 - 0.05, counter.x1 + 0.05, counter.z0 - 0.05, counter.z1 + 0.06, 1.05, { counter: true });
  // prescription section screen + sign
  plane(M.glass, 2.2, 0.55, -4.8, 1.33, counter.z1 + 0.03, 0);
  box('metal', 0.03, 0.6, 0.03, -5.9, 1.05, counter.z1 + 0.03, C.steel); box('metal', 0.03, 0.6, 0.03, -3.7, 1.05, counter.z1 + 0.03, C.steel);
  // staff gate at counter gap
  box('matte', 0.04, 0.9, 0.7, 3.32, 0.05, -3.8, C.white);
  // counter clutter: leaflet stand, hand sanitizer, small plant
  box('matte', 0.25, 0.28, 0.12, -2.9, 1.05, -3.55, 0xffffff); box('matte', 0.2, 0.2, 0.02, -2.9, 1.1, -3.48, 0x9fd8cf);
  cyl('gloss', 0.035, 0.035, 0.16, -0.2, 1.05, -3.55, 0xe8f4f2, 10); cyl('matte', 0.012, 0.012, 0.04, -0.2, 1.21, -3.55, 0x333333, 6);
  cyl('matte', 0.07, 0.06, 0.12, 0.4, 1.05, -3.9, C.pot, 12); { const g = new THREE.IcosahedronGeometry(0.11, 1); g.translate(0.4, 1.25, -3.9); batch.add('matte', g, C.plant); }

  // POS / cash counter equipment (pharmacist faces +z)
  const posX = 2.2;
  box('metal', 0.12, 0.25, 0.12, posX, 1.05, -3.95, C.dark);           // stand
  box('gloss', 0.46, 0.3, 0.04, posX, 1.28, -3.92, C.dark);            // monitor body
  const posScreen = new TX.ScreenTexture(256, 160);
  TX.drawPOS(posScreen.g, 256, 160, { line1: tp('g.ready'), line2: tp('g.scan') });
  posScreen.texture.needsUpdate = true;
  plane(new THREE.MeshBasicMaterial({ map: posScreen.texture, toneMapped: false }), 0.42, 0.26, posX, 1.43, -3.895, Math.PI);
  W.screens.pos = posScreen;
  box('gloss', 0.42, 0.02, 0.14, posX, 1.05, -4.08, 0x222222);         // keyboard
  box('metal', 0.42, 0.12, 0.4, posX + 0.6, 0.9, -4.0, 0x3a3f44);      // cash drawer (under top)
  box('gloss', 0.08, 0.03, 0.16, posX - 0.55, 1.05, -3.65, 0x1d1d1d); box('gloss', 0.07, 0.06, 0.02, posX - 0.55, 1.08, -3.58, 0x2e7d32); // card terminal
  box('gloss', 0.16, 0.12, 0.16, posX + 0.55, 1.05, -3.95, 0xe6e6e6);  // receipt printer
  // customer facing display
  box('gloss', 0.26, 0.16, 0.03, posX - 0.25, 1.12, -3.6, C.dark);
  const cfd = new TX.ScreenTexture(128, 64);
  plane(new THREE.MeshBasicMaterial({ map: cfd.texture, toneMapped: false }), 0.24, 0.13, posX - 0.25, 1.2, -3.584, 0);
  W.screens.cfd = cfd;

  // ── Back wall shelving behind counter: Tablets & Capsules (7 units) ──
  const shelfDefs = [];
  for (let i = 0; i < 7; i++) shelfDefs.push({ section: 'tablets', x: -3.6 + i * 1.2, z: -8.77, rot: 0, levels: 6, height: 2.2 });
  // Rx cabinet units (drawer base + glass shelves)
  for (let i = 0; i < 2; i++) shelfDefs.push({ section: 'rx', x: -7.0 + i * 1.3, z: -8.77, rot: 0, levels: 4, height: 2.2, width: 1.3, base: 0.95, glass: true });
  // left wall: syrups & tonics (facing +x)
  for (let i = 0; i < 3; i++) shelfDefs.push({ section: 'syrups', x: -7.77, z: -2.1 + i * 1.2, rot: Math.PI / 2, levels: 5, height: 2.1 });
  for (let i = 0; i < 3; i++) shelfDefs.push({ section: 'tonics', x: -7.77, z: 1.5 + i * 1.2, rot: Math.PI / 2, levels: 5, height: 2.1 });
  // right wall: skin care & baby care (facing -x)
  for (let i = 0; i < 3; i++) shelfDefs.push({ section: 'skincare', x: 7.77, z: -2.7 + i * 1.2, rot: -Math.PI / 2, levels: 5, height: 2.1 });
  for (let i = 0; i < 3; i++) shelfDefs.push({ section: 'babycare', x: 7.77, z: 0.9 + i * 1.2, rot: -Math.PI / 2, levels: 5, height: 2.1 });
  // gondola A (x=-3.4): west vitamins, east first aid ; gondola B (x=3.4): west OTC, east devices
  for (let i = 0; i < 3; i++) {
    const z = -0.0 + i * 1.2;
    shelfDefs.push({ section: 'vitamins', x: -3.62, z, rot: -Math.PI / 2, levels: 4, height: 1.6, depth: 0.4, gondola: true });
    shelfDefs.push({ section: 'firstaid', x: -3.18, z, rot: Math.PI / 2, levels: 4, height: 1.6, depth: 0.4, gondola: true });
    shelfDefs.push({ section: 'otc', x: 3.18, z, rot: -Math.PI / 2, levels: 4, height: 1.6, depth: 0.4, gondola: true });
    shelfDefs.push({ section: 'devices', x: 3.62, z, rot: Math.PI / 2, levels: 4, height: 1.6, depth: 0.4, gondola: true });
  }
  // expansion wing: personal care wall + wellness gondola
  for (let i = 0; i < 2; i++) shelfDefs.push({ section: 'personal', x: 7.77, z: 6.0 + i * 1.2, rot: -Math.PI / 2, levels: 5, height: 2.1, zone: 'expansion' });
  for (let i = 0; i < 2; i++) shelfDefs.push({ section: 'personal', x: 4.6, z: 6.3 + i * 1.2, rot: Math.PI / 2, levels: 4, height: 1.6, depth: 0.4, gondola: true, zone: 'expansion' });
  for (let i = 0; i < 2; i++) shelfDefs.push({ section: 'devices', x: 4.16, z: 6.3 + i * 1.2, rot: -Math.PI / 2, levels: 4, height: 1.6, depth: 0.4, gondola: true, zone: 'expansion' });

  // ── Shared product rendering resources ──
  const atlas = TX.productAtlas(quality === 'high' || quality === 'ultra');
  const atlasMat = new THREE.MeshStandardMaterial({ map: atlas, roughness: 0.55, metalness: 0.0, envMapIntensity: 0.5 });
  atlasMat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aCell;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\n#ifdef USE_MAP\nvMapUv = vec2((uv.x + mod(aCell, 8.0)) / 8.0, (uv.y + (7.0 - floor(aCell / 8.0))) / 8.0);\n#endif');
  };
  atlasMat.customProgramCacheKey = () => 'atlas-instanced';
  const flatMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const facadeTex = TX.shelfFacadeTexture();
  const facadeMat = new THREE.MeshLambertMaterial({ map: facadeTex });
  W.lodMats = { atlasMat, flatMat, facadeMat };
  const KIND = { tablets: 'box', otc: 'box', syrups: 'bottle', tonics: 'bottle', vitamins: 'jar', firstaid: 'box', skincare: 'box', babycare: 'baby', devices: 'device', personal: 'box', rx: 'box', fridge: 'box' };
  const FACADE_COL = { box: 0, bottle: 1, jar: 2, device: 3, baby: 4 };
  const bottleProfile = [[0.0, 0], [0.034, 0], [0.036, 0.01], [0.036, 0.1], [0.03, 0.12], [0.014, 0.135], [0.014, 0.155], [0.016, 0.16], [0.0, 0.162]].map(([r, y]) => new THREE.Vector2(r, y));
  const GEO = {
    hi: {
      box: new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0),
      bottle: new THREE.LatheGeometry(bottleProfile, 10).scale(1 / 0.072, 1 / 0.162, 1 / 0.072),
      jar: new THREE.CylinderGeometry(0.5, 0.5, 1, 12).translate(0, 0.5, 0),
      device: new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0),
      baby: new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0),
    },
    med: {
      box: new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0),
      bottle: new THREE.CylinderGeometry(0.42, 0.5, 1, 6).translate(0, 0.5, 0),
      jar: new THREE.CylinderGeometry(0.5, 0.5, 1, 6).translate(0, 0.5, 0),
      device: new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0),
      baby: new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0),
    },
  };
  const DIM = { box: [0.09, 0.13, 0.05, 0.1, 0.11], bottle: [0.07, 0.07, 0.17, 0.19, 0.07], jar: [0.08, 0.09, 0.11, 0.13, 0.08], device: [0.2, 0.26, 0.14, 0.2, 0.12], baby: [0.24, 0.3, 0.22, 0.3, 0.16] };
  const CELL_RANGE = { box: [0, 32], bottle: [32, 48], jar: [48, 56], device: [56, 64], baby: [0, 32] };

  // ── Build each shelf unit (frame → batch, products → LOD) ──
  for (const def of shelfDefs) {
    const b = def.zone ? zoneBatches[def.zone] : batch;
    // 0.02m seam between units prevents coplanar side panel collision (no Z-fighting)
    const w = (def.width || 1.2) - 0.02, h = def.height, d = def.depth || 0.42;
    const grp = new THREE.Group();
    grp.position.set(def.x, 0, def.z); grp.rotation.y = def.rot; grp.updateMatrixWorld(true);
    const m = grp.matrixWorld;
    const local = (geo) => { geo.applyMatrix4(m); return geo; };
    const sc = new THREE.Color(SECTIONS[def.section].color);
    // frame (local: front faces +z)
    const add = (key, gw, gh, gd, x, y, z, color) => { const g = new THREE.BoxGeometry(gw, gh, gd); g.translate(x, y + gh / 2, z); b.add(key, local(g), color); };
    // back panel, kick and header sit between the 25 mm side panels (ends buried 10 mm inside them):
    // flush with the panels' outer faces they z-fought, flickering dark wedges along the unit edges
    const inner = w - 0.03;
    add('matte', inner, h, 0.02, 0, 0, -d / 2 + 0.01, def.glass ? 0xdfe6e4 : C.shelfBack);
    add('gloss', 0.025, h, d, -w / 2 + 0.0125, 0, 0, C.shelf); add('gloss', 0.025, h, d, w / 2 - 0.0125, 0, 0, C.shelf);
    add('matte', inner, 0.1, d - 0.02, 0, 0, 0.0, C.kick);
    const base = def.base || 0.1;
    if (def.base) {
      // drawer cabinet base
      add('gloss', w - 0.04, def.base - 0.1, d - 0.03, 0, 0.1, 0, 0xf4f4f2);
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) add('metal', 0.12, 0.015, 0.02, -w / 3 + c * (w / 3), 0.25 + r * 0.26, d / 2, 0xaab2b6);
    }
    const levels = def.levels;
    const levelYs = [];
    for (let l = 0; l < levels; l++) {
      const y = base + l * ((h - base - 0.25) / levels) + 0.02;
      add('gloss', w - 0.04, 0.022, d - 0.03, 0, y, 0.005, C.shelf);
      add('matte', w - 0.04, 0.035, 0.012, 0, y - 0.01, d / 2 - 0.01, sc.getHex());  // price rail in section colour
      levelYs.push(y + 0.022);
    }
    // header
    add('matte', inner, 0.16, 0.03, 0, h - 0.16, d / 2 - 0.02, sc.getHex());
    add('gloss', w, 0.03, d, 0, h, 0, C.shelf);
    if (def.glass) { const gp = new THREE.PlaneGeometry(w - 0.06, h - base - 0.2); gp.translate(0, base + (h - base - 0.2) / 2, d / 2 + 0.005); gp.applyMatrix4(m); const gm = new THREE.Mesh(gp, M.glass); gm.matrixAutoUpdate = false; root.add(gm); }

    // collider (world AABB)
    const corners = [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2]].map(([x, z]) => new THREE.Vector3(x, 0, z).applyMatrix4(m));
    const minX = Math.min(...corners.map((c) => c.x)), maxX = Math.max(...corners.map((c) => c.x));
    const minZ = Math.min(...corners.map((c) => c.z)), maxZ = Math.max(...corners.map((c) => c.z));
    const colRef = col(minX, maxX, minZ, maxZ, h, { zone: def.zone, shelf: true });

    // products: placements (local coords)
    const kind = KIND[def.section];
    const dim = DIM[kind];
    const items = [];
    for (let l = 0; l < levels; l++) {
      const y = levelYs[l];
      const maxH = (l < levels - 1 ? levelYs[l + 1] - y - 0.05 : h - 0.2 - y) * 0.95;
      let x = -w / 2 + 0.05;
      const [c0, c1] = CELL_RANGE[kind];
      const facing = rnd() < 0.5 ? 1 : 2;
      while (x < w / 2 - 0.06) {
        const iw = dim[0] + rnd() * (dim[1] - dim[0]);
        const ih = Math.min(maxH, dim[2] + rnd() * (dim[3] - dim[2]));
        const idp = dim[4];
        if (x + iw > w / 2 - 0.04) break;
        const cell = c0 + Math.floor(rnd() * (c1 - c0));
        const rowsDeep = Math.min(facing + (kind === 'box' ? 1 : 0), Math.floor((d - 0.06) / (idp + 0.01)));
        const minPZ = -d / 2 + 0.025 + idp / 2;
        for (let k = 0; k < Math.max(1, rowsDeep); k++) {
          const pz = d / 2 - 0.04 - idp / 2 - k * (idp + 0.012);
          if (pz < minPZ) break; // NEVER penetrate the backboard or back of gondola!
          if (rnd() < 0.06 && k === 0) continue; // occasional gap (sold)
          items.push({ x: x + iw / 2, y, z: pz, w: iw, h: ih, d: idp, cell });
        }
        x += iw + 0.012 + (rnd() < 0.1 ? 0.04 : 0);
      }
    }
    const lod = new THREE.LOD();
    lod.position.set(def.x, 0, def.z); lod.rotation.y = def.rot;
    const mk = (geo, mat, withCell) => {
      const im = new THREE.InstancedMesh(geo, mat, items.length);
      const mm = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
      const cells = withCell ? new Float32Array(items.length) : null;
      items.forEach((it, i) => {
        const jitter = (rnd() - 0.5) * 0.04;
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), jitter);
        p.set(it.x, it.y, it.z); s.set(it.w, it.h, it.d);
        mm.compose(p, q, s); im.setMatrixAt(i, mm);
        if (cells) cells[i] = it.cell;
        if (!withCell) { const hue = (it.cell * 37) % 360; im.setColorAt(i, new THREE.Color().setHSL(hue / 360, kind === 'bottle' ? 0.55 : 0.35, kind === 'bottle' ? 0.3 : 0.72)); }
      });
      if (cells) geo = im.geometry, im.geometry = geo.clone(), im.geometry.setAttribute('aCell', new THREE.InstancedBufferAttribute(cells, 1));
      im.instanceMatrix.needsUpdate = true;
      im.computeBoundingSphere();
      return im;
    };
    const hi = mk(GEO.hi[kind], atlasMat, true);
    const med = mk(GEO.med[kind], atlasMat, true);
    // low: facade quad
    const fq = new THREE.PlaneGeometry(w - 0.06, h - base - 0.25);
    const col0 = FACADE_COL[kind];
    const uv = fq.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, (col0 + uv.getX(i)) / 5);
    fq.translate(0, base + (h - base - 0.25) / 2, d / 2 - 0.03);
    const low = new THREE.Mesh(fq, facadeMat);
    // Smooth, high-draw-distance LOD: keep crisp textured medicine packages visible across the entire store
    lod.addLevel(hi, 0); lod.addLevel(med, 28); lod.addLevel(low, 48);
    lod.updateMatrix();
    (def.zone ? (W.zones[def.zone] ||= new THREE.Group()) : root).add(lod);
    // highlight overlay
    const hlGeo = new THREE.PlaneGeometry(w, h - 0.1); hlGeo.translate(0, h / 2, d / 2 + 0.01);
    const hl = new THREE.Mesh(hlGeo, new THREE.MeshBasicMaterial({ color: 0x19d3b8, transparent: true, opacity: 0.0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    hl.position.copy(lod.position); hl.rotation.y = def.rot; hl.visible = false;
    root.add(hl);
    const front = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), def.rot);
    W.shelves.push({ def, lod, hi, med, low, hl, section: def.section, center: new THREE.Vector3(def.x, h / 2, def.z), front, zone: def.zone, collider: colRef, count: items.length });
  }

  // ── Ultra-HD Signage & Banners ──
  // Wall section header signs (cleanly mounted forward on the shelf pelmet, proud of the shelf face)
  const sectionSign = (key, x, y, z, rot, w = 1.6, h = 0.38) => {
    const mat = lsign(() => TX.sectionSignTexture(key));
    // Physical mounting bezel
    box('matte', w + 0.04, h + 0.03, 0.04, x, y - h / 2, z, 0x1e293b, rot);
    // Front face plane
    const fwd = new THREE.Vector3(0, 0, 0.024).applyAxisAngle(new THREE.Vector3(0, 1, 0), rot);
    const m = plane(mat, w, h, x + fwd.x, y + fwd.y, z + fwd.z, rot);
    return m;
  };

  sectionSign('tablets', 0, 2.44, -8.62, 0, 2.0, 0.44);
  sectionSign('rx', -6.35, 2.44, -8.62, 0, 1.8, 0.42);
  sectionSign('syrups', -7.56, 2.38, -0.9, Math.PI / 2, 1.6, 0.38);
  sectionSign('tonics', -7.56, 2.38, 2.7, Math.PI / 2, 1.6, 0.38);
  sectionSign('skincare', 7.56, 2.38, -1.5, -Math.PI / 2, 1.6, 0.38);
  sectionSign('babycare', 7.56, 2.38, 2.1, -Math.PI / 2, 1.6, 0.38);

  // Hanging Gondola Aisle Lightboxes (Double Sided with Chrome Rods & Mounting Plates)
  for (const [k1, k2, x] of [['vitamins', 'firstaid', -3.4], ['otc', 'devices', 3.4]]) {
    const sw = 1.85, sh = 0.44, cy = 2.42, cz = 1.2, top = cy + sh / 2;
    // Sleek dark architectural frame casing
    box('matte', 0.06, sh + 0.04, sw + 0.05, x, cy - sh / 2 - 0.02, cz, 0x1e293b);
    // Chrome ceiling drop suspension cables with ceiling escutcheons
    for (const dz of [-sw / 2 + 0.22, sw / 2 - 0.22]) {
      box('metal', 0.016, H - top, 0.016, x, top, cz + dz, C.steel);
      box('metal', 0.07, 0.015, 0.07, x, H - 0.015, cz + dz, C.steel);
    }
    // Front face (facing -x)
    plane(lsign(() => TX.sectionSignTexture(k1)), sw, sh, x - 0.032, cy, cz, -Math.PI / 2);
    // Back face (facing +x)
    plane(lsign(() => TX.sectionSignTexture(k2)), sw, sh, x + 0.032, cy, cz, Math.PI / 2);
  }

  // ── Main Store Header: PHARMACY Architectural Marquee ──
  {
    const pw = 4.4, ph = 0.95, py = 2.95, pz = -8.72;
    // Backlit architectural panel with metallic trim
    box('matte', pw + 0.08, ph + 0.06, 0.06, 0, py - ph / 2, pz, 0x072822);
    // Accent illumination strips top & bottom
    box('glow', pw, 0.025, 0.03, 0, py + ph / 2 + 0.012, pz + 0.02, 0x10b981);
    box('glow', pw, 0.025, 0.03, 0, py - ph / 2 - 0.012, pz + 0.02, 0x10b981);
    // Ultra-HD Marquee Face
    const marqueeMat = lsign(() => TX.pharmacyMarqueeTexture());
    plane(marqueeMat, pw, ph, 0, py, pz + 0.034, 0);
  }

  // ── Overhead Department Lightboxes (Prescriptions, Consultation, Cashier) ──
  {
    const makeDeptSign = (title, sub, icon, accent, x, z, w = 1.8) => {
      const dh = 0.46, dy = 2.52;
      // 3D casing box
      box('matte', w + 0.04, dh + 0.04, 0.05, x, dy - dh / 2, z, 0x1e293b);
      // Suspension rods
      for (const dx of [-w / 2 + 0.25, w / 2 - 0.25]) {
        box('metal', 0.014, H - (dy + dh / 2), 0.014, x + dx, dy + dh / 2, z, C.steel);
        box('metal', 0.06, 0.015, 0.06, x + dx, H - 0.015, z, C.steel);
      }
      const mat = lsign(() => TX.deptSignTexture(title, sub, icon, accent));
      plane(mat, w, dh, x, dy, z + 0.028, 0);
      plane(mat, w, dh, x, dy, z - 0.028, Math.PI);
    };

    makeDeptSign(tp('w.prescriptions') || 'PRESCRIPTIONS', isBi() ? 'MEDICINE DISPENSARY' : '', 'rx', '#0284c7', -4.8, -3.8, 1.9);
    makeDeptSign(tp('w.consultation') || 'CONSULTATION', isBi() ? 'CLINICAL ADVICE & CARE' : '', 'shield', '#0f8a7e', -1.2, -3.8, 1.8);
    makeDeptSign(tp('w.payHere') || 'PAY HERE', isBi() ? 'BILLING & CHECKOUT' : '', 'heart', '#4338ca', posX, -3.8, 1.6);
  }
  // exterior sign above door (seen from outside & through glass)
  { const mk = S('w.storeName', { w: 1024, h: 160, bg: '#0f8a7e', fg: '#fff', cross: true, align: 'center', size: 0.5 }); const mat = lsign(mk); plane(mat, 4.8, 0.75, 0, 2.95, 9.08, 0); plane(mat, 4.8, 0.75, 0, 2.95, 9.02, Math.PI); }
  // posters
  plane(lmat(() => TX.posterTexture('hands')), 0.6, 0.84, -7.98, 1.6, 6.6, Math.PI / 2);
  plane(lmat(() => TX.posterTexture('ask')), 0.6, 0.84, 7.98, 1.6, -4.0, -Math.PI / 2);
  plane(lmat(() => TX.posterTexture('bp')), 0.6, 0.84, -7.98, 1.6, 4.9, Math.PI / 2);
  plane(lmat(() => TX.posterTexture('abx')), 0.6, 0.84, 7.98, 1.6, 4.6, -Math.PI / 2);

  // ── Refrigerator (behind counter, left wall) ──
  {
    const fx = -7.55, fz = -5.1;
    box('gloss', 0.8, 2.0, 0.95, fx, 0, fz, C.fridge);
    box('matte', 0.02, 1.55, 0.78, fx + 0.41, 0.25, fz, 0x9aa4a8);     // inner back (seen through glass)
    for (let i = 0; i < 4; i++) box('gloss', 0.02, 0.02, 0.8, fx + 0.4, 0.4 + i * 0.38, fz, 0xdddddd);
    // boxes inside
    for (let i = 0; i < 4; i++) for (let k = 0; k < 6; k++) box('matte', 0.12, 0.1 + rnd() * 0.06, 0.1, fx + 0.3, 0.42 + i * 0.38, fz - 0.33 + k * 0.13, [0xffffff, 0xd8f0f8, 0xf8e8d0][k % 3]);
    const gl = new THREE.Mesh(new THREE.PlaneGeometry(0.86, 1.6), M.glass); gl.position.set(fx + 0.415, 1.05, fz); gl.rotation.y = Math.PI / 2; root.add(gl);
    box('metal', 0.03, 1.2, 0.03, fx + 0.44, 0.45, fz + 0.38, C.steel);  // handle
    const disp = new TX.ScreenTexture(128, 48);
    plane(new THREE.MeshBasicMaterial({ map: disp.texture, toneMapped: false }), 0.32, 0.12, fx + 0.415, 1.9, fz, Math.PI / 2);
    W.screens.fridge = disp;
    W.setFridgeTemp = (temp, alarm) => { W._fridge = [temp, alarm]; disp.draw((g, w, h) => {
      g.fillStyle = alarm ? '#3a0d0d' : '#06231f'; g.fillRect(0, 0, w, h);
      g.fillStyle = alarm ? '#ff5a4a' : '#47f0b9'; g.font = '800 30px monospace'; g.textAlign = 'center'; g.fillText(temp.toFixed(1) + '°C', w / 2, 34);
      const lab = tp(alarm ? 'w.fridgeAlarm' : 'w.fridgeRange'); TX.fitFont(g, lab, 600, 9, w - 6, 6); g.fillText(lab, w / 2, 45);
    }); };
    W.setFridgeTemp(5.2, false);
    col(fx - 0.4, fx + 0.45, fz - 0.5, fz + 0.5, 2.0);
    W.points.fridgeStand = new THREE.Vector3(fx + 1.25, 0, fz); W.points.fridgeHeading = -Math.PI / 2;
    shelfInteract('fridge', tp('it.fridge'), new THREE.Vector3(fx, 1, fz), W.points.fridgeStand, -Math.PI / 2, 'fridge');
  }

  // ── Pharmacist workstation (left wall) ──
  {
    const dx = -7.55, dz = -7.2;
    box('wood', 0.8, 0.04, 1.8, dx, 0.74, dz, 0xffffff);
    box('matte', 0.76, 0.72, 0.04, dx, 0.02, dz - 0.86, C.white); box('matte', 0.76, 0.72, 0.04, dx, 0.02, dz + 0.86, C.white);
    box('gloss', 0.05, 0.36, 0.56, dx - 0.18, 0.95, dz, C.dark); box('metal', 0.1, 0.17, 0.1, dx - 0.18, 0.78, dz, C.dark);
    const ws = new TX.ScreenTexture(256, 160);
    W.drawWorkstation = () => ws.draw((g, w, h) => { g.textAlign = 'left'; g.fillStyle = '#f5faf9'; g.fillRect(0, 0, w, h); g.fillStyle = '#12a594'; g.fillRect(0, 0, w, 26); g.fillStyle = '#fff'; TX.fitFont(g, tp('w.library'), 800, 14, w - 20); g.fillText(tp('w.library'), 10, 18); [tp('w.modules'), tp('w.practiceQuiz'), tp('w.reference')].forEach((t, i) => { g.fillStyle = '#e0f2ef'; g.fillRect(10, 36 + i * 38, w - 20, 30); g.fillStyle = '#27403c'; TX.fitFont(g, t, 600, 12, w - 40); g.fillText(t, 20, 56 + i * 38); }); });
    W.drawWorkstation();
    plane(new THREE.MeshBasicMaterial({ map: ws.texture, toneMapped: false }), 0.52, 0.32, dx - 0.152, 1.13, dz, Math.PI / 2);
    box('gloss', 0.16, 0.02, 0.45, dx + 0.1, 0.78, dz, 0x222222);
    // office chair
    cyl('metal', 0.25, 0.25, 0.04, dx + 0.75, 0.05, dz, C.dark, 10); cyl('metal', 0.03, 0.03, 0.4, dx + 0.75, 0.08, dz, C.steel, 8);
    box('matte', 0.46, 0.08, 0.46, dx + 0.75, 0.46, dz, C.chair); box('matte', 0.08, 0.5, 0.42, dx + 1.0, 0.52, dz, C.chair);
    col(dx - 0.42, dx + 0.42, dz - 0.92, dz + 0.92, 0.8);
    col(dx + 0.5, dx + 1.05, dz - 0.25, dz + 0.25, 0.9);
    shelfInteract('workstation', tp('it.workstation'), new THREE.Vector3(dx, 1, dz), new THREE.Vector3(dx + 1.2, 0, dz + 0.55), -Math.PI / 2, null);
  }

  // ── Storage room (zone-culled) ──
  {
    const zb = zoneBatches.storage;
    // walls: x=4.6 (z -9..-4.6, door gap -6.6..-5.6) and z=-4.6 (x 4.6..8)
    const sw = (x0, z0, x1, z1) => { const len = Math.hypot(x1 - x0, z1 - z0); const g = new THREE.BoxGeometry(len, H, 0.12); g.rotateY(-Math.atan2(z1 - z0, x1 - x0)); g.translate((x0 + x1) / 2, H / 2, (z0 + z1) / 2); batch.add('wall', g, C.wall); };
    sw(4.6, -9, 4.6, -6.6); sw(4.6, -5.6, 4.6, -4.6); sw(4.6, -4.6, 8, -4.6);
    box('wall', 0.12, H - 2.2, 1.0, 4.6, 2.2, -6.1, C.wall);
    col(4.54, 4.66, -9, -6.6, H); col(4.54, 4.66, -5.6, -4.54, H); col(4.6, 8, -4.66, -4.54, H);
    // door frame
    box('metal', 0.16, 2.2, 0.06, 4.6, 0, -6.62, C.dark); box('metal', 0.16, 2.2, 0.06, 4.6, 0, -5.58, C.dark); box('metal', 0.16, 0.06, 1.1, 4.6, 2.17, -6.1, C.dark);
    plane(lsign(S('w.staffOnly', { w: 768, h: 128, bg: '#1f2d4d', fg: '#fff', size: 0.36, radius: 16 })), 1.1, 0.18, 4.53, 2.42, -6.1, -Math.PI / 2);
    // racking
    const rack = (x, z, rot, w = 1.8) => {
      const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot; g.updateMatrixWorld(true);
      const add = (gw, gh, gd, px, py, pz, color, key = 'metal') => { const geo = new THREE.BoxGeometry(gw, gh, gd); geo.translate(px, py + gh / 2, pz); geo.applyMatrix4(g.matrixWorld); zb.add(key, geo, color); };
      for (const sx of [-w / 2, w / 2]) for (const sz of [-0.25, 0.25]) add(0.05, 2.4, 0.05, sx, 0, sz, 0x2f5f8a);
      for (let l = 0; l < 4; l++) {
        add(w, 0.04, 0.53, 0, 0.15 + l * 0.6, 0, 0xc9822b); // edges inside the uprights (flush faces z-fight)
        let px = -w / 2 + 0.2;
        while (px < w / 2 - 0.2) { const bw = 0.3 + rnd() * 0.15, bh = 0.25 + rnd() * 0.25; add(bw, bh, 0.4, px + bw / 2, 0.19 + l * 0.6, 0, rnd() < 0.8 ? C.carton : 0xffffff, 'matte'); px += bw + 0.04; }
      }
      const corners = [[-w / 2, -0.3], [w / 2, 0.3]].map(([a, b2]) => new THREE.Vector3(a, 0, b2).applyMatrix4(g.matrixWorld));
      col(Math.min(corners[0].x, corners[1].x), Math.max(corners[0].x, corners[1].x), Math.min(corners[0].z, corners[1].z), Math.max(corners[0].z, corners[1].z), 2.4, { zone: 'storage' });
    };
    rack(6.4, -8.6, 0, 2.4); rack(7.6, -6.3, Math.PI / 2, 2.2);
    // pallet with cartons
    zb.add('wood', new THREE.BoxGeometry(1.0, 0.14, 0.8).translate(6.1, 0.07, -6.4), 0xffffff);
    for (let i = 0; i < 5; i++) zb.add('matte', new THREE.BoxGeometry(0.42, 0.32, 0.36).translate(5.85 + (i % 2) * 0.48, 0.3 + Math.floor(i / 2) * 0.33, -6.4 + (i % 3 - 1) * 0.05), C.carton);
    col(5.55, 6.65, -6.85, -5.95, 1.2, { zone: 'storage' });
    // quarantine bin (red)
    zb.add('matte', new THREE.BoxGeometry(0.7, 0.8, 0.5).translate(5.15, 0.4, -4.95), C.red);
    const qm = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.12), lsign(S('w.quarantine', { w: 512, h: 96, bg: '#ffffff', fg: '#c62828', size: 0.5, radius: 10 }))); qm.position.set(5.15, 0.68, -5.21); qm.rotation.y = Math.PI; (W.zones.storage ||= new THREE.Group()).add(qm);
    col(4.78, 5.52, -5.22, -4.68, 0.8, { zone: 'storage' });
    // flagged expired carton (event)
    const ec = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.32, 0.36), new THREE.MeshStandardMaterial({ color: C.carton, roughness: 0.8, emissive: 0x000000 }));
    ec.position.set(6.95, 1.02, -8.55); (W.zones.storage ||= new THREE.Group()).add(ec);
    const tag = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.1), new THREE.MeshBasicMaterial({ color: 0xff3b30, toneMapped: false })); tag.position.set(0, 0.03, 0.19); ec.add(tag);
    ec.visible = false; W.expiredCarton = ec;
    // incoming delivery (stock-in): cartons with tape + green tag, shown when an order arrives
    const dg = new THREE.Group(); dg.position.set(5.2, 0, -8.15);
    const cm = new THREE.MeshStandardMaterial({ color: 0xc89a62, roughness: 0.85 }), tape = new THREE.MeshBasicMaterial({ color: 0xe8d9b5 }), tagM = new THREE.MeshBasicMaterial({ color: 0x1f9d63, toneMapped: false });
    [[0, 0.17, 0, 0.5, 0.34, 0.4], [0.02, 0.5, 0.02, 0.44, 0.32, 0.36], [0.52, 0.15, 0.05, 0.42, 0.3, 0.36]].forEach(([x, y, z, w, h2, d]) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h2, d), cm); b.position.set(x, y, z); dg.add(b);
      const tp2 = new THREE.Mesh(new THREE.BoxGeometry(w + 0.004, h2 + 0.004, 0.06), tape); tp2.position.copy(b.position); dg.add(tp2);
    });
    const dtag = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.12), tagM); dtag.position.set(0.02, 0.5, 0.205); dg.add(dtag);
    dg.visible = false; (W.zones.storage ||= new THREE.Group()).add(dg);
    W.setDelivery = (on) => { dg.visible = !!on; };
    // ceiling light in storage
    { const p = new THREE.PlaneGeometry(1.0, 0.4); p.rotateX(Math.PI / 2); p.translate(6.3, H - 0.012, -6.8); zb.add('glow', p, 0xffffff); }
    W.points.storageStand = new THREE.Vector3(5.6, 0, -7.3);
    shelfInteract('storage', tp('it.storage'), new THREE.Vector3(6.3, 1, -7.4), W.points.storageStand, Math.PI * 0.85, null, 'storage');
  }

  // ── Waiting area: chairs, side table, plant, BP kiosk ──
  W.points.waitSeats = [];
  {
    const seatZ = 7.7;
    for (let i = 0; i < 4; i++) {
      const x = -7.1 + i * 0.75;
      box('metal', 0.04, 0.42, 0.04, x - 0.22, 0, seatZ - 0.2, C.steel); box('metal', 0.04, 0.42, 0.04, x + 0.22, 0, seatZ - 0.2, C.steel);
      box('metal', 0.04, 0.42, 0.04, x - 0.22, 0, seatZ + 0.2, C.steel); box('metal', 0.04, 0.42, 0.04, x + 0.22, 0, seatZ + 0.2, C.steel);
      box('matte', 0.52, 0.07, 0.5, x, 0.42, seatZ, C.chair);
      box('matte', 0.52, 0.48, 0.06, x, 0.48, seatZ + 0.24, C.chair);
      W.points.waitSeats.push({ pos: new THREE.Vector3(x, 0, seatZ - 0.08), heading: Math.PI, taken: null });
    }
    col(-7.45, -4.65, seatZ - 0.28, seatZ + 0.3, 0.95);
    box('wood', 0.5, 0.04, 0.5, -4.15, 0.5, 7.7, 0xffffff); cyl('metal', 0.03, 0.03, 0.5, -4.15, 0, 7.7, C.steel, 8);
    box('matte', 0.22, 0.015, 0.3, -4.2, 0.54, 7.68, 0xe8d9b5); box('matte', 0.2, 0.012, 0.28, -4.1, 0.555, 7.74, 0x9fc9e0);
    col(-4.42, -3.88, 7.43, 7.97, 0.6);
    // plants
    for (const [px, pz] of [[-7.5, 8.55], [7.4, -3.95], [-3.4, 4.3]]) {
      cyl('matte', 0.2, 0.16, 0.45, px, 0, pz, C.pot, 14);
      for (let k = 0; k < 5; k++) { const g = new THREE.IcosahedronGeometry(0.2 + rnd() * 0.08, 1); g.translate(px + (rnd() - 0.5) * 0.2, 0.7 + rnd() * 0.5, pz + (rnd() - 0.5) * 0.2); batch.add('matte', g, k % 2 ? C.plant : 0x357a40); }
      col(px - 0.25, px + 0.25, pz - 0.25, pz + 0.25, 1.4);
    }
    // waiting sign
    const wtMat = lsign(S('w.waiting', { w: 512, h: 96, bg: '#ffffff', fg: '#1d2b2a', size: 0.42, radius: 16 }), { transparent: true });
    plane(wtMat, 1.3, 0.24, -7.97, 2.2, 7.0, Math.PI / 2);
    // BP self-check kiosk
    box('gloss', 0.6, 1.1, 0.55, -7.55, 0, 5.4, 0xffffff); box('matte', 0.6, 0.06, 0.55, -7.55, 1.1, 5.4, C.accent);
    box('gloss', 0.3, 0.22, 0.04, -7.3, 1.2, 5.4, C.dark);
    col(-7.9, -7.2, 5.1, 5.7, 1.3);
  }
  // clock
  {
    const cc = document.createElement('canvas'); cc.width = cc.height = 128; const g = cc.getContext('2d');
    g.fillStyle = '#fff'; g.beginPath(); g.arc(64, 64, 60, 0, 7); g.fill(); g.strokeStyle = '#1d2b2a'; g.lineWidth = 5; g.stroke();
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; g.fillStyle = '#1d2b2a'; g.fillRect(64 + Math.sin(a) * 48 - 2, 64 - Math.cos(a) * 48 - 2, 4, 4); }
    g.lineWidth = 4; g.beginPath(); g.moveTo(64, 64); g.lineTo(64 + 26, 64 - 18); g.stroke(); g.lineWidth = 3; g.beginPath(); g.moveTo(64, 64); g.lineTo(64 - 6, 64 - 42); g.stroke();
    const t = new THREE.CanvasTexture(cc); t.colorSpace = THREE.SRGBColorSpace;
    plane(new THREE.MeshLambertMaterial({ map: t, transparent: true }), 0.42, 0.42, 7.98, 2.75, 0.0, -Math.PI / 2);
  }
  // certificate plaque (hidden until certified)
  {
    const m = plane(lmat(() => TX.certificateTexture()), 0.62, 0.45, 3.4, 2.75, -8.97, 0);
    m.visible = false; W.certificate = m;
  }
  // expansion hoarding (temporary wall)
  {
    const hc = document.createElement('canvas'); hc.width = 1024; hc.height = 512; const g = hc.getContext('2d');
    const t = new THREE.CanvasTexture(hc); t.colorSpace = THREE.SRGBColorSpace;
    W.drawHoarding = () => {
      g.fillStyle = '#e9efee'; g.fillRect(0, 0, 1024, 512);
      g.fillStyle = '#12a594'; for (let i = -10; i < 30; i++) { g.save(); g.translate(i * 70, 0); g.rotate(0.5); g.fillRect(0, -50, 22, 900); g.restore(); }
      g.fillStyle = 'rgba(255,255,255,0.93)'; g.fillRect(120, 150, 784, 220);
      g.fillStyle = '#0b6f65'; g.textAlign = 'center'; TX.fitFont(g, tp('w.expansionSoon'), 900, 64, 740, 24); g.fillText(tp('w.expansionSoon'), 512, 250);
      g.fillStyle = '#44504f'; TX.fitFont(g, tp('w.expansionSub'), 600, 32, 740, 14); g.fillText(tp('w.expansionSub'), 512, 320);
      t.needsUpdate = true;
    };
    W.drawHoarding();
    // (box faces have no vertex colours, so they get their own plain wall material — not M.wall, which would render black)
    M.wallPlain = M.wallPlain || new THREE.MeshStandardMaterial({ map: M.wall.map, color: 0xe9e6e0, roughness: 0.92 });
    const hm = new THREE.Mesh(new THREE.BoxGeometry(5.4, H, 0.1), [M.wallPlain, M.wallPlain, M.wallPlain, M.wallPlain, M.wallPlain, new THREE.MeshStandardMaterial({ map: t, roughness: 0.85 })]);
    hm.position.set(5.3, H / 2, 5.2); root.add(hm);
    W.hoarding = hm;
    W.hoardingCol = col(2.6, 8, 5.12, 5.28, H, { hoarding: true });
    // expansion wing extras: display table with devices
    const zb = zoneBatches.expansion;
    zb.add('wood', new THREE.BoxGeometry(1.2, 0.05, 0.7).translate(6.0, 0.85, 8.2), 0xffffff);
    zb.add('matte', new THREE.BoxGeometry(1.1, 0.82, 0.6).translate(6.0, 0.41, 8.2), 0xffffff);
    for (let i = 0; i < 4; i++) zb.add('gloss', new THREE.BoxGeometry(0.2, 0.14, 0.14).translate(5.6 + i * 0.27, 0.95, 8.2), [0x2f80c9, 0xffffff, 0x4a5a75, 0x12a594][i]);
    W.expansionCols = [col(5.38, 6.62, 7.83, 8.57, 0.9, { zone: 'expansion' })];
    const etMat = lsign(S('w.wellness', { w: 768, h: 128, bg: '#ffffff', fg: '#1d2b2a', size: 0.38, radius: 16 }), { transparent: true });
    const em = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.27), etMat); em.position.set(7.97, 2.5, 6.6); em.rotation.y = -Math.PI / 2;
    (W.zones.expansion ||= new THREE.Group()).add(em);
  }

  // ── Interactable registration for shelf groups ──
  function shelfInteract(id, label, pos, stand, heading, section, zone) {
    W.interactables.push({ id, type: id === 'fridge' ? 'fridge' : id === 'storage' ? 'storage' : id === 'workstation' ? 'workstation' : 'shelf', label, pos, stand, heading, section, zone, radius: 1.6 });
  }
  const groups = {};
  for (const s of W.shelves) {
    const key = s.section + (s.def.gondola ? (s.front.x > 0 ? '_e' : '_w') : '') + (s.zone ? '_' + s.zone : '');
    (groups[key] ||= []).push(s);
  }
  for (const key in groups) {
    const list = groups[key];
    const c = new THREE.Vector3(); list.forEach((s) => c.add(s.center)); c.multiplyScalar(1 / list.length);
    const front = list[0].front;
    const stand = c.clone().addScaledVector(front, 0.95); stand.y = 0;
    const sec = list[0].section;
    // behind-counter shelves: stand closer
    if (sec === 'tablets' || sec === 'rx') { stand.z = -7.7; }
    const heading = Math.atan2(-front.x, -front.z);
    const it = { id: 'shelf_' + key, type: 'shelf', label: SECTIONS[sec].name, pos: c, stand, heading, section: sec, shelves: list, zone: list[0].zone, radius: 2.0 };
    W.interactables.push(it);
    list.forEach((s) => { s.interact = it; });
  }
  // counter & POS
  W.points.service = new THREE.Vector3(-1.2, 0, -2.85);
  W.points.pharmService = new THREE.Vector3(-1.2, 0, -4.75);
  W.points.posCustomer = new THREE.Vector3(posX, 0, -2.85);
  W.points.posPharm = new THREE.Vector3(posX, 0, -4.75);
  W.interactables.push({ id: 'counter', type: 'counter', label: 'Go to counter', pos: new THREE.Vector3(-1.2, 1, -3.8), stand: W.points.pharmService, heading: 0, radius: 1.6 });
  W.interactables.push({ id: 'pos', type: 'pos', label: 'Use POS terminal', pos: new THREE.Vector3(posX, 1.2, -3.9), stand: W.points.posPharm, heading: 0, radius: 1.5 });
  W.points.doorOutside = new THREE.Vector3(0, 0, 12.0);
  W.points.doorInside = new THREE.Vector3(0, 0, 8.0);
  W.points.entry = new THREE.Vector3(0, 0, 6.5);
  W.points.queue = [new THREE.Vector3(-1.2, 0, -1.7), new THREE.Vector3(-1.2, 0, -0.7), new THREE.Vector3(-0.6, 0, 0.4), new THREE.Vector3(0.2, 0, 1.4)];
  W.points.playerStart = new THREE.Vector3(-1.2, 0, -5.6);
  W.points.inspectorWait = new THREE.Vector3(0.0, 0, -2.85);

  // Hit boxes for tap raycasts
  for (const s of W.shelves) {
    const c = s.collider;
    W.hitBoxes.push({ box: new THREE.Box3(new THREE.Vector3(c.minX, 0, c.minZ), new THREE.Vector3(c.maxX, c.maxY, c.maxZ)), ref: s.interact, zone: s.zone });
  }
  const addHit = (id, min, max) => W.hitBoxes.push({ box: new THREE.Box3(new THREE.Vector3(...min), new THREE.Vector3(...max)), ref: W.interactables.find((i) => i.id === id) });
  addHit('fridge', [-7.95, 0, -5.6], [-7.1, 2.0, -4.6]);
  addHit('pos', [posX - 0.4, 1.0, -4.2], [posX + 0.4, 1.6, -3.5]);
  addHit('workstation', [-7.95, 0, -8.1], [-7.1, 1.3, -6.3]);
  addHit('storage', [4.7, 0, -9], [8, 2.6, -4.7]);
  addHit('counter', [-6, 0, -4.2], [posX - 0.45, 1.05, -3.4]);

  // ── Build static batches ──
  W.static = batch.build(root, mats);
  for (const z in zoneBatches) {
    const grp = (W.zones[z] ||= new THREE.Group());
    zoneBatches[z].build(grp, mats);
    root.add(grp);
  }
  W.zones.expansion.visible = false;

  // ── Baked floor AO from fixture footprints ──
  const fps = W.colliders.filter((c) => c.maxY > 0.3 && !(c.maxX - c.minX > 10 || c.maxZ - c.minZ > 10) && !c.hoarding).map((c) => ({ ...c, ao: c.counter ? 0.55 : 0.42 }));
  const ao = TX.floorAO({ minX: -8, minZ: -9, w: 16, d: 18 }, fps);
  floorMat.aoMap = ao; floorMat.aoMapIntensity = 1.0; floorMat.needsUpdate = true;
  // aoMap uses uv channel 0; per-texture transform keeps tiles repeating independently
  ao.channel = 0;

  // ── Lighting ──
  const hemi = new THREE.HemisphereLight(0xffffff, 0x8f877c, 0.34);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xfff6ea, 1.6);
  key.position.set(3, 9, 4); key.target.position.set(0, 0, -1);
  scene.add(key); scene.add(key.target);
  key.shadow.mapSize.set(2048, 2048);
  // bias tuned against acne (dark saw-teeth) on thin fixtures such as the shelf kick strips
  key.shadow.camera.left = -10; key.shadow.camera.right = 10; key.shadow.camera.top = 10; key.shadow.camera.bottom = -10;
  key.shadow.camera.near = 1; key.shadow.camera.far = 24; key.shadow.bias = -0.0001; key.shadow.normalBias = 0.02;
  key.castShadow = false;
  const fill = new THREE.DirectionalLight(0xe8f4ff, 0.22); fill.position.set(-4, 6, -6); scene.add(fill);
  W.lights = { hemi, key, fill, base: { hemi: 0.34, key: 1.6, fill: 0.22 } };
  const spot = new THREE.SpotLight(0xffffff, 0, 9, 0.5, 0.6, 1.2); spot.position.set(-1.2, 3.3, -1.5); spot.target.position.set(-1.2, 0, -3.2); scene.add(spot); scene.add(spot.target);
  W.lights.spot = spot;

  // ── Objective marker (floor ring + floating chevron) ──
  {
    const ring = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.2), new THREE.MeshBasicMaterial({ map: TX.ringTexture(), color: 0x19d3b8, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.02; ring.visible = false; root.add(ring);
    const chev = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.22, 4), new THREE.MeshBasicMaterial({ color: 0x19d3b8, toneMapped: false }));
    chev.rotation.x = Math.PI; chev.visible = false; root.add(chev);
    W.marker = { ring, chev, target: null };
  }
  const tapRing = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.6), new THREE.MeshBasicMaterial({ map: TX.ringTexture(), color: 0xffffff, transparent: true, depthWrite: false, toneMapped: false, opacity: 0 }));
  tapRing.rotation.x = -Math.PI / 2; tapRing.position.y = 0.02; root.add(tapRing);
  W.tapRing = tapRing;

  // ── API ──
  W.setMarker = (pos, height = 2.3) => {
    W.marker.target = pos ? pos.clone() : null;
    W.marker.ring.visible = !!pos; W.marker.chev.visible = !!pos;
    if (pos) { W.marker.ring.position.set(pos.x, 0.02, pos.z); W.marker.chev.position.set(pos.x, height, pos.z); }
  };
  W.showTap = (p) => { tapRing.position.set(p.x, 0.02, p.z); tapRing.material.opacity = 0.9; tapRing.scale.setScalar(0.5); };
  W.highlightShelf = (interact) => {
    for (const s of W.shelves) {
      const on = interact && s.interact === interact;
      s.hl.visible = on;
      s.lod.autoUpdate = !on;
      if (on) { s.hi.visible = true; s.med.visible = false; s.low.visible = false; }
    }
  };
  W.setExpansion = (on) => {
    W.zones.expansion.visible = on; W.hoarding.visible = !on;
    W.hoardingCol.disabled = on;
    W.expansionCols.forEach((c) => { c.disabled = !on; });
    W.colliders.filter((c) => c.zone === 'expansion').forEach((c) => { c.disabled = !on; });
    W.interactables.filter((i) => i.zone === 'expansion').forEach((i) => { i.disabled = !on; });
    W.hitBoxes.filter((h) => h.zone === 'expansion').forEach((h) => { h.disabled = !on; });
  };
  W.setExpansion(false);
  W.setCertified = (on) => { W.certificate.visible = on; };
  W.setPOS = (opts) => { TX.drawPOS(posScreen.g, 256, 160, opts); posScreen.texture.needsUpdate = true; };
  W.setCFD = (text, total) => cfd.draw((g, w, h) => { g.textAlign = 'left'; g.fillStyle = '#0d1f24'; g.fillRect(0, 0, w, h); g.fillStyle = '#7fe0d2'; TX.fitFont(g, String(text), 700, 14, w - 14, 8); g.fillText(String(text), 8, 24); g.fillStyle = '#fff'; g.font = '800 20px ' + TX.FONT; g.fillText(total, 8, 52); });
  W.setCFD(tp('g.welcome'), '₹ 0');
  /** Redraw every language-dependent sign, poster and screen. */
  W.relabel = () => {
    for (const sg of W.signs) { const old = sg.mat.map; sg.mat.map = sg.make(); old?.dispose(); }
    W.drawHoarding?.();
    W.drawWorkstation?.();
    if (W._fridge) W.setFridgeTemp(...W._fridge);
    W.setPOS({ line1: tp('g.ready'), line2: tp('g.scan') });
    W.setCFD(tp('g.welcome'), '₹ 0');
  };
  let theme = 'modern', mood = 'normal';
  const applyLights = () => {
    const L = W.lights;
    const k = mood === 'inspection' ? 0.82 : 1;
    if (theme === 'evening') { L.hemi.color.set(0xfff0dc); L.hemi.groundColor.set(0x6e6152); L.key.color.set(0xffe2c0); L.hemi.intensity = 0.3 * k; L.key.intensity = 1.25 * k; streetMat.color.set(0x5a6688); }
    else if (theme === 'hospital') { L.hemi.color.set(0xf4f8ff); L.hemi.groundColor.set(0x8d97a0); L.key.color.set(0xf7fbff); L.hemi.intensity = 0.4 * k; L.key.intensity = 1.6 * k; streetMat.color.set(0xffffff); }
    else { L.hemi.color.set(0xffffff); L.hemi.groundColor.set(0x8f877c); L.key.color.set(0xfff6ea); L.hemi.intensity = 0.34 * k; L.key.intensity = 1.6 * k; streetMat.color.set(0xffffff); }
    if (mood === 'inspection') { L.key.color.lerp(new THREE.Color(0xdde8ff), 0.5); L.spot.intensity = 6; } else L.spot.intensity = 0;
  };
  W.setTheme = (t) => {
    theme = t;
    const wallTint = t === 'hospital' ? 0xe8eef3 : t === 'evening' ? 0xf0e6d8 : 0xf0ede8;
    M.wall.color.set(wallTint);
    applyLights();
  };
  W.setMood = (m) => { mood = m; applyLights(); };
  W.setLODDebug = (on) => {
    atlasMat.color.set(on ? 0x8cff8c : 0xffffff);
    flatMat.color.set(on ? 0xffe066 : 0xffffff);
    facadeMat.color.set(on ? 0xff7a7a : 0xffffff);
  };
  W.setShadows = (on, ultra = false, desk = false) => {
    key.castShadow = on;
    const size = ultra ? (desk ? 4096 : 2048) : (desk ? 2048 : 1024);
    if (key.shadow.mapSize.x !== size) { key.shadow.mapSize.set(size, size); if (key.shadow.map) { key.shadow.map.dispose(); key.shadow.map = null; } }
    // Ultra: fixtures cast real-time shadows too (High relies on baked AO for fixtures)
    for (const k in W.static) if (k !== 'ceiling' && k !== 'glow') W.static[k].castShadow = ultra;
    for (const z in W.zones) W.zones[z].traverse((o) => { if (o.isMesh && !o.isInstancedMesh) o.castShadow = ultra; });
    M.glow.color.setScalar(ultra ? 2.2 : 1);
  };

  W.update = (dt, t, actors, camPos) => {
    // automatic door
    let near = false;
    for (const a of actors) { if (!a) continue; const p = a.group ? a.group.position : a; if (Math.abs(p.x) < 2.4 && Math.abs(p.z - 9) < 2.6) { near = true; break; } }
    const prev = W.door.target;
    W.door.target = near ? 1 : 0;
    if (W.door.target !== prev && W.onDoor) W.onDoor(W.door.target);
    W.door.open = damp(W.door.open, W.door.target, 4, dt);
    W.door.L.position.x = -0.65 - W.door.open * 1.25; W.door.R.position.x = 0.65 + W.door.open * 1.25;
    // marker animation
    if (W.marker.ring.visible) {
      const s = 1 + Math.sin(t * 4) * 0.08; W.marker.ring.scale.set(s, s, 1);
      W.marker.chev.position.y = (W.marker.baseY || 2.3) + Math.sin(t * 3) * 0.08; W.marker.chev.rotation.y = t * 1.5;
    }
    if (tapRing.material.opacity > 0) { tapRing.material.opacity = Math.max(0, tapRing.material.opacity - dt * 1.8); tapRing.scale.multiplyScalar(1 + dt * 1.5); }
    for (const s of W.shelves) if (s.hl.visible) s.hl.material.opacity = 0.1 + Math.sin(t * 3.5) * 0.05;
    // zone culling: storage room contents only when camera/player near
    if (camPos) {
      const inStorageView = camPos.z < -3.0;
      if (W.zones.storage) W.zones.storage.visible = inStorageView;
    }
  };

  // ── planar floor reflection (created on demand) ──
  let refl = null;
  const invReflWorld = new THREE.Matrix4();
  W.setReflections = (on, w = 512, h = 512) => {
    if (on && !refl) {
      refl = new Reflector(new THREE.PlaneGeometry(16, 18), { textureWidth: w, textureHeight: h, clipBias: 0.002, multisample: 4 });
      refl.rotation.x = -Math.PI / 2; refl.position.y = 0.0005;
      refl.material.colorWrite = false; refl.material.depthWrite = false; refl.renderOrder = -10;
      refl.matrixAutoUpdate = false; refl.updateMatrix(); refl.updateMatrixWorld(true);
      invReflWorld.copy(refl.matrixWorld).invert();
      const rt = refl.getRenderTarget();
      rt.texture.generateMipmaps = true; rt.texture.minFilter = THREE.LinearMipmapLinearFilter;
      const orig = refl.onBeforeRender, tm = refl.material.uniforms.textureMatrix.value;
      refl.onBeforeRender = function (r, s2, c) {
        if (s2.overrideMaterial) return;   // e.g. the ambient-occlusion normal pass: not a real view of the room
        floor.visible = false; W.marker.ring.visible && (W.marker.ring.material.visible = false);
        orig.call(this, r, s2, c);
        floor.visible = true; W.marker.ring.material.visible = true;
        RU.uReflMat.value.multiplyMatrices(tm, invReflWorld);
      };
      RU.uRefl.value = rt.texture;
      root.add(refl);
    }
    if (refl) { refl.visible = on; if (on) refl.getRenderTarget().setSize(w, h); }
    RU.uReflOn.value = on && refl ? 1 : 0;
    W.reflOn = !!(on && refl);
    W._refl = refl; W._reflU = RU;
  };
  W.resizeReflections = (w, h) => { if (refl && W.reflOn) refl.getRenderTarget().setSize(w, h); };

  W.activeColliders = () => W.colliders.filter((c) => !c.disabled);
  return W;
}
