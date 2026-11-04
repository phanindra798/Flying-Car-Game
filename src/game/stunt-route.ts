import { isCarId, type CarId } from './garage-cars';

export const ROUTE_ID = 'coast-rings-01';
export const ROUTE_LENGTH = 1200;
export const RAMP_LENGTH = 10;
export const RAMP_HEIGHT = 1.15;
export const RAMP_HALF_WIDTH = 1.55;
export const RING_RADIUS = 2.2;
// Aim the centre of the car through the inner target; rings are non-solid.
export const RING_TARGET_RADIUS = 1.3;
export const RING_POINTS = 150;
export const ROUTE_STATIONS = [1, 2, 0, 3, 1, 3, 2, 0].map((lane, index) => ({
  id: index, lane, ramp: 80 + index * 140, ring: 100 + index * 140,
  height: [3.8, 4.2, 3.8, 4.2, 5.4, 4.8, 5.4, 4.8][index],
}));
export type RingState = 'ahead' | 'pending' | 'banked' | 'missed' | 'lost';
export interface RoutePose { distance: number; x: number; height: number }
const laneX = (lane: number) => -5.25 + lane * 3.5;
export function crossingAt(before: RoutePose, after: RoutePose, distance: number): RoutePose | null {
  if (before.distance >= distance || after.distance < distance || after.distance <= before.distance) return null;
  const t = (distance - before.distance) / (after.distance - before.distance);
  return { distance, x: before.x + (after.x - before.x) * t, height: before.height + (after.height - before.height) * t };
}

/** Per-attempt state only. Fixed stations make retries learnable and allocation bounded. */
export class StuntRoute {
  readonly rings: RingState[] = ROUTE_STATIONS.map(() => 'ahead');
  readonly launched = new Set<number>();
  riding: number | null = null;
  get pending() { return this.rings.filter(state => state === 'pending').length; }
  get banked() { return this.rings.filter(state => state === 'banked').length; }
  get collected() { return this.rings.filter(state => state === 'banked' || state === 'pending' || state === 'lost').length; }
  get next() { return ROUTE_STATIONS.find(station => this.rings[station.id] === 'ahead') ?? null; }

  ride(before: RoutePose, after: RoutePose, grounded: boolean): { height: number; launch: boolean } | null {
    if (this.riding === null && grounded) {
      const station = ROUTE_STATIONS.find(s => {
        const point = crossingAt(before, after, s.ramp - RAMP_LENGTH);
        return point && Math.abs(point.x - laneX(s.lane)) <= RAMP_HALF_WIDTH - .82 && !this.launched.has(s.id);
      });
      if (station) this.riding = station.id;
    }
    if (this.riding === null) return null;
    const station = ROUTE_STATIONS[this.riding];
    // Driving off an edge resumes ordinary gravity; no invisible side capture.
    if (Math.abs(after.x - laneX(station.lane)) > RAMP_HALF_WIDTH - .82) { this.riding = null; return null; }
    if (after.distance >= station.ramp) {
      this.riding = null; this.launched.add(station.id);
      return { height: RAMP_HEIGHT, launch: true };
    }
    return { height: Math.max(0, (after.distance - station.ramp + RAMP_LENGTH) / RAMP_LENGTH) * RAMP_HEIGHT, launch: false };
  }
  cross(before: RoutePose, after: RoutePose): { id: number; hit: boolean }[] {
    const crossed: { id: number; hit: boolean }[] = [];
    for (const station of ROUTE_STATIONS) {
      if (this.rings[station.id] !== 'ahead') continue;
      const point = crossingAt(before, after, station.ring);
      if (!point) continue;
      const hit = point.height > .1 && Math.hypot(point.x - laneX(station.lane), point.height + .78 - station.height) <= RING_TARGET_RADIUS;
      this.rings[station.id] = hit ? 'pending' : 'missed'; crossed.push({ id: station.id, hit });
    }
    return crossed;
  }
  land(clean: boolean) {
    for (let i = 0; i < this.rings.length; i++) if (this.rings[i] === 'pending') this.rings[i] = clean ? 'banked' : 'lost';
  }
}

export function routeMedal(rings: number) { return rings >= 8 ? 'GOLD' : rings >= 6 ? 'SILVER' : rings >= 4 ? 'BRONZE' : 'FINISHER'; }
export const ROUTE_RECORD_KEY = 'boostline.stunt-route.v1';
export interface RouteRecord { score: number; rings: number; time: number }
export type RouteRecords = Partial<Record<CarId, RouteRecord>>;
export function parseRouteRecords(raw: string | null): RouteRecords {
  if (!raw || raw.length > 4096) return {};
  try {
    const data = JSON.parse(raw);
    if (data?.version !== 1 || data.course !== ROUTE_ID || !data.records || typeof data.records !== 'object') return {};
    const records: RouteRecords = {};
    for (const [id, value] of Object.entries(data.records)) {
      if (!isCarId(id) || !value || typeof value !== 'object') continue;
      const r = value as RouteRecord;
      if (Number.isInteger(r.score) && r.score >= 0 && r.score <= 1_000_000 && Number.isInteger(r.rings) && r.rings >= 0 && r.rings <= 8 && Number.isFinite(r.time) && r.time > 0 && r.time < 600) records[id] = { score: r.score, rings: r.rings, time: r.time };
    }
    return records;
  } catch { return {}; }
}
export function betterRoute(candidate: RouteRecord, previous?: RouteRecord) {
  return !previous || candidate.score > previous.score || (candidate.score === previous.score && candidate.time < previous.time);
}
