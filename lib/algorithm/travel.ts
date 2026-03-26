import type { CandidateSession, TravelEntry } from "./types";

export function buildTravelMatrix(entries: TravelEntry[]): Map<string, number> {
  const matrix = new Map<string, number>();
  for (const entry of entries) {
    matrix.set(
      `${entry.originZone}|${entry.destinationZone}`,
      entry.drivingMinutes
    );
  }
  return matrix;
}

export function getRequiredGap(
  zone1: string,
  zone2: string,
  matrix: Map<string, number>
): number {
  if (zone1 === zone2) return 90;

  if (zone1 === "Trestles Beach Zone" || zone2 === "Trestles Beach Zone") {
    return 240;
  }

  const driving = matrix.get(`${zone1}|${zone2}`);
  if (driving === undefined) return 210;

  if (driving < 15) return 90;
  if (driving < 30) return 120;
  if (driving < 45) return 150;
  if (driving < 60) return 180;
  return 210;
}

export function timeToMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(":").map(Number);
  const total = hours * 60 + minutes;
  // Treat 00:00 as midnight (end of day)
  return total === 0 ? 24 * 60 : total;
}

export function isTravelFeasible(
  sessions: CandidateSession[],
  matrix: Map<string, number>
): boolean {
  if (sessions.length <= 1) return true;

  const sorted = [...sessions].sort(
    (a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime)
  );

  for (let i = 0; i < sorted.length - 1; i++) {
    const current = sorted[i];
    const next = sorted[i + 1];
    const gap = timeToMinutes(next.startTime) - timeToMinutes(current.endTime);
    const requiredGap = getRequiredGap(current.zone, next.zone, matrix);

    if (gap < requiredGap) return false;
  }

  return true;
}
