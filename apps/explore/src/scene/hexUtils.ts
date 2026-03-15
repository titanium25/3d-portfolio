/**
 * Shared hex geometry utilities for arena, spawn pad, and bounds.
 * Flat-top hex: vertices at 0°, 60°, 120°… so flat edges align top/bottom.
 */

import * as THREE from "three";

/** Default flat-top hex: angleOffset 0. */
export const DEFAULT_HEX_ANGLE_OFFSET = 0;

/** Vertex [x, z] for hex edge i. Radius in world units. */
export function hexVertex(
  i: number,
  sides: number,
  radius: number,
  angleOffset: number = DEFAULT_HEX_ANGLE_OFFSET,
): [number, number] {
  const angle = (i / sides) * Math.PI * 2 + angleOffset;
  return [Math.cos(angle) * radius, Math.sin(angle) * radius];
}

/** Closed hex Shape for ExtrudeGeometry. */
export function createHexShape(
  radius: number,
  sides: number = 6,
  angleOffset: number = DEFAULT_HEX_ANGLE_OFFSET,
): THREE.Shape {
  const shape = new THREE.Shape();
  for (let i = 0; i < sides; i++) {
    const [x, z] = hexVertex(i, sides, radius, angleOffset);
    if (i === 0) shape.moveTo(x, z);
    else shape.lineTo(x, z);
  }
  shape.closePath();
  return shape;
}

/** Closed hex Path for holes in shapes. */
export function createHexPath(
  radius: number,
  sides: number = 6,
  angleOffset: number = DEFAULT_HEX_ANGLE_OFFSET,
): THREE.Path {
  const path = new THREE.Path();
  for (let i = 0; i < sides; i++) {
    const [x, z] = hexVertex(i, sides, radius, angleOffset);
    if (i === 0) path.moveTo(x, z);
    else path.lineTo(x, z);
  }
  path.closePath();
  return path;
}
