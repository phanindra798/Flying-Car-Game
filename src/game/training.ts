import type { Simulation } from './simulation';

export const LESSONS = ['steer', 'fly', 'stunt', 'land', 'boost'] as const;
export type Lesson = typeof LESSONS[number];

/** Observes real simulation progress; the lesson never changes physics or awards points. */
export class DrivingSchool {
  active = false;
  completed = false;
  index = 0;
  retry = false;
  private lastLane = 1;
  private laneChanges = 0;
  private heldTime = 0;
  private landedAtStart = 0;

  get lesson(): Lesson { return LESSONS[this.index]; }
  get progress() {
    if (this.completed) return 1;
    if (this.lesson === 'steer') return Math.min(1, this.laneChanges / 2);
    if (this.lesson === 'fly' || this.lesson === 'boost') return Math.min(1, this.heldTime / 0.6);
    return 0;
  }

  begin(sim: Simulation) {
    this.active = true; this.completed = false; this.index = 0; this.retry = false;
    this.lastLane = sim.lane; this.laneChanges = 0; this.heldTime = 0;
    this.landedAtStart = sim.tricksLanded;
  }

  end() { this.active = false; this.completed = false; this.index = 0; this.retry = false; this.heldTime = 0; }

  update(sim: Simulation, dt: number) {
    if (!this.active || this.completed || sim.phase !== 'playing') return;
    let passed = false;
    switch (this.lesson) {
      case 'steer':
        if (sim.lane !== this.lastLane) { this.laneChanges++; this.lastLane = sim.lane; }
        passed = this.laneChanges >= 2;
        break;
      case 'fly':
        this.heldTime = sim.thrustActive ? this.heldTime + dt : 0;
        passed = this.heldTime >= 0.6 && sim.height >= 3;
        break;
      case 'stunt':
        passed = sim.pendingTricks > 0;
        break;
      case 'land':
        passed = sim.tricksLanded > this.landedAtStart;
        if (!passed && !sim.airborne && sim.pendingTricks === 0) {
          this.index = 1; this.heldTime = 0; this.retry = true;
        }
        break;
      case 'boost':
        this.heldTime = sim.boostActive ? this.heldTime + dt : 0;
        passed = this.heldTime >= 0.6;
        break;
    }
    if (!passed) return;
    this.heldTime = 0; this.retry = false;
    if (this.index === LESSONS.length - 1) this.completed = true;
    else this.index++;
  }
}

export function lessonCopy(lesson: Lesson, touch: boolean) {
  const jump = touch ? 'JUMP' : 'SPACE';
  switch (lesson) {
    case 'steer': return { title: 'Find your lane.', detail: touch ? 'Swipe across the road twice, or tap ← / →.' : 'Press ← / → or A / D to change lanes twice.', controls: ['left', 'right'] };
    case 'fly': return { title: 'Hold to fly.', detail: `Hold ${jump} until you lift clear of the road.`, controls: ['jump'] };
    case 'stunt': return { title: 'Give it a flip.', detail: touch ? 'Keep holding JUMP. Tap FLIP with another finger.' : 'Keep holding SPACE. Press F for a front flip.', controls: ['jump', 'flip'] };
    case 'land': return { title: 'Touch down.', detail: `Release ${jump}. Let the car return to the road.`, controls: [] };
    case 'boost': return { title: 'A little faster.', detail: `Hold ${touch ? 'BOOST' : 'SHIFT'} to feel the extra speed.`, controls: ['boost'] };
  }
}
