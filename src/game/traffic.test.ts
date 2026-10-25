import { describe, expect, it } from 'vitest';
import { Box3, Euler, Matrix3, Matrix4, Vector3 } from 'three';
import { OBB } from 'three/addons/math/OBB.js';
import { CAR_HALF, carBounds, segmentHitsBox, sweptCarHitsBox, type Vec3 } from './collision';
import { Simulation, FIXED_STEP, NO_INPUT, type Traffic } from './simulation';
import { TrafficDirector, TRAFFIC_SPEED, MIN_ROW_SPACING } from './traffic';
import { trafficThreat } from './traffic-warning';
const upright = { pitch: 0, roll: 0 };
const car: Vec3 = [0.9, 0.75, 2.05];

describe('rotation-aware collision', () => {
  it('allows a close pass through space that the old enclosing rectangle called a collision', () => {
    const rotation = { pitch: 0, roll: Math.PI / 4 }, position: Vec3 = [1.75, 1.6, 0];
    expect(segmentHitsBox(position, position, carBounds(rotation).map((n, i) => n + car[i]))).toBe(true);
    expect(sweptCarHitsBox(position, position, rotation, rotation, car)).toBe(false);
    expect(sweptCarHitsBox([1.5, 0.7, 0], [1.5, 0.7, 0], rotation, rotation, car)).toBe(true);
  });
  it('detects high-speed crossings and preserves clear overhead/sideways paths', () => {
    expect(sweptCarHitsBox([0, 0, -30], [0, 0, 30], upright, upright, car)).toBe(true);
    expect(sweptCarHitsBox([4, 0, -30], [4, 0, 30], upright, upright, car)).toBe(false);
    expect(sweptCarHitsBox([0, 3, -30], [0, 3, 30], upright, upright, [1.25, 1.9, 4])).toBe(false);
    const vertical = { pitch: Math.PI / 2, roll: 0 };
    expect(sweptCarHitsBox([0, 3, -30], [0, 3, 30], vertical, vertical, [1.25, 1.9, 4])).toBe(true);
  });
  it('detects a corner sweeping into traffic between endpoints and handles a full-turn wrap', () => {
    const position: Vec3 = [1.03, 0, 0], small: Vec3 = [0.04, 0.04, 0.04];
    const left = { pitch: 0, roll: -1 }, right = { pitch: 0, roll: 1 };
    expect(sweptCarHitsBox(position, position, left, left, small)).toBe(false);
    expect(sweptCarHitsBox(position, position, right, right, small)).toBe(false);
    expect(sweptCarHitsBox(position, position, left, right, small)).toBe(true);
    expect(sweptCarHitsBox(position, position, { pitch: 0, roll: 2 * Math.PI - 0.01 }, { pitch: 0, roll: 0.01 }, small)).toBe(false);
  });
  it('does not bank a landing when the same frame hits traffic', () => {
    const sim = new Simulation(); sim.start();
    sim.height = 0.01; sim.verticalSpeed = -1; sim.pendingTricks = 1;
    sim.traffic = [{ id: 123, lane: 1, distance: 3.95, speed: TRAFFIC_SPEED, kind: 'car', color: 0, nearMissChecked: false }];
    sim.step(FIXED_STEP);
    expect(sim.phase).toBe('crashed');
    expect(sim.banked).toBe(0); expect(sim.tricksLanded).toBe(0);
    expect(sim.takeEvents().some(event => event.kind === 'landing')).toBe(false);
  });
  it('agrees with the independent Three.js OBB implementation for 300 static orientations and offsets', () => {
    let seed = 1234;
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    const box = new Box3(new Vector3(...car).negate(), new Vector3(...car));
    for (let i = 0; i < 300; i++) {
      const pose = { pitch: random() * Math.PI * 2, roll: random() * Math.PI * 2 };
      const position: Vec3 = [(random() - 0.5) * 6, (random() - 0.5) * 5, (random() - 0.5) * 8];
      const matrix = new Matrix3().setFromMatrix4(new Matrix4().makeRotationFromEuler(new Euler(pose.pitch, 0, pose.roll, 'XYZ')));
      const obb = new OBB(new Vector3(...position), new Vector3(...CAR_HALF), matrix);
      expect(sweptCarHitsBox(position, position, pose, pose, car)).toBe(obb.intersectsBox3(box));
    }
  });
});

describe('traffic spacing', () => {
  it('keeps two open lanes per row, an open lane shared by neighbours, and boost-sized spacing across 16 seeds', () => {
    for (let seed = 0; seed < 16; seed++) {
      const director = new TrafficDirector(seed); let previous = director.next();
      for (let i = 0; i < 200; i++) {
        const row = director.next();
        expect(row.blockedLanes).toHaveLength(2);
        expect(row.openLanes.some(lane => previous.openLanes.includes(lane))).toBe(true);
        expect(row.blockedLanes.some(lane => row.openLanes.includes(lane))).toBe(false);
        expect(row.distance - previous.distance).toBeGreaterThanOrEqual(MIN_ROW_SPACING - 1e-8);
        expect((row.distance - previous.distance - 8) / (50 - TRAFFIC_SPEED)).toBeGreaterThan(2.5);
        previous = row;
      }
    }
  });
  it('repeats the same seed and varies other seeds', () => {
    const a = new TrafficDirector(7), b = new TrafficDirector(7), c = new TrafficDirector(8);
    const rows = (d: TrafficDirector) => Array.from({ length: 20 }, () => d.next());
    expect(rows(a)).toEqual(rows(b)); expect(rows(new TrafficDirector(7))).not.toEqual(rows(c));
  });
  it('preserves row spacing when later rows spawn and keeps the live traffic count bounded', () => {
    const sim = new Simulation(); sim.start('run', 17);
    const seen = new Map<number, number>();
    for (let tick = 0; tick < 160 * 60; tick++) {
      // Stress sustained boost at flight ceiling so the test can inspect long runs without steering.
      sim.height = 9; sim.verticalSpeed = 0; sim.energy = 100;
      sim.step(FIXED_STEP, { thrust: true, boost: true, slam: false });
      expect(sim.phase).toBe('playing'); expect(sim.traffic.length).toBeLessThanOrEqual(14);
      for (const vehicle of sim.traffic) if (vehicle.id >= 4) seen.set(vehicle.id, vehicle.distance - TRAFFIC_SPEED * sim.elapsed);
    }
    const rows = [...new Set([...seen.values()].map(n => Math.round(n * 1000) / 1000))].sort((a, b) => a - b);
    expect(rows.length).toBeGreaterThan(20);
    for (let i = 1; i < rows.length; i++) expect(rows[i] - rows[i - 1]).toBeGreaterThanOrEqual(MIN_ROW_SPACING - 0.002);
  });
});

describe('traffic advisory', () => {
  function setup() {
    const sim = new Simulation(); sim.start();
    const vehicle: Traffic = { id: 123, lane: 1, distance: 30, speed: 11, kind: 'car', color: 0, nearMissChecked: false };
    sim.traffic = [vehicle]; return { sim, vehicle };
  }
  it('warns in the current/selected lane and grows urgent at boost speed', () => {
    const { sim, vehicle } = setup(); expect(trafficThreat(sim, NO_INPUT)?.id).toBe(123);
    expect(trafficThreat(sim, NO_INPUT)?.urgent).toBe(false);
    sim.speed = 38; expect(trafficThreat(sim, NO_INPUT)?.urgent).toBe(true);
    vehicle.lane = 0; expect(trafficThreat(sim, NO_INPUT)).toBeNull();
    sim.changeLane(-1); expect(trafficThreat(sim, NO_INPUT)?.lane).toBe(0);
  });
  it('accounts for flight and descent and clears in pause, practice and receding traffic', () => {
    const { sim, vehicle } = setup(); sim.height = 7;
    expect(trafficThreat(sim, { ...NO_INPUT, thrust: true })).toBeNull();
    expect(trafficThreat(sim, NO_INPUT)?.id).toBe(123);
    sim.pause(); expect(trafficThreat(sim, NO_INPUT)).toBeNull(); sim.pause();
    sim.height = 0; vehicle.speed = 30; expect(trafficThreat(sim, NO_INPUT)).toBeNull();
    sim.start('practice'); expect(trafficThreat(sim, NO_INPUT)).toBeNull();
  });
});
