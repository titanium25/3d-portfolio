import * as THREE from "three";
import type { Scene } from "three";
import { gltfLoader } from "./loaderSetup";
import { assetPath } from "../utils/assetPath";
import { isMobile } from "../utils/mobileDetect";
import {
  BRIDGE_WIDTH,
  BRIDGE_LENGTH,
  BRIDGE_NEAR_Z,
  BRIDGE_FAR_Z,
  SPAWN_SIZE,
  SPAWN_CENTER_X,
  SPAWN_CENTER_Z,
  ARENA_SIDES,
} from "./layoutConstants";
import {
  hexVertex,
  createHexShape,
  createHexPath,
} from "./hexUtils";
import {
  createNoiseRoughnessMap,
  createRadialGlowTexture,
  createDotTexture,
} from "./textureUtils";

/* ══════════════════════════════════════════════════════════════
 *  SPAWN PAD + TIMELINE BRIDGE  —  Phase 1 (structural only)
 *  ──────────────────────────────────────────────────────────
 *  Layout (top-down, +Z = toward viewer / bottom of screen):
 *
 *          [Main Arena]           (centre 0,0,0)
 *               |
 *          [Bridge]               runs along +Z axis (width ≈ gate + margin)
 *               |
 *          [Spawn Pad]            player starts here (edge = bridge width)
 *
 *  Bridge width = gate footprint + small margin.
 *  Spawn hex flat face = bridge width for flush connection.
 * ═══════════════════════════════════════════════════════════ */

const BRIDGE_CENTER_Z = (BRIDGE_NEAR_Z + BRIDGE_FAR_Z) / 2;

/* ── Slab constants (mirrored from createGround) ─────────────── */

const PLATFORM_DEPTH    = 0.3; /* 1/5 of original 1.5 */
const BEVEL_SIZE        = 0.25;
const BEVEL_THICKNESS   = 0.15;
const BEVEL_SEGMENTS    = 3;

const RIM_INSET         = 0.35;
const RIM_WIDTH         = 0.1;
const RIM_HEIGHT        = 0.07;
const RIM_BEVEL         = 0.018;
const RIM_BEVEL_SEGMENTS = 2;

/* ── Palette (mirrors createGround exactly) ──────────────────── */

const COL_BASE   = 0x7b8fa3;
const COL_FLOOR  = 0x1f2b38;
const COL_ACCENT = 0x00e5cc;

/* ── Edge effects (mirror createGround) ──────────────────────── */

const BARRIER_HEIGHT       = 0.8;
const VOID_CASCADE_HEIGHT  = 2.0;
const UNDERGLOW_OFFSET     = 0.4;

const SPAWN_PARTICLE_COUNT = 50;
const COL_WARM = 0xffaa44;

/* Bridge "WOW" constants */
const BRIDGE_DEPTH = 0.25;
const BRIDGE_RUNWAY_WIDTH = 1.0;
const BRIDGE_EDGE_LIGHT_COUNT = 2;

/* ══════════════════════════════════════════════════════════════
 *  Public API
 * ═════════════════════════════════════════════════════════════ */

export interface SpawnPadContext {
  group: THREE.Group;
  /** World-space centre of the spawn pad floor (Y = 0). */
  spawnCenter: THREE.Vector3;
  /** Per-frame update for animated effects (barrier, cascade, particles). */
  update(time: number): void;
  /** Collision proxy for the BMW bike (right side of spawn pad). */
  bikeCollisionGroup: THREE.Group;
  /** Collision proxy for the MTB bike (left side of spawn pad). */
  mtbCollisionGroup: THREE.Group;
}

export interface SpawnPadOptions {
  /** Called once the BMW S1000RR GLB finishes loading with its pivot group. */
  onBikeLoaded?: (group: THREE.Group) => void;
  /** Called once the MTB GLB finishes loading with its pivot group. */
  onMtbLoaded?: (group: THREE.Group) => void;
}

const COLLIDER_Y_AXIS = new THREE.Vector3(0, 1, 0);

function configureBikeCollisionFromModel(
  collisionGroup: THREE.Group,
  model: THREE.Object3D,
  anchorX: number,
  anchorZ: number,
  yaw: number,
): void {
  const bbox = new THREE.Box3().setFromObject(model);
  const size = bbox.getSize(new THREE.Vector3());
  const center = bbox.getCenter(new THREE.Vector3());

  const majorAxis = size.x >= size.z ? "x" : "z";
  const majorSize = majorAxis === "x" ? size.x : size.z;
  const minorSize = majorAxis === "x" ? size.z : size.x;

  const centerOffset = new THREE.Vector3(center.x, 0, center.z).applyAxisAngle(
    COLLIDER_Y_AXIS,
    yaw,
  );
  collisionGroup.position.set(anchorX + centerOffset.x, 0, anchorZ + centerOffset.z);

  const collisionRadius = THREE.MathUtils.clamp(
    minorSize * 0.42 + 0.04,
    0.16,
    0.26,
  );
  const travel = Math.max(0, majorSize * 0.5 - collisionRadius * 0.75);
  const desiredStep = Math.max(collisionRadius * 1.15, 0.26);
  const circleCount = Math.max(
    2,
    Math.min(5, Math.ceil((travel * 2) / desiredStep) + 1),
  );

  const collisionPoints: [number, number][] = [];
  for (let i = 0; i < circleCount; i++) {
    const t = circleCount === 1 ? 0.5 : i / (circleCount - 1);
    const axisOffset = THREE.MathUtils.lerp(-travel, travel, t);
    const point = new THREE.Vector3(
      majorAxis === "x" ? axisOffset : 0,
      0,
      majorAxis === "z" ? axisOffset : 0,
    ).applyAxisAngle(COLLIDER_Y_AXIS, yaw);
    collisionPoints.push([point.x, point.z]);
  }

  collisionGroup.userData.collisionPoints = collisionPoints;
  collisionGroup.userData.collisionRadius = collisionRadius;
}

export function createSpawnPad(scene: Scene, options?: SpawnPadOptions): SpawnPadContext {
  const group = new THREE.Group();

  /* ── Shared materials ──────────────────────────────────────── */

  const baseRoughnessMap  = createNoiseRoughnessMap(128, 0.78, 0.10, 3);
  const floorRoughnessMap = createNoiseRoughnessMap(128, 0.85, 0.08, 4);

  const baseMat = new THREE.MeshStandardMaterial({
    color: COL_BASE,
    roughness: 1.0,
    roughnessMap: baseRoughnessMap,
    metalness: 0.10,
    envMapIntensity: 0.5,
  });

  const floorMat = new THREE.MeshStandardMaterial({
    color: COL_FLOOR,
    roughness: 1.0,
    roughnessMap: floorRoughnessMap,
    metalness: 0.08,
    envMapIntensity: 0.5,
    emissive: COL_ACCENT,
    emissiveIntensity: 0.0,
  });

  const trimMat = new THREE.LineBasicMaterial({
    color: COL_ACCENT,
    transparent: true,
    opacity: 0.35,
  });

  const accentMat = new THREE.MeshStandardMaterial({
    color: 0x061215,
    emissive: COL_ACCENT,
    emissiveIntensity: 0.6,
    roughness: 0.9,
    metalness: 0.0,
    side: THREE.DoubleSide,
  });

  const bridgeGlassMat = new THREE.MeshStandardMaterial({
    color: 0x1a2a3a,
    transparent: true,
    opacity: 0.45,
    roughness: 0.05,
    metalness: 0.1,
    envMapIntensity: 0.9,
    side: THREE.DoubleSide,
  });

  /* ── Shader materials (shared by spawn + bridge) ─────────────── */

  const barrierMat = new THREE.ShaderMaterial({
    uniforms: {
      color: { value: new THREE.Color(COL_ACCENT) },
      opacity: { value: 0.45 },
      time: { value: 0 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 color;
      uniform float opacity;
      uniform float time;
      varying vec2 vUv;
      void main() {
        float heightFade = 1.0 - vUv.y;
        heightFade *= heightFade;
        float scan = 0.9 + 0.1 * sin(vUv.y * 30.0 + time * 1.5);
        float alpha = opacity * heightFade * scan;
        gl_FragColor = vec4(color, alpha);
      }
    `,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  const voidCascadeMat = new THREE.ShaderMaterial({
    uniforms: {
      topColor: { value: new THREE.Color(COL_ACCENT) },
      opacity: { value: 0.42 },
      time: { value: 0 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 topColor;
      uniform float opacity;
      uniform float time;
      varying vec2 vUv;
      void main() {
        float t = vUv.y;
        float fade = t * t * t;
        float wisps = 0.92 + 0.08 * sin(vUv.x * 4.0 - time * 0.6 + t * 8.0);
        float alpha = opacity * fade * wisps;
        vec3 col = topColor * (0.6 + 0.4 * t);
        gl_FragColor = vec4(col, alpha);
      }
    `,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const runwayStripMat = new THREE.ShaderMaterial({
    uniforms: {
      color: { value: new THREE.Color(COL_ACCENT) },
      time: { value: 0 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 color;
      uniform float time;
      varying vec2 vUv;
      void main() {
        float across = abs(vUv.x - 0.5) * 2.0;
        float edgeFade = 1.0 - across * across;
        float flow = 0.6 + 0.4 * sin(vUv.y * 18.0 - time * 2.5);
        float pulse = 0.85 + 0.15 * sin(time * 1.2);
        float alpha = edgeFade * flow * pulse * 0.55;
        gl_FragColor = vec4(color, alpha);
      }
    `,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  /* ══════════════════════════════════════════════════════════
   *  A. SPAWN PAD
   *     Hexagonal platform sized so its flat-face width matches
   *     the bridge width exactly.  Centred at (0, 0, SPAWN_CENTER_Z).
   * ════════════════════════════════════════════════════════ */

  const spawnGroup = new THREE.Group();
  spawnGroup.position.set(SPAWN_CENTER_X, 0, SPAWN_CENTER_Z);

  /* A1. Body slab */
  const spawnInnerRadius = SPAWN_SIZE - RIM_INSET - RIM_WIDTH;

  const spawnBodyShape = createHexShape(SPAWN_SIZE, ARENA_SIDES);
  spawnBodyShape.holes.push(createHexPath(spawnInnerRadius, ARENA_SIDES));

  const spawnBodyGeom = new THREE.ExtrudeGeometry(spawnBodyShape, {
    depth: PLATFORM_DEPTH,
    bevelEnabled: true,
    bevelThickness: BEVEL_THICKNESS,
    bevelSize: BEVEL_SIZE,
    bevelSegments: BEVEL_SEGMENTS,
  });
  spawnBodyGeom.rotateX(-Math.PI / 2);
  spawnBodyGeom.translate(0, -PLATFORM_DEPTH, 0);
  spawnBodyGeom.computeVertexNormals();

  const spawnBody = new THREE.Mesh(spawnBodyGeom, baseMat);
  spawnBody.receiveShadow = true;
  spawnBody.castShadow = true;
  spawnGroup.add(spawnBody);

  /* A2. Rim ring */
  const spawnRimOuter = SPAWN_SIZE - RIM_INSET;
  const spawnRimShape = createHexShape(spawnRimOuter, ARENA_SIDES);
  spawnRimShape.holes.push(createHexPath(spawnInnerRadius, ARENA_SIDES));

  const spawnRimGeom = new THREE.ExtrudeGeometry(spawnRimShape, {
    depth: RIM_HEIGHT,
    bevelEnabled: true,
    bevelThickness: RIM_BEVEL,
    bevelSize: RIM_BEVEL,
    bevelSegments: RIM_BEVEL_SEGMENTS,
  });
  spawnRimGeom.rotateX(-Math.PI / 2);
  spawnRimGeom.computeVertexNormals();

  const spawnRim = new THREE.Mesh(spawnRimGeom, baseMat);
  spawnRim.receiveShadow = true;
  spawnRim.castShadow = true;
  spawnGroup.add(spawnRim);

  /* A3. Inner floor plate */
  const spawnInnerScale = spawnInnerRadius / SPAWN_SIZE;
  const spawnFloorShape = createHexShape(SPAWN_SIZE * spawnInnerScale, ARENA_SIDES);
  const spawnFloorGeom = new THREE.ShapeGeometry(spawnFloorShape);
  spawnFloorGeom.rotateX(-Math.PI / 2);
  spawnFloorGeom.translate(0, 0.01, 0);
  spawnFloorGeom.computeVertexNormals();

  const spawnFloor = new THREE.Mesh(spawnFloorGeom, floorMat);
  spawnFloor.receiveShadow = true;
  spawnGroup.add(spawnFloor);

  /* A4. Edge trim lines */
  for (const radius of [spawnRimOuter, spawnInnerRadius]) {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= ARENA_SIDES; i++) {
      const [sx, sy] = hexVertex(i % ARENA_SIDES, ARENA_SIDES, radius);
      pts.push(new THREE.Vector3(sx, RIM_HEIGHT + 0.005, -sy));
    }
    spawnGroup.add(
      new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), trimMat),
    );
  }

  /* A5. Spawn pad underglow accent ring */
  const spawnGlowOuter = SPAWN_SIZE * 1.0;
  const spawnGlowInner = SPAWN_SIZE * 0.45;
  const spawnGlowShape = createHexShape(spawnGlowOuter, ARENA_SIDES);
  spawnGlowShape.holes.push(createHexPath(spawnGlowInner, ARENA_SIDES));
  const spawnGlowGeom = new THREE.ShapeGeometry(spawnGlowShape);
  spawnGlowGeom.rotateX(-Math.PI / 2);
  spawnGlowGeom.computeVertexNormals();
  const spawnGlowMesh = new THREE.Mesh(spawnGlowGeom, accentMat);
  spawnGlowMesh.position.y = -(PLATFORM_DEPTH + UNDERGLOW_OFFSET);
  spawnGroup.add(spawnGlowMesh);

  // Fix 5: skip underside PointLight on mobile — camera never looks under the platform
  const spawnUnderLight = new THREE.PointLight(COL_ACCENT, isMobile ? 0 : 1.2, 12, 2);
  spawnUnderLight.position.set(0, -PLATFORM_DEPTH * 0.6, 0);
  spawnGroup.add(spawnUnderLight);

  /* A6. Spawn pad Edge Energy Barrier — Fix 3: merged into 1 draw call */
  {
    const VERTS_PER_QUAD = 6;
    const allBarrierPos = new Float32Array(ARENA_SIDES * VERTS_PER_QUAD * 3);
    const allBarrierUvs = new Float32Array(ARENA_SIDES * VERTS_PER_QUAD * 2);
    for (let i = 0; i < ARENA_SIDES; i++) {
      const [sx1, sy1] = hexVertex(i, ARENA_SIDES, SPAWN_SIZE * 0.99);
      const [sx2, sy2] = hexVertex((i + 1) % ARENA_SIDES, ARENA_SIDES, SPAWN_SIZE * 0.99);
      const wx1 = sx1, wz1 = -sy1, wx2 = sx2, wz2 = -sy2;
      allBarrierPos.set([
        wx1, 0, wz1, wx2, 0, wz2, wx2, BARRIER_HEIGHT, wz2,
        wx1, 0, wz1, wx2, BARRIER_HEIGHT, wz2, wx1, BARRIER_HEIGHT, wz1,
      ], i * VERTS_PER_QUAD * 3);
      allBarrierUvs.set([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1], i * VERTS_PER_QUAD * 2);
    }
    const barrierGeom = new THREE.BufferGeometry();
    barrierGeom.setAttribute("position", new THREE.BufferAttribute(allBarrierPos, 3));
    barrierGeom.setAttribute("uv", new THREE.BufferAttribute(allBarrierUvs, 2));
    barrierGeom.computeVertexNormals();
    spawnGroup.add(new THREE.Mesh(barrierGeom, barrierMat));
  }

  /* A7. Spawn pad Void Cascade — Fix 3: merged into 1 draw call */
  {
    const VERTS_PER_QUAD = 6;
    const allCascadePos = new Float32Array(ARENA_SIDES * VERTS_PER_QUAD * 3);
    const allCascadeUvs = new Float32Array(ARENA_SIDES * VERTS_PER_QUAD * 2);
    for (let i = 0; i < ARENA_SIDES; i++) {
      const [sx1, sy1] = hexVertex(i, ARENA_SIDES, SPAWN_SIZE * 1.01);
      const [sx2, sy2] = hexVertex((i + 1) % ARENA_SIDES, ARENA_SIDES, SPAWN_SIZE * 1.01);
      const wx1 = sx1, wz1 = -sy1, wx2 = sx2, wz2 = -sy2;
      allCascadePos.set([
        wx1, 0, wz1, wx2, 0, wz2, wx2, -VOID_CASCADE_HEIGHT, wz2,
        wx1, 0, wz1, wx2, -VOID_CASCADE_HEIGHT, wz2, wx1, -VOID_CASCADE_HEIGHT, wz1,
      ], i * VERTS_PER_QUAD * 3);
      allCascadeUvs.set([0, 1, 1, 1, 1, 0, 0, 1, 1, 0, 0, 0], i * VERTS_PER_QUAD * 2);
    }
    const cascadeGeom = new THREE.BufferGeometry();
    cascadeGeom.setAttribute("position", new THREE.BufferAttribute(allCascadePos, 3));
    cascadeGeom.setAttribute("uv", new THREE.BufferAttribute(allCascadeUvs, 2));
    cascadeGeom.computeVertexNormals();
    spawnGroup.add(new THREE.Mesh(cascadeGeom, voidCascadeMat));
  }

  /* A8. Spawn pad ambient rising particles */
  const spawnParticleBaseX = new Float32Array(SPAWN_PARTICLE_COUNT);
  const spawnParticleBaseZ = new Float32Array(SPAWN_PARTICLE_COUNT);
  const spawnParticleBaseY = new Float32Array(SPAWN_PARTICLE_COUNT);
  const spawnParticlePhases = new Float32Array(SPAWN_PARTICLE_COUNT);
  const spawnParticleSpeeds = new Float32Array(SPAWN_PARTICLE_COUNT);
  const spawnPPos = new Float32Array(SPAWN_PARTICLE_COUNT * 3);
  for (let i = 0; i < SPAWN_PARTICLE_COUNT; i++) {
    const angle = Math.random() * Math.PI * 2;
    const r = SPAWN_SIZE * (0.55 + Math.random() * 0.45);
    spawnParticleBaseX[i] = Math.cos(angle) * r;
    spawnParticleBaseZ[i] = Math.sin(angle) * r;
    spawnParticleBaseY[i] = -(PLATFORM_DEPTH + 0.2 + Math.random() * 1.5);
    spawnParticlePhases[i] = Math.random() * Math.PI * 2;
    spawnParticleSpeeds[i] = 0.04 + Math.random() * 0.08;
    spawnPPos[i * 3] = spawnParticleBaseX[i];
    spawnPPos[i * 3 + 1] = spawnParticleBaseY[i];
    spawnPPos[i * 3 + 2] = spawnParticleBaseZ[i];
  }
  const spawnParticleGeom = new THREE.BufferGeometry();
  spawnParticleGeom.setAttribute("position", new THREE.BufferAttribute(spawnPPos, 3));
  const dotTex = createDotTexture();
  const spawnParticleMat = new THREE.PointsMaterial({
    color: COL_ACCENT,
    size: 0.15,
    map: dotTex,
    transparent: true,
    opacity: 0.7,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  spawnGroup.add(new THREE.Points(spawnParticleGeom, spawnParticleMat));

  /* A-WF. Wayfinding — energy conduit + threshold + guide particles
   *       Environmental wayfinding: light and motion, no text.
   *       A glowing energy strip on the pad floor flows from the centre
   *       toward the bridge entrance.  A brighter threshold glow marks the
   *       junction, and small particles drift along the path.  The player
   *       follows the light — same principle as Journey's mountain or
   *       BotW's shrine glow.
   */

  const WF_APOTHEM    = SPAWN_SIZE * Math.cos(Math.PI / ARENA_SIDES);
  const WF_START_Z    = -0.8;          // conduit origin (just off-centre)
  const WF_END_Z      = -WF_APOTHEM;   // conduit terminus (bridge entrance edge)
  const WF_LENGTH     = Math.abs(WF_END_Z - WF_START_Z);
  const WF_CENTER_Z   = (WF_START_Z + WF_END_Z) / 2;
  const WF_WIDTH      = BRIDGE_WIDTH * 2.0;

  // Flow-shader strip — oversized geometry with Gaussian + smoothstep
  // fades so alpha reaches zero well before any geometry edge.
  // UV v=0 → centre side, v=1 → bridge side (after rotateX(-PI/2)).
  const conduitMat = new THREE.ShaderMaterial({
    uniforms: {
      color: { value: new THREE.Color(COL_ACCENT) },
      time:  { value: 0 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 color;
      uniform float time;
      varying vec2 vUv;
      void main() {
        float across   = abs(vUv.x - 0.5) * 2.0;
        float xFade    = exp(-across * across * 5.0);
        float startFade = smoothstep(0.0, 0.25, vUv.y);
        float endFade   = smoothstep(1.0, 0.88, vUv.y);
        float flow      = 0.5 + 0.5 * sin(vUv.y * 14.0 - time * 2.5);
        float lengthGrad = 0.08 + 0.92 * vUv.y;
        float pulse     = 0.9 + 0.1 * sin(time * 0.8);
        float alpha     = xFade * startFade * endFade * flow * lengthGrad * pulse * 0.4;
        gl_FragColor    = vec4(color, alpha);
      }
    `,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const WF_PAD_Z = 0.6;
  const conduitGeom = new THREE.PlaneGeometry(WF_WIDTH, WF_LENGTH + WF_PAD_Z * 2);
  conduitGeom.rotateX(-Math.PI / 2);
  const conduitMesh = new THREE.Mesh(conduitGeom, conduitMat);
  conduitMesh.position.set(0, 0.02, WF_CENTER_Z);
  spawnGroup.add(conduitMesh);

  // Threshold glow — brighter pool of light at the bridge entrance
  const thresholdGlowTex = createRadialGlowTexture({
    r: 0, g: 229, b: 204, peakAlpha: 0.5,
  });
  const thresholdMat = new THREE.MeshBasicMaterial({
    map: thresholdGlowTex,
    color: COL_ACCENT,
    transparent: true,
    opacity: 0.3,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const thresholdGeom = new THREE.PlaneGeometry(BRIDGE_WIDTH * 1.1, 1.2);
  thresholdGeom.rotateX(-Math.PI / 2);
  const thresholdGlow = new THREE.Mesh(thresholdGeom, thresholdMat);
  thresholdGlow.position.set(0, 0.02, WF_END_Z + 0.15);
  spawnGroup.add(thresholdGlow);

  const thresholdLight = new THREE.PointLight(COL_ACCENT, 1.2, 5, 2);
  thresholdLight.position.set(0, 0.3, WF_END_Z + 0.1);
  spawnGroup.add(thresholdLight);

  // Guide particles — small dots flowing along the conduit toward bridge
  const WF_GUIDE_COUNT = 10;
  const wfGuidePhases = new Float32Array(WF_GUIDE_COUNT);
  const wfGuideSpeeds = new Float32Array(WF_GUIDE_COUNT);
  const wfGuideXDrift = new Float32Array(WF_GUIDE_COUNT);
  const wfGPos = new Float32Array(WF_GUIDE_COUNT * 3);

  for (let i = 0; i < WF_GUIDE_COUNT; i++) {
    wfGuidePhases[i] = Math.random();
    wfGuideSpeeds[i] = 0.12 + Math.random() * 0.08;
    wfGuideXDrift[i] = (Math.random() - 0.5) * WF_WIDTH * 0.4;
    const z = WF_START_Z + (WF_END_Z - WF_START_Z) * wfGuidePhases[i];
    wfGPos[i * 3]     = wfGuideXDrift[i];
    wfGPos[i * 3 + 1] = 0.06;
    wfGPos[i * 3 + 2] = z;
  }

  const wfGuideGeom = new THREE.BufferGeometry();
  wfGuideGeom.setAttribute("position", new THREE.BufferAttribute(wfGPos, 3));
  const wfGuideMat = new THREE.PointsMaterial({
    color: COL_ACCENT,
    size: 0.07,
    map: dotTex,
    transparent: true,
    opacity: 0.55,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  spawnGroup.add(new THREE.Points(wfGuideGeom, wfGuideMat));

  /* A9. BMW bike — parked at back-right edge of spawn pad
   *     Loaded async so it doesn't block the intro sequence.
   *     Position is in spawnGroup local space (centre = spawn pad centre).
   */

  // Collision group is created synchronously so App.ts can register it immediately.
  // A tiny placeholder collider avoids the default stop circle until the GLB loads.
  const BIKE_LOCAL_X = 2.4;
  const BIKE_LOCAL_Z = 2.0;
  const bikeCollisionGroup = new THREE.Group();
  bikeCollisionGroup.position.set(BIKE_LOCAL_X, 0, BIKE_LOCAL_Z);
  bikeCollisionGroup.userData.collisionPoints = [[0, 0]];
  bikeCollisionGroup.userData.collisionRadius = 0.2;
  spawnGroup.add(bikeCollisionGroup);

  const bikeLight = new THREE.PointLight(COL_WARM, 0.0, 4, 2);
  bikeLight.position.set(2.4, 0.4, 2.0);
  spawnGroup.add(bikeLight);

  const warmDiscTex = createRadialGlowTexture({ r: 255, g: 170, b: 68, peakAlpha: 0.4 });
  const bikeDiscGeom = new THREE.CircleGeometry(1.2, 32);
  bikeDiscGeom.rotateX(-Math.PI / 2);
  const bikeDisc = new THREE.Mesh(bikeDiscGeom, new THREE.MeshBasicMaterial({
    map: warmDiscTex,
    transparent: true,
    opacity: 0.20,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  }));
  bikeDisc.position.set(BIKE_LOCAL_X, 0.015, BIKE_LOCAL_Z);
  spawnGroup.add(bikeDisc);

  gltfLoader.load(
    assetPath("/models/optimized/Meshy_AI_BMW_Sharkmouth_Racer_0307150145_texture.glb"),
    (gltf) => {
      const bike = gltf.scene;

      // Scale
      const bbox = new THREE.Box3().setFromObject(bike);
      const modelHeight = bbox.max.y - bbox.min.y;
      const targetHeight = 1.125;
      const scale = targetHeight / modelHeight;
      bike.scale.setScalar(scale);

      // Ground the un-rotated bike at origin (clean baseline)
      bike.updateMatrixWorld(true);
      bbox.setFromObject(bike);
      bike.position.y = -bbox.min.y;

      // Fit the collision proxy from the bike's local-space footprint
      // before parent transforms (pivot yaw / lean) are applied.
      configureBikeCollisionFromModel(
        bikeCollisionGroup,
        bike,
        BIKE_LOCAL_X,
        BIKE_LOCAL_Z,
        Math.PI / 3,
      );

      // Wrap in a pivot group — heading and lean as separate Euler axes.
      // The model's forward axis is local X, so rotation.x = roll (side-lean).
      // Order 'YXZ': Y (heading) applied first, then X (roll) in the
      // heading's local frame = rotation around bike's forward axis = pure side-lean.
      const bikePivot = new THREE.Group();
      bikePivot.rotation.order = "YXZ";
      bikePivot.rotation.y = Math.PI / 3;  // parallel to right hex edge
      bikePivot.rotation.x = 0.12;         // kickstand lean to the left

      bikePivot.add(bike);

      // Place at desired XZ, then re-ground so the lowest leaned point = floor
      bikePivot.position.set(BIKE_LOCAL_X, 0, BIKE_LOCAL_Z);
      bikePivot.updateMatrixWorld(true);
      bbox.setFromObject(bikePivot);
      bikePivot.position.y += -bbox.min.y;

      bike.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      spawnGroup.add(bikePivot);

      // Soft cyan glow beneath the bike once model is in place
      bikeLight.intensity = 0.9;
      options?.onBikeLoaded?.(bikePivot);
    },
    undefined,
    (err) => console.warn("Bike model failed to load:", err),
  );

  /* A10. MTB bicycle — parked on the opposite hex edge from the BMW.
   *
   *  Hex is flat-top.  BMW sits near edge V5→V0 (right-back).
   *  Opposite edge is V2→V3 (left-front):
   *    V2 = (−R/2, 0, −R√3/2),  V3 = (−R, 0, 0)
   *    edge direction = (−0.5, 0, 0.866) → rotY = −π/6 (−30°)
   *
   *  MTB parked at (−2.4, 0, −2.0) in spawnGroup local space,
   *  which is the symmetric mirror of the BMW position (2.4, 0, 2.0)
   *  reflected through the hex centre.
   */

  // rotY = −π/6 + π/2 = π/3: rotated 90° from base edge alignment
  const MTB_ROT_Y   = -Math.PI / 6 + Math.PI / 2;
  const MTB_LOCAL_X = -2.4;
  const MTB_LOCAL_Z = -2.0;

  // A tiny placeholder collider avoids the default stop circle until the GLB loads.
  const mtbCollisionGroup = new THREE.Group();
  mtbCollisionGroup.position.set(MTB_LOCAL_X, 0, MTB_LOCAL_Z);
  mtbCollisionGroup.userData.collisionPoints = [[0, 0]];
  mtbCollisionGroup.userData.collisionRadius = 0.2;
  spawnGroup.add(mtbCollisionGroup);

  const mtbLight = new THREE.PointLight(COL_WARM, 0.0, 4, 2);
  mtbLight.position.set(MTB_LOCAL_X, 0.4, MTB_LOCAL_Z);
  spawnGroup.add(mtbLight);

  const mtbDiscGeom = new THREE.CircleGeometry(1.0, 32);
  mtbDiscGeom.rotateX(-Math.PI / 2);
  const mtbDisc = new THREE.Mesh(mtbDiscGeom, new THREE.MeshBasicMaterial({
    map: warmDiscTex,
    transparent: true,
    opacity: 0.20,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  }));
  mtbDisc.position.set(MTB_LOCAL_X, 0.015, MTB_LOCAL_Z);
  spawnGroup.add(mtbDisc);

  gltfLoader.load(
    assetPath("/models/optimized/Meshy_AI_Neon_Platform_MTB_0307152614_texture.glb"),
    (gltf) => {
      const mtb = gltf.scene;

      // Scale to target height, then scale up 1.2×
      const bbox = new THREE.Box3().setFromObject(mtb);
      const modelHeight = bbox.max.y - bbox.min.y;
      const targetHeight = 1.0;
      const scale = (targetHeight / modelHeight) * 1.2;
      mtb.scale.setScalar(scale);

      // Ground the un-rotated bike (clean baseline)
      mtb.updateMatrixWorld(true);
      bbox.setFromObject(mtb);
      mtb.position.y = -bbox.min.y;

      // Fit the collision proxy from the bike's local-space footprint
      // before parent transforms are applied.
      configureBikeCollisionFromModel(
        mtbCollisionGroup,
        mtb,
        MTB_LOCAL_X,
        MTB_LOCAL_Z,
        MTB_ROT_Y,
      );

      // Wrap in a pivot group — Y only, MTB stands straight (no lean, no pitch).
      const mtbPivot = new THREE.Group();
      mtbPivot.rotation.order = "YXZ";
      mtbPivot.rotation.y = MTB_ROT_Y;

      mtbPivot.add(mtb);

      // Place, then re-ground so the lowest leaned point = floor
      mtbPivot.position.set(MTB_LOCAL_X, 0, MTB_LOCAL_Z);
      mtbPivot.updateMatrixWorld(true);
      bbox.setFromObject(mtbPivot);
      const MTB_SINK = 0.06; // Sink slightly into the ground for visual weight
      mtbPivot.position.y += -bbox.min.y - MTB_SINK;

      mtb.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      spawnGroup.add(mtbPivot);

      // Activate accent light once model is in place
      mtbLight.intensity = 0.9;
      options?.onMtbLoaded?.(mtbPivot);
    },
    undefined,
    (err) => console.warn("MTB model failed to load:", err),
  );

  group.add(spawnGroup);

  /* ══════════════════════════════════════════════════════════
   *  B. TIMELINE BRIDGE
   *     Flat rectangular slab along the +Z axis.
   *
   *     World Z range: [BRIDGE_NEAR_Z, BRIDGE_FAR_Z]
   *     World X range: [-BRIDGE_WIDTH/2, +BRIDGE_WIDTH/2]
   *     Centre: (0, 0, BRIDGE_CENTER_Z)
   *
   *     Width = BRIDGE_WIDTH so it connects flush to both the
   *     arena bottom face and the spawn pad flat face.
   * ════════════════════════════════════════════════════════ */

  const halfLen   = BRIDGE_LENGTH / 2;   // along Z
  const halfWidth = BRIDGE_WIDTH  / 2;   // along X

  const bridgeBevelSize  = Math.min(BEVEL_SIZE,      halfLen * 0.5);
  const bridgeBevelThick = Math.min(BEVEL_THICKNESS, halfLen * 0.3);

  /* B1. Bridge body slab
   *
   *  rotateX(-π/2) maps: shape-X → world-X, shape-Y → −world-Z
   *  So to get a slab that runs BRIDGE_LENGTH along world-Z and
   *  BRIDGE_WIDTH along world-X we must put:
   *    halfWidth (world-X extent) along shape-X
   *    halfLen   (world-Z extent) along shape-Y  (negated by rotation → +Z)
   */
  const bridgeBodyShape = new THREE.Shape();
  bridgeBodyShape.moveTo(-halfWidth, -halfLen);
  bridgeBodyShape.lineTo( halfWidth, -halfLen);
  bridgeBodyShape.lineTo( halfWidth,  halfLen);
  bridgeBodyShape.lineTo(-halfWidth,  halfLen);
  bridgeBodyShape.closePath();

  const bridgeBodyGeom = new THREE.ExtrudeGeometry(bridgeBodyShape, {
    depth: BRIDGE_DEPTH,
    bevelEnabled: bridgeBevelSize > 0.05,
    bevelThickness: Math.min(bridgeBevelThick, BRIDGE_DEPTH * 0.4),
    bevelSize: Math.min(bridgeBevelSize, BRIDGE_DEPTH * 0.5),
    bevelSegments: 2,
  });
  bridgeBodyGeom.rotateX(-Math.PI / 2);
  bridgeBodyGeom.translate(0, -BRIDGE_DEPTH, 0);
  bridgeBodyGeom.computeVertexNormals();

  const bridgeBody = new THREE.Mesh(bridgeBodyGeom, bridgeGlassMat);
  bridgeBody.position.set(0, 0, BRIDGE_CENTER_Z);
  bridgeBody.receiveShadow = true;
  bridgeBody.castShadow = false;
  group.add(bridgeBody);

  /* B2. Bridge floor plate — full platform floor (dark) covering entire top */
  const bridgeFloorShape = new THREE.Shape();
  bridgeFloorShape.moveTo(-halfWidth, -halfLen);
  bridgeFloorShape.lineTo( halfWidth, -halfLen);
  bridgeFloorShape.lineTo( halfWidth,  halfLen);
  bridgeFloorShape.lineTo(-halfWidth,  halfLen);
  bridgeFloorShape.closePath();

  const bridgeFloorGeom = new THREE.ShapeGeometry(bridgeFloorShape);
  bridgeFloorGeom.rotateX(-Math.PI / 2);
  bridgeFloorGeom.computeVertexNormals();

  const bridgeFloor = new THREE.Mesh(bridgeFloorGeom, bridgeGlassMat);
  bridgeFloor.position.set(0, 0.01, BRIDGE_CENTER_Z);
  bridgeFloor.receiveShadow = true;
  group.add(bridgeFloor);

  /* B3. Bridge edge trim lines — brighter "runway" definition */
  const bridgeTrimY = RIM_HEIGHT + 0.005;
  const bridgeTrimMat = new THREE.LineBasicMaterial({
    color: COL_ACCENT,
    transparent: true,
    opacity: 0.55,
  });
  for (const side of [-1, 1]) {
    const wx = side * halfWidth;
    const pts = [
      new THREE.Vector3(wx, bridgeTrimY, BRIDGE_NEAR_Z),
      new THREE.Vector3(wx, bridgeTrimY, BRIDGE_FAR_Z),
    ];
    group.add(
      new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), bridgeTrimMat),
    );
  }
  for (const zVal of [BRIDGE_NEAR_Z, BRIDGE_FAR_Z]) {
    const pts = [
      new THREE.Vector3(-halfWidth, bridgeTrimY, zVal),
      new THREE.Vector3(halfWidth, bridgeTrimY, zVal),
    ];
    group.add(
      new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), bridgeTrimMat),
    );
  }

  /* Bridge effects subgroup (local origin at bridge centre) */
  const bridgeEffectsGroup = new THREE.Group();
  bridgeEffectsGroup.position.set(0, 0, BRIDGE_CENTER_Z);

  /* B4. Bridge underglow accent ring */
  const bgMargin = 0.3;
  const bridgeGlowOuter = new THREE.Shape();
  bridgeGlowOuter.moveTo(-halfWidth - bgMargin, -halfLen - bgMargin);
  bridgeGlowOuter.lineTo( halfWidth + bgMargin, -halfLen - bgMargin);
  bridgeGlowOuter.lineTo( halfWidth + bgMargin,  halfLen + bgMargin);
  bridgeGlowOuter.lineTo(-halfWidth - bgMargin,  halfLen + bgMargin);
  bridgeGlowOuter.lineTo(-halfWidth - bgMargin, -halfLen - bgMargin);
  const bridgeGlowInner = new THREE.Path();
  bridgeGlowInner.moveTo(-halfWidth + bgMargin, -halfLen + bgMargin);
  bridgeGlowInner.lineTo( halfWidth - bgMargin, -halfLen + bgMargin);
  bridgeGlowInner.lineTo( halfWidth - bgMargin,  halfLen - bgMargin);
  bridgeGlowInner.lineTo(-halfWidth + bgMargin,  halfLen - bgMargin);
  bridgeGlowInner.closePath();
  bridgeGlowOuter.holes.push(bridgeGlowInner);
  const bridgeGlowGeom = new THREE.ShapeGeometry(bridgeGlowOuter);
  bridgeGlowGeom.rotateX(-Math.PI / 2);
  bridgeGlowGeom.computeVertexNormals();
  const bridgeGlowMesh = new THREE.Mesh(bridgeGlowGeom, accentMat);
  bridgeGlowMesh.position.y = -(BRIDGE_DEPTH + UNDERGLOW_OFFSET);
  bridgeEffectsGroup.add(bridgeGlowMesh);

  // Fix 5: skip underside light on mobile — not visible from above, wasted shader cost
  const bridgeUnderLight = new THREE.PointLight(COL_ACCENT, isMobile ? 0 : 1.2, 16, 2);
  bridgeUnderLight.position.set(0, -(BRIDGE_DEPTH * 0.5 + 0.3), 0);
  bridgeEffectsGroup.add(bridgeUnderLight);

  /* B4b. Center runway strip — glowing path that draws the eye toward arena */
  const runwayGeom = new THREE.PlaneGeometry(BRIDGE_RUNWAY_WIDTH, BRIDGE_LENGTH);
  runwayGeom.rotateX(-Math.PI / 2);
  runwayGeom.translate(0, 0.015, 0);
  const runwayMesh = new THREE.Mesh(runwayGeom, runwayStripMat);
  bridgeEffectsGroup.add(runwayMesh);

  /* B4c. Multiple edge lights along bridge (pathway feel)
   * Fix 5: skip on mobile — 4 lights × shader cost, purely aesthetic */
  const bridgeEdgeLights: THREE.PointLight[] = [];
  if (!isMobile) {
    for (let i = 0; i < BRIDGE_EDGE_LIGHT_COUNT; i++) {
      const t = (i + 0.5) / BRIDGE_EDGE_LIGHT_COUNT;
      const z = -halfLen + t * BRIDGE_LENGTH;
      const light = new THREE.PointLight(COL_ACCENT, 0.8, 6, 2);
      light.position.set(halfWidth * 0.85, 0.15, z);
      bridgeEffectsGroup.add(light);
      bridgeEdgeLights.push(light);
    }
  }
  const bridgeEdgeLightsLeft: THREE.PointLight[] = [];
  if (!isMobile) {
    for (let i = 0; i < BRIDGE_EDGE_LIGHT_COUNT; i++) {
      const t = (i + 0.5) / BRIDGE_EDGE_LIGHT_COUNT;
      const z = -halfLen + t * BRIDGE_LENGTH;
      const light = new THREE.PointLight(COL_ACCENT, 0.8, 6, 2);
      light.position.set(-halfWidth * 0.85, 0.15, z);
      bridgeEffectsGroup.add(light);
      bridgeEdgeLightsLeft.push(light);
    }
  }

  /* B5. Destination glow — brighter strip at arena end (invitation to enter) */
  const destGlowWidth = halfWidth * 1.5;
  const destGlowGeom = new THREE.PlaneGeometry(destGlowWidth * 2, 0.6);
  const destGlowMat = new THREE.MeshBasicMaterial({
    color: COL_ACCENT,
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  const destGlow = new THREE.Mesh(destGlowGeom, destGlowMat);
  destGlow.position.set(0, 0.08, -halfLen - 0.05);
  bridgeEffectsGroup.add(destGlow);

  group.add(bridgeEffectsGroup);

  /* ── Per-frame update (animated effects) ─────────────────────── */

  const RISE_RANGE = 4.5;
  const PARTICLE_Y_CEIL = 2.5;

  function update(time: number): void {
    barrierMat.uniforms.time.value = time;
    voidCascadeMat.uniforms.time.value = time;

    spawnUnderLight.intensity = 1.2 + Math.sin(time * 0.4) * 0.25;

    const spawnPosAttr = spawnParticleGeom.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < SPAWN_PARTICLE_COUNT; i++) {
      const phase = spawnParticlePhases[i];
      const speed = spawnParticleSpeeds[i];
      const cycle = RISE_RANGE / speed;
      const t = ((time * speed + phase * 3) % cycle) / cycle;
      spawnPosAttr.setXYZ(
        i,
        spawnParticleBaseX[i] + Math.sin(time * 0.3 + phase) * 0.2,
        Math.min(PARTICLE_Y_CEIL, spawnParticleBaseY[i] + t * RISE_RANGE),
        spawnParticleBaseZ[i] + Math.cos(time * 0.25 + phase * 1.3) * 0.2,
      );
    }
    spawnPosAttr.needsUpdate = true;

    runwayStripMat.uniforms.time.value = time;
    bridgeUnderLight.intensity = 1.4 + Math.sin(time * 0.4) * 0.3;
    const lightPulse = 0.9 + 0.2 * Math.sin(time * 0.5);
    for (const l of bridgeEdgeLights) l.intensity = 0.8 * lightPulse;
    for (const l of bridgeEdgeLightsLeft) l.intensity = 0.8 * lightPulse;
    destGlowMat.opacity = 0.28 + Math.sin(time * 0.8) * 0.1;

    // Wayfinding: energy conduit flow + threshold pulse + guide particles
    conduitMat.uniforms.time.value = time;
    thresholdMat.opacity = 0.2 + 0.15 * Math.sin(time * 1.2);
    thresholdLight.intensity = 1.0 + 0.4 * Math.sin(time * 1.0);

    const wfGAttr = wfGuideGeom.getAttribute("position") as THREE.BufferAttribute;
    const wfFlowSpan = WF_END_Z - WF_START_Z;
    for (let i = 0; i < WF_GUIDE_COUNT; i++) {
      const progress = ((time * wfGuideSpeeds[i] + wfGuidePhases[i] * 8) % 1);
      const z = WF_START_Z + wfFlowSpan * progress;
      const x = wfGuideXDrift[i] + Math.sin(time * 0.4 + wfGuidePhases[i] * 6) * 0.06;
      wfGAttr.setXYZ(i, x, 0.06, z);
    }
    wfGAttr.needsUpdate = true;

    // Pulse bike accent lights — only visible once models are loaded (intensity > 0)
    if (bikeLight.intensity > 0) {
      bikeLight.intensity = 0.9 + Math.sin(time * 1.1) * 0.25;
    }
    if (mtbLight.intensity > 0) {
      mtbLight.intensity = 0.9 + Math.sin(time * 1.1 + Math.PI * 0.6) * 0.25;
    }

    floorMat.emissiveIntensity = 0.015 + Math.sin(time * 0.6) * 0.015;
  }

  /* ── Add to scene ────────────────────────────────────────── */

  scene.add(group);

  return {
    group,
    spawnCenter: new THREE.Vector3(SPAWN_CENTER_X, 0, SPAWN_CENTER_Z),
    update,
    bikeCollisionGroup,
    mtbCollisionGroup,
  };
}

/* ── Exported layout constants (for App.ts / PlayerCharacter) ─── */

export const SPAWN_PAD_CENTER_X = SPAWN_CENTER_X;
export const SPAWN_PAD_CENTER_Z = SPAWN_CENTER_Z;
