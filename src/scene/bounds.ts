/* ── Main arena ─────────────────────────────────────────────── */

const SIZE  = 12;
const SIDES = 6;

const HEX_VERTICES: Array<[number, number]> = [];
for (let i = 0; i < SIDES; i++) {
  const angle = (i / SIDES) * Math.PI * 2 - Math.PI / 6;
  HEX_VERTICES.push([Math.cos(angle) * SIZE, Math.sin(angle) * SIZE]);
}

/* ── Spawn pad + bridge (must stay in sync with createSpawnPad) ── */

const ARENA_APOTHEM   = SIZE * Math.cos(Math.PI / 6); // ≈ 10.392

// Bridge runs along +Z
const BRIDGE_LENGTH   = 14;
const BRIDGE_WIDTH    = ARENA_APOTHEM * 2 * 0.30;     // ≈ 6.235
const BRIDGE_NEAR_Z   = ARENA_APOTHEM;                 // ≈ 10.392
const BRIDGE_FAR_Z    = BRIDGE_NEAR_Z + BRIDGE_LENGTH; // ≈ 24.392
const BRIDGE_HALF_WIDTH = BRIDGE_WIDTH / 2;

// Spawn pad: apothem = BRIDGE_WIDTH/2 so flat face equals bridge width
const SPAWN_APOTHEM   = BRIDGE_WIDTH / 2;                       // ≈ 3.117
const SPAWN_SIZE      = SPAWN_APOTHEM / Math.cos(Math.PI / 6); // ≈ 3.598
const SPAWN_CENTER_Z  = BRIDGE_FAR_Z + SPAWN_APOTHEM;          // ≈ 27.51
const SPAWN_CENTER_X  = 0;

// Pre-build spawn hex vertices in world space (X, Z)
const SPAWN_HEX_VERTICES: Array<[number, number]> = [];
for (let i = 0; i < SIDES; i++) {
  // Same angle formula as hexVertex() in createSpawnPad / createGround
  const angle = (i / SIDES) * Math.PI * 2 - Math.PI / 6;
  SPAWN_HEX_VERTICES.push([
    Math.cos(angle) * SPAWN_SIZE + SPAWN_CENTER_X,
    Math.sin(angle) * SPAWN_SIZE + SPAWN_CENTER_Z, // Z offset in "z-slot"
  ]);
}

/* ── Helpers ────────────────────────────────────────────────── */

function isInsideWithVertices(
  x: number,
  z: number,
  vertices: Array<[number, number]>,
): boolean {
  let inside = false;
  const n = vertices.length;
  let j = n - 1;

  for (let i = 0; i < n; i++) {
    const [xi, zi] = vertices[i];
    const [xj, zj] = vertices[j];

    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) {
      inside = !inside;
    }
    j = i;
  }

  return inside;
}

function isInsideArena(x: number, z: number, margin: number): boolean {
  const innerSize = SIZE - margin;
  if (innerSize <= 0) return false;

  const innerVertices = HEX_VERTICES.map(([vx, vz]) => {
    const len = Math.hypot(vx, vz);
    const scale = innerSize / (len || 1);
    return [vx * scale, vz * scale] as [number, number];
  });

  return isInsideWithVertices(x, z, innerVertices);
}

function isInsideSpawnPad(x: number, z: number, margin: number): boolean {
  const innerSize = SPAWN_SIZE - margin;
  if (innerSize <= 0) return false;

  const innerVertices = SPAWN_HEX_VERTICES.map(([vx, vz]) => {
    const localX = vx - SPAWN_CENTER_X;
    const localZ = vz - SPAWN_CENTER_Z;
    const len    = Math.hypot(localX, localZ);
    const scale  = innerSize / (len || 1);
    return [SPAWN_CENTER_X + localX * scale, SPAWN_CENTER_Z + localZ * scale] as [number, number];
  });

  return isInsideWithVertices(x, z, innerVertices);
}

function isInsideBridge(x: number, z: number, margin: number): boolean {
  return (
    z >= BRIDGE_NEAR_Z - margin &&
    z <= BRIDGE_FAR_Z  + margin &&
    x >= -(BRIDGE_HALF_WIDTH - margin) &&
    x <=   BRIDGE_HALF_WIDTH - margin
  );
}

export function isInsideMap(x: number, z: number, margin: number): boolean {
  return (
    isInsideArena(x, z, margin) ||
    isInsideSpawnPad(x, z, margin) ||
    isInsideBridge(x, z, margin)
  );
}
