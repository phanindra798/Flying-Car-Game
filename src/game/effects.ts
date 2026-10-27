import * as THREE from 'three';
import type { GameEvent, Simulation } from './simulation';
import { JET_COLORS, NOZZLES, vehicleRotation, type JetState } from './thrusters';

const CAPACITY = 80;
interface Particle { age: number; life: number; x: number; y: number; distance: number; vx: number; vy: number; vz: number; size: number; stretch: number; qx: number; qy: number; qz: number; qw: number; gravity: number; color: number }
/** A fixed pool and one instanced draw call. Visual state never changes the simulation. */
export class GameEffects {
  readonly mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, depthWrite: false }), CAPACITY);
  private readonly particles: Particle[] = Array.from({ length: CAPACITY }, () => ({ age: 0, life: 0, x: 0, y: 0, distance: 0, vx: 0, vy: 0, vz: 0, size: 0, stretch: 1, qx: 0, qy: 0, qz: 0, qw: 1, gravity: 0, color: 0xffffff }));
  private readonly dummy = new THREE.Object3D();
  private readonly nozzle = new THREE.Vector3();
  private readonly rotation = new THREE.Euler();
  private readonly direction = new THREE.Vector3();
  private readonly orientation = new THREE.Quaternion();
  private readonly forward = new THREE.Vector3(0, 0, 1);
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
    p.age = 0; p.vx = 0; p.vy = 0; p.vz = 0; p.gravity = 0; p.qx = 0; p.qy = 0; p.qz = 0; p.qw = 1;
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
  update(sim: Simulation, delta: number, jets: Pick<JetState, 'lift' | 'boost'> = { lift: sim.thrustActive, boost: sim.boostActive }) {
    if (sim.phase === 'ready') { if (this.mesh.count) this.clear(); return; }
    if (sim.phase === 'paused') return;
    if (!this.limit) return;
    const dt = Math.max(0, Math.min(0.1, delta)); this.clock += dt;
    for (const p of this.particles) if (p.age < p.life) {
      p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.distance -= p.vz * dt; p.vy -= p.gravity * dt;
      if (p.y < 0.03) p.life = 0;
    }
    if (sim.phase === 'playing' && (jets.boost || jets.lift)) {
      // Bound emission even with all six nozzles active; every quality shares the same direction.
      this.emission += dt * (this.limit === 24 ? 12 : this.limit === 48 ? 20 : 30);
      vehicleRotation(sim, this.rotation);
      while (this.emission >= 1) {
        this.emission--;
        for (const nozzle of NOZZLES) {
          if (!jets[nozzle.mode]) continue;
          this.nozzle.fromArray(nozzle.position).applyEuler(this.rotation);
          this.direction.fromArray(nozzle.direction).applyEuler(this.rotation);
          this.orientation.setFromUnitVectors(this.forward, this.direction);
          const p = this.next(), boost = nozzle.mode === 'boost';
          p.x = sim.x + this.nozzle.x; p.y = sim.height + 0.78 + this.nozzle.y; p.distance = sim.distance - this.nozzle.z;
          const exhaustSpeed = boost ? 8 : 4;
          p.vx = this.direction.x * exhaustSpeed; p.vy = this.direction.y * exhaustSpeed;
          // Lift exhaust inherits some road speed; boost leaves a longer rearward wake.
          p.vz = this.direction.z * exhaustSpeed - (boost ? 0 : sim.speed * 0.8);
          p.life = boost ? 0.27 : 0.23; p.size = boost ? 0.12 : 0.075; p.stretch = boost ? 8 : 5;
          p.qx = this.orientation.x; p.qy = this.orientation.y; p.qz = this.orientation.z; p.qw = this.orientation.w;
          p.color = JET_COLORS[nozzle.mode];
        }
      }
    } else this.emission = 0;
    let count = 0;
    for (const p of this.particles) if (p.age < p.life) {
      const fade = 1 - p.age / p.life;
      this.dummy.position.set(p.x, p.y, 3 + sim.distance - p.distance);
      this.dummy.quaternion.set(p.qx, p.qy, p.qz, p.qw);
      this.dummy.scale.set(p.size * fade, p.size * fade, p.size * p.stretch * fade);
      this.dummy.updateMatrix(); this.mesh.setMatrixAt(count, this.dummy.matrix);
      this.mesh.setColorAt(count++, this.color.setHex(p.color));
    }
    this.mesh.count = count; this.mesh.visible = count > 0;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}
