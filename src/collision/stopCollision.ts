import * as THREE from 'three';
import type { Stop } from '../scene/types';

const STOP_COLLISION_RADIUS = 0.85;

export function wouldCollideWithStop(
  newX: number,
  newZ: number,
  stops: Stop[],
  characterRadius = 0.5,
): boolean {
  return getCollidingStop(newX, newZ, stops, characterRadius) !== null;
}

export function getCollidingStop(
  newX: number,
  newZ: number,
  stops: Stop[],
  characterRadius = 0.5,
): Stop | null {
  for (const stop of stops) {
    const worldPos = new THREE.Vector3();
    stop.group.getWorldPosition(worldPos);

    // Per-pillar collision points (e.g. gate frames)
    const subPts = stop.group.userData.collisionPoints as
      | [number, number][]
      | undefined;

    if (subPts) {
      const subR =
        (stop.group.userData.collisionRadius as number | undefined) ?? 0.3;
      const threshold = characterRadius + subR;
      for (const [ox, oz] of subPts) {
        const localPt = new THREE.Vector3(ox, 0, oz);
        stop.group.localToWorld(localPt);
        const dx = newX - localPt.x;
        const dz = newZ - localPt.z;
        if (Math.sqrt(dx * dx + dz * dz) < threshold) return stop;
      }
      continue; // skip default circle — the sub-points handle this stop
    }

    // Default: single circle around stop center
    const dx = newX - worldPos.x;
    const dz = newZ - worldPos.z;
    if (Math.sqrt(dx * dx + dz * dz) < characterRadius + STOP_COLLISION_RADIUS)
      return stop;
  }
  return null;
}

export function getBounceVelocity(
  playerX: number,
  playerZ: number,
  velX: number,
  velZ: number,
  stop: Stop,
  bounceFactor: number
): { x: number; z: number } {
  const worldPos = new THREE.Vector3();
  stop.group.getWorldPosition(worldPos);
  const dx = playerX - worldPos.x;
  const dz = playerZ - worldPos.z;
  const len = Math.sqrt(dx * dx + dz * dz) || 0.001;
  const nx = dx / len;
  const nz = dz / len;
  const dot = velX * nx + velZ * nz;
  const rx = velX - 2 * dot * nx;
  const rz = velZ - 2 * dot * nz;
  return { x: rx * bounceFactor, z: rz * bounceFactor };
}
