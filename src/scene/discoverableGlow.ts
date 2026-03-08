/**
 * discoverableGlow.ts
 *
 * Ambient "interact-me" visual cues for discoverable 3D objects.
 * Each registered object gets:
 *  - Ground glow disc (warm amber, breathing scale-pulse, additive)
 *  - Floating beacon particles (4-6 motes drifting upward with sway)
 *  - Proximity intensification (opacity + speed ramp as player approaches)
 *  - Post-discovery state: color shifts to muted cyan, intensity dims
 *
 * Inspired by Korok sparkles (Zelda), loot glow (Destiny), and
 * chest embers (FromSoft) — universally understood "something's here" signal.
 */

import * as THREE from "three";
import { isDiscovered } from "../ui/discoveryTracker";
import { createRadialGlowTexture, createDotTexture } from "./textureUtils";

/* ── Palette ──────────────────────────────────────────────────────── */

const COL_AMBER    = 0xffaa44; // warm amber — distinct from cyan gates
const COL_CYAN_DIM = 0x00e5cc; // shifts to this after discovery

/* ── Tuning ───────────────────────────────────────────────────────── */

const PROX_RANGE        = 5.0;  // world units — proximity detection radius
const GLOW_IDLE_OPACITY = 0.14;
const GLOW_NEAR_OPACITY = 0.36;
const PART_IDLE_OPACITY = 0.35;
const PART_NEAR_OPACITY = 0.8;
const DISCOVERED_DIM    = 0.2;  // multiplier applied when already found

/* ── Internal state ───────────────────────────────────────────────── */

interface Beacon {
  object: THREE.Object3D;
  discoveryId: string;
  glowDisc: THREE.Mesh;
  glowMat: THREE.MeshBasicMaterial;
  particles: THREE.Points;
  particleMat: THREE.PointsMaterial;
  phases: Float32Array;
  baseXZ: Float32Array;
  riseHeight: number;
  count: number;
}

const beacons: Beacon[] = [];
const _wPos = new THREE.Vector3();

let sharedDot: THREE.CanvasTexture | null = null;
let sharedGlow: THREE.CanvasTexture | null = null;

/* ── Public API ───────────────────────────────────────────────────── */

export interface BeaconOpts {
  /** The Object3D (Group/Mesh) to parent the beacon effects onto. */
  object: THREE.Object3D;
  /** Discovery ID (matches discoveryTracker). */
  discoveryId: string;
  /** Glow disc radius in world units. Default 0.5. */
  radius?: number;
  /** Number of floating particles. Default 5. */
  count?: number;
  /** Max rise height for particles. Default 0.7. */
  rise?: number;
  /** Local Y base for the glow disc / particles. Default 0.01. */
  y?: number;
}

export function registerDiscoverableBeacon(opts: BeaconOpts): void {
  if (!sharedDot) sharedDot = createDotTexture(32);
  if (!sharedGlow) {
    sharedGlow = createRadialGlowTexture({
      size: 64,
      colorStops: [
        { offset: 0.0,  color: "rgba(255,255,255,0.7)" },
        { offset: 0.35, color: "rgba(255,255,255,0.3)" },
        { offset: 0.7,  color: "rgba(255,255,255,0.06)" },
        { offset: 1.0,  color: "rgba(255,255,255,0)" },
      ],
    });
  }

  const R     = opts.radius ?? 0.5;
  const N     = opts.count  ?? 5;
  const rise  = opts.rise   ?? 0.7;
  const yBase = opts.y      ?? 0.01;

  /* ── Ground glow disc ──────────────────────────────────────── */

  const glowGeom = new THREE.PlaneGeometry(R * 2, R * 2);
  const glowMat = new THREE.MeshBasicMaterial({
    map: sharedGlow,
    color: COL_AMBER,
    transparent: true,
    opacity: 0.0,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
  const glowDisc = new THREE.Mesh(glowGeom, glowMat);
  glowDisc.rotation.x = -Math.PI / 2;
  glowDisc.position.y = yBase;
  opts.object.add(glowDisc);

  /* ── Floating beacon particles ─────────────────────────────── */

  const posArr = new Float32Array(N * 3);
  const phases = new Float32Array(N);
  const baseXZ = new Float32Array(N * 2);

  for (let i = 0; i < N; i++) {
    const angle = (i / N) * Math.PI * 2 + Math.random() * 0.4;
    const r = R * 0.35 * (0.4 + Math.random() * 0.6);
    const x = Math.cos(angle) * r;
    const z = Math.sin(angle) * r;

    posArr[i * 3]     = x;
    posArr[i * 3 + 1] = Math.random() * rise;
    posArr[i * 3 + 2] = z;

    baseXZ[i * 2]     = x;
    baseXZ[i * 2 + 1] = z;

    phases[i] = Math.random();
  }

  const pGeom = new THREE.BufferGeometry();
  pGeom.setAttribute("position", new THREE.BufferAttribute(posArr, 3));

  const pMat = new THREE.PointsMaterial({
    color: COL_AMBER,
    size: 0.06,
    transparent: true,
    opacity: 0.0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    map: sharedDot,
  });

  const particles = new THREE.Points(pGeom, pMat);
  particles.position.y = yBase;
  opts.object.add(particles);

  beacons.push({
    object: opts.object,
    discoveryId: opts.discoveryId,
    glowDisc,
    glowMat,
    particles,
    particleMat: pMat,
    phases,
    baseXZ,
    riseHeight: rise,
    count: N,
  });
}

/**
 * Call every frame. Animates all registered beacons:
 * breathing glow, rising particles, proximity boost, discovery dimming.
 *
 * @param time - elapsed seconds (e.g. `performance.now() * 0.001`)
 * @param playerPosition - world-space position of the player character
 */
export function updateDiscoverableBeacons(
  time: number,
  playerPosition: THREE.Vector3,
): void {
  for (const b of beacons) {
    const found = isDiscovered(b.discoveryId);

    b.object.getWorldPosition(_wPos);
    const dist = _wPos.distanceTo(playerPosition);
    const prox  = Math.max(0, 1 - dist / PROX_RANGE);
    const proxE = prox * prox;
    const dim   = found ? DISCOVERED_DIM : 1.0;
    const color = found ? COL_CYAN_DIM : COL_AMBER;

    const breath = 0.82 + Math.sin(time * 2.0 + b.phases[0] * 6.28) * 0.18;

    /* ── Glow disc ─────────────────────────────────────────── */

    b.glowMat.color.setHex(color);
    b.glowMat.opacity = THREE.MathUtils.lerp(
      GLOW_IDLE_OPACITY, GLOW_NEAR_OPACITY, proxE,
    ) * breath * dim;

    const scaleBreath = 1.0 + Math.sin(time * 1.6 + b.phases[0] * 6.28) * 0.06;
    b.glowDisc.scale.setScalar(scaleBreath);

    /* ── Particles ─────────────────────────────────────────── */

    b.particleMat.color.setHex(color);
    b.particleMat.opacity = THREE.MathUtils.lerp(
      PART_IDLE_OPACITY, PART_NEAR_OPACITY, proxE,
    ) * dim;

    const pos   = b.particles.geometry.attributes.position as THREE.BufferAttribute;
    const arr   = pos.array as Float32Array;
    const speed = 0.12 + proxE * 0.08;

    for (let i = 0; i < b.count; i++) {
      const phase = b.phases[i];
      const cycle = (time * speed + phase) % 1.0;
      const y     = cycle * b.riseHeight;

      const sway = 0.04 * (1 + proxE * 0.5);
      const sx   = Math.sin(time * 1.1 + phase * 6.28) * sway;
      const sz   = Math.cos(time * 0.9 + phase * 4.2)  * sway;

      arr[i * 3]     = b.baseXZ[i * 2]     + sx;
      arr[i * 3 + 1] = y;
      arr[i * 3 + 2] = b.baseXZ[i * 2 + 1] + sz;
    }
    pos.needsUpdate = true;
  }
}
