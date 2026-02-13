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
export const PLAYER_WALK_SPEED = 0.04;
export const PLAYER_RUN_SPEED = 0.1;
export const PLAYER_ACCELERATION = 0.012;
export const PLAYER_DECELERATION = 0.88; // Per-frame velocity decay when no input (momentum)

// Smooth physics transition constants
const SPEED_REDUCE_LERP = 0.12; // Per-frame lerp for speed reduction (run→walk)
const STOP_THRESHOLD = 0.003; // Snap to zero below this speed
const RUN_ANIM_THRESHOLD = (PLAYER_WALK_SPEED + PLAYER_RUN_SPEED) * 0.45; // Speed at which run anim kicks in

// Steering physics – smooth arcing direction changes instead of instant snapping
const STEER_RATE_SLOW = 14; // Steering rate when walking (rad/s) – nearly instant
const STEER_RATE_FAST = 7; // Steering rate at full sprint (rad/s) – tighter arcs
const SHARP_TURN_BRAKE = 0.35; // Max per-frame speed penalty during sharp turns
const STEER_SPEED_THRESHOLD = 0.008; // Below this, use direct accel (responsive startup)

// Visual body rotation (character model follows velocity direction)
const TURN_VISUAL_SLOW = 14; // Body rotation rate when slow/stopped
const TURN_VISUAL_FAST = 7; // Body rotation rate at full sprint

// Character lean during turns (subtle body tilt into the turn)
const LEAN_MAX = 0.12; // Max lean angle in radians (~7°)
const LEAN_SENSITIVITY = 0.012; // Angular-velocity → lean factor
const LEAN_SMOOTH = 6; // How quickly lean responds/recovers

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
  private currentLean = 0;

  private constructor(group: THREE.Group) {
    this.group = group;
  }

  /** Shortest signed angle from `from` to `to` (handles 0↔2π wrap) */
  private shortestAngleDist(from: number, to: number): number {
    const TWO_PI = Math.PI * 2;
    return ((((to - from) % TWO_PI) + Math.PI * 3) % TWO_PI) - Math.PI;
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
    // YZX order: yaw (Y) applied first, then lean/roll (Z) in character-local space
    group.rotation.order = "YZX";
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
    const hasInput = dir.x !== 0 || dir.z !== 0;
    const currentSpeed = Math.hypot(this.velocityX, this.velocityZ);

    // ─── Velocity update with steering-based direction changes ───
    if (hasInput) {
      if (currentSpeed > STEER_SPEED_THRESHOLD) {
        // STEERING MODEL: when already moving, rotate the velocity vector
        // toward the input direction instead of instantly snapping.
        // This creates natural arcing turns – wider at higher speeds.
        const velAngle = Math.atan2(this.velocityX, this.velocityZ);
        const inputAngle = Math.atan2(dir.x, dir.z);
        const angleDiff = this.shortestAngleDist(velAngle, inputAngle);
        const turnSharpness = Math.abs(angleDiff) / Math.PI; // 0 = same, 1 = 180°

        // Speed-dependent steering: faster movement → lower steer rate → wider arc
        const speedRatio = Math.min(1, currentSpeed / PLAYER_RUN_SPEED);
        const steerRate =
          STEER_RATE_SLOW + (STEER_RATE_FAST - STEER_RATE_SLOW) * speedRatio;

        // Rotate velocity direction toward input (capped by steer rate per frame)
        const maxSteer = steerRate * deltaSec;
        const steerAmount =
          Math.abs(angleDiff) < maxSteer
            ? angleDiff
            : Math.sign(angleDiff) * maxSteer;
        const newVelAngle = velAngle + steerAmount;

        // Brake during sharp turns (>~45°) – sharper + faster = more braking
        let newSpeed = currentSpeed;
        if (turnSharpness > 0.25) {
          const brakeIntensity = ((turnSharpness - 0.25) / 0.75) * speedRatio;
          newSpeed *= 1.0 - SHARP_TURN_BRAKE * brakeIntensity;
        }

        // Accelerate toward maxSpeed, or smoothly decelerate if above it
        if (newSpeed < maxSpeed) {
          newSpeed = Math.min(maxSpeed, newSpeed + PLAYER_ACCELERATION);
        } else if (newSpeed > maxSpeed) {
          // Smooth slowdown (e.g. released Shift while running)
          newSpeed += (maxSpeed - newSpeed) * SPEED_REDUCE_LERP;
        }

        this.velocityX = Math.sin(newVelAngle) * newSpeed;
        this.velocityZ = Math.cos(newVelAngle) * newSpeed;
      } else {
        // DIRECT ACCELERATION: responsive startup from standstill
        this.velocityX += dir.x * PLAYER_ACCELERATION;
        this.velocityZ += dir.z * PLAYER_ACCELERATION;

        const newSpeed = Math.hypot(this.velocityX, this.velocityZ);
        if (newSpeed > maxSpeed) {
          const s = maxSpeed / newSpeed;
          this.velocityX *= s;
          this.velocityZ *= s;
        }
      }
    } else {
      // No input: gradual deceleration (momentum)
      this.velocityX *= PLAYER_DECELERATION;
      this.velocityZ *= PLAYER_DECELERATION;

      if (Math.hypot(this.velocityX, this.velocityZ) < STOP_THRESHOLD) {
        this.velocityX = 0;
        this.velocityZ = 0;
      }
    }

    // ─── Position update with collision ───
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

    // ─── Rotation: velocity-following with shortest-path fix & speed-dependent rate ───
    const updatedSpeed = Math.hypot(this.velocityX, this.velocityZ);

    if (updatedSpeed > STOP_THRESHOLD) {
      this.targetRotationY =
        Math.atan2(-this.velocityX, -this.velocityZ) + Math.PI;
    }

    // Slower visual rotation when moving fast (matches the wider steering arcs)
    const speedRatio = Math.min(1, updatedSpeed / PLAYER_RUN_SPEED);
    const visualTurnRate =
      TURN_VISUAL_SLOW + (TURN_VISUAL_FAST - TURN_VISUAL_SLOW) * speedRatio;
    const rotLerp = 1 - Math.exp(-visualTurnRate * deltaSec);

    // Shortest-path rotation (fixes the snap when crossing 0↔2π boundary)
    const rotDiff = this.shortestAngleDist(
      this.group.rotation.y,
      this.targetRotationY,
    );
    this.group.rotation.y += rotDiff * rotLerp;

    // ─── Lean: tilt the character body into turns for visual polish ───
    const angularVel = deltaSec > 0 ? rotDiff / deltaSec : 0;
    const targetLean = Math.max(
      -LEAN_MAX,
      Math.min(LEAN_MAX, angularVel * LEAN_SENSITIVITY * speedRatio),
    );
    const leanLerp = 1 - Math.exp(-LEAN_SMOOTH * deltaSec);
    this.currentLean += (targetLean - this.currentLean) * leanLerp;
    this.group.rotation.z = this.currentLean;

    // ─── Animation: pick anim based on actual speed, scale to match movement ───
    if (this.mixer) {
      this.mixer.update(deltaSec);

      if (hasInput || updatedSpeed > STOP_THRESHOLD) {
        if (updatedSpeed > RUN_ANIM_THRESHOLD && this.runAction) {
          if (this.activeAction !== this.runAction) {
            this.switchAction(this.runAction, 0.2);
          }
          this.runAction.setEffectiveTimeScale(
            Math.max(0.6, updatedSpeed / PLAYER_RUN_SPEED),
          );
        } else if (this.walkAction) {
          if (this.activeAction !== this.walkAction) {
            const fadeTime = this.activeAction === this.runAction ? 0.3 : 0.15;
            this.switchAction(this.walkAction, fadeTime);
          }
          this.walkAction.setEffectiveTimeScale(
            Math.max(0.4, Math.min(1.5, updatedSpeed / PLAYER_WALK_SPEED)),
          );
        }
      } else if (this.activeAction === this.waveAction && this.waveAction) {
        if (!this.waveAction.isRunning()) {
          this.switchAction(this.idleAction);
        }
      } else {
        if (this.idleAction && this.activeAction !== this.idleAction) {
          const fadeTime = this.activeAction === this.runAction ? 0.3 : 0.2;
          this.switchAction(this.idleAction, fadeTime);
        }
      }
    }
  }
}
