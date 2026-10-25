import { describe, expect, it } from 'vitest';
import { Simulation, FIXED_STEP } from './simulation';
import { GhostRecorder, GHOST_COURSE, MAX_GHOST_FRAMES, MAX_GHOST_SECONDS, parseGhost, ghostAt, ghostDistance, ghostDuration, betterGhost, type GhostRun } from './ghost';

function completedRun() {
  const sim = new Simulation(), recorder = new GhostRecorder(); sim.start(); recorder.start(sim);
  while (sim.phase === 'playing') { sim.step(FIXED_STEP); recorder.capture(sim); }
  return { sim, recorder, run: recorder.finish(sim)! };
}

describe('saved distance ghosts', () => {
  it('records an actual run through its crash and round-trips through storage validation', () => {
    const { sim, run } = completedRun();
    expect(parseGhost(JSON.stringify(run))).toEqual(run);
    expect(ghostDistance(run)).toBeCloseTo(sim.distance, 2);
    expect(ghostDuration(run)).toBeCloseTo(sim.elapsed, 2);
    expect(run.frames.length).toBeGreaterThan(40);
    expect(ghostAt(run, 0)).toEqual({ distance: 0, x: -1.75, height: 0, pitch: 0, roll: 0 });
  });
  it('interpolates movement and takes the short path when a completed rotation wraps to zero', () => {
    const run: GhostRun = { version: 1, course: GHOST_COURSE, frames: [[0, 0, -1.75, 2, -6.2, 6.2], [0.1, 3, 1.75, 4, 0, 0]] };
    const pose = ghostAt(run, 0.05)!;
    expect(pose.distance).toBe(1.5); expect(pose.x).toBe(0); expect(pose.height).toBe(3);
    expect(Math.cos(pose.pitch)).toBeGreaterThan(0.99); expect(Math.cos(pose.roll)).toBeGreaterThan(0.99);
    expect(ghostAt(run, -1)).toBeNull(); expect(ghostAt(run, 0.101)).toBeNull(); expect(ghostAt(run, NaN)).toBeNull();
    expect(ghostAt(run, 0.1)?.distance).toBe(3);
  });
  it('only replaces a ghost with a longer run and never changes a replay already being raced', () => {
    const { run } = completedRun(), original = JSON.stringify(run);
    const shorter: GhostRun = { ...run, frames: run.frames.slice(0, -5) };
    expect(betterGhost(run, shorter)).toBe(true); expect(betterGhost(shorter, run)).toBe(false);
    expect(betterGhost(run, run)).toBe(false); expect(betterGhost(null, run)).toBe(false); expect(betterGhost(run, null)).toBe(true);
    ghostAt(run, 3); expect(JSON.stringify(run)).toBe(original);
  });
  it('does not record practice, incomplete runs or paused wall-clock time', () => {
    const sim = new Simulation(), recorder = new GhostRecorder();
    sim.start('practice'); recorder.start(sim); sim.elapsed = 5; sim.phase = 'crashed';
    expect(recorder.finish(sim)).toBeNull();
    sim.start(); recorder.start(sim);
    for (let i = 0; i < 120; i++) { sim.step(FIXED_STEP); recorder.capture(sim); }
    expect(recorder.finish(sim)).toBeNull();
    const time = sim.elapsed; sim.pause();
    for (let i = 0; i < 300; i++) { sim.step(FIXED_STEP); recorder.capture(sim); }
    expect(sim.elapsed).toBe(time); sim.pause();
    for (let i = 0; i < 1200; i++) { sim.step(FIXED_STEP); recorder.capture(sim); }
    expect(recorder.finish(sim)).toEqual(completedRun().run);
  });
  it('resets the recorder on retry without retaining the abandoned path', () => {
    const { sim, recorder } = completedRun();
    sim.start(); recorder.start(sim); sim.changeLane(1);
    for (let i = 0; i < 120; i++) { sim.step(FIXED_STEP); recorder.capture(sim); }
    sim.phase = 'crashed'; const retry = recorder.finish(sim)!;
    expect(retry.frames[0]).toEqual([0, 0, -1.75, 0, 0, 0]);
    expect(ghostDuration(retry)).toBe(2); expect(ghostAt(retry, 2)?.x).toBeCloseTo(1.75);
  });
  it('rejects corrupt, incompatible, nonfinite, oversized and discontinuous stored data', () => {
    const { run } = completedRun();
    for (const raw of [null, '{broken', 'null', '[]', 'x'.repeat(700001), JSON.stringify({ ...run, version: 2 }), JSON.stringify({ ...run, course: 'old-road' })]) expect(parseGhost(raw)).toBeNull();
    for (const mutate of [
      (r: GhostRun) => { r.frames[0][0] = 1; },
      (r: GhostRun) => { r.frames[1][0] = 0; },
      (r: GhostRun) => { r.frames[1][1] = 500; },
      (r: GhostRun) => { r.frames[1][2] = 25; },
      (r: GhostRun) => { r.frames[1][3] = Infinity; },
      (r: GhostRun) => { r.frames.splice(1, 1); },
      (r: GhostRun) => { r.frames = r.frames.slice(0, 2); },
    ]) { const copy = structuredClone(run); mutate(copy); expect(parseGhost(JSON.stringify(copy))).toBeNull(); }
  });
  it('bounds memory and keeps an existing ghost when a run exceeds ten minutes', () => {
    const sim = new Simulation(), recorder = new GhostRecorder(); sim.start(); recorder.start(sim);
    // Synthetic clock advancement isolates recording capacity from traffic and rendering.
    for (let i = 1; i <= MAX_GHOST_SECONDS * 60; i++) {
      sim.elapsed = i / 60; sim.distance = sim.elapsed * 23; recorder.capture(sim);
    }
    sim.phase = 'crashed'; const atLimit = recorder.finish(sim)!;
    expect(atLimit.frames.length).toBeLessThanOrEqual(MAX_GHOST_FRAMES);
    expect(parseGhost(JSON.stringify(atLimit))).not.toBeNull();
    sim.elapsed += FIXED_STEP; recorder.capture(sim);
    expect(recorder.overflow).toBe(true); expect(recorder.finish(sim)).toBeNull();
    expect(betterGhost(recorder.finish(sim), atLimit)).toBe(false);
  });
});
