/**
 * createArenaProps.ts
 * Loads and places 3 discovery objects on the arena hex:
 * - LEGO brick stack (lego)
 * - 32kg cast iron kettlebell (gym)
 * - Framed family crayon drawing (twins)
 *
 * The center spire tower is handled separately in createCommandSpire.ts.
 * Props are desk-toy scale, walk-through (no collision), with warm accent lighting.
 */

import * as THREE from "three";
import type { Scene } from "three";
import { gltfLoader } from "./loaderSetup";

/* ══════════════════════════════════════════════════════════════
 *  Model paths (exact filenames from /public/models/)
 * ════════════════════════════════════════════════════════════ */

const KETTLEBELL_PATH = "/models/optimized/Meshy_AI_32_Kg_Cast_Iron_Kettl_0308133600_texture.glb";
const LEGO_PATH = "/models/optimized/Meshy_AI_Lego_bloks_0308133652_texture.glb";
const DRAWING_PATH = "/models/optimized/Meshy_AI_Sunny_Family_on_the_H_0308134126_texture.glb";

/* ══════════════════════════════════════════════════════════════
 *  Placement (arena hex centered at 0,0,0, radius 12)
 * ════════════════════════════════════════════════════════════ */

const LEGO_POS: [number, number, number] = [4.5, 0, -2.0];
const LEGO_ROT_Y = 0.3;

const DRAWING_POS: [number, number, number] = [-3.5, 0, -4.0];
// Rotated to face the camera (camera sits at +X, +Z offset)
const DRAWING_ROT_Y = Math.PI * 0.28;

const KETTLEBELL_POS: [number, number, number] = [7.5, 0, 3.5];
const KETTLEBELL_ROT_Y = 0.5;

/* ══════════════════════════════════════════════════════════════
 *  Target heights (desk-toy scale)
 * ════════════════════════════════════════════════════════════ */

const LEGO_TARGET_HEIGHT = 0.35;
const KETTLEBELL_TARGET_HEIGHT = 0.3;
const DRAWING_TARGET_HEIGHT = 0.45;

const COL_WARM = 0xffa844;

/* ══════════════════════════════════════════════════════════════
 *  Public API
 * ════════════════════════════════════════════════════════════ */

export interface ArenaPropsContext {
  group: THREE.Group;
  legoGroup: THREE.Group;
  kettlebellGroup: THREE.Group;
  drawingGroup: THREE.Group;
}

function addPropLight(
  group: THREE.Group,
  color = COL_WARM,
  intensity = 0.4,
  height = 0.15,
): void {
  const light = new THREE.PointLight(color, intensity, 3.5);
  light.position.set(0, height, 0);
  group.add(light);
}

async function loadProp(
  path: string,
  targetHeight: number,
  position: [number, number, number],
  rotationY: number,
  parent: THREE.Group,
  onLoaded?: () => void,
): Promise<THREE.Group> {
  const gltf = await gltfLoader.loadAsync(path);
  const model = gltf.scene;

  // Scale to target height
  const box = new THREE.Box3().setFromObject(model);
  const currentHeight = box.max.y - box.min.y;
  const scale = targetHeight / currentHeight;
  model.scale.setScalar(scale);

  // Recompute box after scale
  box.setFromObject(model);

  // Ground the model (bottom at Y = 0)
  model.position.y = -box.min.y;

  // Wrap in group for positioning
  const group = new THREE.Group();
  group.add(model);
  group.position.set(...position);
  group.rotation.y = rotationY;

  // Shadows
  model.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      (child as THREE.Mesh).castShadow = true;
      (child as THREE.Mesh).receiveShadow = true;
    }
  });

  parent.add(group);
  onLoaded?.();
  return group;
}

export async function createArenaProps(
  scene: Scene,
  onAssetLoaded?: () => void,
): Promise<ArenaPropsContext> {
  const group = new THREE.Group();
  group.name = "ArenaProps";

  const [legoGroup, kettlebellGroup, drawingGroup] = await Promise.all([
    loadProp(
      LEGO_PATH,
      LEGO_TARGET_HEIGHT,
      LEGO_POS,
      LEGO_ROT_Y,
      group,
      onAssetLoaded,
    ),
    loadProp(
      KETTLEBELL_PATH,
      KETTLEBELL_TARGET_HEIGHT,
      KETTLEBELL_POS,
      KETTLEBELL_ROT_Y,
      group,
      onAssetLoaded,
    ),
    loadProp(
      DRAWING_PATH,
      DRAWING_TARGET_HEIGHT,
      DRAWING_POS,
      DRAWING_ROT_Y,
      group,
      onAssetLoaded,
    ),
  ]);

  addPropLight(legoGroup);
  addPropLight(kettlebellGroup);
  // Softer neutral light so crayon colors read true (no warm tint, lower intensity)
  addPropLight(drawingGroup, 0xfff8f0, 0.12);

  scene.add(group);

  return {
    group,
    legoGroup,
    kettlebellGroup,
    drawingGroup,
  };
}
