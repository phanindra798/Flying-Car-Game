import type { Simulation } from './simulation';
export const ACHIEVEMENT_KEY = 'boostline.achievements.v1';
export const freshAchievements = () => ({ version: 1, finishes: 0, distance: 0, tricks: 0, rings: 0, golds: 0, score: 0 });
export type Achievements = ReturnType<typeof freshAchievements>;
export const BADGES = [
  { name: 'First finish', metric: 'finishes', target: 1, detail: 'Complete a stunt route' },
  { name: 'Coast explorer', metric: 'distance', target: 5000, detail: 'Travel 5,000 m across scored attempts' },
  { name: 'Rotation artist', metric: 'tricks', target: 10, detail: 'Bank 10 flips or rolls' },
  { name: 'Ring collector', metric: 'rings', target: 24, detail: 'Bank 24 rings across completed routes' },
  { name: 'Gold pilot', metric: 'golds', target: 1, detail: 'Finish a route with all 8 rings banked' },
  { name: 'High scorer', metric: 'score', target: 10000, detail: 'Score 10,000 points in one completed attempt' },
] as const;
export function parseAchievements(raw: string | null): Achievements {
  const fresh = freshAchievements();
  if (!raw || raw.length > 1024) return fresh;
  try {
    const data = JSON.parse(raw);
    if (data?.version !== 1) return fresh;
    for (const key of ['finishes','distance','tricks','rings','golds','score'] as const) {
      if (!Number.isInteger(data[key]) || data[key] < 0 || data[key] > 1_000_000_000) return freshAchievements();
      fresh[key] = data[key];
    }
    return fresh;
  } catch { return fresh; }
}
export const earnedBadges = (state: Achievements) => BADGES.filter(badge => state[badge.metric] >= badge.target);
export function recordAchievementRun(state: Achievements, sim: Simulation): Achievements {
  if (!(sim.mode === 'run' && sim.phase === 'crashed') && !(sim.mode === 'stunt' && sim.phase === 'finished')) return state;
  const add = (a: number, b: number) => Math.min(1_000_000_000, a + Math.max(0, Math.floor(b)));
  return { version: 1, finishes: add(state.finishes, sim.mode === 'stunt' ? 1 : 0), distance: add(state.distance, sim.distance), tricks: add(state.tricks, sim.tricksLanded), rings: add(state.rings, sim.route?.banked ?? 0), golds: add(state.golds, sim.route?.banked === 8 ? 1 : 0), score: Math.max(state.score, Math.min(1_000_000_000, sim.score)) };
}

// Choose once at run start so the target does not jump around during play.
export function nextAchievement(state: Achievements, mode: Simulation['mode']) {
  if (mode === 'practice') return undefined;
  return BADGES.filter(b => ['distance', 'tricks', 'score', ...(mode === 'stunt' ? ['rings'] : [])].includes(b.metric) && state[b.metric] < b.target)
    .sort((a, b) => state[b.metric] / b.target - state[a.metric] / a.target)[0];
}
export function liveAchievementValue(state: Achievements, sim: Simulation, badge: typeof BADGES[number]) {
  const metric = badge.metric;
  const addition = metric === 'distance' ? Math.floor(sim.distance) : metric === 'tricks' ? sim.tricksLanded : metric === 'rings' ? sim.route?.banked ?? 0 : 0;
  return Math.min(badge.target, metric === 'score' ? Math.max(state.score, sim.score) : state[metric] + addition);
}
