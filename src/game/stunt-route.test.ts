import { describe, expect, it } from 'vitest';
import { Simulation, FIXED_STEP, LANES, NO_INPUT } from './simulation';
import { GARAGE_CARS } from './garage-cars';
import { StuntRoute, ROUTE_ID, ROUTE_LENGTH, ROUTE_STATIONS, RAMP_HEIGHT, crossingAt, parseRouteRecords, betterRoute, routeMedal } from './stunt-route';
import { RunProgress, freshProfile, MAX_CREDITS, useCar } from './progression';
import { GhostRecorder } from './ghost';

function until(sim: Simulation, predicate: () => boolean, limit = 6000) {
  let ticks = 0;
  while (!predicate() && sim.phase === 'playing' && ticks++ < limit) sim.step(FIXED_STEP);
  expect(ticks).toBeLessThan(limit);
}

describe('ramp and ring rules', () => {
  it('climbs the deck, launches once without spending energy, and banks a ring on landing', () => {
    const sim = new Simulation(); sim.start('stunt'); sim.energy = 0;
    until(sim, () => sim.route!.riding !== null);
    expect(sim.height).toBeGreaterThan(0); expect(sim.height).toBeLessThan(RAMP_HEIGHT);
    expect(sim.airborne).toBe(false); expect(sim.jump()).toBe(false); expect(sim.rampPitch).toBeGreaterThan(0);
    until(sim, () => sim.route!.launched.size === 1);
    expect(sim.verticalSpeed).toBe(10); expect(sim.airborne).toBe(true);
    until(sim, () => sim.route!.pending === 1);
    expect(sim.banked).toBe(0); expect(sim.pendingLandingPoints).toBe(150);
    until(sim, () => !sim.airborne);
    expect(sim.route!.banked).toBe(1); expect(sim.banked).toBe(150); expect(sim.combo).toBe(2);
    expect(sim.takeEvents().filter(event => event.kind === 'ramp')).toHaveLength(1);
  });
  it('does not capture an adjacent or airborne car and releases a car that drives off the ramp edge', () => {
    const adjacent = new Simulation(); adjacent.start('stunt'); adjacent.lane = 0; adjacent.x = LANES[0];
    until(adjacent, () => adjacent.distance > 105); expect(adjacent.route!.launched.size).toBe(0); expect(adjacent.route!.rings[0]).toBe('missed');
    const airborne = new Simulation(); airborne.start('stunt'); airborne.distance = 69; airborne.height = 4;
    until(airborne, () => airborne.distance > 81); expect(airborne.route!.launched.size).toBe(0);
    const edge = new Simulation(); edge.start('stunt'); until(edge, () => edge.route!.riding !== null); edge.changeLane(1);
    until(edge, () => edge.distance > 85); expect(edge.route!.riding).toBeNull(); expect(edge.route!.launched.size).toBe(0);
  });
  it('checks the interpolated crossing point, not the end of a high-speed step, and counts each ring once', () => {
    const route = new StuntRoute(), before = {distance:99,x:LANES[1],height:3.02}, after = {distance:103,x:LANES[1],height:3.02};
    expect(route.cross(before,after)).toEqual([{id:0,hit:true}]); expect(route.cross(before,after)).toEqual([]);
    expect(crossingAt({distance:99,x:5,height:3}, {distance:101,x:LANES[1],height:3},100)!.x).toBe(1.625);
    const miss = new StuntRoute(); expect(miss.cross({distance:99,x:5,height:3}, {distance:101,x:LANES[1],height:3})).toEqual([{id:0,hit:false}]);
    const road = new StuntRoute(); expect(road.cross({...before,height:0},{...after,height:0})[0].hit).toBe(false);
  });
  it('drops pending ring points after a rough landing or crash, with no retroactive award', () => {
    const sim = new Simulation(); sim.start('stunt'); sim.route!.rings[0] = 'pending'; sim.height=.1; sim.verticalSpeed=-23;
    sim.step(FIXED_STEP); expect(sim.route!.rings[0]).toBe('lost'); expect(sim.banked).toBe(0); expect(sim.combo).toBe(1);
    sim.route!.rings[1]='pending'; sim.height=.1; sim.verticalSpeed=-8; sim.trick('flip'); sim.step(FIXED_STEP);
    expect(sim.phase).toBe('crashed'); expect(sim.route!.pending).toBe(0); expect(sim.banked).toBe(0);
  });
  it('freezes while paused, clears on retry, and completes without banking an airborne ring at the finish', () => {
    const sim = new Simulation(); sim.start('stunt'); until(sim,()=>sim.route!.pending===1); sim.pause();
    const frozen=JSON.stringify(sim); for(let i=0;i<30;i++)sim.step(FIXED_STEP); expect(JSON.stringify(sim)).toBe(frozen);
    sim.start('stunt'); expect(sim.route!.rings.every(state=>state==='ahead')).toBe(true); expect(sim.route!.launched.size).toBe(0);
    sim.distance=ROUTE_LENGTH-.1;sim.height=4;sim.route!.rings[7]='pending';sim.step(FIXED_STEP);
    expect(sim.phase).toBe('finished');expect(sim.route!.rings[7]).toBe('lost');expect(sim.pendingLandingPoints).toBe(0);
    const distance=sim.distance;sim.step(FIXED_STEP);expect(sim.distance).toBe(distance);
    expect(sim.takeEvents().filter(event=>event.kind==='finish')).toHaveLength(1);
  });
  it('allows all seven cars to bank all eight rings through steering and flight, with bounded energy', () => {
    for(const car of GARAGE_CARS) {
      const sim=new Simulation();sim.start('stunt',42,car.id);
      for(let tick=0;tick<6000&&sim.phase==='playing';tick++) {
        const next=sim.route!.next;
        if(next && next.lane!==sim.lane) sim.changeLane(next.lane>sim.lane?1:-1);
        let thrust=false;
        if(next&&sim.airborne&&sim.distance>=next.ramp) {
          const seconds=(next.ring-sim.distance)/sim.speed;
          const predicted=sim.height+sim.verticalSpeed*seconds-9.5*seconds*seconds+.78;
          thrust=predicted<next.height-.1;
        }
        sim.step(FIXED_STEP,{...NO_INPUT,thrust});
        expect(sim.energy).toBeGreaterThanOrEqual(0); expect(sim.energy).toBeLessThanOrEqual(100);
      }
      expect(sim.phase,car.name).toBe('finished');expect(sim.route!.banked,car.name).toBe(8);expect(sim.traffic).toHaveLength(0);
      expect(routeMedal(sim.route!.banked)).toBe('GOLD');
    }
  });
  it('keeps traffic, ordinary practice and highway ghost recording separate', () => {
    const sim=new Simulation();sim.start('run');expect(sim.route).toBeNull();expect(sim.traffic.length).toBeGreaterThan(0);
    sim.start('practice');until(sim,()=>sim.distance>120);expect(sim.route).toBeNull();expect(sim.traffic).toHaveLength(0);
    sim.start('stunt');const recorder=new GhostRecorder();recorder.start(sim);until(sim,()=>sim.phase==='finished');
    recorder.capture(sim);expect(recorder.finish(sim)).toBeNull();expect(ROUTE_STATIONS).toHaveLength(8);
  });
});

describe('stunt finish rewards and personal records', () => {
  it('pays completion and banked-ring credits once, preserving purchases and highway challenge progress', () => {
    const sim=new Simulation(),progress=new RunProgress();sim.start('stunt');const initial={...freshProfile(),credits:200,completed:2};progress.begin(sim,initial);
    const bought=useCar(initial,'rally').profile;sim.route!.rings.fill('banked');
    expect(progress.status(sim)).toBeNull();expect(progress.settle(bought,sim)).toBeNull();sim.phase='finished';
    const reward=progress.settle(bought,sim)!;expect(reward.earned).toBe(68);expect(reward.profile.credits).toBe(148);expect(reward.profile.completed).toBe(2);expect(reward.profile.selectedCar).toBe('rally');expect(progress.settle(reward.profile,sim)).toBeNull();
  });
  it('rejects aborted/crashed routes and respects the wallet cap', () => {
    const sim=new Simulation(),progress=new RunProgress(),profile=freshProfile();sim.start('stunt');progress.begin(sim,profile);sim.phase='crashed';expect(progress.settle(profile,sim)).toBeNull();
    sim.start('stunt');progress.begin(sim,profile);progress.cancel();sim.phase='finished';expect(progress.settle(profile,sim)).toBeNull();
    sim.start('stunt');const full={...profile,credits:MAX_CREDITS-2};progress.begin(sim,full);sim.phase='finished';expect(progress.settle(full,sim)!.earned).toBe(2);
  });
  it('validates separate per-car records and prefers higher scores, then faster equal scores', () => {
    const record={score:3400,rings:6,time:47.5};const raw={version:1,course:ROUTE_ID,records:{vector:record,unknown:record,apex:{...record,rings:99}}};
    expect(parseRouteRecords(JSON.stringify(raw))).toEqual({vector:record});expect(parseRouteRecords('bad')).toEqual({});expect(parseRouteRecords(JSON.stringify({...raw,course:'old'}))).toEqual({});
    expect(parseRouteRecords(JSON.stringify({...raw,records:{vector:{...record,time:null}}}))).toEqual({});
    expect(betterRoute({...record,score:3401},record)).toBe(true);expect(betterRoute({...record,time:46},record)).toBe(true);expect(betterRoute({...record,score:3000},record)).toBe(false);
    expect([0,4,6,8].map(routeMedal)).toEqual(['FINISHER','BRONZE','SILVER','GOLD']);
  });
});
