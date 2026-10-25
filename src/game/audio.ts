import type { GameEvent, Simulation } from './simulation';

export function engineMix(sim: Simulation) {
  const playing = sim.phase === 'playing';
  return { frequency: 38 + sim.speed * 1.35 + (sim.boostActive ? 16 : 0),
    cutoff: 180 + sim.speed * 5 + (sim.boostActive ? 180 : 0),
    engine: playing ? (sim.airborne ? 0.055 : 0.085) : 0,
    jet: playing ? sim.thrustActive ? 0.12 : sim.boostActive ? 0.09 : 0 : 0 };
}

export class GameAudio {
  muted = false;
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private motor: GainNode | null = null;
  private jet: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private engine: OscillatorNode | null = null;
  private bass: OscillatorNode | null = null;
  private noise: AudioBuffer | null = null;
  private readonly targets = new Map<AudioParam, number>();
  private voices = 0;
  private lastCue: string | null = null;

  async start() {
    try {
      if (!this.context) {
        const ctx = new AudioContext(); this.context = ctx;
        this.master = ctx.createGain(); this.master.gain.value = 0;
        const compressor = ctx.createDynamicsCompressor(); compressor.threshold.value = -18; compressor.ratio.value = 4;
        this.master.connect(compressor); compressor.connect(ctx.destination);
        this.motor = ctx.createGain(); this.motor.gain.value = 0;
        this.filter = ctx.createBiquadFilter(); this.filter.type = 'lowpass'; this.filter.frequency.value = 250;
        this.engine = ctx.createOscillator(); this.engine.type = 'sawtooth';
        this.bass = ctx.createOscillator(); this.bass.type = 'triangle';
        this.engine.connect(this.filter); this.bass.connect(this.filter);
        this.filter.connect(this.motor); this.motor.connect(this.master);
        this.engine.start(); this.bass.start();
        this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
        const data = this.noise.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        const stream = ctx.createBufferSource(); stream.buffer = this.noise; stream.loop = true;
        const airFilter = ctx.createBiquadFilter(); airFilter.type = 'bandpass'; airFilter.frequency.value = 1100; airFilter.Q.value = 0.6;
        this.jet = ctx.createGain(); this.jet.gain.value = 0;
        stream.connect(airFilter); airFilter.connect(this.jet); this.jet.connect(this.master); stream.start();
      }
      await this.context.resume();
    } catch { /* Audio remains optional on devices that cannot start it. */ }
  }

  private target(parameter: AudioParam, value: number, seconds: number) {
    if (!this.context || this.targets.get(parameter) === value) return;
    const now = this.context.currentTime;
    parameter.cancelAndHoldAtTime(now);
    parameter.setTargetAtTime(value, now, seconds);
    this.targets.set(parameter, value);
  }

  silence() {
    if (!this.context || !this.master) return;
    this.target(this.master.gain, 0, 0.01);
  }

  update(sim: Simulation) {
    if (!this.context || !this.master || !this.motor || !this.engine || !this.bass || !this.filter || !this.jet) return;
    const mix = engineMix(sim);
    this.target(this.engine.frequency, mix.frequency, 0.12);
    this.target(this.bass.frequency, mix.frequency / 2, 0.12);
    this.target(this.filter.frequency, mix.cutoff, 0.12);
    this.target(this.motor.gain, mix.engine, 0.06);
    this.target(this.jet.gain, mix.jet, 0.045);
    const silent = this.muted || sim.phase === 'paused' || sim.phase === 'ready' || document.hidden;
    this.target(this.master.gain, silent ? 0 : 0.4, 0.015);
  }

  private tone(frequency: number, end: number, duration: number, delay = 0, noise = false) {
    if (!this.context || !this.master || this.voices >= 8) return;
    const ctx = this.context, gain = ctx.createGain(), now = ctx.currentTime + delay;
    const source = noise ? ctx.createBufferSource() : ctx.createOscillator();
    if (source instanceof OscillatorNode) {
      source.type = 'triangle'; source.frequency.setValueAtTime(frequency, now);
      source.frequency.exponentialRampToValueAtTime(end, now + duration);
    } else source.buffer = this.noise;
    const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = noise ? 900 : 2000;
    gain.gain.setValueAtTime(0, ctx.currentTime); gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(noise ? 0.25 : 0.12, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    source.connect(filter); filter.connect(gain); gain.connect(this.master);
    this.voices++; source.start(now); source.stop(now + duration + 0.02);
    source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); this.voices--; };
  }

  cue(event: GameEvent) {
    if (!this.context || this.context.state !== 'running' || this.muted || document.hidden) return;
    this.lastCue = event.landing?.quality ?? event.kind;
    if (event.kind === 'crash') { this.tone(95, 32, 0.34); this.tone(1, 1, 0.26, 0, true); }
    else if (event.landing) {
      if (event.landing.quality === 'clean') { this.tone(520, 620, 0.18); this.tone(780, 940, 0.22, 0.09); }
      else { this.tone(event.landing.quality === 'plain' ? 130 : 85, 45, 0.16); }
    } else {
      const notes = { jump: [170, 380], trick: [430, 620], near: [350, 500] };
      const note = notes[event.kind as keyof typeof notes];
      if (note) this.tone(note[0], note[1], 0.16);
    }
  }
  inspect() { return { state: this.context?.state ?? 'unavailable', time: this.context?.currentTime ?? 0, muted: this.muted, voices: this.voices, lastCue: this.lastCue,
    master: this.master?.gain.value ?? 0, engine: this.motor?.gain.value ?? 0, jet: this.jet?.gain.value ?? 0 }; }
}
