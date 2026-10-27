import * as THREE from 'three';
import { LANES, type GameEvent, type Simulation } from './simulation';

export type JetMode = 'lift' | 'boost';
export interface JetState { lift: boolean; boost: boolean; clock: number }
export interface Nozzle { mode: JetMode; position: readonly [number, number, number]; direction: readonly [number, number, number] }
export const NOZZLES: readonly Nozzle[] = [
  ...[-1, 1].flatMap(side => [-1, 1].map(axle => ({ mode: 'lift' as const, position: [side * 0.62, -0.44, axle * 1.05] as const, direction: [0, -1, 0] as const }))),
  ...[-1, 1].map(side => ({ mode: 'boost' as const, position: [side * 0.57, -0.16, 2.04] as const, direction: [0, 0, 1] as const })),
];
export const JET_COLORS = { lift: 0x65dcff, boost: 0xd6ff78 };
export const DOWN = new THREE.Vector3(0, -1, 0);
/** Shared by the vehicle and detached exhaust so steering, flips and rolls stay aligned. */
export function vehicleRotation(sim: Simulation, target: THREE.Euler) {
  return target.set(sim.pitch, -(LANES[sim.lane] - sim.x) * 0.075, sim.roll);
}

/** Visual-only launch pulse: even a short jump tap fires the underbody jets. */
export class ThrusterState implements JetState {
  lift = false;
  boost = false;
  clock = 0;
  private launchRemaining = 0;
  onEvent(event: GameEvent) { if (event.kind === 'jump') this.launchRemaining = 0.22; }
  clear() { this.lift = false; this.boost = false; this.clock = 0; this.launchRemaining = 0; }
  update(sim: Simulation, delta: number) {
    if (sim.phase === 'paused') return;
    if (sim.phase !== 'playing') { this.clear(); return; }
    const dt = Math.max(0, Math.min(0.1, delta));
    this.clock += dt;
    this.lift = sim.thrustActive || this.launchRemaining > 0;
    this.boost = sim.boostActive;
    this.launchRemaining = Math.max(0, this.launchRemaining - dt);
  }
}

/** Six anchored plumes in two instanced draw calls, including bright inner cores. */
export class ThrusterRig extends THREE.Group {
  private readonly outer: THREE.InstancedMesh;
  private readonly core: THREE.InstancedMesh;
  private readonly dummy = new THREE.Object3D();
  private readonly direction = new THREE.Vector3();
  private readonly color = new THREE.Color();
  private liftCount = 0;
  private boostCount = 0;
  private liftLength = 0;
  private boostLength = 0;
  constructor() {
    super();
    const geometry = new THREE.ConeGeometry(0.19, 1, 8).rotateX(Math.PI).translate(0, -0.5, 0);
    const material = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
    this.outer = new THREE.InstancedMesh(geometry, material, NOZZLES.length);
    this.core = new THREE.InstancedMesh(geometry, new THREE.MeshBasicMaterial({ color: 0xf1fdff, transparent: true, opacity: 0.9, depthWrite: false, toneMapped: false }), NOZZLES.length);
    for (const mesh of [this.outer, this.core]) {
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.frustumCulled = false; mesh.count = 0;
    }
    this.add(this.outer, this.core);
  }
  update(state: JetState, height: number, reduced: boolean) {
    let count = 0; this.liftCount = 0; this.boostCount = 0;
    const flicker = reduced ? 1 : 1 + Math.sin(state.clock * 41) * 0.08;
    this.liftLength = Math.min(1.2, Math.max(0.25, height + 0.28)) * flicker;
    this.boostLength = (reduced ? 0.85 : 1.7) * flicker;
    for (const nozzle of NOZZLES) {
      if (!state[nozzle.mode]) continue;
      if (nozzle.mode === 'lift') this.liftCount++; else this.boostCount++;
      this.dummy.position.fromArray(nozzle.position);
      this.dummy.quaternion.setFromUnitVectors(DOWN, this.direction.fromArray(nozzle.direction));
      const length = nozzle.mode === 'lift' ? this.liftLength : this.boostLength;
      this.dummy.scale.set(1, length, 1); this.dummy.updateMatrix();
      this.outer.setMatrixAt(count, this.dummy.matrix);
      this.outer.setColorAt(count, this.color.setHex(JET_COLORS[nozzle.mode]));
      this.dummy.scale.set(0.44, length * 0.68, 0.44); this.dummy.updateMatrix();
      this.core.setMatrixAt(count++, this.dummy.matrix);
    }
    for (const mesh of [this.outer, this.core]) { mesh.count = count; mesh.visible = count > 0; mesh.instanceMatrix.needsUpdate = true; }
    if (this.outer.instanceColor) this.outer.instanceColor.needsUpdate = true;
  }
  inspect() { return { lift: this.liftCount, boost: this.boostCount, liftLength: this.liftLength, boostLength: this.boostLength }; }
}
