import type { Simulation } from './simulation';

// Change the course key whenever traffic, movement or road rules invalidate old runs.
export const GHOST_KEY = 'boostline.ghost.v1';
export const GHOST_COURSE = 'pacific-01-rules-0.3';
export const MAX_GHOST_SECONDS = 600;
export const MAX_GHOST_FRAMES = 6002;
const MAX_BYTES = 700_000;
// Time, distance, lane position, altitude, pitch, roll; sampled at 10 Hz.
export type GhostFrame = [number, number, number, number, number, number];
export interface GhostRun { version: 1; course: string; frames: GhostFrame[] }
export interface GhostPose { distance: number; x: number; height: number; pitch: number; roll: number }
const rounded = (n: number) => Math.round(n * 1000) / 1000;
export const ghostDistance = (run: GhostRun) => run.frames[run.frames.length - 1][1];
export const ghostDuration = (run: GhostRun) => run.frames[run.frames.length - 1][0];

export function parseGhost(raw: string | null): GhostRun | null {
  if (!raw || raw.length > MAX_BYTES) return null;
  try {
    const run = JSON.parse(raw);
    if (run?.version !== 1 || run.course !== GHOST_COURSE || !Array.isArray(run.frames)
      || run.frames.length < 2 || run.frames.length > MAX_GHOST_FRAMES) return null;
    let previous: GhostFrame | undefined;
    for (const frame of run.frames) {
      if (!Array.isArray(frame) || frame.length !== 6 || !frame.every((n: unknown) => typeof n === 'number' && Number.isFinite(n))) return null;
      const [t, distance, x, height, pitch, roll] = frame;
      if (t < 0 || t > MAX_GHOST_SECONDS || distance < 0 || distance > MAX_GHOST_SECONDS * 50
        || Math.abs(x) > 5.251 || height < 0 || height > 9.001 || Math.abs(pitch) > 6.284 || Math.abs(roll) > 6.284) return null;
      if (!previous) {
        if (t !== 0 || distance !== 0 || x !== -1.75 || height !== 0 || pitch !== 0 || roll !== 0) return null;
      } else {
        const dt = t - previous[0];
        if (dt <= 0 || dt > 0.102 || distance < previous[1] || distance - previous[1] > dt * 51 + 0.02) return null;
      }
      previous = frame as GhostFrame;
    }
    if (previous![0] < 1) return null;
    return { version: 1, course: GHOST_COURSE, frames: run.frames };
  } catch { return null; }
}

export class GhostRecorder {
  private frames: GhostFrame[] = [];
  private enabled = false;
  overflow = false;
  start(sim: Simulation) {
    this.frames = []; this.overflow = false; this.enabled = sim.mode === 'run';
    this.capture(sim, true);
  }
  capture(sim: Simulation, force = false) {
    if (!this.enabled || this.overflow || sim.mode !== 'run' || (sim.phase !== 'playing' && sim.phase !== 'crashed')) return;
    if (sim.elapsed > MAX_GHOST_SECONDS + 1e-6 || this.frames.length >= MAX_GHOST_FRAMES) {
      this.overflow = true; this.frames = []; return;
    }
    const previous = this.frames[this.frames.length - 1];
    if (previous && (sim.elapsed <= previous[0] + 0.0005 || (!force && sim.elapsed - previous[0] < 0.099))) return;
    this.frames.push([sim.elapsed, sim.distance, sim.x, Math.max(0, sim.height), sim.pitch, sim.roll].map(rounded) as GhostFrame);
  }
  finish(sim: Simulation): GhostRun | null {
    if (!this.enabled || this.overflow || sim.mode !== 'run' || sim.phase !== 'crashed' || sim.elapsed < 1) return null;
    this.capture(sim, true);
    return this.overflow ? null : { version: 1, course: GHOST_COURSE, frames: this.frames.slice() };
  }
}

export function betterGhost(candidate: GhostRun | null, saved: GhostRun | null): candidate is GhostRun {
  return candidate !== null && (!saved || ghostDistance(candidate) > ghostDistance(saved));
}

export function ghostAt(run: GhostRun | null, time: number): GhostPose | null {
  if (!run || !Number.isFinite(time) || time < 0 || time > ghostDuration(run)) return null;
  const frames = run.frames;
  let lo = 0, hi = frames.length - 1;
  while (lo + 1 < hi) { const mid = (lo + hi) >>> 1; if (frames[mid][0] <= time) lo = mid; else hi = mid; }
  const a = frames[lo], b = frames[hi], t = Math.max(0, Math.min(1, (time - a[0]) / (b[0] - a[0])));
  const mix = (i: number) => a[i] + (b[i] - a[i]) * t;
  const angle = (i: number) => a[i] + Math.atan2(Math.sin(b[i] - a[i]), Math.cos(b[i] - a[i])) * t;
  return { distance: mix(1), x: mix(2), height: mix(3), pitch: angle(4), roll: angle(5) };
}
