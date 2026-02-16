import * as THREE from "three";
import type { Scene } from "three";

/* ── Platform constants ─────────────────────────────────────── */

const SIZE = 12;
const SIDES = 6;
const ANGLE_OFFSET = -Math.PI / 6; // match bounds.ts

// Thickness & bevel
const PLATFORM_DEPTH = 1.5;
const BEVEL_SIZE = 0.25;
const BEVEL_THICKNESS = 0.15;
const BEVEL_SEGMENTS = 3;

// Raised rim (creates the "stepped inset" look)
const RIM_INSET = 0.35;
const RIM_WIDTH = 1.1;
const RIM_HEIGHT = 0.07;
const RIM_BEVEL = 0.018;
const RIM_BEVEL_SEGMENTS = 2;

// Inner plate (recessed floor)
const INNER_RADIUS = SIZE - RIM_INSET - RIM_WIDTH; // ≈ 10.55
const INNER_SCALE = INNER_RADIUS / SIZE;

// Underside accent
const UNDERGLOW_OFFSET = 0.4;

// Panel lines
const PANEL_RINGS = [0.38, 0.68]; // concentric rings at fractions of inner radius

// Road-ready strip (directional hint — "this is where you go")
const ROAD_WIDTH = 2.4;
const ROAD_LENGTH = 18; // Z = -9 to +9
const ROAD_DASH_LEN = 0.6;
const ROAD_DASH_GAP = 0.8;

// Edge pylons — break up emptiness, give scale
const PYLON_CONFIGS: Array<{
  pos: [number, number, number];
  size: [number, number, number];
  rotY: number;
}> = [
  { pos: [8.0, 0, -3.0], size: [0.35, 0.65, 0.35], rotY: 0.3 },
  { pos: [-7.0, 0, -5.5], size: [0.25, 0.45, 0.25], rotY: -0.15 },
  { pos: [-7.5, 0, 5.0], size: [0.3, 0.85, 0.3], rotY: 0.5 },
  { pos: [5.5, 0, 7.5], size: [0.2, 0.38, 0.2], rotY: 0.1 },
  { pos: [-0.5, 0, -8.5], size: [0.4, 0.55, 0.28], rotY: -0.4 },
];

/* ── Palette (clean sci-fi, subtle neon) ─────────────────────── */

const COL_BASE = 0x7b8fa3; // cool light gray-blue   — rim + body
const COL_FLOOR = 0x1f2b38; // deep slate — inner plate (darkest surface)
const COL_ACCENT = 0x00e5cc; // cyan / teal emissive  — trim, glow, panels
const COL_ROAD = 0x141c26; // deepest dark — road strip (darkest surface)

/* ── Procedural roughness map ────────────────────────────────── *
 * A small canvas with value-noise, tiled across the surface.    *
 * Breaks the "flat plastic" look with micro-sheen variation.    *
 * ─────────────────────────────────────────────────────────────── */

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

  // Coarse pass: large-scale roughness patches
  const coarseSize = 8;
  const coarseGrid: number[] = [];
  const coarseDim = Math.ceil(resolution / coarseSize);
  for (let i = 0; i < coarseDim * coarseDim; i++) {
    coarseGrid[i] = (Math.random() - 0.5) * variation * 1.4;
  }

  for (let y = 0; y < resolution; y++) {
    for (let x = 0; x < resolution; x++) {
      // Sample coarse grid with bilinear interpolation
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
      const coarseVal =
        c00 * (1 - fx) * (1 - fy) +
        c10 * fx * (1 - fy) +
        c01 * (1 - fx) * fy +
        c11 * fx * fy;

      // Fine pass: per-pixel micro-grain
      const fineVal = (Math.random() - 0.5) * variation * 0.4;

      const v =
        Math.max(0, Math.min(1, baseRoughness + coarseVal + fineVal)) * 255;
      const idx = (y * resolution + x) * 4;
      d[idx] = v;
      d[idx + 1] = v;
      d[idx + 2] = v;
      d[idx + 3] = 255;
    }
  }

  ctx.putImageData(imageData, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(tileRepeat, tileRepeat);
  return texture;
}

/* ── Geometry helpers ────────────────────────────────────────── */

function hexVertex(i: number, radius: number): [number, number] {
  const angle = (i / SIDES) * Math.PI * 2 + ANGLE_OFFSET;
  return [Math.cos(angle) * radius, Math.sin(angle) * radius];
}

function createHexShape(radius: number): THREE.Shape {
  const shape = new THREE.Shape();
  for (let i = 0; i < SIDES; i++) {
    const [x, z] = hexVertex(i, radius);
    if (i === 0) shape.moveTo(x, z);
    else shape.lineTo(x, z);
  }
  shape.closePath();
  return shape;
}

function createHexPath(radius: number): THREE.Path {
  const path = new THREE.Path();
  for (let i = 0; i < SIDES; i++) {
    const [x, z] = hexVertex(i, radius);
    if (i === 0) path.moveTo(x, z);
    else path.lineTo(x, z);
  }
  path.closePath();
  return path;
}

/** Convert a 2-D shape-space coord to a 3-D world Vector3 at given Y. */
function toWorld(sx: number, sy: number, y: number): THREE.Vector3 {
  return new THREE.Vector3(sx, y, -sy);
}

/* ── Build the floating megastructure ────────────────────────── */

export function createGround(scene: Scene): THREE.Group {
  const group = new THREE.Group();

  /* ────────────────── Materials ───────────────────────────────
   * 1. baseMat   — body slab + rim ring + pylons (cool gray-blue)
   * 2. floorMat  — inner plate (deep slate)
   * 3. accentMat — underglow ring + pylon caps (cyan emissive)
   * 4. roadMat   — road-ready strip (deepest dark)
   *
   * Line materials don't count as "ground" materials.
   * ---------------------------------------------------------- */

  // roughnessMap values multiply with material.roughness — set material to 1.0
  // so the map alone controls effective roughness (no double-attenuation).
  const baseRoughnessMap = createNoiseRoughnessMap(128, 0.78, 0.10, 3);
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

  const accentMat = new THREE.MeshStandardMaterial({
    color: 0x061215,
    emissive: COL_ACCENT,
    emissiveIntensity: 0.25,
    roughness: 0.9,
    metalness: 0.0,
    side: THREE.DoubleSide,
  });

  const roadMat = new THREE.MeshStandardMaterial({
    color: COL_ROAD,
    roughness: 1.0,
    roughnessMap: floorRoughnessMap,
    metalness: 0.06,
    envMapIntensity: 0.3,
  });

  /* ----------------------------------------------------------
   * 1. Platform body — thick slab with beveled edges
   * --------------------------------------------------------- */

  const bodyShape = createHexShape(SIZE);
  const bodyGeom = new THREE.ExtrudeGeometry(bodyShape, {
    depth: PLATFORM_DEPTH,
    bevelEnabled: true,
    bevelThickness: BEVEL_THICKNESS,
    bevelSize: BEVEL_SIZE,
    bevelSegments: BEVEL_SEGMENTS,
  });
  bodyGeom.rotateX(-Math.PI / 2);
  bodyGeom.translate(0, -PLATFORM_DEPTH, 0);
  bodyGeom.computeVertexNormals();

  const bodyMesh = new THREE.Mesh(bodyGeom, baseMat);
  bodyMesh.receiveShadow = true;
  bodyMesh.castShadow = true;
  group.add(bodyMesh);

  /* ----------------------------------------------------------
   * 2. Raised rim ring — shares baseMat with body
   * --------------------------------------------------------- */

  const rimOuterRadius = SIZE - RIM_INSET;
  const rimInnerRadius = INNER_RADIUS;

  const rimShape = createHexShape(rimOuterRadius);
  rimShape.holes.push(createHexPath(rimInnerRadius));

  const rimGeom = new THREE.ExtrudeGeometry(rimShape, {
    depth: RIM_HEIGHT,
    bevelEnabled: true,
    bevelThickness: RIM_BEVEL,
    bevelSize: RIM_BEVEL,
    bevelSegments: RIM_BEVEL_SEGMENTS,
  });
  rimGeom.rotateX(-Math.PI / 2);
  rimGeom.computeVertexNormals();

  const rimMesh = new THREE.Mesh(rimGeom, baseMat); // same material as body
  rimMesh.receiveShadow = true;
  rimMesh.castShadow = true;
  group.add(rimMesh);

  /* ----------------------------------------------------------
   * 3. Inner plate — dark slate floor (floorMat)
   * --------------------------------------------------------- */

  const innerShape = createHexShape(SIZE * INNER_SCALE);
  const innerGeom = new THREE.ShapeGeometry(innerShape);
  innerGeom.rotateX(-Math.PI / 2);
  innerGeom.translate(0, 0.002, 0); // avoid z-fighting with body top cap
  innerGeom.computeVertexNormals();

  const innerMesh = new THREE.Mesh(innerGeom, floorMat);
  innerMesh.receiveShadow = true;
  group.add(innerMesh);

  /* ----------------------------------------------------------
   * 3b. Road-ready strip — darkest surface, runs along Z-axis.
   *     Suggests the player's travel direction at a glance.
   * --------------------------------------------------------- */

  const roadGeom = new THREE.PlaneGeometry(ROAD_WIDTH, ROAD_LENGTH);
  roadGeom.rotateX(-Math.PI / 2);

  const roadMesh = new THREE.Mesh(roadGeom, roadMat);
  roadMesh.position.y = 0.005;
  roadMesh.receiveShadow = true;
  group.add(roadMesh);

  // Road edge accent lines + center dashes (single LineSegments object)
  const roadMarkY = 0.007;
  const halfW = ROAD_WIDTH / 2;
  const halfL = ROAD_LENGTH / 2;
  const roadMarkPts: THREE.Vector3[] = [];

  // Side edges
  roadMarkPts.push(
    new THREE.Vector3(-halfW, roadMarkY, -halfL),
    new THREE.Vector3(-halfW, roadMarkY, halfL),
  );
  roadMarkPts.push(
    new THREE.Vector3(halfW, roadMarkY, -halfL),
    new THREE.Vector3(halfW, roadMarkY, halfL),
  );

  // Center dashes
  for (
    let z = -halfL + ROAD_DASH_GAP;
    z < halfL;
    z += ROAD_DASH_LEN + ROAD_DASH_GAP
  ) {
    const zEnd = Math.min(z + ROAD_DASH_LEN, halfL);
    roadMarkPts.push(
      new THREE.Vector3(0, roadMarkY, z),
      new THREE.Vector3(0, roadMarkY, zEnd),
    );
  }

  const roadMarkGeom = new THREE.BufferGeometry().setFromPoints(roadMarkPts);
  const roadMarkMat = new THREE.LineBasicMaterial({
    color: COL_ACCENT,
    transparent: true,
    opacity: 0.14,
  });
  const roadMarks = new THREE.LineSegments(roadMarkGeom, roadMarkMat);
  group.add(roadMarks);

  /* ----------------------------------------------------------
   * 4. Underside accent ring — accentMat (cyan glow)
   * --------------------------------------------------------- */

  const glowRingShape = createHexShape(SIZE * 0.96);
  glowRingShape.holes.push(createHexPath(SIZE * 0.70));

  const glowGeom = new THREE.ShapeGeometry(glowRingShape);
  glowGeom.rotateX(-Math.PI / 2);
  glowGeom.computeVertexNormals();

  const glowMesh = new THREE.Mesh(glowGeom, accentMat);
  glowMesh.position.y = -(PLATFORM_DEPTH + UNDERGLOW_OFFSET);
  group.add(glowMesh);

  /* ----------------------------------------------------------
   * 5. Panel lines — hex-grid grooves etched into the floor.
   *    Radial spokes + concentric rings = tech floor panels.
   * --------------------------------------------------------- */

  const panelY = 0.004; // just above inner plate surface
  const panelLineMat = new THREE.LineBasicMaterial({
    color: COL_ACCENT,
    transparent: true,
    opacity: 0.1,
  });

  const panelPts: THREE.Vector3[] = [];

  // Radial spokes — center to each inner-hex vertex
  for (let i = 0; i < SIDES; i++) {
    const [vx, vy] = hexVertex(i, rimInnerRadius * 0.97);
    panelPts.push(toWorld(0, 0, panelY));
    panelPts.push(toWorld(vx, vy, panelY));
  }

  // Concentric hex rings
  for (const frac of PANEL_RINGS) {
    const r = rimInnerRadius * frac;
    for (let i = 0; i < SIDES; i++) {
      const [x1, y1] = hexVertex(i, r);
      const [x2, y2] = hexVertex((i + 1) % SIDES, r);
      panelPts.push(toWorld(x1, y1, panelY));
      panelPts.push(toWorld(x2, y2, panelY));
    }
  }

  const panelGeom = new THREE.BufferGeometry().setFromPoints(panelPts);
  const panelLines = new THREE.LineSegments(panelGeom, panelLineMat);
  group.add(panelLines);

  /* ----------------------------------------------------------
   * 6. Edge trim lines — brighter accent along the rim borders
   * --------------------------------------------------------- */

  const trimMat = new THREE.LineBasicMaterial({
    color: COL_ACCENT,
    transparent: true,
    opacity: 0.3,
  });

  for (const radius of [rimOuterRadius, rimInnerRadius]) {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= SIDES; i++) {
      const [x, z] = hexVertex(i % SIDES, radius);
      pts.push(toWorld(x, z, RIM_HEIGHT + 0.005));
    }
    const lineGeom = new THREE.BufferGeometry().setFromPoints(pts);
    const line = new THREE.Line(lineGeom, trimMat);
    group.add(line);
  }

  /* ----------------------------------------------------------
   * 7. Edge pylons — small placeholder volumes near the rim.
   *    Break up emptiness, provide scale reference, frame space.
   * --------------------------------------------------------- */

  for (const { pos, size, rotY } of PYLON_CONFIGS) {
    const [w, h, d] = size;

    // Pylon body
    const pylonGeom = new THREE.BoxGeometry(w, h, d);
    const pylon = new THREE.Mesh(pylonGeom, baseMat);
    pylon.position.set(pos[0], h / 2, pos[2]);
    pylon.rotation.y = rotY;
    pylon.castShadow = true;
    pylon.receiveShadow = true;
    group.add(pylon);

    // Tiny accent cap (emissive lid)
    const capGeom = new THREE.BoxGeometry(w * 1.15, 0.02, d * 1.15);
    const cap = new THREE.Mesh(capGeom, accentMat);
    cap.position.set(pos[0], h + 0.01, pos[2]);
    cap.rotation.y = rotY;
    group.add(cap);
  }

  scene.add(group);
  return group;
}
