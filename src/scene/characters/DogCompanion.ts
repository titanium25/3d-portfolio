import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { Scene } from "three";
import { BaseCharacter } from "./BaseCharacter";
import type { MovementInput } from "./types";
import type { Stop } from "../types";
import { isInsideMap } from "../bounds";

// ── Dog physics ──────────────────────────────────────────────────────
const DOG_RADIUS = 0.25;
const PLAYER_COLLISION_RADIUS = 0.5; // must match PLAYER_RADIUS
const MIN_SEPARATION = DOG_RADIUS + PLAYER_COLLISION_RADIUS;
const DOG_WALK_SPEED = 0.016; // clearly slower than player — relaxed trot
const DOG_RUN_SPEED = 0.065; // can keep up when needed but not frantic
const DOG_ACCELERATION = 0.004; // gentle acceleration
const DOG_DECELERATION = 0.91;
const DOG_MODEL_HEIGHT = 0.38;

// ── Follow behaviour ─────────────────────────────────────────────────
const FOLLOW_OFFSET_SIDE = -0.5; // lateral offset so dog isn't directly in line
const FOLLOW_OFFSET_BEHIND = 2.2; // distance behind player — keeps dog out from under feet
const ARRIVE_RADIUS = 0.5; // stop moving when this close to target
const MIN_DISTANCE_FROM_PLAYER = 1.0; // never aim closer than this (avoids "under feet")
const CATCH_UP_RADIUS = 3.5; // start sprinting when this far
const TELEPORT_RADIUS = 10; // snap to player if absurdly far

// ── Realistic reaction – dog ignores slight movement, only follows clear intent ───
/** Only count movement above this per-frame (filters out jitter / tiny shuffles). */
const MIN_MOVEMENT_FOR_COMMIT = 0.018;
/** Player must travel this far before dog "decides" to follow. */
const COMMIT_DISTANCE = 2.2;
/** …or walk continuously for this long (sustained intent). */
const COMMIT_TIME = 1.0;
const COMMIT_TIME_RUNNING = 0.5; // still wait when player sprints
/** After player has "committed", dog waits this long before getting up. */
const REACTION_DELAY = 0.45;
const SETTLE_IDLE_TIME = 0.9; // player must stand still this long before dog settles

// ── Position history ─────────────────────────────────────────────────
const HISTORY_SAMPLE_INTERVAL = 0.04; // record every 40 ms
const HISTORY_MAX_AGE = 2.0; // trim entries older than 2 s

// ── Procedural idle tuning ──────────────────────────────────────────
const TAIL_WAG_SPEED = 5.0; // oscillations per second
const TAIL_WAG_AMPLITUDE = 0.35; // max rotation per tail bone
const TAIL_CURL_BIAS = 0.15; // slight upward curl at rest
const BODY_BREATHE_SPEED = 1.2; // breathing cycle speed
const HEAD_BOB_SPEED = 0.8; // slow gentle head movement
const HEAD_BOB_AMPLITUDE = 0.04; // very subtle nod
const IDLE_BLEND_IN_SPEED = 2.0; // idle fades in  (0→1 in ~0.5 s)
const IDLE_BLEND_OUT_SPEED = 4.0; // idle fades out (1→0 in ~0.25 s)

// ── Procedural running gait tuning ──────────────────────────────────
const RUN_GAIT_BLEND_IN = 3.5; // how fast run gait blends in
const RUN_GAIT_BLEND_OUT = 2.5; // how fast run gait blends out
const RUN_BOUNCE_SPEED = 16.0; // vertical bounce frequency
const RUN_BOUNCE_AMPLITUDE = 0.012; // metres — subtle gallop hop
const RUN_SPINE_SPEED = 16.0; // spine compression/extension freq
const RUN_SPINE_AMPLITUDE = 0.06; // radians — galloping flex
const RUN_HEAD_SPEED = 16.0; // head pump freq (synced with stride)
const RUN_HEAD_AMPLITUDE = 0.045; // radians — head bobs down on landing
const RUN_TAIL_WAG_SPEED = 2.0; // slower tail wag when sprinting
const RUN_TAIL_WAG_AMPLITUDE = 0.08; // less side-to-side
const RUN_TAIL_EXTEND = 0.35; // tail streams behind (X rotation bias)
const RUN_WALK_TIMESCALE_MAX = 2.2; // walk clip max speed-up for run
const DOG_RUN_SPEED_THRESHOLD = 0.028; // speed above which run gait kicks in

// ── Settle-behind tuning ─────────────────────────────────────────────
const SETTLE_STEER_SPEED = 0.02; // slow drift to "behind" position
const SETTLE_ARRIVE_RADIUS = 0.3; // close enough to stop settling
const SETTLE_FACE_LERP = 2.0; // how fast dog turns to face player direction

// ── Player-running detection ─────────────────────────────────────────
const PLAYER_RUN_THRESHOLD = 0.055; // speed above player walk = running

/** Common bone-name patterns used to auto-detect skeleton parts. */
const TAIL_PATTERNS = [/tail/i, /queue/i];
const SPINE_PATTERNS = [/spine/i, /body/i, /torso/i];
const HEAD_PATTERNS = [/head/i, /skull/i];

/**
 * Stores a bone's rest-pose rotation so we can slerp legs (and the
 * whole skeleton) back to a standing pose without touching scale or
 * position — which avoids the size-change bug.
 */
interface BoneRestPose {
  bone: THREE.Bone;
  restQ: THREE.Quaternion;
}

/**
 * A loyal husky companion that follows the player around the map.
 *
 * Has a walk animation, a **procedural idle** (tail wag, breathing,
 * head bob), and a **procedural running gait** (gallop bounce, spine
 * flex, head pump, tail streaming) — no extra GLB needed.
 *
 * The dog automatically runs when the player sprints and settles
 * directly behind the player when they stop.
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

  /** Rotation only updated when the player is actually translating. */
  private lastMovingRotY = 0;
  private prevTargetX = 0;
  private prevTargetZ = 0;

  // ── Resting / following / settling state machine ───────────────────
  private dogState: "resting" | "following" | "settling" = "resting";
  private playerTravelAccum = 0;
  private playerMovingTime = 0;
  private playerIdleTime = 0;
  /** After player "commits" to leaving, dog waits this long before getting up. */
  private reactionDelayTimer = 0;

  // ── Player speed tracking ──────────────────────────────────────────
  private playerSpeed = 0;
  private playerIsRunning = false;

  // ── Procedural idle bones ──────────────────────────────────────────
  private allBones: BoneRestPose[] = [];
  private tailBones: BoneRestPose[] = [];
  private spineBones: BoneRestPose[] = [];
  private headBones: BoneRestPose[] = [];
  private idleTime = 0;
  private idleBlend = 0; // 0 = fully walk, 1 = fully procedural idle

  // ── Procedural run gait ────────────────────────────────────────────
  private runGaitBlend = 0; // 0 = walk gait, 1 = full run gait
  private runGaitTime = 0; // accumulated time for run oscillations
  private baseY = 0; // ground-level Y for bounce reference

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

    // ── Resting: dog stays put ───────────────────────────────────────
    if (this.dogState === "resting") {
      return noInput;
    }

    // ── Settling: gently drift to the "behind" position ──────────────
    if (this.dogState === "settling") {
      const behind = this.getBehindPosition();
      const dx = behind.x - this.group.position.x;
      const dz = behind.z - this.group.position.z;
      const dist = Math.hypot(dx, dz);

      if (dist < SETTLE_ARRIVE_RADIUS) {
        this.dogState = "resting";
        return noInput;
      }

      return {
        dirX: dx / dist,
        dirZ: dz / dist,
        maxSpeed: SETTLE_STEER_SPEED,
        hasInput: true,
      };
    }

    // ── Following: goal is always FOLLOW_OFFSET_BEHIND current player ──
    // Behind = opposite of player forward (in Three.js rotY=0 => forward -Z, so behind = -Z).
    const rotY = this.lastMovingRotY;
    const cos = Math.cos(rotY);
    const sin = Math.sin(rotY);
    const goalX =
      this.target.position.x -
      sin * FOLLOW_OFFSET_BEHIND +
      cos * FOLLOW_OFFSET_SIDE;
    const goalZ =
      this.target.position.z -
      cos * FOLLOW_OFFSET_BEHIND -
      sin * FOLLOW_OFFSET_SIDE;

    const dx = goalX - this.group.position.x;
    const dz = goalZ - this.group.position.z;
    const distToGoal = Math.hypot(dx, dz);
    const distToPlayer = Math.hypot(
      this.group.position.x - this.target.position.x,
      this.group.position.z - this.target.position.z,
    );

    // Close enough to goal → stop (unless we're too close to player — then keep moving to goal)
    if (
      distToGoal < ARRIVE_RADIUS &&
      distToPlayer >= MIN_DISTANCE_FROM_PLAYER
    ) {
      return noInput;
    }
    // If we're under the player's feet, always move toward the behind position
    if (distToPlayer < MIN_DISTANCE_FROM_PLAYER && distToGoal < 0.15) {
      // Already at goal but too close (goal was in front of player) — use getBehindPosition
      const behind = this.getBehindPosition();
      const bdx = behind.x - this.group.position.x;
      const bdz = behind.z - this.group.position.z;
      const bdist = Math.hypot(bdx, bdz);
      if (bdist >= 0.1) {
        return {
          dirX: bdx / bdist,
          dirZ: bdz / bdist,
          maxSpeed: this.walkSpeed,
          hasInput: true,
        };
      }
    }
    const dist = distToGoal;
    if (dist < 0.05) return noInput;

    const dirX = dx / dist;
    const dirZ = dz / dist;

    // ── Speed: ramps with distance + matches player running state ──
    let maxSpeed: number;
    if (this.playerIsRunning) {
      // Player is sprinting → dog sprints too, scaling with distance
      const baseFactor = 0.75;
      const distFactor = Math.min(1, dist / CATCH_UP_RADIUS);
      const factor = baseFactor + (1.0 - baseFactor) * distFactor;
      maxSpeed = this.runSpeed * factor;
    } else if (dist > CATCH_UP_RADIUS) {
      maxSpeed = this.runSpeed;
    } else {
      const t = (dist - ARRIVE_RADIUS) / (CATCH_UP_RADIUS - ARRIVE_RADIUS);
      maxSpeed =
        this.walkSpeed + (this.runSpeed - this.walkSpeed) * Math.min(1, t);
    }

    return { dirX, dirZ, maxSpeed, hasInput: true };
  }

  /** Compute the "directly behind the player" world position. */
  private getBehindPosition(): { x: number; z: number } {
    const rotY = this.target.rotation.y;
    const cos = Math.cos(rotY);
    const sin = Math.sin(rotY);
    const desiredX =
      this.target.position.x -
      sin * FOLLOW_OFFSET_BEHIND +
      cos * FOLLOW_OFFSET_SIDE;
    const desiredZ =
      this.target.position.z -
      cos * FOLLOW_OFFSET_BEHIND -
      sin * FOLLOW_OFFSET_SIDE;

    return this.clampPointInsideMap(
      desiredX,
      desiredZ,
      this.target.position.x,
      this.target.position.z,
    );
  }

  /**
   * Keep a desired dog position on the playable area by walking it back toward
   * a known-safe fallback point. This prevents "behind the player" offsets and
   * separation pushes from placing the dog beyond the platform edge.
   */
  private clampPointInsideMap(
    desiredX: number,
    desiredZ: number,
    fallbackX: number,
    fallbackZ: number,
  ): { x: number; z: number } {
    if (isInsideMap(desiredX, desiredZ, this.radius)) {
      return { x: desiredX, z: desiredZ };
    }

    let safeX = fallbackX;
    let safeZ = fallbackZ;
    if (!isInsideMap(safeX, safeZ, this.radius)) {
      if (
        isInsideMap(this.group.position.x, this.group.position.z, this.radius)
      ) {
        safeX = this.group.position.x;
        safeZ = this.group.position.z;
      } else if (
        isInsideMap(this.target.position.x, this.target.position.z, this.radius)
      ) {
        safeX = this.target.position.x;
        safeZ = this.target.position.z;
      } else {
        return { x: this.group.position.x, z: this.group.position.z };
      }
    }

    let insideX = safeX;
    let insideZ = safeZ;
    let outsideX = desiredX;
    let outsideZ = desiredZ;

    for (let i = 0; i < 12; i++) {
      const midX = (insideX + outsideX) * 0.5;
      const midZ = (insideZ + outsideZ) * 0.5;
      if (isInsideMap(midX, midZ, this.radius)) {
        insideX = midX;
        insideZ = midZ;
      } else {
        outsideX = midX;
        outsideZ = midZ;
      }
    }

    const backX = safeX - insideX;
    const backZ = safeZ - insideZ;
    const backLen = Math.hypot(backX, backZ);
    if (backLen > 0.0001) {
      const inset = 0.02;
      return {
        x: insideX + (backX / backLen) * inset,
        z: insideZ + (backZ / backLen) * inset,
      };
    }

    return { x: insideX, z: insideZ };
  }

  // ──────────────────────────────────────────────────────────────────
  //  Update – record history, track player speed, run base physics
  // ──────────────────────────────────────────────────────────────────

  override update(deltaSec: number, stops: Stop[]): void {
    this.trackPlayerSpeed(deltaSec);
    // Must run updateDogState before recordHistory so prevTargetX/Z still hold
    // last frame's position (recordHistory updates them to current).
    this.updateDogState(deltaSec);
    this.recordHistory(deltaSec);

    // Teleport if way too far behind (e.g. after transition / cutscene)
    const dx = this.target.position.x - this.group.position.x;
    const dz = this.target.position.z - this.group.position.z;
    if (Math.hypot(dx, dz) > TELEPORT_RADIUS) {
      this.snapToPlayer();
    }

    super.update(deltaSec, stops);
    this.enforcePlayerSeparation();
  }

  /**
   * Run only idle animation (no movement). Use during intro so the dog shows
   * procedural idle (tail wag, breathing, head bob) instead of a frozen walk pose.
   */
  updateIdleOnly(deltaSec: number): void {
    if (!this.mixer) return;
    this.idleBlend = 1;
    this.runGaitBlend = 0;
    this.group.position.y = this.baseY;
    if (this.walkAction) {
      this.walkAction.setEffectiveWeight(1);
      this.walkAction.setEffectiveTimeScale(0);
      this.walkAction.paused = true;
    }
    this.mixer.update(deltaSec);
    this.lockModelY();
    this.idleTime += deltaSec;
    this.applyProceduralIdle(1);
  }

  /** Track the player's movement speed from position deltas. */
  private trackPlayerSpeed(_deltaSec: number): void {
    const dx = this.target.position.x - this.prevTargetX;
    const dz = this.target.position.z - this.prevTargetZ;
    const frameDist = Math.hypot(dx, dz);
    // Exponential smoothing
    this.playerSpeed += (frameDist - this.playerSpeed) * 0.15;
    this.playerIsRunning = this.playerSpeed > PLAYER_RUN_THRESHOLD;
  }

  /** Push the dog out if it overlaps the player. */
  private enforcePlayerSeparation(): void {
    const dx = this.group.position.x - this.target.position.x;
    const dz = this.group.position.z - this.target.position.z;
    const dist = Math.hypot(dx, dz);

    if (dist < MIN_SEPARATION && dist > 0.0001) {
      const nx = dx / dist;
      const nz = dz / dist;
      const desiredX = this.target.position.x + nx * MIN_SEPARATION;
      const desiredZ = this.target.position.z + nz * MIN_SEPARATION;
      const safePos = this.clampPointInsideMap(
        desiredX,
        desiredZ,
        this.group.position.x,
        this.group.position.z,
      );
      this.group.position.x = safePos.x;
      this.group.position.z = safePos.z;
      const dot = this.velocityX * nx + this.velocityZ * nz;
      if (dot < 0) {
        this.velocityX -= dot * nx;
        this.velocityZ -= dot * nz;
      }
    }
  }

  // ──────────────────────────────────────────────────────────────────
  //  State machine – resting ↔ following ↔ settling
  // ──────────────────────────────────────────────────────────────────

  private updateDogState(deltaSec: number): void {
    const posDelta = Math.hypot(
      this.target.position.x - this.prevTargetX,
      this.target.position.z - this.prevTargetZ,
    );
    const playerIsMoving = posDelta > DogCompanion.MOVE_THRESHOLD;
    // Only count "meaningful" movement (real steps), not tiny shuffles or jitter
    const meaningfulMove = posDelta > MIN_MOVEMENT_FOR_COMMIT;

    if (playerIsMoving) {
      if (meaningfulMove) {
        this.playerTravelAccum += posDelta;
        this.playerMovingTime += deltaSec;
      }
      this.playerIdleTime = 0;
    } else {
      this.playerIdleTime += deltaSec;
      this.reactionDelayTimer = 0; // Player stopped – dog "changes mind" about getting up
    }

    if (this.dogState === "resting") {
      // ── Decide whether the player has committed to walking away ──
      const commitTime = this.playerIsRunning
        ? COMMIT_TIME_RUNNING
        : COMMIT_TIME;
      const committed =
        this.playerTravelAccum > COMMIT_DISTANCE ||
        this.playerMovingTime > commitTime;

      // Once committed, advance reaction timer whenever player is still moving
      if (committed && playerIsMoving) {
        this.reactionDelayTimer += deltaSec;
        if (this.reactionDelayTimer >= REACTION_DELAY) {
          this.dogState = "following";
          this.reactionDelayTimer = 0;
        }
      } else if (!committed) {
        this.reactionDelayTimer = 0;
      }

      if (this.playerIdleTime > SETTLE_IDLE_TIME) {
        this.playerTravelAccum = 0;
        this.playerMovingTime = 0;
        this.reactionDelayTimer = 0;
      }
    } else if (this.dogState === "settling") {
      // ── If player starts moving again while dog is settling, follow ──
      const commitTime = this.playerIsRunning
        ? COMMIT_TIME_RUNNING
        : COMMIT_TIME;
      if (this.playerMovingTime > commitTime) {
        this.dogState = "following";
      }
    } else {
      // ── following → settling ──
      // Player stood still long enough AND dog has nearly stopped
      if (this.playerIdleTime > SETTLE_IDLE_TIME) {
        const speed = Math.hypot(this.velocityX, this.velocityZ);
        if (speed < this.stopThreshold) {
          // Transition through "settling" so the dog drifts behind
          this.dogState = "settling";
          this.playerTravelAccum = 0;
          this.playerMovingTime = 0;
        }
      }
    }
  }

  // ──────────────────────────────────────────────────────────────────
  //  Bone discovery – called once after model loads
  // ──────────────────────────────────────────────────────────────────

  private discoverBones(model: THREE.Object3D): void {
    const found: string[] = [];

    model.traverse((child) => {
      if (!(child instanceof THREE.Bone)) return;
      const name = child.name;
      found.push(name);

      const restQ = child.quaternion.clone();
      const entry: BoneRestPose = { bone: child, restQ };

      this.allBones.push(entry);

      for (const pat of TAIL_PATTERNS) {
        if (pat.test(name)) {
          this.tailBones.push(entry);
          return;
        }
      }
      for (const pat of SPINE_PATTERNS) {
        if (pat.test(name)) {
          this.spineBones.push(entry);
          return;
        }
      }
      for (const pat of HEAD_PATTERNS) {
        if (pat.test(name)) {
          this.headBones.push(entry);
          return;
        }
      }
    });

    console.log(
      `[DogCompanion] Skeleton bones (${found.length}):`,
      found.join(", "),
    );
    console.log(
      `[DogCompanion] Procedural targets → ` +
        `all(${this.allBones.length}) ` +
        `tail(${this.tailBones.length}) ` +
        `spine(${this.spineBones.length}) ` +
        `head(${this.headBones.length})`,
    );
  }

  // ──────────────────────────────────────────────────────────────────
  //  Animation – walk clip + procedural idle + procedural run gait
  // ──────────────────────────────────────────────────────────────────

  protected override updateAnimations(
    deltaSec: number,
    _input: MovementInput,
  ): void {
    if (!this.mixer) return;

    const speed = Math.hypot(this.velocityX, this.velocityZ);
    const isMoving = speed > this.stopThreshold;
    const isRunGait = speed > DOG_RUN_SPEED_THRESHOLD;

    // ── Idle blend factor ─────────────────────────────────────────
    if (isMoving) {
      this.idleBlend = Math.max(
        0,
        this.idleBlend - IDLE_BLEND_OUT_SPEED * deltaSec,
      );
    } else {
      this.idleBlend = Math.min(
        1,
        this.idleBlend + IDLE_BLEND_IN_SPEED * deltaSec,
      );
    }

    // ── Run gait blend factor ─────────────────────────────────────
    if (isRunGait) {
      this.runGaitBlend = Math.min(
        1,
        this.runGaitBlend + RUN_GAIT_BLEND_IN * deltaSec,
      );
    } else {
      this.runGaitBlend = Math.max(
        0,
        this.runGaitBlend - RUN_GAIT_BLEND_OUT * deltaSec,
      );
    }

    // ── Walk clip: weight stays at 1, only timeScale changes ──────
    if (this.walkAction) {
      this.walkAction.setEffectiveWeight(1);

      if (isMoving) {
        if (this.walkAction.paused) {
          this.walkAction.paused = false;
        }
        // Walk clip plays progressively faster for running — up to
        // RUN_WALK_TIMESCALE_MAX so the legs really churn
        const baseRate = speed / this.walkSpeed;
        const playRate = THREE.MathUtils.clamp(
          baseRate,
          0.35,
          RUN_WALK_TIMESCALE_MAX,
        );
        this.walkAction.setEffectiveTimeScale(playRate);
      } else {
        // Smoothly decelerate the clip to a freeze
        const cur = this.walkAction.getEffectiveTimeScale();
        const next = cur * 0.88;
        if (next < 0.05) {
          this.walkAction.setEffectiveTimeScale(0);
          this.walkAction.paused = true;
        } else {
          this.walkAction.setEffectiveTimeScale(next);
        }
      }
    }

    // Advance the mixer
    this.mixer.update(deltaSec);
    this.lockModelY();

    // ── Procedural run gait: applied AFTER mixer ──────────────────
    if (this.runGaitBlend > 0.001) {
      this.runGaitTime += deltaSec;
      this.applyProceduralRunGait(this.runGaitBlend, speed);
    } else {
      // Reset run time when not running so oscillations start fresh
      this.runGaitTime = 0;
    }

    // ── Procedural idle: applied AFTER mixer (and after run, if any) ─
    if (this.idleBlend > 0.001) {
      this.idleTime += deltaSec;
      this.applyProceduralIdle(this.idleBlend);
    }

    // ── When settling only: face the player's direction (so dog faces forward when it stops)
    // When resting: do NOT update rotation — avoids dog wiggling when player taps A/D
    if (this.dogState === "settling") {
      const targetRotY = this.target.rotation.y;
      const rotDiff = this.shortestAngleDist(this.group.rotation.y, targetRotY);
      const rotLerp = 1 - Math.exp(-SETTLE_FACE_LERP * deltaSec);
      this.group.rotation.y += rotDiff * rotLerp;
    }
  }

  // ──────────────────────────────────────────────────────────────────
  //  Procedural run gait — gallop bounce, spine flex, head pump, tail
  // ──────────────────────────────────────────────────────────────────

  /** Reusable scratch quaternion/euler to avoid per-frame allocations. */
  private static readonly _qRun = new THREE.Quaternion();
  private static readonly _eulerRun = new THREE.Euler();

  /**
   * Layered on top of the sped-up walk clip to sell a convincing gallop:
   *
   *  - **Vertical bounce**: abs(sin) double-bounce per stride cycle
   *  - **Spine flex**: compression on landing, extension mid-air
   *  - **Head pump**: nods down on each stride landing
   *  - **Tail streaming**: extends behind with reduced side wag
   *
   * Intensity scales with actual speed so the transition from trot
   * to full gallop is smooth and natural.
   */
  private applyProceduralRunGait(blend: number, speed: number): void {
    const t = this.runGaitTime;
    const { _qRun, _eulerRun } = DogCompanion;

    // Intensity ramps with how fast the dog is actually moving
    const speedIntensity = THREE.MathUtils.clamp(
      (speed - DOG_RUN_SPEED_THRESHOLD) /
        (this.runSpeed - DOG_RUN_SPEED_THRESHOLD),
      0,
      1,
    );
    const intensity = blend * speedIntensity;

    // ── Vertical bounce (gallop hop) ─────────────────────────────
    // abs(sin) gives a double-bounce per cycle, mimicking a real gallop
    const bouncePhase = Math.abs(Math.sin(t * RUN_BOUNCE_SPEED));
    this.group.position.y =
      this.baseY + bouncePhase * RUN_BOUNCE_AMPLITUDE * intensity;

    // ── Spine compression / extension (gallop flex) ──────────────
    const spinePhase = Math.sin(t * RUN_SPINE_SPEED);
    for (const { bone } of this.spineBones) {
      _eulerRun.set(spinePhase * RUN_SPINE_AMPLITUDE * intensity, 0, 0);
      _qRun.setFromEuler(_eulerRun);
      bone.quaternion.multiply(_qRun);
    }

    // ── Head pump (bobs down on each stride landing) ─────────────
    // Slightly phase-offset from spine for a natural wave effect
    const headPhase = Math.sin(t * RUN_HEAD_SPEED + Math.PI * 0.25);
    for (const { bone } of this.headBones) {
      _eulerRun.set(headPhase * RUN_HEAD_AMPLITUDE * intensity, 0, 0);
      _qRun.setFromEuler(_eulerRun);
      bone.quaternion.multiply(_qRun);
    }

    // ── Tail: streams behind with minimal wag ────────────────────
    for (let i = 0; i < this.tailBones.length; i++) {
      const { bone } = this.tailBones[i];
      const chainFactor = (i + 1) / this.tailBones.length;

      // Tail extends backward (negative X = down/behind for most rigs)
      const extend = -RUN_TAIL_EXTEND * chainFactor * intensity;
      // Reduced side-to-side wag
      const wag =
        Math.sin(t * RUN_TAIL_WAG_SPEED - i * 0.4) *
        RUN_TAIL_WAG_AMPLITUDE *
        chainFactor *
        intensity;

      _eulerRun.set(extend, wag, 0);
      _qRun.setFromEuler(_eulerRun);
      bone.quaternion.multiply(_qRun);
    }
  }

  // ──────────────────────────────────────────────────────────────────
  //  Procedural idle – rest-pose blend, tail wag, breathing, head bob
  // ──────────────────────────────────────────────────────────────────

  /** Reusable scratch quaternions to avoid per-frame allocations. */
  private static readonly _qProc = new THREE.Quaternion();
  private static readonly _euler = new THREE.Euler();

  /**
   * Two-pass procedural idle applied *after* the mixer update:
   *
   *  1. **Rest-pose blend** — slerp every bone toward its bind-pose
   *     quaternion by `blend`.
   *
   *  2. **Procedural effects** — layer tail wag, breathing, and head
   *     bob on top of the rest pose.
   */
  private applyProceduralIdle(blend: number): void {
    const t = this.idleTime;
    const { _qProc, _euler } = DogCompanion;

    // Reset Y to ground when idle (undo any run bounce)
    this.group.position.y = this.baseY;

    // ── Pass 1: Slerp ALL bone rotations toward rest pose ──────────
    for (const { bone, restQ } of this.allBones) {
      bone.quaternion.slerp(restQ, blend);
    }

    // ── Pass 2: Procedural effects on top of the rest pose ──────────

    // Tail wag — each successive bone gets a staggered, larger wag
    for (let i = 0; i < this.tailBones.length; i++) {
      const { bone } = this.tailBones[i];
      const chainFactor = (i + 1) / this.tailBones.length;
      const phase = t * TAIL_WAG_SPEED - i * 0.6;

      _euler.set(
        TAIL_CURL_BIAS * chainFactor * blend,
        Math.sin(phase) * TAIL_WAG_AMPLITUDE * chainFactor * blend,
        0,
      );
      _qProc.setFromEuler(_euler);
      bone.quaternion.multiply(_qProc);
    }

    // Spine breathing
    const breathPhase = Math.sin(t * BODY_BREATHE_SPEED * Math.PI * 2);
    for (const { bone } of this.spineBones) {
      _euler.set(breathPhase * 0.025 * blend, 0, 0);
      _qProc.setFromEuler(_euler);
      bone.quaternion.multiply(_qProc);
    }

    // Head bob — slow, gentle nod
    const headPhase = Math.sin(t * HEAD_BOB_SPEED * Math.PI * 2);
    for (const { bone } of this.headBones) {
      _euler.set(headPhase * HEAD_BOB_AMPLITUDE * blend, 0, 0);
      _qProc.setFromEuler(_euler);
      bone.quaternion.multiply(_qProc);
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
    const posDelta = Math.hypot(px - this.prevTargetX, pz - this.prevTargetZ);
    if (posDelta > DogCompanion.MOVE_THRESHOLD) {
      this.lastMovingRotY = this.target.rotation.y;
    }
    this.prevTargetX = px;
    this.prevTargetZ = pz;

    const now = performance.now() / 1000;
    this.posHistory.push({
      x: px,
      z: pz,
      rotY: this.lastMovingRotY,
      t: now,
    });

    // Trim entries older than HISTORY_MAX_AGE
    const cutoff = now - HISTORY_MAX_AGE;
    while (this.posHistory.length > 0 && this.posHistory[0].t < cutoff) {
      this.posHistory.shift();
    }
  }

  override getDebugInfo(): Record<string, string> {
    const base = super.getDebugInfo();
    const distToPlayer = Math.hypot(
      this.group.position.x - this.target.position.x,
      this.group.position.z - this.target.position.z,
    );
    return {
      ...base,
      state: this.dogState,
      "dist to player": distToPlayer.toFixed(2),
      "idle blend": this.idleBlend.toFixed(2),
      "run gait": this.runGaitBlend.toFixed(2),
      "player speed": this.playerSpeed.toFixed(4),
      "player running": this.playerIsRunning ? "yes" : "no",
    };
  }

  /** Instantly reposition the dog behind the player. */
  snapToPlayer(): void {
    const behind = this.getBehindPosition();
    this.group.position.x = behind.x;
    this.group.position.z = behind.z;
    this.group.position.y = this.baseY;
    this.velocityX = 0;
    this.velocityZ = 0;
    this.posHistory.length = 0;
  }

  /**
   * Call when intro ends (e.g. character is waving): put the dog behind the
   * character in resting idle so it doesn't start in front or in walk state.
   */
  resetToIdleBehindPlayer(): void {
    this.snapToPlayer();
    this.group.rotation.y = this.target.rotation.y;
    this.forceRestingIdle();
  }

  /** Force resting state and full procedural idle (used after intro). */
  private forceRestingIdle(): void {
    this.dogState = "resting";
    this.idleBlend = 1;
    this.reactionDelayTimer = 0;
    if (this.walkAction) {
      this.walkAction.setEffectiveTimeScale(0);
      this.walkAction.paused = true;
    }
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

      // Store model reference (grounding offset recomputed after first anim frame)
      companion.characterModel = model;

      // Discover skeleton bones for procedural idle & run gait
      companion.discoverBones(model);

      // Mixer + single walk clip
      const mixer = new THREE.AnimationMixer(model);
      companion.mixer = mixer;

      companion.walkAction = await BaseCharacter.loadAnimationClip(
        mixer,
        model,
        loader,
        "/models/Meshy_AI_model_Animation_Walking_withSkin_DOG.glb",
        "dog-walk",
        "remove", // remove ALL position tracks – dog grounding is fully managed by code
      );
      onAssetLoaded?.();

      // Start in idle: walk clip at full weight but frozen (timeScale 0)
      if (companion.walkAction) {
        companion.walkAction.reset().setEffectiveWeight(1).play();
        companion.walkAction.setEffectiveTimeScale(0);
        companion.walkAction.paused = true;
        companion.activeAction = companion.walkAction;
        companion.idleBlend = 1; // begin fully in procedural idle
      }

      // Apply one animation frame so bones settle into their actual pose.
      // The bind-pose bounding box can differ from the animated pose, causing
      // the model to float if we compute grounding before the first frame.
      mixer.update(0);

      // Recompute grounding from the animation-pose bounding box
      const box = new THREE.Box3().setFromObject(model);
      model.position.y = -box.min.y;
      companion.modelBaseY = model.position.y;

      // Capture root bone Y after animation frame (matches player init order)
      companion.initRootBoneLock(model);

      // Store ground-level Y for run bounce reference
      companion.baseY = group.position.y;

      return companion;
    } catch (error) {
      console.error("Failed to load dog companion:", error);
      throw error;
    }
  }
}
