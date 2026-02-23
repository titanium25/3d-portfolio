/**
 * Shared proximity factor calculation for stop lighting.
 * Used by createStops and createTimelineStops.
 */

import { PROXIMITY_RADIUS, INTERACT_RADIUS } from "./checkCollisions";

/**
 * Computes a 0..1 proximity factor from player distance.
 * Closer = higher. Optional power curve ramps up sooner (e.g. 0.6).
 */
export function computeProximityFactor(
  distance: number,
  proximityRadius: number = PROXIMITY_RADIUS,
  interactRadius: number = INTERACT_RADIUS,
  powerCurve: number = 1,
): number {
  if (distance >= proximityRadius) return 0;
  let t =
    1 - (distance - interactRadius) / (proximityRadius - interactRadius);
  t = Math.max(0, Math.min(1, t));
  return powerCurve !== 1 ? Math.pow(t, powerCurve) : t;
}
