/**
 * Timeline gate positions along a circular arc near the platform edge.
 *
 * Gates sit at radius ARC_RADIUS from the platform center, sweeping
 * from the back-right toward the front-right of the hex.  Walking
 * along the arc = moving forward in time (2018 → 2024).
 *
 * The road strip follows the same arc with a bit of angular padding
 * on each end so the road extends past the first and last gate.
 */

const ARC_RADIUS = 8;
const ARC_START_DEG = -30;
const ARC_END_DEG = 70;
const ROAD_PADDING_DEG = 15;
const GROUND_Y = 0.15;

const DEG2RAD = Math.PI / 180;

/** Road arc parameters (used by createGround to build the curved road). */
export const ROAD_ARC = {
  radius: ARC_RADIUS,
  startAngle: (ARC_START_DEG - ROAD_PADDING_DEG) * DEG2RAD,
  endAngle: (ARC_END_DEG + ROAD_PADDING_DEG) * DEG2RAD,
} as const;

export interface TimelinePlacement {
  position: [number, number, number];
  /** Rotation Y in radians — gate faces tangent along the road arc */
  rotationY: number;
}

export function buildTimelinePositions(
  count: number = 4,
): TimelinePlacement[] {
  const placements: TimelinePlacement[] = [];
  const startRad = ARC_START_DEG * DEG2RAD;
  const endRad = ARC_END_DEG * DEG2RAD;

  for (let i = 0; i < count; i++) {
    const t = count > 1 ? i / (count - 1) : 0;
    const angle = startRad + (endRad - startRad) * t;
    // Tangent along arc (increasing angle): (-sin(θ), -cos(θ))
    const tx = -Math.sin(angle);
    const tz = -Math.cos(angle);
    // rotation.y so gate faces the road (tangent direction)
    placements.push({
      position: [
        Math.cos(angle) * ARC_RADIUS,
        GROUND_Y,
        -Math.sin(angle) * ARC_RADIUS,
      ],
      rotationY: Math.atan2(tx, tz),
    });
  }

  return placements;
}

/** Sample evenly-spaced points along the road arc (for building road geometry). */
export function sampleRoadCurve(
  segments: number,
): { x: number; z: number }[] {
  const { startAngle, endAngle, radius } = ROAD_ARC;
  const points: { x: number; z: number }[] = [];

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const angle = startAngle + (endAngle - startAngle) * t;
    points.push({
      x: Math.cos(angle) * radius,
      z: -Math.sin(angle) * radius,
    });
  }

  return points;
}
