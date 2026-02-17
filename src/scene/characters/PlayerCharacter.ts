import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { AnimationAction, Scene } from "three";
import {
  getInputDirection,
  isKeyPressed,
} from "../../controls/keyboardController";
import { BaseCharacter } from "./BaseCharacter";
import type { MovementInput } from "./types";

// ── Player-specific constants ────────────────────────────────────────
export const PLAYER_RADIUS = 0.5;
export const PLAYER_WALK_SPEED = 0.02;
export const PLAYER_RUN_SPEED = 0.055;
export const PLAYER_ACCELERATION = 0.012;
export const PLAYER_DECELERATION = 0.88;

/**
 * The main player character controlled via keyboard input.
 *
 * Extends BaseCharacter with:
 *  - WASD / Arrow-key movement
 *  - Shift-to-run
 *  - Wave animation (used during the intro sequence)
 *
 * Future sibling classes (PetCharacter, BugCharacter, …) will extend
 * BaseCharacter with their own input strategies and unique animations.
 */
export class PlayerCharacter extends BaseCharacter {
  private waveAction: AnimationAction | null = null;

  private constructor(group: THREE.Group) {
    super(group, {
      radius: PLAYER_RADIUS,
      walkSpeed: PLAYER_WALK_SPEED,
      runSpeed: PLAYER_RUN_SPEED,
      acceleration: PLAYER_ACCELERATION,
      deceleration: PLAYER_DECELERATION,
    });
  }

  // ──────────────────────────────────────────────────────────────────
  //  Movement input – reads keyboard state
  // ──────────────────────────────────────────────────────────────────

  protected getMovementInput(): MovementInput {
    const dir = getInputDirection();
    const isRunning = isKeyPressed("ShiftLeft") || isKeyPressed("ShiftRight");
    return {
      dirX: dir.x,
      dirZ: dir.z,
      maxSpeed: isRunning ? this.runSpeed : this.walkSpeed,
      hasInput: dir.x !== 0 || dir.z !== 0,
    };
  }

  // ──────────────────────────────────────────────────────────────────
  //  Wave animation (player-specific)
  // ──────────────────────────────────────────────────────────────────

  playWave(loop = false): void {
    if (!this.waveAction) return;

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

  isWaving(): boolean {
    return (
      this.activeAction === this.waveAction &&
      this.waveAction !== null &&
      this.waveAction.isRunning()
    );
  }

  override get animationStateName(): string {
    if (this.activeAction === this.waveAction) return "wave";
    return super.animationStateName;
  }

  override getDebugInfo(): Record<string, string> {
    const base = super.getDebugInfo();
    const isRunning = isKeyPressed("ShiftLeft") || isKeyPressed("ShiftRight");
    return {
      ...base,
      input: isRunning ? "run" : "walk",
      waving: this.isWaving() ? "yes" : "no",
    };
  }

  // ──────────────────────────────────────────────────────────────────
  //  Animation override – adds wave handling
  // ──────────────────────────────────────────────────────────────────

  protected override updateAnimations(
    deltaSec: number,
    input: MovementInput,
  ): void {
    if (!this.mixer) return;
    this.mixer.update(deltaSec);
    this.lockModelY();

    const updatedSpeed = Math.hypot(this.velocityX, this.velocityZ);

    if (input.hasInput || updatedSpeed > this.stopThreshold) {
      // Moving → standard locomotion
      this.selectLocomotionAnimation(updatedSpeed, input.hasInput);
    } else if (this.activeAction === this.waveAction && this.waveAction) {
      // Waving → wait until wave finishes, then return to idle
      if (!this.waveAction.isRunning()) {
        this.switchAction(this.idleAction);
      }
    } else {
      // Standing still → idle
      this.selectLocomotionAnimation(updatedSpeed, input.hasInput);
    }
  }

  // ──────────────────────────────────────────────────────────────────
  //  Factory
  // ──────────────────────────────────────────────────────────────────

  static async create(
    scene: Scene,
    onAssetLoaded?: () => void,
  ): Promise<PlayerCharacter> {
    const group = new THREE.Group();
    group.position.set(0, 0, 0);
    // YZX order: yaw (Y) applied first, then lean/roll (Z) in character-local space
    group.rotation.order = "YZX";
    scene.add(group);

    const controller = new PlayerCharacter(group);
    const loader = new GLTFLoader();

    try {
      // Load and set up the base model (idle pose)
      const model = await BaseCharacter.loadCharacterModel(
        loader,
        "/models/Meshy_AI_Animation_Idle_11_withSkin.glb",
        0.4,
      );
      BaseCharacter.setupModelMaterials(model);
      group.add(model);

      // Store model reference and its base Y for animation Y-lock
      controller.characterModel = model;
      controller.modelBaseY = model.position.y;

      onAssetLoaded?.();

      // Create animation mixer
      const mixer = new THREE.AnimationMixer(model);
      controller.mixer = mixer;

      // Helper – load clip, strip Y root motion, and report progress
      const load = async (url: string, name: string) => {
        const action = await BaseCharacter.loadAnimationClip(
          mixer,
          model,
          loader,
          url,
          name,
          "stripY", // flatten Y in position tracks – grounding is managed by code
        );
        onAssetLoaded?.();
        return action;
      };

      controller.idleAction = await load(
        "/models/Meshy_AI_Animation_Idle_11_withSkin.glb",
        "idle",
      );
      controller.walkAction = await load(
        "/models/Meshy_AI_Animation_Walking_withSkin.glb",
        "walk",
      );
      controller.runAction = await load(
        "/models/Meshy_AI_Animation_Running_withSkin.glb",
        "run",
      );
      controller.waveAction = await load(
        "/models/Meshy_AI_Animation_Wave_One_Hand_withSkin.glb",
        "wave",
      );

      // Start in idle
      if (controller.idleAction) {
        controller.idleAction.reset().setEffectiveWeight(1).play();
        controller.activeAction = controller.idleAction;
      }

      // Apply one frame of idle, then capture the root bone's Y position.
      // This is the "correct" Y that keeps feet on the ground.
      mixer.update(0);
      controller.initRootBoneLock(model);

      return controller;
    } catch (error) {
      console.error("Failed to load character:", error);
      throw error;
    }
  }
}
