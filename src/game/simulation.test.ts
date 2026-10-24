import { describe, expect, it } from 'vitest';
import { FIXED_STEP, LANES, NO_INPUT, Simulation, segmentHitsBox, type HeldInput } from './simulation';

function advance(sim: Simulation, seconds: number, input: HeldInput = NO_INPUT) {
  for (let tick = 0; tick < Math.round(seconds / FIXED_STEP); tick++) sim.step(FIXED_STEP, input);
}

describe('movement and run lifecycle', () => {
  it('bounds lane requests and freezes all gameplay while paused', () => {
    const sim = new Simulation(); sim.start('practice');
    for (let n = 0; n < 10; n++) sim.changeLane(-1);
    advance(sim, 1);
    expect(sim.lane).toBe(0); expect(sim.x).toBeCloseTo(LANES[0], 3);
    sim.pause(); const distance = sim.distance;
    advance(sim, 3, { thrust: true, boost: true, slam: false });
    expect(sim.distance).toBe(distance); expect(sim.energy).toBe(100);
  });

  it('prevents midair jump spam and eventually lands after energy is exhausted', () => {
    const sim = new Simulation(); sim.start('practice');
    expect(sim.jump()).toBe(true);
    const initialVelocity = sim.verticalSpeed;
    expect(sim.jump()).toBe(false); expect(sim.verticalSpeed).toBe(initialVelocity);
    advance(sim, 5, { thrust: true, boost: true, slam: false });
    expect(sim.energy).toBeGreaterThanOrEqual(0);
    expect(sim.height).toBe(0); expect(sim.airborne).toBe(false);
    advance(sim, 8);
    expect(sim.energy).toBe(100);
  });

  it('resets an entire run, including inputs-independent state and pending tricks', () => {
    const sim = new Simulation(); sim.start('practice'); sim.jump(); sim.trick('flip');
    advance(sim, 0.8, { thrust: true, boost: true, slam: false });
    sim.start();
    expect(sim.distance).toBe(0); expect(sim.energy).toBe(100);
    expect(sim.pendingTricks).toBe(0); expect(sim.pitch).toBe(0);
    expect(sim.phase).toBe('playing'); expect(sim.traffic.length).toBe(4);
  });
});

describe('stunts and scoring', () => {
  it('banks a completed stunt exactly once, on landing', () => {
    const sim = new Simulation(); sim.start('practice'); sim.jump(); sim.trick('flip');
    advance(sim, 0.75);
    expect(sim.pendingTricks).toBe(1); expect(sim.banked).toBe(0);
    advance(sim, 0.35);
    expect(sim.tricksLanded).toBe(1); expect(sim.banked).toBe(170);
    expect(sim.combo).toBe(2);
    advance(sim, 4);
    expect(sim.banked).toBe(170); expect(sim.tricksLanded).toBe(1);
  });

  it('crashes an unfinished rotation in a scored run without banking it', () => {
    const sim = new Simulation(); sim.start(); sim.traffic = [];
    sim.jump(); advance(sim, 0.6); sim.trick('roll-right'); advance(sim, 0.5);
    expect(sim.phase).toBe('crashed'); expect(sim.banked).toBe(0);
    expect(sim.pendingTricks).toBe(0);
  });

  it('accepts a natural descent from the flight ceiling after a completed trick', () => {
    const sim = new Simulation(); sim.start('practice'); sim.jump(); sim.trick('flip');
    advance(sim, 1.6, { thrust: true, boost: false, slam: false });
    expect(sim.height).toBe(9);
    advance(sim, 2);
    expect(sim.height).toBe(0); expect(sim.tricksLanded).toBe(1);
    expect(sim.banked).toBe(170);
  });

  it('breaks the combo on a hard slam without banking a pending trick', () => {
    const sim = new Simulation(); sim.start('practice'); sim.jump(); sim.trick('flip');
    advance(sim, 1.6, { thrust: true, boost: false, slam: false });
    advance(sim, 1, { thrust: false, boost: false, slam: true });
    expect(sim.height).toBe(0); expect(sim.tricksLanded).toBe(0);
    expect(sim.banked).toBe(0); expect(sim.combo).toBe(1);
  });
});

describe('traffic and swept collision', () => {
  it('detects crossing a box between samples and rejects a clear path', () => {
    expect(segmentHitsBox([0, 0, -12], [0, 0, 12], [1, 1, 2])).toBe(true);
    expect(segmentHitsBox([4, 0, -12], [4, 0, 12], [1, 1, 2])).toBe(false);
    expect(segmentHitsBox([0, 5, -12], [0, 5, 12], [1, 1, 2])).toBe(false);
  });

  it('ends a run on contact and emits only one crash event', () => {
    const sim = new Simulation(); sim.start();
    sim.traffic = [{ id: 999, lane: 1, distance: 3, speed: 0, kind: 'car', color: 0, nearMissChecked: false }];
    advance(sim, 0.3);
    expect(sim.phase).toBe('crashed');
    expect(sim.takeEvents().filter(e => e.kind === 'crash')).toHaveLength(1);
    advance(sim, 1);
    expect(sim.takeEvents()).toHaveLength(0);
  });

  it('reproduces traffic for the same seed and gives practice an empty road', () => {
    const a = new Simulation(), b = new Simulation(); a.start('run', 123); b.start('run', 123);
    advance(a, 2); advance(b, 2); expect(a.traffic).toEqual(b.traffic);
    b.start('practice'); advance(b, 30); expect(b.traffic).toHaveLength(0);
  });
});
