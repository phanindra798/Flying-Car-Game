import { LANES, VEHICLES, type HeldInput, type Simulation } from './simulation';
import { carBounds } from './collision';
export interface TrafficThreat { id: number; lane: number; gap: number; seconds: number; urgent: boolean }

/** Advisory for current/selected lane under held input. It is not an avoidance controller. */
export function trafficThreat(sim: Simulation, input: HeldInput): TrafficThreat | null {
  if (sim.phase !== 'playing' || sim.mode !== 'run') return null;
  const bounds = carBounds(sim);
  let nearest: TrafficThreat | null = null;
  for (const vehicle of sim.traffic) {
    const dimensions = VEHICLES[vehicle.kind];
    if (vehicle.distance < sim.distance - dimensions.length / 2) continue;
    if (vehicle.lane !== sim.lane && Math.abs(LANES[vehicle.lane] - sim.x) > dimensions.width / 2 + bounds[0]) continue;
    const closing = sim.speed - vehicle.speed;
    if (closing <= 0) continue;
    const gap = Math.max(0, vehicle.distance - sim.distance - dimensions.length / 2 - bounds[2]);
    const seconds = gap / closing;
    if (seconds > 3 || (nearest && seconds >= nearest.seconds)) continue;
    if (sim.airborne) {
      const thrust = input.thrust && sim.energy > 0 && !input.slam;
      const acceleration = -19 + (thrust ? sim.tuning.lift : 0) - (input.slam ? 35 : 0);
      const projectedHeight = Math.max(0, Math.min(9, sim.height + sim.verticalSpeed * seconds + acceleration * seconds * seconds / 2));
      if (projectedHeight + 0.78 - bounds[1] > dimensions.height + 0.25) continue;
    }
    nearest = { id: vehicle.id, lane: vehicle.lane, gap, seconds, urgent: seconds < 1.25 };
  }
  return nearest;
}
