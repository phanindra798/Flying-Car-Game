import { it, expect } from 'vitest';
import { Simulation } from './simulation';
import { freshAchievements, parseAchievements, earnedBadges, recordAchievementRun, nextAchievement, liveAchievementValue } from './achievements';
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

it('tracks the closest eligible unfinished badge and excludes practice and route-only goals on highways',()=>{
 const state={...freshAchievements(),distance:2500,rings:23};
 expect(nextAchievement(state,'stunt')?.metric).toBe('rings');
 expect(nextAchievement(state,'run')?.metric).toBe('distance');
 expect(nextAchievement(state,'practice')).toBeUndefined();
 expect(nextAchievement({...state,distance:5000,tricks:10,score:10000},'run')).toBeUndefined();
});
it('previews only banked progress without saving or double-counting personal best score',()=>{
 const state={...freshAchievements(),distance:4990,score:9000,rings:23};const sim=new Simulation();sim.start('stunt');sim.distance=20;
 const ring=nextAchievement(state,'stunt')!;
 // Distance is closer to its target than rings.
 expect(ring.metric).toBe('distance');expect(liveAchievementValue(state,sim,ring)).toBe(5000);expect(state.distance).toBe(4990);
 const ringBadge=nextAchievement({...state,distance:5000},'stunt')!;sim.route!.rings[0]='pending';expect(liveAchievementValue(state,sim,ringBadge)).toBe(23);
 sim.route!.rings[0]='banked';expect(liveAchievementValue(state,sim,ringBadge)).toBe(24);
 const scoreBadge=nextAchievement({...state,distance:5000,tricks:10},'run')!;sim.distance=0;sim.banked=9500;expect(liveAchievementValue(state,sim,scoreBadge)).toBe(9500);
});
it('discards the whole corrupt save even when earlier fields are valid',()=>{
 expect(parseAchievements(JSON.stringify({...freshAchievements(),finishes:3,distance:4000,score:-1}))).toEqual(freshAchievements());
});
