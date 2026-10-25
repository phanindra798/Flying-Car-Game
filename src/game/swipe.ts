/** One deliberate horizontal swipe changes one lane; a second finger cannot take it over. */
export class SwipeSteering {
  private gesture: { id: number; x: number; y: number; time: number; consumed: boolean } | null = null;

  begin(id: number, x: number, y: number, time: number) {
    if (this.gesture) return false;
    this.gesture = { id, x, y, time, consumed: false };
    return true;
  }

  move(id: number, x: number, y: number, time: number): -1 | 1 | null {
    const gesture = this.gesture;
    if (!gesture || gesture.id !== id || gesture.consumed) return null;
    const dx = x - gesture.x, dy = y - gesture.y;
    if (time - gesture.time > 650 || (Math.abs(dy) > 24 && Math.abs(dy) > Math.abs(dx))) {
      gesture.consumed = true;
      return null;
    }
    if (Math.abs(dx) < 34 || Math.abs(dx) < Math.abs(dy) * 1.4) return null;
    gesture.consumed = true;
    return dx < 0 ? -1 : 1;
  }

  end(id: number) { if (this.gesture?.id === id) this.gesture = null; }
  reset() { this.gesture = null; }
}
