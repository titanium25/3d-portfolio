import * as THREE from "three";
import type { Scene } from "three";

export function createGround(scene: Scene): THREE.Mesh {
  const shape = new THREE.Shape();
  const size = 12;
  const sides = 6;
  for (let i = 0; i < sides; i++) {
    const angle = (i / sides) * Math.PI * 2 - Math.PI / 6;
    const x = Math.cos(angle) * size;
    const z = Math.sin(angle) * size;
    if (i === 0) {
      shape.moveTo(x, z);
    } else {
      shape.lineTo(x, z);
    }
  }
  shape.closePath();

  const geometry = new THREE.ShapeGeometry(shape);
  geometry.rotateX(-Math.PI / 2);
  geometry.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({
    color: 0x3d4a6e,
    roughness: 0.65,
    metalness: 0.2,
    envMapIntensity: 1.1,
  });

  const ground = new THREE.Mesh(geometry, material);
  ground.receiveShadow = true;
  ground.position.y = 0;
  scene.add(ground);

  return ground;
}
