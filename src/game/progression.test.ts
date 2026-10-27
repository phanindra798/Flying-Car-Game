import { describe, expect, it } from 'vitest';
import { Simulation, FIXED_STEP } from './simulation';
import { CHALLENGES, MAX_CREDITS, PAINTS, RunProgress, freshProfile, nextChallenge, parseProfile, usePaint } from './progression';

const near = { kind: 'near', title: 'CLOSE CALL', detail: '' } as const;
function run(completed = 0) {
  const sim = new Simulation(), progress = new RunProgress();
  const profile = { ...freshProfile(), completed };
  sim.start(); progress.begin(sim, profile);
  return { sim, progress, profile };
}

describe('local career and garage', () => {
  it('loads bounded data and repairs unknown, duplicate and unowned paints', () => {
    const stored = { ...freshProfile(), credits: 193, completed: 2, owned: ['ember', 'ember', 'unknown'], equipped: 'violet' };
    const restored = parseProfile(JSON.stringify(stored));
    expect(restored).toEqual({ ...freshProfile(), credits: 193, completed: 2, owned: ['ivory', 'ember'], equipped: 'ivory' });
    const valid = { ...restored, equipped: 'ember' as const };
    expect(parseProfile(JSON.stringify(valid))).toEqual(valid);
    for (const raw of [null, '{', 'null', '[]', '0', 'x'.repeat(4097), JSON.stringify({ ...stored, version: 3 }), JSON.stringify({ ...stored, credits: -1 }), JSON.stringify({ ...stored, credits: 1.5 }), JSON.stringify({ ...stored, credits: MAX_CREDITS + 1 }), JSON.stringify({ ...stored, completed: 7 }), JSON.stringify({ ...stored, owned: Array(65).fill('ivory') })]) expect(parseProfile(raw)).toEqual(freshProfile());
  });
  it('rejects unaffordable/unknown purchases without mutating the wallet', () => {
    const profile = freshProfile(), before = JSON.stringify(profile);
    expect(usePaint(profile, 'ember')).toEqual({ profile, outcome: 'insufficient' });
    expect(usePaint(profile, '__proto__')).toEqual({ profile, outcome: 'invalid' });
    expect(JSON.stringify(profile)).toBe(before);
  });
  it('charges exactly once, equips immediately and switches owned paints for free', () => {
    const start = { ...freshProfile(), credits: 235 };
    const unlocked = usePaint(start, 'ember');
    expect(unlocked.outcome).toBe('unlocked'); expect(unlocked.profile.credits).toBe(160);
    expect(unlocked.profile.owned).toEqual(['ivory', 'ember']); expect(unlocked.profile.equipped).toBe('ember');
    const repeat = usePaint(unlocked.profile, 'ember');
    expect(repeat.outcome).toBe('equipped'); expect(repeat.profile).toEqual(unlocked.profile);
    const blue = usePaint(repeat.profile, 'frost').profile;
    expect(blue.credits).toBe(0); expect(blue.equipped).toBe('frost');
    expect(usePaint(blue, 'ivory').profile.credits).toBe(0); expect(start.credits).toBe(235);
    expect(parseProfile(JSON.stringify(blue))).toEqual(blue);
  });
  it('rewards an actual clean flip and finished run once, enough for a first colour', () => {
    const { sim, progress, profile } = run();
    sim.jump();
    for (let i = 0; i < 1000 && sim.phase === 'playing'; i++) {
      if (i === 18) sim.trick('flip');
      sim.step(FIXED_STEP, { thrust: i < 66, boost: false, slam: false });
      for (const event of sim.takeEvents()) progress.onEvent(event);
    }
    expect(sim.phase).toBe('crashed'); expect(sim.tricksLanded).toBe(1);
    const reward = progress.settle(profile, sim)!;
    expect(reward.challenge).toEqual(CHALLENGES[0]); expect(reward.profile.completed).toBe(1);
    expect(reward.distance).toBe(Math.floor(sim.distance / 20)); expect(reward.stunts).toBe(8); expect(reward.bonus).toBe(60);
    expect(reward.earned).toBe(reward.distance + reward.stunts + reward.closeCalls + reward.bonus);
    expect(reward.earned).toBeGreaterThanOrEqual(PAINTS[1].price);
    expect(progress.settle(reward.profile, sim)).toBeNull();
  });
  it('keeps reached targets pending until a crash and advances just one challenge', () => {
    const { sim, progress, profile } = run();
    sim.tricksLanded = 5; sim.distance = 1500; sim.maxCombo = 8;
    expect(progress.status(sim)?.reached).toBe(true); expect(profile.completed).toBe(0);
    expect(progress.settle(profile, sim)).toBeNull();
    sim.pause(); expect(progress.settle(profile, sim)).toBeNull();
    sim.phase = 'crashed'; const result = progress.settle(profile, sim)!;
    expect(result.profile.completed).toBe(1); expect(nextChallenge(result.profile)?.challenge).toEqual(CHALLENGES[1]);
  });
  it('does not reward practice, cancelled runs or old progress after retry', () => {
    const { sim, progress, profile } = run(); sim.distance = 500; sim.tricksLanded = 1;
    progress.cancel(); sim.phase = 'crashed'; expect(progress.settle(profile, sim)).toBeNull();
    sim.start('practice'); progress.begin(sim, profile); sim.tricksLanded = 5; sim.distance = 1000;
    progress.onEvent(near); sim.phase = 'crashed'; expect(progress.status(sim)).toBeNull(); expect(progress.settle(profile, sim)).toBeNull();
    sim.start(); progress.begin(sim, profile); progress.onEvent(near); sim.tricksLanded = 1;
    sim.start(); progress.begin(sim, profile); sim.phase = 'crashed';
    const reward = progress.settle(profile, sim)!;
    expect(reward.earned).toBe(0); expect(reward.profile.completed).toBe(0);
  });
  it('requires the full distance or clean-stunt count and accepts the exact boundary', () => {
    for (const [index, field, target] of [[1, 'distance', 400], [3, 'tricksLanded', 3], [4, 'maxCombo', 4], [5, 'distance', 1000]] as const) {
      const { sim, progress, profile } = run(index);
      sim[field] = target - 0.01; expect(progress.status(sim)?.reached).toBe(false);
      sim[field] = target; expect(progress.status(sim)?.reached).toBe(true);
      sim.phase = 'crashed'; expect(progress.settle(profile, sim)?.bonus).toBe(CHALLENGES[index].bonus);
    }
  });
  it('counts close calls from events, ignores unrelated events and resets on the next run', () => {
    const { sim, progress, profile } = run(2);
    progress.onEvent({ kind: 'trick', title: '', detail: '' });
    progress.onEvent(near); progress.onEvent(near); expect(progress.status(sim)?.value).toBe(2); expect(progress.status(sim)?.reached).toBe(false);
    progress.onEvent(near); expect(progress.status(sim)?.reached).toBe(true);
    sim.phase = 'crashed'; const reward = progress.settle(profile, sim)!;
    expect(reward.closeCalls).toBe(6); expect(reward.bonus).toBe(100);
    sim.start(); progress.begin(sim, profile); expect(progress.status(sim)?.value).toBe(0);
  });
  it('uses the current wallet at settlement so a mid-run purchase is preserved', () => {
    const { sim, progress, profile } = run(); profile.credits = 90;
    const bought = usePaint(profile, 'ember').profile;
    sim.distance = 200; sim.tricksLanded = 1; sim.phase = 'crashed';
    const reward = progress.settle(bought, sim)!;
    expect(reward.profile.credits).toBe(93); expect(reward.profile.equipped).toBe('ember'); expect(reward.profile.owned).toContain('ember');
  });
  it('keeps base rewards after all challenges and never exceeds the balance limit', () => {
    const { sim, progress, profile } = run(CHALLENGES.length);
    profile.credits = MAX_CREDITS - 2; sim.distance = 400; sim.tricksLanded = 2; sim.phase = 'crashed';
    expect(progress.status(sim)).toBeNull(); const reward = progress.settle(profile, sim)!;
    expect(reward.earned).toBe(2); expect(reward.profile.credits).toBe(MAX_CREDITS); expect(reward.bonus).toBe(0);
    expect(reward.profile.completed).toBe(CHALLENGES.length); expect(nextChallenge(reward.profile)).toBeNull();
  });
  it('cannot repeat a challenge bonus when its target was already claimed', () => {
    const { sim, progress, profile } = run(); sim.tricksLanded = 1; sim.phase = 'crashed';
    const reward = progress.settle({ ...profile, completed: 1 }, sim)!;
    expect(reward.bonus).toBe(0); expect(reward.profile.completed).toBe(1);
  });
});
