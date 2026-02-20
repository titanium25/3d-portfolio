import * as THREE from "three";
import type { Scene } from "three";
import { sampleRoadCurve } from "./timeline/timelineLayout";

/* ══════════════════════════════════════════════════════════════
 *  FLOATING HUB PLATFORM
 *  ──────────────────────────────────────────────────────────
 *  A hexagonal megastructure floating in the void.  Layered
 *  surfaces, an elevated center hub, energy-barrier edges,
 *  void cascade glow, and ambient particles create a sense
 *  of place rather than a flat test room.
 * ═══════════════════════════════════════════════════════════ */

/* ── Platform constants ─────────────────────────────────────── */

const SIZE = 12;
const SIDES = 6;
const ANGLE_OFFSET = -Math.PI / 6;

const PLATFORM_DEPTH = 1.5;
const BEVEL_SIZE = 0.25;
const BEVEL_THICKNESS = 0.15;
const BEVEL_SEGMENTS = 3;

const RIM_INSET = 0.35;
const RIM_WIDTH = 0.1;
const RIM_HEIGHT = 0.07;
const RIM_BEVEL = 0.018;
const RIM_BEVEL_SEGMENTS = 2;

const INNER_RADIUS = SIZE - RIM_INSET - RIM_WIDTH;
const INNER_SCALE = INNER_RADIUS / SIZE;

const UNDERGLOW_OFFSET = 0.4;
const PANEL_RINGS = [0.38, 0.68];

const ROAD_WIDTH = 2.4;
const ROAD_DASH_LEN = 0.6;
const ROAD_DASH_GAP = 0.8;

/* ── Center Hub ────────────────────────────────────────────── */

const HUB_RADIUS = 3.0;
const HUB_HEIGHT = 0.035;
const HUB_SIDES = 5; // Pentagon to match map polygonal style
const HUB_RING_RADII = [1.0, 1.8, 2.6];

/* ── Edge effects ──────────────────────────────────────────── */

const BARRIER_HEIGHT = 0.6;
const VOID_CASCADE_HEIGHT = 3.0;
const PARTICLE_COUNT = 80;

/* ── Palette ───────────────────────────────────────────────── */

const COL_BASE = 0x7b8fa3;
const COL_FLOOR = 0x1f2b38;
const COL_ACCENT = 0x00e5cc;
const COL_ROAD = 0x141c26;
const COL_HUB = 0x263a4a;

/* ── Return type ───────────────────────────────────────────── */

export interface GroundContext {
  group: THREE.Group;
  update(time: number): void;
}

/* ── Procedural roughness map ────────────────────────────────── */

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
  const coarseGrid: number[] = [];
  const coarseDim = Math.ceil(resolution / coarseSize);
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
      const coarseVal =
        c00 * (1 - fx) * (1 - fy) +
        c10 * fx * (1 - fy) +
        c01 * (1 - fx) * fy +
        c11 * fx * fy;

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

/* ── Canvas texture helpers ──────────────────────────────────── */

function createRadialGlowTexture(
  size: number,
  r: number,
  g: number,
  b: number,
  peakAlpha: number,
): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const half = size / 2;
  const grad = ctx.createRadialGradient(half, half, 0, half, half, half);
  grad.addColorStop(0, `rgba(${r},${g},${b},${peakAlpha})`);
  grad.addColorStop(0.45, `rgba(${r},${g},${b},${peakAlpha * 0.35})`);
  grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

function createDotTexture(size: number = 32): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const half = size / 2;
  const grad = ctx.createRadialGradient(half, half, 0, half, half, half);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.3, "rgba(255,255,255,0.5)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
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

function polygonVertex(i: number, sides: number, radius: number): [number, number] {
  const angle = (i / sides) * Math.PI * 2 - Math.PI / 2;
  return [Math.cos(angle) * radius, Math.sin(angle) * radius];
}

function createPolygonShape(radius: number, sides: number): THREE.Shape {
  const shape = new THREE.Shape();
  for (let i = 0; i < sides; i++) {
    const [x, z] = polygonVertex(i, sides, radius);
    if (i === 0) shape.moveTo(x, z);
    else shape.lineTo(x, z);
  }
  shape.closePath();
  return shape;
}

function toWorld(sx: number, sy: number, y: number): THREE.Vector3 {
  return new THREE.Vector3(sx, y, -sy);
}

/* ═══════════════════════════════════════════════════════════════
 *  Build the floating megastructure hub
 * ═════════════════════════════════════════════════════════════ */

export function createGround(scene: Scene): GroundContext {
  const group = new THREE.Group();

  /* ── Materials ─────────────────────────────────────────────── */

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
    emissiveIntensity: 0.6,
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

  const hubMat = new THREE.MeshStandardMaterial({
    color: COL_HUB,
    roughness: 1.0,
    roughnessMap: floorRoughnessMap,
    metalness: 0.10,
    envMapIntensity: 0.5,
  });

  const hubAoLoader = new THREE.TextureLoader();
  hubAoLoader.load(
    "/textures/MetalPlates017A_1K-JPG_AmbientOcclusion.jpg",
    (tex) => {
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(2.5, 2.5);
      hubMat.aoMap = tex;
      hubMat.aoMapIntensity = 1.0;
      hubMat.needsUpdate = true;
    },
  );

  /* ──────────────────────────────────────────────────────────
   * 1. Platform body — thick slab with beveled edges
   * ────────────────────────────────────────────────────────── */

  const bodyShape = createHexShape(SIZE);
  bodyShape.holes.push(createHexPath(INNER_RADIUS));

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

  /* ──────────────────────────────────────────────────────────
   * 2. Raised rim ring
   * ────────────────────────────────────────────────────────── */

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

  const rimMesh = new THREE.Mesh(rimGeom, baseMat);
  rimMesh.receiveShadow = true;
  rimMesh.castShadow = true;
  group.add(rimMesh);

  /* ──────────────────────────────────────────────────────────
   * 3. Inner plate — dark slate floor
   * ────────────────────────────────────────────────────────── */

  const innerShape = createHexShape(SIZE * INNER_SCALE);
  const innerGeom = new THREE.ShapeGeometry(innerShape);
  innerGeom.rotateX(-Math.PI / 2);
  innerGeom.translate(0, 0.01, 0);
  innerGeom.computeVertexNormals();

  const innerMesh = new THREE.Mesh(innerGeom, floorMat);
  innerMesh.receiveShadow = true;
  group.add(innerMesh);

  /* ──────────────────────────────────────────────────────────
   * 3b. Curved road strip (follows timeline arc)
   * ────────────────────────────────────────────────────────── */

  const ROAD_CURVE_SEGMENTS = 48;
  const roadCurve = sampleRoadCurve(ROAD_CURVE_SEGMENTS);

  {
    const verts: number[] = [];
    const idx: number[] = [];
    const roadY = 0.015;
    const halfW = ROAD_WIDTH / 2;

    for (let i = 0; i <= ROAD_CURVE_SEGMENTS; i++) {
      const p = roadCurve[i];
      let tx: number, tz: number;
      if (i < ROAD_CURVE_SEGMENTS) {
        tx = roadCurve[i + 1].x - p.x;
        tz = roadCurve[i + 1].z - p.z;
      } else {
        tx = p.x - roadCurve[i - 1].x;
        tz = p.z - roadCurve[i - 1].z;
      }
      const len = Math.sqrt(tx * tx + tz * tz);
      tx /= len;
      tz /= len;
      const nx = tz;
      const nz = -tx;

      verts.push(
        p.x - nx * halfW, roadY, p.z - nz * halfW,
        p.x + nx * halfW, roadY, p.z + nz * halfW,
      );
    }

    for (let i = 0; i < ROAD_CURVE_SEGMENTS; i++) {
      const b = i * 2;
      idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
    }

    const roadGeom = new THREE.BufferGeometry();
    roadGeom.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(verts, 3),
    );
    roadGeom.setIndex(idx);
    roadGeom.computeVertexNormals();

    const roadMesh = new THREE.Mesh(roadGeom, roadMat);
    roadMesh.receiveShadow = true;
    group.add(roadMesh);
  }

  {
    const roadMarkY = 0.018;
    const halfW = ROAD_WIDTH / 2;
    const markMat = new THREE.LineBasicMaterial({
      color: COL_ACCENT,
      transparent: true,
      opacity: 0.14,
    });

    for (const side of [-1, 1]) {
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= ROAD_CURVE_SEGMENTS; i++) {
        const p = roadCurve[i];
        let tx: number, tz: number;
        if (i < ROAD_CURVE_SEGMENTS) {
          tx = roadCurve[i + 1].x - p.x;
          tz = roadCurve[i + 1].z - p.z;
        } else {
          tx = p.x - roadCurve[i - 1].x;
          tz = p.z - roadCurve[i - 1].z;
        }
        const len = Math.sqrt(tx * tx + tz * tz);
        tx /= len;
        tz /= len;
        const nx = tz * side;
        const nz = -tx * side;
        pts.push(
          new THREE.Vector3(
            p.x + nx * halfW,
            roadMarkY,
            p.z + nz * halfW,
          ),
        );
      }
      group.add(
        new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(pts),
          markMat,
        ),
      );
    }

    const arcLens: number[] = [0];
    for (let i = 0; i < ROAD_CURVE_SEGMENTS; i++) {
      const dx = roadCurve[i + 1].x - roadCurve[i].x;
      const dz = roadCurve[i + 1].z - roadCurve[i].z;
      arcLens.push(arcLens[i] + Math.sqrt(dx * dx + dz * dz));
    }
    const totalLen = arcLens[ROAD_CURVE_SEGMENTS];

    function posAtArc(s: number): THREE.Vector3 {
      const sc = Math.max(0, Math.min(totalLen, s));
      let seg = 0;
      while (seg < ROAD_CURVE_SEGMENTS - 1 && arcLens[seg + 1] < sc) seg++;
      const denom = arcLens[seg + 1] - arcLens[seg];
      const lt = denom > 0 ? (sc - arcLens[seg]) / denom : 0;
      return new THREE.Vector3(
        roadCurve[seg].x + (roadCurve[seg + 1].x - roadCurve[seg].x) * lt,
        roadMarkY,
        roadCurve[seg].z + (roadCurve[seg + 1].z - roadCurve[seg].z) * lt,
      );
    }

    const dashPts: THREE.Vector3[] = [];
    const period = ROAD_DASH_LEN + ROAD_DASH_GAP;
    for (let s = ROAD_DASH_GAP; s < totalLen; s += period) {
      dashPts.push(posAtArc(s), posAtArc(Math.min(s + ROAD_DASH_LEN, totalLen)));
    }

    group.add(
      new THREE.LineSegments(
        new THREE.BufferGeometry().setFromPoints(dashPts),
        markMat,
      ),
    );
  }

  /* ──────────────────────────────────────────────────────────
   * 4. Underside accent ring — enhanced wide glow
   * ────────────────────────────────────────────────────────── */

  const glowRingShape = createHexShape(SIZE * 1.0);
  glowRingShape.holes.push(createHexPath(SIZE * 0.45));

  const glowGeom = new THREE.ShapeGeometry(glowRingShape);
  glowGeom.rotateX(-Math.PI / 2);
  glowGeom.computeVertexNormals();

  const glowMesh = new THREE.Mesh(glowGeom, accentMat);
  glowMesh.position.y = -(PLATFORM_DEPTH + UNDERGLOW_OFFSET);
  group.add(glowMesh);

  const underLight = new THREE.PointLight(COL_ACCENT, 1.5, 20, 2);
  underLight.position.set(0, -PLATFORM_DEPTH * 0.6, 0);
  group.add(underLight);

  /* ──────────────────────────────────────────────────────────
   * 5. Panel lines
   * ────────────────────────────────────────────────────────── */

  const panelY = 0.012;
  const panelLineMat = new THREE.LineBasicMaterial({
    color: COL_ACCENT,
    transparent: true,
    opacity: 0.1,
  });

  const panelPts: THREE.Vector3[] = [];

  for (let i = 0; i < SIDES; i++) {
    const [vx, vy] = hexVertex(i, rimInnerRadius * 0.97);
    panelPts.push(toWorld(0, 0, panelY));
    panelPts.push(toWorld(vx, vy, panelY));
  }

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
  group.add(new THREE.LineSegments(panelGeom, panelLineMat));

  /* ──────────────────────────────────────────────────────────
   * 6. Edge trim lines — brighter accent along rim borders
   * ────────────────────────────────────────────────────────── */

  const trimMat = new THREE.LineBasicMaterial({
    color: COL_ACCENT,
    transparent: true,
    opacity: 0.35,
  });

  for (const radius of [rimOuterRadius, rimInnerRadius]) {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= SIDES; i++) {
      const [x, z] = hexVertex(i % SIDES, radius);
      pts.push(toWorld(x, z, RIM_HEIGHT + 0.005));
    }
    const lineGeom = new THREE.BufferGeometry().setFromPoints(pts);
    group.add(new THREE.Line(lineGeom, trimMat));
  }

  /* ══════════════════════════════════════════════════════════
   *  FLOATING HUB ENHANCEMENTS
   * ════════════════════════════════════════════════════════ */

  /* ──────────────────────────────────────────────────────────
   * 8. Center Hub — elevated pentagon plate with accent rings,
   *    radial spokes, and a radial glow disc
   * ────────────────────────────────────────────────────────── */

  const hubShape = createPolygonShape(HUB_RADIUS, HUB_SIDES);
  const hubGeom = new THREE.ShapeGeometry(hubShape);
  hubGeom.rotateX(-Math.PI / 2);
  const hubMesh = new THREE.Mesh(hubGeom, hubMat);
  hubMesh.position.y = HUB_HEIGHT;
  hubMesh.receiveShadow = true;
  group.add(hubMesh);

  const hubOuterRingMat = new THREE.LineBasicMaterial({
    color: COL_ACCENT,
    transparent: true,
    opacity: 0.22,
  });
  {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= HUB_SIDES; i++) {
      const [x, z] = polygonVertex(i % HUB_SIDES, HUB_SIDES, HUB_RADIUS);
      pts.push(new THREE.Vector3(x, HUB_HEIGHT + 0.002, z));
    }
    group.add(
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(pts),
        hubOuterRingMat,
      ),
    );
  }

  const hubRingMat = new THREE.LineBasicMaterial({
    color: COL_ACCENT,
    transparent: true,
    opacity: 0.1,
  });
  for (const r of HUB_RING_RADII) {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= HUB_SIDES; i++) {
      const [x, z] = polygonVertex(i % HUB_SIDES, HUB_SIDES, r);
      pts.push(new THREE.Vector3(x, HUB_HEIGHT + 0.002, z));
    }
    group.add(
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(pts),
        hubRingMat,
      ),
    );
  }

  const hubSpokeMat = new THREE.LineBasicMaterial({
    color: COL_ACCENT,
    transparent: true,
    opacity: 0.07,
  });
  const hubSpokePts: THREE.Vector3[] = [];
  for (let i = 0; i < HUB_SIDES; i++) {
    const [x, z] = polygonVertex(i, HUB_SIDES, HUB_RADIUS * 0.92);
    const sy = HUB_HEIGHT + 0.002;
    hubSpokePts.push(new THREE.Vector3(0, sy, 0), new THREE.Vector3(x, sy, z));
  }
  group.add(
    new THREE.LineSegments(
      new THREE.BufferGeometry().setFromPoints(hubSpokePts),
      hubSpokeMat,
    ),
  );

  const centerGlowTex = createRadialGlowTexture(256, 0, 229, 204, 0.32);
  const centerGlowMat = new THREE.MeshBasicMaterial({
    map: centerGlowTex,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const centerGlowGeom = new THREE.PlaneGeometry(
    HUB_RADIUS * 3.0,
    HUB_RADIUS * 3.0,
  );
  centerGlowGeom.rotateX(-Math.PI / 2);
  const centerGlow = new THREE.Mesh(centerGlowGeom, centerGlowMat);
  centerGlow.position.y = HUB_HEIGHT + 0.003;
  group.add(centerGlow);

  /* ──────────────────────────────────────────────────────────
   * 9. Edge Energy Barrier — vertical glow planes per hex edge
   *    with scanline + shimmer animation
   * ────────────────────────────────────────────────────────── */

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

  for (let i = 0; i < SIDES; i++) {
    const [sx1, sy1] = hexVertex(i, SIZE * 0.99);
    const [sx2, sy2] = hexVertex((i + 1) % SIDES, SIZE * 0.99);
    const wx1 = sx1,
      wz1 = -sy1;
    const wx2 = sx2,
      wz2 = -sy2;

    const positions = new Float32Array([
      wx1, 0, wz1, wx2, 0, wz2, wx2, BARRIER_HEIGHT, wz2, wx1, 0, wz1, wx2,
      BARRIER_HEIGHT, wz2, wx1, BARRIER_HEIGHT, wz1,
    ]);
    const uvs = new Float32Array([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1]);
    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geom.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
    geom.computeVertexNormals();
    group.add(new THREE.Mesh(geom, barrierMat));
  }

  /* ──────────────────────────────────────────────────────────
   * 10. Void Cascade — energy waterfall below platform edges
   * ────────────────────────────────────────────────────────── */

  const voidCascadeMat = new THREE.ShaderMaterial({
    uniforms: {
      topColor: { value: new THREE.Color(COL_ACCENT) },
      opacity: { value: 0.5 },
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
        float fade = vUv.y * vUv.y;
        float flow = 0.8 + 0.2 * sin(vUv.x * 10.0 - time * 1.5 + vUv.y * 6.0);
        float alpha = opacity * fade * flow;
        vec3 col = topColor * (0.4 + 0.6 * vUv.y);
        gl_FragColor = vec4(col, alpha);
      }
    `,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  for (let i = 0; i < SIDES; i++) {
    const [sx1, sy1] = hexVertex(i, SIZE * 1.01);
    const [sx2, sy2] = hexVertex((i + 1) % SIDES, SIZE * 1.01);
    const wx1 = sx1,
      wz1 = -sy1;
    const wx2 = sx2,
      wz2 = -sy2;
    const yTop = 0;
    const yBot = -VOID_CASCADE_HEIGHT;

    const positions = new Float32Array([
      wx1, yTop, wz1, wx2, yTop, wz2, wx2, yBot, wz2, wx1, yTop, wz1, wx2,
      yBot, wz2, wx1, yBot, wz1,
    ]);
    const uvs = new Float32Array([0, 1, 1, 1, 1, 0, 0, 1, 1, 0, 0, 0]);
    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geom.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
    geom.computeVertexNormals();
    group.add(new THREE.Mesh(geom, voidCascadeMat));
  }

  /* ──────────────────────────────────────────────────────────
   * 11. Ambient Rising Particles — cyan dots drifting up
   *     from below the platform perimeter
   * ────────────────────────────────────────────────────────── */

  const particleBaseX = new Float32Array(PARTICLE_COUNT);
  const particleBaseZ = new Float32Array(PARTICLE_COUNT);
  const particleBaseY = new Float32Array(PARTICLE_COUNT);
  const particlePhases = new Float32Array(PARTICLE_COUNT);
  const particleSpeeds = new Float32Array(PARTICLE_COUNT);
  const pPositions = new Float32Array(PARTICLE_COUNT * 3);

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const angle = Math.random() * Math.PI * 2;
    const r = SIZE * (0.78 + Math.random() * 0.25);
    particleBaseX[i] = Math.cos(angle) * r;
    particleBaseZ[i] = Math.sin(angle) * r;
    particleBaseY[i] = -(PLATFORM_DEPTH + 1.0 + Math.random() * 2.0);
    particlePhases[i] = Math.random() * Math.PI * 2;
    particleSpeeds[i] = 0.06 + Math.random() * 0.1;

    pPositions[i * 3] = particleBaseX[i];
    pPositions[i * 3 + 1] = particleBaseY[i];
    pPositions[i * 3 + 2] = particleBaseZ[i];
  }

  const particleGeom = new THREE.BufferGeometry();
  particleGeom.setAttribute(
    "position",
    new THREE.BufferAttribute(pPositions, 3),
  );

  const dotTex = createDotTexture();
  const particleMat = new THREE.PointsMaterial({
    color: COL_ACCENT,
    size: 0.08,
    map: dotTex,
    transparent: true,
    opacity: 0.5,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  group.add(new THREE.Points(particleGeom, particleMat));

  /* ── Add to scene ────────────────────────────────────────── */

  scene.add(group);

  /* ── Per-frame update (animated effects) ─────────────────── */

  const RISE_RANGE = 3.5;
  const PARTICLE_Y_CEIL = -0.5;

  function update(time: number): void {
    barrierMat.uniforms.time.value = time;
    voidCascadeMat.uniforms.time.value = time;

    centerGlowMat.opacity = 0.4 + Math.sin(time * 0.6) * 0.1;
    underLight.intensity = 1.5 + Math.sin(time * 0.4) * 0.3;

    const posAttr = particleGeom.getAttribute(
      "position",
    ) as THREE.BufferAttribute;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const phase = particlePhases[i];
      const speed = particleSpeeds[i];
      const cycle = RISE_RANGE / speed;
      const t = ((time * speed + phase * 3) % cycle) / cycle;

      posAttr.setXYZ(
        i,
        particleBaseX[i] + Math.sin(time * 0.3 + phase) * 0.25,
        Math.min(PARTICLE_Y_CEIL, particleBaseY[i] + t * RISE_RANGE),
        particleBaseZ[i] + Math.cos(time * 0.25 + phase * 1.3) * 0.25,
      );
    }
    posAttr.needsUpdate = true;
  }

  return { group, update };
}
