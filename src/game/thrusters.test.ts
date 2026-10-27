import { describe, expect, it } from 'vitest';
import { Box3, Matrix4, Mesh, MeshStandardMaterial, Scene, Vector3 } from 'three';
import { Simulation } from './simulation';
import { ThrusterRig, ThrusterState } from './thrusters';
import { GameEffects } from './effects';
import { createPlayerVehicle } from './player-vehicle';

describe('directional thrusters', () => {
  it('gives a quick jump a lift pulse, separates held flight and boost, and supports both', () => {
    const sim = new Simulation(), jets = new ThrusterState(); sim.start('practice');
    sim.jump(); sim.takeEvents().forEach(event => jets.onEvent(event)); jets.update(sim, 1 / 60);
    expect(jets.lift).toBe(true); expect(jets.boost).toBe(false);
    for (let i = 0; i < 20; i++) jets.update(sim, 1 / 60);
    expect(jets.lift).toBe(false);
    sim.boostActive = true; jets.update(sim, 1 / 60);
    expect(jets.boost).toBe(true); expect(jets.lift).toBe(false);
    sim.thrustActive = true; jets.update(sim, 1 / 60); expect(jets.lift).toBe(true);
    sim.boostActive = false; jets.update(sim, 1 / 60); expect(jets.boost).toBe(false); expect(jets.lift).toBe(true);
  });
  it('freezes a launch pulse on pause and removes all firing state on crash or reset', () => {
    const sim = new Simulation(), jets = new ThrusterState(); sim.start('practice'); sim.jump();
    sim.takeEvents().forEach(event => jets.onEvent(event)); jets.update(sim, 0.05);
    sim.pause(); const before = JSON.stringify(jets); jets.update(sim, 1); expect(JSON.stringify(jets)).toBe(before);
    sim.phase = 'crashed'; jets.update(sim, 0.05); expect(jets.lift).toBe(false); expect(jets.boost).toBe(false);
    sim.start('practice'); jets.update(sim, 0.01); expect(jets.lift).toBe(false);
  });
  it('anchors lift plumes below and boost plumes behind the body; reduced effects keeps steady cues', () => {
    const rig = new ThrusterRig(); rig.update({ lift: true, boost: false, clock: 1 }, 2, false);
    expect(rig.inspect().lift).toBe(4); expect(rig.inspect().boost).toBe(0);
    let bounds = new Box3().setFromObject(rig);
    expect(bounds.max.y).toBeCloseTo(-0.44); expect(bounds.min.y).toBeLessThan(-1);
    rig.update({ lift: false, boost: true, clock: 1 }, 0, true);
    expect(rig.inspect().lift).toBe(0); expect(rig.inspect().boost).toBe(2);
    // Refresh the instanced bounds after changing which nozzles are drawn.
    rig.children.forEach(mesh => (mesh as import('three').InstancedMesh).computeBoundingBox());
    bounds = new Box3().setFromObject(rig); expect(bounds.min.z).toBeCloseTo(2.04); expect(bounds.max.z).toBeGreaterThan(2.8);
    const calm = rig.inspect(); rig.update({ lift: false, boost: true, clock: 50 }, 0, true); expect(rig.inspect()).toEqual(calm);
  });
  it('rotates detached lift exhaust with a barrel roll and stays inside the pool with all jets active', () => {
    const sim = new Simulation(), effects = new GameEffects(new Scene()); sim.start('practice'); sim.height = 3; sim.roll = Math.PI / 2;
    const before = JSON.stringify(sim);
    effects.update(sim, 0.05, { lift: true, boost: false }); expect(effects.inspect().count).toBe(4);
    const matrix = new Matrix4(); effects.mesh.getMatrixAt(0, matrix);
    const direction = new Vector3().setFromMatrixColumn(matrix, 2).normalize();
    expect(direction.x).toBeCloseTo(1); expect(direction.y).toBeCloseTo(0); expect(direction.z).toBeCloseTo(0);
    for (const limit of [24, 48, 80]) {
      effects.configure(limit);
      for (let frame = 0; frame < 600; frame++) effects.update(sim, 1 / 60, { lift: true, boost: true });
      expect(effects.inspect().count).toBeGreaterThan(0); expect(effects.inspect().count).toBeLessThanOrEqual(limit);
    }
    expect(JSON.stringify(sim)).toBe(before);
  });
});

describe('pickup integration', () => {
  it('keeps the original vehicle envelope, a bounded material count and live garage paint', () => {
    const paint = new MeshStandardMaterial({ color: 0xe5e5d9 }), model = createPlayerVehicle(paint);
    const size = new Box3().setFromObject(model).getSize(new Vector3());
    expect(size.x).toBeLessThanOrEqual(2); expect(size.y).toBeLessThanOrEqual(1.5); expect(size.z).toBeLessThanOrEqual(4.21);
    expect(model.children.length).toBeLessThanOrEqual(6);
    paint.color.setHex(0xf28758);
    expect(model.children.some(part => part instanceof Mesh && part.material === paint)).toBe(true);
    model.traverse(part => { if (part instanceof Mesh) expect(Array.from(part.geometry.attributes.position.array).every(Number.isFinite)).toBe(true); });
  });
});
