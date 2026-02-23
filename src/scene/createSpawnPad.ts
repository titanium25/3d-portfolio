import * as THREE from "three";
import type { Scene } from "three";

/* ══════════════════════════════════════════════════════════════
 *  SPAWN PAD + TIMELINE BRIDGE  —  Phase 1 (structural only)
 *  ──────────────────────────────────────────────────────────
 *  Layout (top-down, +Z = toward viewer / bottom of screen):
 *
 *          [Main Arena]           (centre 0,0,0)
 *               |
 *          [Bridge]               runs along +Z axis
 *               |
 *          [Spawn Pad]            player starts here
 *
 *  The bridge attaches to the arena's bottom flat face (+Z face).
 *  The spawn pad sits at the far (high-Z) end of the bridge.
 *
 *  Fix 1 — Spawn pad width: the hex is sized so its flat face
 *  (apothem edge) exactly equals the bridge width, giving a
 *  natural flush connection.
 *
 *  Fix 2 — Bridge along +Z.  Portals face along +Z so the
 *  player walks straight through each arch (rotationY = 0).
 * ═══════════════════════════════════════════════════════════ */

/* ── Main-arena constants (must stay in sync with createGround) ── */

const ARENA_SIZE   = 12;
const ARENA_SIDES  = 6;
const ARENA_ANGLE_OFFSET = -Math.PI / 6;

/** Apothem of the main hex (centre → flat-face midpoint). */
const ARENA_APOTHEM = ARENA_SIZE * Math.cos(Math.PI / 6); // ≈ 10.392

/* ── Bridge dimensions ───────────────────────────────────────── */

/**
 * 30% of main-hex flat-to-flat width (2 × ARENA_APOTHEM).
 * The bridge runs along the +Z axis.
 */
const BRIDGE_WIDTH  = ARENA_APOTHEM * 2 * 0.30; // ≈ 6.235

/**
 * Long enough for 4 timeline portals (~2.8 unit spacing)
 * with ~1.5 units of breathing room on each end.
 */
const BRIDGE_LENGTH = 14;

/** Bridge starts at the arena's bottom flat face (Z = +ARENA_APOTHEM). */
const BRIDGE_NEAR_Z = ARENA_APOTHEM;                   // ≈ 10.392
const BRIDGE_FAR_Z  = BRIDGE_NEAR_Z + BRIDGE_LENGTH;  // ≈ 24.392
const BRIDGE_CENTER_Z = (BRIDGE_NEAR_Z + BRIDGE_FAR_Z) / 2; // ≈ 17.392

/* ── Spawn pad dimensions ────────────────────────────────────── */

/**
 * Size the hex so its flat face (apothem) exactly equals BRIDGE_WIDTH/2,
 * making the connecting edge flush with the bridge at both sides.
 *   apothem = size × cos(30°)  →  size = (BRIDGE_WIDTH/2) / cos(30°)
 */
const SPAWN_APOTHEM = BRIDGE_WIDTH / 2;                            // ≈ 3.117
const SPAWN_SIZE    = SPAWN_APOTHEM / Math.cos(Math.PI / 6);      // ≈ 3.598

/** Spawn pad sits immediately beyond the bridge far end, flush. */
const SPAWN_CENTER_Z = BRIDGE_FAR_Z + SPAWN_APOTHEM;              // ≈ 27.51
const SPAWN_CENTER_X = 0;

/* ── Slab constants (mirrored from createGround) ─────────────── */

const PLATFORM_DEPTH    = 1.5;
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

/* ── Geometry helpers ────────────────────────────────────────── */

function hexVertex(i: number, radius: number): [number, number] {
  const angle = (i / ARENA_SIDES) * Math.PI * 2 + ARENA_ANGLE_OFFSET;
  return [Math.cos(angle) * radius, Math.sin(angle) * radius];
}

function createHexShape(radius: number): THREE.Shape {
  const shape = new THREE.Shape();
  for (let i = 0; i < ARENA_SIDES; i++) {
    const [x, z] = hexVertex(i, radius);
    if (i === 0) shape.moveTo(x, z);
    else shape.lineTo(x, z);
  }
  shape.closePath();
  return shape;
}

function createHexPath(radius: number): THREE.Path {
  const path = new THREE.Path();
  for (let i = 0; i < ARENA_SIDES; i++) {
    const [x, z] = hexVertex(i, radius);
    if (i === 0) path.moveTo(x, z);
    else path.lineTo(x, z);
  }
  path.closePath();
  return path;
}

function createNoiseRoughnessMap(
  resolution: number,
  baseRoughness: number,
  variation: number,
  tileRepeat: number,
): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = resolution;
  canvas.height = resolution;
  const ctx = canvas.getContext("2d")!;
  const imageData = ctx.createImageData(resolution, resolution);
  const d = imageData.data;
  const coarseSize = 8;
  const coarseDim = Math.ceil(resolution / coarseSize);
  const coarseGrid: number[] = [];
  for (let i = 0; i < coarseDim * coarseDim; i++) {
    coarseGrid[i] = (Math.random() - 0.5) * variation * 1.4;
  }
  for (let y = 0; y < resolution; y++) {
    for (let x = 0; x < resolution; x++) {
      const gx = x / coarseSize;
      const gy = y / coarseSize;
      const gx0 = Math.floor(gx) % coarseDim;
      const gy0 = Math.floor(gy) % coarseDim;
      const gx1 = (gx0 + 1) % coarseDim;
      const gy1 = (gy0 + 1) % coarseDim;
      const fx = gx - Math.floor(gx);
      const fy = gy - Math.floor(gy);
      const c00 = coarseGrid[gy0 * coarseDim + gx0];
      const c10 = coarseGrid[gy0 * coarseDim + gx1];
      const c01 = coarseGrid[gy1 * coarseDim + gx0];
      const c11 = coarseGrid[gy1 * coarseDim + gx1];
      const val = baseRoughness
        + c00 * (1 - fx) * (1 - fy) + c10 * fx * (1 - fy)
        + c01 * (1 - fx) * fy       + c11 * fx * fy
        + (Math.random() - 0.5) * variation * 0.4;
      const v = Math.max(0, Math.min(1, val)) * 255;
      const idx = (y * resolution + x) * 4;
      d[idx] = v; d[idx + 1] = v; d[idx + 2] = v; d[idx + 3] = 255;
    }
  }
  ctx.putImageData(imageData, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(tileRepeat, tileRepeat);
  return texture;
}

/* ══════════════════════════════════════════════════════════════
 *  Public API
 * ═════════════════════════════════════════════════════════════ */

export interface SpawnPadContext {
  group: THREE.Group;
  /** World-space centre of the spawn pad floor (Y = 0). */
  spawnCenter: THREE.Vector3;
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

  /* ══════════════════════════════════════════════════════════
   *  A. SPAWN PAD
   *     Hexagonal platform sized so its flat-face width matches
   *     the bridge width exactly.  Centred at (0, 0, SPAWN_CENTER_Z).
   * ════════════════════════════════════════════════════════ */

  const spawnGroup = new THREE.Group();
  spawnGroup.position.set(SPAWN_CENTER_X, 0, SPAWN_CENTER_Z);

  /* A1. Body slab */
  const spawnInnerRadius = SPAWN_SIZE - RIM_INSET - RIM_WIDTH;

  const spawnBodyShape = createHexShape(SPAWN_SIZE);
  spawnBodyShape.holes.push(createHexPath(spawnInnerRadius));

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
  const spawnRimShape = createHexShape(spawnRimOuter);
  spawnRimShape.holes.push(createHexPath(spawnInnerRadius));

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
  const spawnFloorShape = createHexShape(SPAWN_SIZE * spawnInnerScale);
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
      const [sx, sy] = hexVertex(i % ARENA_SIDES, radius);
      pts.push(new THREE.Vector3(sx, RIM_HEIGHT + 0.005, -sy));
    }
    spawnGroup.add(
      new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), trimMat),
    );
  }

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
    depth: PLATFORM_DEPTH,
    bevelEnabled: bridgeBevelSize > 0,
    bevelThickness: bridgeBevelThick,
    bevelSize: bridgeBevelSize,
    bevelSegments: BEVEL_SEGMENTS,
  });
  // shape-X → world-X, shape-Y → −world-Z  (rotateX flips sign)
  // translate centre from local-origin to BRIDGE_CENTER_Z along world-Z
  bridgeBodyGeom.rotateX(-Math.PI / 2);
  bridgeBodyGeom.translate(0, -PLATFORM_DEPTH, 0);
  bridgeBodyGeom.computeVertexNormals();

  const bridgeBody = new THREE.Mesh(bridgeBodyGeom, baseMat);
  bridgeBody.position.set(0, 0, BRIDGE_CENTER_Z);
  bridgeBody.receiveShadow = true;
  bridgeBody.castShadow = true;
  group.add(bridgeBody);

  /* B2. Bridge inner floor plate */
  const bfInset     = Math.min(RIM_INSET + RIM_WIDTH, halfLen * 0.2);
  const bfHalfLen   = halfLen   - bfInset;
  const bfHalfWidth = halfWidth - bfInset;

  if (bfHalfLen > 0.01 && bfHalfWidth > 0.01) {
    const bridgeFloorShape = new THREE.Shape();
    bridgeFloorShape.moveTo(-bfHalfWidth, -bfHalfLen);
    bridgeFloorShape.lineTo( bfHalfWidth, -bfHalfLen);
    bridgeFloorShape.lineTo( bfHalfWidth,  bfHalfLen);
    bridgeFloorShape.lineTo(-bfHalfWidth,  bfHalfLen);
    bridgeFloorShape.closePath();

    const bridgeFloorGeom = new THREE.ShapeGeometry(bridgeFloorShape);
    bridgeFloorGeom.rotateX(-Math.PI / 2);
    bridgeFloorGeom.computeVertexNormals();

    const bridgeFloor = new THREE.Mesh(bridgeFloorGeom, floorMat);
    bridgeFloor.position.set(0, 0.01, BRIDGE_CENTER_Z);
    bridgeFloor.receiveShadow = true;
    group.add(bridgeFloor);
  }

  /* B3. Bridge long-edge trim lines (running along world-Z) */
  const bridgeTrimY = RIM_HEIGHT + 0.005;
  for (const side of [-1, 1]) {
    const wx = side * halfWidth;
    const pts = [
      new THREE.Vector3(wx, bridgeTrimY, BRIDGE_NEAR_Z),
      new THREE.Vector3(wx, bridgeTrimY, BRIDGE_FAR_Z),
    ];
    group.add(
      new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), trimMat),
    );
  }

  /* ── Add to scene ────────────────────────────────────────── */

  scene.add(group);

  return {
    group,
    spawnCenter: new THREE.Vector3(SPAWN_CENTER_X, 0, SPAWN_CENTER_Z),
  };
}

/* ── Exported layout constants (for App.ts / PlayerCharacter) ─── */

export const SPAWN_PAD_CENTER_X = SPAWN_CENTER_X;
export const SPAWN_PAD_CENTER_Z = SPAWN_CENTER_Z;
