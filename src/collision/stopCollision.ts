import * as THREE from 'three';
import type { Stop } from '../scene/types';
import { PLAYER_RADIUS } from '../scene/CharacterController';

const STOP_COLLISION_RADIUS = 0.85;

export function wouldCollideWithStop(
  newX: number,
  newZ: number,
  stops: Stop[]
): boolean {
  return getCollidingStop(newX, newZ, stops) !== null;
}

export function getCollidingStop(
  newX: number,
  newZ: number,
  stops: Stop[]
): Stop | null {
  const pos = new THREE.Vector3(newX, 0, newZ);
  const threshold = PLAYER_RADIUS + STOP_COLLISION_RADIUS;

  for (const stop of stops) {
    const worldPos = new THREE.Vector3();
    stop.group.getWorldPosition(worldPos);
    const dx = pos.x - worldPos.x;
    const dz = pos.z - worldPos.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < threshold) return stop;
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
