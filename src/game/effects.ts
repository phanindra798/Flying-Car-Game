import * as THREE from 'three';
import type { GameEvent, Simulation } from './simulation';

const CAPACITY = 80;
interface Particle { age: number; life: number; x: number; y: number; distance: number; vx: number; vy: number; vz: number; size: number; stretch: number; pitch: number; roll: number; gravity: number; color: number }
/** A fixed pool and one instanced draw call. Visual state never changes the simulation. */
export class GameEffects {
  readonly mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, depthWrite: false }), CAPACITY);
  private readonly particles: Particle[] = Array.from({ length: CAPACITY }, () => ({ age: 0, life: 0, x: 0, y: 0, distance: 0, vx: 0, vy: 0, vz: 0, size: 0, stretch: 1, pitch: 0, roll: 0, gravity: 0, color: 0xffffff }));
  private readonly dummy = new THREE.Object3D();
  private readonly nozzle = new THREE.Vector3();
  private readonly rotation = new THREE.Euler();
  private readonly color = new THREE.Color();
  private cursor = 0;
  private emission = 0;
  private limit = 48;
  private clock = 0;
  private lastBurst: string | null = null;
  constructor(scene: THREE.Scene) {
    this.mesh.count = 0; this.mesh.visible = false; this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(this.mesh);
  }
  configure(limit: number) {
    const bounded = Math.max(0, Math.min(CAPACITY, Math.floor(limit)));
    if (this.limit !== bounded) { this.limit = bounded; this.clear(); }
  }
  clear() {
    for (const p of this.particles) p.life = 0;
    this.cursor = 0; this.emission = 0; this.clock = 0; this.lastBurst = null;
    this.mesh.count = 0; this.mesh.visible = false;
  }
  inspect() { return { count: this.mesh.count, limit: this.limit, clock: this.clock, lastBurst: this.lastBurst }; }
  private next() {
    const p = this.particles[this.cursor++ % this.limit];
    p.age = 0; p.vx = 0; p.vy = 0; p.vz = 0; p.gravity = 0; p.pitch = 0; p.roll = 0;
    return p;
  }
  onEvent(event: GameEvent, sim: Simulation) {
    if (!this.limit || (event.kind !== 'crash' && !event.landing)) return;
    const crash = event.kind === 'crash';
    this.lastBurst = crash ? 'crash' : event.landing!.quality;
    const clean = event.landing?.quality === 'clean';
    const count = Math.min(this.limit, crash ? 32 : clean ? 24 : 14);
    for (let i = 0; i < count; i++) {
      const p = this.next(), angle = i * 2.399963, spread = crash ? 4 : 2.4;
      p.x = sim.x + Math.cos(angle) * 0.65;
      p.y = crash ? sim.height + 0.5 : 0.12;
      p.distance = sim.distance + Math.sin(angle) * 1.5;
      p.vx = Math.cos(angle) * spread; p.vz = Math.sin(angle) * spread;
      p.vy = 1.5 + i % 5 * 0.55; p.gravity = 9;
      p.life = crash ? 0.65 : 0.48; p.size = crash ? 0.12 : 0.1; p.stretch = 1.8;
      p.color = crash ? 0xffae72 : clean ? 0xd6ff78 : 0xe8c79c;
    }
  }
  update(sim: Simulation, delta: number) {
    if (sim.phase === 'ready') { if (this.mesh.count) this.clear(); return; }
    if (sim.phase === 'paused') return;
    if (!this.limit) return;
    const dt = Math.max(0, Math.min(0.1, delta)); this.clock += dt;
    for (const p of this.particles) if (p.age < p.life) {
      p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.distance -= p.vz * dt; p.vy -= p.gravity * dt;
      if (p.y < 0.03) p.life = 0;
    }
    if (sim.phase === 'playing' && (sim.boostActive || sim.thrustActive)) {
      this.emission += dt * (this.limit === 24 ? 16 : this.limit === 48 ? 32 : 48);
      this.rotation.set(sim.pitch, 0, sim.roll);
      while (this.emission >= 1) {
        this.emission--;
        for (const side of [-1, 1]) {
          this.nozzle.set(side * 0.57, -0.16, 2.1).applyEuler(this.rotation);
          const p = this.next();
          p.x = sim.x + this.nozzle.x; p.y = sim.height + 0.78 + this.nozzle.y; p.distance = sim.distance - this.nozzle.z;
          p.life = 0.27; p.size = sim.boostActive ? 0.13 : 0.09; p.stretch = sim.boostActive ? 10 : 5;
          p.pitch = sim.pitch; p.roll = sim.roll; p.color = sim.boostActive ? 0xd6ff78 : 0x8feafb;
        }
      }
    } else this.emission = 0;
    let count = 0;
    for (const p of this.particles) if (p.age < p.life) {
      const fade = 1 - p.age / p.life;
      this.dummy.position.set(p.x, p.y, 3 + sim.distance - p.distance);
      this.dummy.rotation.set(p.pitch, 0, p.roll);
      this.dummy.scale.set(p.size * fade, p.size * fade, p.size * p.stretch * fade);
      this.dummy.updateMatrix(); this.mesh.setMatrixAt(count, this.dummy.matrix);
      this.mesh.setColorAt(count++, this.color.setHex(p.color));
    }
    this.mesh.count = count; this.mesh.visible = count > 0;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}
