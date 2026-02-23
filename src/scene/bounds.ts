import {
  ARENA_SIZE,
  ARENA_SIDES,
  BRIDGE_NEAR_Z,
  BRIDGE_FAR_Z,
  BRIDGE_HALF_WIDTH,
  SPAWN_SIZE,
  SPAWN_CENTER_X,
  SPAWN_CENTER_Z,
} from "./layoutConstants";
import { hexVertex } from "./hexUtils";

/* ── Arena hex vertices (flat-top, local space) ───────────────── */

const HEX_VERTICES: Array<[number, number]> = [];
for (let i = 0; i < ARENA_SIDES; i++) {
  const [x, z] = hexVertex(i, ARENA_SIDES, ARENA_SIZE);
  HEX_VERTICES.push([x, z]);
}

/* ── Spawn hex vertices in world space (X, Z) ─────────────────── */

const SPAWN_HEX_VERTICES: Array<[number, number]> = [];
for (let i = 0; i < ARENA_SIDES; i++) {
  const [lx, lz] = hexVertex(i, ARENA_SIDES, SPAWN_SIZE);
  SPAWN_HEX_VERTICES.push([lx + SPAWN_CENTER_X, lz + SPAWN_CENTER_Z]);
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
  const innerSize = ARENA_SIZE - margin;
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
