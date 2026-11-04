import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { LANES, type Simulation } from './simulation';
import { RAMP_HEIGHT, RAMP_LENGTH, RAMP_HALF_WIDTH, RING_RADIUS } from './stunt-route';

/** Fixed course geometry shared by eight stations; no per-frame mesh allocation. */
export class StuntScenery extends THREE.Group {
  private readonly ramps: THREE.InstancedMesh;
  private readonly markings: THREE.InstancedMesh;
  private readonly rings: THREE.InstancedMesh;
  private readonly targets: THREE.InstancedMesh;
  private readonly finish = new THREE.Group();
  private readonly dummy = new THREE.Object3D();
  private readonly color = new THREE.Color();
  private visibleRings = 0;
  constructor() {
    super();
    const wedge = new THREE.BoxGeometry(RAMP_HALF_WIDTH * 2, 1, RAMP_LENGTH);
    const positions = wedge.attributes.position;
    for (let i = 0; i < positions.count; i++) positions.setY(i, positions.getY(i) > 0 ? (RAMP_LENGTH / 2 - positions.getZ(i)) / RAMP_LENGTH * RAMP_HEIGHT : .015);
    wedge.computeVertexNormals();
    this.ramps = new THREE.InstancedMesh(wedge, new THREE.MeshStandardMaterial({ color: 0x234b53, metalness: .4, roughness: .55 }), 8);
    const strips: THREE.BufferGeometry[] = [];
    for (const side of [-1, 1]) strips.push(new THREE.BoxGeometry(.075, .035, Math.hypot(RAMP_LENGTH, RAMP_HEIGHT)).rotateX(Math.atan2(RAMP_HEIGHT, RAMP_LENGTH)).translate(side * 1.48, RAMP_HEIGHT / 2 + .025, 0));
    for (const z of [-2, 0, 2]) for (const side of [-1, 1]) {
      const stripe = new THREE.BoxGeometry(.08, .035, 1.05).rotateY(side * .75).translate(side * .35, 0, z);
      const p = stripe.attributes.position;
      for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) + (5 - p.getZ(i)) / 10 * RAMP_HEIGHT + .04);
      stripe.computeVertexNormals(); strips.push(stripe);
    }
    this.markings = new THREE.InstancedMesh(mergeGeometries(strips)!, new THREE.MeshBasicMaterial({ color: 0xd6ff78 }), 8);
    strips.forEach(geometry => geometry.dispose());
    this.rings = new THREE.InstancedMesh(new THREE.TorusGeometry(RING_RADIUS, .12, 8, 40), new THREE.MeshBasicMaterial({ color: 0xffffff }), 8);
    const target = new THREE.RingGeometry(.24, .27, 4);
    this.targets = new THREE.InstancedMesh(target, new THREE.MeshBasicMaterial({ color: 0xe9fff8, transparent: true, opacity: .65, side: THREE.DoubleSide, depthWrite: false }), 8);
    for (const mesh of [this.ramps, this.markings, this.rings, this.targets]) {
      mesh.frustumCulled = false; mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.add(mesh);
    }
    const postMaterial = new THREE.MeshStandardMaterial({ color: 0x254d54 });
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(.32, 10, .35), postMaterial); post.position.set(side * 7.5, 5, 0); this.finish.add(post);
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(15.4, .8, .4), postMaterial); beam.position.y = 9.6; this.finish.add(beam);
    const checks = new THREE.InstancedMesh(new THREE.BoxGeometry(.5, .35, .05), new THREE.MeshBasicMaterial({ color: 0xd6ff78 }), 30);
    for (let i = 0; i < 30; i++) {
      this.dummy.position.set(-7.25 + i * .5, 9.6 + (i % 2 ? -.18 : .18), .23); this.dummy.updateMatrix(); checks.setMatrixAt(i, this.dummy.matrix);
    }
    this.finish.add(checks); this.add(this.finish); this.visible = false;
  }
  update(sim: Simulation) {
    this.visible = sim.mode === 'stunt' && sim.phase !== 'ready';
    if (!this.visible || !sim.route) { this.visibleRings = 0; return; }
    let ramps = 0, rings = 0;
    for (const station of sim.route.definition.stations) {
      const rampGap = station.ramp - sim.distance, ringGap = station.ring - sim.distance;
      if (rampGap > -20 && rampGap < 280) {
        this.dummy.position.set(LANES[station.lane], 0, 3 - rampGap + RAMP_LENGTH / 2); this.dummy.updateMatrix();
        this.ramps.setMatrixAt(ramps, this.dummy.matrix); this.markings.setMatrixAt(ramps++, this.dummy.matrix);
      }
      if (ringGap > -12 && ringGap < 280) {
        this.dummy.position.set(LANES[station.lane], station.height, 3 - ringGap); this.dummy.updateMatrix();
        this.rings.setMatrixAt(rings, this.dummy.matrix); this.targets.setMatrixAt(rings, this.dummy.matrix);
        const state = sim.route.rings[station.id];
        this.rings.setColorAt(rings++, this.color.setHex(state === 'ahead' ? 0x62e7ff : state === 'pending' || state === 'banked' ? 0xd6ff78 : 0xff9b75));
      }
    }
    this.ramps.count = this.markings.count = ramps; this.rings.count = this.targets.count = rings; this.visibleRings = rings;
    for (const mesh of [this.ramps, this.markings, this.rings, this.targets]) mesh.instanceMatrix.needsUpdate = true;
    if (this.rings.instanceColor) this.rings.instanceColor.needsUpdate = true;
    this.finish.visible = sim.route.definition.length - sim.distance < 280; this.finish.position.z = 3 + sim.distance - sim.route.definition.length;
  }
  inspect() { return { visible: this.visible, ramps: this.visible ? this.ramps.count : 0, rings: this.visibleRings }; }
}
