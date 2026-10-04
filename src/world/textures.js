// Procedural canvas textures — keeps the build tiny (no image downloads) while
// giving the pharmacy realistic surface detail. Sizes kept small for mobile memory.
import { tp, isBi } from '../i18n/i18n.js';
import { EN } from '../i18n/en.js';
import * as THREE from 'three';
import { mulberry32 } from '../core/util.js';
import { SECTIONS } from '../data/products.js';

let ANISO = 4;
export function setAnisotropy(a) { ANISO = a; }

function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function tex(c, { repeat, srgb = true, mips = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = ANISO;
  t.generateMipmaps = mips;
  if (!mips) t.minFilter = THREE.LinearFilter;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}
export const FONT = '"Inter","Noto Sans Tamil","SF Pro Display","Segoe UI",Roboto,Helvetica,Arial,sans-serif';
/** Shrink a font size until text fits maxW. Returns the px size used. */
export function fitFont(g, text, weight, px, maxW, min = 8) { let s = px; g.font = `${weight} ${s}px ${FONT}`; while (s > min && g.measureText(text).width > maxW) { s -= 1; g.font = `${weight} ${s}px ${FONT}`; } return s; }

// ── Floor: polished porcelain tiles (one repeat = 2×2 tiles) ──
export function floorTexture() {
  const S = 512, c = canvas(S, S), g = c.getContext('2d');
  const rnd = mulberry32(7);
  for (let ty = 0; ty < 2; ty++) for (let tx = 0; tx < 2; tx++) {
    const base = 218 + Math.floor(rnd() * 9);
    g.fillStyle = `rgb(${base},${base - 3},${base - 8})`;
    g.fillRect(tx * 256, ty * 256, 256, 256);
    // marble-ish speckle and soft veins
    for (let i = 0; i < 900; i++) {
      const v = Math.floor(rnd() * 30);
      g.fillStyle = `rgba(${150 + v},${150 + v},${150 + v},${0.04 + rnd() * 0.05})`;
      g.fillRect(tx * 256 + rnd() * 256, ty * 256 + rnd() * 256, 1 + rnd() * 2, 1 + rnd() * 2);
    }
    g.strokeStyle = 'rgba(160,160,165,0.10)'; g.lineWidth = 1.5;
    for (let k = 0; k < 3; k++) {
      g.beginPath();
      let x = tx * 256 + rnd() * 256, y = ty * 256;
      g.moveTo(x, y);
      for (let s = 0; s < 8; s++) { x += (rnd() - 0.5) * 60; y += 32; g.lineTo(x, y); }
      g.stroke();
    }
  }
  // grout + soft bevel on each tile edge
  g.fillStyle = 'rgba(88,84,78,0.72)';
  g.fillRect(0, 0, S, 3); g.fillRect(0, 0, 3, S); g.fillRect(0, 254, S, 4); g.fillRect(254, 0, 4, S);
  g.fillStyle = 'rgba(255,255,255,0.35)';
  for (const o of [3, 258]) { g.fillRect(0, o, S, 1); g.fillRect(o, 0, 1, S); }
  g.fillStyle = 'rgba(0,0,0,0.06)';
  for (const o of [252, 509]) { g.fillRect(0, o, S, 2); g.fillRect(o, 0, 2, S); }
  return tex(c, { repeat: [1, 1] });
}

// ── Baked ambient occlusion for floor (soft contact shadows under fixtures) ──
export function floorAO(bounds, footprints) {
  const W = 512, H = Math.round(512 * (bounds.d / bounds.w));
  const c = canvas(W, H), g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
  const sx = W / bounds.w, sz = H / bounds.d;
  g.filter = 'blur(10px)';
  for (const f of footprints) {
    const x = (f.minX - bounds.minX) * sx, y = (f.minZ - bounds.minZ) * sz;
    const w = (f.maxX - f.minX) * sx, hh = (f.maxZ - f.minZ) * sz;
    g.fillStyle = `rgba(0,0,0,${f.ao ?? 0.45})`;
    g.fillRect(x - 4, y - 4, w + 8, hh + 8);
  }
  g.filter = 'blur(18px)';
  g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 26; g.strokeRect(0, 0, W, H);
  g.filter = 'none';
  const t = tex(c, { srgb: false });
  return t;
}

export function wallTexture(tint = [244, 245, 242]) {
  const S = 256, c = canvas(S, S), g = c.getContext('2d');
  g.fillStyle = `rgb(${tint[0]},${tint[1]},${tint[2]})`; g.fillRect(0, 0, S, S);
  const rnd = mulberry32(3);
  for (let i = 0; i < 2500; i++) { const v = rnd() < 0.5 ? 0 : 255; g.fillStyle = `rgba(${v},${v},${v},0.025)`; g.fillRect(rnd() * S, rnd() * S, 2, 2); }
  return tex(c, { repeat: [1, 1] });
}

export function woodTexture(base = [176, 132, 92]) {
  const W = 512, H = 128, c = canvas(W, H), g = c.getContext('2d');
  const rnd = mulberry32(11);
  g.fillStyle = `rgb(${base[0]},${base[1]},${base[2]})`; g.fillRect(0, 0, W, H);
  for (let y = 0; y < H; y += 1) {
    const v = Math.sin(y * 0.35 + Math.sin(y * 0.05) * 4) * 10 + (rnd() - 0.5) * 6;
    g.fillStyle = `rgba(${v > 0 ? 255 : 0},${v > 0 ? 230 : 0},${v > 0 ? 200 : 0},${Math.abs(v) / 120})`;
    g.fillRect(0, y, W, 1);
  }
  for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(80,50,30,0.08)'; g.fillRect(rnd() * W, rnd() * H, 30 + rnd() * 80, 1); }
  return tex(c, { repeat: [2, 1] });
}

export function ceilingTexture() {
  const S = 256, c = canvas(S, S), g = c.getContext('2d');
  g.fillStyle = '#f3f4f2'; g.fillRect(0, 0, S, S);
  const rnd = mulberry32(5);
  for (let i = 0; i < 3000; i++) { g.fillStyle = `rgba(0,0,0,${rnd() * 0.05})`; g.fillRect(rnd() * S, rnd() * S, 1, 1); }
  g.fillStyle = '#d7d9d6'; g.fillRect(0, 0, S, 4); g.fillRect(0, 0, 4, S);
  return tex(c, { repeat: [1, 1] });
}

// ── Product packaging atlas: 8×8 cells of 128px ──
// 0-31 cartons, 32-47 amber bottles, 48-55 jars/tubs, 56-63 device boxes
const ATLAS_BRANDS = ['Dolo 650', 'Okacet', 'Digene', 'Crocin', 'Brufen', 'Allegra', 'Omez', 'Electral', 'Candid', 'Calpol', 'Voveran', 'Betadine', 'Supradyn', 'Folvite', 'Shelcal', 'Limcee', 'Honitus', 'Nasoclear', 'Otrivin', 'Savlon', 'Gaviscon', 'Strepsils', 'Duphalac', 'Sinarest', 'Vicks', 'Nicotex', 'Hexidine', 'Moov', 'Iodex', 'Famocid', 'Eldoper', 'Dulcolax'];
const DOSAGES = ['650 mg', '10 mg', 'Gel 200ml', '500 mg', '400 mg', '120 mg', '20 mg', 'Sachet 21.8g', '1% w/w', '250 mg/5ml', '50 mg', '10% Sol.', 'Multivit', '5 mg', '500 mg', '500 mg Chew', '100 ml', '0.65% Drops', '0.1% Spray', 'Antiseptic', 'Syrup 150ml', 'Lozenge', '10 g/15ml', 'Tab', 'Vaporub', '2 mg Gum', 'Mouthwash', 'Ointment', 'Balm', '40 mg', '2 mg', '5 mg'];
const HUES = [168, 200, 12, 28, 340, 140, 220, 260, 45, 290, 190, 0, 100, 320, 210, 160];

// Draw medical vector icon on canvas
function drawIcon(g, icon, cx, cy, s, color) {
  g.save();
  g.translate(cx, cy);
  g.fillStyle = color;
  g.strokeStyle = color;
  g.lineWidth = s * 0.12;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  const r = s * 0.5;
  switch (icon) {
    case 'cross': {
      const w = s * 0.28, h = s * 0.85;
      g.beginPath();
      g.roundRect(-w / 2, -h / 2, w, h, w * 0.35);
      g.roundRect(-h / 2, -w / 2, h, w, w * 0.35);
      g.fill();
      break;
    }
    case 'pill': {
      // Capsule angled
      g.save();
      g.rotate(0.5);
      g.beginPath();
      g.roundRect(-s * 0.2, -s * 0.42, s * 0.4, s * 0.84, s * 0.2);
      g.stroke();
      g.beginPath();
      g.roundRect(-s * 0.2, 0, s * 0.4, s * 0.42, [0, 0, s * 0.2, s * 0.2]);
      g.fill();
      g.restore();
      // Round tablet
      g.beginPath();
      g.arc(s * 0.22, s * 0.22, s * 0.24, 0, Math.PI * 2);
      g.stroke();
      g.beginPath();
      g.moveTo(s * 0.08, s * 0.22);
      g.lineTo(s * 0.36, s * 0.22);
      g.stroke();
      break;
    }
    case 'rx': {
      g.font = `900 ${Math.round(s * 0.95)}px ${FONT}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('Rx', 0, 0);
      break;
    }
    case 'bottle': {
      g.beginPath();
      g.roundRect(-s * 0.28, -s * 0.22, s * 0.56, s * 0.65, s * 0.1);
      g.fill();
      // neck + cap
      g.fillRect(-s * 0.14, -s * 0.38, s * 0.28, s * 0.16);
      g.fillStyle = '#ffffff';
      g.roundRect(-s * 0.18, -s * 0.48, s * 0.36, s * 0.12, 3);
      g.fill();
      break;
    }
    case 'heart': {
      g.beginPath();
      g.moveTo(0, s * 0.35);
      g.bezierCurveTo(-s * 0.5, 0, -s * 0.45, -s * 0.45, 0, -s * 0.2);
      g.bezierCurveTo(s * 0.45, -s * 0.45, s * 0.5, 0, 0, s * 0.35);
      g.fill();
      // pulse line
      g.strokeStyle = '#ffffff';
      g.lineWidth = s * 0.09;
      g.beginPath();
      g.moveTo(-s * 0.35, -s * 0.02);
      g.lineTo(-s * 0.1, -s * 0.02);
      g.lineTo(-s * 0.02, -s * 0.22);
      g.lineTo(s * 0.08, s * 0.15);
      g.lineTo(s * 0.15, -s * 0.02);
      g.lineTo(s * 0.35, -s * 0.02);
      g.stroke();
      break;
    }
    case 'shield': {
      g.beginPath();
      g.moveTo(0, -s * 0.45);
      g.lineTo(s * 0.42, -s * 0.3);
      g.quadraticCurveTo(s * 0.42, s * 0.15, 0, s * 0.45);
      g.quadraticCurveTo(-s * 0.42, s * 0.15, -s * 0.42, -s * 0.3);
      g.closePath();
      g.fill();
      g.fillStyle = '#ffffff';
      g.beginPath();
      g.arc(0, -s * 0.02, s * 0.15, 0, Math.PI * 2);
      g.fill();
      break;
    }
    case 'baby': {
      g.beginPath();
      g.arc(0, -s * 0.05, s * 0.36, 0, Math.PI * 2);
      g.fill();
      // pacifier / small ears
      g.beginPath();
      g.arc(-s * 0.35, -s * 0.15, s * 0.12, 0, Math.PI * 2);
      g.arc(s * 0.35, -s * 0.15, s * 0.12, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = '#ffffff';
      g.lineWidth = s * 0.08;
      g.beginPath();
      g.arc(0, s * 0.05, s * 0.16, 0.2, Math.PI - 0.2);
      g.stroke();
      break;
    }
    case 'leaf': {
      g.beginPath();
      g.moveTo(-s * 0.35, s * 0.35);
      g.quadraticCurveTo(-s * 0.35, -s * 0.2, s * 0.35, -s * 0.35);
      g.quadraticCurveTo(s * 0.2, s * 0.35, -s * 0.35, s * 0.35);
      g.fill();
      g.strokeStyle = '#ffffff';
      g.lineWidth = s * 0.08;
      g.beginPath();
      g.moveTo(-s * 0.3, s * 0.3);
      g.lineTo(s * 0.25, -s * 0.25);
      g.stroke();
      break;
    }
    default: {
      const w = s * 0.26, h = s * 0.8;
      g.beginPath();
      g.roundRect(-w / 2, -h / 2, w, h, w * 0.3);
      g.roundRect(-h / 2, -w / 2, h, w, w * 0.3);
      g.fill();
      break;
    }
  }
  g.restore();
}

export function productAtlas(hi = true) {
  // Ultra-crisp HD 2048x2048 texture atlas for all medicine packs
  const K = 2, S = 1024, C = 128, c = canvas(S * K, S * K), g = c.getContext('2d');
  g.setTransform(K, 0, 0, K, 0, 0);
  const rnd = mulberry32(101);
  for (let i = 0; i < 64; i++) {
    const cx = (i % 8) * C, cy = Math.floor(i / 8) * C;
    const hue = HUES[i % HUES.length] + Math.floor(rnd() * 12);
    g.save(); g.translate(cx, cy);
    g.beginPath(); g.rect(0, 0, C, C); g.clip();

    if (i < 32) {
      // ── Premium medicine carton / box ──
      const brand = ATLAS_BRANDS[i % ATLAS_BRANDS.length];
      const dosage = DOSAGES[i % DOSAGES.length];
      const isRx = i % 3 === 0;

      // Base card gradient
      const bgGrad = g.createLinearGradient(0, 0, 0, C);
      bgGrad.addColorStop(0, '#ffffff');
      bgGrad.addColorStop(0.7, '#f7f9f9');
      bgGrad.addColorStop(1, '#edf2f2');
      g.fillStyle = bgGrad; g.fillRect(0, 0, C, C);

      // Top brand accent header
      const headH = 36;
      const headGrad = g.createLinearGradient(0, 0, C, 0);
      headGrad.addColorStop(0, `hsl(${hue},75%,38%)`);
      headGrad.addColorStop(1, `hsl(${hue + 15},85%,48%)`);
      g.fillStyle = headGrad;
      g.fillRect(0, 0, C, headH);

      // Metallic separator line
      g.fillStyle = '#f1c40f';
      g.fillRect(0, headH, C, 2.5);

      // Rx / OTC label badge in top right
      g.fillStyle = isRx ? '#dc2626' : '#16a34a';
      g.fillRect(C - 24, 0, 24, 15);
      g.fillStyle = '#ffffff';
      g.font = `900 9px ${FONT}`;
      g.textAlign = 'center';
      g.fillText(isRx ? 'Rx' : 'OTC', C - 12, 11);

      // Brand name on top header
      g.fillStyle = '#ffffff';
      g.font = `900 16px ${FONT}`;
      g.textAlign = 'left';
      fitFont(g, brand, 900, 16, C - 30);
      g.fillText(brand, 8, 24);

      // Strength / dosage in prominent badge
      g.fillStyle = `hsl(${hue},60%,25%)`;
      g.font = `800 13px ${FONT}`;
      g.fillText(dosage, 8, 56);

      // Generic active chemical subtitle
      g.fillStyle = '#64748b';
      g.font = `600 9px ${FONT}`;
      g.fillText('IP / USP Standard', 8, 68);

      // Blister pack foil simulation (embossed foil dots)
      g.fillStyle = '#e2e8f0';
      g.fillRect(8, 76, C - 16, 26);
      g.strokeStyle = '#cbd5e1';
      g.lineWidth = 1;
      g.strokeRect(8, 76, C - 16, 26);
      for (let dot = 0; dot < 5; dot++) {
        const dotX = 18 + dot * 22;
        g.beginPath();
        g.arc(dotX, 89, 7.5, 0, Math.PI * 2);
        g.fillStyle = '#f8fafc';
        g.fill();
        g.stroke();
        g.beginPath();
        g.arc(dotX - 1.5, 87.5, 3, 0, Math.PI * 2);
        g.fillStyle = '#ffffff';
        g.fill();
      }

      // Barcode at bottom
      g.fillStyle = '#1e293b';
      for (let b = 0; b < 22; b++) {
        if (rnd() > 0.3) {
          const bw = (b % 4 === 0) ? 2 : 1;
          g.fillRect(10 + b * 4, 110, bw, 12);
        }
      }
      g.fillStyle = '#94a3b8';
      g.font = `700 8px ${FONT}`;
      g.textAlign = 'right';
      g.fillText('10 Strips', C - 8, 120);

    } else if (i < 48) {
      // ── Amber glass bottle with realistic clinical label ──
      const brand = ATLAS_BRANDS[(i * 3) % ATLAS_BRANDS.length];
      const glassGrad = g.createLinearGradient(0, 0, C, 0);
      glassGrad.addColorStop(0, '#582b0e');
      glassGrad.addColorStop(0.3, '#8c4819');
      glassGrad.addColorStop(0.6, '#b05c21');
      glassGrad.addColorStop(1, '#50260c');
      g.fillStyle = glassGrad; g.fillRect(0, 0, C, C);

      // Glass specular reflection highlight
      g.fillStyle = 'rgba(255,255,255,0.22)';
      g.fillRect(C * 0.12, 0, 14, C);
      g.fillRect(C * 0.85, 0, 6, C);

      // Liquid level line
      g.fillStyle = 'rgba(30,12,4,0.45)';
      g.fillRect(0, 18, C, C - 18);

      // Crisp wrap-around label
      const lblY = 32, lblH = 68;
      const lblGrad = g.createLinearGradient(0, lblY, 0, lblY + lblH);
      lblGrad.addColorStop(0, '#ffffff');
      lblGrad.addColorStop(1, '#f8fafc');
      g.fillStyle = lblGrad;
      g.fillRect(0, lblY, C, lblH);

      // Top color stripe on label
      g.fillStyle = `hsl(${hue},80%,42%)`;
      g.fillRect(0, lblY, C, 14);

      g.fillStyle = '#ffffff';
      g.font = `900 10px ${FONT}`;
      g.textAlign = 'center';
      g.fillText('ORAL SOLUTION', C / 2, lblY + 10.5);

      // Brand name
      g.fillStyle = `hsl(${hue},70%,25%)`;
      g.font = `900 15px ${FONT}`;
      fitFont(g, brand, 900, 15, C - 16);
      g.fillText(brand, C / 2, lblY + 32);

      // Dosage & volume
      g.font = `700 10px ${FONT}`;
      g.fillStyle = '#475569';
      g.fillText('100 ml · Sugar Free', C / 2, lblY + 48);

      // Barcode
      g.fillStyle = '#1e293b';
      for (let b = 0; b < 16; b++) g.fillRect(C / 2 - 24 + b * 3, lblY + 54, 1.5, 8);

      // White safety measurement cap at top
      g.fillStyle = '#f1f5f9';
      g.fillRect(0, 0, C, 12);
      g.fillStyle = '#cbd5e1';
      for (let r = 0; r < 8; r++) g.fillRect(r * 16, 0, 3, 12);

    } else if (i < 56) {
      // ── Ointment tub / jar ──
      const brand = ATLAS_BRANDS[(i * 5) % ATLAS_BRANDS.length];
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, C, C);

      // Metallic / colored cap
      const capGrad = g.createLinearGradient(0, 0, C, 0);
      capGrad.addColorStop(0, `hsl(${hue},60%,35%)`);
      capGrad.addColorStop(0.5, `hsl(${hue},75%,55%)`);
      capGrad.addColorStop(1, `hsl(${hue},60%,35%)`);
      g.fillStyle = capGrad;
      g.fillRect(0, 0, C, 22);

      // Jar body label
      g.fillStyle = `hsl(${hue},80%,46%)`;
      g.fillRect(0, 26, C, 64);
      g.fillStyle = '#ffffff';
      g.font = `900 16px ${FONT}`;
      g.textAlign = 'center';
      fitFont(g, brand, 900, 16, C - 14);
      g.fillText(brand, C / 2, 56);
      g.font = `700 10px ${FONT}`;
      g.fillText('CREAM · 50 g', C / 2, 74);

      // Jar base
      g.fillStyle = '#e2e8f0';
      g.fillRect(0, 94, C, C - 94);

    } else {
      // ── Medical diagnostic device carton ──
      g.fillStyle = '#f8fafc'; g.fillRect(0, 0, C, C);
      // Top header
      g.fillStyle = '#0284c7'; g.fillRect(0, 0, C, 28);
      g.fillStyle = '#ffffff'; g.font = `900 11px ${FONT}`; g.textAlign = 'center';
      g.fillText('DIGITAL MONITOR', C / 2, 18);

      // LCD display simulation box
      g.fillStyle = '#0f172a';
      g.roundRect(20, 36, C - 40, 52, 6);
      g.fill();

      // Screen readout glow
      g.fillStyle = '#38bdf8';
      g.font = `900 18px ${FONT}`;
      const readouts = ['120/80', '98.6°F', '99% SpO2', '105 mg/dL'];
      g.fillText(readouts[i % 4], C / 2, 64);
      g.font = `600 9px ${FONT}`;
      g.fillText('CLINICALLY TESTED', C / 2, 78);

      // Bottom color band
      g.fillStyle = '#0284c7';
      g.fillRect(0, C - 16, C, 16);
      g.fillStyle = '#ffffff';
      g.font = `700 8px ${FONT}`;
      g.fillText('HIGH PRECISION SENSOR', C / 2, C - 4);
    }
    g.restore();
  }
  return tex(c);
}

// Low-LOD shelf facade: columns for box, bottle, jar, device, baby
export function shelfFacadeTexture() {
  const cols = 5, W = 128 * cols, H = 224, c = canvas(W, H), g = c.getContext('2d');
  const rnd = mulberry32(9);
  for (let k = 0; k < cols; k++) {
    const x0 = k * 128;
    g.fillStyle = '#f1f5f9'; g.fillRect(x0, 0, 128, H);
    for (let r = 0; r < 5; r++) {
      const y = H - (r * 42 + 16);
      g.fillStyle = '#cbd5e1'; g.fillRect(x0, y, 128, 4);
      let x = x0 + 4;
      while (x < x0 + 120) {
        const w = k === 1 ? 12 : k === 4 ? 24 : 11 + rnd() * 8;
        const hh = k === 1 ? 28 : k === 3 ? 26 : k === 4 ? 32 : 20 + rnd() * 12;
        const hue = HUES[Math.floor(rnd() * HUES.length)];
        g.fillStyle = k === 1 ? (rnd() < 0.7 ? '#8c4819' : '#e2e8f0') : `hsl(${hue},65%,48%)`;
        g.fillRect(x, y - hh, Math.min(w, x0 + 124 - x), hh);
        x += w + 2.5;
      }
    }
  }
  return tex(c);
}

// ── Ultra-HD Signage System ──
// Signs rendered at 2048x448 with crystal-clear vector icons, crisp typography, and sleek borders
const SIGN_SCALE = 2;

export function signTexture(text, {
  w = 1024, h = 224, bg = '#ffffff', fg = '#0f172a', sub = '', icon = 'cross',
  accent = '#0f8a7e', font = 900, size = 0.44, align = 'center', radius = 24
} = {}) {
  const c = canvas(w * SIGN_SCALE, h * SIGN_SCALE), g = c.getContext('2d');
  g.scale(SIGN_SCALE, SIGN_SCALE);

  // Soft modern background: clean hospital gradient that never blows out bloom
  const bgGrad = g.createLinearGradient(0, 0, 0, h);
  bgGrad.addColorStop(0, '#ffffff');
  bgGrad.addColorStop(1, '#f1f5f5');
  g.fillStyle = bg || bgGrad;

  if (radius) {
    g.beginPath();
    g.roundRect(0, 0, w, h, radius);
    g.fill();
  } else {
    g.fillRect(0, 0, w, h);
  }

  // Top color accent bar (identifies category instantly)
  g.fillStyle = accent || '#0f8a7e';
  if (radius) {
    g.beginPath();
    g.roundRect(0, 0, w, 10, [radius, radius, 0, 0]);
    g.fill();
  } else {
    g.fillRect(0, 0, w, 10);
  }

  // Subtle interior frame border
  g.strokeStyle = '#cbd5e1';
  g.lineWidth = 2;
  if (radius) {
    g.beginPath();
    g.roundRect(1, 1, w - 2, h - 2, radius);
    g.stroke();
  } else {
    g.strokeRect(1, 1, w - 2, h - 2);
  }

  // Circular Icon Badge on Left
  const badgeR = h * 0.32;
  const badgeX = h * 0.48;
  const badgeY = h * 0.54;

  g.beginPath();
  g.arc(badgeX, badgeY, badgeR, 0, Math.PI * 2);
  g.fillStyle = accent ? `${accent}18` : 'rgba(15,138,126,0.12)';
  g.fill();
  g.strokeStyle = accent || '#0f8a7e';
  g.lineWidth = 2.5;
  g.stroke();

  drawIcon(g, icon, badgeX, badgeY, badgeR * 1.1, accent || '#0f8a7e');

  // Main Text + Subtitle
  const textX = badgeX + badgeR + 24;
  const maxW = w - textX - 28;

  g.fillStyle = fg || '#0f172a';
  g.textAlign = 'left';
  g.textBaseline = 'middle';

  const mainY = sub ? h * 0.42 : h * 0.54;
  const px = fitFont(g, text, font, Math.round(h * (sub ? size : size * 1.12)), maxW);

  // Soft drop shadow for crisp readability
  g.shadowColor = 'rgba(0,0,0,0.12)';
  g.shadowBlur = 4;
  g.shadowOffsetY = 2;
  g.fillText(text, textX, mainY);
  g.shadowBlur = 0;
  g.shadowOffsetY = 0;

  if (sub) {
    g.fillStyle = '#64748b';
    fitFont(g, sub, 700, Math.round(h * 0.22), maxW);
    g.fillText(sub, textX, h * 0.74);
  }

  return tex(c);
}

const SECTION_ICONS = {
  tablets: 'pill', rx: 'rx', syrups: 'bottle', tonics: 'bottle',
  skincare: 'shield', babycare: 'baby', vitamins: 'leaf',
  firstaid: 'cross', otc: 'cross', devices: 'heart', personal: 'shield'
};

const SHORT_EN = Object.fromEntries(Object.entries(SECTIONS).map(([k, v]) => [k, v.short]));

export function sectionSignTexture(key) {
  const s = SECTIONS[key] || { short: key, color: '#0f8a7e' };
  const sub = isBi() ? SHORT_EN[key] : '';
  const ic = SECTION_ICONS[key] || 'cross';
  return signTexture(String(s.short), {
    w: 768, h: 180, bg: '#ffffff', fg: '#0f172a',
    accent: s.color, icon: ic,
    size: sub ? 0.44 : 0.52, font: 900, radius: 24, sub
  });
}

/** Dedicated Ultra-HD Pharmacy Main Marquee Banner */
export function pharmacyMarqueeTexture() {
  const w = 2048, h = 448;
  const c = canvas(w, h), g = c.getContext('2d');

  // Deep clinical teal gradient with premium bezel
  const bgGrad = g.createLinearGradient(0, 0, w, 0);
  bgGrad.addColorStop(0, '#04221e');
  bgGrad.addColorStop(0.5, '#073d36');
  bgGrad.addColorStop(1, '#04221e');
  g.fillStyle = bgGrad;
  g.beginPath();
  g.roundRect(0, 0, w, h, 28);
  g.fill();

  // Emerald glowing border
  g.strokeStyle = '#10b981';
  g.lineWidth = 6;
  g.stroke();

  // Large glowing medical cross badge on left
  const crossX = 220, crossY = h / 2, crossS = 190;
  g.save();
  g.shadowColor = '#34d399';
  g.shadowBlur = 35;
  drawIcon(g, 'cross', crossX, crossY, crossS, '#10b981');
  g.restore();

  // Inner white cross
  drawIcon(g, 'cross', crossX, crossY, crossS * 0.7, '#ffffff');

  // Main bold title
  const textX = crossX + crossS / 2 + 60;
  const mainTitle = tp('w.pharmacy') || 'PHARMACY';
  g.fillStyle = '#ffffff';
  g.textAlign = 'left';
  g.textBaseline = 'middle';
  fitFont(g, mainTitle, 900, 160, w - textX - 80);
  g.shadowColor = 'rgba(0,0,0,0.5)';
  g.shadowBlur = 12;
  g.shadowOffsetY = 4;
  g.fillText(mainTitle, textX, h * 0.42);
  g.shadowBlur = 0;

  // Tagline subtitle
  g.fillStyle = '#6ee7b7';
  g.font = `800 46px ${FONT}`;
  const subText = isBi() ? 'CLINICAL DISPENSARY & HEALTHCARE · மருந்தகம்' : 'CLINICAL DISPENSARY & HEALTHCARE';
  g.fillText(subText, textX, h * 0.78);

  return tex(c);
}

/** Department Lightbox Sign Texture (Prescriptions, Consultation, Cashier) */
export function deptSignTexture(title, sub, icon, accentColor = '#0f8a7e') {
  const w = 1024, h = 260;
  const c = canvas(w, h), g = c.getContext('2d');

  // Clean luminous background
  const bgGrad = g.createLinearGradient(0, 0, 0, h);
  bgGrad.addColorStop(0, '#ffffff');
  bgGrad.addColorStop(1, '#f8fafc');
  g.fillStyle = bgGrad;
  g.beginPath();
  g.roundRect(0, 0, w, h, 28);
  g.fill();

  // Top and bottom accent lines
  g.fillStyle = accentColor;
  g.beginPath();
  g.roundRect(0, 0, w, 14, [28, 28, 0, 0]);
  g.roundRect(0, h - 14, w, 14, [0, 0, 28, 28]);
  g.fill();

  // Border
  g.strokeStyle = '#cbd5e1';
  g.lineWidth = 3;
  g.stroke();

  // Left icon badge
  const iconX = 110, iconY = h / 2, iconS = 130;
  g.beginPath();
  g.arc(iconX, iconY, iconS * 0.5, 0, Math.PI * 2);
  g.fillStyle = `${accentColor}18`;
  g.fill();
  g.strokeStyle = accentColor;
  g.lineWidth = 3;
  g.stroke();
  drawIcon(g, icon, iconX, iconY, iconS * 0.7, accentColor);

  // Department title
  const textX = iconX + iconS / 2 + 28;
  const maxW = w - textX - 32;
  g.fillStyle = '#0f172a';
  g.textAlign = 'left';
  g.textBaseline = 'middle';
  fitFont(g, title, 900, sub ? 68 : 82, maxW);
  g.shadowColor = 'rgba(0,0,0,0.15)';
  g.shadowBlur = 6;
  g.fillText(title, textX, sub ? h * 0.42 : h * 0.52);
  g.shadowBlur = 0;

  if (sub) {
    g.fillStyle = '#64748b';
    fitFont(g, sub, 700, 36, maxW);
    g.fillText(sub, textX, h * 0.75);
  }

  return tex(c);
}

// Health awareness posters (fictional, educational)
export function posterTexture(kind) {
  const W = 256, H = 360, c = canvas(W * SIGN_SCALE, H * SIGN_SCALE), g = c.getContext('2d');
  g.scale(SIGN_SCALE, SIGN_SCALE);
  const P = {
    hands: { bg: '#e8f7f4', ac: '#0f8a7e', t: tp('w.poster.hands'), s: tp('w.poster.handsSub'), ic: 'drop' },
    ask: { bg: '#eef4fb', ac: '#2f6fb3', t: tp('w.poster.ask'), s: tp('w.poster.askSub'), ic: 'chat' },
    bp: { bg: '#fdf1ec', ac: '#c7502d', t: tp('w.poster.bp'), s: tp('w.poster.bpSub'), ic: 'heart' },
    abx: { bg: '#f3f0fb', ac: '#6b4fd1', t: tp('w.poster.abx'), s: tp('w.poster.abxSub'), ic: 'pill' },
  }[kind];
  g.fillStyle = P.bg; g.fillRect(0, 0, W, H);
  g.fillStyle = P.ac; g.fillRect(0, 0, W, 10); g.fillRect(0, H - 50, W, 50);
  g.beginPath(); g.arc(W / 2, 120, 62, 0, Math.PI * 2); g.fillStyle = '#fff'; g.fill();
  g.strokeStyle = P.ac; g.lineWidth = 9; g.lineCap = 'round';
  if (P.ic === 'drop') { g.beginPath(); g.moveTo(W / 2, 78); g.quadraticCurveTo(W / 2 + 40, 130, W / 2, 158); g.quadraticCurveTo(W / 2 - 40, 130, W / 2, 78); g.stroke(); }
  else if (P.ic === 'chat') { g.strokeRect(W / 2 - 38, 92, 76, 48); g.beginPath(); g.moveTo(W / 2 - 20, 140); g.lineTo(W / 2 - 30, 158); g.lineTo(W / 2, 140); g.stroke(); }
  else if (P.ic === 'heart') { g.beginPath(); g.moveTo(W / 2, 160); g.bezierCurveTo(W / 2 - 70, 110, W / 2 - 30, 70, W / 2, 100); g.bezierCurveTo(W / 2 + 30, 70, W / 2 + 70, 110, W / 2, 160); g.stroke(); }
  else { g.save(); g.translate(W / 2, 120); g.rotate(-0.7); g.strokeRect(-40, -16, 80, 32); g.beginPath(); g.moveTo(0, -16); g.lineTo(0, 16); g.stroke(); g.restore(); g.strokeStyle = '#d33'; g.beginPath(); g.moveTo(W / 2 - 50, 70); g.lineTo(W / 2 + 50, 170); g.stroke(); }
  g.fillStyle = '#1d2b2a'; g.textAlign = 'center';
  const ts = fitFont(g, P.t, 900, 22, 300, 15);
  const tl = g.measureText(P.t).width > 228 ? wrap(g, P.t, W / 2, 218, 228, ts + 3) : (g.fillText(P.t, W / 2, 228), 1);
  g.font = `500 15px ${FONT}`; g.fillStyle = '#44504f';
  wrap(g, P.s, W / 2, 228 + tl * (ts + 3) + 4, 210, 19);
  g.fillStyle = '#fff'; fitFont(g, tp('w.poster.foot'), 700, 13, W - 20); g.fillText(tp('w.poster.foot'), W / 2, H - 22);
  return tex(c);
}
function wrap(g, text, x, y, maxW, lh) {
  const words = String(text).split(' '); let line = '', n = 0;
  for (const w of words) { const t = line ? line + ' ' + w : w; if (line && g.measureText(t).width > maxW) { g.fillText(line, x, y); n++; line = w; y += lh; } else line = t; }
  if (line) { g.fillText(line, x, y); n++; }
  return n;
}

export function streetTexture() {
  const W = 1024, H = 512, c = canvas(W, H), g = c.getContext('2d');
  const sky = g.createLinearGradient(0, 0, 0, H * 0.6);
  sky.addColorStop(0, '#9fc8e8'); sky.addColorStop(1, '#e6f1f7');
  g.fillStyle = sky; g.fillRect(0, 0, W, H);
  const rnd = mulberry32(21);
  let x = 0;
  while (x < W) {
    const bw = 90 + rnd() * 140, bh = 140 + rnd() * 160;
    const shade = 180 + Math.floor(rnd() * 50);
    g.fillStyle = `rgb(${shade},${shade - 8},${shade - 18})`;
    g.fillRect(x, H * 0.62 - bh, bw, bh);
    g.fillStyle = 'rgba(80,110,140,0.35)';
    for (let wy = H * 0.62 - bh + 14; wy < H * 0.62 - 20; wy += 26) for (let wx = x + 10; wx < x + bw - 16; wx += 22) g.fillRect(wx, wy, 12, 15);
    x += bw + 6;
  }
  g.fillStyle = '#8a8d90'; g.fillRect(0, H * 0.62, W, H * 0.12);
  g.fillStyle = '#5d6165'; g.fillRect(0, H * 0.74, W, H * 0.26);
  g.fillStyle = '#e8e8e8'; for (let i = 0; i < W; i += 80) g.fillRect(i, H * 0.86, 44, 6);
  for (let i = 0; i < 7; i++) { const tx = rnd() * W; g.fillStyle = '#5b7c4a'; g.beginPath(); g.arc(tx, H * 0.52, 34 + rnd() * 16, 0, 7); g.fill(); g.fillStyle = '#6b5440'; g.fillRect(tx - 4, H * 0.55, 8, 50); }
  return tex(c);
}

export function blobShadowTexture() {
  const S = 128, c = canvas(S, S), g = c.getContext('2d');
  const gr = g.createRadialGradient(S / 2, S / 2, 4, S / 2, S / 2, S / 2);
  gr.addColorStop(0, 'rgba(0,0,0,0.55)'); gr.addColorStop(0.55, 'rgba(0,0,0,0.25)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, S, S);
  return tex(c, { srgb: false });
}

export function ringTexture() {
  const S = 128, c = canvas(S, S), g = c.getContext('2d');
  g.strokeStyle = '#ffffff'; g.lineWidth = 9; g.beginPath(); g.arc(S / 2, S / 2, S / 2 - 10, 0, Math.PI * 2); g.stroke();
  g.globalAlpha = 0.35; g.lineWidth = 22; g.beginPath(); g.arc(S / 2, S / 2, S / 2 - 22, 0, Math.PI * 2); g.stroke();
  return tex(c, { srgb: false });
}

// Dynamic screens (POS / fridge display / certificate)
export class ScreenTexture {
  constructor(w, h) { this.c = canvas(w, h); this.g = this.c.getContext('2d'); this.texture = tex(this.c, { mips: false }); }
  draw(fn) { fn(this.g, this.c.width, this.c.height); this.texture.needsUpdate = true; }
}

export function drawPOS(g, W, H, { title = tp('w.pos'), line1 = tp('g.ready'), line2 = '', total = '', mode = 'normal' } = {}) {
  g.fillStyle = mode === 'inspection' ? '#2a1a1a' : '#0d1f24'; g.fillRect(0, 0, W, H);
  g.fillStyle = mode === 'inspection' ? '#e0533d' : '#12a594'; g.fillRect(0, 0, W, 34);
  g.fillStyle = '#fff'; g.font = `800 20px ${FONT}`; g.textAlign = 'left'; g.fillText(title, 12, 24);
  fitFont(g, String(line1), 600, 22, W - 24); g.fillStyle = '#d8f3ef'; g.fillText(String(line1), 12, 76);
  fitFont(g, String(line2), 500, 16, W - 24); g.fillStyle = '#9fc9c3'; g.fillText(String(line2), 12, 104);
  if (total) { g.textAlign = 'right'; g.font = `900 34px ${FONT}`; g.fillStyle = '#fff'; g.fillText(total, W - 14, H - 18); }
}

export function certificateTexture(name = tp('w.storeName')) {
  const W = 384, H = 280, c = canvas(W, H), g = c.getContext('2d');
  g.fillStyle = '#5a3d22'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#fbf8ef'; g.fillRect(14, 14, W - 28, H - 28);
  g.strokeStyle = '#c9a54a'; g.lineWidth = 4; g.strokeRect(24, 24, W - 48, H - 48);
  g.fillStyle = '#0f8a7e'; g.textAlign = 'center'; fitFont(g, tp('w.cert.title'), 900, 26, W - 70); g.fillText(tp('w.cert.title'), W / 2, 80);
  g.fillStyle = '#333'; fitFont(g, tp('w.cert.sub'), 500, 15, W - 70); g.fillText(tp('w.cert.sub'), W / 2, 110);
  fitFont(g, name, 700, 20, W - 70); g.fillText(name, W / 2, 150);
  fitFont(g, tp('w.cert.score'), 600, 14, W - 70); g.fillStyle = '#666'; g.fillText(tp('w.cert.score'), W / 2, 180);
  g.beginPath(); g.arc(W / 2, 222, 22, 0, 7); g.fillStyle = '#c9a54a'; g.fill(); g.fillStyle = '#fff'; g.font = `900 18px ${FONT}`; g.fillText('✓', W / 2, 229);
  return tex(c);
}

export const signText = (key) => ({ text: tp(key), sub: isBi() ? (EN[key] || '') : '' });

