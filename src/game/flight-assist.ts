import type { Simulation } from './simulation';

export function flightAssist(sim: Simulation, slam: boolean) {
  const timeToRoad = (sim.verticalSpeed + Math.sqrt(sim.verticalSpeed ** 2 + 38 * Math.max(0, sim.height))) / 19;
  const hardSlam = slam && Math.sqrt(sim.verticalSpeed ** 2 + 108 * sim.height) >= 20;
  const fallingHard = sim.verticalSpeed < 0 && Math.sqrt(sim.verticalSpeed ** 2 + 38 * sim.height) >= 20;
  if (hardSlam || fallingHard) return { tone: 'warning', label: 'HARD DESCENT',
    hint: slam ? 'Release SLAM to soften the landing' : 'Hold flight to slow the drop', color: 0xff9b75 } as const;
  if (sim.stuntRemaining > 0) {
    const low = sim.stuntRemaining > timeToRoad;
    return { tone: low ? 'warning' : 'rotating', label: low ? 'MORE AIRTIME' : 'ROTATING',
      hint: low ? 'Hold flight to finish the rotation' : 'Finish the rotation before touchdown', color: low ? 0xff9b75 : 0xffd684 } as const;
  }
  if (sim.pendingTricks > 0) return { tone: 'ready', label: `${sim.pendingLandingPoints.toLocaleString('en-US')} TO BANK`,
    hint: 'Release flight for a natural landing', color: 0xd6ff78 } as const;
  return { tone: 'neutral', label: 'AIRBORNE', hint: 'Try a flip or roll while you have height', color: 0xe5f0e8 } as const;
}
