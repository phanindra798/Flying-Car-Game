import { describe, expect, it } from 'vitest';
import { Simulation, FIXED_STEP, NO_INPUT, type HeldInput } from './simulation';
import { SwipeSteering } from './swipe';
import { DrivingSchool } from './training';
import { flightAssist } from './flight-assist';

const fly = { thrust: true, boost: false, slam: false };
function advance(sim: Simulation, seconds: number, input: HeldInput = NO_INPUT, school?: DrivingSchool) {
  for (let i = 0; i < Math.ceil(seconds / FIXED_STEP); i++) { sim.step(FIXED_STEP, input); school?.update(sim, FIXED_STEP); }
}
function schoolStart() {
  const sim = new Simulation(); sim.start('practice');
  const school = new DrivingSchool(); school.begin(sim);
  for (const direction of [-1, 1] as const) { sim.changeLane(direction); advance(sim, FIXED_STEP, NO_INPUT, school); }
  return { sim, school };
}
function reachLanding() {
  const { sim, school } = schoolStart();
  sim.jump(); advance(sim, 0.65, fly, school);
  expect(school.lesson).toBe('stunt');
  sim.trick('flip'); advance(sim, 0.75, fly, school);
  expect(school.lesson).toBe('land');
  return { sim, school };
}

describe('swipe intent', () => {
  it('changes just one lane per deliberate gesture and accepts a fresh gesture', () => {
    const swipe = new SwipeSteering(); swipe.begin(1, 100, 200, 0);
    expect(swipe.move(1, 145, 205, 150)).toBe(1);
    expect(swipe.move(1, 250, 205, 250)).toBeNull();
    swipe.end(1); swipe.begin(2, 200, 200, 300);
    expect(swipe.move(2, 140, 198, 450)).toBe(-1);
  });
  it('rejects tap noise, vertical movement and a long resting finger', () => {
    const swipe = new SwipeSteering(); swipe.begin(1, 100, 200, 0);
    expect(swipe.move(1, 110, 202, 100)).toBeNull();
    expect(swipe.move(1, 103, 240, 150)).toBeNull();
    expect(swipe.move(1, 180, 240, 200)).toBeNull();
    swipe.reset(); swipe.begin(2, 100, 200, 0);
    expect(swipe.move(2, 160, 200, 900)).toBeNull();
  });
  it('ignores a second finger and clears a cancelled gesture', () => {
    const swipe = new SwipeSteering(); swipe.begin(1, 100, 200, 0);
    expect(swipe.begin(2, 200, 200, 10)).toBe(false);
    expect(swipe.move(2, 260, 200, 150)).toBeNull();
    swipe.end(2); expect(swipe.move(1, 150, 200, 200)).toBe(1);
    swipe.reset(); expect(swipe.move(1, 250, 200, 300)).toBeNull();
  });
});

describe('driving school through real gameplay', () => {
  it('requires a held flight, completed stunt, clean landing and boost before completion', () => {
    const { sim, school } = reachLanding();
    expect(school.completed).toBe(false); expect(sim.banked).toBe(0);
    advance(sim, 2, NO_INPUT, school);
    expect(school.lesson).toBe('boost'); expect(sim.tricksLanded).toBe(1); expect(sim.banked).toBe(170);
    advance(sim, 0.3, { ...NO_INPUT, boost: true }, school); expect(school.completed).toBe(false);
    advance(sim, 0.35, { ...NO_INPUT, boost: true }, school); expect(school.completed).toBe(true);
  });
  it('freezes while paused and resets the whole lesson on restart', () => {
    const { sim, school } = schoolStart(); sim.pause(); const distance = sim.distance;
    advance(sim, 4, fly, school); expect(sim.distance).toBe(distance); expect(school.lesson).toBe('fly');
    sim.start('practice'); school.begin(sim);
    expect(school.lesson).toBe('steer'); expect(school.progress).toBe(0); expect(school.completed).toBe(false);
    school.end(); advance(sim, 4, fly, school); expect(school.active).toBe(false);
  });
  it('retries flight after a rough landing instead of granting tutorial success', () => {
    const { sim, school } = reachLanding();
    advance(sim, 1, { ...NO_INPUT, slam: true }, school);
    expect(sim.tricksLanded).toBe(0); expect(school.completed).toBe(false);
    expect(school.lesson).toBe('fly'); expect(school.retry).toBe(true);
  });
});

describe('honest landing guidance', () => {
  it('warns about a late rotation and a hard slam, and shows only unbanked points', () => {
    const sim = new Simulation(); sim.start('practice'); sim.jump(); advance(sim, 0.65); sim.trick('flip');
    expect(flightAssist(sim, false).label).toBe('MORE AIRTIME');
    sim.start('practice'); sim.jump(); sim.trick('flip'); advance(sim, 1.6, fly);
    expect(flightAssist(sim, true).tone).toBe('warning');
    expect(flightAssist(sim, false).label).toBe('170 TO BANK'); expect(sim.banked).toBe(0);
    advance(sim, 2); expect(sim.pendingLandingPoints).toBe(0); expect(sim.banked).toBe(170);
  });
  it('does not bank earlier tricks if practice lands during an unfinished second rotation', () => {
    const sim = new Simulation(); sim.start('practice'); sim.jump(); sim.trick('flip'); advance(sim, 0.75);
    expect(sim.pendingTricks).toBe(1); sim.trick('roll-right'); advance(sim, 0.4);
    expect(sim.phase).toBe('playing'); expect(sim.banked).toBe(0); expect(sim.tricksLanded).toBe(0);
    expect(sim.takeEvents().some(event => event.landing?.quality === 'unfinished')).toBe(true);
  });
});
