import * as THREE from "three";
import {
  GLTFLoader,
  type GLTF,
} from "three/examples/jsm/loaders/GLTFLoader.js";
import type { AnimationAction } from "three";
import type { Scene } from "three";
import type { Stop } from "./types";
import {
  getInputDirection,
  isKeyPressed,
} from "../controls/keyboardController";
import { isInsideMap } from "./bounds";
import { getCollidingStop } from "../collision/stopCollision";

export const PLAYER_RADIUS = 0.5;
export const PLAYER_WALK_SPEED = 0.04; // Reduced walking speed
export const PLAYER_RUN_SPEED = 0.15; // Running speed (faster than original)
export const PLAYER_ACCELERATION = 0.012;
export const PLAYER_DECELERATION = 0.92;

export class CharacterController {
  readonly group: THREE.Group;
  private mixer: THREE.AnimationMixer | null = null;
  activeAction: AnimationAction | null = null;
  idleAction: AnimationAction | null = null;
  walkAction: AnimationAction | null = null;
  runAction: AnimationAction | null = null;
  waveAction: AnimationAction | null = null;
  private velocityX = 0;
  private velocityZ = 0;
  private targetRotationY = 0;
  private readonly ROTATION_LERP = 12;

  private constructor(group: THREE.Group) {
    this.group = group;
  }

  switchAction(newAction: AnimationAction | null, fadeTime = 0.15): void {
    if (!newAction || newAction === this.activeAction) return;

    if (this.activeAction) {
      this.activeAction.fadeOut(fadeTime);
    }
    newAction.reset().setEffectiveWeight(1).fadeIn(fadeTime).play();
    this.activeAction = newAction;
  }

  playWave(loop = false): void {
    if (this.waveAction) {
      if (this.activeAction && this.activeAction !== this.waveAction) {
        this.activeAction.fadeOut(0.2);
      }
      this.waveAction.reset();
      if (loop) {
        this.waveAction.setLoop(THREE.LoopRepeat, Infinity);
      } else {
        this.waveAction.setLoop(THREE.LoopOnce, 1);
        this.waveAction.clampWhenFinished = true;
      }
      this.waveAction.setEffectiveWeight(1).fadeIn(0.2).play();
      this.activeAction = this.waveAction;
    }
  }

  isWaving(): boolean {
    return (
      this.activeAction === this.waveAction &&
      this.waveAction !== null &&
      this.waveAction.isRunning()
    );
  }

  updateMixer(deltaSec: number): void {
    if (this.mixer) {
      this.mixer.update(deltaSec);
    }
  }

  static async create(
    scene: Scene,
    onAssetLoaded?: () => void,
  ): Promise<CharacterController> {
    const group = new THREE.Group();
    group.position.set(0, 0, 0);
    scene.add(group);

    const controller = new CharacterController(group);

    const loader = new GLTFLoader();

    try {
      const idleGltf = await new Promise<GLTF>((resolve, reject) =>
        loader.load(
          "/models/Meshy_AI_Animation_Idle_11_withSkin.glb",
          resolve,
          undefined,
          reject,
        ),
      );

      const model = idleGltf.scene;

      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      const targetHeight = 0.4;
      const scale = targetHeight / maxDim;
      model.scale.setScalar(scale);

      box.setFromObject(model);
      model.position.y = -box.min.y;

      model.traverse((child: THREE.Object3D) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          mesh.castShadow = true;
          mesh.receiveShadow = true;

          // Fix depth/transparency glitches (back limbs showing through body)
          const materials = Array.isArray(mesh.material)
            ? mesh.material
            : [mesh.material];
          for (const mat of materials) {
            mat.depthWrite = true;
            mat.depthTest = true;
            mat.transparent = false;
            mat.side = THREE.FrontSide;
            // If the material uses an alpha map, use alphaTest instead of transparency
            const stdMat = mat as THREE.MeshStandardMaterial;
            if (stdMat.alphaMap || stdMat.map?.format === THREE.RGBAFormat) {
              mat.alphaTest = 0.5;
            }
            // Reduce shininess by increasing roughness and reducing environment map intensity
            if (stdMat.isMeshStandardMaterial) {
              stdMat.roughness = Math.max(stdMat.roughness || 0.5, 0.8); // Increase roughness (less shiny)
              stdMat.metalness = Math.min(stdMat.metalness || 0.5, 0.1); // Reduce metalness
              stdMat.envMapIntensity = 0.3; // Reduce environment map reflection intensity
            }
          }
        }
      });

      group.add(model);
      onAssetLoaded?.();

      const mixer = new THREE.AnimationMixer(model);
      controller.mixer = mixer;

      const loadAnimation = async (
        url: string,
        name: string,
      ): Promise<AnimationAction | null> => {
        try {
          const gltf = await new Promise<GLTF>((resolve, reject) =>
            loader.load(url, resolve, undefined, reject),
          );
          if (gltf.animations.length > 0) {
            const clip = gltf.animations[0];
            const action = mixer.clipAction(clip, model);
            action.setLoop(THREE.LoopRepeat, Infinity);
            console.log(
              `Loaded ${name}: "${clip.name}" (${clip.duration.toFixed(2)}s)`,
            );
            return action;
          }
        } catch (e) {
          console.warn(`Failed to load ${name} from ${url}:`, e);
        }
        return null;
      };

      controller.idleAction = await loadAnimation(
        "/models/Meshy_AI_Animation_Idle_11_withSkin.glb",
        "idle",
      );
      onAssetLoaded?.();

      controller.walkAction = await loadAnimation(
        "/models/Meshy_AI_Animation_Walking_withSkin.glb",
        "walk",
      );
      onAssetLoaded?.();

      controller.runAction = await loadAnimation(
        "/models/Meshy_AI_Animation_Running_withSkin.glb",
        "run",
      );
      onAssetLoaded?.();

      controller.waveAction = await loadAnimation(
        "/models/Meshy_AI_Animation_Wave_One_Hand_withSkin.glb",
        "wave",
      );
      onAssetLoaded?.();

      if (controller.idleAction) {
        controller.idleAction.reset().setEffectiveWeight(1).play();
        controller.activeAction = controller.idleAction;
      }

      return controller;
    } catch (error) {
      console.error("Failed to load character:", error);
      throw error;
    }
  }

  update(deltaSec: number, stops: Stop[]): void {
    const dir = getInputDirection();
    const isRunning = isKeyPressed("ShiftLeft") || isKeyPressed("ShiftRight");
    const maxSpeed = isRunning ? PLAYER_RUN_SPEED : PLAYER_WALK_SPEED;

    if (dir.x !== 0 || dir.z !== 0) {
      this.velocityX += dir.x * PLAYER_ACCELERATION;
      this.velocityZ += dir.z * PLAYER_ACCELERATION;

      const speed = Math.hypot(this.velocityX, this.velocityZ);
      if (speed > maxSpeed) {
        const s = maxSpeed / speed;
        this.velocityX *= s;
        this.velocityZ *= s;
      }
    } else {
      // Stop immediately when no input
      this.velocityX = 0;
      this.velocityZ = 0;
    }

    const newX = this.group.position.x + this.velocityX;
    const newZ = this.group.position.z + this.velocityZ;

    let finalX = this.group.position.x;
    let finalZ = this.group.position.z;

    const canMoveX =
      isInsideMap(newX, this.group.position.z, PLAYER_RADIUS) &&
      !getCollidingStop(newX, this.group.position.z, stops);
    const canMoveZ =
      isInsideMap(this.group.position.x, newZ, PLAYER_RADIUS) &&
      !getCollidingStop(this.group.position.x, newZ, stops);

    if (canMoveX) finalX = newX;
    else this.velocityX = 0;

    if (canMoveZ) finalZ = newZ;
    else this.velocityZ = 0;

    if (
      !isInsideMap(finalX, finalZ, PLAYER_RADIUS) ||
      getCollidingStop(finalX, finalZ, stops)
    ) {
      finalX = this.group.position.x;
      finalZ = this.group.position.z;
      this.velocityX = 0;
      this.velocityZ = 0;
    }

    this.group.position.x = finalX;
    this.group.position.z = finalZ;

    if (this.velocityX !== 0 || this.velocityZ !== 0) {
      this.targetRotationY =
        Math.atan2(-this.velocityX, -this.velocityZ) + Math.PI;
    }
    const rotLerp = 1 - Math.exp(-this.ROTATION_LERP * deltaSec);
    this.group.rotation.y +=
      (this.targetRotationY - this.group.rotation.y) * rotLerp;

    if (this.mixer) {
      this.mixer.update(deltaSec);

      // Allow movement input to interrupt wave animation
      if (dir.x !== 0 || dir.z !== 0) {
        // User is providing input - switch to walk or run animation based on SHIFT
        if (
          isRunning &&
          this.runAction &&
          this.activeAction !== this.runAction
        ) {
          this.switchAction(this.runAction);
        } else if (
          !isRunning &&
          this.walkAction &&
          this.activeAction !== this.walkAction
        ) {
          this.switchAction(this.walkAction);
        }
      } else if (this.activeAction === this.waveAction && this.waveAction) {
        // Wave animation is playing and no input - wait for it to finish
        if (!this.waveAction.isRunning()) {
          this.switchAction(this.idleAction);
        }
      } else {
        // No input - switch to idle animation immediately with faster transition
        if (this.idleAction && this.activeAction !== this.idleAction) {
          this.switchAction(this.idleAction, 0.08); // Faster fade for walk-to-idle transition
        }
      }
    }
  }
}
