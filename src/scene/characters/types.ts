/**
 * Movement intent produced by a character's input system each frame.
 *
 * Subclasses of BaseCharacter return this from `getMovementInput()`.
 * For a player it comes from the keyboard; for a pet it's derived from
 * the target it follows; for an AI bug it comes from a behaviour tree, etc.
 */
export interface MovementInput {
  /** Normalised direction X component (-1 … 1) */
  dirX: number;
  /** Normalised direction Z component (-1 … 1) */
  dirZ: number;
  /** Maximum speed the character wants to reach this frame */
  maxSpeed: number;
  /** Whether active movement input exists this frame */
  hasInput: boolean;
}

/**
 * Core physics configuration for a character.
 * Passed to the BaseCharacter constructor.
 */
export interface CharacterConfig {
  /** Collision / bounds-checking radius */
  radius: number;
  /** Normal (walk) movement speed */
  walkSpeed: number;
  /** Sprint (run) movement speed */
  runSpeed: number;
  /** Per-frame velocity increase when accelerating */
  acceleration: number;
  /** Per-frame velocity decay when no input (0–1, lower = more friction) */
  deceleration: number;
}
