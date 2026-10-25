export const TRAFFIC_SPEED = 11;
export const MIN_ROW_SPACING = 118;
export interface TrafficRow { distance: number; openLanes: [number, number]; blockedLanes: number[] }

/** Rows share a moving road coordinate so new rows retain their spacing after spawning. */
export class TrafficDirector {
  nextDistance = 240;
  private pair = 1;
  private state: number;
  constructor(seed = 42) { this.state = seed >>> 0; }
  next(): TrafficRow {
    this.pair = Math.max(0, Math.min(2, this.pair + Math.floor(this.random() * 3) - 1));
    const row: TrafficRow = { distance: this.nextDistance, openLanes: [this.pair, this.pair + 1],
      blockedLanes: [0, 1, 2, 3].filter(lane => lane < this.pair || lane > this.pair + 1) };
    this.nextDistance += MIN_ROW_SPACING + this.random() * 25;
    return row;
  }
  private random() { this.state = (Math.imul(1664525, this.state) + 1013904223) >>> 0; return this.state / 4294967296; }
}
