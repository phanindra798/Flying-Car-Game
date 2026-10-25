export type Vec3 = readonly [number, number, number];
export interface Rotation { pitch: number; roll: number }
export const CAR_HALF: Vec3 = [0.82, 0.58, 1.82];
const RADIUS = Math.hypot(...CAR_HALF);
const WORLD: readonly Vec3[] = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const mix = (a: Vec3, b: Vec3, t: number): Vec3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const angleDelta = (a: number, b: number) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

// Matches the renderer's XYZ Euler rotation with yaw excluded (cosmetic steering only).
function axes({ pitch, roll }: Rotation): Vec3[] {
  const cp = Math.cos(pitch), sp = Math.sin(pitch), cr = Math.cos(roll), sr = Math.sin(roll);
  return [[cr, cp * sr, sp * sr], [-sr, cp * cr, sp * cr], [0, -sp, cp]];
}
export function carBounds(rotation: Rotation): number[] {
  const basis = axes(rotation);
  return [0, 1, 2].map(i => basis.reduce((sum, axis, j) => sum + Math.abs(axis[i]) * CAR_HALF[j], 0));
}
export function segmentHitsBox(start: readonly number[], end: readonly number[], half: readonly number[]): boolean {
  let enter = 0, leave = 1;
  for (let i = 0; i < 3; i++) {
    const delta = end[i] - start[i];
    if (Math.abs(delta) < 1e-9) { if (Math.abs(start[i]) > half[i]) return false; continue; }
    const a = (-half[i] - start[i]) / delta, b = (half[i] - start[i]) / delta;
    enter = Math.max(enter, Math.min(a, b)); leave = Math.min(leave, Math.max(a, b));
    if (enter > leave) return false;
  }
  return true;
}

// Continuous translation on the 15 separating axes, at one orientation.
function translatedOverlap(start: Vec3, end: Vec3, rotation: Rotation, half: Vec3, padding: number) {
  const basis = axes(rotation), directions = [...WORLD, ...basis];
  for (const a of WORLD) for (const b of basis) directions.push(cross(a, b));
  let enter = 0, leave = 1;
  for (const direction of directions) {
    const length = Math.hypot(...direction);
    if (length < 1e-8) continue;
    const axis: Vec3 = [direction[0] / length, direction[1] / length, direction[2] / length];
    const radius = Math.abs(axis[0]) * half[0] + Math.abs(axis[1]) * half[1] + Math.abs(axis[2]) * half[2]
      + basis.reduce((sum, local, i) => sum + Math.abs(dot(axis, local)) * CAR_HALF[i], padding);
    const from = dot(start, axis), delta = dot(end, axis) - from;
    if (Math.abs(delta) < 1e-9) { if (Math.abs(from) > radius + 1e-9) return false; continue; }
    const a = (-radius - from) / delta, b = (radius - from) / delta;
    enter = Math.max(enter, Math.min(a, b)); leave = Math.min(leave, Math.max(a, b));
    if (enter > leave) return false;
  }
  return true;
}

/** Rotating box sweep. Fixed-step turns are sliced with <= 4.2 cm conservative angular padding. */
export function sweptCarHitsBox(start: Vec3, end: Vec3, before: Rotation, after: Rotation, trafficHalf: Vec3) {
  if (!segmentHitsBox(start, end, trafficHalf.map(n => n + RADIUS))) return false;
  const dp = angleDelta(before.pitch, after.pitch), dr = angleDelta(before.roll, after.roll);
  const turn = Math.abs(dp) + Math.abs(dr), slices = Math.max(1, Math.ceil(turn / 0.04));
  const padding = RADIUS * turn / (2 * slices);
  for (let i = 0; i < slices; i++) {
    const middle = (i + 0.5) / slices;
    const rotation = { pitch: before.pitch + dp * middle, roll: before.roll + dr * middle };
    if (translatedOverlap(mix(start, end, i / slices), mix(start, end, (i + 1) / slices), rotation, trafficHalf, padding)) return true;
  }
  return false;
}
