import * as THREE from "three";
import {
  GLTFLoader,
  type GLTF,
} from "three/examples/jsm/loaders/GLTFLoader.js";
import type { AnimationAction } from "three";
import type { Stop } from "../types";
import { isInsideMap } from "../bounds";
import { getCollidingStop } from "../../collision/stopCollision";
import type { MovementInput, CharacterConfig } from "./types";

// ── Steering defaults ────────────────────────────────────────────────
const DEFAULT_SPEED_REDUCE_LERP = 0.12;
const DEFAULT_STOP_THRESHOLD = 0.003;
const DEFAULT_STEER_RATE_SLOW = 14;
const DEFAULT_STEER_RATE_FAST = 7;
const DEFAULT_SHARP_TURN_BRAKE = 0.35;
const DEFAULT_STEER_SPEED_THRESHOLD = 0.008;

const REFERENCE_FPS = 60;

// ── Visual defaults ──────────────────────────────────────────────────
const DEFAULT_TURN_VISUAL_SLOW = 14;
const DEFAULT_TURN_VISUAL_FAST = 7;
const DEFAULT_LEAN_MAX = 0.12;
const DEFAULT_LEAN_SENSITIVITY = 0.012;
const DEFAULT_LEAN_SMOOTH = 6;

/**
 * Abstract base class for every character in the scene.
 *
 * Provides:
 *  - Velocity / steering physics (acceleration, deceleration, arcing turns)
 *  - Position update with optional map-bounds and stop-collision checks
 *  - Visual rotation (face velocity direction) and lean into turns
 *  - Animation state-machine (idle → walk → run) with cross-fade
 *  - GLTF model-loading utilities for subclass factories
 *
 * Subclasses implement `getMovementInput()` to supply the per-frame
 * movement intent – keyboard for the player, follow-target for a pet,
 * AI for a bug, etc.
 */
export abstract class BaseCharacter {
  // ── Public state ───────────────────────────────────────────────────
  readonly group: THREE.Group;

  // ── Core physics config (immutable after construction) ─────────────
  readonly radius: number;
  readonly walkSpeed: number;
  readonly runSpeed: number;
  readonly acceleration: number;
  readonly deceleration: number;

  // ── Steering tuning (override in subclass constructor if needed) ───
  protected speedReduceLerp = DEFAULT_SPEED_REDUCE_LERP;
  protected stopThreshold = DEFAULT_STOP_THRESHOLD;
  protected steerRateSlow = DEFAULT_STEER_RATE_SLOW;
  protected steerRateFast = DEFAULT_STEER_RATE_FAST;
  protected sharpTurnBrake = DEFAULT_SHARP_TURN_BRAKE;
  protected steerSpeedThreshold = DEFAULT_STEER_SPEED_THRESHOLD;

  // ── Visual tuning ─────────────────────────────────────────────────
  protected turnVisualSlow = DEFAULT_TURN_VISUAL_SLOW;
  protected turnVisualFast = DEFAULT_TURN_VISUAL_FAST;
  protected leanMax = DEFAULT_LEAN_MAX;
  protected leanSensitivity = DEFAULT_LEAN_SENSITIVITY;
  protected leanSmooth = DEFAULT_LEAN_SMOOTH;

  // ── Behaviour flags ────────────────────────────────────────────────
  protected collidesWithStops = true;
  protected respectsMapBounds = true;

  // ── Animation state ────────────────────────────────────────────────
  protected mixer: THREE.AnimationMixer | null = null;
  protected activeAction: AnimationAction | null = null;
  protected idleAction: AnimationAction | null = null;
  protected walkAction: AnimationAction | null = null;
  protected runAction: AnimationAction | null = null;

  // ── Y-lock (prevents animations from sinking the character) ────────
  protected characterModel: THREE.Object3D | null = null;
  protected modelBaseY = 0;
  protected rootBone: THREE.Bone | null = null;
  protected rootBoneBaseY = 0;

  // ── Physics state ──────────────────────────────────────────────────
  protected velocityX = 0;
  protected velocityZ = 0;
  protected targetRotationY = 0;
  protected currentLean = 0;
  protected dt = 1;

  // ──────────────────────────────────────────────────────────────────
  //  Construction
  // ──────────────────────────────────────────────────────────────────

  protected constructor(group: THREE.Group, config: CharacterConfig) {
    this.group = group;
    // Sync targetRotationY with whatever rotation the group already has,
    // so the lerp in updateRotationAndLean doesn't fight against a pre-set spawn rotation.
    this.targetRotationY = group.rotation.y;
    this.radius = config.radius;
    this.walkSpeed = config.walkSpeed;
    this.runSpeed = config.runSpeed;
    this.acceleration = config.acceleration;
    this.deceleration = config.deceleration;
  }

  // ──────────────────────────────────────────────────────────────────
  //  Abstract – subclasses MUST implement
  // ──────────────────────────────────────────────────────────────────

  /** Return the movement intent for the current frame. */
  protected abstract getMovementInput(): MovementInput;

  // ──────────────────────────────────────────────────────────────────
  //  Public API
  // ──────────────────────────────────────────────────────────────────

  /** Convenience getter – world position of this character. */
  get position(): THREE.Vector3 {
    return this.group.position;
  }

  /** Current speed (magnitude of velocity). */
  get speed(): number {
    return Math.hypot(this.velocityX, this.velocityZ);
  }

  /** Name of the currently playing animation action. */
  get animationStateName(): string {
    if (!this.activeAction) return "none";
    if (this.activeAction === this.idleAction) return "idle";
    if (this.activeAction === this.walkAction) return "walk";
    if (this.activeAction === this.runAction) return "run";
    return "other";
  }

  /** Return debug information for the dev HUD. Override in subclasses. */
  getDebugInfo(): Record<string, string> {
    const p = this.group.position;
    return {
      position: `${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)}`,
      speed: this.speed.toFixed(4),
      animation: this.animationStateName,
      rotation: `${THREE.MathUtils.radToDeg(this.group.rotation.y).toFixed(1)}°`,
    };
  }

  /** Tick the animation mixer without running full physics (e.g. during cinematics). */
  updateMixer(deltaSec: number): void {
    this.mixer?.update(deltaSec);
    this.lockModelY();
  }

  /**
   * Main per-frame update – template method.
   * Runs physics → position → visuals → animation.
   */
  update(deltaSec: number, stops: Stop[]): void {
    this.dt = Math.min(deltaSec * REFERENCE_FPS, 3);
    const input = this.getMovementInput();
    this.updateVelocity(deltaSec, input);
    this.updatePosition(stops);
    this.updateRotationAndLean(deltaSec);
    this.updateAnimations(deltaSec, input);
  }

  // ──────────────────────────────────────────────────────────────────
  //  Physics internals (protected – overridable by subclasses)
  // ──────────────────────────────────────────────────────────────────

  /** Shortest signed angle from `from` to `to` (handles 0↔2π wrap). */
  protected shortestAngleDist(from: number, to: number): number {
    const TWO_PI = Math.PI * 2;
    return ((((to - from) % TWO_PI) + Math.PI * 3) % TWO_PI) - Math.PI;
  }

  /** Speed threshold at which the run animation kicks in. */
  protected get runAnimThreshold(): number {
    return (this.walkSpeed + this.runSpeed) * 0.45;
  }

  /** Update velocity using the steering model. */
  protected updateVelocity(deltaSec: number, input: MovementInput): void {
    const { dirX, dirZ, maxSpeed, hasInput } = input;
    const currentSpeed = Math.hypot(this.velocityX, this.velocityZ);
    const dt = this.dt;

    if (hasInput) {
      if (currentSpeed > this.steerSpeedThreshold) {
        // ── Steering model: rotate velocity toward input direction ──
        const velAngle = Math.atan2(this.velocityX, this.velocityZ);
        const inputAngle = Math.atan2(dirX, dirZ);
        const angleDiff = this.shortestAngleDist(velAngle, inputAngle);
        const turnSharpness = Math.abs(angleDiff) / Math.PI;

        const speedRatio = Math.min(1, currentSpeed / this.runSpeed);
        const steerRate =
          this.steerRateSlow +
          (this.steerRateFast - this.steerRateSlow) * speedRatio;

        const maxSteer = steerRate * deltaSec;
        const steerAmount =
          Math.abs(angleDiff) < maxSteer
            ? angleDiff
            : Math.sign(angleDiff) * maxSteer;
        const newVelAngle = velAngle + steerAmount;

        let newSpeed = currentSpeed;
        if (turnSharpness > 0.25) {
          const brakeIntensity = ((turnSharpness - 0.25) / 0.75) * speedRatio;
          newSpeed *= Math.pow(1.0 - this.sharpTurnBrake * brakeIntensity, dt);
        }

        if (newSpeed < maxSpeed) {
          newSpeed = Math.min(maxSpeed, newSpeed + this.acceleration * dt);
        } else if (newSpeed > maxSpeed) {
          newSpeed += (maxSpeed - newSpeed) * (1 - Math.pow(1 - this.speedReduceLerp, dt));
        }

        this.velocityX = Math.sin(newVelAngle) * newSpeed;
        this.velocityZ = Math.cos(newVelAngle) * newSpeed;
      } else {
        // ── Direct acceleration from standstill ──
        this.velocityX += dirX * this.acceleration * dt;
        this.velocityZ += dirZ * this.acceleration * dt;

        const newSpeed = Math.hypot(this.velocityX, this.velocityZ);
        if (newSpeed > maxSpeed) {
          const s = maxSpeed / newSpeed;
          this.velocityX *= s;
          this.velocityZ *= s;
        }
      }
    } else {
      // ── Deceleration (momentum) ──
      const decay = Math.pow(this.deceleration, dt);
      this.velocityX *= decay;
      this.velocityZ *= decay;

      if (Math.hypot(this.velocityX, this.velocityZ) < this.stopThreshold) {
        this.velocityX = 0;
        this.velocityZ = 0;
      }
    }
  }

  /** Apply position change with optional bounds / stop collision. */
  protected updatePosition(stops: Stop[]): void {
    const dt = this.dt;
    const newX = this.group.position.x + this.velocityX * dt;
    const newZ = this.group.position.z + this.velocityZ * dt;

    let finalX = this.group.position.x;
    let finalZ = this.group.position.z;

    const checkBounds = this.respectsMapBounds;
    const checkStops = this.collidesWithStops;

    const canMoveX =
      (!checkBounds || isInsideMap(newX, this.group.position.z, this.radius)) &&
      (!checkStops ||
        !getCollidingStop(newX, this.group.position.z, stops, this.radius));
    const canMoveZ =
      (!checkBounds || isInsideMap(this.group.position.x, newZ, this.radius)) &&
      (!checkStops ||
        !getCollidingStop(this.group.position.x, newZ, stops, this.radius));

    if (canMoveX) finalX = newX;
    else this.velocityX = 0;

    if (canMoveZ) finalZ = newZ;
    else this.velocityZ = 0;

    if (
      (checkBounds && !isInsideMap(finalX, finalZ, this.radius)) ||
      (checkStops && getCollidingStop(finalX, finalZ, stops, this.radius))
    ) {
      finalX = this.group.position.x;
      finalZ = this.group.position.z;
      this.velocityX = 0;
      this.velocityZ = 0;
    }

    this.group.position.x = finalX;
    this.group.position.z = finalZ;
  }

  /** Update visual rotation (face velocity direction) and body lean. */
  protected updateRotationAndLean(deltaSec: number): void {
    const updatedSpeed = Math.hypot(this.velocityX, this.velocityZ);

    if (updatedSpeed > this.stopThreshold) {
      this.targetRotationY =
        Math.atan2(-this.velocityX, -this.velocityZ) + Math.PI;
    }

    const speedRatio = Math.min(1, updatedSpeed / this.runSpeed);
    const visualTurnRate =
      this.turnVisualSlow +
      (this.turnVisualFast - this.turnVisualSlow) * speedRatio;
    const rotLerp = 1 - Math.exp(-visualTurnRate * deltaSec);

    const rotDiff = this.shortestAngleDist(
      this.group.rotation.y,
      this.targetRotationY,
    );
    this.group.rotation.y += rotDiff * rotLerp;

    // ── Lean into turns ──
    const angularVel = deltaSec > 0 ? rotDiff / deltaSec : 0;
    const targetLean = Math.max(
      -this.leanMax,
      Math.min(this.leanMax, angularVel * this.leanSensitivity * speedRatio),
    );
    const leanLerp = 1 - Math.exp(-this.leanSmooth * deltaSec);
    this.currentLean += (targetLean - this.currentLean) * leanLerp;
    this.group.rotation.z = this.currentLean;
  }

  /**
   * Update animation state (idle / walk / run).
   * Override in subclass for character-specific animations (e.g. wave, sit).
   */
  protected updateAnimations(deltaSec: number, input: MovementInput): void {
    if (!this.mixer) return;
    this.mixer.update(deltaSec);
    this.lockModelY();

    const updatedSpeed = Math.hypot(this.velocityX, this.velocityZ);
    this.selectLocomotionAnimation(updatedSpeed, input.hasInput);
  }

  /** Pick idle / walk / run based on current speed. */
  protected selectLocomotionAnimation(speed: number, hasInput: boolean): void {
    if (hasInput || speed > this.stopThreshold) {
      if (speed > this.runAnimThreshold && this.runAction) {
        if (this.activeAction !== this.runAction) {
          this.switchAction(this.runAction, 0.2);
        }
        this.runAction.setEffectiveTimeScale(
          Math.max(0.6, speed / this.runSpeed),
        );
      } else if (this.walkAction) {
        if (this.activeAction !== this.walkAction) {
          const fadeTime = this.activeAction === this.runAction ? 0.3 : 0.15;
          this.switchAction(this.walkAction, fadeTime);
        }
        this.walkAction.setEffectiveTimeScale(
          Math.max(0.4, Math.min(1.5, speed / this.walkSpeed)),
        );
      }
    } else {
      if (this.idleAction && this.activeAction !== this.idleAction) {
        const fadeTime = this.activeAction === this.runAction ? 0.3 : 0.2;
        this.switchAction(this.idleAction, fadeTime);
      }
    }
  }

  /** Cross-fade to a new animation action. */
  protected switchAction(
    newAction: AnimationAction | null,
    fadeTime = 0.15,
  ): void {
    if (!newAction || newAction === this.activeAction) return;
    if (this.activeAction) {
      this.activeAction.fadeOut(fadeTime);
    }
    newAction.reset().setEffectiveWeight(1).fadeIn(fadeTime).play();
    this.activeAction = newAction;
  }

  /**
   * Discover the skeleton root bone and store its bind-pose Y position.
   * Call once after model loading (before or right after first animation frame).
   * The root bone is identified as the first Bone whose parent is not a Bone.
   */
  protected initRootBoneLock(model: THREE.Object3D): void {
    model.traverse((child: THREE.Object3D) => {
      if (this.rootBone) return; // already found
      if ((child as THREE.Bone).isBone) {
        const parent = child.parent;
        if (!parent || !(parent as THREE.Bone).isBone) {
          this.rootBone = child as THREE.Bone;
          this.rootBoneBaseY = this.rootBone.position.y;
        }
      }
    });
  }

  /**
   * Reset the character model's Y position **and** the skeleton root bone's
   * Y position to their stored base values.
   * Prevents walk/run/wave animations from sinking the character below ground.
   */
  protected lockModelY(): void {
    if (this.characterModel) {
      this.characterModel.position.y = this.modelBaseY;
    }
    if (this.rootBone) {
      this.rootBone.position.y = this.rootBoneBaseY;
    }
  }

  // ──────────────────────────────────────────────────────────────────
  //  Model-loading utilities (protected static – for subclass factories)
  // ──────────────────────────────────────────────────────────────────

  /**
   * Load a GLTF model, scale it to `targetHeight`, and position feet at y = 0.
   */
  protected static async loadCharacterModel(
    loader: GLTFLoader,
    url: string,
    targetHeight: number,
  ): Promise<THREE.Object3D> {
    const gltf = await new Promise<GLTF>((resolve, reject) =>
      loader.load(url, resolve, undefined, reject),
    );

    const model = gltf.scene;
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = targetHeight / maxDim;
    model.scale.setScalar(scale);

    box.setFromObject(model);
    model.position.y = -box.min.y;

    return model;
  }

  /** Configure shadow casting and PBR material defaults on a model. */
  protected static setupModelMaterials(model: THREE.Object3D): void {
    model.traverse((child: THREE.Object3D) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        const materials = Array.isArray(mesh.material)
          ? mesh.material
          : [mesh.material];
        for (const mat of materials) {
          mat.depthWrite = true;
          mat.depthTest = true;
          mat.transparent = false;
          mat.side = THREE.FrontSide;
          const stdMat = mat as THREE.MeshStandardMaterial;
          if (stdMat.alphaMap || stdMat.map?.format === THREE.RGBAFormat) {
            mat.alphaTest = 0.5;
          }
          if (stdMat.isMeshStandardMaterial) {
            stdMat.roughness = Math.max(stdMat.roughness || 0.5, 0.8);
            stdMat.metalness = Math.min(stdMat.metalness || 0.5, 0.1);
            stdMat.envMapIntensity = 0.3;
          }
        }
      }
    });
  }

  /**
   * Flatten the Y component in every `.position` track of a clip.
   * Each track's Y values are replaced with the track's first-keyframe Y,
   * so animations never pull the character above or below the ground.
   */
  protected static stripPositionY(clip: THREE.AnimationClip): void {
    for (const track of clip.tracks) {
      if (!track.name.endsWith(".position")) continue;

      const v = track.values;
      const firstY = v[1]; // Y of the first keyframe (indices: x0,y0,z0,x1,y1,z1,…)
      for (let i = 1; i < v.length; i += 3) {
        v[i] = firstY;
      }
    }
  }

  /**
   * Remove ALL `.position` tracks from a clip.
   * After this, the mixer will only apply rotation/quaternion/scale changes
   * and never modify any bone's position. Useful when character grounding
   * is fully managed by code (root bone lock + procedural bounce).
   */
  protected static removePositionTracks(clip: THREE.AnimationClip): void {
    clip.tracks = clip.tracks.filter(
      (track) => !track.name.endsWith(".position"),
    );
  }

  /**
   * Load a single animation clip and register it on the mixer.
   *
   * `positionTrackMode`:
   *  - `"keep"` (default) – leave position tracks untouched
   *  - `"stripY"` – flatten Y in position tracks to first-keyframe value
   *  - `"remove"` – delete all position tracks entirely
   */
  protected static async loadAnimationClip(
    mixer: THREE.AnimationMixer,
    model: THREE.Object3D,
    loader: GLTFLoader,
    url: string,
    name: string,
    positionTrackMode: "keep" | "stripY" | "remove" = "keep",
  ): Promise<AnimationAction | null> {
    try {
      const gltf = await new Promise<GLTF>((resolve, reject) =>
        loader.load(url, resolve, undefined, reject),
      );
      if (gltf.animations.length > 0) {
        const clip = gltf.animations[0];
        if (positionTrackMode === "stripY") {
          BaseCharacter.stripPositionY(clip);
        } else if (positionTrackMode === "remove") {
          BaseCharacter.removePositionTracks(clip);
        }
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
  }
}
