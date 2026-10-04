// Grid navigation (A* + line-of-sight smoothing) for tap-to-move and customer pathing.
import * as THREE from 'three';

export class NavGrid {
  constructor(bounds, cell = 0.2) {
    this.b = bounds; this.cell = cell;
    this.w = Math.ceil((bounds.maxX - bounds.minX) / cell);
    this.h = Math.ceil((bounds.maxZ - bounds.minZ) / cell);
    this.blocked = new Uint8Array(this.w * this.h);
  }
  rebuild(colliders, radius = 0.3) {
    this.blocked.fill(0);
    const { minX, minZ } = this.b;
    for (const c of colliders) {
      if (c.disabled) continue;
      const x0 = Math.max(0, Math.floor((c.minX - radius - minX) / this.cell));
      const x1 = Math.min(this.w - 1, Math.floor((c.maxX + radius - minX) / this.cell));
      const z0 = Math.max(0, Math.floor((c.minZ - radius - minZ) / this.cell));
      const z1 = Math.min(this.h - 1, Math.floor((c.maxZ + radius - minZ) / this.cell));
      for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) this.blocked[z * this.w + x] = 1;
    }
    // room border
    for (let x = 0; x < this.w; x++) { this.blocked[x] = 1; this.blocked[(this.h - 1) * this.w + x] = 1; }
    for (let z = 0; z < this.h; z++) { this.blocked[z * this.w] = 1; this.blocked[z * this.w + this.w - 1] = 1; }
  }
  toCell(x, z) { return [Math.floor((x - this.b.minX) / this.cell), Math.floor((z - this.b.minZ) / this.cell)]; }
  toWorld(cx, cz) { return new THREE.Vector3(this.b.minX + (cx + 0.5) * this.cell, 0, this.b.minZ + (cz + 0.5) * this.cell); }
  free(cx, cz) { return cx >= 0 && cz >= 0 && cx < this.w && cz < this.h && !this.blocked[cz * this.w + cx]; }
  nearestFree(cx, cz) {
    if (this.free(cx, cz)) return [cx, cz];
    for (let r = 1; r < 12; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      if (Math.abs(dx) !== r && Math.abs(dz) !== r) continue;
      if (this.free(cx + dx, cz + dz)) return [cx + dx, cz + dz];
    }
    return null;
  }
  lineFree(a, b) {
    const dx = b[0] - a[0], dz = b[1] - a[1];
    const n = Math.max(Math.abs(dx), Math.abs(dz)) * 2;
    for (let i = 0; i <= n; i++) {
      const t = n ? i / n : 0;
      const x = Math.round(a[0] + dx * t), z = Math.round(a[1] + dz * t);
      if (!this.free(x, z)) return false;
    }
    return true;
  }
  findPath(from, to) {
    let s = this.nearestFree(...this.toCell(from.x, from.z));
    let g = this.nearestFree(...this.toCell(to.x, to.z));
    if (!s || !g) return null;
    const W = this.w, N = W * this.h;
    const sI = s[1] * W + s[0], gI = g[1] * W + g[0];
    const gScore = new Float32Array(N).fill(Infinity), came = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
    const open = [sI]; gScore[sI] = 0;
    const hf = (i) => { const x = i % W, z = (i / W) | 0; const dx = Math.abs(x - g[0]), dz = Math.abs(z - g[1]); return Math.max(dx, dz) + 0.414 * Math.min(dx, dz); };
    const f = new Float32Array(N).fill(Infinity); f[sI] = hf(sI);
    const dirs = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
    let iter = 0;
    while (open.length && iter++ < 20000) {
      let bi = 0; for (let i = 1; i < open.length; i++) if (f[open[i]] < f[open[bi]]) bi = i;
      const cur = open[bi]; open[bi] = open[open.length - 1]; open.pop();
      if (cur === gI) break;
      closed[cur] = 1;
      const cx = cur % W, cz = (cur / W) | 0;
      for (const [dx, dz, cost] of dirs) {
        const nx = cx + dx, nz = cz + dz;
        if (!this.free(nx, nz)) continue;
        if (dx && dz && (!this.free(cx + dx, cz) || !this.free(cx, cz + dz))) continue;
        const ni = nz * W + nx;
        if (closed[ni]) continue;
        const ng = gScore[cur] + cost;
        if (ng < gScore[ni]) { gScore[ni] = ng; f[ni] = ng + hf(ni); came[ni] = cur; if (!open.includes(ni)) open.push(ni); }
      }
    }
    if (came[gI] === -1 && sI !== gI) return null;
    const cells = []; let c = gI; while (c !== -1) { cells.push([c % W, (c / W) | 0]); if (c === sI) break; c = came[c]; }
    cells.reverse();
    // string-pulling
    const out = []; let anchor = cells[0];
    for (let i = 1; i < cells.length; i++) {
      if (!this.lineFree(anchor, cells[i])) { out.push(cells[i - 1]); anchor = cells[i - 1]; }
    }
    const pts = out.map((c2) => this.toWorld(c2[0], c2[1]));
    const end = to.clone ? to.clone() : new THREE.Vector3(to.x, 0, to.z);
    end.y = 0;
    if (!this.free(...this.toCell(end.x, end.z))) { const ww = this.toWorld(g[0], g[1]); pts.push(ww); } else pts.push(end);
    return pts;
  }
}
