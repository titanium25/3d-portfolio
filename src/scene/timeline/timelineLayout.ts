/**
 * Positions for timeline gates along the road strip (Z-axis).
 *
 * 2018 starts at positive Z (near camera start) and progresses
 * toward negative Z (forward from the player's perspective),
 * ending at 2025 — walking forward = moving forward in time.
 */

const Z_START = 8.0;
const Z_END = -8.0;

const X_OFFSETS = [0.6, -0.6, 0.4, -0.4, 0.2, -0.2];

/**
 * Ground-surface offset — the platform body bevel raises the visible floor
 * above y=0.  This matches the offset used by the character system so that
 * checkpoint bases sit flush with the walkable surface.
 */
const GROUND_Y = 0.15;

export function buildTimelinePositions(
  count: number = 6,
): [number, number, number][] {
  const positions: [number, number, number][] = [];

  for (let i = 0; i < count; i++) {
    const t = count > 1 ? i / (count - 1) : 0;
    const z = Z_START + (Z_END - Z_START) * t;
    const x = X_OFFSETS[i % X_OFFSETS.length];
    positions.push([x, GROUND_Y, z]);
  }

  return positions;
}
