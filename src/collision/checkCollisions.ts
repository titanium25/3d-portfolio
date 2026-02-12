import * as THREE from 'three';
import type { Stop } from '../scene/types';

export const PROXIMITY_RADIUS = 3.5;
export const INTERACT_RADIUS = 1.8;

export function getNearbyStop(
  player: THREE.Object3D,
  stops: Stop[]
): { stop: Stop; distance: number } | null {
  let closest: { stop: Stop; distance: number } | null = null;

  for (const stop of stops) {
    const worldPos = new THREE.Vector3();
    stop.group.getWorldPosition(worldPos);
    const distance = player.position.distanceTo(worldPos);

    if (distance < PROXIMITY_RADIUS) {
      if (!closest || distance < closest.distance) {
        closest = { stop, distance };
      }
    }
  }

  return closest;
}

export function checkProximityAndInteract(
  player: THREE.Object3D,
  stops: Stop[],
  isEPressed: boolean,
  onProximity: (stop: Stop, distance: number) => void,
  onHideProximity: () => void,
  onEnter: (stop: Stop) => void
): void {
  const nearby = getNearbyStop(player, stops);

  if (nearby) {
    onProximity(nearby.stop, nearby.distance);

    if (nearby.distance < INTERACT_RADIUS && isEPressed) {
      onEnter(nearby.stop);
    }
  } else {
    onHideProximity();
  }
}
