import { describe, expect, it } from 'vitest';
import { Scene } from 'three';
import { GameEffects } from './effects';
import { Simulation, type GameEvent } from './simulation';
import { DEFAULT_SETTINGS, graphicsProfile, parseSettings } from './settings';
import { engineMix } from './audio';
const landing = (quality: 'clean' | 'rough'): GameEvent => ({ kind: 'landing', title: '', detail: '', landing: { quality, points: 0, tricks: 0 } });

describe('graphics preferences', () => {
  it('recovers malformed preferences without accepting unknown quality or truthy strings', () => {
    for (const raw of [null, '{bad', 'null', '{}', 'x'.repeat(1001)]) expect(parseSettings(raw)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('{"quality":"ultra","showFps":"yes","reducedEffects":1}')).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('{"quality":"performance","showFps":true,"reducedEffects":true}')).toEqual({ quality: 'performance', showFps: true, reducedEffects: true });
  });
  it('caps phone resolution by quality without rendering above the screen density', () => {
    expect(graphicsProfile(DEFAULT_SETTINGS, true, false, 3).pixelRatio).toBe(1.25);
    expect(graphicsProfile({ ...DEFAULT_SETTINGS, quality: 'performance' }, true, false, 3).pixelRatio).toBe(1);
    expect(graphicsProfile({ ...DEFAULT_SETTINGS, quality: 'quality' }, true, false, 3).pixelRatio).toBe(1.75);
    expect(graphicsProfile({ ...DEFAULT_SETTINGS, quality: 'quality' }, false, false, 1).pixelRatio).toBe(1);
  });
  it('respects either system reduced motion or the in-game choice at every quality', () => {
    for (const quality of ['performance', 'balanced', 'quality'] as const) {
      for (const [user, system] of [[true, false], [false, true], [true, true]]) {
        const profile = graphicsProfile({ ...DEFAULT_SETTINGS, quality, reducedEffects: user }, true, system, 3);
        expect(profile.reduceMotion).toBe(true); expect(profile.particleLimit).toBe(0);
      }
    }
  });
});

describe('bounded visual feedback', () => {
  it('stays within each pool budget under continuous boost without altering gameplay state', () => {
    const effects = new GameEffects(new Scene()), sim = new Simulation(); sim.start('practice'); sim.boostActive = true;
    const before = JSON.stringify(sim);
    for (const limit of [24, 48, 80]) {
      effects.configure(limit);
      for (let i = 0; i < 120 * 60; i++) effects.update(sim, 1 / 60);
      expect(effects.inspect().count).toBeGreaterThan(0); expect(effects.inspect().count).toBeLessThanOrEqual(limit);
    }
    expect(JSON.stringify(sim)).toBe(before);
  });
  it('freezes on pause, expires after release, and clears on reset', () => {
    const effects = new GameEffects(new Scene()), sim = new Simulation(); sim.start('practice'); sim.boostActive = true;
    for (let i = 0; i < 10; i++) effects.update(sim, 1 / 60);
    sim.pause(); const paused = effects.inspect(); effects.update(sim, 1); expect(effects.inspect()).toEqual(paused);
    sim.pause(); sim.boostActive = false;
    for (let i = 0; i < 30; i++) effects.update(sim, 1 / 60);
    expect(effects.inspect().count).toBe(0);
    effects.onEvent(landing('clean'), sim); effects.update(sim, 1 / 60); expect(effects.inspect().count).toBeGreaterThan(0);
    effects.clear(); expect(effects.inspect().count).toBe(0); expect(effects.inspect().lastBurst).toBeNull();
  });
  it('shows landing/crash feedback and removes all particles immediately when reduced', () => {
    const effects = new GameEffects(new Scene()), sim = new Simulation(); sim.start('practice');
    for (const event of [landing('clean'), landing('rough'), { kind: 'crash', title: '', detail: '' } as GameEvent]) {
      effects.clear(); effects.onEvent(event, sim); effects.update(sim, 1 / 60);
      expect(effects.inspect().lastBurst).toBe(event.landing?.quality ?? 'crash'); expect(effects.inspect().count).toBeGreaterThan(0);
    }
    effects.configure(0); sim.boostActive = true; effects.onEvent(landing('clean'), sim); effects.update(sim, 0.1);
    expect(effects.inspect().count).toBe(0); expect(effects.mesh.visible).toBe(false);
  });
});

describe('engine and thruster mix', () => {
  it('responds to speed, boost and powered flight', () => {
    const sim = new Simulation(); sim.start('practice'); const normal = engineMix(sim);
    sim.speed = 38; sim.boostActive = true; const boost = engineMix(sim);
    expect(boost.frequency).toBeGreaterThan(normal.frequency); expect(boost.cutoff).toBeGreaterThan(normal.cutoff); expect(boost.jet).toBeGreaterThan(0);
    sim.height = 2; sim.thrustActive = true; expect(engineMix(sim).jet).toBeGreaterThan(boost.jet); expect(engineMix(sim).engine).toBeLessThan(normal.engine);
    sim.thrustActive = false; sim.boostActive = false; expect(engineMix(sim).jet).toBe(0);
  });
  it('removes continuous driving sound in all inactive phases', () => {
    const sim = new Simulation(); sim.start(); sim.boostActive = true; sim.thrustActive = true;
    for (const phase of ['paused', 'ready', 'crashed'] as const) { sim.phase = phase; expect(engineMix(sim).engine).toBe(0); expect(engineMix(sim).jet).toBe(0); }
  });
});
