// Third-person over-the-shoulder camera with collision avoidance, auto-follow,
// optional first-person mode, and scripted cinematic/dialogue shots.
import * as THREE from 'three';
import { clamp, damp, angleDamp } from '../core/util.js';

const _v = new THREE.Vector3(), _d = new THREE.Vector3(), _s = new THREE.Vector3();

function rayBox(o, d, c, tMax) {
  let tmin = 0, tmax = tMax;
  const mins = [c.minX, c.minY ?? 0, c.minZ], maxs = [c.maxX, c.maxY, c.maxZ];
  const oo = [o.x, o.y, o.z], dd = [d.x, d.y, d.z];
  for (let i = 0; i < 3; i++) {
    if (Math.abs(dd[i]) < 1e-8) { if (oo[i] < mins[i] || oo[i] > maxs[i]) return null; continue; }
    let t1 = (mins[i] - oo[i]) / dd[i], t2 = (maxs[i] - oo[i]) / dd[i];
    if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
    tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
    if (tmin > tmax) return null;
  }
  return tmin;
}

export class CameraRig {
  constructor(camera, world, settings) {
    this.cam = camera; this.world = world; this.settings = settings;
    this.yaw = 0; this.pitch = 0.3; this.dist = 3.1;
    this.minDist = 1.5; this.maxDist = 6.5;
    this.shoulder = 0.42;
    this.pos = new THREE.Vector3(0, 2, -8); this.look = new THREE.Vector3();
    this.curDist = this.dist;
    this.shot = null; this.mode = 'follow';
    this.lastManual = -10; this.time = 0;
    this.shake = 0;
  }
  rotate(dx, dy) {
    const k = 0.0055 * this.settings.camSensitivity;
    this.yaw -= dx * k;
    this.pitch = clamp(this.pitch + dy * k * (this.settings.invertY ? -1 : 1), this.settings.firstPerson ? -0.9 : -0.2, this.settings.firstPerson ? 0.9 : 1.15);
    this.lastManual = this.time;
  }
  zoom(f) { this.dist = clamp(this.dist * f, this.minDist, this.maxDist); this.lastManual = this.time; }
  setShot(pos, look, { cut = false, speed = 3, fov = null } = {}) {
    this.shot = { pos: pos.clone(), look: look.clone(), speed, fov };
    if (cut) { this.pos.copy(pos); this.look.copy(look); }
  }
  clearShot() { this.shot = null; }
  /** forward vector (horizontal) used to orient joystick input */
  forward(out = new THREE.Vector3()) { return out.set(Math.sin(this.yaw), 0, Math.cos(this.yaw)); }

  update(dt, player, moving) {
    this.time += dt;
    const cam = this.cam;
    const tf = (this.shot && this.shot.fov) || this.baseFov || 55;
    if (Math.abs(cam.fov - tf) > 0.05) { cam.fov = damp(cam.fov, tf, 4, dt); cam.updateProjectionMatrix(); }
    if (this.shot) {
      this.pos.x = damp(this.pos.x, this.shot.pos.x, this.shot.speed, dt);
      this.pos.y = damp(this.pos.y, this.shot.pos.y, this.shot.speed, dt);
      this.pos.z = damp(this.pos.z, this.shot.pos.z, this.shot.speed, dt);
      this.look.x = damp(this.look.x, this.shot.look.x, this.shot.speed * 1.2, dt);
      this.look.y = damp(this.look.y, this.shot.look.y, this.shot.speed * 1.2, dt);
      this.look.z = damp(this.look.z, this.shot.look.z, this.shot.speed * 1.2, dt);
      cam.position.copy(this.pos); cam.lookAt(this.look);
      if (player) player.group.visible = true;
      return;
    }
    const p = player.group.position;
    // auto camera: gently align behind movement direction
    if (this.settings.autoCamera && moving && this.time - this.lastManual > 1.8 && !this.settings.firstPerson) {
      this.yaw = angleDamp(this.yaw, player.heading, 1.2, dt);
    }
    if (this.settings.firstPerson) {
      const eye = _v.set(p.x, p.y + player.P.H - 0.08, p.z);
      const f = _d.set(Math.sin(this.yaw) * Math.cos(this.pitch), -Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch));
      this.pos.copy(eye).addScaledVector(_s.set(Math.sin(this.yaw), 0, Math.cos(this.yaw)), 0.12);
      this.look.copy(this.pos).add(f);
      cam.position.copy(this.pos); cam.lookAt(this.look);
      player.group.visible = false;
      return;
    }
    player.group.visible = true;
    const fwd = _s.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    const right = new THREE.Vector3(-Math.cos(this.yaw), 0, Math.sin(this.yaw));
    const pivot = new THREE.Vector3(p.x, p.y + 1.55, p.z).addScaledVector(right, this.shoulder);
    const dir = new THREE.Vector3(-fwd.x * Math.cos(this.pitch), Math.sin(this.pitch), -fwd.z * Math.cos(this.pitch)).normalize();
    // collision: cast from pivot along dir
    let maxD = this.dist;
    for (const c of this.world.colliders) {
      if (c.disabled || c.maxY < 0.4) continue;
      const t = rayBox(pivot, dir, c, maxD + 0.3);
      if (t !== null && t > 0.05) maxD = Math.min(maxD, t - 0.28);
    }
    // ceiling/floor
    if (dir.y > 0) maxD = Math.min(maxD, (3.25 - pivot.y) / dir.y);
    maxD = Math.max(0.35, maxD);
    this.curDist = maxD < this.curDist ? damp(this.curDist, maxD, 22, dt) : damp(this.curDist, maxD, 4, dt);
    const target = pivot.clone().addScaledVector(dir, this.curDist);
    this.pos.x = damp(this.pos.x, target.x, 14, dt); this.pos.y = damp(this.pos.y, target.y, 14, dt); this.pos.z = damp(this.pos.z, target.z, 14, dt);
    const lookT = pivot.clone().addScaledVector(fwd, 1.2); lookT.y -= 0.15;
    this.look.x = damp(this.look.x, lookT.x, 16, dt); this.look.y = damp(this.look.y, lookT.y, 16, dt); this.look.z = damp(this.look.z, lookT.z, 16, dt);
    cam.position.copy(this.pos);
    if (this.shake > 0 && !this.settings.reducedMotion) { cam.position.x += (Math.random() - 0.5) * this.shake; cam.position.y += (Math.random() - 0.5) * this.shake; this.shake = Math.max(0, this.shake - dt * 0.2); }
    cam.lookAt(this.look);
    // hide player if camera too close (inside the head)
    player.group.visible = this.curDist > 0.55;
  }
}
