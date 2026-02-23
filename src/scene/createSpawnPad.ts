import * as THREE from "three";
import type { Scene } from "three";
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

const BARRIER_HEIGHT       = 0.6;
const VOID_CASCADE_HEIGHT  = 2.0;
const UNDERGLOW_OFFSET     = 0.4;

const SPAWN_PARTICLE_COUNT = 35;

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
}

export function createSpawnPad(scene: Scene): SpawnPadContext {
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
      opacity: { value: 0.28 },
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

  const spawnUnderLight = new THREE.PointLight(COL_ACCENT, 1.2, 12, 2);
  spawnUnderLight.position.set(0, -PLATFORM_DEPTH * 0.6, 0);
  spawnGroup.add(spawnUnderLight);

  /* A6. Spawn pad Edge Energy Barrier */
  for (let i = 0; i < ARENA_SIDES; i++) {
    const [sx1, sy1] = hexVertex(i, ARENA_SIDES, SPAWN_SIZE * 0.99);
    const [sx2, sy2] = hexVertex((i + 1) % ARENA_SIDES, ARENA_SIDES, SPAWN_SIZE * 0.99);
    const wx1 = sx1, wz1 = -sy1;
    const wx2 = sx2, wz2 = -sy2;
    const positions = new Float32Array([
      wx1, 0, wz1, wx2, 0, wz2, wx2, BARRIER_HEIGHT, wz2,
      wx1, 0, wz1, wx2, BARRIER_HEIGHT, wz2, wx1, BARRIER_HEIGHT, wz1,
    ]);
    const uvs = new Float32Array([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1]);
    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geom.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
    geom.computeVertexNormals();
    spawnGroup.add(new THREE.Mesh(geom, barrierMat));
  }

  /* A7. Spawn pad Void Cascade */
  for (let i = 0; i < ARENA_SIDES; i++) {
    const [sx1, sy1] = hexVertex(i, ARENA_SIDES, SPAWN_SIZE * 1.01);
    const [sx2, sy2] = hexVertex((i + 1) % ARENA_SIDES, ARENA_SIDES, SPAWN_SIZE * 1.01);
    const wx1 = sx1, wz1 = -sy1;
    const wx2 = sx2, wz2 = -sy2;
    const positions = new Float32Array([
      wx1, 0, wz1, wx2, 0, wz2, wx2, -VOID_CASCADE_HEIGHT, wz2,
      wx1, 0, wz1, wx2, -VOID_CASCADE_HEIGHT, wz2, wx1, -VOID_CASCADE_HEIGHT, wz1,
    ]);
    const uvs = new Float32Array([0, 1, 1, 1, 1, 0, 0, 1, 1, 0, 0, 0]);
    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geom.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
    geom.computeVertexNormals();
    spawnGroup.add(new THREE.Mesh(geom, voidCascadeMat));
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
    const r = SPAWN_SIZE * (0.75 + Math.random() * 0.3);
    spawnParticleBaseX[i] = Math.cos(angle) * r;
    spawnParticleBaseZ[i] = Math.sin(angle) * r;
    spawnParticleBaseY[i] = -(PLATFORM_DEPTH + 1.0 + Math.random() * 2.0);
    spawnParticlePhases[i] = Math.random() * Math.PI * 2;
    spawnParticleSpeeds[i] = 0.06 + Math.random() * 0.1;
    spawnPPos[i * 3] = spawnParticleBaseX[i];
    spawnPPos[i * 3 + 1] = spawnParticleBaseY[i];
    spawnPPos[i * 3 + 2] = spawnParticleBaseZ[i];
  }
  const spawnParticleGeom = new THREE.BufferGeometry();
  spawnParticleGeom.setAttribute("position", new THREE.BufferAttribute(spawnPPos, 3));
  const dotTex = createDotTexture();
  const spawnParticleMat = new THREE.PointsMaterial({
    color: COL_ACCENT,
    size: 0.06,
    map: dotTex,
    transparent: true,
    opacity: 0.5,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  spawnGroup.add(new THREE.Points(spawnParticleGeom, spawnParticleMat));

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

  const bridgeUnderLight = new THREE.PointLight(COL_ACCENT, 1.2, 16, 2);
  bridgeUnderLight.position.set(0, -(BRIDGE_DEPTH * 0.5 + 0.3), 0);
  bridgeEffectsGroup.add(bridgeUnderLight);

  /* B4b. Center runway strip — glowing path that draws the eye toward arena */
  const runwayGeom = new THREE.PlaneGeometry(BRIDGE_RUNWAY_WIDTH, BRIDGE_LENGTH);
  runwayGeom.rotateX(-Math.PI / 2);
  runwayGeom.translate(0, 0.015, 0);
  const runwayMesh = new THREE.Mesh(runwayGeom, runwayStripMat);
  bridgeEffectsGroup.add(runwayMesh);

  /* B4c. Multiple edge lights along bridge (pathway feel) */
  const bridgeEdgeLights: THREE.PointLight[] = [];
  for (let i = 0; i < BRIDGE_EDGE_LIGHT_COUNT; i++) {
    const t = (i + 0.5) / BRIDGE_EDGE_LIGHT_COUNT;
    const z = -halfLen + t * BRIDGE_LENGTH;
    const light = new THREE.PointLight(COL_ACCENT, 0.8, 6, 2);
    light.position.set(halfWidth * 0.85, 0.15, z);
    bridgeEffectsGroup.add(light);
    bridgeEdgeLights.push(light);
  }
  const bridgeEdgeLightsLeft: THREE.PointLight[] = [];
  for (let i = 0; i < BRIDGE_EDGE_LIGHT_COUNT; i++) {
    const t = (i + 0.5) / BRIDGE_EDGE_LIGHT_COUNT;
    const z = -halfLen + t * BRIDGE_LENGTH;
    const light = new THREE.PointLight(COL_ACCENT, 0.8, 6, 2);
    light.position.set(-halfWidth * 0.85, 0.15, z);
    bridgeEffectsGroup.add(light);
    bridgeEdgeLightsLeft.push(light);
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

  const RISE_RANGE = 3.5;
  const PARTICLE_Y_CEIL = -0.5;

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
  }

  /* ── Add to scene ────────────────────────────────────────── */

  scene.add(group);

  return {
    group,
    spawnCenter: new THREE.Vector3(SPAWN_CENTER_X, 0, SPAWN_CENTER_Z),
    update,
  };
}

/* ── Exported layout constants (for App.ts / PlayerCharacter) ─── */

export const SPAWN_PAD_CENTER_X = SPAWN_CENTER_X;
export const SPAWN_PAD_CENTER_Z = SPAWN_CENTER_Z;
