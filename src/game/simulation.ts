import { getCar, type CarId } from './garage-cars';
import { carBounds, sweptCarHitsBox, type Vec3 } from './collision';
import { TrafficDirector, TRAFFIC_SPEED } from './traffic';
export { segmentHitsBox } from './collision';

export const LANES = [-5.25, -1.75, 1.75, 5.25] as const;
export const FIXED_STEP = 1 / 60;
export type Phase = 'ready' | 'playing' | 'paused' | 'crashed';
export type Mode = 'run' | 'practice';
export type TrickKind = 'flip' | 'roll-left' | 'roll-right';
export interface HeldInput { thrust: boolean; boost: boolean; slam: boolean }
export const NO_INPUT: HeldInput = { thrust: false, boost: false, slam: false };
export interface Traffic {
  id: number; lane: number; distance: number; speed: number;
  kind: 'car' | 'van' | 'truck'; color: number; nearMissChecked: boolean;
}
export interface GameEvent {
  kind: 'jump' | 'trick' | 'landing' | 'near' | 'crash';
  title: string; detail: string;
  landing?: { quality: 'clean' | 'rough' | 'unfinished' | 'plain'; points: number; tricks: number };
}
interface Stunt { kind: TrickKind; time: number; duration: number }
export const VEHICLES = {
  car: { width: 1.8, height: 1.5, length: 4.1 },
  van: { width: 2.1, height: 2.4, length: 5.4 },
  truck: { width: 2.5, height: 3.8, length: 8.0 },
};

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export class Simulation {
  private car = getCar('vector');
  get carId() { return this.car.id; }
  get tuning() { return this.car; }
  phase: Phase = 'ready';
  mode: Mode = 'run';
  x: number = LANES[1];
  lane = 1;
  height = 0;
  verticalSpeed = 0;
  speed = 0;
  distance = 0;
  elapsed = 0;
  energy = 100;
  pitch = 0;
  roll = 0;
  boostActive = false;
  thrustActive = false;
  banked = 0;
  combo = 1;
  maxCombo = 1;
  tricksLanded = 0;
  pendingTricks = 0;
  crashReason = '';
  traffic: Traffic[] = [];
  events: GameEvent[] = [];
  private stunt: Stunt | null = null;
  private groundedTime = 0;
  private randomState = 42;
  private director = new TrafficDirector();
  private vehicleId = 0;

  get score() { return Math.floor(this.distance * 1.4) + this.banked; }
  get airborne() { return this.height > 0.001 || this.verticalSpeed > 0; }
  get stuntRemaining() { return this.stunt ? Math.max(0, this.stunt.duration - this.stunt.time) : 0; }
  get pendingLandingPoints() { return this.pendingTricks > 0 ? (this.pendingTricks * 120 + 50) * this.combo : 0; }

  start(mode: Mode = 'run', seed = 42, carId: CarId = 'vector') {
    this.car = getCar(carId);
    this.mode = mode;
    this.phase = 'playing';
    this.x = LANES[1]; this.lane = 1;
    this.height = 0; this.verticalSpeed = 0; this.speed = this.car.cruise;
    this.distance = 0; this.elapsed = 0; this.energy = 100;
    this.pitch = 0; this.roll = 0; this.boostActive = false; this.thrustActive = false;
    this.banked = 0; this.combo = 1; this.maxCombo = 1;
    this.pendingTricks = 0; this.tricksLanded = 0; this.crashReason = '';
    this.stunt = null; this.groundedTime = 0;
    this.randomState = seed >>> 0; this.director = new TrafficDirector(seed); this.vehicleId = 0;
    this.traffic = []; this.events = [];
    if (mode === 'run') {
      this.spawn(0, 62, 'car');
      this.spawn(2, 93, 'truck');
      this.spawn(1, 130, 'van');
      this.spawn(3, 155, 'car');
    }
  }

  changeLane(direction: -1 | 1) {
    if (this.phase === 'playing') this.lane = clamp(this.lane + direction, 0, 3);
  }

  jump() {
    if (this.phase !== 'playing' || this.airborne || this.energy < 7) return false;
    this.verticalSpeed = this.car.jump;
    this.energy -= 7;
    this.groundedTime = 0;
    this.events.push({ kind: 'jump', title: '', detail: '' });
    return true;
  }

  trick(kind: TrickKind) {
    if (this.phase !== 'playing' || !this.airborne || this.stunt) return false;
    this.stunt = { kind, time: 0, duration: (kind === 'flip' ? 0.7 : 0.66) * this.car.stunt };
    return true;
  }

  pause() {
    if (this.phase === 'playing') this.phase = 'paused';
    else if (this.phase === 'paused') this.phase = 'playing';
  }

  takeEvents() {
    const events = this.events;
    this.events = [];
    return events;
  }

  step(dt: number, input: HeldInput = NO_INPUT) {
    if (this.phase !== 'playing') return;
    const oldX = this.x;
    const oldHeight = this.height;
    const oldDistance = this.distance;
    const oldRotation = { pitch: this.pitch, roll: this.roll };
    this.elapsed += dt;
    this.x += (LANES[this.lane] - this.x) * (1 - Math.exp(-this.car.steering * dt));
    this.boostActive = input.boost && this.energy > 0;
    const targetSpeed = this.car.cruise + Math.min(12, this.elapsed * 0.055) + (this.boostActive ? this.car.boost : 0);
    this.speed += (targetSpeed - this.speed) * (1 - Math.exp(-3 * dt));
    this.distance += this.speed * dt;

    const wasAirborne = this.airborne;
    this.thrustActive = input.thrust && wasAirborne && this.energy > 0 && !input.slam;
    let consumption = this.boostActive ? this.car.boostDrain : 0;
    if (wasAirborne) {
      this.groundedTime = 0;
      consumption += this.thrustActive ? this.car.flightDrain : 0;
      const acceleration = -19 + (this.thrustActive ? this.car.lift : 0) - (input.slam ? 35 : 0);
      this.verticalSpeed = clamp(this.verticalSpeed + acceleration * dt, -24, 11);
      this.height += this.verticalSpeed * dt;
      if (this.height > 9) { this.height = 9; this.verticalSpeed = Math.min(0, this.verticalSpeed); }
    } else {
      this.groundedTime += dt;
      if (!this.boostActive && this.groundedTime > 0.65) this.energy += this.car.recharge * dt;
    }
    this.energy = clamp(this.energy - consumption * dt, 0, 100);

    if (this.stunt) {
      this.stunt.time += dt;
      const t = clamp(this.stunt.time / this.stunt.duration, 0, 1);
      const angle = t * t * (3 - 2 * t) * Math.PI * 2;
      if (this.stunt.kind === 'flip') this.pitch = -angle;
      else this.roll = angle * (this.stunt.kind === 'roll-left' ? 1 : -1);
      if (t >= 1) {
        this.pendingTricks++;
        this.events.push({ kind: 'trick', title: this.stunt.kind === 'flip' ? 'FRONT FLIP' : 'BARREL ROLL', detail: 'Land it to bank the points' });
        this.stunt = null;
        this.pitch = 0; this.roll = 0;
      }
    }

    const touchesRoad = wasAirborne && this.height <= 0;
    if (touchesRoad) this.height = 0;

    const bounds = carBounds(this);
    for (const vehicle of this.traffic) {
      const previous = vehicle.distance;
      vehicle.distance += vehicle.speed * dt;
      const dimensions = VEHICLES[vehicle.kind];
      const start: Vec3 = [oldX - LANES[vehicle.lane], oldHeight + 0.78 - dimensions.height / 2, previous - oldDistance];
      const end: Vec3 = [this.x - LANES[vehicle.lane], this.height + 0.78 - dimensions.height / 2, vehicle.distance - this.distance];
      const half: Vec3 = [dimensions.width / 2, dimensions.height / 2, dimensions.length / 2];
      if (sweptCarHitsBox(start, end, oldRotation, this, half)) {
        this.crash('Traffic got the better of you. Look ahead and choose your line.');
        break;
      }
      if (!vehicle.nearMissChecked && vehicle.distance < this.distance - dimensions.length / 2) {
        vehicle.nearMissChecked = true;
        const sideGap = Math.abs(this.x - LANES[vehicle.lane]);
        if (!this.airborne && sideGap > half[0] + bounds[0] && sideGap < 3.8) {
          this.banked += 35 * this.combo;
          this.events.push({ kind: 'near', title: 'CLOSE CALL', detail: `+${35 * this.combo} points` });
        }
      }
    }
    // A touchdown only earns points after traffic contact has been ruled out.
    if (this.phase !== 'playing') return;
    if (touchesRoad) this.land();
    if (this.phase !== 'playing') return;
    this.traffic = this.traffic.filter(v => v.distance > this.distance - 35);
    if (this.mode === 'run') {
      const flowOffset = TRAFFIC_SPEED * this.elapsed;
      while (this.director.nextDistance + flowOffset < this.distance + 420) {
        const row = this.director.next();
        for (const lane of row.blockedLanes) {
          const kind = this.random() < 0.3 ? 'truck' : this.random() < 0.4 ? 'van' : 'car';
          this.spawn(lane, row.distance + flowOffset, kind);
        }
      }
    }
  }

  private land() {
    this.height = 0;
    const impact = -this.verticalSpeed;
    this.verticalSpeed = 0;
    const upright = Math.cos(this.pitch) * Math.cos(this.roll) > 0.65;
    const unfinished = !upright || this.stunt !== null;
    if (unfinished && this.mode === 'run') {
      this.crash('Give your rotation a little more airtime before landing.');
      return;
    }
    this.pitch = 0; this.roll = 0; this.stunt = null;
    // A normal fall from the flight ceiling is safe; a hard slam is not.
    if (unfinished) {
      this.combo = 1;
      this.events.push({ kind: 'landing', title: 'ROTATION UNFINISHED', detail: 'Give your next stunt a little more airtime', landing: { quality: 'unfinished', points: 0, tricks: 0 } });
    } else if (impact < 20 && this.pendingTricks > 0) {
      const points = this.pendingLandingPoints;
      this.banked += points;
      this.tricksLanded += this.pendingTricks;
      this.combo = Math.min(8, this.combo + 1);
      this.maxCombo = Math.max(this.maxCombo, this.combo);
      this.energy = Math.min(100, this.energy + 6);
      this.events.push({ kind: 'landing', title: 'CLEAN LANDING', detail: `+${points} points · ${this.combo}× combo`, landing: { quality: 'clean', points, tricks: this.pendingTricks } });
    } else if (impact >= 20) {
      this.combo = 1;
      this.events.push({ kind: 'landing', title: 'ROUGH LANDING', detail: 'Ease off the slam before touchdown', landing: { quality: 'rough', points: 0, tricks: 0 } });
    } else {
      this.events.push({ kind: 'landing', title: 'BACK ON THE ROAD', detail: 'Try a flip or roll during your next jump', landing: { quality: 'plain', points: 0, tricks: 0 } });
    }
    this.pendingTricks = 0;
    this.groundedTime = 0;
  }

  private crash(reason: string) {
    this.phase = 'crashed'; this.crashReason = reason;
    this.pendingTricks = 0; this.thrustActive = false; this.boostActive = false;
    this.events.push({ kind: 'crash', title: 'RUN COMPLETE', detail: reason });
  }

  private spawn(lane: number, distance: number, kind: Traffic['kind']) {
    this.traffic.push({ id: this.vehicleId++, lane, distance, kind,
      speed: TRAFFIC_SPEED,
      color: [0x536b71, 0xb97050, 0xc3bfa9, 0x284e4d, 0x584956][Math.floor(this.random() * 5)], nearMissChecked: false });
  }

  private random() {
    this.randomState = (Math.imul(1664525, this.randomState) + 1013904223) >>> 0;
    return this.randomState / 4294967296;
  }
}
