import { describe, expect, it } from 'vitest';
import { Box3, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import { GARAGE_CARS, getCar, type CarId } from './garage-cars';
import { freshProfile, parseProfile, useCar, usePaint, RunProgress } from './progression';
import { FIXED_STEP, LANES, Simulation } from './simulation';
import { createPlayerVehicle } from './player-vehicle';
import { GhostRecorder, GHOST_COURSE, parseGhost } from './ghost';
const drive = (id: CarId) => { const sim = new Simulation(); sim.start('practice', 42, id); return sim; };

describe('vehicle ownership and save migration', () => {
  it('migrates v1 credits, challenge progress and paints with the pickup as the free starter', () => {
    const old = { version: 1, credits: 700, completed: 3, owned: ['ivory','ember'], equipped: 'ember' };
    expect(parseProfile(JSON.stringify(old))).toEqual({ ...old, version: 2, cars: ['vector'], selectedCar: 'vector' });
  });
  it('repairs unowned/unknown car selections without discarding a valid wallet', () => {
    const raw = { ...freshProfile(), credits: 500, cars: ['rally','rally','unknown'], selectedCar: 'aero' };
    const loaded = parseProfile(JSON.stringify(raw));
    expect(loaded.cars).toEqual(['vector','rally']); expect(loaded.selectedCar).toBe('vector'); expect(loaded.credits).toBe(500);
    expect(parseProfile(JSON.stringify({ ...raw, cars: 'bad' })).cars).toEqual(['vector']);
    expect(parseProfile(JSON.stringify({ ...raw, cars: Array(65).fill('apex') })).cars).toEqual(['vector']);
  });
  it('shares credits with paints, charges once, round-trips purchases and rejects invalid/unaffordable cars', () => {
    const base = { ...freshProfile(), credits: 195 }, before = JSON.stringify(base);
    const bought = useCar(base, 'rally'); expect(bought.outcome).toBe('unlocked'); expect(bought.profile.credits).toBe(75);
    expect(useCar(bought.profile,'rally').profile).toEqual(bought.profile);
    const painted = usePaint(bought.profile,'ember').profile; expect(painted.credits).toBe(0); expect(painted.selectedCar).toBe('rally');
    expect(parseProfile(JSON.stringify(painted))).toEqual(painted);
    expect(useCar(painted,'apex').outcome).toBe('insufficient'); expect(useCar(painted,'__proto__').outcome).toBe('invalid');
    expect(JSON.stringify(base)).toBe(before);
  });
  it('keeps a run tuning snapshot while purchasing another car and preserves the purchase at settlement', () => {
    const sim = new Simulation(), progress = new RunProgress(); sim.start('run',42,'vector');
    const profile = { ...freshProfile(), credits: 150 }; progress.begin(sim,profile);
    const bought = useCar(profile,'rally').profile; expect(sim.carId).toBe('vector');
    sim.distance=200; sim.phase='crashed'; const reward=progress.settle(bought,sim)!;
    expect(reward.profile.selectedCar).toBe('rally'); expect(reward.profile.credits).toBe(40);
    sim.start('run',42,reward.profile.selectedCar); expect(sim.carId).toBe('rally'); expect(sim.speed).toBe(22);
  });
});

describe('car performance and rendering', () => {
  it('makes speed, lane response and jump height observably different', () => {
    const vector=drive('vector'), apex=drive('apex'), rally=drive('rally'), heavy=drive('muscle');
    for (const sim of [vector,apex,rally,heavy]) { sim.changeLane(1); for(let i=0;i<12;i++) sim.step(FIXED_STEP,{boost:true,thrust:false,slam:false}); }
    expect(apex.distance).toBeGreaterThan(vector.distance); expect(apex.speed).toBeGreaterThan(vector.speed);
    expect(Math.abs(rally.x-LANES[2])).toBeLessThan(Math.abs(heavy.x-LANES[2]));
    const heights = (id:CarId) => { const sim=drive(id); sim.jump(); let height=0; for(let i=0;i<120;i++){ sim.step(FIXED_STEP); height=Math.max(height,sim.height); } return height; };
    expect(heights('dune')).toBeGreaterThan(heights('vector')); expect(heights('apex')).toBeLessThan(heights('vector'));
  });
  it('gives Aero longer powered flight, Retro cheaper boost, and every car bounded energy and safe clean stunts', () => {
    const aero=drive('aero'), apex=drive('apex');
    for(const sim of [aero,apex]) { sim.jump(); for(let i=0;i<120;i++) sim.step(FIXED_STEP,{thrust:true,boost:false,slam:false}); }
    expect(aero.energy).toBeGreaterThan(apex.energy + 25);
    const retro=drive('retro'), muscle=drive('muscle');
    for(const sim of [retro,muscle]) for(let i=0;i<120;i++) sim.step(FIXED_STEP,{thrust:false,boost:true,slam:false});
    expect(retro.energy).toBeGreaterThan(muscle.energy);
    for(const car of GARAGE_CARS) {
      const sim=drive(car.id); sim.jump();
      for(let i=0;i<600;i++) { if(i===18) sim.trick('flip'); sim.step(FIXED_STEP,{thrust:i<66,boost:false,slam:false}); expect(sim.energy).toBeGreaterThanOrEqual(0); expect(sim.energy).toBeLessThanOrEqual(100); expect(sim.height).toBeLessThanOrEqual(9); }
      expect(sim.tricksLanded,car.name).toBe(1); expect(sim.height).toBe(0);
    }
  });
  it('builds seven distinct bounded models, all sharing the live paint material and jet mounting envelope', () => {
    const shapes=new Set<string>(), paint=new MeshStandardMaterial();
    for(const car of GARAGE_CARS) {
      const model=createPlayerVehicle(paint,car.id), size=new Box3().setFromObject(model).getSize(new Vector3());
      expect(size.x,car.name).toBeLessThanOrEqual(2); expect(size.y,car.name).toBeLessThanOrEqual(1.53); expect(size.z,car.name).toBeLessThanOrEqual(4.21);
      expect(model.children.length).toBeLessThanOrEqual(6);
      const body=model.children.find(part=>part instanceof Mesh && part.material===paint) as Mesh;
      expect(body).toBeDefined(); shapes.add(JSON.stringify(Array.from(body.geometry.attributes.position.array)));
    }
    expect(shapes.size).toBe(7);
  });
  it('records each car identity and validates faster replays while keeping legacy pickup ghosts readable', () => {
    for(const car of GARAGE_CARS) {
      const sim=new Simulation(), recorder=new GhostRecorder(); sim.start('run',42,car.id); recorder.start(sim);
      while(sim.phase==='playing') { sim.step(FIXED_STEP,{boost:true,thrust:false,slam:false}); recorder.capture(sim); }
      const run=recorder.finish(sim)!; expect(run.carId).toBe(car.id); expect(parseGhost(JSON.stringify(run))).toEqual(run);
    }
    const legacy={version:1,course:GHOST_COURSE,frames:Array.from({length:21},(_,i)=>[i/10,i*2.3,-1.75,0,0,0])};
    expect(parseGhost(JSON.stringify(legacy))).toEqual(legacy);
    expect(parseGhost(JSON.stringify({...legacy,carId:'unknown'}))).toBeNull();
    const fast={...legacy,carId:'apex',frames:legacy.frames.map(frame=>[frame[0],frame[0]*58,...frame.slice(2)])};
    expect(parseGhost(JSON.stringify(fast))).not.toBeNull();
    expect(getCar('vector').cruise).toBe(23);
  });
});
