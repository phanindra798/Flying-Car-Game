import type { GameEvent, Simulation } from './simulation';

// One simple engine oscillator and short arcade cues. Audio is optional.
export class GameAudio {
  muted = false;
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private motor: GainNode | null = null;
  private engine: OscillatorNode | null = null;
  private voices = 0;
  private targets = new Map<AudioParam, number>();

  async start() {
    try {
      if (!this.context) {
        const ctx = new AudioContext(); this.context = ctx;
        this.master = ctx.createGain(); this.master.gain.value = 0; this.master.connect(ctx.destination);
        this.motor = ctx.createGain(); this.motor.gain.value = 0; this.motor.connect(this.master);
        this.engine = ctx.createOscillator(); this.engine.type = 'triangle';
        this.engine.connect(this.motor); this.engine.start();
      }
      await this.context.resume();
    } catch { /* Unsupported or blocked audio never prevents play. */ }
  }
  private target(parameter: AudioParam, value: number) {
    if (!this.context || this.targets.get(parameter) === value) return;
    parameter.cancelAndHoldAtTime(this.context.currentTime);
    parameter.setTargetAtTime(value, this.context.currentTime, 0.03);
    this.targets.set(parameter, value);
  }
  silence() { if (this.master) this.target(this.master.gain, 0); }
  update(sim: Simulation) {
    if (!this.master || !this.motor || !this.engine) return;
    this.target(this.engine.frequency, 40 + sim.speed * 1.6 + (sim.thrustActive ? 30 : 0));
    this.target(this.motor.gain, sim.phase === 'playing' ? 0.06 : 0);
    this.target(this.master.gain, this.muted || document.hidden || sim.phase === 'ready' || sim.phase === 'paused' ? 0 : 0.4);
  }
  cue(event: GameEvent) {
    if (!this.context || !this.master || this.context.state !== 'running' || this.muted || document.hidden || this.voices >= 4) return;
    const ctx = this.context, oscillator = ctx.createOscillator(), gain = ctx.createGain(), now = ctx.currentTime;
    const frequency = { jump: 220, trick: 620, landing: 440, near: 520, crash: 95 }[event.kind];
    oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(event.kind === 'crash' ? 35 : frequency * 1.2, now + 0.18);
    gain.gain.setValueAtTime(0.08, now); gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
    oscillator.connect(gain); gain.connect(this.master); this.voices++;
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); this.voices--; };
    oscillator.start(now); oscillator.stop(now + 0.22);
  }
}
