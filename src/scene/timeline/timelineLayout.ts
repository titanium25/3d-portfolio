/**
 * Timeline gate positions along the Timeline Bridge.
 *
 * The bridge runs along the +Z axis from BRIDGE_NEAR_Z (arena bottom
 * face, ≈ 10.392) to BRIDGE_FAR_Z (≈ 24.392), a total of 14 units.
 *
 * The player spawns at the far end (high Z) and walks toward −Z to
 * reach the arena.  Gates are spaced along Z, oldest (2018) nearest
 * the spawn, newest (2024) nearest the arena.
 *
 * rotationY = 0 → portal model faces along Z (pillars span X axis),
 * so the player walks straight through each arch without turning.
 */

/* ── Bridge constants (must stay in sync with createSpawnPad) ─── */

const ARENA_APOTHEM  = 12 * Math.cos(Math.PI / 6); // ≈ 10.392
const BRIDGE_LENGTH  = 14;
const BRIDGE_NEAR_Z  = ARENA_APOTHEM;               // ≈ 10.392  (arena side)
const BRIDGE_FAR_Z   = BRIDGE_NEAR_Z + BRIDGE_LENGTH; // ≈ 24.392 (spawn side)
const BRIDGE_WIDTH   = ARENA_APOTHEM * 2 * 0.30;   // ≈ 6.235

/** Padding beyond first/last gate on each end of the road strip. */
const ROAD_PADDING = 1.5;

const GROUND_Y = 0.15;

/** Legacy export kept for API compatibility (road is now straight). */
export const ROAD_ARC = {
  radius: 0,
  startAngle: 0,
  endAngle: 0,
} as const;

export interface TimelinePlacement {
  position: [number, number, number];
  /** rotationY = 0 → gate opening faces ±Z, player walks through along Z */
  rotationY: number;
}

export function buildTimelinePositions(
  count: number = 4,
): TimelinePlacement[] {
  const placements: TimelinePlacement[] = [];

  // Usable span inside the bridge, padded from each end
  const spanFar  = BRIDGE_FAR_Z  - ROAD_PADDING; // near spawn (oldest)
  const spanNear = BRIDGE_NEAR_Z + ROAD_PADDING;  // near arena (newest)

  for (let i = 0; i < count; i++) {
    const t = count > 1 ? i / (count - 1) : 0.5;
    // i=0 → oldest (2018) near spawn (far Z); i=last → newest near arena (near Z)
    const worldZ = spanFar - (spanFar - spanNear) * t;

    placements.push({
      position: [0, GROUND_Y, worldZ],
      // rotationY = 0: portal pillars span X, opening faces ±Z
      // Player walks along −Z through the arch — correct orientation.
      rotationY: 0,
    });
  }

  return placements;
}

/** Sample evenly-spaced points along the straight bridge road strip. */
export function sampleRoadCurve(
  segments: number,
): { x: number; z: number }[] {
  const startZ = BRIDGE_FAR_Z  + ROAD_PADDING * 0.5;
  const endZ   = BRIDGE_NEAR_Z - ROAD_PADDING * 0.5;
  const points: { x: number; z: number }[] = [];

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    points.push({ x: 0, z: startZ + (endZ - startZ) * t });
  }

  return points;
}

/** Half-width of the bridge road strip. */
export const BRIDGE_ROAD_HALF_WIDTH = BRIDGE_WIDTH / 2;
