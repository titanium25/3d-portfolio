import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { Scene } from "three";
import { BaseCharacter } from "./BaseCharacter";
import type { MovementInput } from "./types";
import type { Stop } from "../types";

// ── Dog physics ──────────────────────────────────────────────────────
const DOG_RADIUS = 0.25;
const PLAYER_COLLISION_RADIUS = 0.5; // must match PLAYER_RADIUS
const MIN_SEPARATION = DOG_RADIUS + PLAYER_COLLISION_RADIUS; // centres can't be closer
const DOG_WALK_SPEED = 0.028; // slower than player walk (0.04) — dog naturally trails
const DOG_RUN_SPEED = 0.065; // gentle catch-up, still below player run (0.1)
const DOG_ACCELERATION = 0.005;
const DOG_DECELERATION = 0.91;
const DOG_MODEL_HEIGHT = 0.38;

// ── Follow behaviour ─────────────────────────────────────────────────
const FOLLOW_OFFSET_SIDE = -0.4; // slight lateral offset so it's not directly in line
const FOLLOW_OFFSET_BEHIND = 1.5; // clearly behind the player
const FOLLOW_DELAY_SEC = 0.35; // seconds of positional delay
const ARRIVE_RADIUS = 0.4; // stop moving when this close to target
const CATCH_UP_RADIUS = 3.5; // start sprinting when this far
const TELEPORT_RADIUS = 10; // snap to player if absurdly far

// ── Realistic reaction ───────────────────────────────────────────────
// The dog doesn't get up until the player has clearly committed to walking.
const COMMIT_DISTANCE = 1.2; // player must travel this far before dog follows
const COMMIT_TIME = 0.4; // …or walk continuously for this many seconds
const SETTLE_IDLE_TIME = 0.8; // player must stand still this long before dog "settles"

// ── Position history ─────────────────────────────────────────────────
const HISTORY_SAMPLE_INTERVAL = 0.04; // record every 40 ms
const HISTORY_MAX_AGE = 2.0; // trim entries older than 2 s

/**
 * A loyal husky companion that follows the player around the map.
 *
 * Only has a walk animation — the class fakes an idle state by
 * gradually slowing the walk clip to a freeze, then unpausing
 * smoothly when movement resumes.
 */
export class DogCompanion extends BaseCharacter {
  // ── Follow state ───────────────────────────────────────────────────
  private readonly target: THREE.Group;
  private posHistory: Array<{
    x: number;
    z: number;
    rotY: number;
    t: number;
  }> = [];
  private historyTimer = 0;

  /** Rotation only updated when the player is actually translating.
   *  Prevents the dog from orbiting when the player turns on the spot. */
  private lastMovingRotY = 0;
  private prevTargetX = 0;
  private prevTargetZ = 0;

  // ── Resting / following state machine ──────────────────────────────
  // 'resting'  → dog is idle, watching the player, won't move for small movements
  // 'following' → dog is actively trotting after the player
  private dogState: "resting" | "following" = "resting";
  private playerTravelAccum = 0; // distance player has walked since last idle
  private playerMovingTime = 0; // seconds player has been continuously walking
  private playerIdleTime = 0; // seconds player has been standing still

  // ──────────────────────────────────────────────────────────────────
  //  Construction
  // ──────────────────────────────────────────────────────────────────

  private constructor(group: THREE.Group, playerGroup: THREE.Group) {
    super(group, {
      radius: DOG_RADIUS,
      walkSpeed: DOG_WALK_SPEED,
      runSpeed: DOG_RUN_SPEED,
      acceleration: DOG_ACCELERATION,
      deceleration: DOG_DECELERATION,
    });

    this.target = playerGroup;

    // Dog doesn't block stops – it walks around freely
    this.collidesWithStops = false;
    this.respectsMapBounds = true;

    // Softer steering – feels more organic
    this.steerRateSlow = 10;
    this.steerRateFast = 5;
    this.sharpTurnBrake = 0.2;
    this.leanMax = 0.05;
    this.speedReduceLerp = 0.08;
  }

  // ──────────────────────────────────────────────────────────────────
  //  Movement input – follow the player with delay + offset
  // ──────────────────────────────────────────────────────────────────

  protected getMovementInput(): MovementInput {
    const noInput: MovementInput = {
      dirX: 0,
      dirZ: 0,
      maxSpeed: 0,
      hasInput: false,
    };

    // ── Resting: dog stays put until the player commits to walking ────
    if (this.dogState === "resting") {
      return noInput;
    }

    // ── Following: standard follow logic ─────────────────────────────
    const delayed = this.sampleDelayed();

    // Offset rotates with the player's last *moving* direction
    // (turning on the spot does NOT shift the goal)
    const cos = Math.cos(delayed.rotY);
    const sin = Math.sin(delayed.rotY);
    const goalX =
      delayed.x + sin * FOLLOW_OFFSET_BEHIND + cos * FOLLOW_OFFSET_SIDE;
    const goalZ =
      delayed.z + cos * FOLLOW_OFFSET_BEHIND - sin * FOLLOW_OFFSET_SIDE;

    const dx = goalX - this.group.position.x;
    const dz = goalZ - this.group.position.z;
    const dist = Math.hypot(dx, dz);

    // Close enough → stop
    if (dist < ARRIVE_RADIUS) {
      return noInput;
    }

    const dirX = dx / dist;
    const dirZ = dz / dist;

    // Speed ramps up the further the dog falls behind
    let maxSpeed: number;
    if (dist > CATCH_UP_RADIUS) {
      maxSpeed = this.runSpeed;
    } else {
      const t =
        (dist - ARRIVE_RADIUS) / (CATCH_UP_RADIUS - ARRIVE_RADIUS);
      maxSpeed =
        this.walkSpeed + (this.runSpeed - this.walkSpeed) * Math.min(1, t);
    }

    return { dirX, dirZ, maxSpeed, hasInput: true };
  }

  // ──────────────────────────────────────────────────────────────────
  //  Update – record history, then run base physics
  // ──────────────────────────────────────────────────────────────────

  override update(deltaSec: number, stops: Stop[]): void {
    this.recordHistory(deltaSec);
    this.updateDogState(deltaSec);

    // Teleport if way too far behind (e.g. after transition / cutscene)
    const dx = this.target.position.x - this.group.position.x;
    const dz = this.target.position.z - this.group.position.z;
    if (Math.hypot(dx, dz) > TELEPORT_RADIUS) {
      this.snapToPlayer();
    }

    super.update(deltaSec, stops);
    this.enforcePlayerSeparation();
  }

  /** Push the dog out if it overlaps the player. */
  private enforcePlayerSeparation(): void {
    const dx = this.group.position.x - this.target.position.x;
    const dz = this.group.position.z - this.target.position.z;
    const dist = Math.hypot(dx, dz);

    if (dist < MIN_SEPARATION && dist > 0.0001) {
      // Nudge the dog outward along the separation axis
      const nx = dx / dist;
      const nz = dz / dist;
      this.group.position.x = this.target.position.x + nx * MIN_SEPARATION;
      this.group.position.z = this.target.position.z + nz * MIN_SEPARATION;
      // Kill velocity component that points toward the player
      const dot = this.velocityX * nx + this.velocityZ * nz;
      if (dot < 0) {
        this.velocityX -= dot * nx;
        this.velocityZ -= dot * nz;
      }
    }
  }

  // ──────────────────────────────────────────────────────────────────
  //  State machine – resting ↔ following
  // ──────────────────────────────────────────────────────────────────

  private updateDogState(deltaSec: number): void {
    // Measure whether the player is actually translating this frame
    const posDelta = Math.hypot(
      this.target.position.x - this.prevTargetX,
      this.target.position.z - this.prevTargetZ,
    );
    const playerIsMoving = posDelta > DogCompanion.MOVE_THRESHOLD;

    if (playerIsMoving) {
      this.playerTravelAccum += posDelta;
      this.playerMovingTime += deltaSec;
      this.playerIdleTime = 0;
    } else {
      this.playerIdleTime += deltaSec;
      // Don't reset travel/time immediately — player might just be
      // pausing for a fraction of a second mid-walk
    }

    if (this.dogState === "resting") {
      // ── Decide whether the player has committed to walking ──
      const committed =
        this.playerTravelAccum > COMMIT_DISTANCE ||
        this.playerMovingTime > COMMIT_TIME;

      if (committed) {
        this.dogState = "following";
        // Keep accumulators so the dog transitions naturally
      }

      // If the player started walking then stopped before committing,
      // reset the accumulators once they've been idle long enough
      if (this.playerIdleTime > SETTLE_IDLE_TIME) {
        this.playerTravelAccum = 0;
        this.playerMovingTime = 0;
      }
    } else {
      // ── following → resting ──
      // Player stood still long enough AND dog has arrived close to goal
      if (this.playerIdleTime > SETTLE_IDLE_TIME) {
        const speed = Math.hypot(this.velocityX, this.velocityZ);
        if (speed < this.stopThreshold) {
          this.dogState = "resting";
          this.playerTravelAccum = 0;
          this.playerMovingTime = 0;
        }
      }
    }
  }

  // ──────────────────────────────────────────────────────────────────
  //  Animation – walk-only, with synthetic idle
  // ──────────────────────────────────────────────────────────────────

  protected override updateAnimations(
    deltaSec: number,
    _input: MovementInput,
  ): void {
    if (!this.mixer) return;
    this.mixer.update(deltaSec);

    const speed = Math.hypot(this.velocityX, this.velocityZ);

    if (speed > this.stopThreshold && this.walkAction) {
      // Moving → ensure walk is playing and scale speed
      if (this.walkAction.paused) {
        this.walkAction.paused = false;
      }
      if (this.activeAction !== this.walkAction) {
        this.switchAction(this.walkAction, 0.15);
      }
      // Map movement speed to animation playback rate
      const playRate = THREE.MathUtils.clamp(
        speed / this.walkSpeed,
        0.35,
        2.0,
      );
      this.walkAction.setEffectiveTimeScale(playRate);
    } else if (this.walkAction) {
      // Stopped → gradually slow the walk clip to a freeze
      const cur = this.walkAction.getEffectiveTimeScale();
      const next = cur * 0.82; // exponential decay
      if (next < 0.06) {
        this.walkAction.setEffectiveTimeScale(0);
        this.walkAction.paused = true;
      } else {
        this.walkAction.setEffectiveTimeScale(next);
      }
    }
  }

  // ──────────────────────────────────────────────────────────────────
  //  Position-history helpers
  // ──────────────────────────────────────────────────────────────────

  /** Minimum positional delta to count as "player is translating". */
  private static readonly MOVE_THRESHOLD = 0.002;

  private recordHistory(deltaSec: number): void {
    this.historyTimer += deltaSec;
    if (this.historyTimer < HISTORY_SAMPLE_INTERVAL) return;
    this.historyTimer = 0;

    const px = this.target.position.x;
    const pz = this.target.position.z;

    // Only update the offset rotation when the player actually moves
    const posDelta = Math.hypot(
      px - this.prevTargetX,
      pz - this.prevTargetZ,
    );
    if (posDelta > DogCompanion.MOVE_THRESHOLD) {
      this.lastMovingRotY = this.target.rotation.y;
    }
    this.prevTargetX = px;
    this.prevTargetZ = pz;

    const now = performance.now() / 1000;
    this.posHistory.push({
      x: px,
      z: pz,
      rotY: this.lastMovingRotY, // store the "moving" rotation, not raw
      t: now,
    });

    // Trim entries older than HISTORY_MAX_AGE
    const cutoff = now - HISTORY_MAX_AGE;
    while (this.posHistory.length > 0 && this.posHistory[0].t < cutoff) {
      this.posHistory.shift();
    }
  }

  /** Interpolate position/rotation from the history at (now – delay). */
  private sampleDelayed(): { x: number; z: number; rotY: number } {
    const now = performance.now() / 1000;
    const tTarget = now - FOLLOW_DELAY_SEC;

    // Walk backwards to find the two samples that bracket tTarget
    for (let i = this.posHistory.length - 1; i >= 0; i--) {
      const a = this.posHistory[i];
      if (a.t <= tTarget) {
        const b = this.posHistory[i + 1];
        if (b) {
          const frac = (tTarget - a.t) / (b.t - a.t);
          return {
            x: a.x + (b.x - a.x) * frac,
            z: a.z + (b.z - a.z) * frac,
            rotY: a.rotY + this.shortestAngleDist(a.rotY, b.rotY) * frac,
          };
        }
        return { x: a.x, z: a.z, rotY: a.rotY };
      }
    }

    // No history yet → use live player position
    return {
      x: this.target.position.x,
      z: this.target.position.z,
      rotY: this.target.rotation.y,
    };
  }

  /** Instantly reposition the dog next to the player. */
  snapToPlayer(): void {
    const cos = Math.cos(this.target.rotation.y);
    const sin = Math.sin(this.target.rotation.y);
    this.group.position.x =
      this.target.position.x +
      sin * FOLLOW_OFFSET_BEHIND +
      cos * FOLLOW_OFFSET_SIDE;
    this.group.position.z =
      this.target.position.z +
      cos * FOLLOW_OFFSET_BEHIND -
      sin * FOLLOW_OFFSET_SIDE;
    this.velocityX = 0;
    this.velocityZ = 0;
    this.posHistory.length = 0;
  }

  // ──────────────────────────────────────────────────────────────────
  //  Factory
  // ──────────────────────────────────────────────────────────────────

  static async create(
    scene: Scene,
    playerGroup: THREE.Group,
    onAssetLoaded?: () => void,
  ): Promise<DogCompanion> {
    const group = new THREE.Group();
    group.rotation.order = "YZX";
    scene.add(group);

    const companion = new DogCompanion(group, playerGroup);

    // Start the dog next to the player
    companion.snapToPlayer();

    const loader = new GLTFLoader();

    try {
      const model = await BaseCharacter.loadCharacterModel(
        loader,
        "/models/Meshy_AI_model_Animation_Walking_withSkin_DOG.glb",
        DOG_MODEL_HEIGHT,
      );
      BaseCharacter.setupModelMaterials(model);
      group.add(model);
      onAssetLoaded?.();

      // Mixer + single walk clip
      const mixer = new THREE.AnimationMixer(model);
      companion.mixer = mixer;

      companion.walkAction = await BaseCharacter.loadAnimationClip(
        mixer,
        model,
        loader,
        "/models/Meshy_AI_model_Animation_Walking_withSkin_DOG.glb",
        "dog-walk",
      );
      onAssetLoaded?.();

      // Begin paused (synthetic idle) until the player starts moving
      if (companion.walkAction) {
        companion.walkAction.reset().setEffectiveWeight(1).play();
        companion.walkAction.paused = true;
        companion.activeAction = companion.walkAction;
      }

      return companion;
    } catch (error) {
      console.error("Failed to load dog companion:", error);
      throw error;
    }
  }
}
