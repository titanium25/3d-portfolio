/**
 * Shared layout constants for arena, bridge, spawn pad, bounds, and timeline.
 * Single source of truth — do not duplicate in createGround, createSpawnPad, bounds, timelineLayout.
 */

/** Gate pad footprint width (X span) — from portal at MODEL_TARGET_HEIGHT ≈ 1.8. */
export const GATE_PAD_WIDTH = 3.2;

/** Bridge width: a little bit wider than gates. */
export const BRIDGE_WIDTH = GATE_PAD_WIDTH + 1.0;

/** Arena hex circumradius (must match createGround SIZE). */
export const ARENA_SIZE = 12;

/** Flat-top hex sides. */
export const ARENA_SIDES = 6;

/** Apothem of the main arena hex (centre → flat-face midpoint). ≈ 10.392 */
export const ARENA_APOTHEM = ARENA_SIZE * Math.cos(Math.PI / 6);

/** Bridge length along Z axis. */
export const BRIDGE_LENGTH = 28;

/** Bridge Z at arena end. ≈ 10.392 */
export const BRIDGE_NEAR_Z = ARENA_APOTHEM;

/** Bridge Z at spawn end. ≈ 24.392 */
export const BRIDGE_FAR_Z = BRIDGE_NEAR_Z + BRIDGE_LENGTH;

/** Bridge half-width for X bounds. */
export const BRIDGE_HALF_WIDTH = BRIDGE_WIDTH / 2;

/** Spawn pad apothem (flat face = 0.95 × bridge width). */
export const SPAWN_APOTHEM = BRIDGE_WIDTH * 0.95;

/** Spawn pad hex circumradius. */
export const SPAWN_SIZE = SPAWN_APOTHEM / Math.cos(Math.PI / 6);

/** Spawn pad centre Z (beyond bridge far end). */
export const SPAWN_CENTER_Z = BRIDGE_FAR_Z + SPAWN_APOTHEM;

/** Spawn pad centre X. */
export const SPAWN_CENTER_X = 0;
