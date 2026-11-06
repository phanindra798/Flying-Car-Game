import { it, expect } from 'vitest';
import { Simulation } from './simulation';
import { freshAchievements, parseAchievements, earnedBadges, recordAchievementRun } from './achievements';
it('counts completed routes, banked stunts and rings without mutating previous progress',()=>{
 const sim=new Simulation();sim.start('stunt');sim.phase='finished';sim.distance=1200;sim.tricksLanded=3;sim.route!.rings.fill('banked');
 const fresh=freshAchievements(),next=recordAchievementRun(fresh,sim);
 expect(next.finishes).toBe(1);expect(next.rings).toBe(8);expect(next.tricks).toBe(3);expect(next.distance).toBe(1200);expect(fresh.distance).toBe(0);
 expect(earnedBadges(next).map(b=>b.name)).toEqual(['First finish','Gold pilot']);expect(parseAchievements(JSON.stringify(next))).toEqual(next);
});
it('excludes practice, active attempts and interrupted routes',()=>{
 const sim=new Simulation(),fresh=freshAchievements();sim.start('practice');sim.phase='crashed';expect(recordAchievementRun(fresh,sim)).toBe(fresh);
 sim.start('stunt');expect(recordAchievementRun(fresh,sim)).toBe(fresh);sim.phase='crashed';expect(recordAchievementRun(fresh,sim)).toBe(fresh);
});
it('counts highway attempts and caps cumulative values',()=>{
 const sim=new Simulation();sim.start();sim.phase='crashed';sim.distance=6000;sim.tricksLanded=10;
 const next=recordAchievementRun(freshAchievements(),sim);expect(next.finishes).toBe(0);expect(earnedBadges(next).map(b=>b.name)).toContain('Coast explorer');
 expect(recordAchievementRun({...next,distance:1_000_000_000},sim).distance).toBe(1_000_000_000);
});
it('rejects malformed and unsupported saves',()=>{
 for(const raw of ['bad','null',JSON.stringify({...freshAchievements(),version:2}),JSON.stringify({...freshAchievements(),rings:-1}),JSON.stringify({...freshAchievements(),score:Infinity})])expect(parseAchievements(raw)).toEqual(freshAchievements());
});
