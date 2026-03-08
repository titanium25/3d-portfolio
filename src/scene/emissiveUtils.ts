/**
 * emissiveUtils.ts
 * Shared helpers for boosting/restoring emissive intensity on 3D objects.
 * Used by hover tooltips (spawn pad vehicles, arena props).
 */

import * as THREE from "three";

export function boostEmissive(group: THREE.Object3D, intensity: number): void {
  group.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mat = mesh.material as THREE.MeshStandardMaterial;
    if (!mat?.emissive) return;
    if (child.userData._origEmissive === undefined) {
      child.userData._origEmissive = mat.emissiveIntensity;
    }
    mat.emissiveIntensity = intensity;
  });
}

export function restoreEmissive(group: THREE.Object3D): void {
  group.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mat = mesh.material as THREE.MeshStandardMaterial;
    if (!mat?.emissive || child.userData._origEmissive === undefined) return;
    mat.emissiveIntensity = child.userData._origEmissive;
  });
}
