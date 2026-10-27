import { GARAGE_CARS, isCarId, type CarId } from './garage-cars';
import type { GameEvent, Simulation } from './simulation';

export const PROGRESS_KEY = 'boostline.progress.v1';
export const MAX_CREDITS = 999_999;
export const PAINTS = [
  { id: 'ivory', name: 'Coast Ivory', color: 0xe5e5d9, price: 0 },
  { id: 'ember', name: 'Sunset Ember', color: 0xf28758, price: 75 },
  { id: 'frost', name: 'Glacier Blue', color: 0x64bfde, price: 160 },
  { id: 'violet', name: 'After Hours', color: 0xb19af2, price: 260 },
] as const;
export type PaintId = typeof PAINTS[number]['id'];
export type Profile = { version: 2; credits: number; owned: PaintId[]; equipped: PaintId; completed: number; cars: CarId[]; selectedCar: CarId };
export const CHALLENGES = [
  { title: 'Stick the landing', short: 'CLEAN STUNTS', detail: 'Land 1 completed flip or roll cleanly.', metric: 'tricks', target: 1, bonus: 60 },
  { title: 'Coast explorer', short: 'DISTANCE', detail: 'Travel 400 metres in one run.', metric: 'distance', target: 400, bonus: 90 },
  { title: 'Thread the traffic', short: 'CLOSE CALLS', detail: 'Earn 3 close calls in one run.', metric: 'near', target: 3, bonus: 100 },
  { title: 'Stunt collector', short: 'CLEAN STUNTS', detail: 'Land 3 completed stunts cleanly in one run.', metric: 'tricks', target: 3, bonus: 140 },
  { title: 'Keep the rhythm', short: 'BEST COMBO', detail: 'Reach a 4× combo in one run.', metric: 'combo', target: 4, bonus: 180 },
  { title: 'Kilometre club', short: 'DISTANCE', detail: 'Travel 1,000 metres in one run.', metric: 'distance', target: 1000, bonus: 250 },
] as const;
export type Challenge = typeof CHALLENGES[number];
export type ChallengeStatus = { challenge: Challenge; index: number; value: number; reached: boolean };
export type RunReward = { profile: Profile; earned: number; distance: number; stunts: number; closeCalls: number; bonus: number; challenge: Challenge | null };

export function freshProfile(): Profile {
  return { version: 2, credits: 0, owned: ['ivory'], equipped: 'ivory', completed: 0, cars: ['vector'], selectedCar: 'vector' };
}
const isPaint = (id: unknown): id is PaintId => PAINTS.some(paint => paint.id === id);
const integer = (value: unknown, max: number): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= max;

export function parseProfile(raw: string | null): Profile {
  if (!raw || raw.length > 4096) return freshProfile();
  try {
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== 'object') return freshProfile();
    const p = data as Record<string, unknown>;
    if ((p.version !== 1 && p.version !== 2) || !integer(p.credits, MAX_CREDITS) || !integer(p.completed, CHALLENGES.length) || !Array.isArray(p.owned) || p.owned.length > 64) return freshProfile();
    const owned = [...new Set<PaintId>(['ivory', ...p.owned.filter(isPaint)])];
    const equipped = isPaint(p.equipped) && owned.includes(p.equipped) ? p.equipped : 'ivory';
    const cars = [...new Set<CarId>(['vector', ...(p.version === 2 && Array.isArray(p.cars) && p.cars.length <= 64 ? p.cars.filter(isCarId) : [])])];
    const selectedCar = p.version === 2 && isCarId(p.selectedCar) && cars.includes(p.selectedCar) ? p.selectedCar : 'vector';
    return { version: 2, credits: p.credits, owned, equipped, completed: p.completed, cars, selectedCar };
  } catch { return freshProfile(); }
}

export function usePaint(profile: Profile, id: string): { profile: Profile; outcome: 'unlocked' | 'equipped' | 'insufficient' | 'invalid' } {
  const paint = PAINTS.find(p => p.id === id);
  if (!paint) return { profile, outcome: 'invalid' };
  if (profile.owned.includes(paint.id)) return { profile: { ...profile, equipped: paint.id }, outcome: 'equipped' };
  if (profile.credits < paint.price) return { profile, outcome: 'insufficient' };
  return { profile: { ...profile, credits: profile.credits - paint.price, equipped: paint.id, owned: [...profile.owned, paint.id] }, outcome: 'unlocked' };
}

export function useCar(profile: Profile, id: string): { profile: Profile; outcome: 'unlocked' | 'equipped' | 'insufficient' | 'invalid' } {
  const car = GARAGE_CARS.find(candidate => candidate.id === id);
  if (!car) return { profile, outcome: 'invalid' };
  if (profile.cars.includes(car.id)) return { profile: { ...profile, selectedCar: car.id }, outcome: 'equipped' };
  if (profile.credits < car.price) return { profile, outcome: 'insufficient' };
  return { profile: { ...profile, credits: profile.credits - car.price, selectedCar: car.id, cars: [...profile.cars, car.id] }, outcome: 'unlocked' };
}

export function nextChallenge(profile: Profile): ChallengeStatus | null {
  const challenge = CHALLENGES[profile.completed];
  return challenge ? { challenge, index: profile.completed, value: challenge.metric === 'combo' ? 1 : 0, reached: false } : null;
}

// Runs own a target snapshot. Only a finished scored run may claim it, once.
export class RunProgress {
  private active = false;
  private target = 0;
  private near = 0;

  begin(sim: Simulation, profile: Profile) {
    this.active = sim.mode === 'run' && sim.phase === 'playing';
    this.target = profile.completed;
    this.near = 0;
  }
  cancel() { this.active = false; this.near = 0; }
  onEvent(event: GameEvent) {
    if (this.active && event.kind === 'near') this.near = Math.min(10_000, this.near + 1);
  }
  status(sim: Simulation): ChallengeStatus | null {
    const challenge = CHALLENGES[this.target];
    if (!this.active || !challenge || sim.mode !== 'run') return null;
    const raw = { distance: sim.distance, tricks: sim.tricksLanded, combo: sim.maxCombo, near: this.near }[challenge.metric];
    const value = Math.min(challenge.target, Math.max(0, Math.floor(raw)));
    return { challenge, index: this.target, value, reached: value >= challenge.target };
  }
  settle(profile: Profile, sim: Simulation): RunReward | null {
    if (!this.active || sim.mode !== 'run' || sim.phase !== 'crashed') return null;
    const status = this.status(sim);
    this.active = false;
    const amount = (value: number) => Number.isFinite(value) ? Math.min(MAX_CREDITS, Math.max(0, Math.floor(value))) : 0;
    const distance = amount(sim.distance / 20);
    const stunts = amount(sim.tricksLanded * 8);
    const closeCalls = amount(this.near * 2);
    const challenge = status?.reached && profile.completed === this.target ? status.challenge : null;
    const bonus = challenge?.bonus ?? 0;
    const credits = Math.min(MAX_CREDITS, profile.credits + distance + stunts + closeCalls + bonus);
    return { profile: { ...profile, credits, completed: profile.completed + (challenge ? 1 : 0) }, earned: credits - profile.credits, distance, stunts, closeCalls, bonus, challenge };
  }
}
